# สถานะงาน — 2026-08-30

ข้อบังคับและท่อข้อมูลอยู่ที่ `CONTEXT.md` · การตัดสินใจอยู่ที่ `docs/adr/0001-statement-pdf-ingestion.md`

## Git

- มี baseline commit แล้ว: `c42b982 chore: establish family ledger baseline`
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

## ถัดไป

วางแผน Slice 4 ให้ละเอียดก่อนลงมือ:

- จับคู่การโอนภายในครอบครัว + manual override
- รายงานรายเดือน/รายปี
- สรุปภาษี
- ตัดสินว่าจะรวม category ใน Slice 4 หรือแยก Slice
- ออกแบบ UI ตาม design guideline ใน `docs/plans/personalfinancesystemplan.md` ส่วนที่ 3
