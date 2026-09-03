# Slice 4B — Dashboard และ Transaction Review

> สถานะ: **เสร็จแล้ว** (2026-09-03) — รายละเอียดที่ปิดจริง/ยกไป Slice อื่น/ข้อจำกัดที่รู้ตัว อยู่ที่
> `docs/status.md` หัวข้อ "Slice 4B — Dashboard + Transaction Review"
> อ้างอิง §8 "Dashboard Requirements" และ §14 "Slice 4B" ของ `docs/plans/hyacinthia-ledger-feature-plan.md`

## เป้าหมาย

แสดงรายงานเงินจริงจาก Statement ที่ตรวจสอบย้อนกลับได้

## Prerequisite ที่ค้างจาก 4A

- **ต่อสาย `suggestTransferMatches` เข้า production path** — ตอนนี้ (`src/services/transfer-matching.ts`)
  ยังไม่ถูกเรียกจากที่ไหนเลย ต้องเรียกหลัง `syncEmailAccount` เขียน `txn` เสร็จ (ที่ไหนสักจุดใน
  `src/worker.ts`) และเพิ่ม `GET /api/transfer-matches?status=suggested` ให้ list — ไม่งั้น confirm/reject
  ที่มีอยู่แล้วใน 4A ใช้งานจริงไม่ได้เพราะหา `:id` มายิงไม่ได้เลย **ทำก่อนงานอื่นในเฟสนี้** (ผู้ใช้ตัดสินใจแล้ว
  ตอนปิด 4A — ดู `docs/plans/phases/4a-ledger-integrity.md`)
- **Transaction Review UI** — ย้ายมาจาก 4A เป็นงานแรกของเฟสนี้ (จัดหมวด/แยกยอด/ยืนยัน transfer ผ่านหน้าเว็บ
  — นี่คือจุดที่ผู้ใช้จะเห็นและกดยืนยัน suggested transfer match จริง ๆ เป็นครั้งแรก)
- **ติดตั้ง react-router** — เลื่อนมาจาก 4A เพราะ 4A ไม่มีหน้าใหม่ที่ต้องแชร์ URL แต่ Dashboard/Transactions
  ต้องแชร์ filter ผ่าน URL ตาม §12.3 (`/dashboard?month=2026-09`, `/transactions?account=12&from=...`)

## งาน (จาก §14)

- Transaction List API พร้อม Filter/Pagination (§8.3, §8.4 — server-side pagination บังคับ)
- Monthly Summary API (§8.2 — Planning / Actual Bank Data / Payment Status / Data Quality cards)
- Data Freshness และ Statement Health (§8.1, §8.2 Data Quality)
- Dashboard Cards, Transaction Table (§8.2, §8.3)
- Income/Expense Chart, Category Chart, Account Balance Trend (§8.5 — ลำดับความสำคัญ 1–3 ก่อน)
- ทุก Chart ต้อง drill down ไปยัง transaction ต้นทางได้ (§8.5)
- ทุกหน้ารายงานต้องมีข้อความ "ไม่รวมเงินสดและ e-Wallet" (§8.6)

## Definition of Done (§14)

- [x] ผู้ใช้เห็นเงินเข้า เงินออก และยอดคงเหลือของตนเอง
- [x] รายงานไม่นับ Internal Transfer
- [x] ทุก Summary drill down ไปยังรายการต้นทางได้ (ยกเว้น `total_balance_satang` — ดูข้อจำกัดใน `docs/status.md`)
- [x] แสดงวันที่ข้อมูลล่าสุดของแต่ละบัญชี

## หมายเหตุ

ADR บันทึกว่า `DESIGN.md` (dark-first, `#70adfb`, MUI) เป็นของจริงทับ
`docs/plans/personalfinancesystemplan.md` §3 ออกแล้วที่
`docs/adr/0003-design-md-supersedes-personalfinancesystemplan-section-3.md`

## ยกไป Slice อื่น (ตั้งใจ)

- Planning + Payment Status card (§8.2) → Slice 5 (ไม่มีตาราง planning จนกว่าจะถึงเฟสนั้น)
- คอลัมน์ Monthly Plan Item (§8.3) → Slice 5
- filter Tax Entity / Tax Document (§8.4) → Slice 7 (ไม่มีตาราง tax จนกว่าจะถึงเฟสนั้น)

UI แสดงสามอันนี้เป็น placeholder ปิดอยู่พร้อมป้ายบอก Slice ที่จะมาแทน ไม่ใช่ซ่อนเงียบ

## ข้อจำกัดที่รู้ตัว

รายการเต็มอยู่ที่ `docs/status.md` (หัวข้อเดียวกับด้านบน) สรุปสั้น: `classification='excluded'`
reconcile ระหว่างรายงานกับรายการไม่ได้, กฎ data-coverage จับได้แค่บัญชีตกหลังปลายช่วง (ไม่จับรูช่วงกลาง),
ไม่มี index user-wide สำหรับ pagination, `counterparty` ค้นไม่ได้ (เป็น NULL เสมอ), และยังไม่ได้ทดสอบ
ด้วยตา/browser จริง (environment ไม่มี browser automation tool)
