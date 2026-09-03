import type { Pool, PoolClient } from 'pg';

type Queryable = Pick<Pool | PoolClient, 'query'>;

// ponytail: threshold คงที่ (±1 วัน, confidence 0.8) ไม่ทำ scoring ตาม description/counterparty —
// เป็นแค่ suggestion ให้ user ยืนยันเอง (ไม่ auto-confirm) ถ้าต้องแม่นขึ้นค่อยเพิ่ม weight ทีหลัง
//
// หา candidate คู่โอนภายใน: debit/credit คนละ bank_account แต่ user เดียวกัน, ยอดเท่ากัน,
// วันที่ห่างกันไม่เกิน 1 วัน, ยังไม่มีคู่ไหน confirmed อยู่แล้ว และยังไม่เคย suggest คู่นี้มาก่อน
// (กันไม่ให้ insert แถว suggested ซ้ำเวลาเรียกซ้ำ — DB เองบังคับแค่ confirmed ไม่ซ้ำผ่าน partial unique index)
export async function suggestTransferMatches(db: Queryable, userId: number): Promise<number> {
  const { rows } = await db.query<{ debit_txn_id: number; credit_txn_id: number }>(
    `select d.id as debit_txn_id, c.id as credit_txn_id
     from txn d
     join bank_account da on da.id = d.bank_account_id
     join txn c on c.direction = 'credit'
       and c.amount_satang = d.amount_satang
       and abs(c.txn_date - d.txn_date) <= 1
     join bank_account ca on ca.id = c.bank_account_id
     where d.direction = 'debit'
       and da.user_id = $1
       and ca.user_id = da.user_id
       and ca.id <> da.id
       and not exists (
         select 1 from transfer_match tm
         where tm.status = 'confirmed'
           and (tm.debit_txn_id in (d.id, c.id) or tm.credit_txn_id in (d.id, c.id))
       )
       and not exists (
         select 1 from transfer_match tm2
         where tm2.debit_txn_id = d.id and tm2.credit_txn_id = c.id
       )`,
    [userId],
  );

  for (const r of rows) {
    await db.query(
      `insert into transfer_match (user_id, debit_txn_id, credit_txn_id, status, matched_by, confidence)
       values ($1, $2, $3, 'suggested', 'system', 0.8)`,
      [userId, r.debit_txn_id, r.credit_txn_id],
    );
  }
  return rows.length;
}
