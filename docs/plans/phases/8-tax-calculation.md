# Slice 8 — Tax Calculation

> สถานะ: รอ Slice 7 เสร็จก่อน
> อ้างอิง §7.5 "Tax" (บางส่วน: `tax_deduction_claim`, `tax_calculation_snapshot`), §7.6 "Audit Log",
> §10.5 "Tax Calculation", §14 "Slice 8" ของ `docs/plans/hyacinthia-ledger-feature-plan.md`

## เป้าหมาย

สรุปรายได้ ค่าใช้จ่าย และค่าลดหย่อนตาม Entity และปีภาษี

## Migration

`009_tax_calculation_and_audit.sql` — `tax_deduction_claim`, `tax_calculation_snapshot`, `audit_log`

## งาน (§14)

- Tax Treatment (§10.2 — `personal`, `business_income`, `business_expense`, `non_deductible`,
  `internal_transfer`, `excluded`)
- Deduction Claims (§7.5 `tax_deduction_claim`)
- Versioned Tax Rules — แยก rule ตามปีภาษี (§10.5)
- Calculation Snapshot — เก็บทุกครั้งที่คำนวณ, ห้ามรวม Tax Entity คนละประเภทในผลเดียวกัน,
  ผลลัพธ์ต้องใช้คำว่า "ประมาณการภาษี" เสมอ (§7.5, §10.5)
- Missing-document Report — แสดงรายการที่ยังขาดเอกสารหรือยังไม่ review (§10.5)
- Tax Summary Dashboard — drill down ไปยัง Income Record, Transaction, Tax Document ได้ (§10.5)
- Export PDF/CSV (§10.5 — ในระยะที่กำหนด)
- Audit Log ครบทุกจุดตาม §7.6 (เปลี่ยน category/tax treatment, ยืนยัน/ยกเลิก transfer, mark paid,
  แก้ monthly plan/installment, เชื่อม tax document, แก้ค่าลดหย่อน, archive บัญชี, ดาวน์โหลดเอกสาร)

## Definition of Done (§14)

- คำนวณแยก Personal/Business
- แสดง Rule Version และ Input Snapshot
- ทุกยอด drill down ไปยังข้อมูลต้นทางได้
- ผลลัพธ์ระบุว่าเป็นประมาณการ

## กติกาที่พลาดไม่ได้ (§7.5)

Bank Debit ไม่ถือเป็นค่าใช้จ่ายหักภาษีได้โดยอัตโนมัติ — ผู้ใช้ต้องตรวจสอบและยืนยัน Tax Treatment เองเสมอ
