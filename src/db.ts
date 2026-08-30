import pg from 'pg';
import { env } from './env.js';

// pg คืน BIGINT เป็น string กันเลขล้น — ยอดเงินเราเป็นสตางค์ ไกลจาก 2^53 มาก
// ponytail: เพดานคือ ~90 ล้านล้านบาท ถ้าวันไหนถึง ค่อยเปลี่ยนไปใช้ BigInt ทั้งเส้น
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

/** ทุกอย่างในนี้ commit พร้อมกันหรือไม่ commit เลย — import statement ต้องใช้ */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}
