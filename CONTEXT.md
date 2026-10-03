# Hyacinthia Ledger

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
- **Planning ห้ามสร้างหรือแก้ `txn`** (ADR-0002) และ **ไม่จับคู่กับ statement แล้ว** (ADR-0004) — mark paid
  สร้าง `monthly_item_payment` ที่นับเป็นยอดจ่ายทันที แผนคือแผน statement คือของจริง เงินจริงอ่านจาก `txn`
  ที่ Dashboard/รายงาน ห้ามเพิ่มการเทียบยอดแผนกับ `txn` กลับเข้ามาโดยไม่มี ADR ใหม่
- **ขั้นต่ำ กยศ. ไม่ใช่ค่าคงที่** เงินต้นแต่ละงวดคิดเป็น % ของ *เงินต้นตามสัญญา* ตามตาราง Step Up ซึ่งเพิ่มขึ้นทุกปี
  ห้ามเอายอดขั้นต่ำของปีนี้ไปคูณตลอดอายุสัญญา และดอกเบี้ยเดินรายวัน (คงเหลือ × 1% ÷ 365) ห้ามใช้ 1/12 ต่อเดือน
- **`txn.txn_date` = วันที่ในบรรทัดของ statement** ไม่ใช่วันที่อีเมลมาถึง (ไม่งั้นปีภาษีเพี้ยน)
- **checksum ไม่ผ่าน = ไม่เขียนสักแถว** ตั้ง `status='checksum_failed'` แล้วแจ้งเตือน — ยกเว้นไฟล์ว่าง
  (`error_detail.reason='no_data'`: ไม่มีรายการ ยอดรวม 0 ไม่มียอดยกมา) ที่ยังไม่ผ่าน gate แต่ไม่แจ้งเตือน
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
| `src/parsers/*.ts` | แกะ SCB/KBank statement ทั้งแบบรายเดือนและย้อนหลัง + checksum gate |
| `src/worker.ts` | worker ชั่วโมงละครั้ง: sync กล่องอีเมล → ถอดรหัส PDF → parse → เขียน statement/txn แบบ atomic |
| `src/api.ts` | ประกอบ router ย่อย + `/me` |
| `src/http.ts` | `HttpError` และ helper ตรวจ body ที่ router ใช้ร่วมกัน |
| `src/routes/*.ts` | handler REST แยกตามโดเมน (banks, admin, email-accounts, accounts, categories, transactions, transfer-matches, reports, recurring-rules, monthly-plans, income-records, installments, student-loan, tax-entities, tax-documents, tax-calculations, audit-log) |
| `src/services/audit.ts` | เขียน audit log (`audit()`) — ทุก mutation ที่ต้องตรวจย้อนได้เรียกผ่านตัวนี้ |
| `src/services/transfer-matching.ts` | หา candidate คู่โอนภายในให้ user (logic ข้ามตารางแยกจาก route ตาม ADR-0002) |
| `src/services/report-query.ts` | SQL fragment ร่วมของรายงาน/รายการธุรกรรม (`OWNED_TXN_FROM`, `TXN_FILTER_SQL`, `parseRange`, `accountCoverage`) |
| `src/services/plan-query.ts` | SQL fragment ร่วมของแผนรายเดือน (`PAYMENT_STATE_SQL`, `planTotals`, `loadOwnedItem`) — หน้าแผนและการ์ด Dashboard ต้องใช้ตัวเดียวกัน |
| `src/services/student-loan.ts` | แผนปลดหนี้ กยศ. — ตาราง Step Up 15 งวด, ดอกเบี้ย 1%/ปี เดินรายวัน, ลำดับตัดชำระตาม พ.ร.บ. 2566 (pure ไม่แตะ DB) |
| `src/services/recurring-generation.ts` | กางรายการประจำเป็นวันครบกำหนด (`occurrencesInMonth` เป็น pure ไม่แตะ DB) insert-only จึงไม่ย้อนแก้เดือนเก่า |
| `src/services/income-records.ts` · `installments.ts` · `income-installment-math.ts` | รายได้เต็ม/รายการหัก และงวดผ่อน — กรอกมือล้วน ไม่ผูกกับ `txn` (ADR-0004) |
| `src/services/tax-calculation.ts` · `tax-rules.ts` · `file-vault.ts` | ประมาณการภาษี (rule แยกตามปี เป็น data), คลังเอกสารภาษีเข้ารหัสบนดิสก์ |
| `src/parsers/index.ts` | registry `parser_key` → ฟังก์ชัน parse (ใช้ร่วมกันทั้ง `src/routes/banks.ts` และ `src/worker.ts`) |
| `web/` | React (Vite), router คือ `react-router-dom` (`App.tsx` ครอบ auth gate ไว้ข้างนอก `<Routes>`) |
| `web/src/pages/Dashboard.tsx` | สรุปเงินเข้า/ออก/คงเหลือ + 3 กราฟ (`@mui/x-charts`) ต่อเดือน คลิก segment ไป `/transactions` ตาม contract ใน `report-query.ts` |
| `web/src/pages/Transactions.tsx` | ตารางธุรกรรม filter ผ่าน URL (`useSearchParams`), เปิด `ReviewDrawer` ต่อแถว |
| `web/src/pages/StudentLoan.tsx` | หน้าแผนปลดหนี้ กยศ. (`/student-loan`) — เทียบ 3 ทางเลือก, ตารางงวดรายปี/รายเดือน, projection คำนวณฝั่ง server ไม่เก็บ DB |
| `web/src/pages/MonthlyPlan.tsx` | แผนรายเดือน (`/planning?month=`) — รายการประจำ/เฉพาะเดือน, ยอดประมาณการ, mark paid, ลบรายการ, ปิด-เปิดเดือน |
| `web/src/pages/Installments.tsx` · `AuditLog.tsx` · `Help.tsx` | งวดผ่อน (`/installments`, เข้าจากหน้าวางแผน), ประวัติการแก้ไข (`/audit`), คู่มือรวม (`/help`) |
| `web/src/pages/TaxDocuments.tsx` · `TaxSummary.tsx` | คลังเอกสารภาษี / ประมาณการภาษี — **ปิดชั่วคราว** ตาม `web/src/features.ts` (โค้ดและ API ยังอยู่) |
| `web/src/features.ts` | `isPageEnabled(path)` กรองเมนู route และหน้า `/help` จากรายการเดียว · `TAX_PAGES_ENABLED` คุมข้อความที่อ้างถึงหน้าภาษี |
| `web/src/guide/` | เนื้อหาคู่มือ (`guides.ts`) ใช้ทั้ง tour ในหน้าและ `/help` — `test/guides.test.ts` ตรวจว่า selector ยังมีจริง |
| `web/src/ui.tsx` · `theme.ts` · `format.ts` | primitive ร่วม (`PageHeader`, `EmptyState`, …), design token ตาม `DESIGN.md`, `formatBaht`/`formatDate` |
| `web/src/components/` | ส่วนใช้ร่วม — `Money`/`MonthPicker`/`SummaryCard`/`ChartCard`/`TransactionTable`/`DataFreshness`/`ReviewDrawer`/`PaymentStatusChip`/`IncomeSection` และชิ้นส่วนหน้าภาษี |
| `web/public/` | หน้า static สาธารณะ `home.html`, `privacy.html`, `terms.html` + ฟอนต์ |

## สั่งงาน

```sh
npm run migrate     # รัน migration (แอปรันให้เองตอนบูตอยู่แล้ว)
npm run dev:api     # API ที่ :3000
npm run dev:web     # Vite ที่ :5173 (proxy /api และ /auth ไป :3000)
npm test            # node:test — suite ที่ไม่ต้องใช้ DB (crypto, gmail, parser SCB/KBank, recurring,
                    # คำนวณภาษี/กยศ., guides selector ฯลฯ)
npm run test:db     # เหมือนกัน + ทุก suite ที่ต้องใช้ TEST_DATABASE_URL (migration, API ต่อโดเมน,
                    # cross-user authorization) — ต่อ Postgres จริงผ่าน docker-compose.test.yml (127.0.0.1:5433)
                    # ไม่มีคำสั่งนี้ = suite เหล่านี้ถูก skip เงียบ ๆ ใน `npm test` (t.skip ไม่ error)
                    # ห้ามถือว่า "test ผ่านหมด" จนกว่าจะรัน test:db แล้วเขียวจริง
npm run build       # tsc (server + web) + vite build — ใช้เป็น typecheck ด้วย
```

deploy: `docs/deploy.md`
