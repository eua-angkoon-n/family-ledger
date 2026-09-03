// Slice 4A code review follow-up: admin reject ผู้ใช้ที่เคยเพิ่ม bank account ต้องไม่ชน FK 23503
// (bank_account.email_account_id ไม่มี on delete cascade และ bank_account ไม่ถูกลบจริงอีกต่อไปตั้งแต่ archive)
// ต้องตั้ง DATABASE_URL ก่อน import ตัวไหนที่แตะ src/db.ts — ดู comment ใน test/helpers/db.ts
import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import { createTestDb } from './helpers/db.js';

process.env.ENCRYPTION_KEY ??= '0'.repeat(64);

test('admin reject: ผู้ใช้ที่มี bank_account อยู่แล้วต้อง reject ได้โดยไม่ชน FK', async (t) => {
  const db = await createTestDb();
  if (db.skip) {
    t.skip(db.reason);
    return;
  }
  t.after(db.cleanup);
  await db.migrate();

  const { api, HttpError } = await import('../src/api.js');
  const { encrypt } = await import('../src/crypto.js');

  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret-test-secret-test-secret', resave: false, saveUninitialized: false }));
  app.post('/test/login', (req, res) => {
    req.session.userId = Number((req.body as { userId: number }).userId);
    res.json({ ok: true });
  });
  app.use('/api', api);
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
    if ((err as { code?: string }).code === '23503') return void res.status(409).json({ error: 'fk_violation' });
    console.error(err);
    res.status(500).json({ error: 'internal' });
  });

  const server = app.listen(0);
  t.after(() => server.close());
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server ไม่ได้เปิดพอร์ต');

  let cookie = '';
  const request = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (cookie) headers.set('cookie', cookie);
    const res = await fetch(`http://127.0.0.1:${address.port}${path}`, { ...init, headers });
    const setCookie = res.headers.getSetCookie()[0];
    if (setCookie) cookie = setCookie.split(';', 1)[0]!;
    return res;
  };

  const admin = await db.pool.query<{ id: number }>(
    `insert into app_user (google_sub, email, display_name, is_admin, status)
     values ('google-sub-admin', 'admin@example.com', 'Admin', true, 'approved') returning id`,
  );
  const target = await db.pool.query<{ id: number }>(
    `insert into app_user (google_sub, email, display_name, is_admin, status)
     values ('google-sub-target', 'target@example.com', 'Target User', false, 'approved') returning id`,
  );
  const targetId = target.rows[0]!.id;

  const emailAccount = await db.pool.query<{ id: number }>(
    `insert into email_account (user_id, email, refresh_token_enc)
     values ($1, 'target@example.com', $2) returning id`,
    [targetId, encrypt('fake-refresh-token')],
  );
  const bank = await db.pool.query<{ id: number }>(`select id from bank where lower(name) = 'scb'`);
  // บัญชีธนาคารของ target ยังอยู่ตอน admin reject — จุดที่เคยชน FK 23503
  await db.pool.query(
    `insert into bank_account (user_id, bank_id, email_account_id, nickname, account_number, pdf_password_enc)
     values ($1, $2, $3, 'บัญชีทดสอบ', '999-9-99999-9', $4)`,
    [targetId, bank.rows[0]!.id, emailAccount.rows[0]!.id, encrypt('pdf-password')],
  );

  await request('/test/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: admin.rows[0]!.id }),
  });

  const rejected = await request(`/api/admin/users/${targetId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'rejected' }),
  });
  assert.equal(rejected.status, 200, `คาดว่า reject สำเร็จ แต่ได้ ${rejected.status}: ${await rejected.text()}`);

  const status = await db.pool.query<{ status: string }>('select status from app_user where id = $1', [targetId]);
  assert.equal(status.rows[0]!.status, 'rejected');

  // email_account ไม่ถูกลบ — เก็บไว้เป็นประวัติ ตรงกับที่ bank_account ยังอ้างถึงอยู่
  const emailAccountStillThere = await db.pool.query('select 1 from email_account where id = $1', [
    emailAccount.rows[0]!.id,
  ]);
  assert.equal(emailAccountStillThere.rowCount, 1);
});
