import type { Pool } from 'pg';

// รับเฉพาะ Pool ไม่ใช่ Queryable แบบ service อื่น — ฟังก์ชันนี้กลืน 23505 ต่อแถวแล้วไปต่อ ซึ่งถูกต้อง
// เฉพาะเมื่อแต่ละ update เป็น transaction ของตัวเอง ถ้าถูกเรียกด้วย PoolClient ที่อยู่ใน tx()
// error แรกจะ abort ทั้ง transaction แล้ว query ที่เหลือพังด้วย 25P02 เงียบ ๆ
type PoolLike = Pick<Pool, 'query'>;

type Candidate = { payment_id: number; txn_id: number; candidate_count: number };

// ponytail: ไม่ทำ confidence scoring จาก description/counterparty (§9.5 เกณฑ์ข้อ 6) — txn.counterparty
// เป็น NULL ตลอด (worker ไม่เคยเขียนคอลัมน์นี้) และ §7.2 ไม่มีคอลัมน์ confidence บน monthly_item_payment
// ให้เก็บผลด้วย auto-match จึงยึดครึ่งที่บังคับได้จริง: มี candidate เดียวเท่านั้นถึงจับให้
// ถ้าวันไหน counterparty มีค่าจริง ค่อยเพิ่ม scoring + คอลัมน์ confidence ทีหลัง
//
// จับคู่ Payment Declaration กับ txn จริงตามเกณฑ์ §9.5:
//   1. บัญชีเดียวกัน  2. ทิศทางตาม kind ของรายการ  3. ยอดตรงกัน  4. วันที่ห่างไม่เกิน 3 วัน
//   5. txn ยังไม่ถูกผูกกับ payment อื่นที่ matched
// ข้อ 2 สเปกเขียนว่า "เป็น Debit" เพราะคิดถึงบิล — รายการ kind='income' ต้องจับ credit ไม่ใช่ debit
// จึงขยายเป็น CASE ตาม kind (การขยายที่ตั้งใจ บันทึกไว้ในแผน Slice 5)
//
// ไม่ดู monthly_plan.status: statement ที่มาช้าจับคู่เข้าเดือนที่ปิดแล้วได้ ไม่นับเป็นการแก้เดือน
// เพราะไม่เปลี่ยนตัวเลขตามแผนเลย (ห้ามเฉพาะการแก้ของผู้ใช้ — คุมที่ loadOwnedItem requireOpen)
export async function reconcilePayments(db: PoolLike, userId: number): Promise<number> {
  const { rows } = await db.query<Candidate>(
    `select p.id as payment_id, t.id as txn_id, count(*) over (partition by p.id)::int as candidate_count
     from monthly_item_payment p
     join monthly_plan_item i on i.id = p.monthly_plan_item_id
     join monthly_plan mp on mp.id = i.monthly_plan_id
     -- ด่านที่สอง: join bank_account.user_id ซ้ำ ไม่พึ่ง mp.user_id คอลัมน์เดียว (§6.1 — ดู routes/transfer-matches.ts)
     join bank_account a on a.id = p.bank_account_id and a.user_id = mp.user_id
     join txn t on t.bank_account_id = p.bank_account_id
       and t.direction = case when i.kind = 'income' then 'credit' else 'debit' end
       and t.amount_satang = p.amount_satang
       and abs(t.txn_date - p.paid_date) <= 3
     where mp.user_id = $1
       and p.status = 'declared'
       -- รายการที่ผู้ใช้ skip/cancel ไปแล้วต้องไม่ดูด txn จริงไปจอง ไม่งั้น payment ที่ถูกต้อง
       -- ของรายการอื่นจับ txn ตัวนั้นไม่ได้อีกเลย (partial unique index กันไว้)
       and i.explicit_status = 'active'
       and not exists (
         select 1 from monthly_item_payment p2
         where p2.txn_id = t.id and p2.status = 'matched'
       )
     order by p.id, abs(t.txn_date - p.paid_date), t.id`,
    [userId],
  );

  let matched = 0;
  const seen = new Set<number>();
  for (const c of rows) {
    if (seen.has(c.payment_id)) continue;
    seen.add(c.payment_id);

    // candidate มากกว่าหนึ่ง = เดาไม่ได้ ส่งให้ผู้ใช้ตัดสิน (§9.5 auto-match เฉพาะ candidate เดียว)
    if (c.candidate_count > 1) {
      await db.query("update monthly_item_payment set status = 'needs_review' where id = $1 and status = 'declared'", [
        c.payment_id,
      ]);
      continue;
    }

    // จ่ายบางส่วนทำให้ 1 รายการมี payment หลายแถว สองแถวที่ยอดและวันเท่ากันจะเห็น txn ตัวเดียวกันว่าว่าง
    // (not exists ประเมินตอน query) แถวที่สองจึงชน monthly_item_payment_txn_matched_uniq — จับ 23505
    // ต่อแถวแล้วไปต่อ ไม่ปล่อยให้ throw ล้ม payment ที่เหลือทั้งรอบ (worker เรียกฟังก์ชันนี้)
    try {
      const res = await db.query(
        `update monthly_item_payment
         set status = 'matched', txn_id = $2, verified_at = now()
         where id = $1 and status = 'declared'`,
        [c.payment_id, c.txn_id],
      );
      matched += res.rowCount ?? 0;
    } catch (e) {
      if ((e as { code?: string }).code !== '23505') throw e;
    }
  }
  return matched;
}
