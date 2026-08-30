# Family Ledger

ระบบบัญชีรายรับ-รายจ่ายระดับครอบครัว อ่านข้อมูลธุรกรรมจาก **statement PDF รายเดือน** ที่ธนาคารส่งเข้าอีเมล

ความต้องการฉบับเต็ม: `docs/plans/personalfinancesystemplan.md`
การตัดสินใจเชิงสถาปัตยกรรม: `docs/adr/`

## ท่อข้อมูล

```
Gmail (poll ชั่วโมงละครั้ง)
  → จับคู่อีเมล: ผู้ส่ง + DKIM + หัวข้อ          [ตาราง bank — แอดมินแก้ได้]
  → ดึงไฟล์แนบ PDF ทุกไฟล์ (ชื่อไฟล์ตรง pattern + MIME PDF/octet-stream + magic `%PDF-`)
  → เก็บ PDF ต้นฉบับ (ยังเข้ารหัสอยู่)           [data/pdf/ + backup]
  → ถอดรหัส + สกัดข้อความ ในหน่วยความจำ           [qpdf | pdftotext]
  → แกะตาราง                                     [โค้ดต่อธนาคาร: parser_key]
  → ตรวจ checksum ยอดยกมา/ยกไป                    [ไม่ผ่าน = ไม่เขียนสักแถว]
  → เขียน txn                                    [DB transaction เดียว]
```

## กติกาที่ห้ามละเมิด

- **เงินเป็น `BIGINT` หน่วยสตางค์** แปลงเป็นบาทตอนแสดงผลเท่านั้น
  แปลงข้อความเป็นจำนวนเงินด้วยการตัด `,` แล้วแยกที่ `.` ประกอบเป็นจำนวนเต็ม **ห้าม `parseFloat(x) * 100`**
- **ตรวจ DKIM ก่อน import ทุกครั้ง** — หัวข้ออีเมลอย่างเดียวแปลว่าใครก็เขียนธุรกรรมเข้าระบบเราได้
  อ่าน `Authentication-Results` **อันแรก** (ที่ Gmail prepend ตอนรับ) เท่านั้น, authserv-id ต้องเป็น `mx.google.com`,
  ไม่สนใจ `ARC-Authentication-Results`, ถ้ามี non-ARC มากกว่า 1 อันที่อ้าง `mx.google.com` → ปฏิเสธ
- **รหัสผ่าน PDF และ refresh token เข้ารหัส AES-256-GCM เสมอ** (`src/crypto.ts`) คีย์อยู่ใน `.env` ห้ามเข้า git
  **คีย์หาย = ถอดข้อมูลเก่าไม่ได้อีกเลย** ต้องมีสำเนานอกเครื่อง
- **รหัสผ่าน PDF ส่งผ่าน stdin ไม่ใช่ argv** และ **PDF ที่ถอดรหัสแล้วห้ามลงดิสก์**
- **`txn.txn_date` = วันที่ในบรรทัดของ statement** ไม่ใช่วันที่อีเมลมาถึง (ไม่งั้นปีภาษีเพี้ยน)
- **checksum ไม่ผ่าน = ไม่เขียนสักแถว** ตั้ง `status='checksum_failed'` แล้วแจ้งเตือน
- **fixture ที่ commit ได้ = ข้อความที่สกัดแล้วและ redact แล้วเท่านั้น** ห้าม commit ไฟล์ PDF หรือ `.eml` จริง
- **ห้ามเพิ่ม scope `drive`** ลงใน OAuth client ของแอปนี้ (สำรองข้อมูลใช้ credential คนละตัว)
- **Docker publish port ต้องผูก loopback** (`127.0.0.1:3001:3000`) — iptables ของ Docker ข้าม UFW

## ผัง

| ไฟล์ | หน้าที่ |
|---|---|
| `migrations/*.sql` | schema เรียงเลข runner อยู่ที่ `src/migrate.ts` (รันเองตอนแอปบูต) |
| `src/db.ts` | pool + `tx()` สำหรับงานที่ต้อง all-or-nothing |
| `src/crypto.ts` | AES-256-GCM ใช้ทั้ง refresh token และรหัสผ่าน PDF |
| `src/account-match.ts` | จับคู่เลขบัญชีที่ statement ปิดบังไว้ กับเลขเต็มที่ผู้ใช้กรอก |
| `src/auth.ts` | Google OAuth, session, ด่าน `requireUser` / `requireAdmin` |
| `src/gmail.ts` | Gmail REST (`fetch` ดิบ) + ด่าน DKIM + เลือกไฟล์แนบ PDF |
| `src/parsers/scb.ts` | แกะ SCB statement ทั้งแบบรายเดือนและย้อนหลัง + checksum gate |
| `src/worker.ts` | worker ชั่วโมงละครั้ง: sync กล่องอีเมล → ถอดรหัส PDF → parse → เขียน statement/txn แบบ atomic |
| `src/api.ts` | REST ทั้งหมด |
| `web/` | React (Vite) — แท็บบัญชีของฉัน / ธนาคาร (แอดมิน) / ผู้ใช้ (แอดมิน) |

## สั่งงาน

```sh
npm run migrate     # รัน migration (แอปรันให้เองตอนบูตอยู่แล้ว)
npm run dev:api     # API ที่ :3000
npm run dev:web     # Vite ที่ :5173 (proxy /api และ /auth ไป :3000)
npm test            # node:test — crypto + account-match + gmail + SCB parser/checksum
npm run build       # tsc + vite build
```

deploy: `docs/deploy.md`
