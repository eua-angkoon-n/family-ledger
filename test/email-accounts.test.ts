import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createTestDb } from './helpers/db.js';

process.env.ENCRYPTION_KEY ??= '0'.repeat(64);
// refreshAccessToken อ่านค่าเหล่านี้ก่อนยิง fetch — ไม่ตั้งไว้จะ throw เองก่อนถึง Google ปลอม
process.env.GOOGLE_CLIENT_ID ??= 'client-id';
process.env.GOOGLE_CLIENT_SECRET ??= 'client-secret';

// issue #11: invalid_grant = ต้องเชื่อม Gmail ใหม่ (409 + ตั้ง reauth_required_at แล้วหยุดยิง Google)
// ส่วน Google ล่มชั่วคราว = 502 โดยไม่แตะ flag; sync รอบถัดไปค้นเฉพาะเมลธนาคารย้อนหลังจาก last_synced_at
test('email accounts: sync กับ token ที่ใช้ไม่ได้ และ incremental sync ด้วย after:', async (t) => {
  const db = await createTestDb();
  if (db.skip) {
    t.skip(db.reason);
    return;
  }
  t.after(db.cleanup);
  await db.migrate();

  const { HttpError } = await import('../src/http.js');
  const { encrypt } = await import('../src/crypto.js');
  const { emailAccountsRouter } = await import('../src/routes/email-accounts.js');

  // Google ปลอมเฉพาะ token endpoint กับ messages.list — คำขออื่น (เรียก test server เอง) ส่งต่อ fetch จริง
  const realFetch = globalThis.fetch;
  let tokenResponse = () => Response.json({ access_token: 'access-token' });
  let tokenCalls = 0;
  const listQueries: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.href === 'https://oauth2.googleapis.com/token') {
      tokenCalls++;
      return tokenResponse();
    }
    if (url.href.startsWith('https://gmail.googleapis.com/gmail/v1/users/me/messages?')) {
      listQueries.push(url.searchParams.get('q')!);
      return Response.json({});
    }
    return realFetch(input, init);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = realFetch;
  });

  const userId = (
    await db.pool.query<{ id: number }>(
      `insert into app_user (google_sub, email, display_name, is_admin, status)
       values ('google-sub-mail', 'mail@example.com', 'Mail', false, 'approved') returning id`,
    )
  ).rows[0]!.id;
  const lastSynced = new Date('2026-09-20T00:00:00Z');
  const mailboxId = (
    await db.pool.query<{ id: number }>(
      `insert into email_account (user_id, email, refresh_token_enc, last_synced_at)
       values ($1, 'mail@example.com', $2, $3) returning id`,
      [userId, encrypt('refresh-token'), lastSynced],
    )
  ).rows[0]!.id;

  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { session: { userId?: number } }).session = { userId };
    next();
  });
  app.use('/api', emailAccountsRouter);
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'internal' });
  });
  const server = app.listen(0);
  t.after(() => server.close());
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server did not open a TCP port');
  const sync = (body: Record<string, unknown> = {}) =>
    fetch(`http://127.0.0.1:${address.port}/api/email-accounts/${mailboxId}/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const mailbox = async () =>
    (await db.pool.query<{ last_synced_at: Date | null; reauth_required_at: Date | null }>(
      'select last_synced_at, reauth_required_at from email_account where id = $1',
      [mailboxId],
    )).rows[0]!;

  const banks = (await db.pool.query<{ sender_email: string }>('select sender_email from bank where is_active = true')).rows;
  assert.ok(banks.length > 0, 'migration ต้อง seed ธนาคารที่ active ไว้ ไม่งั้น doSync จบก่อนแตะ Google');

  await t.test('incremental: ค้นต่อผู้ส่งธนาคาร ย้อนจาก last_synced_at 2 วัน แล้วขยับ last_synced_at เป็นเวลาเริ่ม list', async () => {
    const startedAt = Date.now();
    const res = await sync();
    assert.equal(res.status, 200);
    const after = Math.floor((lastSynced.getTime() - 2 * 24 * 60 * 60 * 1000) / 1000);
    assert.deepEqual(listQueries.sort(), banks.map((b) => `from:${b.sender_email} after:${after}`).sort());
    const synced = (await mailbox()).last_synced_at!.getTime();
    assert.ok(synced >= startedAt - 1000 && synced <= Date.now(), 'last_synced_at ต้องขยับเป็นเวลารอบนี้');
  });

  await t.test('full: ไม่ใส่ after:', async () => {
    listQueries.length = 0;
    const res = await sync({ full: true });
    assert.equal(res.status, 200);
    assert.deepEqual(listQueries.sort(), banks.map((b) => `from:${b.sender_email}`).sort());
  });

  await t.test('Google ล่มชั่วคราว (503) → 502 และไม่ตั้ง reauth_required_at', async () => {
    tokenResponse = () => new Response('upstream down', { status: 503 });
    const res = await sync();
    assert.equal(res.status, 502);
    assert.equal((await mailbox()).reauth_required_at, null);
  });

  await t.test('invalid_grant → 409 และตั้ง reauth_required_at', async () => {
    tokenResponse = () => Response.json({ error: 'invalid_grant' }, { status: 400 });
    const res = await sync();
    assert.equal(res.status, 409);
    assert.notEqual((await mailbox()).reauth_required_at, null);
  });

  await t.test('กล่องที่ต้องเชื่อมใหม่แล้ว sync ซ้ำได้ 409 โดยไม่ยิง Google อีก', async () => {
    const before = tokenCalls;
    const res = await sync();
    assert.equal(res.status, 409);
    assert.equal(tokenCalls, before);
  });

  await t.test('GET /email-accounts ส่ง reauth_required_at ให้เว็บแสดงแถบเชื่อมใหม่', async () => {
    const res = await fetch(`http://127.0.0.1:${address.port}/api/email-accounts`);
    const rows = (await res.json()) as { id: number; reauth_required_at: string | null }[];
    assert.equal(res.status, 200);
    assert.ok(rows.find((r) => r.id === mailboxId)?.reauth_required_at);
  });
});
