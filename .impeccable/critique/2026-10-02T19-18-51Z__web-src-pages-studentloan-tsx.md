---
target: หน้า กยศ.
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:D:\\Project\\family-ledger\\web\\src\\pages\\StudentLoan.tsx"
target_fingerprint: "sha256:cda337ad0b43d8230b54b2c96d66b0a0067255eeb0f12627e1dbcdeae7980300"
target_path: "D:\\Project\\family-ledger\\web\\src\\pages\\StudentLoan.tsx"
timestamp: 2026-10-02T19-18-51Z
slug: web-src-pages-studentloan-tsx
---
Method: dual-agent (A: design review · B: detector + audit) · populated state via realistic mock from the real engine
## Design Health Score — 24/40 (Acceptable): H1 2 · H2 3 · H3 2 · H4 2 · H5 2 · H6 3 · H7 2 · H8 3 · H9 2 · H10 3
## Audit — 15/20 (Good): A11y 2 · Perf 4 · Responsive 3 · Theming 4 · Integrity 2 (coherent, drift from later named rules)
## Priority issues
P1 selected rows contrast (dark 1.1–1.7) · P1 tables don't collapse below md · P1 edit modal: no dirty guard/footer/form, disabled vs aria-disabled · P1 scroll regions unnamed
P2 what-if far from results, no trial marker/reset, bad input silently ignored · P2 UTC "today" default + module constant · P2 amount helpers/inputMode missing · P2 Quiet Notice, disclosure aria-expanded, EmptyState heading level, success notice under aria-hidden
## Structural (ask): what-if placement + save action · comparison clickable rows / best marker · header method paragraph to disclosure
