// Slice 4B Step 2: /api/reports/*, /api/transactions (list+detail) — ต่อ Postgres จริงผ่าน test/helpers/db.ts
// ห้าม static import จาก src/* ที่แตะ src/db.ts ก่อน createTestDb() — ดู comment ใน test/helpers/db.ts
// createTestDb() เรียกได้ครั้งเดียวต่อไฟล์ — ทุก subtest ใช้ pool/seed เดียวกันจากที่นี่
import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import { createTestDb } from './helpers/db.js';

test('reports API + transaction list/detail', async (t) => {
  const db = await createTestDb();
  if (db.skip) {
    t.skip(db.reason);
    return;
  }
  t.after(db.cleanup);
  await db.migrate();

  const { api, HttpError } = await import('../src/api.js');

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
    if ((err as { code?: string }).code === '23505') return void res.status(409).json({ error: 'ซ้ำ' });
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

  const user = await db.pool.query<{ id: number }>(
    `insert into app_user (google_sub, email, display_name, is_admin, status)
     values ('google-sub-reports', 'reports@example.com', 'Reports Tester', false, 'approved') returning id`,
  );
  const userId = user.rows[0]!.id;
  await request('/test/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  const emailAccount = await db.pool.query<{ id: number }>(
    `insert into email_account (user_id, email, refresh_token_enc)
     values ($1, 'reports@example.com', 'enc:refresh-token') returning id`,
    [userId],
  );
  const emailAccountId = emailAccount.rows[0]!.id;

  const bank = await db.pool.query<{ id: number }>(`select id from bank where lower(name) = 'scb'`);
  const bankId = bank.rows[0]!.id;

  async function seedAccount(accountNumber: string, createdAt?: string): Promise<number> {
    const row = await db.pool.query<{ id: number }>(
      `insert into bank_account (user_id, bank_id, email_account_id, nickname, account_number, pdf_password_enc, created_at)
       values ($1, $2, $3, 'บัญชีทดสอบ', $4, 'enc:x', coalesce($5::timestamptz, now())) returning id`,
      [userId, bankId, emailAccountId, accountNumber, createdAt ?? null],
    );
    return row.rows[0]!.id;
  }

  async function seedStatement(
    bankAccountId: number,
    gmailMessageId: string,
    opts: { periodStart: string; periodEnd: string; status?: string },
  ): Promise<number> {
    const row = await db.pool.query<{ id: number }>(
      `insert into statement (bank_account_id, gmail_message_id, gmail_attachment_id, period_start, period_end, status)
       values ($1, $2, $2, $3, $4, $5) returning id`,
      [bankAccountId, gmailMessageId, opts.periodStart, opts.periodEnd, opts.status ?? 'parsed'],
    );
    return row.rows[0]!.id;
  }

  async function seedTxn(
    statementId: number,
    bankAccountId: number,
    opts: { txnDate: string; amount: number; direction: 'credit' | 'debit'; runningBalance: number },
  ): Promise<number> {
    const row = await db.pool.query<{ id: number }>(
      `insert into txn (statement_id, bank_account_id, txn_date, description, amount_satang, direction, running_balance_satang)
       values ($1, $2, $3, '', $4, $5, $6) returning id`,
      [statementId, bankAccountId, opts.txnDate, opts.amount, opts.direction, opts.runningBalance],
    );
    return row.rows[0]!.id;
  }

  // ---- ธุรกรรมของเดือน 2026-08 ----
  const accountA1 = await seedAccount('111-1-11111-1');
  const accountA2 = await seedAccount('222-2-22222-2');
  const stmtA1 = await seedStatement(accountA1, 'msg-rep-a1', { periodStart: '2026-08-01', periodEnd: '2026-08-31' });
  const stmtA2 = await seedStatement(accountA2, 'msg-rep-a2', { periodStart: '2026-08-01', periodEnd: '2026-08-31' });

  // credit ปกติ — ไม่มี annotation
  const creditTxn1 = await seedTxn(stmtA1, accountA1, { txnDate: '2026-08-05', amount: 500_000, direction: 'credit', runningBalance: 500_000 });
  // debit ที่ไม่เคยถูก annotate เลย (ไม่มีแถว txn_annotation) — ตัวจับ bug coalesce: ต้องยังโผล่ใน money_out_satang (ข้อ 1)
  // และ 0 split จะตกไปกลุ่ม "ไม่ได้จัดหมวด" ใน category-breakdown
  const debitTxn1 = await seedTxn(stmtA1, accountA1, { txnDate: '2026-08-06', amount: 300_000, direction: 'debit', runningBalance: 200_000 });
  // debit ที่จะแยก 3 หมวดผ่าน endpoint จริง (ข้อ 3)
  const debitTxn2 = await seedTxn(stmtA1, accountA1, { txnDate: '2026-08-07', amount: 150_000, direction: 'debit', runningBalance: 50_000 });
  // คู่โอนภายใน: สร้างทีหลังใน "ข้อ 6" เอง — ต้องไม่ปนกับ baseline ของ ข้อ 1-3 ไม่งั้น debit ฝั่งขาโอนซึ่งยัง
  // ไม่ confirm นับเป็น debit 0-split ปกติ จะไปปนกับก้อน "ไม่ได้จัดหมวด" ของ debitTxn1 ทำให้ตัวเลขคาดหวังผิด

  const categories = await db.pool.query<{ id: number; name: string }>(
    `select id, name from category where is_system = true and kind = 'expense' order by id limit 3`,
  );
  const [cat1, cat2, cat3] = categories.rows;

  // ยอดสามก้อนไม่เท่ากันโดยตั้งใจ (70000/50000/30000) — ถ้าใช้ยอดเท่ากันทั้งสามก้อน แล้ว query ดันแจกยอดผิดหมวด
  // (fan-out ผิดที่) ผลรวมยังจะบังเอิญออกมา 150000 เท่าเดิม การเทียบราย category ต้องแยกแยะออกจากความบังเอิญนี้ได้
  await t.test('เตรียม 3-split บน debitTxn2 ผ่าน PUT /transactions/:id/splits จริง (ไม่ใช่ raw insert)', async () => {
    const res = await request(`/api/transactions/${debitTxn2}/splits`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([
        { category_id: cat1!.id, amount_satang: 70_000 },
        { category_id: cat2!.id, amount_satang: 50_000 },
        { category_id: cat3!.id, amount_satang: 30_000 },
      ]),
    });
    assert.equal(res.status, 200);
  });

  type Summary = {
    money_in_satang: number;
    money_out_satang: number;
    net_satang: number;
    internal_transfer_excluded_satang: number;
    internal_transfer_count: number;
  };
  let baseline: Summary;

  await t.test('ข้อ 1+2: ธุรกรรมที่ไม่เคย annotate ต้องยังอยู่ใน money_out_satang, money_in_satang เป็น number (strictEqual)', async () => {
    const res = await request('/api/reports/summary?month=2026-08');
    assert.equal(res.status, 200);
    baseline = await res.json();

    // money_in = creditTxn1, money_out = debitTxn1 (ไม่เคย annotate เลย) + debitTxn2 (3-split)
    assert.strictEqual(baseline.money_in_satang, 500_000);
    assert.strictEqual(baseline.money_out_satang, 300_000 + 150_000);
    assert.strictEqual(baseline.net_satang, baseline.money_in_satang - baseline.money_out_satang);
  });

  await t.test('ข้อ 3: category-breakdown — 3-split นับครั้งเดียวต่อหมวด, 0-split ตกไป category_id: null, ผลรวมเท่า money_out_satang', async () => {
    const res = await request('/api/reports/category-breakdown?month=2026-08');
    assert.equal(res.status, 200);
    const body = (await res.json()) as { rows: { category_id: number | null; category_name: string; total_satang: number; txn_count: number }[] };

    const row1 = body.rows.find((r) => r.category_id === cat1!.id);
    const row2 = body.rows.find((r) => r.category_id === cat2!.id);
    const row3 = body.rows.find((r) => r.category_id === cat3!.id);
    assert.equal(row1?.total_satang, 70_000);
    assert.equal(row1?.txn_count, 1);
    assert.equal(row2?.total_satang, 50_000);
    assert.equal(row3?.total_satang, 30_000);

    const uncategorised = body.rows.find((r) => r.category_id === null);
    assert.equal(uncategorised?.category_name, 'ไม่ได้จัดหมวด');
    assert.equal(uncategorised?.total_satang, 300_000);
    assert.equal(uncategorised?.txn_count, 1);

    const total = body.rows.reduce((sum, r) => sum + r.total_satang, 0);
    assert.equal(total, baseline.money_out_satang);
  });

  let transferDebitLeg: number;
  let transferCreditLeg: number;

  await t.test('ข้อ 6: transfer_match ยืนยันผ่าน POST /transfer-matches/:id/confirm จริง — ทั้งสองฝั่งหายจาก money_in/out และถูกนับใน internal_transfer_excluded_satang', async () => {
    // คู่โอนภายใน: debit ฝั่ง accountA1, credit ฝั่ง accountA2 ยอดเท่ากัน — สร้างตรงนี้ ไม่ใช่ baseline ด้านบน
    // กันไม่ให้ปนกับก้อน "ไม่ได้จัดหมวด" ของ ข้อ 3 ก่อน confirm
    transferDebitLeg = await seedTxn(stmtA1, accountA1, { txnDate: '2026-08-08', amount: 400_000, direction: 'debit', runningBalance: -350_000 });
    transferCreditLeg = await seedTxn(stmtA2, accountA2, { txnDate: '2026-08-08', amount: 400_000, direction: 'credit', runningBalance: 400_000 });

    const match = await db.pool.query<{ id: number }>(
      `insert into transfer_match (user_id, debit_txn_id, credit_txn_id, status, matched_by, confidence)
       values ($1, $2, $3, 'suggested', 'system', 0.8) returning id`,
      [userId, transferDebitLeg, transferCreditLeg],
    );
    const confirmRes = await request(`/api/transfer-matches/${match.rows[0]!.id}/confirm`, { method: 'POST' });
    assert.equal(confirmRes.status, 200);

    const res = await request('/api/reports/summary?month=2026-08');
    const after: Summary = await res.json();

    // กลับมาเท่า baseline เดิม — สองฝั่งของคู่โอนถูกตัดออกจาก flow ทั้งคู่ (ADR-0002 §5 end-to-end ผ่าน endpoint จริง)
    assert.strictEqual(after.money_in_satang, baseline.money_in_satang);
    assert.strictEqual(after.money_out_satang, baseline.money_out_satang);
    assert.strictEqual(after.internal_transfer_excluded_satang, 400_000 + 400_000); // สองฝั่งรวมกัน ไม่หารครึ่ง
    assert.strictEqual(after.internal_transfer_count, 2);

    // category-breakdown ก็ต้องตัดคู่โอนออกด้วยเหตุผลเดียวกัน — ผลรวมยังต้องเท่า money_out_satang หลัง confirm
    const breakdown = (await (await request('/api/reports/category-breakdown?month=2026-08')).json()) as {
      rows: { total_satang: number }[];
    };
    const total = breakdown.rows.reduce((sum, r) => sum + r.total_satang, 0);
    assert.equal(total, after.money_out_satang);
  });

  // ---- ข้อ 5: accountCoverage / statement_behind — seed period_end สัมพัทธ์กับ current_date เท่านั้น ----
  await t.test('ข้อ 5: statement_behind สัมพัทธ์กับ current_date — parsed ตรง threshold=false, เลยไปอีกเดือน=true, บัญชีใหม่เดือนนี้ไม่มี statement=false', async () => {
    const dates = await db.pool.query<{ threshold: string; further_behind: string; old_created_at: string }>(
      `select (date_trunc('month', current_date) - interval '1 day')::date as threshold,
              (date_trunc('month', current_date) - interval '1 month' - interval '1 day')::date as further_behind,
              (date_trunc('month', current_date) - interval '6 months') as old_created_at`,
    );
    const { threshold, further_behind, old_created_at } = dates.rows[0]!;

    const accountOnTime = await seedAccount('333-3-33333-3', old_created_at);
    await seedStatement(accountOnTime, 'msg-cov-ontime', { periodStart: threshold, periodEnd: threshold });

    const accountBehind = await seedAccount('444-4-44444-4', old_created_at);
    await seedStatement(accountBehind, 'msg-cov-behind', { periodStart: further_behind, periodEnd: further_behind });

    // ไม่ส่ง createdAt — ใช้ default now() คือ "สร้างเดือนนี้" ไม่มี statement เลย
    const accountNew = await seedAccount('555-5-55555-5');

    const res = await request('/api/reports/data-coverage');
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      rows: { bank_account_id: number; statement_behind: boolean; latest_parsed_period_end: string | null; parsed_statement_count: number }[];
    };

    const onTimeRow = body.rows.find((r) => r.bank_account_id === accountOnTime);
    assert.equal(onTimeRow?.statement_behind, false);
    assert.equal(onTimeRow?.latest_parsed_period_end, threshold);

    const behindRow = body.rows.find((r) => r.bank_account_id === accountBehind);
    assert.equal(behindRow?.statement_behind, true);
    assert.equal(behindRow?.latest_parsed_period_end, further_behind);

    const newRow = body.rows.find((r) => r.bank_account_id === accountNew);
    assert.equal(newRow?.statement_behind, false);
    assert.equal(newRow?.parsed_statement_count, 0);
    assert.equal(newRow?.latest_parsed_period_end, null);
  });

  await t.test('GET /transactions — ไม่ fan-out บน split, pagination ครบ, ตัวกรอง account ใช้ได้', async () => {
    const res = await request(`/api/transactions?month=2026-08&bank_account_id=${accountA1}&limit=10`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      from: string;
      to: string;
      rows: { id: number; split_count: number; categories: unknown[] }[];
      total_count: number;
    };
    assert.equal(body.from, '2026-08-01');
    assert.equal(body.to, '2026-09-01');
    // debitTxn2 มี 3 split แต่ต้องนับเป็น 1 แถวในตาราง ไม่ fan-out เป็น 3
    const row = body.rows.find((r) => r.id === debitTxn2);
    assert.equal(row?.split_count, 3);
    assert.equal(row?.categories.length, 3);
    assert.ok(body.rows.every((r) => r.id !== undefined));
    // accountA1 มี 4 ธุรกรรม (creditTxn1, debitTxn1, debitTxn2, transferDebitLeg) — limit ต่ำกว่าพิสูจน์ total_count
    // มาจาก count(*) over () จริง ไม่ใช่แค่ rows.length ที่ผ่านแบบบังเอิญเมื่อผลพอดีไม่เกิน limit
    assert.equal(body.total_count, 4);
    assert.equal(body.rows.length, 4);
    const paged = (await (await request(`/api/transactions?month=2026-08&bank_account_id=${accountA1}&limit=2`)).json()) as {
      rows: unknown[];
      total_count: number;
    };
    assert.equal(paged.rows.length, 2);
    assert.equal(paged.total_count, 4);

    // offset เลยแถวสุดท้าย → rows ว่าง, count(*) over () ไม่มีแถวให้อ่าน ต้องยิงนับแยกแทนที่จะตอบ 0 มั่ว ๆ
    const pastEnd = (await (
      await request(`/api/transactions?month=2026-08&bank_account_id=${accountA1}&limit=2&offset=100`)
    ).json()) as { rows: unknown[]; total_count: number };
    assert.equal(pastEnd.rows.length, 0);
    assert.equal(pastEnd.total_count, 4);
  });

  await t.test('GET /transactions/:id ที่ id ไม่ใช่ตัวเลข → 400 ไม่ใช่ 500', async () => {
    const res = await request('/api/transactions/abc');
    assert.equal(res.status, 400);
  });

  await t.test('GET /transactions/:id — คืน splits และ transfer_matches ของธุรกรรมนั้น', async () => {
    const res = await request(`/api/transactions/${debitTxn2}`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { id: number; splits: { category_id: number; amount_satang: number }[]; transfer_matches: unknown[] };
    assert.equal(body.id, debitTxn2);
    assert.equal(body.splits.length, 3);

    const transferRes = await request(`/api/transactions/${transferDebitLeg}`);
    const transferBody = (await transferRes.json()) as { transfer_matches: { status: string; counterpart_txn_id: number }[] };
    assert.equal(transferBody.transfer_matches.length, 1);
    assert.equal(transferBody.transfer_matches[0]!.status, 'confirmed');
    assert.equal(transferBody.transfer_matches[0]!.counterpart_txn_id, transferCreditLeg);
  });
});
