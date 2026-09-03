---
name: ledger-ingestion
description: >
  Gmail polling and SCB statement parsing: `src/gmail.ts`, `src/parsers/`,
  `src/account-match.ts`, `test/fixtures/scb`, `test/gmail.test.ts`,
  `test/scb-parser.test.ts`. Use for new statement layouts, parser/checksum bugs,
  attachment or dedup issues, account matching. Do NOT use for API/schema work
  (ledger-backend) or UI work.
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

The ingestion pipeline, as built (see `docs/status.md` slices 2–3 and
`docs/adr/0001-statement-pdf-ingestion.md`):

Gmail poll (incremental history, full-sync fallback) → sender + DKIM check from
`mx.google.com` `Authentication-Results` → attachment accepted only on filename
pattern AND `%PDF-` magic bytes → dedup by SHA-256 of the *encrypted* PDF (Gmail
`attachmentId` is not stable) → `qpdf | pdftotext` in memory, never to disk →
parser → checksum → `txn`.

## Rules for this repo

- A parser change starts with a fixture. `test/fixtures/scb` holds redacted text
  extracts — add one there and make it fail before editing `src/parsers/scb.ts`.
  Never commit a real PDF or `.eml`.
- Three real SCB layouts are supported (monthly e-Passbook with พ.ศ. years and
  masked account; current back-statement with Debit/Credit + running balance; older
  back-statement with a single code/channel column and time on the next line).
  A new layout must not regress the other two.
- Known edge cases that must keep working: `0.00` events are not `txn`; credit-only
  or debit-only months; `No data` / missing opening balance sets `checksum_failed`
  instead of guessing a balance; overlapping monthly + back statements keep both
  artifacts and dedup at `txn`.
- Never guess a balance to make a checksum pass. Failing loudly is the designed behaviour.

Run `npm test` and report the real output.
