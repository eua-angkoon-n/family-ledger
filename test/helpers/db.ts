// ต่อ Postgres จริงสำหรับ test ที่ fake query() พิสูจน์ไม่ได้ (authorization ข้าม user, migration roll-forward)
//
// จำกัดสำคัญ: เรียก createTestDb() ได้ครั้งเดียวต่อไฟล์ test เท่านั้น ไม่ใช่ต่อ test() ย่อย
// เพราะ src/db.ts สร้าง `pool` ที่ module-load time จาก process.env.DATABASE_URL — เราตั้ง env
// แล้ว dynamic import('../../src/db.js') เพื่อให้ pool ตัวนั้นชี้ไป scratch database ที่สร้างขึ้น
// แต่ ESM cache module ต่อโปรเซส ถ้าเรียกซ้ำในไฟล์เดียวกัน (แม้เปลี่ยน DATABASE_URL ใหม่ก่อน)
// import ครั้งที่สองจะได้ module/pool ตัวเดิมที่ผูกกับ scratch database ตัวแรกอยู่ดี
// (node:test รันแต่ละไฟล์คนละ process จึงไม่ชนกันข้ามไฟล์ — ต้องการ DB แยกกันหลายสถานการณ์ในไฟล์
// เดียว ให้ใช้ pool เดิมแต่ reset ด้วย `drop schema public cascade; create schema public;`)

import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { migrate as MigrateFn } from '../../src/migrate.js';

export const SKIP_REASON =
  'ไม่มี TEST_DATABASE_URL — รัน `docker compose -f docker-compose.test.yml up -d` แล้วตั้ง ' +
  'TEST_DATABASE_URL=postgres://postgres:test@127.0.0.1:5433/postgres ก่อนรัน test นี้';

export type TestDb =
  | { skip: true; reason: string }
  | {
      skip: false;
      pool: pg.Pool;
      migrate: typeof MigrateFn;
      cleanup: () => Promise<void>;
    };

async function connectWithRetry(connectionString: string, attempts = 10): Promise<pg.Client> {
  for (let i = 1; i <= attempts; i++) {
    const client = new pg.Client({ connectionString });
    try {
      await client.connect();
      return client;
    } catch (e) {
      await client.end().catch(() => {});
      if (i === attempts) throw e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error('unreachable');
}

export async function createTestDb(): Promise<TestDb> {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (!baseUrl) return { skip: true, reason: SKIP_REASON };

  const dbName = `test_${randomBytes(4).toString('hex')}`;
  const admin = await connectWithRetry(baseUrl);
  try {
    await admin.query(`create database "${dbName}"`);
  } finally {
    await admin.end();
  }

  const scratchUrl = new URL(baseUrl);
  scratchUrl.pathname = `/${dbName}`;
  process.env.DATABASE_URL = scratchUrl.toString();

  const { pool } = await import('../../src/db.js');
  const { migrate } = await import('../../src/migrate.js');

  const cleanup = async () => {
    await pool.end();
    const admin2 = await connectWithRetry(baseUrl);
    try {
      await admin2.query(`drop database if exists "${dbName}"`);
    } finally {
      await admin2.end();
    }
  };

  return { skip: false, pool, migrate, cleanup };
}
