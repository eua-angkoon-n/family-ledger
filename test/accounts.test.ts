import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createTestDb } from './helpers/db.js';

// PATCH/POST ที่ส่ง pdf_password เข้ารหัสด้วย encrypt() — ต้องมีคีย์ dummy
process.env.ENCRYPTION_KEY ??= '0'.repeat(64);

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
  const { decrypt } = await import('../src/crypto.js');

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
     values ($1, $2, $3, 'บัญชีหลัก', '987-6-54321-0', 'enc:pdf-password') returning id`,
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

  // resync=true = สั่งอ่านใหม่ทั้งกล่องอีเมล (backfill เบื้องหลังจะพังที่ decrypt 'enc:refresh-token' แล้วถูก .catch() ดักไว้ — noise ที่คาดไว้)
  await t.test('PATCH สั่งอ่านเมลใหม่เฉพาะตอนเปลี่ยนธนาคาร/เลขบัญชี/รหัสผ่าน PDF/กล่องอีเมล', async () => {
    const app = await listen(appFor(ownerId));
    t.after(app.close);
    const patch = async (body: Record<string, unknown>) => {
      const res = await app.request(`/api/accounts/${bankAccountId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(res.status, 200);
      return (await res.json()) as { id: number; email_account_id: number; resync: boolean };
    };
    assert.deepEqual(await patch({ nickname: 'ชื่อเล่นใหม่' }), { id: bankAccountId, email_account_id: emailAccountId, resync: false });
    assert.equal((await patch({ promptpay_id: '0812345678' })).resync, false);
    // เลขเดิมเก็บแบบมีขีด (ก่อน normalize) ส่งเลขเดียวกันแบบตัวเลขล้วน = ไม่ใช่การเปลี่ยน แต่เก็บใหม่เป็นตัวเลขล้วน
    assert.equal((await patch({ account_number: '9876543210' })).resync, false, 'ส่งเลขเดิมซ้ำ ไม่ใช่การเปลี่ยน');
    const stored = await db.pool.query<{ account_number: string }>('select account_number from bank_account where id = $1', [bankAccountId]);
    assert.equal(stored.rows[0]!.account_number, '9876543210');
    assert.equal((await patch({ pdf_password: '' })).resync, false, 'รหัสผ่านว่าง = ไม่เปลี่ยน');
    assert.equal((await patch({ pdf_password: '   ' })).resync, false, 'รหัสผ่านช่องว่างล้วน = ไม่เปลี่ยน');
    assert.equal((await patch({ account_number: '175-1-99999-9' })).resync, true);
    assert.equal((await patch({ pdf_password: ' รหัสใหม่ ' })).resync, true);
    const enc = await db.pool.query<{ pdf_password_enc: string }>('select pdf_password_enc from bank_account where id = $1', [bankAccountId]);
    assert.equal(decrypt(enc.rows[0]!.pdf_password_enc), ' รหัสใหม่ ', 'ช่องว่างหัวท้ายเป็นส่วนของรหัส ห้าม trim');
    const otherMailbox = (await db.pool.query<{ id: number }>(
      `insert into email_account (user_id, email, refresh_token_enc) values ($1, 'owner2@example.com', 'enc:x') returning id`,
      [ownerId],
    )).rows[0]!.id;
    // ย้ายกล่อง → อ่านกล่องใหม่ที่บัญชีผูกหลังแก้
    assert.deepEqual(await patch({ email_account_id: otherMailbox }), { id: bankAccountId, email_account_id: otherMailbox, resync: true });
  });

  await t.test('POST ตอบ id, email_account_id และ resync=true เสมอ', async () => {
    const app = await listen(appFor(ownerId));
    t.after(app.close);
    const res = await app.request('/api/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bank_id: bankId, email_account_id: emailAccountId, nickname: 'บัญชีรอง', account_number: '123-4-56789-0', pdf_password: 'x' }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { id: number; email_account_id: number; resync: boolean };
    assert.equal(body.email_account_id, emailAccountId);
    assert.equal(body.resync, true);
  });

  await t.test('เลขบัญชีเก็บเป็นตัวเลขล้วน เลขซ้ำ (ต่างรูปแบบ) ได้ 409 รหัสผ่านไม่ถูก trim', async () => {
    const app = await listen(appFor(ownerId));
    t.after(app.close);
    const send = async (method: string, path: string, body: Record<string, unknown>) => {
      const res = await app.request(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return { status: res.status, body: (await res.json()) as { id?: number; error?: string } };
    };
    const post = (fields: Record<string, unknown>) =>
      send('POST', '/api/accounts', { bank_id: bankId, email_account_id: emailAccountId, nickname: 'บัญชีใหม่', pdf_password: 'x', ...fields });

    const stored = await db.pool.query<{ account_number: string }>(`select account_number from bank_account where nickname = 'บัญชีรอง'`);
    assert.equal(stored.rows[0]!.account_number, '1234567890');

    for (const bad of ['abc', '123-x-4567', '---', '']) {
      assert.deepEqual(await post({ account_number: bad }), { status: 400, body: { error: 'เลขที่บัญชีต้องเป็นตัวเลข' } }, bad);
    }
    assert.deepEqual(await post({ account_number: '123 4 56789-0' }), { status: 409, body: { error: 'มีบัญชีเลขนี้อยู่แล้ว' } });
    // บัญชีเดิมที่เก็บแบบมีขีด (ก่อน normalize) unique index ไม่จับ แต่ต้องได้ 409 เหมือนกัน
    await db.pool.query(
      `insert into bank_account (user_id, bank_id, email_account_id, nickname, account_number, pdf_password_enc)
       values ($1, $2, $3, 'บัญชีเก่า', '555-5-55555-5', 'enc:x')`,
      [ownerId, bankId, emailAccountId],
    );
    assert.deepEqual(await post({ account_number: '5555555555' }), { status: 409, body: { error: 'มีบัญชีเลขนี้อยู่แล้ว' } });
    assert.deepEqual(
      await send('PATCH', `/api/accounts/${bankAccountId}`, { account_number: '555-5555555' }),
      { status: 409, body: { error: 'มีบัญชีเลขนี้อยู่แล้ว' } },
    );

    for (const blank of [undefined, '', '   ']) {
      const res = await post({ account_number: '7777777777', pdf_password: blank });
      assert.deepEqual(res, { status: 400, body: { error: 'กรอกรหัสผ่านเปิดไฟล์ statement' } });
    }
    const created = await post({ account_number: '7777777777', pdf_password: '  pw  ' });
    assert.equal(created.status, 201);
    const enc = await db.pool.query<{ pdf_password_enc: string }>('select pdf_password_enc from bank_account where id = $1', [created.body.id]);
    assert.equal(decrypt(enc.rows[0]!.pdf_password_enc), '  pw  ');
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
