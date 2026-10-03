import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import connectPgSimple from 'connect-pg-simple';
import express from 'express';
import session from 'express-session';
import { api } from './api.js';
import { authRouter } from './auth.js';
import { pool } from './db.js';
import { env } from './env.js';
import { errorHandler, useSecurityHeaders } from './http.js';
import { migrate } from './migrate.js';
import { startWorker } from './worker.js';

const WEB_DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');

const applied = await migrate();
if (applied.length) console.log(`migration: ${applied.join(', ')}`);

const app = express();
app.set('trust proxy', 1); // อยู่หลัง Caddy — ต้องเชื่อ X-Forwarded-* ไม่งั้น secure cookie ไม่ทำงาน
useSecurityHeaders(app);
// เอกสารภาษีมาเป็น base64 ใน JSON (ไม่เพิ่ม multipart dependency) ต้องมีเพดานใหญ่กว่า 100kb ทั่วไป
// ต้อง mount ก่อน express.json({limit:'100kb'}) เสมอ — body-parser ข้ามเมื่อ req._body ถูกตั้งแล้ว mount ไว้ทีหลังไม่มีผล
app.use('/api/tax-documents', express.json({ limit: '15mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(
  session({
    store: new (connectPgSimple(session))({ pool, createTableIfMissing: true }),
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProd,
      maxAge: 30 * 24 * 3600_000,
    },
  }),
);

app.use('/auth', authRouter);
app.use('/api', api);

// /api ที่ไม่มีจริงต้องได้ 404 ไม่ใช่ index.html — ไม่งั้น fetch ที่พิมพ์ path ผิดจะพังเป็น JSON parse error
app.use('/api', (_req, res) => res.status(404).json({ error: 'ไม่พบ endpoint' }));

app.use(express.static(WEB_DIST));
app.get('*', (_req, res) => res.sendFile(join(WEB_DIST, 'index.html')));

app.use(errorHandler);

app.listen(env.port, () => console.log(`family-ledger ฟังอยู่ที่ :${env.port}`));
startWorker();
