## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/` in this repo. No PR triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical vocabulary, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Agent team

Three project agents live in `.claude/agents/` and ship with the repo:

| Agent | Owns | Can edit |
|---|---|---|
| `ledger-backend` | `src/api.ts`, `auth.ts`, `db.ts`, `crypto.ts`, `env.ts`, `server.ts`, `worker.ts`, `migrations/` | yes |
| `ledger-ingestion` | `src/gmail.ts`, `src/parsers/`, `account-match.ts`, `test/fixtures/` | yes |
| `ledger-reviewer` | reviews any diff against this repo's invariants | no write tools (Bash for git only) |

Web/MUI work has no agent — it goes through the `impeccable` skill plus `DESIGN.md`.
Broad "where does X live" searches go to the built-in `Explore` agent.

How the team works: subagents do not share context and cannot message each other.
The main session is the orchestrator — it dispatches, then merges. So:

- Independent work (a backend endpoint and a parser fix) → dispatch both in **one
  message** so they run concurrently.
- Work that touches the same file → sequential, one agent at a time.
- Anything crossing both areas (a new column consumed by the parser) → the main
  session decides the interface first, then hands each agent its own side.
- `ledger-reviewer` runs **last**, on the finished diff, never in parallel with the
  agents producing it.
