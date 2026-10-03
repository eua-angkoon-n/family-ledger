// หน้า /audit แสดงป้ายไทยจาก web/src/auditLabels.ts — action ใหม่ที่ server เขียนแต่ไม่มีป้ายจะโผล่เป็น code ดิบ
// (และไม่อยู่ในตัวเลือกตัวกรอง) เทสต์นี้อ่าน literal ใน `action:` ของ src/ ทุกไฟล์แล้วเทียบกับแผนที่
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ACTION_LABEL, AUDIT_ACTIONS, ENTITY_LABEL, changedFields, fieldLabel, formatFieldValue, isHiddenField, redactRaw } from '../web/src/auditLabels.js';

const SRC = join(import.meta.dirname, '..', 'src');
const MIGRATIONS = join(import.meta.dirname, '..', 'migrations');

test('ป้าย audit: ทุก action ที่ src/ เขียนมีป้ายไทยและ entity ที่รู้จัก', () => {
  const codes = new Set<string>();
  for (const file of readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter((p) => p.endsWith('.ts'))) {
    for (const line of readFileSync(join(SRC, file), 'utf8').split('\n')) {
      if (!/\baction:/.test(line)) continue;
      for (const m of line.matchAll(/['"]([a-z_]+\.[a-z_]+)['"]/g)) codes.add(m[1]!);
    }
  }
  // template string ใน installments.ts: `installment_due.${action}` กับ action = skip | restore
  codes.add('installment_due.skip');
  codes.add('installment_due.restore');
  assert.ok(codes.size >= 40, `หา action ได้แค่ ${codes.size} ตัว — รูปแบบการเรียก audit() เปลี่ยนหรือเปล่า`);
  for (const code of codes) assert.ok(ACTION_LABEL[code], `action ${code} ไม่มีป้ายไทยใน web/src/auditLabels.ts`);
  for (const [code, , entity] of AUDIT_ACTIONS) assert.ok(ENTITY_LABEL[entity], `${code} ชี้ entity ${entity} ที่ไม่มีป้าย`);
});

test('ป้าย audit: changedFields เหลือเฉพาะช่องที่เปลี่ยน แปลงเงิน/boolean/null เป็นคำ และไม่แสดง *_enc', () => {
  assert.deepEqual(
    changedFields(
      { id: 1, nickname: 'ออมทรัพย์', is_active: true, amount_satang: 150050, note: null, updated_at: 'a', pdf_password_enc: 'x' },
      { id: 1, nickname: 'ออมทรัพย์', is_active: false, amount_satang: 200000, note: 'ค่าเช่า', updated_at: 'b', pdf_password_enc: 'y' },
    ).map((c) => [c.key, c.before, c.after]),
    [['is_active', 'ใช่', 'ไม่ใช่'], ['amount_satang', '฿1,500.50', '฿2,000.00'], ['note', 'ว่าง', 'ค่าเช่า']],
  );
  // สร้างใหม่: ฝั่งเดียว ช่องว่างไม่แสดง · ช่องตัวเลือกแปลเป็นไทย
  assert.deepEqual(
    changedFields(null, { status: 'declared', txn_id: null }).map((c) => [c.label, c.before, c.after]),
    [['สถานะ', null, 'บันทึกจ่ายแล้ว']],
  );
  // แบ่งยอด: array เทียบเป็นจำนวนรายการ
  assert.deepEqual(changedFields([], [{}, {}]).map((c) => [c.before, c.after]), [['0 รายการ', '2 รายการ']]);
});

// ตารางที่ route ส่งแถวเข้า audit (`returning *` / `select *` / รายการคอลัมน์ที่เลือกเอง ซึ่งเป็นสับเซตของตาราง)
// คอลัมน์อ่านจาก migrations/ — migration ใหม่ที่เพิ่มคอลัมน์ให้ตารางเหล่านี้จะ fail ที่นี่จนกว่าจะมีป้ายหรือถูกซ่อน
// (ตารางที่เข้า audit เป็น array — txn_split, income_deduction, tax_document_txn_link — แสดงเป็นจำนวนรายการ ไม่ต้องมีป้าย)
const AUDITED_TABLES = [
  'app_user', 'bank', 'bank_account', 'category', 'txn_annotation', 'transfer_match', 'recurring_rule', 'monthly_plan',
  'monthly_plan_item', 'monthly_item_payment', 'income_record', 'installment_plan', 'installment_due', 'student_loan',
  'tax_entity', 'tax_document', 'tax_deduction_claim', 'tax_calculation_snapshot',
];
// คอลัมน์ที่ route เลือกไม่ส่งเข้า audit — ไม่ต้องมีป้าย
const NOT_SENT = new Set([
  'app_user.google_sub', 'app_user.created_at', // admin.ts: id, email, status, is_admin · auth.ts: email, display_name
  'bank_account.account_digits', // accounts.ts ACCOUNT_AUDIT_COLUMNS
  'tax_document.storage_path', 'tax_document.file_sha256', // tax-documents.ts TAX_DOC_COLUMNS
  'installment_due.installment_no', 'installment_due.due_date', 'installment_due.amount_satang', // installments.ts: explicit_status เท่านั้น
]);
// key ที่ route สร้างเอง ไม่ใช่คอลัมน์ของตาราง
const COMPUTED_KEYS = [
  'gmail_connected', // auth.ts
  'pdf_password_changed', // accounts.ts
  'full', 'messages_scanned', 'statements_inserted', 'statements_failed', 'skipped', 'already_running', // email-accounts.ts + SyncSummary
  'plan_status', // services/plan-query.ts loadOwnedItem (before ของ monthly_plan_item.update/skip)
  'month_start', 'deductions', // services/income-records.ts incomeRows
  'total_payable_satang', 'paid_satang', 'outstanding_satang', 'structural_editable', 'dues', // services/installments.ts installmentDetail
  'has_tax_id', 'tax_id_changed', // tax-entities.ts
  'source', // tax-documents.ts
];

function migrationColumns(): Map<string, Set<string>> {
  const sql = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8')).join('\n');
  const tables = new Map<string, Set<string>>();
  for (const m of sql.matchAll(/create table (\w+) \(([\s\S]*?)\r?\n\);/g)) {
    const cols = new Set<string>();
    for (const line of m[2]!.split('\n')) {
      const col = /^\s*(\w+)\s/.exec(line)?.[1]; // บรรทัด comment (--), ต่อบรรทัด "(" และ constraint ไม่ใช่คอลัมน์
      if (col && !['check', 'unique', 'constraint', 'primary', 'foreign'].includes(col)) cols.add(col);
    }
    tables.set(m[1]!, cols);
  }
  for (const m of sql.matchAll(/alter table (\w+) add column (\w+)/g)) tables.get(m[1]!)?.add(m[2]!);
  return tables;
}

test('ป้าย audit: ทุกช่องที่ route ส่งเข้า audit มีป้ายไทยหรือถูกซ่อน', () => {
  const tables = migrationColumns();
  const keys = new Set(COMPUTED_KEYS);
  for (const table of AUDITED_TABLES) {
    const cols = tables.get(table);
    assert.ok(cols && cols.size >= 2, `หาคอลัมน์ของ ${table} ใน migrations/ ไม่เจอ — รูปแบบ create table เปลี่ยนหรือเปล่า`);
    for (const col of cols) if (!NOT_SENT.has(`${table}.${col}`)) keys.add(col);
  }
  assert.ok(tables.get('bank')!.has('parser_key') && tables.get('monthly_plan_item')!.has('amount_mode'), 'อ่าน create/alter table ไม่ครบ');
  const missing = [...keys].filter((key) => !isHiddenField(key) && fieldLabel(key) === key);
  assert.deepEqual(missing, [], 'ช่องเหล่านี้ไม่มีป้ายไทยใน web/src/auditLabels.ts และไม่ได้ถูกซ่อน');
});

test('ป้าย audit: รหัสภายในซ่อน หมวดเป็นชื่อ ค่าก้อนไม่ dump JSON', () => {
  // `*_id` ที่ไม่มีป้ายซ่อน (แอดมินยังเห็นในข้อมูลดิบ) · ที่มีป้าย (พร้อมเพย์) แสดง
  assert.ok(isHiddenField('monthly_plan_id') && isHiddenField('debit_txn_id') && isHiddenField('parent_id'));
  assert.ok(!isHiddenField('promptpay_id') && !isHiddenField('category_id'));
  assert.deepEqual(redactRaw({ monthly_plan_id: 3, pdf_password_enc: 'x' }), { monthly_plan_id: 3 });
  // category_id → ชื่อ / ไม่อยู่ในรายการ / ยังไม่ได้รายการ
  const names = new Map([[5, 'อาหาร']]);
  assert.deepEqual(
    changedFields({ category_id: 5 }, { category_id: 9 }, names).map((c) => [c.label, c.before, c.after]),
    [['หมวด', 'อาหาร', 'หมวดที่ไม่มีในรายการ']],
  );
  assert.equal(formatFieldValue('category_id', 5), 'ไม่ทราบชื่อหมวด');
  // ปิดเดือน: สรุปตัวเลขหลัก ไม่ใช่ JSON
  const snapshot = { totals: { planned_available_satang: 1234500 }, payment_status: { paid_count: 1 } };
  assert.equal(formatFieldValue('closed_snapshot', snapshot), 'เงินเหลือใช้ตามแผน ฿12,345.00');
  assert.ok(!formatFieldValue('closed_snapshot', {}).includes('{'));
  assert.equal(formatFieldValue('payoff_discount_bp', 300), '3%');
  assert.equal(formatFieldValue('payoff_discount_bp', 250), '2.5%');
  // regex ของธนาคารแสดงเป็น mono
  assert.deepEqual(changedFields(null, { subject_monthly: '^statement', name: 'KBank' }).map((c) => [c.key, c.mono]), [['subject_monthly', true], ['name', false]]);
});

test('ป้าย audit: before ที่เก็บแคบกว่า after ไม่ขึ้นว่าเปลี่ยนจาก "ว่าง"', () => {
  // monthly_item_payment.cancel: before = id, monthly_plan_item_id, status · after = ทั้งแถว
  assert.deepEqual(
    changedFields(
      { id: 1, monthly_plan_item_id: 2, status: 'declared', plan_status: 'open', note: 'ไม่ได้ส่งฝั่งหลัง' },
      { id: 1, monthly_plan_item_id: 2, status: 'cancelled', amount_satang: 50000, paid_date: '2026-09-30', txn_id: null },
    ).map((c) => [c.key, c.before, c.after]),
    [['status', 'บันทึกจ่ายแล้ว', 'ยกเลิกแล้ว'], ['amount_satang', null, '฿500.00'], ['paid_date', null, formatFieldValue('paid_date', '2026-09-30')]],
  );
});
