import { Router } from 'express';
import { requireAdmin, requireUser } from '../auth.js';
import { query, tx } from '../db.js';
import { HttpError, optionalStr, regex, str, type Body } from '../http.js';
import { PARSER_KEYS } from '../parsers/index.js';
import { audit } from '../services/audit.js';
import { syncEmailAccount } from '../worker.js';

export const banksRouter = Router();

banksRouter.get('/banks', requireUser(async (_req, res) => {
  const { rows } = await query('select * from bank order by name');
  res.json(rows);
}));

// account_count นับทุกแถวรวมที่เก็บเข้าคลัง — FK bank_account.bank_id กันลบธนาคารด้วยแถวพวกนั้นเหมือนกัน
banksRouter.get('/admin/banks', requireAdmin(async (_req, res) => {
  const { rows } = await query(
    `select b.*, (select count(*)::int from bank_account a where a.bank_id = b.id) as account_count
     from bank b order by b.name`,
  );
  res.json(rows);
}));

// ฟิลด์ที่ worker ใช้ค้นเมล/จับคู่/อ่าน statement — เปลี่ยนแล้วต้องอ่านเมลใหม่ทั้งกล่อง (ชื่อธนาคารไม่เกี่ยว)
const MATCH_FIELDS = [
  'sender_email', 'sender_domain', 'subject_monthly', 'subject_ondemand', 'attachment_filename_pattern', 'parser_key',
] as const;

// ตาราง bank ไม่มีคอลัมน์ความลับ (ชื่อ/อีเมลผู้ส่ง/pattern/parser_key) — `returning *` เข้า audit ได้ตรง ๆ
// ต่างจาก bank_account/email_account/tax_entity ที่ต้องเลือกคอลัมน์เอง
banksRouter.post('/banks', requireAdmin(async (req, res, admin) => {
  const b = req.body as Body;
  const parserKey = str(b, 'parser_key');
  if (!(PARSER_KEYS as readonly string[]).includes(parserKey)) {
    throw new HttpError(400, `parser_key ต้องเป็นหนึ่งใน ${PARSER_KEYS.join(', ')}`);
  }
  const created = await tx(async (c) => {
    const { rows } = await c.query<{ id: number }>(
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
    await audit(c, { userId: admin.id, action: 'bank.create', entityType: 'bank', entityId: rows[0]!.id, after: rows[0], ip: req.ip ?? null });
    return rows[0]!;
  });
  res.status(201).json(created);
}));

banksRouter.patch('/banks/:id', requireAdmin(async (req, res, admin) => {
  const b = req.body as Body;
  const parserKey = b.parser_key == null ? null : str(b, 'parser_key');
  if (parserKey !== null && !(PARSER_KEYS as readonly string[]).includes(parserKey)) {
    throw new HttpError(400, `parser_key ต้องเป็นหนึ่งใน ${PARSER_KEYS.join(', ')}`);
  }
  const bankId = Number(req.params.id);
  const { updated, mailboxIds } = await tx(async (c) => {
    const before = (await c.query('select * from bank where id = $1', [bankId])).rows[0];
    const { rows } = await c.query(
      `update bank set
         name = coalesce($2, name),
         sender_email = coalesce($3, sender_email),
         sender_domain = coalesce($4, sender_domain),
         subject_monthly = coalesce($5, subject_monthly),
         subject_ondemand = coalesce($6, subject_ondemand),
         attachment_filename_pattern = coalesce($7, attachment_filename_pattern),
         parser_key = coalesce($8, parser_key),
         is_active = coalesce($9, is_active)
       where id = $1 returning *`,
      [
        bankId,
        optionalStr(b, 'name'),
        optionalStr(b, 'sender_email')?.toLowerCase() ?? null,
        optionalStr(b, 'sender_domain')?.toLowerCase() ?? null,
        b.subject_monthly == null ? null : regex(b, 'subject_monthly'),
        b.subject_ondemand == null ? null : regex(b, 'subject_ondemand'),
        b.attachment_filename_pattern == null ? null : regex(b, 'attachment_filename_pattern'),
        parserKey,
        typeof b.is_active === 'boolean' ? b.is_active : null,
      ],
    );
    if (!rows[0]) throw new HttpError(404, 'ไม่พบธนาคาร');
    await audit(c, { userId: admin.id, action: 'bank.update', entityType: 'bank', entityId: bankId, before, after: rows[0], ip: req.ip ?? null });
    // statement ที่เคยพลาดเพราะรูปแบบเดิม (หรือมาตอนธนาคารปิดอยู่) ต้องถูกอ่านใหม่ — สั่งเฉพาะกล่องที่มีบัญชีใช้งาน
    // ของธนาคารนี้ กล่องที่ต้องเชื่อม Gmail ใหม่ข้าม (sync จะโยน GmailReauthRequiredError อยู่ดี)
    const resync = (!before.is_active && rows[0].is_active) || MATCH_FIELDS.some((f) => before[f] !== rows[0][f]);
    const mailboxIds = resync
      ? (await c.query<{ id: number }>(
          `select distinct a.email_account_id as id from bank_account a
           join email_account e on e.id = a.email_account_id
           where a.bank_id = $1 and a.archived_at is null and e.reauth_required_at is null`,
          [bankId],
        )).rows.map((r) => r.id)
      : [];
    return { updated: rows[0], mailboxIds };
  });
  // หลัง commit เท่านั้น — fire-and-forget ต้องมี .catch() เสมอ; ชนรอบที่วิ่งอยู่ worker จำ full ไว้รันต่อเอง
  for (const mailboxId of mailboxIds) {
    syncEmailAccount(mailboxId, { full: true }).catch((e) =>
      console.error(`[worker] อ่านใหม่หลังแก้ธนาคาร bank=${bankId} mailbox=${mailboxId} ล้มเหลว:`, e),
    );
  }
  res.json({ ...updated, resync_mailboxes: mailboxIds.length });
}));

// ลบไม่ได้ถ้ามีบัญชีผูกอยู่ (รวมที่เก็บเข้าคลัง) — ตรวจเองเพื่อบอกจำนวนและทางออก; `for update` กันบัญชีใหม่
// แทรกระหว่างนับกับลบ (insert ที่อ้าง FK ต้องได้ key-share lock ซึ่งชนกับ lock นี้)
banksRouter.delete('/banks/:id', requireAdmin(async (req, res, admin) => {
  const bankId = Number(req.params.id);
  await tx(async (c) => {
    const before = (await c.query('select * from bank where id = $1 for update', [bankId])).rows[0];
    const linked = (await c.query<{ n: number }>('select count(*)::int as n from bank_account where bank_id = $1', [bankId])).rows[0]!.n;
    if (linked) throw new HttpError(409, `ธนาคารนี้มีบัญชีผูกอยู่ ${linked} บัญชี ลบไม่ได้ — ปิดใช้งานแทน`);
    const { rowCount } = await c.query('delete from bank where id = $1', [bankId]);
    // คง 204 แบบ idempotent เหมือนเดิม (ลบของที่ไม่มีอยู่ไม่ใช่ error) — audit เฉพาะตอนที่ลบได้จริง
    if (rowCount) {
      await audit(c, { userId: admin.id, action: 'bank.delete', entityType: 'bank', entityId: bankId, before, ip: req.ip ?? null });
    }
  });
  res.status(204).end();
}));
