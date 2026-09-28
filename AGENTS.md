## Versioning — บังคับทุกครั้งที่ deploy

เลขเวอร์ชันอยู่ที่ **`src/version.ts` ที่เดียว** (`APP_VERSION`) เว็บอ่านผ่าน `GET /api/me`
แล้วแสดงมุมล่างขวาทุกหน้า ผู้ใช้จึงบอกได้ทันทีว่ากำลังใช้เวอร์ชันไหน

**ทุกครั้งที่งานชุดหนึ่งจะขึ้น production ต้องทำสองอย่างนี้ในคอมมิตเดียวกับงาน:**

1. ขยับ `APP_VERSION` ใน `src/version.ts`
2. เพิ่มหัวข้อใหม่บนสุดของ `CHANGELOG.md` ในรูปแบบ `## <version> — YYYY-MM-DD`
   แล้วสรุปสิ่งที่เปลี่ยนเป็นบรรทัดสั้น ๆ ภาษาที่ผู้ใช้อ่านรู้เรื่อง

เกณฑ์: **minor** = ฟีเจอร์ใหม่ · **patch** = แก้บั๊ก/ปรับเล็ก · **major** = เปลี่ยนโครงจนผู้ใช้ต้องเรียนรู้ใหม่

ห้ามขยับเลขโดยไม่เพิ่มบรรทัด CHANGELOG (เลขที่ไม่มีบันทึกว่าเปลี่ยนอะไรไม่มีประโยชน์) และ
ห้าม deploy โดยไม่ขยับเลข (ผู้ใช้จะรายงานบั๊กโดยอ้างเวอร์ชันที่ไม่ตรงกับโค้ดที่รันจริง)

## Commands

```sh
npm run dev:api     # Express API ที่ :3000 (node --watch, อ่าน .env)
npm run dev:web     # Vite ที่ :5173 — proxy /api และ /auth ไป :3000
npm test            # node:test ทั้งหมด แต่ suite ที่ต้องใช้ Postgres จะ skip เงียบ ๆ
npm run test:db     # ยก Postgres ทดสอบ (docker-compose.test.yml, 127.0.0.1:5433) แล้วรันครบทุก suite
npm run build       # tsc ฝั่ง server + tsc ฝั่ง web + vite build — ใช้เป็น typecheck ด้วย
npm run migrate     # รัน migration เอง (ปกติแอปรันให้ตอนบูต)
```

- **"test ผ่าน" ต้องมาจาก `npm run test:db` เท่านั้น** `npm test` ข้าม suite ที่ต้องใช้ DB โดยไม่ fail
- รันเทสต์ไฟล์เดียว: `node --env-file=.env.test --test --import tsx test/<name>.test.ts`
- ไม่มี lint และไม่มี React component test — ฝั่ง web ตรวจด้วย `npm run build` กับ `test/guides.test.ts`
- ตรวจหน้า UI จริงด้วย Playwright MCP (`.mcp.json`, ใช้ Chrome ในเครื่อง): รัน `dev:api` + `dev:web` แล้วเปิด
  `http://localhost:5173` — profile ของ browser เก็บถาวร ล็อกอิน Google ด้วยมือครั้งแรกครั้งเดียว
  MCP tools ใช้ได้ใน main session เท่านั้น (subagent ของ repo ไม่ได้ประกาศ tool เหล่านี้)

## Architecture (ภาพรวม — รายละเอียดอยู่ `CONTEXT.md`)

- **Backend**: Node ≥ 22, Express 4, TypeScript ESM, PostgreSQL (`pg`), session เก็บใน DB
  - `src/server.ts` เสิร์ฟทั้ง API และ `web/dist` (SPA fallback) จาก process เดียว
  - `src/worker.ts` poll Gmail ชั่วโมงละครั้ง → ถอดรหัส PDF → parse → เขียน `txn`
  - `src/routes/*` = HTTP ต่อโดเมน, `src/services/*` = logic ข้ามตาราง/pure function, `migrations/` = schema เรียงเลข
- **Frontend**: React 18 + MUI 9 + react-router 7 + Vite 6 อยู่ใน `web/` (ใช้ `package.json` ตัวเดียวกับ root)
  - `web/src/App.tsx` = auth gate + เมนู + routes, `web/src/api.ts` = client และ type ของ API ทั้งหมด
  - ดีไซน์ยึด `DESIGN.md` (token อยู่ `web/src/theme.ts`), คู่มือในแอปอยู่ `web/src/guide/guides.ts`
  - เปิด/ปิดหน้าชั่วคราวที่ `web/src/features.ts` (ตอนนี้หน้าเอกสารภาษี/ภาษีปิดอยู่)
- **Deploy**: Docker Compose + Caddy บน VPS — ขั้นตอนอยู่ `docs/deploy.md`
- **สถานะงาน/ประวัติ**: `docs/status.md` · การตัดสินใจ: `docs/adr/`

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/` in this repo. No PR triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical vocabulary, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Agent team

Four project agents live in `.claude/agents/` and ship with the repo:

| Agent | Owns | Can edit |
|---|---|---|
| `ledger-backend` | `src/api.ts`, `auth.ts`, `db.ts`, `crypto.ts`, `env.ts`, `http.ts`, `migrate.ts`, `server.ts`, `worker.ts`, `src/routes/`, `src/services/`, `migrations/` | yes |
| `ledger-ingestion` | `src/gmail.ts`, `src/parsers/`, `account-match.ts`, `test/fixtures/` | yes |
| `ledger-web` | `web/`, `vite.config.ts`, `DESIGN.md`, `.impeccable/` — React/MUI pages, components, design | yes |
| `ledger-reviewer` | reviews any diff against this repo's invariants | no write tools (Bash for git only) |

`ledger-web` follows `DESIGN.md` and uses the `impeccable` skill for design-level work when the
session has it. A new endpoint plus the page that calls it → the main session fixes the
`web/src/api.ts` type first, then `ledger-backend` and `ledger-web` each take their own side.
Broad "where does X live" searches go to the built-in `Explore` agent.

How the team works: subagents do not share context and cannot message each other.
The main session is the orchestrator — it dispatches, then merges. So:

- Independent work (a backend endpoint and a parser fix, or a parser fix and a UI tweak) → dispatch both in **one
  message** so they run concurrently.
- Work that touches the same file → sequential, one agent at a time.
- Anything crossing both areas (a new column consumed by the parser) → the main
  session decides the interface first, then hands each agent its own side.
- `ledger-reviewer` runs **last**, on the finished diff, never in parallel with the
  agents producing it.
