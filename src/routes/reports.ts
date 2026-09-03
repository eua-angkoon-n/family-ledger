import { Router } from 'express';
import { requireUser } from '../auth.js';
import { query } from '../db.js';
import {
  EXCLUDED_FROM_FLOW_SQL,
  IS_INTERNAL_TRANSFER_SQL,
  OWNED_TXN_FROM,
  accountCoverage,
  parseRange,
} from '../services/report-query.js';

export const reportsRouter = Router();

// ทุกหน้ารายงานต้องระบุชัด (§8.6) — ข้อมูลเงินจริงมาจาก bank statement ที่นำเข้าแล้วเท่านั้น ไม่รวมเงินสด/e-Wallet
const DATA_COVERAGE_NOTE = 'ข้อมูลเงินจริงคำนวณจาก Bank Statement ที่นำเข้าสู่ระบบเท่านั้น ไม่รวมเงินสดและ e-Wallet';

// GET /api/reports/summary?month=YYYY-MM
// หนึ่ง query หลักแบบ CTE (flow/transfers/quality/balance) รวมกับ statement_health และ failed-statement list
// แยกต่างหาก เพราะสองอันหลังเป็น all-time ต่อ user ไม่ผูกกับเดือนที่เลือก
reportsRouter.get('/reports/summary', requireUser(async (req, res, user) => {
  const { from, to } = parseRange(req.query as Record<string, unknown>);

  const { rows } = await query<{
    money_in_satang: number;
    money_out_satang: number;
    net_satang: number;
    internal_transfer_excluded_satang: number;
    internal_transfer_count: number;
    uncategorised_count: number;
    unreviewed_count: number;
    total_balance_satang: number;
  }>(
    `with flow as (
       select
         coalesce(sum(t.amount_satang) filter (where t.direction = 'credit'), 0)::bigint as money_in_satang,
         coalesce(sum(t.amount_satang) filter (where t.direction = 'debit'), 0)::bigint as money_out_satang
       ${OWNED_TXN_FROM}
       where a.user_id = $1 and t.txn_date >= $2 and t.txn_date < $3
         and not (${EXCLUDED_FROM_FLOW_SQL})
     ),
     transfers as (
       select
         coalesce(sum(t.amount_satang), 0)::bigint as internal_transfer_excluded_satang,
         count(*)::int as internal_transfer_count
       ${OWNED_TXN_FROM}
       where a.user_id = $1 and t.txn_date >= $2 and t.txn_date < $3
         and (${IS_INTERNAL_TRANSFER_SQL})
     ),
     quality as (
       select
         count(*) filter (where not exists (select 1 from txn_split s where s.txn_id = t.id)) as uncategorised_count,
         count(*) filter (where coalesce(an.review_status, 'unreviewed') = 'unreviewed') as unreviewed_count
       ${OWNED_TXN_FROM}
       where a.user_id = $1 and t.txn_date >= $2 and t.txn_date < $3
         and not (${EXCLUDED_FROM_FLOW_SQL})
     ),
     balance as (
       select coalesce(sum(latest.running_balance_satang), 0)::bigint as total_balance_satang
       from (
         select distinct on (t.bank_account_id) t.bank_account_id, t.running_balance_satang
         from txn t
         join bank_account a on a.id = t.bank_account_id
         where a.user_id = $1 and a.archived_at is null and t.txn_date < $3
         order by t.bank_account_id, t.txn_date desc, t.txn_time desc nulls last, t.id desc
       ) latest
     )
     select f.money_in_satang, f.money_out_satang, (f.money_in_satang - f.money_out_satang) as net_satang,
            tr.internal_transfer_excluded_satang, tr.internal_transfer_count,
            q.uncategorised_count, q.unreviewed_count,
            b.total_balance_satang
     from flow f, transfers tr, quality q, balance b`,
    [user.id, from, to],
  );
  const summary = rows[0]!;

  // all-time ต่อ user ไม่ผูกกับเดือนที่เลือก — parse_failed/checksum_failed ไม่มี period ให้ผูกกับเดือนได้ (migration 002)
  const statementHealth = await query<{ status: string; n: number }>(
    `select st.status, count(*)::int as n
     from statement st join bank_account a on a.id = st.bank_account_id
     where a.user_id = $1
     group by st.status`,
    [user.id],
  );

  // เฉพาะ reason ไม่เอา error_detail ทั้งก้อน — บนแถว pending อาจมีข้อความ statement ดิบยาวถึง ~20,000 ตัวอักษร
  const failedStatements = await query<{
    id: number;
    bank_account_id: number;
    account_nickname: string;
    status: string;
    error_reason: unknown;
    created_at: string;
  }>(
    `select st.id, st.bank_account_id, a.nickname as account_nickname, st.status,
            st.error_detail -> 'reason' as error_reason, st.created_at
     from statement st join bank_account a on a.id = st.bank_account_id
     where a.user_id = $1 and st.status in ('parse_failed', 'checksum_failed')
     order by st.created_at desc
     limit 50`,
    [user.id],
  );

  res.json({
    from,
    to,
    ...summary,
    statement_health: statementHealth.rows,
    failed_statements: failedStatements.rows,
    accounts_with_gaps: (await accountCoverage(user.id)).filter((a) => a.statement_behind),
    data_coverage_note: DATA_COVERAGE_NOTE,
  });
}));

// GET /api/reports/category-breakdown?month=YYYY-MM — รายจ่ายแยกหมวด debit เท่านั้น ไม่รวม transfer/excluded
reportsRouter.get('/reports/category-breakdown', requireUser(async (req, res, user) => {
  const { from, to } = parseRange(req.query as Record<string, unknown>);

  // left join txn_split + coalesce (ไม่ union all): txn 3 split ออกมา 3 แถว, txn 0 split ออกมา 1 แถวที่
  // category_id เป็น null ตกไปกลุ่ม "ไม่ได้จัดหมวด" โดยไม่ซ้ำแถวและไม่ต้องเขียน WHERE สองที่
  // group by s.category_id, c.name (ไม่ใช่ c.id) — Postgres สืบ c.name จาก s.category_id ข้ามตารางไม่ได้
  // filter t.direction = 'debit' ไม่ใช่ c.kind = 'expense' — debit ที่ผู้ใช้แยกเข้าหมวด income โดยพลาดต้องยังโผล่
  // ที่นี่ ไม่งั้น sum(breakdown) จะไม่เท่ากับ money_out_satang อีกต่อไป
  const { rows } = await query<{ category_id: number | null; category_name: string; total_satang: number; txn_count: number }>(
    `select s.category_id, coalesce(c.name, 'ไม่ได้จัดหมวด') as category_name,
            sum(coalesce(s.amount_satang, t.amount_satang))::bigint as total_satang,
            count(distinct t.id)::int as txn_count
     from txn t
     join bank_account a on a.id = t.bank_account_id
     left join txn_annotation an on an.txn_id = t.id
     left join txn_split s on s.txn_id = t.id
     left join category c on c.id = s.category_id
     where a.user_id = $1 and t.txn_date >= $2 and t.txn_date < $3
       and t.direction = 'debit'
       and not (${EXCLUDED_FROM_FLOW_SQL})
     group by s.category_id, c.name
     order by total_satang desc`,
    [user.id, from, to],
  );
  res.json({ from, to, rows, data_coverage_note: DATA_COVERAGE_NOTE });
}));

// GET /api/reports/cash-flow?from=YYYY-MM-DD&to=YYYY-MM-DD — ซีรีส์รายเดือน เดือนที่ไม่มีธุรกรรมคืนแถว 0 ชัดเจน
// (ไม่ปล่อยเป็นช่องว่าง กันกราฟเส้นลากทับเดือนที่หายไปแบบชี้นำผิด)
reportsRouter.get('/reports/cash-flow', requireUser(async (req, res, user) => {
  const { from, to } = parseRange(req.query as Record<string, unknown>, 24);

  const { rows } = await query<{ month: string; money_in_satang: number; money_out_satang: number; net_satang: number }>(
    `with months as (
       select generate_series(date_trunc('month', $2::date), date_trunc('month', ($3::date - interval '1 day')), interval '1 month')::date as month
     ),
     agg as (
       select date_trunc('month', t.txn_date)::date as month,
              coalesce(sum(t.amount_satang) filter (where t.direction = 'credit'), 0)::bigint as money_in_satang,
              coalesce(sum(t.amount_satang) filter (where t.direction = 'debit'), 0)::bigint as money_out_satang
       ${OWNED_TXN_FROM}
       where a.user_id = $1 and t.txn_date >= $2 and t.txn_date < $3
         and not (${EXCLUDED_FROM_FLOW_SQL})
       group by 1
     )
     select to_char(m.month, 'YYYY-MM') as month,
            coalesce(agg.money_in_satang, 0)::bigint as money_in_satang,
            coalesce(agg.money_out_satang, 0)::bigint as money_out_satang,
            (coalesce(agg.money_in_satang, 0) - coalesce(agg.money_out_satang, 0))::bigint as net_satang
     from months m
     left join agg on agg.month = m.month
     order by m.month`,
    [user.id, from, to],
  );
  res.json({ from, to, rows, data_coverage_note: DATA_COVERAGE_NOTE });
}));

// GET /api/reports/account-balances?month=YYYY-MM — ยอดปิดรายวันต่อบัญชีสำหรับเดือนนั้น
reportsRouter.get('/reports/account-balances', requireUser(async (req, res, user) => {
  const { from, to } = parseRange(req.query as Record<string, unknown>);

  const { rows } = await query<{
    bank_account_id: number;
    account_nickname: string;
    txn_date: string;
    running_balance_satang: number;
  }>(
    `select distinct on (t.bank_account_id, t.txn_date)
       t.bank_account_id, a.nickname as account_nickname, t.txn_date, t.running_balance_satang
     ${OWNED_TXN_FROM}
     where a.user_id = $1 and t.txn_date >= $2 and t.txn_date < $3
     order by t.bank_account_id, t.txn_date, t.txn_time desc nulls last, t.id desc`,
    [user.id, from, to],
  );
  res.json({ from, to, rows, data_coverage_note: DATA_COVERAGE_NOTE });
}));

// GET /api/reports/data-coverage — thin wrapper รอบ accountCoverage
reportsRouter.get('/reports/data-coverage', requireUser(async (_req, res, user) => {
  res.json({ rows: await accountCoverage(user.id), data_coverage_note: DATA_COVERAGE_NOTE });
}));
