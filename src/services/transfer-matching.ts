import type { Pool } from 'pg';

type Candidate = {
  debit_txn_id: number;
  credit_txn_id: number;
  debit_candidate_count: number;
  credit_candidate_count: number;
};

export type TransferReconciliation = { confirmed: number; suggested: number };

// คู่ที่ยอดเท่ากัน, ต่างบัญชี, วันห่างไม่เกิน 1 วัน และเป็นตัวเลือกเดียวของทั้งสองขา
// ถือว่าชัดพอให้ยืนยันอัตโนมัติ ส่วนกรณีหลายต่อหนึ่ง/หนึ่งต่อหลายเก็บเป็น suggestion ให้ผู้ใช้เลือกเอง
export async function reconcileTransfers(db: Pool, userId: number): Promise<TransferReconciliation> {
  const client = await db.connect();
  try {
    await client.query('begin');
    // ผู้ใช้คนเดียวอาจ sync หลาย mailbox พร้อมกัน จึง serialize เฉพาะงานจับคู่ของ user นั้น
    await client.query("select pg_advisory_xact_lock(hashtext('transfer-matching'), ($1::bigint % 2147483647)::int)", [
      userId,
    ]);

    const { rows } = await client.query<Candidate>(
      `with candidates as (
         select distinct d.id as debit_txn_id, c.id as credit_txn_id
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
             select 1 from transfer_match rejected
             where rejected.status = 'rejected'
               and rejected.debit_txn_id = d.id and rejected.credit_txn_id = c.id
           )
       )
       select debit_txn_id, credit_txn_id,
              count(*) over (partition by debit_txn_id)::int as debit_candidate_count,
              count(*) over (partition by credit_txn_id)::int as credit_candidate_count
       from candidates`,
      [userId],
    );

    let confirmed = 0;
    let suggested = 0;
    for (const candidate of rows) {
      const params = [userId, candidate.debit_txn_id, candidate.credit_txn_id];
      const unambiguous = candidate.debit_candidate_count === 1 && candidate.credit_candidate_count === 1;
      if (unambiguous) {
        const promoted = await client.query(
          `update transfer_match set status = 'confirmed', matched_by = 'system', confidence = 1
           where user_id = $1 and debit_txn_id = $2 and credit_txn_id = $3 and status = 'suggested'
           returning id`,
          params,
        );
        if (!promoted.rowCount) {
          await client.query(
            `insert into transfer_match (user_id, debit_txn_id, credit_txn_id, status, matched_by, confidence)
             values ($1, $2, $3, 'confirmed', 'system', 1)`,
            params,
          );
        }
        const flipped = await client.query(
          `update txn t set is_internal_transfer = true
           from bank_account a
           where a.id = t.bank_account_id and a.user_id = $1 and t.id in ($2, $3)`,
          params,
        );
        if (flipped.rowCount !== 2) throw new Error('จับคู่ธุรกรรมที่ไม่ได้เป็นของผู้ใช้');
        confirmed++;
      } else {
        const inserted = await client.query(
          `insert into transfer_match (user_id, debit_txn_id, credit_txn_id, status, matched_by, confidence)
           select $1, $2, $3, 'suggested', 'system', 0.8
           where not exists (
             select 1 from transfer_match
             where user_id = $1 and debit_txn_id = $2 and credit_txn_id = $3
           )`,
          params,
        );
        suggested += inserted.rowCount ?? 0;
      }
    }

    await client.query('commit');
    return { confirmed, suggested };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
