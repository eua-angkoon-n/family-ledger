import { Router } from 'express';
import { loadUser, requireAdmin, requireUser, revokeAtGoogle } from './auth.js';
import { encrypt, decrypt } from './crypto.js';
import { query } from './db.js';
import { syncEmailAccount } from './worker.js';

/** parser ที่มีโค้ดจริงแล้ว — แอดมินเลือกได้เฉพาะในนี้ ไม่ให้พิมพ์เอง */
export const PARSER_KEYS = ['kbank', 'scb'] as const;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Body = Record<string, unknown>;

function str(body: Body, field: string, max = 200): string {
  const v = body[field];
  if (typeof v !== 'string' || v.trim() === '') throw new HttpError(400, `ต้องกรอก ${field}`);
  if (v.length > max) throw new HttpError(400, `${field} ยาวเกิน ${max} ตัวอักษร`);
  return v.trim();
}

function optionalStr(body: Body, field: string, max = 200): string | null {
  const v = body[field];
  if (v == null || v === '') return null;
  return str(body, field, max);
}

function regex(body: Body, field: string): string {
  const v = str(body, field, 500);
  try {
    new RegExp(v);
  } catch {
    throw new HttpError(400, `${field} ไม่ใช่ regex ที่ใช้ได้`);
  }
  return v;
}

function id(body: Body, field: string): number {
  const n = Number(body[field]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `ต้องเลือก ${field}`);
  return n;
}

export const api = Router();

api.get('/me', async (req, res, next) => {
  try {
    res.json({
      user: await loadUser(req),
      signupInviteRequired: req.session.pendingSignup != null,
    });
  } catch (e) {
    next(e);
  }
});

// ---------- แอดมิน: ธนาคาร ----------

api.get('/banks', requireUser(async (_req, res) => {
  const { rows } = await query('select * from bank order by name');
  res.json(rows);
}));

api.post('/banks', requireAdmin(async (req, res) => {
  const b = req.body as Body;
  const parserKey = str(b, 'parser_key');
  if (!(PARSER_KEYS as readonly string[]).includes(parserKey)) {
    throw new HttpError(400, `parser_key ต้องเป็นหนึ่งใน ${PARSER_KEYS.join(', ')}`);
  }
  const { rows } = await query(
    `insert into bank (name, sender_email, sender_domain, subject_monthly, subject_ondemand,
                       attachment_filename_pattern, parser_key, is_active)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [
      str(b, 'name'),
      str(b, 'sender_email').toLowerCase(),
      str(b, 'sender_domain').toLowerCase(),
      regex(b, 'subject_monthly'),
      regex(b, 'subject_ondemand'),
      regex(b, 'attachment_filename_pattern'),
      parserKey,
      b.is_active !== false,
    ],
  );
  res.status(201).json(rows[0]);
}));

api.patch('/banks/:id', requireAdmin(async (req, res) => {
  const b = req.body as Body;
  const { rows } = await query(
    `update bank set
       name = coalesce($2, name),
       sender_email = coalesce($3, sender_email),
       sender_domain = coalesce($4, sender_domain),
       subject_monthly = coalesce($5, subject_monthly),
       subject_ondemand = coalesce($6, subject_ondemand),
       attachment_filename_pattern = coalesce($7, attachment_filename_pattern),
       is_active = coalesce($8, is_active)
     where id = $1 returning *`,
    [
      Number(req.params.id),
      optionalStr(b, 'name'),
      optionalStr(b, 'sender_email')?.toLowerCase() ?? null,
      optionalStr(b, 'sender_domain')?.toLowerCase() ?? null,
      b.subject_monthly == null ? null : regex(b, 'subject_monthly'),
      b.subject_ondemand == null ? null : regex(b, 'subject_ondemand'),
      b.attachment_filename_pattern == null ? null : regex(b, 'attachment_filename_pattern'),
      typeof b.is_active === 'boolean' ? b.is_active : null,
    ],
  );
  if (!rows[0]) throw new HttpError(404, 'ไม่พบธนาคาร');
  res.json(rows[0]);
}));

// ลบไม่ได้ถ้ามีบัญชีผูกอยู่ — FK จะโยน error ออกมาเอง แล้ว handler แปลงเป็น 409
api.delete('/banks/:id', requireAdmin(async (req, res) => {
  await query('delete from bank where id = $1', [Number(req.params.id)]);
  res.status(204).end();
}));

// ---------- แอดมิน: อนุมัติผู้ใช้ ----------

api.get('/admin/users', requireAdmin(async (_req, res) => {
  const { rows } = await query(
    'select id, email, display_name, is_admin, status, created_at from app_user order by created_at',
  );
  res.json(rows);
}));

api.patch('/admin/users/:id', requireAdmin(async (req, res, admin) => {
  const status = String((req.body as Body).status);
  if (!['pending', 'approved', 'rejected'].includes(status)) throw new HttpError(400, 'status ไม่ถูกต้อง');
  const targetId = Number(req.params.id);
  if (targetId === admin.id) throw new HttpError(400, 'เปลี่ยนสถานะตัวเองไม่ได้');

  if (status === 'rejected') {
    // ยกเลิกสิทธิ์ที่ Google ก่อน แล้วค่อยลบของเรา — ลบก่อนแปลว่า token ยังใช้ได้แต่เราตามไปถอนไม่ได้แล้ว
    const { rows } = await query<{ id: number; refresh_token_enc: string }>(
      'select id, refresh_token_enc from email_account where user_id = $1',
      [targetId],
    );
    for (const r of rows) {
      await revokeAtGoogle(decrypt(r.refresh_token_enc));
      await query('delete from email_account where id = $1', [r.id]);
    }
  }
  const { rows } = await query('update app_user set status = $2 where id = $1 returning id, email, status', [
    targetId,
    status,
  ]);
  if (!rows[0]) throw new HttpError(404, 'ไม่พบผู้ใช้');
  res.json(rows[0]);
}));

// ---------- ผู้ใช้: กล่องอีเมล + บัญชีธนาคาร ----------

api.get('/email-accounts', requireUser(async (_req, res, user) => {
  const { rows } = await query('select id, email, last_synced_at from email_account where user_id = $1', [user.id]);
  res.json(rows);
}));

// ยิงมือ — await แล้วตอบสรุปกลับ ไม่ใช่ 202 เพราะตัวเลขนี้คือของที่ต้องใช้ตรวจ Slice 2 ตอนเมลจริงมาถึง
api.post('/email-accounts/:id/sync', requireUser(async (req, res, user) => {
  const emailAccountId = Number(req.params.id);
  const owns = await query('select 1 from email_account where id = $1 and user_id = $2', [emailAccountId, user.id]);
  if (!owns.rowCount) throw new HttpError(403, 'กล่องอีเมลนี้ไม่ใช่ของคุณ');
  const full = (req.body as Body).full === true;
  const summary = await syncEmailAccount(emailAccountId, { full });
  res.json(summary);
}));

api.get('/accounts', requireUser(async (_req, res, user) => {
  // ห้าม select pdf_password_enc ออกไปทาง API เด็ดขาด
  const { rows } = await query(
    `select a.id, a.nickname, a.account_number, a.promptpay_id, a.created_at,
            b.id as bank_id, b.name as bank_name, e.id as email_account_id, e.email
     from bank_account a
     join bank b on b.id = a.bank_id
     join email_account e on e.id = a.email_account_id
     where a.user_id = $1 order by a.nickname`,
    [user.id],
  );
  res.json(rows);
}));

api.post('/accounts', requireUser(async (req, res, user) => {
  const b = req.body as Body;
  const emailAccountId = id(b, 'email_account_id');
  const owns = await query('select 1 from email_account where id = $1 and user_id = $2', [emailAccountId, user.id]);
  if (!owns.rowCount) throw new HttpError(403, 'กล่องอีเมลนี้ไม่ใช่ของคุณ');

  const { rows } = await query<{ id: number }>(
    `insert into bank_account (user_id, bank_id, email_account_id, nickname, account_number, pdf_password_enc, promptpay_id)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      user.id,
      id(b, 'bank_id'),
      emailAccountId,
      str(b, 'nickname', 60),
      str(b, 'account_number', 40),
      encrypt(str(b, 'pdf_password', 200)),
      optionalStr(b, 'promptpay_id', 40),
    ],
  );
  // backfill เต็มกล่องแบบ fire-and-forget — ผู้ใช้ไม่ต้องรอ ต้องมี .catch() เสมอไม่งั้นโปรเซสตาย (unhandled rejection)
  syncEmailAccount(emailAccountId, { full: true }).catch((e) =>
    console.error(`[worker] backfill mailbox=${emailAccountId} ล้มเหลว:`, e),
  );
  res.status(201).json({ id: rows[0]!.id });
}));

api.patch('/accounts/:id', requireUser(async (req, res, user) => {
  const b = req.body as Body;
  const { rows } = await query(
    `update bank_account set
       nickname = coalesce($3, nickname),
       promptpay_id = coalesce($4, promptpay_id),
       pdf_password_enc = coalesce($5, pdf_password_enc)
     where id = $1 and user_id = $2 returning id`,
    [
      Number(req.params.id),
      user.id,
      optionalStr(b, 'nickname', 60),
      optionalStr(b, 'promptpay_id', 40),
      b.pdf_password == null || b.pdf_password === '' ? null : encrypt(str(b, 'pdf_password', 200)),
    ],
  );
  if (!rows[0]) throw new HttpError(404, 'ไม่พบบัญชี');
  res.json(rows[0]);
}));

api.delete('/accounts/:id', requireUser(async (req, res, user) => {
  await query('delete from bank_account where id = $1 and user_id = $2', [Number(req.params.id), user.id]);
  res.status(204).end();
}));
