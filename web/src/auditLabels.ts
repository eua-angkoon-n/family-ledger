// ป้ายไทยของหน้าประวัติการเปลี่ยนแปลง (/audit) — code ใน audit_log เป็นภาษาเครื่อง ("monthly_item_payment.cancel")
// คนในบ้านอ่านไม่รู้เรื่อง หน้านี้จึงแสดงป้ายจากที่นี่ code ที่ไม่มีในแผนที่แสดง code ดิบเป็น fallback
// เพิ่ม action ใหม่ที่ฝั่ง server (`audit(c, { action: ... })`) ต้องเพิ่มที่นี่ด้วย — test/audit-labels.test.ts ตรวจให้
// ไฟล์นี้ไม่ import React/MUI เพื่อให้ node test import ได้ตรง ๆ
import { TAX_TREATMENT_LABEL } from './api.js';
import { formatBaht, formatDate, formatDateTime } from './format.js';
import { DOCUMENT_TYPE_LABEL, TAX_ENTITY_TYPE_LABEL } from './taxDocumentLabels.js';

export const ENTITY_LABEL: Record<string, string> = {
  app_user: 'บัญชีผู้ใช้',
  bank: 'ธนาคาร',
  bank_account: 'บัญชีธนาคาร',
  email_account: 'กล่องอีเมล',
  category: 'หมวด',
  txn: 'ธุรกรรม',
  transfer_match: 'คู่โอนภายใน',
  recurring_rule: 'รายการประจำ',
  monthly_plan: 'แผนเดือน',
  monthly_plan_item: 'รายการในแผนเดือน',
  monthly_item_payment: 'การบันทึกจ่าย',
  income_record: 'รายได้',
  installment_plan: 'แผนผ่อน',
  installment_due: 'งวดผ่อน',
  student_loan: 'หนี้ กยศ.',
  tax_entity: 'ผู้เสียภาษี',
  tax_document: 'เอกสารภาษี',
  tax_calculation_snapshot: 'ผลคำนวณภาษี',
  tax_deduction_claim: 'รายการลดหย่อน',
};

// [code, ป้าย, entity_type ที่ server เขียนคู่กัน] — entity ไม่ได้ตาม prefix เสมอ (tax.export → tax_entity,
// income_deduction.update → income_record) จึงเก็บไว้ตรง ๆ ใช้กรองตัวเลือกการกระทำตามประเภทข้อมูลที่เลือก
export const AUDIT_ACTIONS: readonly (readonly [code: string, label: string, entity: string])[] = [
  ['auth.signup', 'เข้าสู่ระบบครั้งแรก', 'app_user'],
  ['auth.login', 'เข้าสู่ระบบ', 'app_user'],
  ['auth.logout', 'ออกจากระบบ', 'app_user'],
  ['auth.mailbox_add', 'เชื่อมกล่องอีเมล', 'app_user'],
  ['auth.mailbox_reconnect', 'เชื่อมกล่องอีเมลใหม่', 'app_user'],
  ['app_user.update', 'เปลี่ยนสถานะหรือสิทธิ์ผู้ใช้', 'app_user'],
  ['bank.create', 'เพิ่มธนาคาร', 'bank'],
  ['bank.update', 'แก้ไขธนาคาร', 'bank'],
  ['bank.delete', 'ลบธนาคาร', 'bank'],
  ['bank_account.create', 'เพิ่มบัญชีธนาคาร', 'bank_account'],
  ['bank_account.update', 'แก้ไขบัญชีธนาคาร', 'bank_account'],
  ['bank_account.archive', 'เก็บบัญชีธนาคารเข้าคลัง', 'bank_account'],
  ['email_account.sync', 'ดึงอีเมล', 'email_account'],
  ['category.create', 'เพิ่มหมวด', 'category'],
  ['category.update', 'แก้ไขหมวด', 'category'],
  ['txn.annotate', 'ใส่หมวด/โน้ตให้ธุรกรรม', 'txn'],
  ['txn.review', 'ทำเครื่องหมายตรวจแล้ว', 'txn'],
  ['txn.split', 'แบ่งยอดธุรกรรมเป็นหลายหมวด', 'txn'],
  ['transfer_match.confirm', 'ยืนยันคู่โอนภายใน', 'transfer_match'],
  ['transfer_match.reject', 'ปฏิเสธคู่โอนภายใน', 'transfer_match'],
  ['recurring_rule.create', 'เพิ่มรายการประจำ', 'recurring_rule'],
  ['recurring_rule.update', 'แก้ไขรายการประจำ', 'recurring_rule'],
  ['recurring_rule.archive', 'เลิกใช้รายการประจำ', 'recurring_rule'],
  ['monthly_plan.close', 'ปิดเดือน', 'monthly_plan'],
  ['monthly_plan.reopen', 'เปิดเดือนอีกครั้ง', 'monthly_plan'],
  ['monthly_plan_item.create', 'เพิ่มรายการในแผนเดือน', 'monthly_plan_item'],
  ['monthly_plan_item.update', 'แก้ไขรายการในแผนเดือน', 'monthly_plan_item'],
  ['monthly_plan_item.delete', 'ลบรายการในแผนเดือน', 'monthly_plan_item'],
  ['monthly_plan_item.skip', 'ข้ามรายการในแผนเดือน', 'monthly_plan_item'],
  ['monthly_item_payment.declare', 'บันทึกจ่าย', 'monthly_item_payment'],
  ['monthly_item_payment.cancel', 'ยกเลิกการบันทึกจ่าย', 'monthly_item_payment'],
  ['income_record.create', 'บันทึกรายได้เต็ม', 'income_record'],
  ['income_deduction.update', 'แก้ไขรายการหักจากรายได้', 'income_record'],
  ['installment_plan.create', 'เพิ่มแผนผ่อน', 'installment_plan'],
  ['installment_plan.update', 'แก้ไขแผนผ่อน', 'installment_plan'],
  ['installment_due.skip', 'ข้ามงวดผ่อน', 'installment_due'],
  ['installment_due.restore', 'เอางวดผ่อนกลับเข้าแผน', 'installment_due'],
  ['student_loan.create', 'บันทึกข้อมูลหนี้ กยศ.', 'student_loan'],
  ['student_loan.update', 'แก้ไขข้อมูลหนี้ กยศ.', 'student_loan'],
  ['tax_entity.create', 'เพิ่มผู้เสียภาษี', 'tax_entity'],
  ['tax_entity.update', 'แก้ไขผู้เสียภาษี', 'tax_entity'],
  ['tax.export', 'ส่งออกข้อมูลภาษี', 'tax_entity'],
  ['tax_document.upload', 'อัปโหลดเอกสารภาษี', 'tax_document'],
  ['tax_document.update', 'แก้ไขเอกสารภาษี', 'tax_document'],
  ['tax_document.archive', 'เก็บเอกสารภาษีเข้าคลัง', 'tax_document'],
  ['tax_document.download', 'เปิดเอกสารภาษี', 'tax_document'],
  ['tax_document.link_txn', 'ผูกเอกสารภาษีกับธุรกรรม', 'tax_document'],
  ['tax_calculation_snapshot.create', 'บันทึกผลคำนวณภาษี', 'tax_calculation_snapshot'],
  ['tax_deduction_claim.create', 'เพิ่มรายการลดหย่อน', 'tax_deduction_claim'],
  ['tax_deduction_claim.update', 'แก้ไขรายการลดหย่อน', 'tax_deduction_claim'],
  ['tax_deduction_claim.delete', 'ลบรายการลดหย่อน', 'tax_deduction_claim'],
];

export const ACTION_LABEL: Record<string, string> = Object.fromEntries(AUDIT_ACTIONS.map(([code, label]) => [code, label]));

/** ประเภทข้อมูลของหน้าภาษี — ซ่อนจากตัวเลือกตัวกรองตอนหน้าภาษีปิด (แถวเก่ายังแสดงป้ายตามปกติ) */
export const isTaxEntity = (entity: string) => entity.startsWith('tax_');

// ชื่อช่องในค่าก่อน/หลัง — ช่องที่ไม่รู้จักแสดงชื่อดิบ · `*_id` ที่ไม่มีป้ายที่นี่ถูกซ่อน (ดู isHiddenField)
// ช่องใหม่ที่ route ส่งเข้า audit ต้องมีป้ายหรือถูกซ่อน — test/audit-labels.test.ts อ่านคอลัมน์จาก migrations/ มาตรวจ
const FIELD_LABEL: Record<string, string> = {
  name: 'ชื่อ',
  nickname: 'ชื่อเล่นบัญชี',
  display_name: 'ชื่อที่แสดง',
  email: 'อีเมล',
  status: 'สถานะ',
  explicit_status: 'สถานะ',
  is_admin: 'เป็นแอดมิน',
  is_active: 'ใช้งานอยู่',
  note: 'โน้ต',
  kind: 'ประเภท',
  classification: 'ประเภทรายการ',
  review_status: 'การตรวจ',
  reviewed_at: 'ตรวจเมื่อ',
  direction: 'เข้า/ออก',
  account_number: 'เลขบัญชี',
  promptpay_id: 'พร้อมเพย์',
  account_purpose: 'ประเภทบัญชี',
  archived_at: 'เก็บเข้าคลังเมื่อ',
  pdf_password_changed: 'เปลี่ยนรหัสผ่าน PDF',
  tax_id_changed: 'เปลี่ยนเลขผู้เสียภาษี',
  has_tax_id: 'มีเลขผู้เสียภาษี',
  gmail_connected: 'อนุญาตให้อ่านอีเมล',
  amount_mode: 'แบบยอด',
  amount_satang: 'ยอด',
  planned_amount_satang: 'ยอดตามแผน',
  gross_amount_satang: 'รายได้เต็ม',
  expected_net_satang: 'รับสุทธิ',
  total_amount_satang: 'ยอดรวม',
  down_payment_satang: 'เงินดาวน์',
  interest_satang: 'ดอกเบี้ย',
  fee_satang: 'ค่าธรรมเนียม',
  paid_date: 'วันที่จ่าย',
  due_date: 'ครบกำหนด',
  occurrence_date: 'วันที่',
  income_date: 'วันรับเงิน',
  start_date: 'เริ่ม',
  end_date: 'สิ้นสุด',
  first_due_date: 'งวดแรก',
  month_start: 'เดือน',
  closed_at: 'ปิดเมื่อ',
  frequency_unit: 'ความถี่',
  frequency_interval: 'ทุก ๆ',
  anchor_day: 'วันที่ของรอบ',
  installment_count: 'จำนวนงวด',
  tax_treatment: 'การนับภาษี',
  entity_type: 'ประเภทผู้เสียภาษี',
  document_type: 'ประเภทเอกสาร',
  category_id: 'หมวด', // แสดงเป็นชื่อหมวด (formatFieldValue) ไม่ใช่เลข
  bank_id: 'รหัสธนาคาร',
  bank_account_id: 'รหัสบัญชี',
  default_account_id: 'รหัสบัญชีตั้งต้น',
  email_account_id: 'รหัสกล่องอีเมล',
  tax_entity_id: 'รหัสผู้เสียภาษี',
  default_tax_entity_id: 'รหัสผู้เสียภาษีตั้งต้น',
  txn_id: 'รหัสธุรกรรม',
  full: 'อ่านใหม่ทั้งกล่อง',
  messages_scanned: 'อีเมลที่อ่าน',
  statements_inserted: 'statement ที่นำเข้า',
  statements_failed: 'statement ที่เปิดไม่ได้',
  skipped: 'ข้าม',
  already_running: 'กำลังดึงอยู่แล้ว',
  // bank — ป้ายเดียวกับฟอร์มในหน้าตั้งค่า
  sender_email: 'อีเมลผู้ส่ง',
  sender_domain: 'โดเมนผู้ส่ง',
  subject_monthly: 'หัวข้ออีเมลรายเดือน',
  subject_ondemand: 'หัวข้ออีเมลแบบขอเอง',
  attachment_filename_pattern: 'ชื่อไฟล์ PDF ที่แนบมา',
  parser_key: 'ตัวแกะข้อมูล',
  is_system: 'หมวดของระบบ',
  matched_by: 'จับคู่โดย',
  verified_at: 'ยืนยันเมื่อ',
  closed_snapshot: 'สรุปตอนปิดเดือน',
  deductions: 'รายการหัก',
  // installment_plan (+ ค่าที่ installmentDetail คำนวณเพิ่ม)
  financed_amount_satang: 'ยอดจัดผ่อน',
  down_payment_date: 'วันจ่ายเงินดาวน์',
  total_payable_satang: 'ยอดที่ต้องจ่ายทั้งหมด',
  paid_satang: 'จ่ายแล้ว',
  outstanding_satang: 'คงเหลือ',
  dues: 'งวด',
  // student_loan — ป้ายเดียวกับฟอร์มในหน้า กยศ.
  principal_original_satang: 'ยอดกู้ตามสัญญา',
  as_of_date: 'ข้อมูล ณ วันที่',
  principal_remaining_satang: 'เงินต้นคงเหลือ',
  interest_accrued_satang: 'ดอกเบี้ยค้าง',
  monthly_payment_satang: 'จ่าย กยศ. ต่อเดือน',
  monthly_saving_satang: 'เก็บออมต่อเดือน',
  savings_balance_satang: 'เงินเก็บที่มีอยู่แล้ว',
  app_annual_due_satang: 'ยอดครบกำหนดปีนี้ตามแอป',
  payoff_discount_bp: 'ส่วนลดเมื่อปิดบัญชี',
  payment_day: 'วันที่ชำระของทุกเดือน',
  // หน้าภาษี (ปิดอยู่ แต่แถวเก่ายังอ่านได้)
  vat_registered: 'จด VAT',
  tax_year: 'ปีภาษี',
  issuer_name: 'ผู้ออกเอกสาร',
  document_no: 'เลขที่เอกสาร',
  issue_date: 'วันที่ออกเอกสาร',
  subtotal_satang: 'ยอดก่อน VAT',
  vat_satang: 'VAT',
  total_satang: 'ยอดรวมในเอกสาร',
  withholding_satang: 'ภาษีหัก ณ ที่จ่าย',
  file_mime: 'ชนิดไฟล์',
  file_size_bytes: 'ขนาดไฟล์ (ไบต์)',
  original_filename: 'ชื่อไฟล์',
  retention_until: 'เก็บเอกสารถึง',
  source: 'ที่มา',
  rule_version: 'รุ่นกฎภาษี',
  calculated_at: 'คำนวณเมื่อ',
  deduction_type: 'ประเภทค่าลดหย่อน',
  eligible_amount_satang: 'ยอดที่มีสิทธิ์',
  claimed_amount_satang: 'ยอดที่ใช้สิทธิ์',
};

// ค่าเป็น regex/รหัสที่ต้องอ่านทีละตัวอักษร — แสดงเป็นฟอนต์ mono
const MONO_FIELDS = new Set(['subject_monthly', 'subject_ondemand', 'attachment_filename_pattern', 'parser_key']);

// ค่าของช่องแบบตัวเลือก — แปลเฉพาะช่องในชุดนี้ ไม่แปลข้อความอิสระ (โน้ตที่พิมพ์ว่า "income" ต้องแสดงตามที่พิมพ์)
const ENUM_FIELDS = new Set(['status', 'explicit_status', 'kind', 'classification', 'review_status', 'direction', 'account_purpose', 'amount_mode', 'frequency_unit', 'matched_by', 'source']);
const VALUE_LABEL: Record<string, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธแล้ว',
  active: 'ใช้งาน',
  skipped: 'ข้าม',
  cancelled: 'ยกเลิกแล้ว',
  open: 'เปิดอยู่',
  closed: 'ปิดแล้ว',
  declared: 'บันทึกจ่ายแล้ว',
  matched: 'จับคู่ธุรกรรมแล้ว',
  needs_review: 'ต้องตรวจ',
  suggested: 'ระบบเสนอ',
  confirmed: 'ยืนยันแล้ว',
  draft: 'ร่าง',
  verified: 'ตรวจแล้ว',
  submitted: 'ยื่นแล้ว',
  reviewed: 'ตรวจแล้ว',
  unreviewed: 'ยังไม่ตรวจ',
  income: 'รายรับ',
  expense: 'รายจ่าย',
  payroll_deduction: 'หักจากเงินเดือน',
  reserve: 'เงินกันไว้',
  internal_transfer: 'โอนภายใน',
  excluded: 'ไม่นับรวม',
  credit: 'เงินเข้า',
  debit: 'เงินออก',
  personal: 'ส่วนตัว',
  business: 'ธุรกิจ',
  fixed: 'ยอดคงที่',
  estimated: 'ประมาณการ',
  day: 'วัน',
  week: 'สัปดาห์',
  month: 'เดือน',
  year: 'ปี',
  completed: 'ผ่อนครบแล้ว',
  system: 'ระบบ',
  user: 'ผู้ใช้',
  gmail: 'Gmail',
  upload: 'อัปโหลดเอง',
};

// ช่องที่ไม่บอกอะไรคนอ่าน: เวลาระบบ, ธง/คะแนนภายในที่ route เติมมา (plan_status จาก loadOwnedItem, structural_editable
// จาก installmentDetail, auto_match ที่ไม่มีผลแล้ว, confidence ของตัวจับคู่โอน) และผลคำนวณภาษีทั้งก้อน (JSON ซ้อนหลายชั้น)
const HIDDEN_KEYS = new Set([
  'id', 'user_id', 'created_at', 'updated_at', 'plan_status', 'structural_editable', 'auto_match', 'confidence',
  'input_snapshot', 'result_snapshot',
]);

/**
 * ไม่แสดงในรายการที่เปลี่ยน: HIDDEN_KEYS, `*_enc` (ค่าเข้ารหัส — server ไม่ใส่แล้ว แต่แถวเก่าอาจยังมี) และ `*_id` ที่ไม่มีป้าย
 * (รหัสภายใน เช่น monthly_plan_id — คนอ่านไม่รู้ว่าเลขนี้คืออะไร) แอดมินยังเห็นทุกช่องยกเว้น `*_enc` ในข้อมูลดิบ (redactRaw)
 */
export const isHiddenField = (key: string) =>
  HIDDEN_KEYS.has(key) || key.endsWith('_enc') || (key.endsWith('_id') && !Object.hasOwn(FIELD_LABEL, key));

export const fieldLabel = (key: string) => (Object.hasOwn(FIELD_LABEL, key) ? FIELD_LABEL[key]! : key);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** id หมวด → ชื่อ จาก GET /api/categories (หมวดระบบ + ของผู้ใช้เอง รวมที่ปิดใช้แล้ว) */
export type CategoryNames = ReadonlyMap<number, string>;

/**
 * ค่าหนึ่งช่องเป็นข้อความที่อ่านรู้เรื่อง — เงิน (`*_satang`) เป็นบาท, basis point เป็น %, boolean/null เป็นคำ, วันที่แบบไทย,
 * category_id เป็นชื่อหมวด (`categories` ยังไม่มา/โหลดไม่ได้ = "ไม่ทราบชื่อหมวด", ไม่อยู่ในรายการ เช่นหมวดของผู้ใช้อื่น
 * ในโหมดทุกคน = "หมวดที่ไม่มีในรายการ") · object ไม่ dump JSON ให้คนอ่าน — ค่าทั้งก้อนอยู่ในข้อมูลดิบของแอดมิน
 */
export function formatFieldValue(key: string, value: unknown, categories?: CategoryNames): string {
  if (value == null || value === '') return 'ว่าง';
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่';
  if (key === 'category_id' && typeof value === 'number') {
    return categories ? categories.get(value) ?? 'หมวดที่ไม่มีในรายการ' : 'ไม่ทราบชื่อหมวด';
  }
  if (typeof value === 'number' && key.endsWith('_satang')) return `฿${formatBaht(value)}`;
  if (typeof value === 'number' && key.endsWith('_bp')) {
    return `${(value / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 })}%`;
  }
  if (typeof value === 'string') {
    const labels: Record<string, string> | undefined =
      key === 'tax_treatment' ? TAX_TREATMENT_LABEL : key === 'entity_type' ? TAX_ENTITY_TYPE_LABEL : key === 'document_type' ? DOCUMENT_TYPE_LABEL : undefined;
    if (labels) return labels[value] ?? value;
    if (ENUM_FIELDS.has(key)) return VALUE_LABEL[value] ?? value;
    if (DATE_RE.test(value)) return formatDate(value);
    if (TIMESTAMP_RE.test(value)) return formatDateTime(value);
    return value;
  }
  if (Array.isArray(value)) return `${value.length} รายการ`;
  if (key === 'closed_snapshot' && isRecord(value)) {
    // โครงจาก POST /monthly-plans/:month/close: { totals: PlanTotals, payment_status } — ตัวเลขเดียวกับการ์ดในหน้าวางแผน
    const available = isRecord(value.totals) ? value.totals.planned_available_satang : undefined;
    return typeof available === 'number' ? `เงินเหลือใช้ตามแผน ฿${formatBaht(available)}` : 'บันทึกสรุปเดือนไว้';
  }
  return typeof value === 'object' ? 'บันทึกไว้' : String(value);
}

export type FieldChange = { key: string; label: string; before: string | null; after: string | null; mono: boolean };

/**
 * ช่องที่เปลี่ยนระหว่าง before/after — มีทั้งสองฝั่ง = เฉพาะช่องที่ค่าต่างกัน, มีฝั่งเดียว (สร้าง/ลบ) = ทุกช่องที่มีค่า
 * (`before`/`after` เป็น null = ไม่มีฝั่งนั้น) · ฝั่งใดเป็น array (แบ่งยอดธุรกรรม) = เทียบเป็นจำนวนรายการช่องเดียว
 *
 * หลาย route ส่ง before แคบกว่า after (ยกเลิกบันทึกจ่าย: before 3 ช่อง, after ทั้งแถว) — ช่องที่ไม่มี key ในฝั่งหนึ่ง
 * (ไม่ใช่ค่า null) = ไม่ได้บันทึก ไม่ใช่ "ว่าง": ไม่มีใน before แสดงค่าหลังอย่างเดียว ไม่มีใน after ข้าม
 */
export function changedFields(before: unknown, after: unknown, categories?: CategoryNames): FieldChange[] {
  if (Array.isArray(before) || Array.isArray(after)) {
    const count = (v: unknown) => (Array.isArray(v) ? `${v.length} รายการ` : null);
    return [{ key: 'items', label: 'รายการ', before: count(before), after: count(after), mono: false }];
  }
  const b = isRecord(before) ? before : null;
  const a = isRecord(after) ? after : null;
  const keys = [...new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})])].filter((k) => !isHiddenField(k));
  const changes: FieldChange[] = [];
  for (const key of keys) {
    const inBefore = b != null && Object.hasOwn(b, key);
    const inAfter = a != null && Object.hasOwn(a, key);
    if (b && a && !inAfter) continue;
    const oldValue = b?.[key];
    const newValue = a?.[key];
    if (inBefore && inAfter) {
      if (JSON.stringify(oldValue ?? null) === JSON.stringify(newValue ?? null)) continue;
    } else if ((inBefore ? oldValue : newValue) == null) {
      continue; // ฝั่งเดียว (สร้าง/ลบ/ช่องที่ before ไม่ได้เก็บ): ช่องที่ว่างไม่ต้องแสดง
    }
    // ธง pdf_password_changed / tax_id_changed เป็น false ทุกครั้งที่แก้อย่างอื่น — แสดงเฉพาะตอนเปลี่ยนจริง
    if (key.endsWith('_changed') && newValue === false) continue;
    changes.push({
      key,
      label: fieldLabel(key),
      before: inBefore ? formatFieldValue(key, oldValue, categories) : null,
      after: inAfter ? formatFieldValue(key, newValue, categories) : null,
      mono: MONO_FIELDS.has(key),
    });
  }
  return changes;
}

export type ChangeSection = { title: string; changes: FieldChange[] };

/**
 * รายการที่เปลี่ยนแบ่งตามความหมาย: มีทั้งค่าเดิมและค่าใหม่ = "สิ่งที่เปลี่ยน" · มีแต่ค่าหลัง (สร้าง หรือช่องที่ before
 * ไม่ได้เก็บ เช่นยกเลิกบันทึกจ่าย) = "ข้อมูลที่บันทึก" · มีแต่ค่าก่อน (ลบ) = "ข้อมูลก่อนลบ" — ช่องที่ before ไม่ได้เก็บจึงไม่ปน
 * อยู่ใต้ "สิ่งที่เปลี่ยน" เหมือนถูกแก้ · ไม่มีส่วนไหนเลย = ไม่มีอะไรให้ผู้ใช้ทั่วไปดู
 */
export function changeSections(before: unknown, after: unknown, categories?: CategoryNames): ChangeSection[] {
  const changes = changedFields(before, after, categories);
  const titleOf = (c: FieldChange) => (c.before == null ? 'ข้อมูลที่บันทึก' : c.after == null ? 'ข้อมูลก่อนลบ' : 'สิ่งที่เปลี่ยน');
  return ['สิ่งที่เปลี่ยน', 'ข้อมูลที่บันทึก', 'ข้อมูลก่อนลบ']
    .map((title) => ({ title, changes: changes.filter((c) => titleOf(c) === title) }))
    .filter((s) => s.changes.length > 0);
}

/** ชื่อของสิ่งที่ถูกแตะ (บรรทัดรองของแถวที่พับ) จากค่าที่บันทึกไว้แล้ว — name → nickname → display_name ค่าหลังก่อนค่าเดิม */
export function entrySubject(before: unknown, after: unknown): string | null {
  for (const key of ['name', 'nickname', 'display_name']) {
    for (const side of [after, before]) {
      const value = isRecord(side) ? side[key] : undefined;
      if (typeof value === 'string' && value.trim() !== '') return value;
    }
  }
  return null;
}

/** ข้อมูลดิบสำหรับแอดมิน — ตัดช่อง `*_enc` แบบเดียวกับรายการที่เปลี่ยน */
export function redactRaw(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactRaw);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => !k.endsWith('_enc')).map(([k, v]) => [k, redactRaw(v)]));
}
