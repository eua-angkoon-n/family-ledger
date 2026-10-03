---
target: หน้าวางแผน
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:D:\\Project\\family-ledger\\web\\src\\pages\\MonthlyPlan.tsx"
target_fingerprint: "sha256:dfe1308dd6c92f388b24c8c0cbfa898d18ea852bb987b38023290345d2ab6eba"
target_path: "D:\\Project\\family-ledger\\web\\src\\pages\\MonthlyPlan.tsx"
timestamp: 2026-10-02T17-07-16Z
slug: web-src-pages-monthlyplan-tsx
---
Method: dual-agent (A: design review · B: detector + audit)
## Design Health Score — 27/40 (Acceptable): H1 3 · H2 3 · H3 3 · H4 2 · H5 2 · H6 3 · H7 3 · H8 2 · H9 3 · H10 3
## Audit — 13/20 (Acceptable): A11y 2 · Perf 3 · Responsive 3 · Theming 3 · Integrity 2 (planning PASS / installments partial)
Detector CLI 0 (sx not scanned)
## Priority issues
P1 row delete one-click incl. recurring rows (canDelete ignored) · P1 Installments detail 8 headers vs 7 cells · P1 selected-row contrast (dark 1.1–1.8) · P1 mobile tables scroll (minWidth 880) instead of dropping columns
P2 statement copy contradicts ADR-0004 + dead reviewing modal · P2 overdue uses error not warning, unselected toggle chips coloured · P2 TableContainer unnamed · P2 disabled vs aria-disabled · P2 IncomeSection h3 off-ramp · P2 amount errors colour-only · P2 Section Failure Rule (rules failure shows empty) · P2 modal edits lost silently, two "ยกเลิก"
## Structural (ask user): xs column collapse · collapse/move recurring-rules · reorder items before income / hero paid progress · deduction/reserve rows "overdue"?
