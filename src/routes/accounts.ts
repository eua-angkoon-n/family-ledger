import { Router } from 'express';
import type pg from 'pg';
import { requireUser } from '../auth.js';
import { encrypt } from '../crypto.js';
import { query, tx } from '../db.js';
import { HttpError, id, optionalStr, str, type Body } from '../http.js';
import { assertOwnsTaxEntity } from './tax-entities.js';
import { syncEmailAccount } from '../worker.js';
import { audit } from '../services/audit.js';

export const accountsRouter = Router();

// ห้าม select pdf_password_enc ออกไปแม้แต่เข้า audit_log — GET /api/audit-log คืน before_data/after_data
// ดิบให้เจ้าของอ่านได้ตรง ๆ ถ้าใส่ ciphertext ของรหัสผ่าน PDF เข้าไปจะรั่วไปอีกทางที่ไม่มีใครกันไว้
// (บั๊กจริงที่เจอใน Slice 8 ตอน archive ใช้ `select *`) ทุก audit ของตารางนี้ต้องผ่านคอลัมน์ชุดนี้เท่านั้น
const ACCOUNT_AUDIT_COLUMNS = 'id, nickname, account_number, bank_id, email_account_id, promptpay_id, default_tax_entity_id, archived_at';

const digitsOnly = (v: string) => v.replace(/\D/g, '');

// เก็บเป็นตัวเลขล้วน — unique index เทียบสตริงดิบ ถ้าเก็บตามที่พิมพ์ `123-4-56789-0` กับ `1234567890` จะเป็นบัญชีซ้ำกันได้
// แล้ว worker (เทียบเฉพาะตัวเลข) เห็นสองบัญชีตรง statement เดียว
function accountNumber(b: Body): string {
  const v = b.account_number;
  const digits = typeof v === 'string' && /^[\d\s-]*$/.test(v) ? digitsOnly(v) : '';
  if (!digits) throw new HttpError(400, 'เลขที่บัญชีต้องเป็นตัวเลข');
  if (digits.length > 40) throw new HttpError(400, 'เลขที่บัญชียาวเกิน 40 หลัก');
  return digits;
}

// ไม่ trim — ช่องว่างหัวท้ายอาจเป็นส่วนของรหัส แต่ช่องว่างล้วน = ไม่ได้กรอก (null)
function pdfPassword(b: Body): string | null {
  const v = b.pdf_password;
  if (typeof v !== 'string' || v.trim() === '') return null;
  if (v.length > 200) throw new HttpError(400, 'รหัสผ่านเปิดไฟล์ statement ยาวเกิน 200 ตัวอักษร');
  return v;
}

// เทียบเฉพาะตัวเลขทั้งสองฝั่ง — บัญชีเดิมที่เก็บแบบมีขีด (ก่อน normalize) unique index ไม่จับ
// ponytail: สองคำขอพร้อมกันหลุดเช็คนี้ได้ แต่ index ยังกันไว้ (409 ข้อความกลางใน server.ts)
async function assertAccountNumberFree(c: pg.PoolClient, userId: number, bankId: number, digits: string, exceptId = 0): Promise<void> {
  const { rowCount } = await c.query(
    `select 1 from bank_account where user_id = $1 and bank_id = $2 and archived_at is null
       and regexp_replace(account_number, '[^0-9]', '', 'g') = $3 and id <> $4`,
    [userId, bankId, digits, exceptId],
  );
  if (rowCount) throw new HttpError(409, 'มีบัญชีเลขนี้อยู่แล้ว');
}

accountsRouter.get('/accounts', requireUser(async (_req, res, user) => {
  // ห้าม select pdf_password_enc ออกไปทาง API เด็ดขาด
  const { rows } = await query(
    `select a.id, a.nickname, a.account_number, a.promptpay_id, a.created_at, a.default_tax_entity_id,
            b.id as bank_id, b.name as bank_name, e.id as email_account_id, e.email
     from bank_account a
     join bank b on b.id = a.bank_id
     join email_account e on e.id = a.email_account_id
     where a.user_id = $1 and a.archived_at is null order by a.nickname`,
    [user.id],
  );
  res.json(rows);
}));

accountsRouter.post('/accounts', requireUser(async (req, res, user) => {
  const b = req.body as Body;
  const emailAccountId = id(b, 'email_account_id');
  const owns = await query('select 1 from email_account where id = $1 and user_id = $2', [emailAccountId, user.id]);
  if (!owns.rowCount) throw new HttpError(403, 'กล่องอีเมลนี้ไม่ใช่ของคุณ');
  const defaultTaxEntityId = b.default_tax_entity_id == null ? null : id(b, 'default_tax_entity_id');
  if (defaultTaxEntityId != null) await assertOwnsTaxEntity(user.id, defaultTaxEntityId);
  const bankId = id(b, 'bank_id');
  const number = accountNumber(b);
  const password = pdfPassword(b);
  if (password == null) throw new HttpError(400, 'กรอกรหัสผ่านเปิดไฟล์ statement');

  // insert + audit อยู่ใน tx เดียวกัน ตามกฎของ audit(): แถวข้อมูลกับแถว audit ต้อง commit/rollback พร้อมกัน
  const created = await tx(async (c) => {
    await assertAccountNumberFree(c, user.id, bankId, number);
    const { rows } = await c.query<{ id: number }>(
      `insert into bank_account (user_id, bank_id, email_account_id, nickname, account_number, pdf_password_enc, promptpay_id, default_tax_entity_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning ${ACCOUNT_AUDIT_COLUMNS}`,
      [
        user.id,
        bankId,
        emailAccountId,
        str(b, 'nickname', 60),
        number,
        encrypt(password),
        optionalStr(b, 'promptpay_id', 40),
        defaultTaxEntityId,
      ],
    );
    await audit(c, { userId: user.id, action: 'bank_account.create', entityType: 'bank_account', entityId: rows[0]!.id, after: rows[0], ip: req.ip ?? null });
    return rows[0]!;
  });
  // backfill เต็มกล่องแบบ fire-and-forget — ผู้ใช้ไม่ต้องรอ ต้องมี .catch() เสมอไม่งั้นโปรเซสตาย (unhandled rejection)
  syncEmailAccount(emailAccountId, { full: true }).catch((e) =>
    console.error(`[worker] backfill mailbox=${emailAccountId} ล้มเหลว:`, e),
  );
  res.status(201).json({ id: created.id, email_account_id: emailAccountId, resync: true });
}));

accountsRouter.patch('/accounts/:id', requireUser(async (req, res, user) => {
  const b = req.body as Body;
  const emailAccountId = b.email_account_id == null ? null : id(b, 'email_account_id');
  if (emailAccountId !== null) {
    const owns = await query('select 1 from email_account where id = $1 and user_id = $2', [emailAccountId, user.id]);
    if (!owns.rowCount) throw new HttpError(403, 'กล่องอีเมลนี้ไม่ใช่ของคุณ');
  }
  const hasPromptpay = Object.prototype.hasOwnProperty.call(b, 'promptpay_id');
  const hasDefaultTaxEntity = Object.prototype.hasOwnProperty.call(b, 'default_tax_entity_id');
  const defaultTaxEntityId = hasDefaultTaxEntity && b.default_tax_entity_id != null ? id(b, 'default_tax_entity_id') : null;
  if (hasDefaultTaxEntity && defaultTaxEntityId != null) await assertOwnsTaxEntity(user.id, defaultTaxEntityId);
  const accountId = Number(req.params.id);
  const bankId = b.bank_id == null ? null : id(b, 'bank_id');
  const number = b.account_number == null ? null : accountNumber(b);
  const password = pdfPassword(b);
  const pdfPasswordChanged = password != null;
  const { updated, resync } = await tx(async (c) => {
    type Row = { id: number; bank_id: number; account_number: string; email_account_id: number };
    const before = (await c.query<Row>(`select ${ACCOUNT_AUDIT_COLUMNS} from bank_account where id = $1 and user_id = $2`, [accountId, user.id])).rows[0];
    if (!before) throw new HttpError(404, 'ไม่พบบัญชี');
    // เช็คเฉพาะตอนค่าที่เก็บจะเปลี่ยน (รวมเลขเดิมแบบมีขีดที่กำลังถูกเก็บเป็นตัวเลขล้วน) — ฟอร์มส่งทุกฟิลด์ทุกครั้ง
    // ไม่งั้นบัญชีที่ไม่ได้แก้เลขจะแก้ชื่อเล่นไม่ได้เพราะมีคู่ซ้ำแบบมีขีดค้างจากก่อน normalize
    const nextBank = bankId ?? before.bank_id;
    const nextNumber = number ?? before.account_number;
    if (nextBank !== before.bank_id || nextNumber !== before.account_number) {
      await assertAccountNumberFree(c, user.id, nextBank, digitsOnly(nextNumber), accountId);
    }
    const { rows } = await c.query<Row>(
      `update bank_account set
         bank_id = coalesce($3, bank_id),
         email_account_id = coalesce($4, email_account_id),
         nickname = coalesce($5, nickname),
         account_number = coalesce($6, account_number),
         promptpay_id = case when $7 then $8 else promptpay_id end,
         pdf_password_enc = coalesce($9, pdf_password_enc),
         default_tax_entity_id = case when $10 then $11 else default_tax_entity_id end
       where id = $1 and user_id = $2 and archived_at is null returning ${ACCOUNT_AUDIT_COLUMNS}`,
      [
        accountId,
        user.id,
        bankId,
        emailAccountId,
        b.nickname == null ? null : str(b, 'nickname', 60),
        number,
        hasPromptpay,
        hasPromptpay ? optionalStr(b, 'promptpay_id', 40) : null,
        password == null ? null : encrypt(password),
        hasDefaultTaxEntity,
        defaultTaxEntityId,
      ],
    );
    const after = rows[0];
    if (!after) throw new HttpError(404, 'ไม่พบบัญชี');
    // รหัสผ่าน PDF เปลี่ยนหรือไม่เก็บเป็น boolean ไม่ใช่ค่า — ต้องตรวจสอบได้ว่ามีคนเปลี่ยนแต่ห้ามเห็นค่า
    await audit(c, {
      userId: user.id,
      action: 'bank_account.update',
      entityType: 'bank_account',
      entityId: accountId,
      before,
      after: { ...after, pdf_password_changed: pdfPasswordChanged },
      ip: req.ip ?? null,
    });
    // อ่านใหม่ทั้งกล่องเฉพาะฟิลด์ที่ worker ใช้จับคู่/ถอดรหัส statement — แก้ชื่อเล่น/พร้อมเพย์ไม่ต้องอ่านเมลซ้ำ
    const resync = pdfPasswordChanged
      || before.bank_id !== after.bank_id
      || digitsOnly(before.account_number) !== digitsOnly(after.account_number)
      || before.email_account_id !== after.email_account_id;
    return { updated: after, resync };
  });
  if (resync) {
    syncEmailAccount(updated.email_account_id, { full: true }).catch((e) =>
      console.error(`[worker] reprocess account=${updated.id} ล้มเหลว:`, e),
    );
  }
  res.json({ id: updated.id, email_account_id: updated.email_account_id, resync });
}));

accountsRouter.delete('/accounts/:id', requireUser(async (req, res, user) => {
  // เก็บเข้าคลัง (archive) แทนลบจริง — statement/txn ผูก on delete cascade กับ bank_account
  // ลบแถวจริงจะพาประวัติ statement/txn ทั้งชุดหายไปด้วย
  const accountId = Number(req.params.id);
  await tx(async (c) => {
    const before = (await c.query(`select ${ACCOUNT_AUDIT_COLUMNS} from bank_account where id = $1 and user_id = $2`, [accountId, user.id])).rows[0];
    if (!before) throw new HttpError(404, 'ไม่พบบัญชี');
    const { rows } = await c.query(
      `update bank_account set archived_at = now() where id = $1 and user_id = $2 and archived_at is null returning ${ACCOUNT_AUDIT_COLUMNS}`,
      [accountId, user.id],
    );
    if (!rows[0]) throw new HttpError(404, 'ไม่พบบัญชี');
    await audit(c, { userId: user.id, action: 'bank_account.archive', entityType: 'bank_account', entityId: accountId, before, after: rows[0], ip: req.ip ?? null });
  });
  res.status(204).end();
}));
