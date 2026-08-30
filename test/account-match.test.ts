import assert from 'node:assert/strict';
import test from 'node:test';
import { accountMatches, findMaskedAccountCandidates, resolveAccount } from '../src/account-match.js';

test('mask ของ K PLUS ปิดหลักท้ายด้วย — ต้องเทียบตามตำแหน่ง ไม่ใช่ suffix', () => {
  assert.equal(accountMatches('123-4-56231-7', 'xxx-x-x6231-x'), true);
  assert.equal(accountMatches('1234562317', 'xxx-x-x6231-x'), true);
});

test('หลักที่เห็นตรงแต่คนละตำแหน่ง ต้องไม่ผ่าน', () => {
  assert.equal(accountMatches('623-1-11111-1', 'xxx-x-x6231-x'), false);
});

test('บัญชีอื่นที่ต่างแค่หลักที่ถูกเปิด ต้องไม่ผ่าน', () => {
  assert.equal(accountMatches('123-4-56232-7', 'xxx-x-x6231-x'), false);
});

test('mask สั้นกว่า (****1234) ถอยไปเทียบท้าย', () => {
  assert.equal(accountMatches('123-4-56231-7', '******2317'), true); // ยาวเท่ากัน หลักท้าย 4 ตัวตรงตำแหน่ง
  assert.equal(accountMatches('123-4-56231-7', '******9999'), false);
  assert.equal(accountMatches('123-4-56231-7', '***2317'), true);
  assert.equal(accountMatches('123-4-56231-7', '***9999'), false);
});

test('เห็นน้อยกว่า 4 หลักในโหมด fallback ไม่พอจะยืนยัน', () => {
  assert.equal(accountMatches('123-4-56231-7', '***17'), false);
});

test('กำกวมคือคืน null ไม่ใช่เดา', () => {
  const accounts = [{ account_number: '123-4-56231-7' }, { account_number: '999-9-96231-9' }];
  assert.equal(resolveAccount(accounts, 'xxx-x-x6231-x'), null);
  assert.equal(resolveAccount(accounts, 'xxx-x-x6231-7'), accounts[0]);
});

test('findMaskedAccountCandidates จับ mask ที่ขึ้นต้นด้วย x/* ได้ ไม่ใช่แค่ขึ้นต้นด้วยเลข', () => {
  assert.deepEqual(findMaskedAccountCandidates('เลขที่บัญชี xxx-x-x6231-x ยอดคงเหลือ'), ['xxx-x-x6231-x']);
  assert.deepEqual(findMaskedAccountCandidates('บัญชี ******2317 ยอดยกมา'), ['******2317']);
});

test('findMaskedAccountCandidates ไม่หยิบวันที่หรือเลขล้วนที่ไม่มี mask', () => {
  assert.deepEqual(findMaskedAccountCandidates('วันที่ 27-08-2026 จำนวนเงิน 1234567890 บาท'), []);
});
