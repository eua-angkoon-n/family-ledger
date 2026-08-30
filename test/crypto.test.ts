import assert from 'node:assert/strict';
import test from 'node:test';

process.env.ENCRYPTION_KEY = '0'.repeat(64);
const { encrypt, decrypt } = await import('../src/crypto.js');

test('round-trip ข้อความไทยและอักขระพิเศษ', () => {
  const secret = 'รหัส PDF ๑๒๓ !@#$';
  assert.equal(decrypt(encrypt(secret)), secret);
});

test('ciphertext ไม่ซ้ำกันแม้ plaintext เดียวกัน', () => {
  assert.notEqual(encrypt('same'), encrypt('same'));
});

test('ciphertext ที่ถูกแก้ต้องถอดไม่ผ่าน ไม่ใช่คืนขยะ', () => {
  const [iv, tag, body] = encrypt('รหัสผ่าน').split('.') as [string, string, string];
  const flipped = Buffer.from(body, 'base64');
  flipped[0] ^= 0x01;
  assert.throws(() => decrypt(`${iv}.${tag}.${flipped.toString('base64')}`));
});

test('คีย์ผิดขนาดต้องล้มทันที ไม่ใช่เข้ารหัสด้วยคีย์อ่อน', () => {
  process.env.ENCRYPTION_KEY = 'abcd';
  assert.throws(() => encrypt('x'), /64/);
  process.env.ENCRYPTION_KEY = '0'.repeat(64);
});
