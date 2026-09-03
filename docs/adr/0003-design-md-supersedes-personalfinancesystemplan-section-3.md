# 0003 — `DESIGN.md` เป็นแหล่งจริงของ UI ทับ `personalfinancesystemplan.md` §3

- สถานะ: ตัดสินใจแล้ว
- วันที่: 2026-09-02

## บริบท

`docs/plans/personalfinancesystemplan.md` §3 (ข้อกำหนด UI ชุดแรกของโปรเจกต์) ระบุ light mode
เป็นค่าเริ่มต้น, สีหลัก Hyacinth Crimson, ฟอนต์พิกเซล 8-bit บนปุ่ม/label, และ Lucide icon set
โค้ดจริงที่ implement ไปแล้ว (`web/src/theme.ts`, `main.tsx`, `Accounts.tsx`, `Admin.tsx`) และ
`DESIGN.md` ที่เขียนตามหลัง กลับเป็น dark-only, accent `#70adfb` (Hyacinthia Sky), ฟอนต์
`iannnnn-DOG` เฉพาะหัวข้อ/บรรยาย (ห้ามแตะข้อมูลการเงิน), และ MUI icon — ตรงข้ามกับ §3 ทั้งสี่แกน
โดยไม่มีการบันทึกการกลับทิศไว้ที่ไหน `docs/status.md` และ `docs/plans/phases/4b-dashboard.md`
ระบุว่าต้องออก ADR ก่อนเริ่มงาน UI ใน Slice 4B — Dashboard และ Transaction Review UI คืองาน UI
ก้อนแรกที่มีนัยสำคัญของโปรเจกต์ (ก่อนหน้านี้มีแต่ Accounts/Admin ซึ่งเป็นฟอร์มจัดการข้อมูลง่าย ๆ)

## การตัดสินใจ

`DESIGN.md` (root) เป็นข้อกำหนด UI ที่มีผลจริงของโปรเจกต์ ทับ `docs/plans/personalfinancesystemplan.md` §3
ซึ่งถือเป็นเอกสารล้าสมัย (superseded) ตั้งแต่บัดนี้ การกลับทิศมีสี่แกน:

1. **Light mode (ค่าเริ่มต้น) → Dark-first** `personalfinancesystemplan.md` §3.1/§3.6 ให้ light
   เป็นค่าเริ่มต้นและ dark เป็นตัวเลือกเสริมที่ยังไม่กำหนดสี โค้ดจริง (`web/src/theme.ts`
   `palette.mode: 'dark'` ตายตัว, ไม่มี color-mode toggle) และ `DESIGN.md` เป็น dark-only

2. **Hyacinth Crimson → Hyacinthia Sky (`#70adfb`)** §3.2 กำหนด `--color-primary` เป็น crimson
   `oklch(55.49% 0.2143 14.10)` ใช้กับ primary action, focus, heading และสถานะ error `DESIGN.md`
   ใช้ `#70adfb` เป็น accent เดียว สงวนไว้เฉพาะ primary action/focus/tab ที่เลือก (The Restrained
   Accent Rule) — สีเขียว (`income`/`#52cd86`) แยกไปทำหน้าที่สถานะสำเร็จแทน ไม่ใช่ crimson

3. **ฟอนต์พิกเซลบนปุ่ม/label → แบนจากข้อมูลและ control ทั้งหมด (กว้างกว่า §3.4 เดิม)** §3.4 เดิมห้าม
   ฟอนต์ pixel กับ "เนื้อหาหลัก/ตัวเลขจำนวนเงิน" อยู่แล้วครึ่งหนึ่ง — ครึ่งนั้น**รอดมา**เป็น Financial
   Clarity Rule สิ่งที่กลับทิศจริงคือครึ่งที่เหลือ: §3.4 ให้ใช้ฟอนต์ pixel/8-bit **กับปุ่มและ label**
   เพื่อสร้าง character `DESIGN.md` กลับด้านตรงนั้น — `iannnnn-DOG` (ฟอนต์ display ที่ใกล้
   pixel-adjacent) ใช้ได้เฉพาะชื่อหน้า/หัวข้อ/บรรยายที่ไม่ใช่ข้อมูล (Two-Lane Type Rule) และขยาย
   ขอบเขตห้ามจากเดิมไปถึง input/tab/table ด้วย ไม่ใช่แค่ตัวเลขจำนวนเงิน

4. **Lucide icons → MUI icons** §3.7 ระบุ Lucide ทั้งระบบ โค้ดจริงใช้ `@mui/icons-material`
   ทุกจุด ไม่มี Lucide dependency ในโปรเจกต์

5. **สีตกแต่ง/สีรอง (Petal, Lavender) และสี warning (Honey) → ถอดออก** §3.3 ให้ Honey เป็นสี warning
   และ Petal/Lavender เป็น "สีรอง/พื้นผิวตกแต่ง (accent, badge, background เบา ๆ)" `DESIGN.md`
   ไม่มี warning token เลย และ Restrained Accent Rule ห้าม accent เป็นสีตกแต่งทั่วไป — โค้ดสไลซ์นี้
   ต้องเลี่ยงปัญหานี้จริงที่ `web/src/components/DataFreshness.tsx` (ใช้ไอคอน+ข้อความแทนสี warning
   ที่ไม่มีอยู่ในระบบ) เป็นแกนที่ห้าเพราะไม่ใช่แค่กลับทิศ แต่เป็นการถอดคำศัพท์สีออกทั้งหมวด

**สิ่งที่ไม่ได้กลับทิศ — รอดมาโดยไม่เปลี่ยน:** กติกาการช่วยการเข้าถึง §3.3 ที่ว่า "สีต้องคู่กับ text
หรือ icon เสมอ ห้ามสื่อความหมายด้วยสีล้วน" ยังคงอยู่ใน `DESIGN.md` ในชื่อ **The Semantic Color Rule**
เนื้อหาเดียวกัน คนละถ้อยคำ และ §3.4's ban on pixel font สำหรับตัวเลขจำนวนเงินก็รอดมาครึ่งหนึ่งตามแกนที่ 3
ข้างต้น — §3 ไม่ได้ตายทั้งฉบับ ส่วนที่เหลือ (แกน 1, 2, 4, 5 และอีกครึ่งของแกน 3) กลับทิศ

## ผลที่ตามมา

- งาน UI ทุกชิ้นนับจากนี้ (Slice 4B เป็นต้นไป) อ้างอิง `DESIGN.md` เป็นข้อกำหนดเดียว
  `personalfinancesystemplan.md` §3 คงไว้ในไฟล์เพื่อประวัติ แต่ไม่ใช้ตัดสินงานอีกต่อไป
- `ledger-reviewer` เช็คทุก diff ที่แตะ UI ว่าไม่ละเมิด Don't ทั้งหกข้อใน `DESIGN.md` §"Do's and Don'ts"
  โดยเฉพาะ Financial Clarity Rule (ห้ามฟอนต์ display กับข้อมูลการเงิน) และ Restrained Accent Rule
  (accent ไม่ใช่สีตกแต่ง) ซึ่งเป็นสองข้อที่ §3 เดิมขัดกันตรง ๆ
- Dependency ใหม่สำหรับ UI (chart library, router) ตัดสินใจแยกต่างหากในแต่ละ slice แต่ต้องสอดคล้อง
  กับ `DESIGN.md` เสมอ ไม่ใช่ §3
- `DESIGN.md` ไม่มีหมวด data-visualization palette — Slice 4B เพิ่ม `categoryPalette` (8 สี OKLCH
  สำหรับกราฟหลายอนุกรม เช่น สัดส่วนค่าใช้จ่ายต่อหมวด) ที่ `web/src/theme.ts` โดยเลือก hue ให้ห่างจาก
  accent (H≈255°), income (H≈155°) และ expense (H≈25°) อย่างน้อย 20° ทุกค่า เพื่อไม่ให้ปนกับความหมาย
  ของสามสีนั้น ทุก slice ที่เพิ่มกราฟหลายอนุกรมใหม่ใช้ชุดนี้ ไม่สร้างชุดสีคู่ขนานเอง
