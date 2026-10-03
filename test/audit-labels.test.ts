// หน้า /audit แสดงป้ายไทยจาก web/src/auditLabels.ts — action ใหม่ที่ server เขียนแต่ไม่มีป้ายจะโผล่เป็น code ดิบ
// (และไม่อยู่ในตัวเลือกตัวกรอง) เทสต์นี้อ่าน literal ใน `action:` ของ src/ ทุกไฟล์แล้วเทียบกับแผนที่
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ACTION_LABEL, AUDIT_ACTIONS, ENTITY_LABEL, changedFields } from '../web/src/auditLabels.js';

const SRC = join(import.meta.dirname, '..', 'src');

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
