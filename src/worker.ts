import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findMaskedAccountCandidates, resolveAccount } from './account-match.js';
import { decrypt } from './crypto.js';
import { query } from './db.js';
import { env } from './env.js';
import {
  GmailHistoryStaleError,
  dkimPasses,
  fromAddress,
  getAttachment,
  getMessage,
  getProfile,
  listHistory,
  listMessagesFromSender,
  pickPdfAttachment,
  refreshAccessToken,
  type GmailPayload,
} from './gmail.js';

type Bank = {
  id: number;
  name: string;
  sender_email: string;
  sender_domain: string;
  subject_monthly: string;
  subject_ondemand: string;
  attachment_filename_pattern: string;
};

type BankAccountCandidate = { id: number; bank_id: number; account_number: string; pdf_password_enc: string };

export type SyncSummary = { messages_scanned: number; statements_inserted: number; skipped: number };

// ponytail: กัน sync ซ้อนต่อกล่องอีเมลเดียวด้วย memory Set พอสำหรับ instance เดียว
// ถ้าสเกลหลาย instance ค่อยย้ายไป pg_advisory_lock ต่อ email_account_id
const running = new Set<number>();

export async function syncEmailAccount(emailAccountId: number, opts: { full?: boolean } = {}): Promise<SyncSummary> {
  const empty = { messages_scanned: 0, statements_inserted: 0, skipped: 0 };
  if (running.has(emailAccountId)) return empty;
  running.add(emailAccountId);
  try {
    return await doSync(emailAccountId, opts.full === true);
  } finally {
    running.delete(emailAccountId);
  }
}

async function fullSync(accessToken: string, banks: Bank[]): Promise<{ messageIds: string[]; historyId: string }> {
  // historyId ต้องอ่านก่อน list เสมอ ไม่งั้นเมลที่เข้ามาระหว่าง sync หายถาวร
  const profile = await getProfile(accessToken);
  const ids = new Set<string>();
  for (const bank of banks) {
    for (const id of await listMessagesFromSender(accessToken, bank.sender_email)) ids.add(id);
  }
  return { messageIds: [...ids], historyId: profile.historyId };
}

async function doSync(emailAccountId: number, requestFull: boolean): Promise<SyncSummary> {
  const summary: SyncSummary = { messages_scanned: 0, statements_inserted: 0, skipped: 0 };

  const { rows } = await query<{ id: number; refresh_token_enc: string; history_id: string | null }>(
    'select id, refresh_token_enc, history_id from email_account where id = $1',
    [emailAccountId],
  );
  const account = rows[0];
  if (!account) return summary;

  const banks = (await query<Bank>('select * from bank where is_active = true')).rows;
  if (!banks.length) return summary;

  const accessToken = await refreshAccessToken(decrypt(account.refresh_token_enc));

  let sync: { messageIds: string[]; historyId: string };
  if (requestFull || !account.history_id) {
    sync = await fullSync(accessToken, banks);
  } else {
    try {
      sync = await listHistory(accessToken, account.history_id);
    } catch (e) {
      if (e instanceof GmailHistoryStaleError) sync = await fullSync(accessToken, banks);
      else throw e;
    }
  }

  // ความล้มเหลวต่อ 1 ข้อความถูกกันไว้ในนี้ ไม่ให้ข้อความเดียวที่พังทำให้ทั้งกล่องไม่ขยับ cursor
  for (const messageId of sync.messageIds) {
    summary.messages_scanned++;
    try {
      const inserted = await processMessage(accessToken, messageId, emailAccountId, banks);
      if (inserted) summary.statements_inserted++;
      else summary.skipped++;
    } catch (e) {
      console.error(`[worker] mailbox=${emailAccountId} message=${messageId} ล้มเหลว:`, e);
      summary.skipped++;
    }
  }

  // สำเร็จทั้งรอบ (list ได้ครบ) ถึงขยับ cursor — ถ้า list เองล้มเหลว (throw ก่อนถึงตรงนี้) cursor จะไม่ขยับ
  await query('update email_account set history_id = $2, last_synced_at = now() where id = $1', [
    emailAccountId,
    sync.historyId,
  ]);
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

async function writeParseFailed(
  bankAccountId: number,
  messageId: string,
  attachmentId: string,
  rawPdfPath: string,
  reason: string,
): Promise<void> {
  await query(
    `insert into statement (bank_account_id, gmail_message_id, gmail_attachment_id, period_start, period_end, raw_pdf_path, status, error_detail)
     values ($1, $2, $3, null, null, $4, 'parse_failed', $5)
     on conflict do nothing`,
    [bankAccountId, messageId, attachmentId, rawPdfPath, JSON.stringify({ reason })],
  );
}

async function writePending(
  bankAccountId: number,
  messageId: string,
  attachmentId: string,
  rawPdfPath: string,
  text: string,
): Promise<void> {
  const truncated = text.length > 20_000;
  const errorDetail = {
    // ponytail: เก็บข้อความดิบทั้งก้อน (ตัดที่ 20,000 ตัวอักษร) ไว้ตรวจก่อนมี parser จริง
    // ต้องล้างทิ้งตอน Slice 3 — นี่คือประวัติธุรกรรมเต็ม ๆ อยู่ใน jsonb ที่ถูก backup
    slice2_text: truncated ? text.slice(0, 20_000) : text,
    truncated,
    chars: text.length,
    masked_candidates: findMaskedAccountCandidates(text),
  };
  await query(
    `insert into statement (bank_account_id, gmail_message_id, gmail_attachment_id, period_start, period_end, raw_pdf_path, status, error_detail)
     values ($1, $2, $3, null, null, $4, 'pending', $5)
     on conflict do nothing`,
    [bankAccountId, messageId, attachmentId, rawPdfPath, JSON.stringify(errorDetail)],
  );
}

async function processMessage(
  accessToken: string,
  messageId: string,
  emailAccountId: number,
  banks: Bank[],
): Promise<boolean> {
  // status <> 'parse_failed' คือจงใจ: ถ้าครั้งก่อนถอดรหัสไม่ผ่าน (เช่น ตอนนั้นมีบัญชีเดียวที่ลงทะเบียน
  // แต่จริง ๆ อีเมลนี้เป็นของอีกบัญชี หรือผู้ใช้เพิ่งแก้รหัสผ่านที่ผิด) ต้องให้ sync รอบถัดไปลองใหม่ได้
  // ไม่งั้นแถว parse_failed ที่ผูกกับบัญชีผิดจะบล็อกไม่ให้อีเมลนี้ถูกนำเข้าใหม่อีกเลยตลอดไป
  const dup = await query(
    `select 1 from statement s join bank_account a on a.id = s.bank_account_id
     where a.email_account_id = $1 and s.gmail_message_id = $2 and s.status <> 'parse_failed'`,
    [emailAccountId, messageId],
  );
  if (dup.rowCount) return false;

  const message = await getMessage(accessToken, messageId);
  const payload: GmailPayload = message.payload;
  const headers = payload.headers ?? [];
  const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
  const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '';
  const senderAddr = fromAddress(from);

  const bank = banks.find((b) => b.sender_email.toLowerCase() === senderAddr);
  if (!bank) return false;

  if (!dkimPasses(headers, bank.sender_domain)) {
    console.warn(`[worker] DKIM ไม่ผ่าน mailbox=${emailAccountId} message=${messageId} bank=${bank.name}`);
    return false;
  }

  const subjectOk = new RegExp(bank.subject_monthly).test(subject) || new RegExp(bank.subject_ondemand).test(subject);
  if (!subjectOk) return false;

  const attachment = pickPdfAttachment(payload, bank.attachment_filename_pattern);
  if (!attachment) return false;

  const pdfBuf = await getAttachment(accessToken, messageId, attachment.attachmentId);
  const dir = join(env.pdfStorageDir, String(emailAccountId));
  await mkdir(dir, { recursive: true });
  const pdfPath = join(dir, `${messageId}.pdf`);
  await writeFile(pdfPath, pdfBuf);

  const candidates = (
    await query<BankAccountCandidate>(
      'select id, bank_id, account_number, pdf_password_enc from bank_account where email_account_id = $1 and bank_id = $2',
      [emailAccountId, bank.id],
    )
  ).rows;

  if (!candidates.length) {
    console.warn(`[worker] ไม่มีบัญชีที่ผูกกับธนาคารนี้ mailbox=${emailAccountId} bank=${bank.name}`);
    return false;
  }

  if (candidates.length === 1) {
    const account = candidates[0]!;
    const extracted = await extractText(pdfPath, decrypt(account.pdf_password_enc));
    if (extracted.ok) {
      await writePending(account.id, messageId, attachment.attachmentId, pdfPath, extracted.text);
    } else {
      await writeParseFailed(account.id, messageId, attachment.attachmentId, pdfPath, extracted.reason);
    }
    return true;
  }

  // หลายบัญชีผูกกล่องเดียวกันกับธนาคารเดียวกัน: ลองรหัสของแต่ละใบ แล้วยืนยันด้วยเลขบัญชีในเนื้อความ
  for (const account of candidates) {
    const extracted = await extractText(pdfPath, decrypt(account.pdf_password_enc));
    if (!extracted.ok) continue;

    const resolved = findMaskedAccountCandidates(extracted.text)
      .map((token) => resolveAccount(candidates, token))
      .find((r): r is BankAccountCandidate => r != null);

    if (resolved) {
      await writePending(resolved.id, messageId, attachment.attachmentId, pdfPath, extracted.text);
      return true;
    }
    console.warn(
      `[worker] ถอดรหัสผ่านด้วยรหัสของบัญชี ${account.id} แต่แยกไม่ออกว่าเป็นบัญชีไหน mailbox=${emailAccountId} message=${messageId} — ไม่เขียนแถว`,
    );
    return false;
  }

  console.warn(`[worker] ถอดรหัสไม่ผ่านด้วยรหัสของบัญชีใดเลย mailbox=${emailAccountId} message=${messageId}`);
  return false;
}

export function startWorker(): void {
  const HOUR = 60 * 60 * 1000;

  const tick = async (): Promise<void> => {
    const { rows } = await query<{ id: number }>('select id from email_account');
    for (const { id } of rows) {
      try {
        const summary = await syncEmailAccount(id);
        if (summary.messages_scanned) {
          console.log(
            `[worker] mailbox=${id} scanned=${summary.messages_scanned} inserted=${summary.statements_inserted} skipped=${summary.skipped}`,
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
