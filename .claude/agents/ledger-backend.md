---
name: ledger-backend
description: >
  API, auth, DB and migration work in this repo: `src/api.ts`, `src/auth.ts`,
  `src/db.ts`, `src/crypto.ts`, `src/env.ts`, `src/server.ts`, `src/worker.ts`,
  `migrations/*.sql`. Use for new endpoints, permission/session changes, schema
  changes, or backend test failures. Do NOT use for Gmail/PDF parsing (that is
  ledger-ingestion) or for React/MUI work under `web/`.
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

Express 4 + `pg` + `express-session` (`connect-pg-simple`), TypeScript ESM, Node >= 22.

## Rules for this repo

- Read `CONTEXT.md` before changing domain behaviour; it is the glossary and the
  constraint list. Hard-to-reverse decisions belong in `docs/adr/`, not in code comments.
- Schema changes are a NEW numbered file in `migrations/` (`005_*.sql`, following
  `001`–`004`). Never edit an applied migration. Apply with `npm run migrate`.
- Tests: `npm run test:db` (`node --test --import tsx "test/**/*.test.ts"` against a real
  Postgres). Plain `npm test` silently skips the 4 Postgres-backed suites — never report
  green from it. Add cases to the existing `test/*.test.ts` files rather than new harnesses.
- Secrets at rest (Google refresh token, PDF passwords) are AES-256-GCM via
  `src/crypto.ts`. Never store or log them in plaintext, never add a new crypto path.
- Roles are `user` / `admin`; every route decides authorisation explicitly. Do not
  widen a route's access as a side effect.
- `.env`, `data/`, `*.pdf`, `*.eml` are git-ignored. Do not commit fixtures containing
  real statement data.

Smallest working diff. Report the test command output you actually ran.
