// logic ล้วนของตาราง "รายการของเดือนนี้" (ตัวกรอง/เรียง/เลือกหลายแถว) แยกจาก MonthlyPlan.tsx
// เพื่อให้ node:test import ได้ตรง ๆ — ห้าม import React หรือ MUI ในไฟล์นี้ (ใช้ได้แค่ `import type`)
import type { PaymentState, PlanItem, PlanKind, RecurringRule } from './api.js';

export const KIND_ORDER: PlanKind[] = ['income', 'payroll_deduction', 'expense', 'reserve'];
// เรียงตามสิ่งที่ต้องทำก่อน: ค้างจ่าย → จ่ายไม่ครบ → จบแล้ว → ไม่อยู่ในแผน
export const STATUS_ORDER: PaymentState[] = [
  'overdue', 'unpaid', 'partial', 'paid', 'received', 'deducted', 'not_required', 'skipped', 'cancelled',
];
// ค่า sentinel ของ "ไม่ระบุหมวด" ใน select — category_id จริงเป็นตัวเลขเสมอ จึงไม่ชนกัน
export const NO_CATEGORY = 'none';

/** ADR-0004: แผนไม่จับคู่กับ statement — บอกครั้งเดียวใต้ชื่อหน้าวางแผน และในฟอร์มบันทึกจ่าย (ทีละรายการ/แบบกลุ่ม) ที่ผลของมันเกิดจริง */
export const PLAN_NOT_MATCHED_NOTE = 'แผนไม่จับคู่กับ statement — ยอดจ่ายและรายได้นับตามที่คุณบันทึกเอง เงินเข้าออกจริงดูที่หน้าธุรกรรม';

export type SelectionTotals = { income: number; deduction: number; expense: number; reserve: number; available: number };

/**
 * ยอดรวมของแถวที่เลือก สูตรเดียวกับ planTotals ฝั่ง server (§8.2) ยกเว้นเรื่องเดียว: **ไม่กรอง
 * explicit_status** — ผู้ใช้เลือกเองว่าแถวไหนนับ ติ๊กแถวที่ข้ามไว้ก็ต้องเห็นยอดของมัน
 */
export function sumPlanTotals(items: PlanItem[]): SelectionTotals {
  const t = { income: 0, deduction: 0, expense: 0, reserve: 0 };
  for (const i of items) {
    if (i.kind === 'income') t.income += i.planned_amount_satang;
    else if (i.kind === 'payroll_deduction') t.deduction += i.planned_amount_satang;
    else if (i.kind === 'expense') t.expense += i.planned_amount_satang;
    else t.reserve += i.planned_amount_satang;
  }
  return { ...t, available: t.income - t.deduction - t.expense - t.reserve };
}

// canX คืน null = ทำได้, ไม่งั้นคืนเหตุผลสั้น ๆ ไว้แสดงใน "ตัดออก" ของ dialog แบบกลุ่ม
// ใช้กับปุ่มแบบกลุ่มเท่านั้น — ปุ่มรายแถวมีเงื่อนไขของตัวเอง (เช่นแถวที่จ่ายครบยังมีปุ่ม "ดูการจ่าย"
// เปิด modal ได้เพื่อยกเลิกการบันทึกจ่ายหรือบันทึกเพิ่มเอง) ส่วนเดือนที่ปิดแล้วผู้เรียกเช็กเอง
export function canPay(item: PlanItem): string | null {
  if (item.kind === 'income') return 'บันทึกที่รายได้และรายการหัก';
  if (item.kind === 'payroll_deduction') return 'รายการหักจากรายได้ไม่ต้องจ่าย';
  if (item.explicit_status !== 'active') return 'ข้ามหรือยกเลิกแล้ว';
  if (item.income_record_id != null) return 'จัดการในส่วนรายได้';
  if (item.installment_due_id != null) return 'จ่ายที่หน้าแผนผ่อน';
  if (item.payment_state === 'paid') return 'จ่ายครบแล้ว';
  return null;
}

export function canSkip(item: PlanItem): string | null {
  if (item.explicit_status !== 'active') return 'ข้ามหรือยกเลิกแล้ว';
  if (item.income_record_id != null) return 'จัดการในส่วนรายได้';
  if (item.installment_due_id != null) return 'จัดการที่หน้าแผนผ่อน';
  return null;
}

// ตรงกับเงื่อนไข 409 ของ DELETE ฝั่ง server + ห้ามลบรายการประจำ: ลบไปแล้วเปิดเดือนนี้ครั้งหน้า
// ระบบจะสร้างกลับมาใหม่ ผู้ใช้จะเห็นว่า "ลบไม่ได้" แบบงง ๆ ข้ามคือสิ่งที่ตั้งใจจริง
export function canDelete(item: PlanItem): string | null {
  if (item.income_record_id != null) return 'จัดการในส่วนรายได้';
  if (item.installment_due_id != null) return 'จัดการที่หน้าแผนผ่อน';
  if (item.recurring_rule_id != null) return 'รายการประจำ — ใช้ ข้าม แทน';
  if (!item.payments.every((p) => p.status === 'cancelled')) return 'มีการบันทึกจ่ายค้างอยู่';
  return null;
}

export type ItemFilter = { kind: PlanKind | ''; category: string; status: PaymentState | 'in_plan' | '' };
export type RuleFilter = { kind: PlanKind | ''; category: string; amount_mode: RecurringRule['amount_mode'] | '' };
export const EMPTY_ITEM_FILTER: ItemFilter = { kind: '', category: '', status: '' };
export const EMPTY_RULE_FILTER: RuleFilter = { kind: '', category: '', amount_mode: '' };

function matchesCategory(categoryId: number | null, filter: string): boolean {
  if (filter === '') return true;
  return filter === NO_CATEGORY ? categoryId == null : String(categoryId) === filter;
}

// `in_plan` = explicit_status active — ชิป "ต้องจ่ายทั้งหมด" ใช้ {kind: expense, status: in_plan}
// ซึ่งเป็นเงื่อนไขเดียวกับ total_count ฝั่ง server จำนวนแถวที่กรองได้จึงเท่ากับเลขบนชิปเสมอ
export function matchesItemFilter(item: PlanItem, f: ItemFilter): boolean {
  if (f.kind !== '' && item.kind !== f.kind) return false;
  if (!matchesCategory(item.category_id, f.category)) return false;
  if (f.status === 'in_plan') return item.explicit_status === 'active';
  return f.status === '' || item.payment_state === f.status;
}

export function matchesRuleFilter(rule: RecurringRule, f: RuleFilter): boolean {
  return (
    (f.kind === '' || rule.kind === f.kind) &&
    matchesCategory(rule.category_id, f.category) &&
    (f.amount_mode === '' || rule.amount_mode === f.amount_mode)
  );
}

export type SortDir = 'asc' | 'desc';
export type ItemSortKey = 'kind' | 'name' | 'category' | 'due_date' | 'planned' | 'paid' | 'status';
export type RuleSortKey = 'kind' | 'name' | 'category' | 'frequency' | 'start_date' | 'amount';

// ค่าว่าง (ไม่มีหมวด/ไม่มีวันครบกำหนด) อยู่ท้ายเสมอไม่ว่าเรียงทางไหน — กลับด้านแล้วแถวว่างขึ้นบน
// จะดันแถวที่มีข้อมูลจริงลงไปล่างสุด ส่วน id เป็นตัวตัดสินสุดท้ายแบบขึ้นเสมอให้ลำดับไม่กระโดด
function comparator<T extends { id: number }>(get: (row: T) => string | number | null, dir: SortDir) {
  const sign = dir === 'asc' ? 1 : -1;
  return (a: T, b: T): number => {
    const x = get(a);
    const y = get(b);
    if (x == null || y == null) return x == null && y == null ? a.id - b.id : x == null ? 1 : -1;
    const c = typeof x === 'string' ? x.localeCompare(String(y), 'th') : x - (y as number);
    return c !== 0 ? sign * c : a.id - b.id;
  };
}

export function comparePlanItems(key: ItemSortKey, dir: SortDir) {
  const get: Record<ItemSortKey, (i: PlanItem) => string | number | null> = {
    kind: (i) => KIND_ORDER.indexOf(i.kind),
    name: (i) => i.name,
    category: (i) => i.category_name,
    due_date: (i) => i.due_date,
    planned: (i) => i.planned_amount_satang,
    paid: (i) => i.paid_satang,
    status: (i) => STATUS_ORDER.indexOf(i.payment_state),
  };
  return comparator(get[key], dir);
}

const UNIT_DAYS: Record<RecurringRule['frequency_unit'], number> = { day: 1, week: 7, month: 30, year: 365 };

export function compareRules(key: RuleSortKey, dir: SortDir) {
  const get: Record<RuleSortKey, (r: RecurringRule) => string | number | null> = {
    kind: (r) => KIND_ORDER.indexOf(r.kind),
    name: (r) => r.name,
    category: (r) => r.category_name,
    // เทียบความถี่เป็นจำนวนวันโดยประมาณ ทุก 2 สัปดาห์ (14) มาก่อนทุกเดือน (30)
    frequency: (r) => r.frequency_interval * UNIT_DAYS[r.frequency_unit],
    start_date: (r) => r.start_date,
    amount: (r) => r.amount_satang,
  };
  return comparator(get[key], dir);
}

// วันนี้ตามเวลาเครื่อง — ห้าม toISOString() เพราะเป็น UTC ก่อน 07:00 เวลาไทยจะได้วันของเมื่อวาน
// หน้าเว็บใช้ todayInBangkok (format.ts) แทนแล้ว ตัวนี้เหลือไว้เพราะ test/plan-selection.test.ts ยัง import
export function todayLocal(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
