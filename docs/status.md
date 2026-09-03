# สถานะงาน — 2026-09-03

ข้อบังคับและท่อข้อมูลอยู่ที่ `CONTEXT.md` · การตัดสินใจอยู่ที่ `docs/adr/0001-statement-pdf-ingestion.md`
และ `docs/adr/0002-imported-transactions-monthly-planning-and-reconciliation.md`

## Git

- 12 commit บน `master`, ล่าสุด `c147a68 feat: rebrand to Hyacinthia Ledger and promote accounts nav`
- หลัง Slice 1–3 มีงาน rebrand เป็น "Hyacinthia Ledger" และ redesign หน้าเว็บทั้งหมดด้วย MUI
  (โฟลเดอร์/`package.json` ยังชื่อ `family-ledger` — ยังไม่ได้ตามรีเนม)
- PDF, `.eml`, `.env` และ `data/` ถูก ignore ไม่เข้า git

## Slice 1 — โครงระบบ: เสร็จ

- PostgreSQL + migration runner
- Google OAuth, invite code, session, สิทธิ์ user/admin
- เข้ารหัส refresh token และรหัสผ่าน PDF ด้วย AES-256-GCM
- Docker image มี qpdf + pdftotext, app publish เฉพาะ `127.0.0.1:3001`
- หน้า admin CRUD ธนาคาร/ผู้ใช้ และหน้า user CRUD บัญชีธนาคาร

## Slice 2 — ท่อรับอีเมล: เสร็จและผ่าน Gmail จริง

- poll Gmail, incremental history + full-sync fallback
- ตรวจ From + DKIM จาก `Authentication-Results` ของ `mx.google.com`
- SCB ส่ง PDF เป็น `application/octet-stream`: รับเฉพาะชื่อที่ตรง patternและ magic bytes `%PDF-`
- รองรับหลาย PDF ต่ออีเมล (อีเมลย้อนหลัง SCB จริงแนบ 8 ไฟล์)
- dedup ไฟล์ด้วย SHA-256 ของ PDF เข้ารหัส เพราะ Gmail `attachmentId` เปลี่ยนได้ระหว่างการอ่าน
- PDF ที่ถอดรหัสแล้วไหลผ่าน `qpdf | pdftotext` เท่านั้น ไม่ลงดิสก์

## Slice 3 — SCB parser + checksum + txn: เสร็จและผ่าน E2E

รองรับ layout ที่พบจริง 3 แบบ:

1. e-Passbook รายเดือน — ปี พ.ศ., บัญชีปิดบัง, คอลัมน์ถอน/ฝาก
2. Statement ย้อนหลังรุ่นปัจจุบัน — ช่วงวันที่/บัญชีเต็ม, Debit/Credit, running balance
3. Statement ย้อนหลังรุ่นเก่า — code/channel ช่องเดียวและเวลาอยู่บรรทัดถัดไป

รองรับ edge case ที่พบระหว่าง full sync:

- event จำนวนเงิน `0.00` เช่น onboarding — ไม่นับเป็น `txn`
- เดือนที่มีเฉพาะเครดิตหรือเดบิต
- statement `No data` / ไม่มี opening balance — parse ช่วงเวลาได้ แต่ตั้ง `checksum_failed` โดยไม่เดายอด
- statement รายเดือนและย้อนหลังทับเดือนกัน — เก็บ artifact ทั้งคู่และ dedup ที่ `txn`

ผลตรวจระบบจริง:

- full sync สแกน 31 อีเมล
- เก็บ statement ไม่ซ้ำ 38 PDF (`pdf_sha256` ไม่ซ้ำ 38 ค่า)
- `parsed` 36 statement
- `checksum_failed` 2 statement — ทั้งสองไม่มีรายการและไม่มี opening balance จึงตรวจยอดไม่ได้
- เขียน `txn` 78 แถว, จำนวนเงินต่ำสุด 1 สตางค์
- dedup รายการที่ทับกัน 39 แถว
- full sync รอบถัดไป: `statements_inserted: 0`; จำนวน statement/txn ไม่เพิ่ม
- automated tests และ production build ผ่าน

## ยังไม่ได้ยืนยัน

- statement หลายหน้า (ตัวอย่างทั้งหมดที่พบเป็นหน้าเดียว)
- `/auth/google?add=1` สำหรับกล่องอีเมลใบที่สอง
- หลายบัญชี SCB ในกล่องเดียวกันแบบ E2E (โค้ดจับคู่เลขบัญชีเต็ม/ปิดบังรองรับแล้ว)

## ตั้งค่า local ที่ต้องแก้ก่อน deploy

`docker-compose.yml` ใช้ `NODE_ENV: development` เพื่อทดสอบผ่าน HTTP localhost ก่อน deploy หลัง Caddy/HTTPS
ต้องเปลี่ยนเป็น `production` เพื่อให้ session cookie เป็น `secure:true`

## Requirement ที่ยังไม่มี Slice รองรับ

- Tax Invoice / `TaxInvoiceRecord`
- audit log การเข้าถึงและแก้ไขข้อมูล
- `txn.category_id` และตาราง category

## Slice 4+ — วางแผนแล้ว แตกเป็นเอกสารรายเฟส

แผนเต็ม (`docs/plans/hyacinthia-ledger-feature-plan.md`) ใหญ่เกินจะทำรอบเดียว แตกเป็น
`docs/plans/phases/README.md` + ไฟล์ต่อเฟส (4A–8) ตามลำดับพึ่งพา §19 ของแผนเดิม

**Slice 4A — Ledger Integrity: T1–T8 เสร็จแล้ว** (`docs/plans/phases/4a-ledger-integrity.md`)

- test harness ต่อ Postgres จริง (`npm run test:db`), migration 005, แยก router + parser registry,
  ledger classification API (category/annotation/split/transfer-match), `txn_time`, archive แทน hard delete,
  cross-user authz tests, ผ่าน `ledger-reviewer` แล้ว 1 รอบ (73 test ผ่านหมด)
- บั๊กที่เจอระหว่าง review และแก้แล้วทั้งหมด: reject transfer-match ไม่ล้าง `is_internal_transfer`,
  `npm test` ข้าม Postgres test ไปเงียบ ๆ (เพิ่ม `npm run test:db`), admin reject ผู้ใช้ที่มี bank account
  ชน FK 23503 ถาวร (Slice 1 เดิมแต่ archive ใน T6 ปิดทางแก้ทางอ้อม)
- ตัดสินใจแล้ว: archive ยังไม่มี unarchive ใน 4A (known limitation), `suggestTransferMatches` ต่อสายเข้า
  production path เป็นงานแรกของ Slice 4B แทน (ดู `docs/plans/phases/4b-dashboard.md`)

**Slice 4B — Dashboard + Transaction Review: เสร็จแล้ว** (`docs/plans/phases/4b-dashboard.md`)

- `suggestTransferMatches` ต่อสายเข้า `worker.ts:doSync` แล้ว, `GET /api/transfer-matches?status=suggested`,
  `PUT /transactions/:id/splits` รับ array ว่าง (ล้าง split คืน), `GET /api/transactions` (+`:id`),
  5 report endpoint (`summary`/`category-breakdown`/`cash-flow`/`account-balances`/`data-coverage`)
- `web/src/pages/Dashboard.tsx` (การ์ดสรุป + 3 กราฟ `@mui/x-charts`) และ `web/src/pages/Transactions.tsx`
  (ตาราง filter ผ่าน URL + `ReviewDrawer` จัดหมวด/แบ่งสัดส่วน/ยืนยันคู่โอน) — router คือ `react-router-dom`
- ADR-0003 บันทึก `DESIGN.md` ทับ `personalfinancesystemplan.md` §3 แล้ว (ปิดหัวข้อ "ค้างเรื่อง UI
  design guideline" ด้านล่าง — เอกสารนั้นเป็นประวัติ ไม่ใช้ตัดสินงานอีกต่อไป)
- `ledger-reviewer` ผ่าน 2 รอบ (backend diff, UI diff) ทุก major finding แก้แล้ว — 92/92 test ผ่าน,
  `npm run build` สะอาด
- **ยกไป Slice 5/7 โดยตั้งใจ** (placeholder ปิดอยู่ในหน้า UI พร้อมป้าย "รอ Slice 5/7"):
  Planning + Payment Status card (§8.2), คอลัมน์ Monthly Plan Item (§8.3), filter Tax Entity/Tax Document (§8.4)
- **ข้อจำกัดที่รู้ตัว** (ตั้งใจไม่แก้ในเฟสนี้):
  - `classification='excluded'` reconcile ไม่ได้ระหว่างรายงานกับรายการ: รายงานตัด `excluded` ออก
    แต่ `GET /api/transactions` (และ `TXN_FILTER_SQL`) ไม่มี filter ของมัน — drill-down จากการ์ด/กราฟ
    จึงมีบางแถวที่การ์ดไม่ได้นับโผล่ในตาราง ยอดรวมแถวที่เห็นจึงไม่เท่ากับตัวเลขบนการ์ดเป๊ะเมื่อมี excluded
  - กฎ data-coverage (§8.1) จับได้แค่ "บัญชีตกหลัง" ที่ปลายช่วง จับรูช่วงกลาง (parsed ม.ค.+มี.ค. ขาด ก.พ.),
    gap ระดับวัน, หรือเดือนของ statement ที่ `parse_failed` ไม่ได้
  - ไม่มี index `(bank_account_id, txn_date desc, id desc)` — `GET /api/transactions` sort ทั้งชุดต่อหน้า
    (offset pagination) ทางอัปเกรดคือเพิ่ม index ก่อน แล้วค่อยไป keyset
  - `txn.counterparty` เป็น NULL ตลอด (`worker.ts` ไม่เคย insert คอลัมน์นี้) — `q` filter ค้นได้แค่ `description`
  - `parse_failed`/`checksum_failed` count ใน `/reports/summary` เป็น**ทั้งหมดต่อ user** ไม่ใช่ต่อเดือน
    (`period_start`/`period_end` เป็น NULL บนแถวล้มเหลว) ไม่ขยับตามเดือนที่เลือกโดยตั้งใจ
  - `total_balance_satang` ในการ์ดสรุปไม่มี drill-down (ยอดรวมข้ามหลายบัญชี ไม่มี source record เดียวให้ชี้)
  - reviewer finding ระดับ minor ที่ยังไม่แก้: query array-param (`month`/`q` รับ array แล้วไม่ validate
    เป็น 400), `maxMonths` off-by-one ใน `parseRange`, บัญชี archived นับใน cash-flow แต่ไม่นับใน
    account-balances (ไม่สอดคล้องกัน)
- **ยังไม่ผ่านการทดสอบด้วยตา/browser จริง** — environment นี้ไม่มี browser automation tool และต้องใช้
  Google OAuth session จริง `npm run test:db` (92/92) และ `npm run build` (สะอาด) ยืนยันว่า compile/logic
  ถูกต้อง แต่ไม่ยืนยัน layout, การ render กราฟ, หรือว่าคลิก drill-down แล้ว navigate ไปถูกจริงในเบราว์เซอร์
- ถัดไป: Slice 5 ตามลำดับใน `docs/plans/phases/README.md`

## Requirement ที่ยังไม่มี Slice รองรับ (ก่อน 4A)

- Tax Invoice / `TaxInvoiceRecord` (Slice 7)
- audit log การเข้าถึงและแก้ไขข้อมูล (Slice 8)

## UI design guideline — ปิดแล้ว

`docs/plans/personalfinancesystemplan.md` §3 (light mode, สีแดง crimson, ฟอนต์พิกเซล, Lucide icons)
ขัดกับ `DESIGN.md` และโค้ดจริงที่ใช้อยู่ (dark-first, `#70adfb`, MUI, iannnnn-DOG) — บันทึกการกลับทิศไว้ที่
`docs/adr/0003-design-md-supersedes-personalfinancesystemplan-section-3.md` แล้ว §3 เก็บไว้เพื่อประวัติ
ไม่ใช้ตัดสินงาน UI อีกต่อไป
