import { realpathSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './db.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const LOCK_ID = 8317_2026; // ตัวเลขอะไรก็ได้ ขอแค่คงที่ทั้งระบบ

export interface MigrateOptions {
  /** จำกัดให้รันเฉพาะไฟล์ที่ชื่อ (ตามลำดับ sort) <= ค่านี้ — ใช้ทดสอบ roll-forward แบบมีข้อมูลเดิม */
  upTo?: string;
}

export async function migrate(options: MigrateOptions = {}): Promise<string[]> {
  const c = await pool.connect();
  try {
    // instance หลายตัวบูตพร้อมกันได้ ตัวที่สองจะรอแล้วเห็นว่าไม่เหลืออะไรให้รัน
    await c.query('select pg_advisory_lock($1)', [LOCK_ID]);
    await c.query(`create table if not exists schema_migration (
      filename text primary key,
      applied_at timestamptz not null default now()
    )`);

    const done = new Set(
      (await c.query<{ filename: string }>('select filename from schema_migration')).rows.map((r) => r.filename),
    );
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .filter((f) => !options.upTo || f <= options.upTo)
      .sort();
    const applied: string[] = [];

    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await readFile(join(MIGRATIONS_DIR, f), 'utf8');
      // ไฟล์เดียว = ธุรกรรมเดียว migration ที่พังกลางทางต้องไม่ทิ้ง schema ค้าง
      await c.query('begin');
      try {
        await c.query(sql);
        await c.query('insert into schema_migration (filename) values ($1)', [f]);
        await c.query('commit');
      } catch (e) {
        await c.query('rollback');
        throw new Error(`migration ${f} ล้มเหลว: ${(e as Error).message}`);
      }
      applied.push(f);
    }
    return applied;
  } finally {
    await c.query('select pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    c.release();
  }
}

// รันตรง ๆ (`npm run migrate`) เท่านั้น — ตอน server.ts import เข้าไปจะไม่เข้าบล็อกนี้
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const applied = await migrate();
  console.log(applied.length ? `รันแล้ว: ${applied.join(', ')}` : 'ไม่มี migration ใหม่');
  await pool.end();
}
