import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createTestDb } from './helpers/db.js';

// T6 (backend): DELETE /api/accounts/:id ต้อง archive (ไม่ลบจริง) เพราะ statement/txn
// ผูก on delete cascade กับ bank_account — ลบจริงจะทำลายประวัติทั้งชุด
test('archive account แทน hard delete', async (t) => {
  const db = await createTestDb();
  if (db.skip) {
    t.skip(db.reason);
    return;
  }
  t.after(db.cleanup);
  await db.migrate();

  const { HttpError } = await import('../src/http.js');
  const { accountsRouter } = await import('../src/routes/accounts.js');

  // แทน express-session ด้วย middleware จำลอง — ทดสอบ authorization/archive semantics ไม่ต้องผ่าน OAuth จริง
  function appFor(userId: number | undefined) {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as unknown as { session: { userId?: number } }).session = { userId };
      next();
    });
    app.use('/api', accountsRouter);
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
      throw err;
    });
    return app;
  }

  async function listen(app: express.Express) {
    const server = app.listen(0);
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server did not open a TCP port');
    const base = `http://127.0.0.1:${address.port}`;
    return { request: (path: string, init?: RequestInit) => fetch(`${base}${path}`, init), close: () => server.close() };
  }

  const owner = await db.pool.query<{ id: number }>(
    `insert into app_user (google_sub, email, display_name, is_admin, status)
     values ('google-sub-owner', 'owner@example.com', 'Owner', false, 'approved') returning id`,
  );
  const ownerId = owner.rows[0]!.id;

  const other = await db.pool.query<{ id: number }>(
    `insert into app_user (google_sub, email, display_name, is_admin, status)
     values ('google-sub-other', 'other@example.com', 'Other', false, 'approved') returning id`,
  );
  const otherId = other.rows[0]!.id;

  const emailAccount = await db.pool.query<{ id: number }>(
    `insert into email_account (user_id, email, refresh_token_enc)
     values ($1, 'owner@example.com', 'enc:refresh-token') returning id`,
    [ownerId],
  );
  const emailAccountId = emailAccount.rows[0]!.id;

  const bank = await db.pool.query<{ id: number }>(`select id from bank where lower(name) = 'scb'`);
  const bankId = bank.rows[0]!.id;

  const bankAccount = await db.pool.query<{ id: number }>(
    `insert into bank_account (user_id, bank_id, email_account_id, nickname, account_number, pdf_password_enc)
     values ($1, $2, $3, 'บัญชีหลัก', 'xxx-x-x6231-x', 'enc:pdf-password') returning id`,
    [ownerId, bankId, emailAccountId],
  );
  const bankAccountId = bankAccount.rows[0]!.id;

  const statement = await db.pool.query<{ id: number }>(
    `insert into statement (bank_account_id, gmail_message_id, gmail_attachment_id, period_start, period_end, status)
     values ($1, 'gmail-msg-1', 'gmail-att-1', '2026-08-01', '2026-08-31', 'parsed') returning id`,
    [bankAccountId],
  );
  const statementId = statement.rows[0]!.id;

  const txn = await db.pool.query<{ id: number }>(
    `insert into txn (statement_id, bank_account_id, txn_date, description, amount_satang, direction, running_balance_satang)
     values ($1, $2, '2026-08-15', 'โอนเงินเข้า', 10000, 'credit', 500000) returning id`,
    [statementId, bankAccountId],
  );
  const txnId = txn.rows[0]!.id;

  await t.test('GET /api/accounts เห็นบัญชีก่อน archive', async () => {
    const app = await listen(appFor(ownerId));
    t.after(app.close);
    const res = await app.request('/api/accounts');
    const body = (await res.json()) as { id: number }[];
    assert.equal(res.status, 200);
    assert.ok(body.some((a) => a.id === bankAccountId));
  });

  await t.test('user อื่น archive บัญชีไม่ใช่ของตัวเองไม่ได้ (404)', async () => {
    const app = await listen(appFor(otherId));
    t.after(app.close);
    const res = await app.request(`/api/accounts/${bankAccountId}`, { method: 'DELETE' });
    assert.equal(res.status, 404);

    const row = (await db.pool.query('select archived_at from bank_account where id = $1', [bankAccountId])).rows[0]!;
    assert.equal(row.archived_at, null);
  });

  await t.test('DELETE โดยเจ้าของ = archive ไม่ใช่ลบจริง', async () => {
    const app = await listen(appFor(ownerId));
    t.after(app.close);
    const res = await app.request(`/api/accounts/${bankAccountId}`, { method: 'DELETE' });
    assert.equal(res.status, 204);

    const row = (
      await db.pool.query<{ archived_at: string | null }>('select archived_at from bank_account where id = $1', [bankAccountId])
    ).rows[0]!;
    assert.notEqual(row.archived_at, null); // แถวยังอยู่ ไม่ถูกลบจริง

    const statementRow = await db.pool.query('select id from statement where id = $1', [statementId]);
    assert.equal(statementRow.rowCount, 1); // ไม่หายเพราะ cascade

    const txnRow = await db.pool.query('select id from txn where id = $1', [txnId]);
    assert.equal(txnRow.rowCount, 1); // ไม่หายเพราะ cascade
  });

  await t.test('GET /api/accounts ไม่คืนบัญชีที่ archive แล้ว', async () => {
    const app = await listen(appFor(ownerId));
    t.after(app.close);
    const res = await app.request('/api/accounts');
    const body = (await res.json()) as { id: number }[];
    assert.equal(body.some((a) => a.id === bankAccountId), false);
  });

  await t.test('archive ซ้ำบัญชีที่ archive ไปแล้ว → 404', async () => {
    const app = await listen(appFor(ownerId));
    t.after(app.close);
    const res = await app.request(`/api/accounts/${bankAccountId}`, { method: 'DELETE' });
    assert.equal(res.status, 404);
  });

  await t.test('PATCH บัญชีที่ archive แล้ว → 404 ห้ามแก้ไข', async () => {
    const app = await listen(appFor(ownerId));
    t.after(app.close);
    const res = await app.request(`/api/accounts/${bankAccountId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: 'ชื่อใหม่' }),
    });
    assert.equal(res.status, 404);
  });
});
