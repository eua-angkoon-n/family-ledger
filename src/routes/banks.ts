import { Router } from 'express';
import { requireAdmin, requireUser } from '../auth.js';
import { query } from '../db.js';
import { HttpError, optionalStr, regex, str, type Body } from '../http.js';
import { PARSER_KEYS } from '../parsers/index.js';

export const banksRouter = Router();

banksRouter.get('/banks', requireUser(async (_req, res) => {
  const { rows } = await query('select * from bank order by name');
  res.json(rows);
}));

banksRouter.post('/banks', requireAdmin(async (req, res) => {
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

banksRouter.patch('/banks/:id', requireAdmin(async (req, res) => {
  const b = req.body as Body;
  const parserKey = b.parser_key == null ? null : str(b, 'parser_key');
  if (parserKey !== null && !(PARSER_KEYS as readonly string[]).includes(parserKey)) {
    throw new HttpError(400, `parser_key ต้องเป็นหนึ่งใน ${PARSER_KEYS.join(', ')}`);
  }
  const { rows } = await query(
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
      Number(req.params.id),
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
  res.json(rows[0]);
}));

// ลบไม่ได้ถ้ามีบัญชีผูกอยู่ — FK จะโยน error ออกมาเอง แล้ว handler แปลงเป็น 409
banksRouter.delete('/banks/:id', requireAdmin(async (req, res) => {
  await query('delete from bank where id = $1', [Number(req.params.id)]);
  res.status(204).end();
}));
