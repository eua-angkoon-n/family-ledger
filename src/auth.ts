import { randomBytes } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { encrypt } from './crypto.js';
import { query } from './db.js';
import { env } from './env.js';
import { audit } from './services/audit.js';

// gmail.readonly เท่านั้น — ห้ามเติม scope `drive` ลงในไคลเอนต์ตัวนี้เด็ดขาด
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const SCOPES = ['openid', 'email', 'profile', GMAIL_SCOPE];

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    oauthState?: string;
    addMailbox?: boolean;
    reconnectMailboxId?: number;
  }
}

export type User = {
  id: number;
  email: string;
  display_name: string;
  is_admin: boolean;
  status: 'pending' | 'approved' | 'rejected';
};

export async function loadUser(req: Request): Promise<User | null> {
  if (!req.session.userId) return null;
  const { rows } = await query<User>(
    'select id, email, display_name, is_admin, status from app_user where id = $1',
    [req.session.userId],
  );
  return rows[0] ?? null;
}

/** approved เท่านั้นถึงจะแตะข้อมูลได้ — pending/rejected ผ่านด่านนี้ไม่ได้ */
export function requireUser(handler: (req: Request, res: Response, user: User) => Promise<void>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await loadUser(req);
      if (!user) return void res.status(401).json({ error: 'ยังไม่ได้เข้าสู่ระบบ' });
      if (user.status !== 'approved') return void res.status(403).json({ error: 'บัญชียังไม่ได้รับอนุมัติ' });
      await handler(req, res, user);
    } catch (e) {
      next(e);
    }
  };
}

export function requireAdmin(handler: (req: Request, res: Response, user: User) => Promise<void>) {
  return requireUser(async (req, res, user) => {
    if (!user.is_admin) return void res.status(403).json({ error: 'ต้องเป็นแอดมิน' });
    await handler(req, res, user);
  });
}

/** ต่อ Google ที่ปลายทาง revoke จริง ๆ ไม่ใช่แค่ลบแถวในตารางเรา */
export async function revokeAtGoogle(refreshToken: string, doFetch: typeof fetch = fetch): Promise<void> {
  const res = await doFetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
  });
  // Google ตอบ 400 เมื่อ token หมดอายุ/ถูกยกเลิกไปแล้ว — ผลเท่ากับยกเลิกสำเร็จ จึงไม่ throw แต่ลง log ให้ตามได้
  if (!res.ok) console.warn(`[auth] Google revoke ตอบ ${res.status}`);
}

/**
 * ความพยายามเข้าระบบที่ **ล้มเหลว** ลง stdout เท่านั้น ไม่เข้า `audit_log`
 * เพราะ `audit_log.user_id` เป็น `not null references app_user(id)` — เหตุการณ์ที่ยังไม่มีเจ้าของ
 * (rate limit, state ไม่ตรง, ไม่มี code) เขียนลงตารางนั้นไม่ได้เลยโดยโครงสร้าง และการทำให้ nullable
 * จะเปิดทางให้คนนอกยิงจนตารางบวมได้ Docker เก็บ stdout ให้แล้ว (`docker compose logs app`)
 */
function logAuthFailure(reason: string, req: Request): void {
  console.warn(`auth ล้มเหลว: ${reason} ip=${req.ip ?? 'unknown'}`);
}

type Hits = Map<string, { n: number; resetAt: number }>;

type AuthDependencies = {
  query: typeof query;
  encrypt: typeof encrypt;
  env: Pick<typeof env, 'googleClientId' | 'googleClientSecret' | 'baseUrl' | 'adminEmail'>;
  fetch: typeof fetch;
  /** เทสต์ฉีดเข้ามาเพื่อดูว่ารายการหมดอายุถูกกวาดทิ้ง — ปกติ router สร้าง map ของตัวเอง */
  limits?: { fails: Hits; starts: Hits };
};

const defaultAuthDependencies: AuthDependencies = { query, encrypt, env, fetch };

export function createAuthRouter({
  query,
  encrypt,
  env,
  fetch,
  limits: { fails, starts } = { fails: new Map(), starts: new Map() },
}: AuthDependencies = defaultAuthDependencies): Router {
  const authRouter = Router();
  // ponytail: rate limit ในหน่วยความจำ (fixed window 15 นาที/IP) พอสำหรับ instance เดียว ถ้าสเกลค่อยย้ายไปตาราง/redis
  // อยู่ในตัว router (prod มีตัวเดียว) — เทสต์ที่สร้าง router ใหม่ต่อเคสจึงไม่ชนเพดานของกันและกัน
  // ponytail: key ด้วย req.ip ตรง ๆ — IPv6 หมุนที่อยู่ภายใน /64 ของตัวเองหนีทั้งสองถังได้ ถ้าเจอจริงค่อย key ด้วย prefix /64
  // สองถัง: ล็อกอินสำเร็จไม่กินโควตาความล้มเหลว คนในบ้านที่ออก Wi-Fi เดียวกัน (IP เดียว) จึงไม่ล็อกกันเอง
  // - fails: callback ที่ state ไม่ตรง จาก session ที่เริ่ม OAuth ค้างไว้จริง ครบ 10 → ปิดการเริ่มใหม่ (ดูเงื่อนไขที่ callback)
  //   ความล้มหลังผ่าน state แล้ว (ผู้ใช้กดยกเลิก/Google ตอบ error, ไม่มี code, แลก token/userinfo ล้ม) ไม่นับ —
  //   ไปถึงได้ด้วย state ที่ใช้ได้ครั้งเดียวเท่านั้น (ถัง starts คุมอยู่แล้ว) และการกดยกเลิก/Google ล่มต้องไม่ล็อกทั้งบ้าน
  // - starts: ทุกการเริ่ม /auth/google เพดาน 60 — แต่ละครั้งเขียนแถว session ใหม่ลง DB (oauthState) ถังนี้กันสคริปต์ยิงรัว
  //   คนจริง session อยู่ 30 วัน ทั้งบ้านไม่น่าเริ่มเกินหลักหน่วยต่อ 15 นาที
  function hit(bucket: Hits, ip: string): number {
    const now = Date.now();
    // กวาดรายการหมดอายุทิ้ง ไม่งั้นทุก IP ที่เคยมาค้างใน map ตลอดอายุ process — Map วนตามลำดับที่ใส่และทุกตัวมีหน้าต่าง
    // ยาวเท่ากัน หัว map จึงหมดอายุก่อนเสมอ: ลบจากหัวจนเจอตัวที่ยังไม่หมด (แต่ละตัวถูกลบครั้งเดียว ไม่สแกนทั้ง map ทุกครั้ง)
    for (const [k, e] of bucket) {
      if (now <= e.resetAt) break;
      bucket.delete(k);
    }
    let e = bucket.get(ip);
    if (!e || now > e.resetAt) {
      bucket.delete(ip); // เริ่มหน้าต่างใหม่ต้องย้ายไปท้าย map — set ทับ key เดิมไม่เปลี่ยนลำดับ
      bucket.set(ip, (e = { n: 0, resetAt: now + 15 * 60_000 }));
    }
    return ++e.n;
  }
  function failCount(ip: string): number {
    const e = fails.get(ip);
    return e && Date.now() <= e.resetAt ? e.n : 0;
  }
  // ห้ามทิ้งผู้ใช้ไว้ที่หน้าข้อความดิบ — กลับเข้าแอปพร้อม code ให้เว็บแสดงข้อความ
  // เชื่อมกล่องเมล (ล็อกอินอยู่แล้ว) กลับหน้าบัญชี นอกนั้นกลับหน้าเข้าสู่ระบบ
  const backToApp = (res: Response, mailbox: boolean, code: 'rate_limited' | 'expired' | 'failed') =>
    res.redirect(mailbox ? `/accounts?gmail=${code}` : `/?auth_error=${code}`);
  // audit ใช้ `query` ตัวที่ฉีดเข้ามา ไม่ใช่ pool ตรง ๆ — เทสต์ที่ปลอม query อยู่แล้วจะไม่แตะ DB จริง
  const auditable = { query: (text: string, params?: unknown[]) => query(text, params ?? []) };
  const saveEmailAccount = (userId: number, email: string, refreshTokenEnc: string) => query(
    `insert into email_account (user_id, email, refresh_token_enc) values ($1, $2, $3)
     on conflict (user_id, email) do update set refresh_token_enc = excluded.refresh_token_enc, reauth_required_at = null`,
    [userId, email, refreshTokenEnc],
  );

authRouter.get('/google', async (req, res) => {
  const mailbox = req.session.userId != null && (req.query.add === '1' || req.query.reconnect !== undefined);
  try {
    const ip = req.ip ?? 'unknown';
    if (failCount(ip) >= 10 || hit(starts, ip) > 60) {
      logAuthFailure('ยิงถี่เกินเพดาน (ล้มเหลว 10 หรือเริ่ม 60 ครั้ง/15 นาที)', req);
      return void backToApp(res, mailbox, 'rate_limited');
    }
    // ?reconnect=<email_account_id> = เชื่อม Gmail ใหม่ให้กล่องเดิมของผู้ใช้ที่ล็อกอินอยู่ (Google ปฏิเสธ refresh token เดิม)
    // ลิงก์ผิด/กล่องของคนอื่นกลับแอปพร้อม code — ต้องไม่ตกไปทางล็อกอินปกติแบบเงียบ ๆ
    let reconnectMailboxId: number | undefined;
    let loginHint: string | undefined;
    if (req.query.reconnect !== undefined) {
      const mailboxId = Number(req.query.reconnect);
      if (!Number.isInteger(mailboxId) || mailboxId <= 0) return void backToApp(res, mailbox, 'failed');
      if (!req.session.userId) return void backToApp(res, false, 'expired');
      const found = await query<{ email: string }>(
        'select email from email_account where id = $1 and user_id = $2',
        [mailboxId, req.session.userId],
      );
      loginHint = found.rows[0]?.email;
      if (!loginHint) return void backToApp(res, true, 'failed');
      reconnectMailboxId = mailboxId;
    }
    req.session.oauthState = randomBytes(16).toString('hex');
    // ?add=1 = ผู้ใช้ที่ล็อกอินอยู่แล้วต่อกล่องอีเมลใบที่ 2 (requirement 1.1) ไม่ใช่การสมัครใหม่
    req.session.addMailbox = req.query.add === '1';
    req.session.reconnectMailboxId = reconnectMailboxId;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: env.googleClientId,
      redirect_uri: `${env.baseUrl}/auth/google/callback`,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      // consent = ได้ refresh_token ทุกครั้ง ไม่ใช่เฉพาะครั้งแรก · select_account = ให้เลือก/สลับบัญชี Google ได้ทุกครั้ง
      prompt: 'consent select_account',
      state: req.session.oauthState,
      ...(loginHint ? { login_hint: loginHint } : {}),
    }).toString();
    res.redirect(url.toString());
  } catch (e) {
    console.error('เริ่ม OAuth ไม่สำเร็จ', e);
    backToApp(res, mailbox, 'failed');
  }
});

authRouter.get('/google/callback', async (req, res) => {
  // ต่อกล่องเพิ่ม/เชื่อมกล่องเดิมใหม่ได้เฉพาะตอนล็อกอินอยู่แล้ว — ไม่งั้นตกไปทางสมัครปกติ
  // อ่านก่อนเช็ค state เพื่อให้การเชื่อมกล่องที่ล้มกลับหน้าบัญชี ไม่ใช่หน้าเข้าสู่ระบบ
  const reconnectMailboxId = req.session.reconnectMailboxId;
  const mailboxUserId = req.session.addMailbox === true || reconnectMailboxId != null ? req.session.userId : undefined;
  try {
    const { code, state, error } = req.query;
    if (!req.session.oauthState || state !== req.session.oauthState) {
      logAuthFailure('state ไม่ตรงกับที่ออกให้', req);
      // โควตาเป็นของทั้ง IP (ทั้งบ้าน) — นับเฉพาะ session ที่เริ่ม OAuth ค้างไว้จริง (มี oauthState) ไม่งั้นคนนอกล็อกบ้านได้:
      // session ที่มี oauthState เกิดได้จากการเปิด /auth/google เท่านั้น และ cookie เป็น SameSite=Lax ซึ่งเบราว์เซอร์ไม่แนบไปกับ
      // <img>/fetch ข้ามไซต์ (แนบเฉพาะ top-level GET navigation) — หน้าเว็บอื่นที่ยิง callback จากเบราว์เซอร์ของคนในบ้าน
      // จึงได้ session ว่าง ไม่นับ · กด Back กลับมา callback เก่า: state ถูกใช้ไปแล้ว/ล็อกอินแล้ว session ถูก regenerate
      // ไม่มี oauthState ไม่นับ (session ของคนที่ล็อกอินอยู่ก็ไม่มี) · จะให้นับได้ต้องพาเบราว์เซอร์ไปเริ่ม /auth/google แบบ top-level ก่อน ซึ่งผู้ใช้เห็น
      if (req.session.oauthState) hit(fails, req.ip ?? 'unknown');
      return void backToApp(res, mailboxUserId != null, 'expired');
    }
    req.session.oauthState = undefined;
    req.session.addMailbox = undefined;
    req.session.reconnectMailboxId = undefined;
    // ผู้ใช้กดยกเลิก/ไม่อนุญาตในหน้าของ Google — Google ส่ง ?error= กลับมาแทน code
    if (error !== undefined) {
      logAuthFailure(`Google ตอบ error=${JSON.stringify(error).slice(0, 100)}`, req);
      if (mailboxUserId != null) return void res.redirect('/accounts?gmail=denied');
      return void res.redirect(error === 'access_denied' ? '/?auth_error=access_denied' : '/?auth_error=failed');
    }
    if (typeof code !== 'string') {
      logAuthFailure('callback ไม่มี code', req);
      return void backToApp(res, mailboxUserId != null, 'failed');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: `${env.baseUrl}/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    // ต้อง log body ของ Google ด้วย — code failed ที่ผู้ใช้เห็นไม่บอกว่า invalid_client,
    // redirect_uri_mismatch หรือ code หมดอายุ ซึ่งเป็นสามอย่างที่ต้องรู้เพื่อแก้ (body ไม่มี secret)
    if (!tokenRes.ok) {
      console.error('token exchange ล้มเหลว', tokenRes.status, await tokenRes.text());
      return void backToApp(res, mailboxUserId != null, 'failed');
    }
    const token = (await tokenRes.json()) as { access_token: string; refresh_token?: string; scope?: string };
    // หน้า consent ให้เอาติ๊กอ่านอีเมลออกได้ — Google ยังออก token ให้ แต่ scope ไม่มี gmail.readonly
    const hasGmail = (token.scope ?? '').split(' ').includes(GMAIL_SCOPE);

    // ถาม userinfo แทนการถอด id_token เอง — ไม่ต้องตรวจลายเซ็น JWT เองให้พลาด
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    if (!infoRes.ok) {
      console.error('userinfo ล้มเหลว', infoRes.status, await infoRes.text());
      return void backToApp(res, mailboxUserId != null, 'failed');
    }
    const info = (await infoRes.json()) as { sub: string; email: string; name?: string };
    // ผู้ใช้ที่ถูกปฏิเสธล็อกอินซ้ำได้ token สด (แอดมิน revoke ไปแล้วแค่ชุดเก่า) — ห้ามเก็บ และถอนที่ Google ทิ้ง
    // ponytail: revoke ทั้งไคลเอนต์+บัญชี Google — ถ้ากล่องเดียวกันผูกกับผู้ใช้อื่นที่ approved อยู่ อีกคนต้องเชื่อมใหม่ (คลาสเดียวกับตอนแอดมินปฏิเสธ)
    const discardToken = () =>
      revokeAtGoogle(token.refresh_token ?? token.access_token, fetch)
        .catch((e: unknown) => console.error('revoke token ของผู้ใช้ที่ถูกปฏิเสธไม่สำเร็จ', e));

    // ต่อกล่องเพิ่ม/เชื่อมใหม่: ผูกเข้ากับผู้ใช้ใน session ไม่ใช่หา app_user จาก google_sub และไม่เปลี่ยนผู้ใช้ใน session
    // (ยืนยันความเป็นเจ้าของกล่องด้วยการผ่าน OAuth ของกล่องนั้นแล้ว)
    // ponytail: กล่องเดียวกันผูกได้หลาย app_user (unique เป็น (user_id, email))
    // Google revoke ทีเดียวทั้งไคลเอนต์+ผู้ใช้ → reject คนหนึ่งจะตัดสิทธิ์อีกคนที่แชร์กล่องนั้นไปด้วย
    // รับได้ในสเกลครอบครัว ถ้าเจอปัญหาจริงค่อยแยกเป็น many-to-many
    if (mailboxUserId != null) {
      // แอดมินปฏิเสธไม่ได้ทำลาย session — คนที่ถูกปฏิเสธยังยิง ?add=1 ได้
      const owner = await query<{ status: string }>('select status from app_user where id = $1', [mailboxUserId]);
      if (owner.rows[0]?.status === 'rejected') {
        await discardToken();
        return void res.redirect('/');
      }
      let mailboxEmail = info.email;
      if (reconnectMailboxId != null) {
        const mailbox = await query<{ email: string }>(
          'select email from email_account where id = $1 and user_id = $2',
          [reconnectMailboxId, mailboxUserId],
        );
        const saved = mailbox.rows[0]?.email;
        // เลือกบัญชี Google ผิดตัว (หรือกล่องถูกลบไประหว่างทาง) → ไม่บันทึกอะไรเลย ห้ามเอา token ของอีกบัญชีไปทับ
        // เช็คก่อน scope เพราะบอกให้ "ติ๊กอนุญาต" กับบัญชีที่ผิดอยู่แล้วไม่ช่วยอะไร
        if (!saved || saved.toLowerCase() !== info.email.toLowerCase()) {
          logAuthFailure(`เชื่อม Gmail ใหม่ด้วยบัญชี Google ที่ไม่ตรงกับกล่อง ${reconnectMailboxId}`, req);
          return void res.redirect('/accounts?gmail=wrong_account');
        }
        mailboxEmail = saved; // ใช้ตัวพิมพ์ตามแถวเดิม ไม่งั้น upsert ได้แถวใหม่แทนการทับแถวที่ต้องเชื่อมใหม่
      }
      if (!hasGmail) return void res.redirect('/accounts?gmail=not_granted');
      if (!token.refresh_token) return void res.redirect('/accounts?gmail=no_refresh_token');
      await saveEmailAccount(mailboxUserId, mailboxEmail, encrypt(token.refresh_token));
      // เก็บแค่อีเมล/ชื่อ — ห้ามใส่ token หรือ refresh_token_enc ลง audit_log เด็ดขาด
      await audit(auditable, {
        userId: mailboxUserId,
        action: reconnectMailboxId != null ? 'auth.mailbox_reconnect' : 'auth.mailbox_add',
        entityType: 'app_user',
        entityId: mailboxUserId,
        after: { email: mailboxEmail, display_name: info.name ?? '', gmail_connected: true },
        ip: req.ip ?? null,
      });
      return void res.redirect('/accounts?gmail=connected');
    }

    const existing = await query<{ id: number; status: User['status'] }>('select id, status from app_user where google_sub = $1', [info.sub]);
    let userId = existing.rows[0]?.id;
    // pending ยังเก็บ token ตามเดิม (ต้องใช้หลังอนุมัติ — worker ไม่ดึงจนกว่าจะ approved)
    const rejected = existing.rows[0]?.status === 'rejected';

    // ผู้ใช้ใหม่สร้างทันทีที่นี่ ไม่มีขั้นกรอกรหัสเชิญคั่น — ด่านจริงคือ requireUser ที่ปล่อยเฉพาะ
    // approved: ADMIN_EMAIL ได้ approved อัตโนมัติ คนอื่นเป็น pending จนแอดมินกดอนุมัติ
    const isNewUser = !userId;
    if (!userId) {
      const isAdmin = info.email.toLowerCase() === env.adminEmail;
      const created = await query<{ id: number }>(
        `insert into app_user (google_sub, email, display_name, is_admin, status)
         values ($1, $2, $3, $4, $5) returning id`,
        [info.sub, info.email, info.name ?? '', isAdmin, isAdmin ? 'approved' : 'pending'],
      );
      userId = created.rows[0]!.id;
    }

    // ล็อกอินโดยไม่ติ๊กอ่านอีเมลยังเข้าระบบได้ แต่ห้ามบันทึก/เขียนทับ refresh token ด้วย token ที่อ่านเมลไม่ได้
    const gmailConnected = !rejected && hasGmail && token.refresh_token != null;
    if (gmailConnected) {
      await saveEmailAccount(userId, info.email, encrypt(token.refresh_token!));
    }
    if (rejected) await discardToken();

    // session id ใหม่ทุกครั้งที่ล็อกอิน (store ลบแถวเดิม) — กัน session fixation: sid ที่ถูกฝังไว้ก่อนล็อกอินใช้ต่อไม่ได้
    // ไม่มีค่าอื่นต้องพกข้าม — oauthState/addMailbox/reconnectMailboxId ล้างไปแล้วข้างบน
    // ลำดับ regenerate → audit → userId: regenerate ล้ม = ไม่มีบันทึกว่าล็อกอินทั้งที่ไม่สำเร็จ
    // audit ล้ม = session ใหม่ยังไม่มี userId (ไม่ได้ล็อกอิน) ไม่มีทางเข้าระบบได้โดยไม่มีร่องรอย
    await new Promise<void>((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));

    // เก็บแค่อีเมล/ชื่อ — ห้ามใส่ token หรือ refresh_token_enc ลง audit_log เด็ดขาด
    // (คลาสเดียวกับบั๊ก pdf_password_enc รั่วเข้า before_data ที่เจอใน Slice 8)
    await audit(auditable, {
      userId,
      action: isNewUser ? 'auth.signup' : 'auth.login',
      entityType: 'app_user',
      entityId: userId,
      after: { email: info.email, display_name: info.name ?? '', gmail_connected: gmailConnected },
      ip: req.ip ?? null,
    });
    req.session.userId = userId;
    res.redirect(hasGmail ? '/' : '/?gmail=not_granted');
  } catch (e) {
    console.error('OAuth callback ล้มเหลว', e);
    backToApp(res, mailboxUserId != null, 'failed');
  }
});

authRouter.post('/logout', async (req, res) => {
  const userId = req.session.userId; // ต้องอ่านก่อน destroy ไม่งั้นไม่รู้ว่าใครออก
  if (userId) {
    // audit ล้มห้ามกันคนออกจากระบบ — ปล่อยให้ session ถูกทำลายเสมอ แล้ว log ความล้มลง stdout
    await audit(auditable, { userId, action: 'auth.logout', entityType: 'app_user', entityId: userId, ip: req.ip ?? null })
      .catch((e: unknown) => console.error('เขียน audit ตอน logout ไม่สำเร็จ', e));
  }
  req.session.destroy(() => res.json({ ok: true }));
});

  return authRouter;
}

export const authRouter = createAuthRouter();
