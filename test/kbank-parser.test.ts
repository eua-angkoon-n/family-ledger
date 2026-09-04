import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseKbankStatement } from '../src/parsers/kbank.js';

const monthly = readFileSync(new URL('./fixtures/kbank/monthly.txt', import.meta.url), 'utf8');
const request = readFileSync(new URL('./fixtures/kbank/request.txt', import.meta.url), 'utf8');
const empty = readFileSync(new URL('./fixtures/kbank/empty.txt', import.meta.url), 'utf8');

test('KBank รายเดือน: อ่านหลายหน้า รายการหลายบรรทัด และรายการแก้ไข', () => {
  const parsed = parseKbankStatement(monthly);

  assert.equal(parsed.layout, 'monthly');
  assert.equal(parsed.accountNumber, '111-1-11111-1');
  assert.equal(parsed.periodStart, '2026-08-01');
  assert.equal(parsed.periodEnd, '2026-08-31');
  assert.equal(parsed.openingBalanceSatang, 100_000);
  assert.equal(parsed.closingBalanceSatang, 115_000);
  assert.equal(parsed.transactions.length, 4);
  assert.equal(parsed.checksumValid, true);
  assert.deepEqual(
    parsed.transactions.map((txn) => [txn.direction, txn.amountSatang, txn.runningBalanceSatang]),
    [
      ['debit', 10_000, 90_000],
      ['credit', 30_000, 120_000],
      ['debit', 25_000, 95_000],
      ['credit', 20_000, 115_000],
    ],
  );
  assert.equal(parsed.transactions[2]!.channel, 'เครื่องรูดบัตร (EDC)/ E-Commerce');
  assert.equal(parsed.transactions[2]!.description, 'ชำระด้วยบัตรเดบิต: รหัสอ้างอิง EDC11111 ร้านค้าตัวอย่าง');
  assert.equal(parsed.transactions[3]!.description, 'รายการแก้ไข: รหัสอ้างอิง EDC22222');
  assert.equal(parsed.transactions[1]!.channel, 'MAKE by KBank');
  assert.equal(parsed.transactions[1]!.description, 'รับโอนเงิน: จาก X2222 บุคคลตัวอย่าง');
});

test('KBank แบบร้องขอ: เก็บหลายเดือนเป็น statement เดียว', () => {
  const parsed = parseKbankStatement(request);

  assert.equal(parsed.layout, 'ondemand');
  assert.equal(parsed.periodStart, '2026-05-01');
  assert.equal(parsed.periodEnd, '2026-07-31');
  assert.equal(parsed.transactions.length, 3);
  assert.equal(parsed.checksumValid, true);
});

test('KBank แบบร้องขอที่ออกโดย 777 ใช้ layout ondemand', () => {
  const parsed = parseKbankStatement(request.replace('ออกโดย K PLUS', 'ออกโดย 777'));

  assert.equal(parsed.layout, 'ondemand');
  assert.equal(parsed.checksumValid, true);
});

test('KBank statement ไม่มีรายการผ่าน checksum เมื่อยอดและจำนวนสอดคล้อง', () => {
  const parsed = parseKbankStatement(empty);

  assert.equal(parsed.transactions.length, 0);
  assert.equal(parsed.openingBalanceSatang, 57_500);
  assert.equal(parsed.closingBalanceSatang, 57_500);
  assert.equal(parsed.checksumValid, true);
});

test('KBank checksum ไม่ผ่านเมื่อ amount, running balance, closing, summary หรือ carry-forward ไม่ตรง', () => {
  assert.equal(parseKbankStatement(monthly.replace('100.00                   900.00', '100.01                   900.00')).checksumValid, false);
  assert.equal(parseKbankStatement(monthly.replace('100.00                   900.00', '100.00                   900.01')).checksumValid, false);
  assert.equal(parseKbankStatement(monthly.replace('ยอดยกไป 1,150.00', 'ยอดยกไป 1,150.01')).checksumValid, false);
  assert.equal(parseKbankStatement(monthly.replace('รวมถอนเงิน 2 รายการ 350.00', 'รวมถอนเงิน 2 รายการ 350.01')).checksumValid, false);
  assert.equal(parseKbankStatement(monthly.replace('รวมฝากเงิน 2 รายการ 500.00', 'รวมฝากเงิน 3 รายการ 500.00')).checksumValid, false);
  assert.equal(parseKbankStatement(monthly.replace('02-08-26       ยอดยกมา                                                              1,200.00', '02-08-26       ยอดยกมา                                                              1,200.01')).checksumValid, false);
  assert.equal(parseKbankStatement(monthly.replace('02-08-26       ยอดยกมา                                                              1,200.00\n', '')).checksumValid, false);
});

test('KBank ปฏิเสธ account/period ไม่ถูกต้องและธุรกรรมนอกช่วง', () => {
  assert.throws(() => parseKbankStatement(monthly.replace('เลขที่บัญชีเงินฝาก', 'เลขบัญชี')));
  assert.throws(() => parseKbankStatement(monthly.replace('111-1-11111-1', '111-111111-1')));
  assert.throws(() => parseKbankStatement(monthly.replace('01/08/2026 - 31/08/2026', '31/08/2026 - 01/08/2026')));
  assert.throws(() => parseKbankStatement(monthly.replace('04-08-26 12:00', '04-09-26 12:00')));
});
