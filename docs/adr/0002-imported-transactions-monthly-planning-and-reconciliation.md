# 0002 — แยกขอบเขต Imported Ledger, Monthly Planning และ Tax อย่างเด็ดขาด

- สถานะ: ตัดสินใจแล้ว
- วันที่: 2026-09-02

## บริบท

Slice 4 ขยายระบบจากผู้นำเข้า statement อย่างเดียว ไปเป็นระบบจัดการการเงินที่มี Dashboard,
วางแผนรายเดือน และภาษี (`docs/plans/hyacinthia-ledger-feature-plan.md`, baseline commit `c147a68`)

ความเสี่ยงหลักคือการปนกันของข้อมูลสามชนิดที่ต่างกันโดยธรรมชาติ: เงินที่ **ยืนยันแล้วจริง** จาก statement,
เงินที่ผู้ใช้ **วางแผนหรือประกาศเอง** ก่อน statement มาถึง, และตัวเลขที่ใช้ **ประมาณการภาษี**
ถ้าปนกันโดยไม่ตั้งใจ ผลที่ตามมาคือรายได้นับซ้ำ, รายจ่ายปลอมที่ไม่มีเงินเคลื่อนไหวจริง,
หรือรายงานข้ามผู้ใช้ — ซึ่งทั้งหมดกระทบความน่าเชื่อถือของระบบการเงินโดยตรง

## การตัดสินใจ

แยกสามขอบเขตนี้อย่างเด็ดขาดในระดับ schema และ service layer ไม่ให้ mix กันแม้ในโค้ดชั่วคราว

1. **`txn` เป็นข้อมูลจริงจาก Statement เท่านั้น** ไม่มี endpoint ใดสร้างหรือแก้ `txn` ด้วยมือ
   ทุกแถวต้องผ่าน pipeline เดิม (Gmail → parser → checksum → เขียน `txn`) ที่ ADR-0001 วางไว้
   Slice 4 ต่อยอดด้วยการ "ตีความ" ผ่าน `txn_annotation`/`txn_split` แยกตาราง ไม่แก้ `txn` โดยตรง

2. **Monthly Planning เป็นข้อมูลคนละขอบเขตกับ `txn`** `monthly_plan`, `recurring_rule`,
   `monthly_plan_item` ไม่มีสิทธิ์สร้างหรือแก้ `txn` การเชื่อมโยงทำผ่าน reconciliation
   (`monthly_item_payment.txn_id`) เท่านั้น ซึ่งเป็นความสัมพันธ์แบบ "จับคู่ภายหลัง" ไม่ใช่ "เขียนทับ"

3. **Mark paid ใช้ Payment Declaration ไม่ใช่ transaction ปลอม** ผู้ใช้กด mark paid ก่อน statement
   มาถึงได้ (`monthly_item_payment.status = 'declared'`) แต่ต้องรอ statement จริงมาจับคู่ให้กลายเป็น
   `matched` — ห้ามสร้าง `txn` เพื่อทำให้ตัวเลขในหน้าจอดูสมบูรณ์ก่อนเวลา

4. **Reserve (เก็บ) ไม่ใช่ Expense** การกันงบไม่ใช่รายจ่ายและไม่ใช่การเคลื่อนไหวเงินจริง — ลดเฉพาะ
   "เงินเหลือใช้ตามแผน" ไม่เพิ่ม Expense Actual, ไม่ลด Bank Balance, ไม่เข้า Expense Chart, ไม่เข้า Tax Expense

5. **Gross Income แยกจาก Net Bank Credit เด็ดขาด** รายได้บันทึกเป็นยอดเต็มก่อน แล้วหักประกันสังคม/
   ภาษีหัก ณ ที่จ่าย/รายการหักอื่นภายหลัง (`income_record` → `income_deduction`) Dashboard กระแสเงินสด
   จริงใช้ Credit จาก `txn`, Monthly Plan ใช้ Gross หัก Deduction, Tax Report ใช้ Gross และ Withholding —
   ทั้งสามที่ต้องไม่ทับกันจนรายได้ถูกนับสองครั้ง

6. **ไม่มี Cash/e-Wallet Manual Transaction** ระบบรับเฉพาะ transaction จาก bank statement ตาม
   ADR-0001 เดิม — Slice 4 ไม่เปิดช่องให้พิมพ์ transaction เงินสดหรือ e-Wallet ที่ไม่มี statement ด้วยมือ
   ทุกหน้ารายงานต้องระบุชัดว่าไม่รวมเงินสดและ e-Wallet

7. **รายงานแยก User อย่างเด็ดขาด** ทุก endpoint ใช้ user จาก `requireUser` เท่านั้น ห้ามรับ `user_id`
   จาก body/query string ทุก query scope ด้วย user ที่ login อยู่ Admin จัดการสถานะผู้ใช้และข้อมูลธนาคาร
   ได้ แต่ไม่มีสิทธิ์เปิดดู transaction, monthly plan หรือ tax ของผู้ใช้คนใด — ต้องมี integration test
   ป้องกัน cross-user access ทุกครั้งที่เพิ่ม endpoint ใหม่

8. **Tax แยกตาม Tax Entity** ผู้ใช้หนึ่งคนมี tax entity ได้หลายรายการ (บุคคลธรรมดา/ร้านค้า/บริษัท)
   ห้ามรวมรายได้บุคคลธรรมดากับธุรกิจในผลคำนวณเดียวกัน bank account มี default tax entity แต่
   transaction override ได้ ผลคำนวณทุกครั้งใช้คำว่า "ประมาณการภาษี" ไม่ใช่ตัวเลขยื่นภาษีจริง

## ผลที่ตามมา

- ทุกตารางใหม่ต้องมี `user_id` โดยตรงหรืออ้างถึง parent ที่มี พร้อมตรวจ ownership ทุกครั้ง (ไม่มีข้อยกเว้น)
- Service layer ที่แตะมากกว่าหนึ่งขอบเขต (เช่น payment-reconciliation ที่จับคู่ planning กับ `txn`)
  ต้องเขียนแยกไฟล์ชัดเจน (`src/services/`) ไม่ผสมเข้าไปใน route handler โดยตรง
- การทดสอบต้องมี case ที่พิสูจน์ "ไม่ปนกัน" อย่างชัดเจน เช่น Reserve ไม่โผล่ใน expense chart,
  Mark paid ไม่มี `txn` เกิดขึ้นจริงในฐาน, Gross Income + Net Credit ไม่ถูกรวมเป็นรายได้สองก้อน
- Migration ที่เพิ่มความสัมพันธ์ข้ามขอบเขต (เช่น `bank_account.default_tax_entity_id` ที่ต้องรอ
  `tax_entity` เกิดก่อน) ให้เลื่อนไปทำในเฟสที่ตารางปลายทางมีอยู่แล้ว แทนที่จะสร้าง FK ค้างไว้ก่อน
