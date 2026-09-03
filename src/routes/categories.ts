import { Router } from 'express';
import { requireUser } from '../auth.js';
import { query } from '../db.js';
import { HttpError, str, type Body } from '../http.js';

export const categoriesRouter = Router();

const KINDS = ['income', 'expense'] as const;

// หมวดระบบ (user_id is null) รวมกับหมวดของ user เอง — is_active กรองได้ผ่าน query param แต่ default คืนทั้งหมด
categoriesRouter.get('/categories', requireUser(async (req, res, user) => {
  const isActive = req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : null;
  const { rows } = await query(
    `select * from category
     where (user_id is null or user_id = $1)
       and ($2::boolean is null or is_active = $2)
     order by kind, name`,
    [user.id, isActive],
  );
  res.json(rows);
}));

categoriesRouter.post('/categories', requireUser(async (req, res, user) => {
  const b = req.body as Body;
  const name = str(b, 'name', 100);
  const kind = str(b, 'kind');
  if (!(KINDS as readonly string[]).includes(kind)) {
    throw new HttpError(400, `kind ต้องเป็นหนึ่งใน ${KINDS.join(', ')}`);
  }
  const { rows } = await query(
    `insert into category (user_id, name, kind, is_system) values ($1, $2, $3, false) returning *`,
    [user.id, name, kind],
  );
  res.status(201).json(rows[0]);
}));

// ห้ามลบหมวดที่ถูกใช้งาน — มีแค่ PATCH is_active ไม่มี DELETE endpoint
// where user_id = $2 กันแก้หมวดระบบไปในตัวอยู่แล้ว (หมวดระบบ user_id เป็น null เสมอ)
categoriesRouter.patch('/categories/:id', requireUser(async (req, res, user) => {
  const b = req.body as Body;
  const { rows } = await query(
    `update category set
       name = coalesce($3, name),
       is_active = coalesce($4, is_active)
     where id = $1 and user_id = $2
     returning *`,
    [
      Number(req.params.id),
      user.id,
      b.name == null ? null : str(b, 'name', 100),
      typeof b.is_active === 'boolean' ? b.is_active : null,
    ],
  );
  if (!rows[0]) throw new HttpError(404, 'ไม่พบหมวด');
  res.json(rows[0]);
}));
