import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import session from 'express-session';

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1:5432/unused';

const { createAuthRouter } = await import('../src/auth.js');
const { api } = await import('../src/api.js');
const { APP_VERSION } = await import('../src/version.js');

const authEnv = {
  googleClientId: 'client-id',
  googleClientSecret: 'client-secret',
  baseUrl: 'http://localhost',
  adminEmail: 'admin@example.com',
};

type QueryCall = { sql: string; params: unknown[] };

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const NO_GMAIL_SCOPE = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

async function openTestApp(existingUserId?: number, googleEmail = 'member@example.com', existingStatus = 'approved') {
  const calls: QueryCall[] = [];
  const revoked: string[] = [];
  // แก้ค่าได้กลางเทสต์ — จำลองผู้ใช้เลือกบัญชี Google อื่น/เอาติ๊ก gmail.readonly ออกในหน้า consent
  const google = { email: googleEmail, scope: `${NO_GMAIL_SCOPE} ${GMAIL_SCOPE}` };
  const fakeQuery = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('from app_user where google_sub')) {
      return { rows: existingUserId ? [{ id: existingUserId, status: existingStatus }] : [], rowCount: existingUserId ? 1 : 0 };
    }
    if (sql.includes('select status from app_user')) {
      const found = params[0] === existingUserId;
      return { rows: found ? [{ status: existingStatus }] : [], rowCount: found ? 1 : 0 };
    }
    if (sql.includes('insert into app_user')) return { rows: [{ id: 42 }], rowCount: 1 };
    // กล่อง id 5 เป็นของผู้ใช้เดิม (existingUserId) เท่านั้น
    if (sql.includes('select email from email_account')) {
      const owned = params[0] === 5 && params[1] === existingUserId;
      return { rows: owned ? [{ email: 'Member@Example.com' }] : [], rowCount: owned ? 1 : 0 };
    }
    return { rows: [], rowCount: 1 };
  };
  const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/revoke') {
      revoked.push(new URLSearchParams(String(init?.body)).get('token')!);
      return new Response(null, { status: 200 });
    }
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'access-token', refresh_token: 'refresh-token', scope: google.scope });
    }
    if (url === 'https://www.googleapis.com/oauth2/v3/userinfo') {
      return Response.json({ sub: 'google-user-1', email: google.email, name: 'Family Member' });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret-test-secret-test-secret', resave: false, saveUninitialized: false }));
  // /api/me อ่าน app_user จาก DB จริง (loadUser ไม่ได้ใช้ query ที่ฉีดเข้ามา) — ดูผู้ใช้ใน session ตรง ๆ แทน
  app.get('/test/session', (req, res) => res.json({ userId: req.session.userId ?? null }));
  app.use('/auth', createAuthRouter({
    query: fakeQuery as never,
    encrypt: (value: string) => `encrypted:${value}`,
    env: authEnv,
    fetch: fakeFetch,
  }));
  app.use('/api', api);

  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server did not open a TCP port');

  let cookie = '';
  const request = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (cookie) headers.set('cookie', cookie);
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      ...init,
      headers,
      redirect: 'manual',
    });
    const setCookie = response.headers.getSetCookie()[0];
    if (setCookie) cookie = setCookie.split(';', 1)[0]!;
    return response;
  };

  const sessionUserId = async () => ((await (await request('/test/session')).json()) as { userId: number | null }).userId;

  return { calls, google, revoked, request, sessionUserId, close: () => server.close() };
}

async function completeGoogleLogin(request: (path: string, init?: RequestInit) => Promise<Response>, startPath = '/auth/google') {
  const start = await request(startPath);
  assert.equal(start.status, 302);
  const googleUrl = new URL(start.headers.get('location')!);
  const state = googleUrl.searchParams.get('state');
  assert.ok(state);
  return request(`/auth/google/callback?code=oauth-code&state=${state}`);
}

test('ผู้ใช้ Google ใหม่ถูกสร้างทันทีตอน callback และได้สถานะ pending', async (t) => {
  const app = await openTestApp();
  t.after(app.close);

  const initialMe = await app.request('/api/me');
  // /me ส่ง version มาด้วยตั้งแต่ยังไม่ล็อกอิน — เว็บใช้ค่านี้แสดงเลขเวอร์ชันบนหน้าเข้าสู่ระบบ
  assert.deepEqual(await initialMe.json(), { user: null, version: APP_VERSION });

  // ไม่ล็อกอิน + endpoint ที่ย้ายไป src/routes/admin.ts ต้องยัง mount อยู่จริง (401 ไม่ใช่ 404 จาก fallback)
  const parserKeys = await app.request('/api/admin/parser-keys');
  assert.equal(parserKeys.status, 401);

  const callback = await completeGoogleLogin(app.request);
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/');

  const insert = app.calls.find(({ sql }) => sql.includes('insert into app_user'));
  assert.ok(insert, 'ต้องสร้าง app_user ตอน callback ไม่มีขั้นกรอกรหัสเชิญคั่นอีกแล้ว');
  // member@example.com ไม่ใช่ adminEmail — ด่านที่กันคนนอกคือสถานะนี้ ไม่ใช่รหัสเชิญ
  assert.equal(insert.params[3], false, 'ต้องไม่ได้ is_admin');
  assert.equal(insert.params[4], 'pending', 'ต้องเป็น pending รอแอดมินอนุมัติ');

  // refresh token ต้องถูกเก็บให้ผู้ใช้ใหม่ด้วย ไม่งั้น Gmail polling ไม่ทำงานเลยแบบไม่มี error
  const mailbox = app.calls.find(({ sql }) => sql.includes('insert into email_account'));
  assert.ok(mailbox, 'ต้องผูกกล่องอีเมลให้ผู้ใช้ใหม่');
  assert.equal(mailbox.params[2], 'encrypted:refresh-token');
});

test('ADMIN_EMAIL ได้ is_admin + approved อัตโนมัติตอนล็อกอินครั้งแรก', async (t) => {
  const app = await openTestApp(undefined, 'Admin@Example.com');
  t.after(app.close);

  const callback = await completeGoogleLogin(app.request);
  assert.equal(callback.status, 302);

  const insert = app.calls.find(({ sql }) => sql.includes('insert into app_user'));
  assert.ok(insert);
  assert.equal(insert.params[3], true, 'ต้องได้ is_admin (เทียบอีเมลแบบไม่สนตัวพิมพ์)');
  assert.equal(insert.params[4], 'approved');
});

test('สมาชิกเดิมล็อกอินซ้ำต้องไม่สร้างผู้ใช้ใหม่', async (t) => {
  const app = await openTestApp(7);
  t.after(app.close);

  const callback = await completeGoogleLogin(app.request);
  assert.equal(callback.status, 302);
  assert.equal(app.calls.some(({ sql }) => sql.includes('insert into app_user')), false);
});

test('ไม่มี endpoint สมัครสมาชิกด้วยรหัสเชิญเหลืออยู่', async (t) => {
  const app = await openTestApp();
  t.after(app.close);

  const signup = await app.request('/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inviteCode: 'family-only' }),
  });
  assert.equal(signup.status, 404);
});

const isMailboxWrite = ({ sql }: QueryCall) => sql.includes('insert into email_account');

test('ล็อกอินโดยไม่ติ๊ก gmail.readonly ยังเข้าระบบได้ แต่ไม่บันทึก/ทับ refresh token ของกล่อง', async (t) => {
  const app = await openTestApp(7);
  t.after(app.close);
  app.google.scope = NO_GMAIL_SCOPE;

  const callback = await completeGoogleLogin(app.request);
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/?gmail=not_granted');
  assert.equal(app.calls.some(isMailboxWrite), false);
  assert.equal(await app.sessionUserId(), 7);
  const loginAudit = app.calls.find(({ sql }) => sql.includes('insert into audit_log'));
  assert.ok(loginAudit);
  assert.equal(loginAudit.params[1], 'auth.login');
  assert.equal(JSON.parse(String(loginAudit.params[5])).gmail_connected, false);
});

test('Google ส่ง ?error= กลับมา: state ผิดยังได้ 400, state ถูกได้ redirect ไม่แลก token', async (t) => {
  const app = await openTestApp();
  t.after(app.close);

  const start = await app.request('/auth/google');
  const state = new URL(start.headers.get('location')!).searchParams.get('state');
  const wrongState = await app.request('/auth/google/callback?error=access_denied&state=wrong');
  assert.equal(wrongState.status, 400);

  const denied = await app.request(`/auth/google/callback?error=access_denied&state=${state}`);
  assert.equal(denied.status, 302);
  assert.equal(denied.headers.get('location'), '/?auth_error=access_denied');
  assert.equal(app.calls.length, 0, 'ไม่แตะ DB เลย');
  assert.equal(await app.sessionUserId(), null);
});

test('เชื่อม Gmail ใหม่ (?reconnect=) ด้วยบัญชีเดิม: ทับ token แถวเดิม ล้าง reauth_required_at ผู้ใช้ใน session ไม่เปลี่ยน', async (t) => {
  const app = await openTestApp(7);
  t.after(app.close);
  await completeGoogleLogin(app.request);

  const start = await app.request('/auth/google?reconnect=5');
  assert.equal(start.status, 302);
  const googleUrl = new URL(start.headers.get('location')!);
  assert.equal(googleUrl.searchParams.get('login_hint'), 'Member@Example.com');
  // ต้องหากล่องด้วย user ใน session เสมอ — กล่องของคนอื่นต้องหาไม่เจอ
  assert.deepEqual(app.calls.findLast(({ sql }) => sql.includes('select email from email_account'))?.params, [5, 7]);

  const before = app.calls.length;
  // Google คืนอีเมลตัวพิมพ์เล็ก แถวเดิมเก็บ Member@Example.com — ต้องนับว่าเป็นบัญชีเดียวกัน
  const callback = await app.request(`/auth/google/callback?code=oauth-code&state=${googleUrl.searchParams.get('state')}`);
  assert.equal(callback.headers.get('location'), '/accounts?gmail=connected');
  const after = app.calls.slice(before);
  const upsert = after.find(isMailboxWrite);
  assert.ok(upsert);
  assert.match(upsert.sql, /reauth_required_at = null/);
  assert.deepEqual(upsert.params, [7, 'Member@Example.com', 'encrypted:refresh-token']);
  assert.equal(after.find(({ sql }) => sql.includes('insert into audit_log'))?.params[1], 'auth.mailbox_reconnect');
  assert.equal(after.some(({ sql }) => sql.includes('google_sub') || sql.includes('insert into app_user')), false, 'ไม่หา/สร้าง app_user ตอนเชื่อมใหม่');
  assert.equal(await app.sessionUserId(), 7);
});

test('?reconnect= ต้องล็อกอินและเป็นเจ้าของกล่อง', async (t) => {
  const app = await openTestApp(7);
  t.after(app.close);

  assert.equal((await app.request('/auth/google?reconnect=5')).status, 401);
  await completeGoogleLogin(app.request);
  assert.equal((await app.request('/auth/google?reconnect=abc')).status, 400);
  assert.equal((await app.request('/auth/google?reconnect=6')).status, 403);
});

test('เชื่อม Gmail ใหม่แต่เลือกบัญชี Google อื่น: ไม่บันทึกอะไร ผู้ใช้ใน session ไม่เปลี่ยน', async (t) => {
  const app = await openTestApp(7);
  t.after(app.close);
  await completeGoogleLogin(app.request);

  app.google.email = 'someone-else@example.com';
  const before = app.calls.length;
  const callback = await completeGoogleLogin(app.request, '/auth/google?reconnect=5');
  assert.equal(callback.headers.get('location'), '/accounts?gmail=wrong_account');
  const after = app.calls.slice(before);
  assert.equal(after.some(isMailboxWrite), false);
  assert.equal(after.some(({ sql }) => sql.includes('insert into')), false);
  assert.equal(await app.sessionUserId(), 7);
});

test('ต่อกล่องเพิ่ม (?add=1) โดยไม่ติ๊ก gmail.readonly: ไม่บันทึกกล่อง', async (t) => {
  const app = await openTestApp(7);
  t.after(app.close);
  await completeGoogleLogin(app.request);

  app.google.scope = NO_GMAIL_SCOPE;
  const before = app.calls.length;
  const callback = await completeGoogleLogin(app.request, '/auth/google?add=1');
  assert.equal(callback.headers.get('location'), '/accounts?gmail=not_granted');
  assert.equal(app.calls.slice(before).some(isMailboxWrite), false);
  assert.equal(await app.sessionUserId(), 7);
});

test('ผู้ใช้ที่ถูกปฏิเสธล็อกอินใหม่/ต่อกล่องเพิ่ม: ไม่เก็บ refresh token และถอน token ที่ Google — pending ยังเก็บตามเดิม', async (t) => {
  const pending = await openTestApp(7, 'member@example.com', 'pending');
  t.after(pending.close);
  await completeGoogleLogin(pending.request);
  assert.ok(pending.calls.some(isMailboxWrite), 'pending ต้องเก็บ token ไว้ใช้หลังอนุมัติ');
  assert.deepEqual(pending.revoked, []);

  const app = await openTestApp(7, 'member@example.com', 'rejected');
  t.after(app.close);
  const callback = await completeGoogleLogin(app.request);
  assert.equal(callback.headers.get('location'), '/');
  assert.equal(app.calls.some(isMailboxWrite), false);
  assert.deepEqual(app.revoked, ['refresh-token']);
  assert.equal(await app.sessionUserId(), 7, 'ยังตั้ง session ให้เว็บแสดงหน้าถูกปฏิเสธ');
  const loginAudit = app.calls.find(({ sql }) => sql.includes('insert into audit_log'));
  assert.equal(JSON.parse(String(loginAudit?.params[5])).gmail_connected, false);

  // แอดมินปฏิเสธไม่ได้ทำลาย session — ?add=1 ก็ต้องไม่เก็บ
  const added = await completeGoogleLogin(app.request, '/auth/google?add=1');
  assert.equal(added.headers.get('location'), '/');
  assert.equal(app.calls.some(isMailboxWrite), false);
  assert.equal(app.revoked.length, 2);
});
