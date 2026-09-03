import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseScbStatement } from '../src/parsers/scb.js';

const monthly = readFileSync(new URL('./fixtures/scb/monthly.txt', import.meta.url), 'utf8');
const ondemand = readFileSync(new URL('./fixtures/scb/ondemand.txt', import.meta.url), 'utf8');
const monthlyCreditOnly = readFileSync(new URL('./fixtures/scb/monthly-credit-only.txt', import.meta.url), 'utf8');
const ondemandEmpty = readFileSync(new URL('./fixtures/scb/ondemand-empty.txt', import.meta.url), 'utf8');
const ondemandLegacy = readFileSync(new URL('./fixtures/scb/ondemand-legacy.txt', import.meta.url), 'utf8');
const ondemandLegacyEmpty = readFileSync(new URL('./fixtures/scb/ondemand-legacy-empty.txt', import.meta.url), 'utf8');

function assertJuneStatement(parsed: ReturnType<typeof parseScbStatement>): void {
  assert.equal(parsed.periodStart, '2026-06-01');
  assert.equal(parsed.periodEnd, '2026-06-30');
  assert.equal(parsed.openingBalanceSatang, 0);
  assert.equal(parsed.closingBalanceSatang, 0);
  assert.equal(parsed.checksumValid, true);
  assert.deepEqual(
    parsed.transactions.map((t) => [t.txnDate, t.direction, t.amountSatang, t.runningBalanceSatang]),
    [
      ['2026-06-25', 'credit', 34, 34],
      ['2026-06-30', 'credit', 177_038, 177_072],
      ['2026-06-30', 'debit', 177_072, 0],
    ],
  );
}

function assertJuneTxnTimes(parsed: ReturnType<typeof parseScbStatement>, expected: (string | null)[]): void {
  assert.deepEqual(
    parsed.transactions.map((t) => t.txnTime),
    expected,
  );
}

test('SCB รายเดือน: แกะปี พ.ศ. บัญชีปิดบัง และคอลัมน์ถอน/ฝาก', () => {
  const parsed = parseScbStatement(monthly);
  assert.equal(parsed.accountNumber, 'XXXX567890');
  assert.equal(parsed.layout, 'monthly');
  assertJuneStatement(parsed);
  assertJuneTxnTimes(parsed, ['00:00:00', '10:22:00', '10:36:00']);
});

test('SCB ย้อนหลัง: แกะช่วงเวลา บัญชีเต็ม และอนุมาน debit/credit จาก running balance', () => {
  const parsed = parseScbStatement(ondemand);
  assert.equal(parsed.accountNumber, '123-456789-0');
  assert.equal(parsed.layout, 'ondemand');
  assertJuneStatement(parsed);
  assertJuneTxnTimes(parsed, ['00:00', '10:22', '10:36']);
});

test('SCB checksum: ตัวเลขรายการผิดหนึ่งสตางค์ต้องไม่ผ่าน gate', () => {
  const tampered = monthly.replace('+1,770.38', '+1,770.37');
  assert.equal(parseScbStatement(tampered).checksumValid, false);
});

test('SCB รายเดือน: summary มีเฉพาะเครดิตฝั่งเดียวได้', () => {
  const parsed = parseScbStatement(monthlyCreditOnly);
  assert.equal(parsed.transactions.length, 1);
  assert.equal(parsed.transactions[0]!.direction, 'credit');
  assert.equal(parsed.checksumValid, true);
});

test('SCB ย้อนหลังที่ไม่มีรายการและไม่มี opening balance ต้อง parse ได้แต่ไม่ผ่าน checksum gate', () => {
  const parsed = parseScbStatement(ondemandEmpty);
  assert.equal(parsed.periodStart, '2026-01-01');
  assert.equal(parsed.transactions.length, 0);
  assert.equal(parsed.checksumValid, false);
});

test('SCB ย้อนหลังรุ่นเก่า: code/channel อยู่ช่องเดียวและเวลาอยู่บรรทัดถัดไป', () => {
  const parsed = parseScbStatement(ondemandLegacy);
  assert.equal(parsed.layout, 'ondemand');
  assert.equal(parsed.accountNumber, '123-456789-0');
  assert.equal(parsed.transactions.length, 2);
  assert.deepEqual(parsed.transactions.map((txn) => txn.direction), ['credit', 'debit']);
  assert.deepEqual(parsed.transactions.map((txn) => txn.txnTime), ['17:43', '17:56']);
  assert.equal(parsed.checksumValid, true);
});

test('SCB ย้อนหลังรุ่นเก่าที่ No data ต้อง parse ช่วงเวลาได้แต่ไม่ผ่าน checksum gate', () => {
  const parsed = parseScbStatement(ondemandLegacyEmpty);
  assert.equal(parsed.periodStart, '2024-09-01');
  assert.equal(parsed.periodEnd, '2024-09-13');
  assert.equal(parsed.transactions.length, 0);
  assert.equal(parsed.checksumValid, false);
});
