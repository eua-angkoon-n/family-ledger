// §9.2 + §15.1: การกางรายการประจำเป็นวันครบกำหนดในเดือนหนึ่ง เป็นฟังก์ชัน pure ไม่แตะ DB
// จึงรันใน `npm test` เฉย ๆ ได้ (src/services/recurring-generation.ts ตั้งใจไม่ import src/db.js)
import assert from 'node:assert/strict';
import test from 'node:test';
import { occurrencesInMonth, type RecurrenceSpec } from '../src/services/recurring-generation.js';

function rule(over: Partial<RecurrenceSpec>): RecurrenceSpec {
  return {
    frequency_unit: 'month',
    frequency_interval: 1,
    anchor_day: null,
    start_date: '2026-01-01',
    end_date: null,
    ...over,
  };
}

test('occurrencesInMonth', async (t) => {
  await t.test('รายเดือน anchor 31 → เดือนสั้นใช้วันสุดท้าย และไม่ drift', () => {
    const r = rule({ anchor_day: 31, start_date: '2026-01-31' });
    assert.deepEqual(occurrencesInMonth(r, '2026-01-01'), ['2026-01-31']);
    assert.deepEqual(occurrencesInMonth(r, '2026-02-01'), ['2026-02-28']);
    assert.deepEqual(occurrencesInMonth(r, '2026-04-01'), ['2026-04-30']);
    // ผ่านเดือนสั้นมาแล้วต้องกลับเป็น 31 ไม่ใช่ค้างที่ 28/30 (anchor เก็บไว้ ไม่ใช่ค่าที่ clamp แล้ว)
    assert.deepEqual(occurrencesInMonth(r, '2026-07-01'), ['2026-07-31']);
  });

  await t.test('รายเดือน anchor 29 → ก.พ. ปีอธิกสุรทินได้ 29 ปีปกติได้ 28', () => {
    const r = rule({ anchor_day: 29, start_date: '2024-01-29' });
    assert.deepEqual(occurrencesInMonth(r, '2024-02-01'), ['2024-02-29']);
    assert.deepEqual(occurrencesInMonth(r, '2026-02-01'), ['2026-02-28']);
  });

  await t.test('anchor_day เป็น null → ใช้วันของ start_date', () => {
    const r = rule({ start_date: '2026-01-15' });
    assert.deepEqual(occurrencesInMonth(r, '2026-03-01'), ['2026-03-15']);
  });

  await t.test('รายเดือนทุก 3 เดือน นับรอบจากเดือนของ start_date', () => {
    const r = rule({ frequency_interval: 3, anchor_day: 31, start_date: '2026-01-31' });
    assert.deepEqual(occurrencesInMonth(r, '2026-01-01'), ['2026-01-31']);
    assert.deepEqual(occurrencesInMonth(r, '2026-02-01'), []);
    assert.deepEqual(occurrencesInMonth(r, '2026-03-01'), []);
    assert.deepEqual(occurrencesInMonth(r, '2026-04-01'), ['2026-04-30']);
    assert.deepEqual(occurrencesInMonth(r, '2026-07-01'), ['2026-07-31']);
  });

  await t.test('รายปีจาก 29 ก.พ. → ปีปกติได้ 28 ก.พ. ปีอธิกสุรทินได้ 29', () => {
    const r = rule({ frequency_unit: 'year', start_date: '2024-02-29' });
    assert.deepEqual(occurrencesInMonth(r, '2024-02-01'), ['2024-02-29']);
    assert.deepEqual(occurrencesInMonth(r, '2025-02-01'), ['2025-02-28']);
    assert.deepEqual(occurrencesInMonth(r, '2028-02-01'), ['2028-02-29']);
    assert.deepEqual(occurrencesInMonth(r, '2026-03-01'), []);
  });

  await t.test('รายปีทุก 2 ปี', () => {
    const r = rule({ frequency_unit: 'year', frequency_interval: 2, start_date: '2026-06-10' });
    assert.deepEqual(occurrencesInMonth(r, '2026-06-01'), ['2026-06-10']);
    assert.deepEqual(occurrencesInMonth(r, '2027-06-01'), []);
    assert.deepEqual(occurrencesInMonth(r, '2028-06-01'), ['2028-06-10']);
  });

  await t.test('รายวันทุก 10 วัน เดินจาก start_date ข้ามเดือนได้ถูก', () => {
    // 01-01, 01-11, 01-21, 01-31, 02-10, 02-20, 03-02
    const r = rule({ frequency_unit: 'day', frequency_interval: 10, start_date: '2026-01-01' });
    assert.deepEqual(occurrencesInMonth(r, '2026-02-01'), ['2026-02-10', '2026-02-20']);
    assert.deepEqual(occurrencesInMonth(r, '2026-03-01'), ['2026-03-02', '2026-03-12', '2026-03-22']);
  });

  await t.test('รายวันทุกวันได้ทุกวันในเดือน', () => {
    const r = rule({ frequency_unit: 'day', start_date: '2026-01-01' });
    const feb = occurrencesInMonth(r, '2026-02-01');
    assert.equal(feb.length, 28);
    assert.equal(feb[0], '2026-02-01');
    assert.equal(feb.at(-1), '2026-02-28');
  });

  await t.test('รายสัปดาห์ทุก 2 สัปดาห์ ไม่สน anchor_day', () => {
    const r = rule({ frequency_unit: 'week', frequency_interval: 2, anchor_day: 31, start_date: '2026-09-01' });
    assert.deepEqual(occurrencesInMonth(r, '2026-09-01'), ['2026-09-01', '2026-09-15', '2026-09-29']);
    assert.deepEqual(occurrencesInMonth(r, '2026-10-01'), ['2026-10-13', '2026-10-27']);
  });

  await t.test('เดือนก่อน start_date ไม่มีรายการ', () => {
    assert.deepEqual(occurrencesInMonth(rule({ start_date: '2026-05-01' }), '2026-04-01'), []);
    // start_date อยู่กลางเดือนแต่ anchor เป็นวันที่ 1 → occurrence เดือนนั้นตกก่อน start_date จึงไม่นับ
    const r = rule({ anchor_day: 1, start_date: '2026-01-15' });
    assert.deepEqual(occurrencesInMonth(r, '2026-01-01'), []);
    assert.deepEqual(occurrencesInMonth(r, '2026-02-01'), ['2026-02-01']);
  });

  await t.test('end_date ตัดท้าย (inclusive)', () => {
    const r = rule({ anchor_day: 15, start_date: '2026-01-15', end_date: '2026-02-14' });
    assert.deepEqual(occurrencesInMonth(r, '2026-01-01'), ['2026-01-15']);
    assert.deepEqual(occurrencesInMonth(r, '2026-02-01'), []);

    const daily = rule({ frequency_unit: 'day', start_date: '2026-09-28', end_date: '2026-10-02' });
    assert.deepEqual(occurrencesInMonth(daily, '2026-10-01'), ['2026-10-01', '2026-10-02']);
  });

  await t.test('frequency_interval ที่ใช้ไม่ได้ต้อง throw ไม่ใช่คืน [] เงียบ ๆ หรือวน infinite', () => {
    assert.throws(() => occurrencesInMonth(rule({ frequency_interval: 0 }), '2026-01-01'));
    assert.throws(() => occurrencesInMonth(rule({ frequency_unit: 'day', frequency_interval: -1 }), '2026-01-01'));
  });
});
