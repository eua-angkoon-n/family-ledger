# Slice 4A — Ledger Integrity

> สถานะ: T1–T8 เสร็จแล้ว ผ่าน `npm run test:db` (72 test) และ `ledger-reviewer` แล้ว 1 รอบ
> แผน ticket เต็มอยู่ที่ `C:\Users\scent\.claude\plans\docs-plans-hyacinthia-ledger-feature-pl-breezy-avalanche.md`
> อ้างอิง §14 "Slice 4A" และ §7.1 "Ledger Classification" ของ `docs/plans/hyacinthia-ledger-feature-plan.md`

## เป้าหมาย

ทำให้ `txn` มีความหมายพร้อมใช้สร้างรายงาน — จัดหมวดได้ แยกยอดได้ Internal Transfer ไม่ถูกนับซ้ำ
Archive บัญชีแล้วประวัติไม่หาย และพิสูจน์ได้ว่า User A เข้าถึงข้อมูล User B ไม่ได้

## ขอบเขต (ปรับจากแผนต้นฉบับ)

จบที่ระดับ **API + test** ไม่รวม UI จัดหมวด/รีวิว transaction — UI นั้นย้ายไปเป็นงานแรกของ 4B
เพราะ §19 ของแผนต้นฉบับวาง Transaction Review UI ไว้หลัง Cross-user Security Tests อยู่แล้ว
และ Transaction List API พร้อม filter/pagination เป็นงานของ 4B ตั้งแต่ต้น

UI เดียวที่แตะใน 4A คือเปลี่ยนปุ่ม "ลบบัญชี" เป็น "เก็บเข้าคลัง" (Archive) ใน `web/src/Accounts.tsx`

## Migration

`005_ledger_classification.sql` — `category`, `txn_annotation`, `txn_split`, `transfer_match`,
เพิ่มคอลัมน์ `txn.txn_time`, เพิ่มคอลัมน์ `bank_account.account_purpose`/`archived_at`
(รายละเอียดเต็มอยู่ใน §7.1 ของแผนต้นฉบับ — บาง field เช่น `source_row_no`, `source_fingerprint`,
`default_tax_entity_id` ถูกตัดออกจากรอบนี้โดยเจตนา ดูเหตุผลในแผน ticket)

## งาน (เรียงลำดับ T1–T8)

1. Test harness ต่อ Postgres จริง (ปลดล็อกทุกอย่าง)
2. Migration 005
3. แยก Router (`src/api.ts` → `src/routes/*`) + Parser Registry กลาง
4. Ledger Classification API (category, annotation, split, transfer-match)
5. Parser ปล่อย `txn_time` (SCB parser)
6. Archive แทน Hard Delete (backend → account-match → web)
7. Cross-user Authorization Tests
8. `ledger-reviewer` รีวิว diff รวม

## Definition of Done (จาก §14 ของแผนต้นฉบับ)

- ผู้ใช้จัดหมวดและแยกยอด Transaction ได้ (ผ่าน API)
- Internal Transfer ไม่ถูกนับเป็น Income/Expense (พิสูจน์ระดับ service — ยังไม่มี summary endpoint จนกว่าจะถึง 4B)
- User A เข้าถึงข้อมูล User B ไม่ได้ (integration test จริงบน Postgres)
- ไม่สูญเสียข้อมูลเมื่อ Archive บัญชี

## Test ที่ต้องผ่าน

รัน `npm run test:db` (ต่อ Postgres จริงผ่าน `docker-compose.test.yml`) — `npm test` เฉย ๆ ข้าม 4 ไฟล์ด้านล่างไปเงียบ ๆ

- Regression เดิมทั้ง 5 ไฟล์ (`crypto`, `auth`, `gmail`, `account-match`, `scb-parser`)
- `test/migrate.test.ts` — roll-forward บน DB ว่างและ DB ที่มีข้อมูลระดับ 004
- `test/transactions.test.ts` — category/annotation/split (รวมเช็คผลรวมเท่ากับ txn)/transfer-match confirm-reject
- `test/accounts.test.ts` — archive ไม่ลบแถวจริง, statement/txn ไม่หาย
- `test/authz.test.ts` — cross-user access ทุก endpoint ใหม่, admin อ่าน txn ไม่ได้

## ปัญหาที่พบจาก review รอบ T8 และแก้แล้ว

- **แก้แล้ว**: `POST /transfer-matches/:id/reject` บนคู่ที่เคย `confirmed` ไม่เคยล้าง `txn.is_internal_transfer`
  กลับเป็น `false` — flag ค้าง `true` ถาวรทั้งสองฝั่ง เพิ่ม test `reject หลัง confirm ต้องล้าง ... กลับ` คลุมไว้แล้ว
- **แก้แล้ว**: `npm test` เฉย ๆ ข้าม 4 ไฟล์ที่ต่อ Postgres จริงไปเงียบ ๆ (skip ไม่ error) ทำให้ DoD ข้อ
  authorization ดูเหมือนผ่านทั้งที่ไม่เคยถูกรันจริง — เพิ่ม `npm run test:db` (ใช้ `.env.test` แทน inline env var
  เพื่อไม่ผูกกับ shell) และเตือนไว้ใน `CONTEXT.md`
- **แก้แล้ว**: Admin เปลี่ยนสถานะผู้ใช้เป็น `rejected` จะ FK violation (23503) ถ้าผู้ใช้เคยเพิ่ม bank account
  มาก่อน (`bank_account.email_account_id` อ้าง `email_account` แบบไม่มี cascade ในทุก migration ตั้งแต่
  001 — ยืนยันแล้ว) บั๊กนี้มีมาตั้งแต่ Slice 1 แต่การเปลี่ยนจาก hard delete เป็น archive ใน T6 ปิดทางแก้ทางอ้อม
  ที่เคยมี (ผู้ใช้ลบบัญชีตัวเองก่อนได้) จนกลายเป็นบล็อกถาวรทุกกรณี — แก้โดยเลิกลบแถว `email_account` ตอน
  reject (revoke token ที่ Google เพียงพอแล้ว ไม่ต้องลบแถวของเราด้วย) เพิ่ม `test/admin.test.ts` คลุมไว้แล้ว

## ปัญหาที่พบแต่ตั้งใจไม่แก้ในรอบนี้ — ผู้ใช้ตัดสินใจแล้วว่ายกไปทำทีหลัง

1. **Archive แล้วเพิ่มบัญชีเลขเดิมซ้ำ = statement/txn ชุดเดิมถูกดึงเข้ามาซ้ำใต้ `bank_account` คนละแถว**
   ตัดสินใจแล้ว: บันทึกเป็น known limitation เท่านั้น ไม่สร้าง unarchive endpoint ใน 4A (YAGNI — ยังไม่มีใครขอ)
2. **`suggestTransferMatches` (T4) ยังไม่ถูกเรียกจากที่ไหนใน production path** (`src/worker.ts` ไม่เรียก)
   และไม่มี `GET /api/transfer-matches` ให้ list — กลไก confirm/reject ที่มีอยู่ใช้งานจริงไม่ได้จนกว่าจะต่อสาย
   ตัดสินใจแล้ว: ยกไปทำใน **Slice 4B** พร้อม Transaction Review UI (จุดที่ผู้ใช้จะเห็น/กดยืนยัน suggested
   match จริง ๆ) — เพิ่มเป็นงานแรกของ `docs/plans/phases/4b-dashboard.md` แล้ว
3. (low) `web/src/Admin.tsx` PATCH ส่งทั้งฟอร์ม — ธนาคารเดิมที่ `parser_key='kbank'` ค้างอยู่ (หลุดจาก
   registry ที่เหลือแค่ `scb`) จะแก้ไขฟิลด์ไหนก็ไม่ได้เพราะ validation reject ทั้งก้อน
4. (low) `PUT /transactions/:id/splits` ไม่รับ array ว่าง — ตั้ง split แล้วล้างคืนเป็นก้อนเดียวไม่ได้
