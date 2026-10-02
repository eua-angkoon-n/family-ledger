// logic ของการเลือกหลายแถวในหน้าวางแผน (web/src/planSelection.ts) — ไม่มี React component test
// ใน repo นี้ จึงทดสอบส่วนที่เป็นเงินและเงื่อนไขว่าปุ่มแบบกลุ่มจะแตะแถวไหนบ้างตรงนี้
import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlanItem, RecurringRule } from '../web/src/api.js';
import {
  canDelete,
  canPay,
  canSkip,
  comparePlanItems,
  EMPTY_RULE_FILTER,
  compareRules,
  matchesItemFilter,
  matchesRuleFilter,
  NO_CATEGORY,
  STATUS_ORDER,
  sumPlanTotals,
  todayLocal,
} from '../web/src/planSelection.js';

let nextId = 1;
function item(over: Partial<PlanItem> = {}): PlanItem {
  return {
    id: nextId++,
    income_record_id: null,
    recurring_rule_id: null,
    installment_due_id: null,
    kind: 'expense',
    name: 'ค่าน้ำ',
    category_id: null,
    category_name: null,
    planned_amount_satang: 10000,
    amount_mode: 'fixed',
    due_date: null,
    explicit_status: 'active',
    note: null,
    paid_satang: 0,
    payment_state: 'unpaid',
    payments: [],
    ...over,
  };
}

function rule(over: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: nextId++,
    name: 'ค่าเช่า',
    kind: 'expense',
    amount_mode: 'fixed',
    amount_satang: 10000,
    frequency_unit: 'month',
    frequency_interval: 1,
    anchor_day: null,
    start_date: '2026-01-01',
    end_date: null,
    default_account_id: null,
    default_account_nickname: null,
    category_id: null,
    category_name: null,
    is_active: true,
    ...over,
  };
}

const payment = (status: 'declared' | 'cancelled') => ({
  id: nextId++, amount_satang: 100, paid_date: '2026-01-01', bank_account_id: 1, account_nickname: 'A', status,
});

test('sumPlanTotals: รวมทุกแถวที่เลือกรวมแถวที่ข้าม และเงินกันไว้ลดเงินเหลือใช้', () => {
  const totals = sumPlanTotals([
    item({ kind: 'income', planned_amount_satang: 5000000 }),
    item({ kind: 'payroll_deduction', planned_amount_satang: 75000 }),
    item({ kind: 'expense', planned_amount_satang: 1200000 }),
    item({ kind: 'expense', planned_amount_satang: 30000, explicit_status: 'skipped', payment_state: 'skipped' }),
    item({ kind: 'reserve', planned_amount_satang: 500000 }),
  ]);
  assert.deepEqual(totals, {
    income: 5000000,
    deduction: 75000,
    expense: 1230000,
    reserve: 500000,
    available: 5000000 - 75000 - 1230000 - 500000,
  });
  assert.deepEqual(sumPlanTotals([]), { income: 0, deduction: 0, expense: 0, reserve: 0, available: 0 });
  assert.equal(sumPlanTotals([item({ kind: 'expense', planned_amount_satang: 100 })]).available, -100);
});

test('canPay: ทุกเงื่อนไข', () => {
  assert.equal(canPay(item()), null);
  assert.equal(canPay(item({ kind: 'reserve' })), null);
  assert.equal(canPay(item({ payment_state: 'partial', paid_satang: 5000 })), null);
  assert.equal(canPay(item({ kind: 'income' })), 'บันทึกที่รายได้และรายการหัก');
  assert.equal(canPay(item({ kind: 'payroll_deduction' })), 'รายการหักจากรายได้ไม่ต้องจ่าย');
  assert.equal(canPay(item({ explicit_status: 'skipped' })), 'ข้ามหรือยกเลิกแล้ว');
  assert.equal(canPay(item({ explicit_status: 'cancelled' })), 'ข้ามหรือยกเลิกแล้ว');
  assert.equal(canPay(item({ income_record_id: 3 })), 'จัดการในส่วนรายได้');
  assert.equal(canPay(item({ installment_due_id: 3 })), 'จ่ายที่หน้าแผนผ่อน');
  assert.equal(canPay(item({ payment_state: 'paid', paid_satang: 10000 })), 'จ่ายครบแล้ว');
});

test('canSkip: ทุกเงื่อนไข', () => {
  assert.equal(canSkip(item()), null);
  assert.equal(canSkip(item({ kind: 'income' })), null);
  assert.equal(canSkip(item({ explicit_status: 'skipped' })), 'ข้ามหรือยกเลิกแล้ว');
  assert.equal(canSkip(item({ income_record_id: 3 })), 'จัดการในส่วนรายได้');
  assert.equal(canSkip(item({ installment_due_id: 3 })), 'จัดการที่หน้าแผนผ่อน');
});

test('canDelete: ทุกเงื่อนไข', () => {
  assert.equal(canDelete(item()), null);
  assert.equal(canDelete(item({ payments: [payment('cancelled')] })), null);
  assert.equal(canDelete(item({ explicit_status: 'skipped' })), null);
  assert.equal(canDelete(item({ income_record_id: 3 })), 'จัดการในส่วนรายได้');
  assert.equal(canDelete(item({ installment_due_id: 3 })), 'จัดการที่หน้าแผนผ่อน');
  assert.equal(canDelete(item({ recurring_rule_id: 3 })), 'รายการประจำ — ใช้ ข้าม แทน');
  assert.equal(canDelete(item({ payments: [payment('cancelled'), payment('declared')] })), 'มีการประกาศจ่ายค้างอยู่');
});

test('matchesItemFilter: ชิป "ต้องจ่ายทั้งหมด" นับตรงกับ total_count (expense ที่ active)', () => {
  const rows = [
    item(),
    item({ payment_state: 'paid' }),
    item({ explicit_status: 'skipped', payment_state: 'skipped' }),
    item({ kind: 'reserve' }),
    item({ category_id: 7 }),
  ];
  const inPlan = { kind: 'expense', category: '', status: 'in_plan' } as const;
  assert.equal(rows.filter((r) => matchesItemFilter(r, inPlan)).length, 3);
  assert.equal(rows.filter((r) => matchesItemFilter(r, { kind: '', category: '', status: 'paid' })).length, 1);
  assert.equal(rows.filter((r) => matchesItemFilter(r, { kind: '', category: NO_CATEGORY, status: '' })).length, 4);
  assert.equal(rows.filter((r) => matchesItemFilter(r, { kind: '', category: '7', status: '' })).length, 1);
  assert.equal(rows.filter((r) => matchesItemFilter(r, { kind: '', category: '', status: '' })).length, 5);
});

test('matchesRuleFilter: ประเภท, หมวด (รวม sentinel ไม่ระบุ) และแบบยอด', () => {
  const rows = [
    rule(),
    rule({ kind: 'income' }),
    rule({ category_id: 7 }),
    rule({ amount_mode: 'estimated', category_id: 8 }),
  ];
  const count = (f: Parameters<typeof matchesRuleFilter>[1]) => rows.filter((r) => matchesRuleFilter(r, f)).length;
  assert.equal(count(EMPTY_RULE_FILTER), 4);
  assert.equal(count({ kind: 'income', category: '', amount_mode: '' }), 1);
  assert.equal(count({ kind: 'expense', category: '', amount_mode: '' }), 3);
  assert.equal(count({ kind: '', category: NO_CATEGORY, amount_mode: '' }), 2);
  assert.equal(count({ kind: '', category: '7', amount_mode: '' }), 1);
  assert.equal(count({ kind: '', category: '', amount_mode: 'estimated' }), 1);
  assert.equal(count({ kind: 'income', category: NO_CATEGORY, amount_mode: 'estimated' }), 0);
});

test('comparePlanItems: ค่าว่างอยู่ท้ายทั้งสองทิศ, ลำดับสถานะ, กลับทิศ และ id ตัดสินเสมอ', () => {
  const a = item({ category_name: 'อาหาร', due_date: '2026-01-20' });
  const b = item({ category_name: null, due_date: null });
  const c = item({ category_name: 'บ้าน', due_date: '2026-01-05' });
  const ids = (rows: PlanItem[]) => rows.map((r) => r.id);
  assert.deepEqual(ids([a, b, c].sort(comparePlanItems('due_date', 'asc'))), [c.id, a.id, b.id]);
  assert.deepEqual(ids([a, b, c].sort(comparePlanItems('due_date', 'desc'))), [a.id, c.id, b.id]);
  assert.equal([a, b, c].sort(comparePlanItems('category', 'asc')).at(-1), b);
  assert.equal([a, b, c].sort(comparePlanItems('category', 'desc')).at(-1), b);

  const byState = STATUS_ORDER.map((payment_state) => item({ payment_state })).reverse();
  assert.deepEqual(byState.sort(comparePlanItems('status', 'asc')).map((r) => r.payment_state), STATUS_ORDER);

  const x = item({ planned_amount_satang: 500 });
  const y = item({ planned_amount_satang: 100 });
  const z = item({ planned_amount_satang: 500 });
  assert.deepEqual(ids([x, y, z].sort(comparePlanItems('planned', 'asc'))), [y.id, x.id, z.id]);
  assert.deepEqual(ids([z, y, x].sort(comparePlanItems('planned', 'desc'))), [x.id, z.id, y.id]);

  const kinds = [item({ kind: 'reserve' }), item({ kind: 'income' }), item({ kind: 'expense' })];
  assert.deepEqual(kinds.sort(comparePlanItems('kind', 'asc')).map((r) => r.kind), ['income', 'expense', 'reserve']);
});

test('compareRules: ความถี่เทียบเป็นจำนวนวัน', () => {
  const yearly = rule({ frequency_unit: 'year', frequency_interval: 1 });
  const biweekly = rule({ frequency_unit: 'week', frequency_interval: 2 });
  const monthly = rule({ frequency_unit: 'month', frequency_interval: 1 });
  assert.deepEqual(
    [yearly, monthly, biweekly].sort(compareRules('frequency', 'asc')).map((r) => r.id),
    [biweekly.id, monthly.id, yearly.id],
  );
  const noCat = rule({ category_name: null });
  const cat = rule({ category_name: 'บ้าน' });
  assert.equal([noCat, cat].sort(compareRules('category', 'desc'))[0], cat);
});

test('todayLocal: YYYY-MM-DD ตามเวลาเครื่อง ไม่ใช่ UTC', () => {
  assert.match(todayLocal(), /^\d{4}-\d{2}-\d{2}$/);
  // 00:30 เวลาเครื่อง — ถ้าใช้ toISOString() ในโซนที่ UTC+ จะได้วันก่อนหน้า
  assert.equal(todayLocal(new Date(2026, 0, 5, 0, 30)), '2026-01-05');
  const now = new Date();
  const manual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  assert.equal(todayLocal(now), manual);
});
