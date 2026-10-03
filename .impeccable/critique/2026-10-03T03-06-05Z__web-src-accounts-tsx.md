---
target: หน้าบัญชี
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:D:\\Project\\family-ledger\\web\\src\\Accounts.tsx"
target_fingerprint: "sha256:a0cde5f2db96826e5ac239c6e72411efb58c4e38075c9d190824e2327a17d8d4"
target_path: "D:\\Project\\family-ledger\\web\\src\\Accounts.tsx"
timestamp: 2026-10-03T03-06-05Z
slug: web-src-accounts-tsx
---
Method: dual-agent (A: design review · B: detector + audit) · round 0 (ก่อนแก้)
## Design Health Score — 23/40 (Fair): H1 2 · H2 2 · H3 2 · H4 2 · H5 2 · H6 3 · H7 2 · H8 3 · H9 2 · H10 3
## Audit — 13/20 (Fair): A11y 2 · Perf 3 · Responsive 2 · Theming 4 · Integrity 2 (FAIL)
## P1
- ปุ่ม "ดึงอีเมลใหม่" ที่ DataFreshness/แดชบอร์ด/คู่มือพาให้มาหา ไม่มีอยู่จริง (POST /api/email-accounts/:id/sync มีแต่ไม่ถูกเรียก)
- ตาราง minWidth 780/560 ไม่ยุบบนมือถือ, ปุ่มแถวเป็นข้อความ, TableContainer ไม่มีชื่อ region
- โหลดพลาดหน้าตาเหมือนไม่มีข้อมูล + reload กะพริบ skeleton
## P2
- modal ไม่มี dirty/footer, ปุ่ม disabled, onExited, error ร่วม, ลิงก์ OAuth อยู่ในฟอร์ม, รหัสผ่านไม่มีแสดง/ซ่อน + hint
- ส่วน Tax Entity แสดงทั้งที่ TAX_PAGES_ENABLED ปิด (คำอังกฤษ "Tax Entity", "VAT", "AES-256-GCM")
- autoComplete ควร new-password, <code> รอบเลขบัญชี/อีเมลควรใช้ dataTextSx, ซ่อนบัญชีไม่มีทางคืน + สีไม่ตรง, รายการกล่องเมลไม่ใช่ ul/li
