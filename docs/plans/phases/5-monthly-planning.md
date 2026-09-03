# Slice 5 — Monthly Planning

> สถานะ: รอ 4B เสร็จก่อน
> อ้างอิง §7.2 "Monthly Planning" (schema), §9 "Monthly Planning Requirements", §14 "Slice 5"
> ของ `docs/plans/hyacinthia-ledger-feature-plan.md`

## เป้าหมาย

แทนตารางรายเดือนในรูปเดิมด้วยระบบที่คำนวณได้

## Migration

`006_monthly_planning.sql` — `monthly_plan`, `recurring_rule`, `monthly_plan_item`, `monthly_item_payment`
(รายละเอียดคอลัมน์เต็มใน §7.2)

## งาน (§14)

- Monthly Plan ตามเดือนปฏิทิน (§9.1)
- Recurring Rule — รองรับความถี่วัน/สัปดาห์/เดือน/ปี, วันที่ 29–31 ในเดือนสั้นใช้วันสุดท้าย, idempotent (§9.2, §7.2)
- One-off Item — เพิ่มเฉพาะเดือนโดยไม่สร้าง recurring rule, copy จากเดือนก่อน (§9.3)
- Reserve — ลดเงินเหลือใช้ตามแผน แต่ไม่เป็น Expense/ไม่ลด Bank Balance/ไม่เข้า Chart/ไม่เข้า Tax (§9.4)
- Mark paid ก่อน Statement มาถึง + Payment Reconciliation (§9.5 — เกณฑ์ matching 6 ข้อ)
- Partial Payment
- Monthly Closing — ปิดเดือนแล้วแก้ได้เฉพาะผ่าน Explicit Reopen, Recurring Rule ที่แก้ภายหลังห้ามย้อนแก้เดือนปิดแล้ว (§9.6)

## Definition of Done (§14)

- ผู้ใช้สร้างรายการประจำและเฉพาะเดือนได้
- Reserve ลดเงินเหลือใช้แต่ไม่เป็น Expense
- Mark paid ไม่สร้าง `txn`
- Payment ถูกจับคู่กับ Statement ภายหลังได้

## กติกาเฉพาะที่ต้องคุมตั้งแต่ design

Mark paid ห้ามสร้าง `txn` ปลอมเด็ดขาด (§3 ข้อ 5) — Planning ห้ามสร้างหรือแก้ `txn` (§5.2)
