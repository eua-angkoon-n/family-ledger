---
target: หน้าแดชบอร์ด
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:D:\\Project\\family-ledger\\web\\src\\pages\\Dashboard.tsx"
target_fingerprint: "sha256:05528acb0a4b661a80f0bca4982cf5d38d63ebbe7d94faf82d7339625490241b"
target_path: "D:\\Project\\family-ledger\\web\\src\\pages\\Dashboard.tsx"
timestamp: 2026-10-02T08-58-43Z
slug: web-src-pages-dashboard-tsx
---
Method: dual-agent (A: design review · B: detector + audit) + browser detector injection (main session)

## Design Health Score — 23/40 (Acceptable)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | ฿0.00 แยกไม่ออกจาก "statement ยังไม่มา"; วันที่ข้อมูลถึงอยู่ล่างสุด; เปลี่ยนเดือนแล้วทั้งหน้ากลายเป็น skeleton |
| 2 | Match system / real world | 2 | ศัพท์ checksum/กระแสเงินสดสุทธิ/นับสองขา; "October 2026" ปนวันที่ พ.ศ.; แกนกราฟ "26-05" |
| 3 | User control & freedom | 3 | เดือนอยู่ใน URL, back ได้, drill-down คงเดือน |
| 4 | Consistency & standards | 2 | การ์ดกดได้/กดไม่ได้หน้าตาเหมือนกัน; caption บางใบอยู่ใน ⓘ; หัวกราฟ h2 เท่าหัวส่วน |
| 5 | Error prevention | 3 | กันตัวเลขเดือนเก่าค้าง แต่เดือนเริ่มต้นว่างชวนอ่านผิด |
| 6 | Recognition vs recall | 2 | มองไม่ออกว่าการ์ดไหน drill ได้; ขอบเขตข้อมูลซ่อนใน ⓘ |
| 7 | Flexibility & efficiency | 2 | drill-down ดี แต่ไม่มีคีย์ลัดเปลี่ยนเดือน ไม่มีเทียบเดือนก่อน |
| 8 | Aesthetic & minimalist | 2 | statement ล้มเหลวแสดงซ้ำสองที่; การ์ดค่า 0 หนักเท่าปัญหาจริง; กราฟว่างสองใบ |
| 9 | Error recovery | 2 | LoadError ไม่มีปุ่มลองใหม่; alert ล้มเหลวไม่มี action; summary ล้มเหลวซ่อนทั้งหน้า |
| 10 | Help & documentation | 3 | มีคู่มือ/ⓘ/เหตุผลการ์ด disabled แต่วิธีแก้อยู่แค่ในทัวร์ |

## Audit Health Score — 13/20 (Acceptable)
A11y 2 · Performance 3 · Responsive 2 · Theming 3 · Integrity 3 (PASS)
Detector CLI: 0 findings. Browser detector: 41 (low-contrast #7a7a7a 3.6–3.7:1 = known theme gap; gray-on-color #5b5b5b บนการ์ดครีม = ค่าธีม; clipped-overflow MuiTabs = false positive; layout-transition max-width)

## Priority issues
1. [P1] เดือนเริ่มต้นไม่มีข้อมูล: ฿0.00 สามใบใต้ "เงินจริง" — clarify
2. [P1] การ์ดกดได้ใน dark mode hover แล้วตัวเลขหาย (expense 1.04:1) + ไม่มี focus ring บนการ์ด — harden
3. [P1] 320px ล้นจอ (chart grid minmax 320px, MonthPicker 148px) + ป้ายเดือน/แกนกราฟถูกตัด — adapt
4. [P1] สัญญาณคุณภาพข้อมูลไม่พาไปแก้ + โหลดล้มเหลวดูเหมือนข้อมูลว่าง ไม่มี retry — harden
5. [P2] ลำดับชั้นแบน: การ์ด 10 ใบน้ำหนักเท่ากัน, ค่าเกินกำหนดเป็น caption เล็ก, การ์ด drill ได้มองไม่ออก, หัวกราฟไม่บอกช่วงเวลา — layout/polish

## Persona red flags
- Alex: ไม่มีคีย์ลัด ←/→ เปลี่ยนเดือน, ทั้งหน้ากระโดดเป็น skeleton ทุกครั้ง
- Sam: การ์ดไม่มี focus ring, การ์ดเป็น role=button ทั้งที่เป็นลิงก์, กราฟไม่มีชื่อ/ข้อความแทน, VersionBadge aria-label บน div
- Casey: 320px ล้นจอ, MonthPicker ตัดคำ, หน้าเลื่อนยาว ~4.5 จอ, กราฟว่างกินที่ ~700px

## Minor
alert statement ล้มเหลวบรรทัดซ้ำกันอ่านเหมือนบั๊ก · DataFreshness ชื่อซ้ำ "KBank / KBank" · ฿0.00 ยังเป็นสีเขียว/แดง · skeleton ทรงตารางไม่ตรงกับการ์ด · Noto Sans Thai ไม่ได้โหลด + Lora โหลดแต่ไม่ใช้ · radius 10px ฮาร์ดโค้ด

## Questions
- ควรเปิดแดชบอร์ดที่เดือนล่าสุดที่มีข้อมูลแทนเดือนปัจจุบันไหม
- คุณภาพข้อมูลควรเป็นบรรทัดสถานะเดียวแทน 5 การ์ดไหม
