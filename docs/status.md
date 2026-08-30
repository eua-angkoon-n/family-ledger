# สถานะงาน — 2026-08-28

ไฟล์นี้บันทึกสิ่งที่ **อ่านจากรีโปไม่ได้** เท่านั้น
ข้อบังคับ/ท่อข้อมูลอยู่ที่ `CONTEXT.md` · เหตุผลที่เปลี่ยนแหล่งข้อมูลอยู่ที่ `docs/adr/0001-statement-pdf-ingestion.md`

## เอกสารที่อยู่นอกรีโป

| ไฟล์ | คืออะไร |
|---|---|
| `C:\Users\scent\.claude\plans\vivid-napping-axolotl.md` | **แผนที่อนุมัติแล้ว** — Slice 1–4, ขั้นตอน verification, data model เต็ม |
| `C:\Users\scent\.claude\plans\docs-status-md-reflective-pond.md` | แผน Slice 2 ที่อนุมัติแล้ว (ท่อรับอีเมล) — รายละเอียดด่าน DKIM, การกันพัง, การจับคู่บัญชี |
| `C:\Users\scent\.claude\plans\c-users-scent-claude-plans-docs-plans-pe-vectorized-meerkat.md` | แผนเดิม (อีเมลแจ้งเตือน) ทำเครื่องหมายว่าถูกแทนที่แล้ว เก็บไว้เป็นร่องรอยการตัดสินใจ |

## git

**ยังไม่ commit อะไรเลย** `git log` ว่าง ทุกไฟล์เป็น untracked — ดูประวัติเพื่อหาสถานะไม่ได้ ให้ดูไฟล์นี้แทน

## Slice 1 — เสร็จ ตรวจแล้ว ไม่ต้องรันซ้ำ

ตรวจด้วย `docker compose up -d --build` จริง (ไม่ใช่ dev):

- image มี `qpdf 11.3.0` (ต้องการ ≥ 10.2 สำหรับ `--password-file`) และ `pdftotext 22.12.0`
- คอนเทนเนอร์รันเป็น `uid=1000(node)` · publish แค่ `127.0.0.1:3001->3000` · service `db` ไม่ publish อะไรเลย
- migration รันตอนบูต และ `docker compose restart` แล้วไม่รันซ้ำ
- `/api/me` 200 · `/api/banks` 401 · `/api/nope` 404 · `/auth/google` 302 ไป Google ด้วย 4 scope ตามตั้งใจ **ไม่มี `drive`**
- `npm test` 10/10 · typecheck api + web ผ่านทั้งคู่ · `npm run build` ผ่าน

เอกสารที่แผนสั่งให้แก้ครบแล้วทั้ง 3 (ADR 0001, `docs/plans/personalfinancesystemplan.md`, แผนเดิม)

## Slice 2 — เสร็จ ตรวจแล้วเท่าที่ตรวจได้โดยไม่มีเมลจริง

ไฟล์ใหม่: `migrations/002_statement_period_nullable.sql`, `src/gmail.ts`, `src/worker.ts`, `test/gmail.test.ts`
แก้: `src/server.ts` (`startWorker()`), `src/api.ts` (`POST /api/email-accounts/:id/sync` + backfill fire-and-forget ตอนสร้างบัญชี), `src/account-match.ts` (เพิ่ม `findMaskedAccountCandidates`), `CONTEXT.md`

**ตรวจแล้วจริง:**

- `npm test` **25/25** (10 เดิม + 2 `account-match` ที่เพิ่ม + 13 `gmail.test.ts` ใหม่) — ครอบด่าน DKIM ทุกเคสที่แผนระบุ
  (ผ่านของจริง / spoof 2 header / คอมเมนต์ปลอม `(mx.google.com)` / มีแต่ ARC / `dkim=fail` / โดเมนผิด /
  `header.i` มี local part / หลาย `dkim=` ในหัวเดียว) และการเลือกไฟล์แนบ (โลโก้ inline, pattern ไม่ตรง,
  multipart ซ้อน, มี PDF ตรงเงื่อนไข 2 ไฟล์ → เอาไฟล์แรก + warn)
- typecheck (`tsc --noEmit`) และ `npm run build` ผ่าน
- **`migrations/002` รันกับ Postgres จริง** (container เปล่าแยกต่างหาก ไม่ใช่แค่ syntax เดา): รันครั้งแรกได้
  `001_init.sql, 002_statement_period_nullable.sql`, รันซ้ำได้ `ไม่มี migration ใหม่` (idempotent) และ
  `\d statement` ยืนยันว่า `period_start`/`period_end` เป็น nullable แล้วจริง
- **ไปป์ `qpdf|pdftotext` ที่ `extractText()` ใช้ ตรวจกับ qpdf/pdftotext เวอร์ชันเดียวกับ image จริงเป๊ะ**
  (11.3.0 / 22.12.0 ใน container แยกต่างหาก) ด้วย PDF เข้ารหัสสังเคราะห์: รหัสถูก → qpdf exit 0, pdftotext
  exit 0, ได้ข้อความที่ใส่ไว้ถูกต้อง · รหัสผิด → qpdf exit 2 (`invalid password`) map เป็น `decrypt_failed`
  ถูกต้อง · ไม่เกิด deadlock จากการเขียนรหัสผ่านลง stdin ก่อนต่อ pipe · ยืนยันแยกต่างหากด้วยว่า exit code `3`
  ของ qpdf แปลว่า "operation succeeded warnings" จริงตามที่โค้ด map ไว้ (เห็นจากขั้นตอนซ่อม PDF ที่ xref เสีย)
  — **สิ่งที่ยังไม่ได้ยืนยัน**: ไม่ได้บังคับให้ exit code `3` เกิดขึ้นระหว่างขั้นตอน**ถอดรหัส**โดยตรง (encrypt
  ที่มี warning จะรีไรต์ไฟล์ใหม่จนสะอาด ทำให้ decrypt ทีหลังไม่มี warning ต่อ) และคุณภาพข้อความไทยจาก PDF
  statement จริงของ KBank ยังไม่เคยเห็น — สองข้อนี้ยังต้องรอตัวอย่าง PDF จริงเหมือนเดิม

**ตรวจด้วยการอ่านโค้ด ไม่ใช่รันจริง:**

- ด่านเจ้าของกล่องใน `POST /api/email-accounts/:id/sync` (403 ถ้ากล่องไม่ใช่ของผู้ใช้) ใช้ query pattern
  เดียวกับ `POST /api/accounts` ที่มีอยู่แล้วเป๊ะ (`select 1 from ... where id = $1 and user_id = $2`)
  ไม่ได้เขียนเทส HTTP แยก เพราะจะต้องปลอม session cookie ของ `express-session` เพื่อพิสูจน์โค้ดแบบเดียวกับที่
  พิสูจน์แล้วจากที่อื่น — ไม่คุ้ม ถ้าจะพิสูจน์แบบ end-to-end จริง รอตอนต่อกล่องอีเมลใบที่ 2 (`?add=1`) ทำได้เลย

**ยังพิสูจน์ไม่ได้จนกว่าจะมีเมลจริง (ติดของเดียวกับ Slice 3 ที่รอผู้ใช้):**

- worker เจออีเมล statement จริง, PDF ลงดิสก์, `error_detail.slice2_text` มีข้อความไทยที่อ่านออก
- full-sync แล้วรันซ้ำ (ล้าง `history_id` ทิ้ง) ไม่เกิดรายการซ้ำ
- ทั้งสองข้อนี้ยังไม่มีมูลไปกว่านี้ เพราะยังไม่เคยต่อกล่องอีเมลใบไหนเข้าระบบเลย (`/auth/google?add=1` ก็ยังไม่เคยถูกเรียก)

**จุดอ่อนที่รู้ตัวและยอมรับในรอบนี้:**

- `extractText()` ไม่มี automated test ถาวรใน `test/` (ต้อง spawn qpdf/pdftotext จริง ไม่มีบน Windows dev
  เครื่องนี้) — ตรวจแบบ manual ครั้งเดียวตามหัวข้อบนแล้ว แต่ไม่ได้ผูกเป็นเทสที่รันซ้ำได้ทุกครั้ง
- ถ้ากล่องเดียวกันมี 2 บัญชีของธนาคารเดียวกัน แต่ผู้ใช้ลงทะเบียนไว้แค่บัญชีเดียวตอนอีเมล statement ของบัญชีที่สอง
  เข้ามา → เขียนแถวด้วยรหัสผ่านของบัญชีที่หนึ่ง ถ้ารหัสไม่ตรง (ปกติควรไม่ตรง) จะได้ `parse_failed` ผูกกับบัญชีผิด
  แก้แล้วบางส่วน: dedup check ข้าม `status='parse_failed'` ทำให้ sync รอบถัดไป (หลังลงทะเบียนบัญชีที่สอง) ลองใหม่
  ได้เอง — แต่ถ้าสองบัญชีบังเอิญใช้รหัสผ่านเดียวกัน แถวจะเขียนสำเร็จ (status='pending') ผูกกับบัญชีผิดเงียบ ๆ
  โดยไม่มีการแจ้งเตือนใด ๆ ยังไม่มีทางแก้ในรอบนี้

## ตั้งค่าไว้ชั่วคราวสำหรับทดสอบ local — ต้องแก้กลับก่อน deploy จริง

- **`docker-compose.yml` → `app.environment.NODE_ENV` ถูกเปลี่ยนเป็น `development`** (จากเดิม `production`)
  เพื่อทดสอบล็อกอินผ่าน `http://localhost:3001` (ไม่มี HTTPS) — โค้ดใช้ `NODE_ENV` จุดเดียวคือกำหนด
  `secure` ของ session cookie ที่ `src/server.ts:29` ถ้าเป็น `production` cookie จะ `secure:true` ซึ่งต้องมี
  HTTPS จริงถึงจะเก็บ cookie ได้ (นี่คือสาเหตุที่ล็อกอินแล้วเจอ "state ไม่ตรง" ตอนทดสอบผ่าน http เปล่า ๆ)
  **ก่อน deploy จริงผ่าน Caddy (มี HTTPS) ต้องเปลี่ยนกลับเป็น `NODE_ENV: production`** ไม่งั้น session cookie
  จะไม่ปลอดภัยบนโดเมนจริง

## งานฝั่งหน้าเว็บที่รู้ว่าต้องทำ แต่ยังไม่ได้เข้าคิว Slice ไหน

ผู้ใช้แจ้งไว้ 2026-08-29 ว่ายังไม่แน่ใจว่ามีแผนต่อจากนี้ครอบคลุมหรือยัง เลยจดกันลืมไว้ก่อน ยังไม่ได้ตัดสินใจ
ว่าจะทำเป็น Slice ใหม่หรือแทรกเข้า Slice ที่มีอยู่:

1. **ออกแบบหน้าตาเว็บ (`web/`)** — ตอนนี้เป็น UI ขั้นต่ำสุดสำหรับทดสอบ ยังไม่ได้ออกแบบจริง
   **สเปกมีอยู่แล้วครบใน `docs/plans/personalfinancesystemplan.md` ส่วนที่ 3** (Modern Minimal, สี
   Hyacinth Crimson จากตัวละคร Hyacine, ต้องมี dark mode, ฟอนต์ Pixel Thai สำหรับปุ่ม/label, ไอคอน Lucide)
   ไม่ต้องคุยดีไซน์ใหม่ แค่ยังไม่ได้ implement
2. **การแสดงผลต่าง ๆ** — ยังไม่ระบุรายละเอียดว่าหน้าไหน/ข้อมูลอะไรบ้าง ต้องคุยเพิ่มตอนจะเริ่มทำจริง

## Requirement ที่ยังไม่มี Slice ไหนรองรับเลย (ไล่เทียบกับ `docs/plans/personalfinancesystemplan.md`)

ตรวจสอบ 2026-08-29 เทียบ requirement เต็ม (ส่วนที่ 1) กับแผนที่อนุมัติ (`vivid-napping-axolotl.md`) พบว่า:

- **ข้อ 1.7 จัดเก็บ Tax Invoice** — ไม่ถูกพูดถึงใน Slice 1–4 เลยแม้แต่บรรทัดเดียว ตอน re-plan วันที่ 2026-08-27
  (ย้ายจากอีเมลแจ้งเตือนไป statement PDF) ดูเหมือนตกหล่นไป ต้องเป็นกลไกแยก เพราะต้องให้ผู้ใช้เลือกเองว่า
  อีเมลไหนคือใบกำกับภาษี (ไม่มีรายชื่อผู้ส่งตายตัวแบบธนาคาร)
- **ข้อ 2.4 Audit log** (บันทึกการเข้าถึง/แก้ไขข้อมูล) — ระบุไว้ในสเปกต้นฉบับ แต่ตกหล่นตอน re-plan เหมือนกัน
- **`TransferMatch` และ `TaxInvoiceRecord`** (entity ตามสเปกข้อ 2.1) — ยังไม่มีตารางรองรับใน schema ปัจจุบัน
  ต้องเพิ่มตอนทำ Slice 4 (transfer) และตอนทำข้อ 1.7 (tax invoice)
- **จุดที่ต้องเช็คให้ตรงกันก่อนเริ่ม Slice 4:** หัวข้อ "ที่จงใจยังไม่ทำ" ด้านล่างเขียนว่า `txn.category_id`
  "รอมาพร้อมตาราง `category` ใน Slice 4" แต่ `vivid-napping-axolotl.md` นิยาม Slice 4 ว่าคือ
  **"ตรวจโอนภายใน + รายงาน + สรุปภาษี"** เท่านั้น ไม่ได้พูดถึงหมวดหมู่เลย — ต้องตัดสินใจตอนเริ่ม Slice 4 จริง
  ว่าจะรวมหมวดหมู่เข้าไปด้วยหรือแยกเป็นอีก Slice
- **Slice 4 เองยังเป็นแค่ร่างย่อหน้าเดียว** ไม่มีแผนละเอียดแบบที่ Slice 2 เคยมี (data model การจับคู่โอนภายใน,
  เกณฑ์จับคู่ตามข้อ 2.3, UI รายงาน, สูตรสรุปภาษี ยังไม่ได้ออกแบบสักอย่าง) ต้องทำแผนแยกตอนจะเริ่มจริง

## ที่ยัง**ไม่เคยรันจริง**

- **`/auth/google?add=1`** (ต่อกล่องอีเมลใบที่ 2 ตาม requirement 1.1) — branch `addMailbox` ใน `src/auth.ts`
  typecheck ผ่านแต่ไม่เคยถูกเรียก ต้องแลก code กับ Google จริงถึงจะทดสอบได้ ครั้งแรกที่ต่อกล่องที่ 2 คือการทดสอบ
  **และเป็นจังหวะเดียวกับที่จะได้เห็น worker ของ Slice 2 sync กล่องจริงเป็นครั้งแรกด้วย**

## ที่จงใจยังไม่ทำ

- **`txn.category_id` ไม่มีใน `migrations/001_init.sql`** ทั้งที่แผนเขียนไว้ — รอมาพร้อมตาราง `category` ใน Slice 4
- **`error_detail.slice2_text`** เก็บข้อความดิบทั้งก้อน (ตัดที่ 20,000 ตัวอักษร) ของทุก statement ที่ import
  เข้ามา — ต้องล้างทิ้งตอน Slice 3 มี parser จริงแล้ว เพราะนี่คือประวัติธุรกรรมเต็ม ๆ ที่ถูก backup อยู่ใน jsonb
- **กรณีหลายบัญชีในกล่องเดียวกัน+ธนาคารเดียวกัน แยกไม่ออกว่า statement เป็นของใคร** → ไม่เขียนแถวอะไรเลย
  ทิ้ง PDF ไว้บนดิสก์เฉย ๆ (`console.warn`) ผู้ใช้ไม่เห็นอะไรใน UI เลยว่ามีอีเมลที่ยังไม่ได้ import — Slice 3 ต้องปิด
- **สมมติฐาน "1 อีเมล ≤ 1 statement"** (`pickPdfAttachment` เอาไฟล์แรกถ้ามี PDF ตรงเงื่อนไขหลายไฟล์ในอีเมลเดียว,
  `statement_gmail_uniq` เป็น unique คู่กับ `bank_account_id`) — ถ้าธนาคารเริ่มส่ง PDF สองบัญชีในอีเมลเดียวกัน
  ระบบจะ import ได้แค่บัญชีแรกเท่านั้น ยังไม่มีทางรองรับกรณีนี้

## รอผู้ใช้ส่งของ — บล็อกเฉพาะ Slice 3

1. ตัวอย่าง statement PDF ของ KBank + รหัสผ่าน (หรือบอกว่ารหัสมาจากอะไร) **ควรมี 2 เดือนติดกัน** เพื่อตรวจว่า `closing` เดือนก่อน = `opening` เดือนถัดไป
2. หัวข้ออีเมลจริง ทั้งแบบรายเดือนอัตโนมัติ และแบบที่ผู้ใช้ขอเอง (คนละหัวข้อกัน)

## ถัดไป

**Slice 3 — parser ของ KBank + checksum gate + เขียน `txn`** ยังบล็อกอยู่ที่ตัวอย่าง PDF ด้านบน
ระหว่างรอ ทางเลือกที่ทำได้คือต่อกล่องอีเมลใบแรกจริง (`/auth/google?add=1` หรือสมัครใหม่) เพื่อให้ worker ของ
Slice 2 ได้รันกับ Gmail จริงเป็นครั้งแรก และปิดสองข้อที่ยังพิสูจน์ไม่ได้ในหัวข้อ Slice 2 ด้านบน
