---
name: ledger-web
description: >
  Frontend and design work in this repo: everything under `web/` (React pages,
  MUI components, `theme.ts`, `guide/`, `features.ts`, `web/public/`), plus
  `vite.config.ts`, `DESIGN.md` and `.impeccable/`. Use for new pages or UI changes,
  layout/responsive/accessibility fixes, design-system or copy updates, and hiding
  or re-enabling pages. Do NOT use for endpoints, schema or auth (ledger-backend)
  or Gmail/PDF parsing (ledger-ingestion).
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

React 18 + MUI 9 (+ `@mui/x-charts`) + react-router-dom 7, built by Vite 6 from `web/`.
Same root `package.json` as the server; `web/tsconfig.json` is strict and cannot import `src/`.

## Rules for this repo

- Read `DESIGN.md` (and `PRODUCT.md` for tone) before visual work. It overrides
  `docs/plans/personalfinancesystemplan.md` §3 (ADR-0003). If the session has the
  `impeccable` skill, use it for design-level work (critique, layout, polish).
- Money is integer satang end to end: display with `formatBaht`, parse with
  `parseBahtToSatang` (`web/src/format.ts`). Never `parseFloat(x) * 100`. API dates are
  `YYYY-MM-DD`; show them with `formatDate` (UTC) so the day does not shift.
- Colour only from the tokens in `web/src/theme.ts`. The accent is reserved for primary
  action, focus and selection. Green means income/success and red means expense/error/destructive.
  A status colour always comes with text or an icon. Type follows the two-lane rule:
  `brandCopySx`/headings for titles and descriptive copy, `dataTextSx` (system-ui, tabular-nums)
  for numbers, inputs, tables, buttons and tabs.
- Reuse `web/src/ui.tsx` (`PageHeader`, `EmptyState`, `LoadError`, `TableSkeleton`,
  `ConfirmDialog`, `FeedbackSnackbar`). Hard-to-undo actions need a confirm, and toolbar
  errors go to the snackbar. Border before shadow, and no card inside a card.
- Each route in `App.tsx` is wrapped in `<Box component="section" aria-labelledby="<x>-heading">`,
  and the page's `PageHeader id` must match. Imports use `.js` extensions.
- `web/src/guide/guides.ts` points at elements by selector. If you rename or remove an `id`,
  `aria-label` or `data-tour`, update the guide as well. `test/guides.test.ts` fails otherwise,
  and it also requires every guide path to have a route in `App.tsx`.
- To hide or re-enable a page, change `web/src/features.ts`, which filters the menu, the routes
  and `/help`. Do not delete the page.
- Keep `@mui/x-charts` inside lazy-loaded chunks (it is about 600KB). Prefer MUI or native
  features over a new dependency.
- Must work at a 320px viewport. Tap targets are at least 40px, and the focus ring stays
  visible. Tables scroll inside their own container.
- A user-visible change that ships bumps `src/version.ts` and adds a `CHANGELOG.md` entry
  (AGENTS.md §Versioning).

Run `npm run build` and `npm test`, and report the real output. Say plainly that layout and
clicks were not checked in a browser unless you actually checked them.
