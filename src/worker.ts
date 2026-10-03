import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { accountMatches, findMaskedAccountCandidates, resolveAccount } from './account-match.js';
import { decrypt } from './crypto.js';
import { pool, query, tx } from './db.js';
import { env } from './env.js';
import {
  GmailReauthRequiredError,
  dkimPasses,
  fromAddress,
  getAttachment,
  getMessage,
  hasPdfMagic,
  listMessagesFromSender,
  pickPdfAttachments,
  refreshAccessToken,
  type GmailPayload,
} from './gmail.js';
import { parsers } from './parsers/index.js';
import type { ParsedStatement } from './parsers/types.js';
import { reconcileTransfers } from './services/transfer-matching.js';

type Bank = {
  id: number;
  name: string;
  sender_email: string;
  sender_domain: string;
  subject_monthly: string;
  subject_ondemand: string;
  attachment_filename_pattern: string;
  parser_key: string;
};

type BankAccountCandidate = { id: number; bank_id: number; account_number: string; pdf_password_enc: string };

// ตรงกับ SyncSummary ใน web/src/api.ts — แก้ที่หนึ่งต้องแก้อีกที่
export type SyncSummary = {
  messages_scanned: number;
  statements_inserted: number;
  statements_failed: number;
  skipped: number;
  already_running: boolean;
};

type StatementStatus = 'pending' | 'parsed' | 'checksum_failed' | 'parse_failed';

/** สถานะที่ไฟล์แนบของอีเมลหนึ่งฉบับจบลงในรอบนี้ → ยอดสรุป
 *  ไฟล์ที่อ่านสำเร็จไปแล้วในรอบก่อนไม่อยู่ในรายการ (ข้ามด้วย pdf_sha256) แต่ไฟล์ที่ยังพังอยู่อยู่ทุกรอบ จึงนับเป็น failed ไม่ใช่ inserted */
export function countStatements(statuses: StatementStatus[]): { inserted: number; failed: number } {
  const failed = statuses.filter((s) => s === 'parse_failed' || s === 'checksum_failed').length;
  return { inserted: statuses.length - failed, failed };
}

/** ไฟล์ที่พังก่อนรู้เลขบัญชี (รหัสของทุกบัญชีเปิดไม่ได้ / pdftotext พัง / parse throw) ต้องลง parse_failed ไม่ใช่หายเงียบ
 *  ชื่อไฟล์ชี้บัญชีเดียวได้ก็ลงบัญชีนั้น ไม่งั้นลงทุกบัญชีในกล่อง (แต่ละแถวมีปุ่มตั้งรหัสของบัญชีนั้น)
 *  ส่วนไฟล์ที่เปิดได้แต่เลขบัญชีไม่ตรงบัญชีใดในกล่อง = statement ของบัญชีที่ผู้ใช้ไม่ได้เพิ่มไว้ → ข้าม ไม่ลงแถว */
export function failedAccountTargets<T extends { account_number: string }>(candidates: readonly T[], filename: string): T[] {
  if (candidates.length === 1) return [...candidates];
  const byName = resolveAccount(candidates, filename);
  return byName ? [byName] : [...candidates];
}

// ไฟล์เดียวกันที่เคยค้าง parse_failed ใต้บัญชีอื่นในกล่องนี้ (ตอนรหัสผิด) — อ่านสำเร็จ/พังใต้บัญชีชุดใหม่/ข้ามไฟล์ ต้องล้าง
// ไม่งั้นแดชบอร์ดเตือนค้างตลอด $3 = บัญชีที่เพิ่งเขียน (on conflict ทับไปแล้ว) ว่าง = ล้างทุกบัญชีในกล่อง
const CLEAR_STALE_FAILED_SQL = `delete from statement s using bank_account a
  where a.id = s.bank_account_id and a.email_account_id = $1 and s.pdf_sha256 = $2
    and s.status = 'parse_failed' and s.bank_account_id <> all($3::bigint[])`;

/** บัญชีเจ้าของ statement จากเลขบัญชีที่เห็นในไฟล์: 1 ตัว = เจ้าของ, ว่าง = statement ของบัญชีที่ผู้ใช้ไม่ได้เพิ่ม (ข้าม),
 *  ≥2 = เลขที่เห็นซ้ำกันในบัญชีของผู้ใช้เอง (กำกวม ต้องลง parse_failed ไม่ใช่หายเงียบ)
 *  หลายโทเค็น: โทเค็นแรกที่ตรงบัญชีเดียวชนะ (เหมือนเดิม) ไม่มีถึงรวมบัญชีของโทเค็นที่ตรงหลายบัญชี */
export function matchAccounts<T extends { account_number: string }>(candidates: readonly T[], tokens: readonly string[]): T[] {
  const ambiguous = new Set<T>();
  for (const token of tokens) {
    const hits = candidates.filter((a) => accountMatches(a.account_number, token));
    if (hits.length === 1) return hits;
    for (const hit of hits) ambiguous.add(hit);
  }
  return [...ambiguous];
}

/** ขอ access token ไม่สำเร็จแบบชั่วคราว (5xx/เน็ตหลุด) — แยกจาก error ของ DB/โค้ด ให้ route ตอบ 502 ได้ถูกตัว */
export class GmailUnavailableError extends Error {}

// ponytail: กัน sync ซ้อนต่อกล่องอีเมลเดียวด้วย memory Set พอสำหรับ instance เดียว
// ถ้าสเกลหลาย instance ค่อยย้ายไป pg_advisory_lock ต่อ email_account_id
// pendingFull ก็อยู่ใน memory เหมือนกัน — โปรเซสตายระหว่างรอ = คำขอ full ที่ค้างหาย (รอบชั่วโมงยังดึงแบบ incremental ต่อ)
const running = new Set<number>();
const pendingFull = new Set<number>();

export async function syncEmailAccount(emailAccountId: number, opts: { full?: boolean } = {}): Promise<SyncSummary> {
  if (running.has(emailAccountId)) {
    // ขอ full ชนรอบที่กำลังวิ่ง (เช่น เพิ่งแก้รหัสผ่าน PDF ระหว่างรอบชั่วโมง) — จำไว้รันต่อท้าย ไม่งั้นคำขอหายเงียบ
    if (opts.full) pendingFull.add(emailAccountId);
    return { messages_scanned: 0, statements_inserted: 0, statements_failed: 0, skipped: 0, already_running: true };
  }
  running.add(emailAccountId);
  try {
    return await doSync(emailAccountId, opts.full === true);
  } finally {
    running.delete(emailAccountId);
    if (pendingFull.delete(emailAccountId)) {
      syncEmailAccount(emailAccountId, { full: true }).catch((e) =>
        console.error(`[worker] full ที่รอต่อท้าย mailbox=${emailAccountId} ล้มเหลว:`, e),
      );
    }
  }
}

async function doSync(emailAccountId: number, requestFull: boolean): Promise<SyncSummary> {
  const summary: SyncSummary = {
    messages_scanned: 0, statements_inserted: 0, statements_failed: 0, skipped: 0, already_running: false,
  };

  const { rows } = await query<{
    id: number; user_id: number; refresh_token_enc: string; last_synced_at: Date | null; reauth_required_at: Date | null;
  }>(
    'select id, user_id, refresh_token_enc, last_synced_at, reauth_required_at from email_account where id = $1',
    [emailAccountId],
  );
  const account = rows[0];
  if (!account) return summary;
  // รู้อยู่แล้วว่า refresh token ใช้ไม่ได้ — ไม่ยิง Google ซ้ำจนกว่าผู้ใช้จะเชื่อมใหม่ (auth.ts ล้างค่านี้ตอน upsert)
  if (account.reauth_required_at) throw new GmailReauthRequiredError('กล่องนี้ต้องเชื่อม Gmail ใหม่ก่อน');

  const banks = (await query<Bank>('select * from bank where is_active = true')).rows;
  if (!banks.length) return summary;

  const refreshToken = decrypt(account.refresh_token_enc);
  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(refreshToken);
  } catch (e) {
    if (!(e instanceof GmailReauthRequiredError)) throw new GmailUnavailableError('ติดต่อ Google ไม่ได้ชั่วคราว', { cause: e });
    // เทียบ ciphertext เดิม — ถ้าผู้ใช้เชื่อมใหม่สำเร็จระหว่างรอ Google ตอบ แถวใหม่ต้องไม่โดนตั้งสถานะทับ
    await query('update email_account set reauth_required_at = now() where id = $1 and refresh_token_enc = $2', [
      emailAccountId,
      account.refresh_token_enc,
    ]);
    throw e;
  }

  // จับเวลาก่อน list — เมลที่เข้ามาระหว่าง list จะอยู่ในช่วงของรอบหน้า ไม่ตกรอยต่อ
  const startedAt = new Date();
  // ย้อนซ้อนรอบก่อน 2 วันได้เพราะไฟล์ที่เคยนำเข้าแล้วถูกข้ามด้วย pdf_sha256 ใน processMessage อยู่แล้ว
  const after = requestFull || !account.last_synced_at
    ? undefined
    : new Date(account.last_synced_at.getTime() - 2 * 24 * 60 * 60 * 1000);
  // ค้นต่อผู้ส่งของธนาคารเท่านั้น (Gmail กรองฝั่งเซิร์ฟเวอร์) — ไม่ดึงเมลอื่นในกล่องมาดูเลย
  const messageIds = new Set<string>();
  for (const bank of banks) {
    for (const id of await listMessagesFromSender(accessToken, bank.sender_email, after)) messageIds.add(id);
  }

  // ความล้มเหลวต่อ 1 ข้อความถูกกันไว้ในนี้ ไม่ให้ข้อความเดียวที่พังทำให้ทั้งกล่องไม่ขยับ cursor
  for (const messageId of messageIds) {
    summary.messages_scanned++;
    try {
      const { inserted, failed } = countStatements(await processMessage(accessToken, messageId, emailAccountId, banks));
      // statements_* นับไฟล์ ไม่ใช่อีเมล เพราะ SCB ย้อนหลังแนบหลาย statement ใน message เดียว
      summary.statements_inserted += inserted;
      summary.statements_failed += failed;
      if (!inserted && !failed) summary.skipped++;
    } catch (e) {
      console.error(`[worker] mailbox=${emailAccountId} message=${messageId} ล้มเหลว:`, e);
      summary.skipped++;
    }
  }

  // สำเร็จทั้งรอบ (list ได้ครบ) ถึงขยับ cursor — ถ้า list เองล้มเหลว (throw ก่อนถึงตรงนี้) cursor จะไม่ขยับ
  await query('update email_account set last_synced_at = $2 where id = $1', [emailAccountId, startedAt]);

  // จับคู่โอนภายในหลังเขียน txn ของรอบนี้เสร็จ — คู่ชัดเจนยืนยันเอง กรณีคลุมเครือเก็บเป็น suggestion
  // ไม่ผูกกับ tx() ของ statement ไหนโดยเฉพาะ พังแล้วไม่ควรทำให้ sync รอบนี้ fail ทั้งรอบ
  try {
    await reconcileTransfers(pool, account.user_id);
  } catch (e) {
    console.error(`[worker] mailbox=${emailAccountId} reconcileTransfers ล้มเหลว:`, e);
  }

  // ไม่มีขั้น reconcile แผนกับ statement อีกแล้ว — statement เข้ามาแล้วจบที่ txn เท่านั้น
  // การจ่าย/การรับเงินในแผนเป็นสิ่งที่ผู้ใช้บันทึกเอง ไม่มีอะไรต้องไล่จับคู่ตามหลัง

  return summary;
}

type ExtractResult = { ok: true; text: string } | { ok: false; reason: string };

/** qpdf ถอดรหัส (รหัสผ่านผ่าน stdin ไม่ใช่ argv) → pdftotext สกัดข้อความ ทั้งหมดอยู่ใน pipe ไม่แตะดิสก์ */
function extractText(pdfPath: string, password: string): Promise<ExtractResult> {
  return new Promise((resolve, reject) => {
    const qpdf = spawn('qpdf', ['--password-file=-', '--decrypt', pdfPath, '-']);
    const pdftotext = spawn('pdftotext', ['-layout', '-', '-']);

    // EPIPE ถ้าอีกฝั่งปิดสตรีมก่อน (เช่น PDF พังจนอ่านไม่จบ) — ไม่ใส่ listener แล้ว Node ถือเป็น uncaught exception ทั้งโปรเซส
    // ปล่อยให้ exit code ของแต่ละโปรเซสเป็นตัวตัดสินผลแทน ไม่ใช่ error event นี้
    qpdf.stdin.on('error', () => {});
    pdftotext.stdin.on('error', () => {});
    qpdf.stdout.pipe(pdftotext.stdin);
    qpdf.stdin.write(password + '\n');
    qpdf.stdin.end();

    const textChunks: Buffer[] = [];
    pdftotext.stdout.on('data', (d: Buffer) => textChunks.push(d));

    let qpdfCode: number | null = null;
    let pdftotextCode: number | null = null;
    let settled = false;

    function finish(): void {
      if (settled || qpdfCode === null || pdftotextCode === null) return;
      settled = true;
      // exit 0 = ผ่าน, exit 3 = มี warning แต่สำเร็จ (ต้องนับเป็นผ่าน), อื่น ๆ = พัง (รวมรหัสผิด)
      if (qpdfCode !== 0 && qpdfCode !== 3) {
        resolve({ ok: false, reason: 'decrypt_failed' });
      } else if (pdftotextCode !== 0) {
        resolve({ ok: false, reason: 'pdftotext_failed' });
      } else {
        resolve({ ok: true, text: Buffer.concat(textChunks).toString('utf8') });
      }
    }

    qpdf.on('error', reject);
    pdftotext.on('error', reject);
    qpdf.on('close', (code) => {
      qpdfCode = code ?? -1;
      finish();
    });
    pdftotext.on('close', (code) => {
      pdftotextCode = code ?? -1;
      finish();
    });
  });
}

/** ไฟล์เดียวลง parse_failed ใต้บัญชีเป้า แล้วล้างแถวพังของไฟล์เดียวกันใต้บัญชีอื่นในกล่อง (tx เดียว)
 *  เช่นรอบก่อนพังใต้ [A,B] รอบนี้ชื่อไฟล์ชี้ [A] — แถวของ B ต้องไม่ค้าง คืน true ถ้าเขียนได้อย่างน้อยหนึ่งแถว */
export async function writeParseFailed(
  emailAccountId: number,
  bankAccountIds: number[],
  messageId: string,
  attachmentId: string,
  pdfSha256: string,
  rawPdfPath: string,
  reason: string,
): Promise<boolean> {
  return tx(async (client) => {
    let written = false;
    for (const bankAccountId of bankAccountIds) {
      const result = await client.query(
        `insert into statement (bank_account_id, gmail_message_id, gmail_attachment_id, pdf_sha256, period_start, period_end, raw_pdf_path, status, error_detail)
         values ($1, $2, $3, $4, null, null, $5, 'parse_failed', $6)
         on conflict (bank_account_id, pdf_sha256) where pdf_sha256 is not null do update
           set gmail_message_id = excluded.gmail_message_id,
               gmail_attachment_id = excluded.gmail_attachment_id,
               raw_pdf_path = excluded.raw_pdf_path,
               error_detail = excluded.error_detail
           where statement.status = 'parse_failed'
         returning id`,
        [bankAccountId, messageId, attachmentId, pdfSha256, rawPdfPath, JSON.stringify({ reason })],
      );
      if (result.rowCount === 1) written = true;
    }
    await client.query(CLEAR_STALE_FAILED_SQL, [emailAccountId, pdfSha256, bankAccountIds]);
    return written;
  });
}

/** ข้ามไฟล์ = ไม่ทิ้งร่องรอย: แถวพังที่ค้างจากรอบก่อน (เช่นตอนรหัสผิด) ต้องหาย ไม่งั้นค้างถาวร
 *  และ PDF ที่เพิ่งเขียน (เปิดได้ด้วยรหัสของผู้ใช้แต่ไม่มีแถวชี้) ต้องถูกลบ — เว้นแต่ยังมีแถวอื่นชี้ path เดียวกัน
 *  (เช่นบัญชีที่ย้ายไปกล่องอื่นแล้ว แถวเก่ายังชี้ไฟล์ในโฟลเดอร์ของกล่องนี้) */
export async function skipStatementFile(emailAccountId: number, pdfSha256: string, pdfPath: string): Promise<void> {
  await query(CLEAR_STALE_FAILED_SQL, [emailAccountId, pdfSha256, []]);
  const referenced = await query('select 1 from statement where raw_pdf_path = $1 limit 1', [pdfPath]);
  if (!referenced.rowCount) await rm(pdfPath, { force: true });
}

export async function writePending(
  emailAccountId: number,
  bankAccountId: number,
  messageId: string,
  attachmentId: string,
  pdfSha256: string,
  rawPdfPath: string,
  text: string,
): Promise<boolean> {
  const truncated = text.length > 20_000;
  const errorDetail = {
    // ponytail: เก็บข้อความดิบทั้งก้อน (ตัดที่ 20,000 ตัวอักษร) ไว้ตรวจก่อนมี parser จริง
    // ต้องล้างทิ้งตอน Slice 3 — นี่คือประวัติธุรกรรมเต็ม ๆ อยู่ใน jsonb ที่ถูก backup
    slice2_text: truncated ? text.slice(0, 20_000) : text,
    truncated,
    chars: text.length,
    masked_candidates: findMaskedAccountCandidates(text),
  };
  return tx(async (client) => {
    const result = await client.query(
      `insert into statement (bank_account_id, gmail_message_id, gmail_attachment_id, pdf_sha256, period_start, period_end, raw_pdf_path, status, error_detail)
       values ($1, $2, $3, $4, null, null, $5, 'pending', $6)
       on conflict (bank_account_id, pdf_sha256) where pdf_sha256 is not null do update
         set gmail_message_id = excluded.gmail_message_id,
             gmail_attachment_id = excluded.gmail_attachment_id,
             raw_pdf_path = excluded.raw_pdf_path,
             status = 'pending',
             error_detail = excluded.error_detail
         where statement.status = 'parse_failed'
       returning id`,
      [bankAccountId, messageId, attachmentId, pdfSha256, rawPdfPath, JSON.stringify(errorDetail)],
    );
    if (result.rowCount !== 1) return false;
    await client.query(CLEAR_STALE_FAILED_SQL, [emailAccountId, pdfSha256, [bankAccountId]]);
    return true;
  });
}

export async function writeParsedStatement(
  emailAccountId: number,
  bankAccountId: number,
  messageId: string,
  attachmentId: string,
  pdfSha256: string,
  rawPdfPath: string,
  parsed: ParsedStatement,
): Promise<boolean> {
  return tx(async (client) => {
    const status = parsed.checksumValid ? 'parsed' : 'checksum_failed';
    const errorDetail = parsed.checksumValid ? null : JSON.stringify({ reason: 'checksum_failed' });
    const insertedStatement = await client.query<{ id: number }>(
      `insert into statement (
         bank_account_id, gmail_message_id, gmail_attachment_id, pdf_sha256, period_start, period_end,
         opening_balance_satang, closing_balance_satang, raw_pdf_path, status, error_detail
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (bank_account_id, pdf_sha256) where pdf_sha256 is not null do update set
         gmail_message_id = excluded.gmail_message_id,
         gmail_attachment_id = excluded.gmail_attachment_id,
         period_start = excluded.period_start,
         period_end = excluded.period_end,
         opening_balance_satang = excluded.opening_balance_satang,
         closing_balance_satang = excluded.closing_balance_satang,
         raw_pdf_path = excluded.raw_pdf_path,
         status = excluded.status,
         error_detail = excluded.error_detail
       where statement.status = 'parse_failed'
       returning id`,
      [
        bankAccountId,
        messageId,
        attachmentId,
        pdfSha256,
        parsed.periodStart,
        parsed.periodEnd,
        parsed.openingBalanceSatang,
        parsed.closingBalanceSatang,
        rawPdfPath,
        status,
        errorDetail,
      ],
    );
    const statementId = insertedStatement.rows[0]?.id;
    if (!statementId) return false;
    await client.query(CLEAR_STALE_FAILED_SQL, [emailAccountId, pdfSha256, [bankAccountId]]);
    if (!parsed.checksumValid) return true;

    let rowsInserted = 0;
    for (const transaction of parsed.transactions) {
      const result = await client.query(
        `insert into txn (
           statement_id, bank_account_id, txn_date, txn_time, description, channel,
           amount_satang, direction, running_balance_satang
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (bank_account_id, txn_date, amount_satang, running_balance_satang) do nothing`,
        [
          statementId,
          bankAccountId,
          transaction.txnDate,
          transaction.txnTime,
          transaction.description,
          transaction.channel,
          transaction.amountSatang,
          transaction.direction,
          transaction.runningBalanceSatang,
        ],
      );
      rowsInserted += result.rowCount ?? 0;
    }
    await client.query(
      'update statement set rows_inserted = $2, rows_deduped = $3 where id = $1',
      [statementId, rowsInserted, parsed.transactions.length - rowsInserted],
    );
    return true;
  });
}

async function processMessage(
  accessToken: string,
  messageId: string,
  emailAccountId: number,
  banks: Bank[],
): Promise<StatementStatus[]> {
  const message = await getMessage(accessToken, messageId);
  const payload: GmailPayload = message.payload;
  const headers = payload.headers ?? [];
  const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
  const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '';
  const senderAddr = fromAddress(from);

  const bank = banks.find((b) => b.sender_email.toLowerCase() === senderAddr);
  if (!bank) return [];

  if (!dkimPasses(headers, bank.sender_domain)) {
    console.warn(`[worker] DKIM ไม่ผ่าน mailbox=${emailAccountId} message=${messageId} bank=${bank.name}`);
    return [];
  }

  const subjectOk = new RegExp(bank.subject_monthly).test(subject) || new RegExp(bank.subject_ondemand).test(subject);
  if (!subjectOk) return [];

  const attachments = pickPdfAttachments(payload, bank.attachment_filename_pattern);
  if (!attachments.length) return [];

  const candidates = (
    await query<BankAccountCandidate>(
      // archived_at is not null = ผู้ใช้เก็บบัญชีเข้าคลังแล้ว หยุดรับ statement ใหม่ (ประวัติเดิมยังอยู่ครบ)
      'select id, bank_id, account_number, pdf_password_enc from bank_account where email_account_id = $1 and bank_id = $2 and archived_at is null',
      [emailAccountId, bank.id],
    )
  ).rows;

  if (!candidates.length) {
    console.warn(`[worker] ไม่มีบัญชีที่ผูกกับธนาคารนี้ mailbox=${emailAccountId} bank=${bank.name}`);
    return [];
  }

  const dir = join(env.pdfStorageDir, String(emailAccountId));
  await mkdir(dir, { recursive: true });
  const statuses: StatementStatus[] = [];

  for (let index = 0; index < attachments.length; index++) {
    const attachment = attachments[index]!;
    const pdfBuf = await getAttachment(accessToken, messageId, attachment.attachmentId);
    if (!hasPdfMagic(pdfBuf)) {
      console.warn(`[worker] attachment ไม่ใช่ PDF mailbox=${emailAccountId} message=${messageId} file=${attachment.filename}`);
      continue;
    }
    const pdfSha256 = createHash('sha256').update(pdfBuf).digest('hex');
    // Gmail attachmentId เปลี่ยนได้ระหว่าง messages.get; hash ของไฟล์ต้นฉบับคือ identity ที่คงที่
    const duplicate = await query<{ status: StatementStatus }>(
      `select s.status from statement s join bank_account a on a.id = s.bank_account_id
       where a.email_account_id = $1 and s.pdf_sha256 = $2 and s.status <> 'parse_failed'`,
      [emailAccountId, pdfSha256],
    );
    if (duplicate.rowCount) {
      // checksum_failed ไม่ถูกลองใหม่ แต่ยังเป็นไฟล์ที่พังอยู่ — นับให้ผู้ใช้เห็น ส่วนไฟล์ที่อ่านแล้วไม่นับซ้ำ
      if (duplicate.rows.some((r) => r.status === 'checksum_failed')) statuses.push('checksum_failed');
      continue;
    }
    const pdfPath = join(dir, `${messageId}_${index + 1}.pdf`);
    await writeFile(pdfPath, pdfBuf);

    // ไฟล์เดียวนับ failed ครั้งเดียว แม้เขียนแถวลงหลายบัญชี
    const failFile = async (accounts: BankAccountCandidate[], reason: string): Promise<void> => {
      const ids = accounts.map((a) => a.id);
      if (await writeParseFailed(emailAccountId, ids, messageId, attachment.attachmentId, pdfSha256, pdfPath, reason)) statuses.push('parse_failed');
    };

    let opened = false;
    for (const account of candidates) {
      const extracted = await extractText(pdfPath, decrypt(account.pdf_password_enc));
      if (!extracted.ok) {
        // รหัสไม่ตรงลองบัญชีถัดไป; เหตุอื่น (pdftotext_failed) แปลว่าเปิดได้แล้ว ลองต่อก็ไม่ช่วย
        // ลงบัญชีตามชื่อไฟล์เหมือนกรณี parse พัง — หลายบัญชีใช้รหัสเดียวกันได้ บัญชีที่รหัสเปิดได้จึงไม่ใช่เจ้าของเสมอไป
        if (extracted.reason === 'decrypt_failed') continue;
        opened = true;
        await failFile(failedAccountTargets(candidates, attachment.filename), extracted.reason);
        break;
      }
      opened = true;

      const parseFn = parsers[bank.parser_key as keyof typeof parsers];
      let parsed: ParsedStatement | null = null;
      if (parseFn) {
        try {
          parsed = parseFn(extracted.text);
        } catch (error) {
          await failFile(failedAccountTargets(candidates, attachment.filename), error instanceof Error ? error.message : 'parse_failed');
          break;
        }
      }
      // ยังไม่มี parser ของธนาคารนี้: กล่องที่มีบัญชีเดียวถือเป็นบัญชีนั้น ไม่งั้นหาจากโทเค็นเลขที่ถูกปิดบังในข้อความ
      const owners = parsed
        ? matchAccounts(candidates, [parsed.accountNumber])
        : candidates.length === 1 ? [account] : matchAccounts(candidates, findMaskedAccountCandidates(extracted.text));
      if (owners.length > 1) {
        await failFile(owners, 'account_ambiguous');
      } else if (!owners.length) {
        // statement ของบัญชีที่ผู้ใช้ไม่ได้เพิ่มไว้ก็มาเข้ากล่องนี้ได้ — ถ้าบันทึกจะเป็นแถวพังค้างถาวรใต้บัญชีที่ไม่ใช่เจ้าของ
        console.warn(`[worker] เลขบัญชีใน statement ไม่ตรงบัญชีใดในกล่อง ข้ามไฟล์ mailbox=${emailAccountId} message=${messageId}`);
        await skipStatementFile(emailAccountId, pdfSha256, pdfPath);
      } else if (parsed) {
        if (await writeParsedStatement(emailAccountId, owners[0]!.id, messageId, attachment.attachmentId, pdfSha256, pdfPath, parsed)) statuses.push(parsed.checksumValid ? 'parsed' : 'checksum_failed');
      } else if (await writePending(emailAccountId, owners[0]!.id, messageId, attachment.attachmentId, pdfSha256, pdfPath, extracted.text)) {
        statuses.push('pending');
      }
      break;
    }
    // รหัสของทุกบัญชีเปิดไม่ได้ — reason เดียวกับกรณีบัญชีเดียวรหัสผิด แดชบอร์ดใช้ค่านี้โชว์ปุ่ม "ตั้งรหัสผ่าน PDF ใหม่"
    if (!opened) await failFile(failedAccountTargets(candidates, attachment.filename), 'decrypt_failed');
  }
  return statuses;
}

export function startWorker(): void {
  const HOUR = 60 * 60 * 1000;

  const tick = async (): Promise<void> => {
    const { rows } = await query<{ id: number }>('select id from email_account where reauth_required_at is null');
    for (const { id } of rows) {
      try {
        const summary = await syncEmailAccount(id);
        if (summary.messages_scanned) {
          console.log(
            `[worker] mailbox=${id} scanned=${summary.messages_scanned} inserted=${summary.statements_inserted} failed=${summary.statements_failed} skipped=${summary.skipped}`,
          );
        }
      } catch (e) {
        // แยก try/catch ต่อกล่อง: refresh token ที่ถูก revoke พังทุกครั้งไปตลอด ไม่ให้กล่องเดียวหยุดกล่องอื่น
        console.error(`[worker] mailbox=${id} sync ล้มเหลว:`, e);
      }
    }
  };

  // ต้องมี .catch() เสมอ — Node 22 default unhandled-rejections=throw ปล่อยพลาดคือทั้งโปรเซสตาย
  tick().catch((e) => console.error('[worker] tick แรกล้มเหลว:', e));
  setInterval(() => {
    tick().catch((e) => console.error('[worker] tick ล้มเหลว:', e));
  }, HOUR);
}
