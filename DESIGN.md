---
version: alpha
name: Hyacinthia Ledger
description: บัญชีรายรับ-จ่าย ที่เป็นมิตรสำหรับทุกคน
colors:
  # ที่มา: tweakcn "Bubblegum" (https://tweakcn.com/r/themes/bubblegum.json) แปลง oklch → hex (sRGB, gamut-mapped)
  # ค่าที่มี "# AA" ต่อท้าย = ปรับจากค่าของธีมให้ผ่าน WCAG AA ตามที่ผู้ใช้อนุมัติ 2026-10-02 (ดูหัวข้อ Contrast)
  # source of truth ของโค้ดอยู่ที่ web/src/theme.ts `tokens.light` / `tokens.dark`
  light-background: "#f6e6ee"
  light-foreground: "#5b5b5b"
  light-card: "#fdedc9"
  light-popover: "#ffffff"
  light-primary: "#b43481" # AA, ธีม #d04f99
  light-primary-foreground: "#ffffff"
  light-secondary: "#8acfd1"
  light-secondary-foreground: "#333333"
  light-muted: "#b2e1eb"
  light-muted-foreground: "#676767" # AA, ธีม #7a7a7a
  light-accent: "#fbe2a7"
  light-accent-foreground: "#333333"
  light-destructive: "#bd373f" # AA, ธีม #f96f70
  light-destructive-foreground: "#ffffff"
  light-border: "#d04f99"
  light-input: "#868686" # AA, ธีม #e4e4e4
  light-ring: "#d15d98" # AA, ธีม #e670ab
  light-sidebar: "#f8d8ea"
  light-sidebar-accent: "#f9a8d4"
  light-sidebar-accent-foreground: "#333333"
  light-shadow: "hsl(325.78 58.18% 56.86%)"
  # ไม่มีใน Bubblegum — เลือกเองให้ผ่าน AA บนพื้นของธีม
  light-income: "#047743"
  light-expense: "#c13234"
  light-warning: "#9a4d00"
  dark-background: "#12242e"
  dark-foreground: "#f3e3ea"
  dark-card: "#1c2e38"
  dark-popover: "#1c2e38"
  dark-primary: "#fbe2a7"
  dark-primary-foreground: "#12242e"
  dark-secondary: "#e4a2b1"
  dark-secondary-foreground: "#12242e"
  dark-muted: "#24272b"
  dark-muted-foreground: "#e4a2b1"
  dark-accent: "#c67b96"
  dark-accent-foreground: "#12242e" # AA, ธีม #f3e3ea
  dark-destructive: "#e66aaa" # AA, ธีม #e35ea4
  dark-destructive-foreground: "#12242e"
  dark-border: "#324859"
  dark-input: "#5d7c90" # AA เฉพาะเส้นขอบ (พื้นช่องกรอกยังเป็น #20333d/30), ธีม #20333d
  dark-ring: "#50afb6"
  dark-sidebar: "#101f28"
  dark-sidebar-accent: "#f9a8d4"
  dark-sidebar-accent-foreground: "#1f2937"
  dark-shadow: "#324859"
  dark-income: "#52cd86"
  dark-expense: "#f5674e"
  dark-warning: "#ffa726"
  # chart-1..5 ของแต่ละโหมดอยู่ที่ tokens.<light|dark>.categoryPalette ใน theme.ts (ใช้กับกราฟเท่านั้น)
typography:
  headline-large:
    fontFamily: "Poppins, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.3
  headline-medium:
    fontFamily: "Poppins, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  headline-small:
    fontFamily: "Poppins, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  data-display:
    fontFamily: "Poppins, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.25rem" # 1.125–1.75rem ตามความกว้างการ์ด ดู Hierarchy
    fontWeight: 400
    lineHeight: 1.3
  description:
    fontFamily: "Poppins, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  body:
    fontFamily: "Poppins, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Poppins, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.75
  mono:
    fontFamily: "Fira Code, ui-monospace, monospace"
    fontSize: "0.85em"
    fontWeight: 400
  # token เท่านั้น — ไม่ได้โหลดจาก Google Fonts และยังไม่มีที่ใช้
  serif:
    fontFamily: "Lora, Noto Serif Thai, serif"
    fontSize: "1rem"
    fontWeight: 400
rounded:
  sm: "2.4px"
  md: "4.4px"
  lg: "6.4px"
  xl: "10.4px"
spacing:
  half: "4px"
  base: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
    height: "40px"
  button-primary-dark:
    backgroundColor: "{colors.dark-primary}"
    textColor: "{colors.dark-primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
    height: "40px"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.light-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
    height: "40px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.light-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "16px 14px"
    height: "56px"
  card:
    backgroundColor: "{colors.light-card}"
    textColor: "{colors.light-foreground}"
    rounded: "{rounded.xl}"
    padding: "24px"
  card-dark:
    backgroundColor: "{colors.dark-card}"
    textColor: "{colors.dark-foreground}"
    rounded: "{rounded.xl}"
    padding: "24px"
  chip-success:
    backgroundColor: "{colors.light-income}"
    textColor: "{colors.light-popover}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
  nav-tab-active:
    backgroundColor: "{colors.light-sidebar-accent}"
    textColor: "{colors.light-sidebar-accent-foreground}"
    typography: "{typography.label}"
    padding: "12px 16px"
    height: "48px"
  nav-tab-active-dark:
    backgroundColor: "{colors.dark-sidebar-accent}"
    textColor: "{colors.dark-sidebar-accent-foreground}"
    typography: "{typography.label}"
    padding: "12px 16px"
    height: "48px"
---

# Design System: Hyacinthia Ledger

## Overview

**Creative North Star: "Hyacinthia Ledger - สมุดบัญชีครบวงจร"**

Hyacinthia Ledger คือสมุดบัญชีครอบครัวยุคดิจิทัลที่ทำให้ข้อมูลการเงินซับซ้อนดูชัดเจนและตรวจสอบได้ ภาษาภาพทั้งชุด (สี ฟอนต์ รัศมีมุม และเงา) มาจากธีม **Bubblegum ของ tweakcn** (shadcn registry `https://tweakcn.com/r/themes/bubblegum.json`) ซึ่งสดใส ขี้เล่น และเป็นมิตร วางบนโครงสร้างผลิตภัณฑ์ที่คุ้นเคย เพื่อให้ผู้ใช้มุ่งกับงานแทนที่จะต้องเรียนรู้หน้าจอ

การจัดวางอ้างอิงความชัดเจนของแอป KBank เฉพาะระดับ layout และลำดับชั้นข้อมูล ส่วนอัตลักษณ์สีและบุคลิกเป็นของ Bubblegum ส่วนประกอบต้องรู้สึกคุ้นเคยและมั่นใจ โดยไม่ลดทอนความแม่นยำที่ผลิตภัณฑ์การเงินต้องมี

**Key Characteristics:**

- สามโหมดสี สว่าง / มืด / ตามเครื่อง (ค่าเริ่มต้น)
- สว่าง: พื้นชมพูหม่น การ์ดสีครีมเนย ปุ่มหลักชมพู Bubblegum; มืด: พื้นน้ำเงินทะเลลึก ปุ่มหลักเหลืองเนย
- การ์ด เมนู และ dialog มีเงาแบบ hard offset 3px สีชมพู (สว่าง) / น้ำเงินเทา (มืด) เป็นลายเซ็นของธีม
- โครงสร้าง task-first ที่ใช้งานได้ทั้งเดสก์ท็อปและมือถือ ความหนาแน่นระดับสบาย
- การเคลื่อนไหวสั้นและมีหน้าที่ พร้อม reduced-motion fallback

## Colors

ใช้ชื่อ token ตาม shadcn (`background`, `primary`, `accent`, `sidebar-accent` …) ในเอกสารนี้เรียกด้วยชื่อ role ซึ่งหมายถึงค่าของโหมดที่แสดงอยู่ (`light-*` หรือ `dark-*` ใน frontmatter) ทุกค่ามาจาก Bubblegum ตรงตัว ยกเว้น `income`, `expense` และ `warning` ซึ่งธีมไม่มี และสีตัวอักษร/ขอบช่องกรอก/focus ring 8 ค่าที่ปรับให้ผ่าน AA (ดูหัวข้อ Contrast)

### Primary

- **Bubblegum Pink (AA)** / **Butter Yellow** (`primary`, สว่าง #b43481 เข้มกว่าธีมให้ผ่าน AA): พื้นปุ่ม contained และ chip filled สี primary, ลิงก์, ปุ่ม outlined/text, indicator ของ tab, switch/checkbox ตัวอักษรบนพื้นนี้ใช้ `primary-foreground`
- **Rose Ring (AA)** / **Teal Ring** (`ring`): focus ring 2px ห่าง 2px ทุก control และเส้นขอบของช่องกรอกตอน focus — ตั้งที่เดียวคือ `focusVisible` ระดับ theme ใน `theme.ts` (MUI ใส่ให้ทุก ButtonBase เอง) ห้ามเขียน ring ซ้ำต่อ component ยกเว้น tab และรายการใน drawer/เมนูที่ ring อยู่ด้านในบนพื้นของรายการเอง: ใช้สีตัวอักษรของรายการ (`currentColor`) เพราะ `ring` บน `sidebar-accent` ที่เลือกเหลือ 2.02 (สว่าง) / 1.42 (มืด) และบน `sidebar` 2.79 ส่วนสีตัวอักษรผ่าน 4.5 กับพื้นของมันทุกสถานะ (tab ปกติ 4.71/7.67, hover 9.95/5.07, เลือก 6.97/8.09, drawer 5.17/13.60) — tab ที่ไม่ได้เลือกใช้ `ring` ได้แค่ 3.05 บน app bar ธีมสว่าง จึงใช้สีตัวอักษรเหมือนกัน

### Secondary

- **Mint Lagoon** / **Dusty Rose** (`secondary`): สีรองของธีม (`palette.secondary`) ยังไม่ได้ใช้เป็นสีหลักของหน้าใด
- **Forest Balance** / **Mint Balance** (`income`): รายรับ สถานะสำเร็จ (`palette.success`) และระบบที่ทำงานปกติ
- **Brick Expense** / **Ember Expense** (`expense`, `palette.brand.expense`): จำนวนเงินรายจ่ายเท่านั้น แยกจาก `destructive`
- **Coral Alert (AA)** / **Hot Pink Alert (AA)** (`destructive`, `palette.error`): ข้อผิดพลาด การปฏิเสธ ปุ่มลบ/destructive action และ alert
- **Amber Caution** / **Amber Glow** (`warning`, สว่าง #9a4d00 / มืด #ffa726 อยู่ที่ `tokens.<mode>.warning` ใน `theme.ts`): confirm ที่ต้องระวัง, alert เตือน และตัวนับปัญหาที่มากกว่า 0 (The Issue Count Rule) เป็นตัวอักษรได้ทั้งสองโหมด (สว่าง 5.09/5.28/6.11 บน background/card/popover, มืด 8.20/7.22/7.22)
- **Snackbar แบบ filled:** ธีมสว่างใช้พื้น `main` ตัวอักษรขาว (success 5.64, info 5.66, warning 6.11, error 5.55) ธีมมืดพื้นเข้มของ MUI ไม่ผ่าน จึงตั้งพื้น success/info/warning = `main` ตัวอักษรดำ 87% (8.88/8.60/9.16) ส่วน error คงพื้นเข้มตัวอักษรขาว (5.58)

### Neutral

- **Blush Mist** / **Deep Harbor** (`background`): พื้นหลักของทุกหน้าจอและ app bar
- **Butter Card** / **Harbor Card** (`card`, `palette.background.paper`): การ์ด ตาราง และ auth panel
- **Paper White** / **Harbor Card** (`popover`): menu, popover, tooltip และ dialog
- **Graphite** / **Petal Mist** (`foreground`): ข้อความหลัก
- **Soft Graphite (AA)** / **Dusty Rose** (`muted-foreground`): metadata, helper text, ข้อความรอง และ `info`
- **Sky Wash** / **Charcoal Wash** (`muted`): skeleton
- **Lemon Cream** / **Mauve** (`accent`, ตัวอักษรบนพื้นนี้ `accent-foreground` สว่าง #333333 / มืด #12242e (AA)): พื้นตอน hover ของ tab, รายการใน drawer/เมนู และ toggle button (`action.hover`) ซึ่งเปลี่ยนสีตัวอักษรเป็น `accent-foreground` ด้วย — แถวตารางไม่ใช้ (ดู The Table Hover Rule)
- **Candy Pink** (`sidebar-accent`, ทั้งสองโหมด): พื้นของสิ่งที่ถูกเลือก (tab, รายการใน drawer/เมนู, แถวตาราง, toggle button, text selection) ตัวอักษรใช้ `sidebar-accent-foreground`
- **Petal Sidebar** / **Night Sidebar** (`sidebar`): พื้นของ drawer เมนูบนมือถือเท่านั้น (ตั้งใน `App.tsx`) drawer เนื้อหาใช้ `popover` ตาม The Content Drawer Rule
- **Bubblegum Pink** / **Harbor Line** (`border`, `palette.divider`): ขอบการ์ด เส้นตาราง เส้นแบ่ง และขอบ dialog/popover
- **Fog (AA)** / **Harbor Input (AA)** (`input`): ขอบช่องกรอก (มืด: พื้นช่องกรอกยังเป็น #20333d ที่ 30% ตามธีม)

### Category Palette

กราฟที่มีหลายอนุกรม (สัดส่วนค่าใช้จ่ายต่อหมวด ยอดคงเหลือต่อบัญชี) ใช้ `chart-1..5` ของธีมตรงตัว (`tokens.<mode>.categoryPalette`) อนุกรมที่เกิน 5 วนสีซ้ำ ทุกอนุกรมต้องมี label กราฟรายรับเทียบรายจ่ายใช้ `income` / `expense`

### Contrast

#### ปรับแล้วตามที่ผู้ใช้อนุมัติ 2026-10-02

ปรับเฉพาะสีที่เป็นตัวอักษร เส้นขอบช่องกรอก และ focus ring ส่วนพื้น การ์ด เงา เส้นขอบตกแต่ง (`border`) และสีกราฟยังตรงกับ Bubblegum ratio คิดบน `background` / `card` / `popover` (รายการเดียวกับ comment ใน `web/src/theme.ts`)

| โหมด | token (บทบาท) | เดิม → ใหม่ | ratio เดิม → ใหม่ | เกณฑ์ |
|---|---|---|---|---|
| สว่าง | `primary` เป็นตัวอักษร (ลิงก์ ปุ่ม text/outlined) | #d04f99 → #b43481 | 3.32/3.45/3.99 → 4.66/4.84/5.60 | 4.5 |
| สว่าง | ตัวอักษรขาวบน `primary` (ปุ่มหลัก) | #d04f99 → #b43481 | 3.99 → 5.60 | 4.5 |
| สว่าง | `muted-foreground` | #7a7a7a → #676767 | 3.57/3.71/4.29 → 4.71/4.88/5.66 | 4.5 |
| สว่าง | `destructive` เป็นตัวอักษร | #f96f70 → #bd373f | 2.32/2.41/2.79 → 4.62/4.79/5.55 | 4.5 |
| สว่าง | ตัวอักษรขาวบน `destructive` (ปุ่มลบ) | #f96f70 → #bd373f | 2.79 → 5.55 | 4.5 |
| สว่าง | `ring` (focus ring) | #e670ab → #d15d98 | 2.40/2.49/2.89 → 3.05/3.16/3.66 | 3.0 |
| สว่าง | `input` ขอบช่องกรอก | #e4e4e4 → #868686 | 1.06/1.10/1.27 → 3.03/3.14/3.64 | 3.0 |
| มืด | `accent-foreground` บน `accent` #c67b96 (ตอน hover) | #f3e3ea → #12242e | 2.54 → 5.07 | 4.5 |
| มืด | `destructive` เป็นตัวอักษร | #e35ea4 → #e66aaa | 4.86/4.28/4.28 → 5.32/4.68/4.68 | 4.5 |
| มืด | `destructive-foreground` #12242e บน `destructive` (ปุ่มลบ) | #e35ea4 → #e66aaa | 4.86 → 5.32 | 4.5 |
| มืด | `input` ขอบช่องกรอก (พื้นยังเป็น #20333d/30) | #20333d → #5d7c90 | 1.22/1.07 → 3.61/3.17 | 3.0 |

#### ยังไม่ผ่าน (ผู้ใช้ให้คงสีกราฟตามธีม)

| โหมด | คู่สี | ratio | เกณฑ์ | หมายเหตุ |
|---|---|---|---|---|
| สว่าง | `chart-1..4` บน `card` | 1.10–2.49 | 3.0 | chart-3 #fbe2a7 (1.10) แทบมองไม่เห็น; chart-5 #d7488e ผ่าน (3.48) |
| มืด | `chart-5` #24272b / `chart-4` #175c6c บน `card` | 1.07 / 1.86 | 3.0 | chart-5 มองไม่เห็น |
| มืด | `card` #1c2e38 บน `background` / `border` #324859 บน `background` (และบน `card` 1.47) | 1.14 / 1.67 | 3.0 | ขอบการ์ดและเงา hard offset (สีเดียวกับ `border`) จางในธีมมืด การ์ดแยกจากพื้นด้วยตำแหน่งและเงาเยื้องมากกว่าเส้นขอบ — พื้น การ์ด และเส้นขอบตกแต่งเป็นค่าของธีม ปรับเองไม่ได้ |

ทุกอนุกรมในกราฟจึงต้องมี label และกราฟทุกใบมีตารางข้อมูลซ่อนไว้ให้ screen reader อ่าน (ChartCard `table`) และกราฟหลายอนุกรมใส่ขอบ `muted-foreground` 1.5px ให้ชิ้นพาย จุดของกราฟเส้น และช่องสีวงกลมใน legend/tooltip ของทั้งสองกราฟ (`:is(rect, circle).MuiChartsLabelMark-fill` เส้น 3px ครึ่งนอกถูกขอบ svg ตัดเหลือเห็น 1.5px; บน `card` สว่าง 4.88 / มืด 6.75) ชิ้นหรือจุดที่สีจมหายจึงยังเห็นขอบเขตของมัน โดยไม่เปลี่ยนสีกราฟของธีม — พายใช้ช่องสีวงกลมเป็นค่าเริ่มต้น กราฟเส้นตั้ง `labelMarkType: 'circle'` เพราะค่าเริ่มต้น `'line+mark'` เป็น path เส้นสีของอนุกรม ใส่ขอบแล้วสีเส้นเปลี่ยน

### Named Rules

**The Bubblegum Source Rule.** token ทุกตัวมาจาก tweakcn Bubblegum ตรงตัว ยกเว้น (1) `income`, `expense`, `warning` ที่ธีมไม่มีและต้องผ่าน AA เสมอ และ (2) สีตัวอักษร/ขอบช่องกรอก/focus ring ที่ผู้ใช้อนุมัติให้ใช้ค่า AA เมื่อ 2026-10-02 (ตารางด้านบน) พื้น การ์ด เงา เส้นขอบตกแต่ง และสีกราฟห้ามปรับเอง คู่สีใหม่ที่ไม่ผ่าน AA ให้บันทึกในตาราง "ยังไม่ผ่าน" แล้วรอผู้ใช้ตัดสินใจ

**The Hyacine Identity Rule.** ใช้ layout ของ KBank เป็นข้อมูลอ้างอิงได้ แต่ห้ามนำสีเขียวประจำแบรนด์หรืออัตลักษณ์ของ KBank มาใช้เป็นสีหลัก สีเขียวสงวนไว้สำหรับ `income` และสถานะสำเร็จเท่านั้น

**The Money Color Rule.** จำนวนเงินรายจ่ายใช้ `expense` (แดงอิฐ / ส้มถ่าน) ไม่ใช้ `destructive` ซึ่งเป็นชมพูของธีมและหมายถึง error/การลบ ส่วนรายรับใช้ `income` (`success.main`) ยอด 0 เป็นสีกลางเสมอแม้ส่ง tone มา (`Money` จัดการให้) เพราะศูนย์ไม่ใช่ทั้งรายรับและรายจ่าย โอนภายในก็เป็นสีกลางด้วยเหตุผลเดียวกัน ค่าติดลบมี "−" เสมอ (`showSign` แค่เพิ่ม "+" ให้ค่าบวก) ที่ที่ต้องการค่าสัมบูรณ์ เช่นมีคำ "ต่ำกว่า/สูงกว่า" นำหน้า ส่ง `Math.abs` เอง

**The Semantic Color Rule.** สีสถานะต้องมาพร้อมข้อความหรือไอคอนเสมอ ห้ามสื่อความหมายด้วยสีเพียงอย่างเดียว

**The Restrained Accent Rule.** `primary` มีไว้สำหรับ primary action, ลิงก์ และ indicator ของ tab ที่เลือก ไม่ใช่สีตกแต่งทั่วไป `accent` เป็นพื้น hover เท่านั้น (ยกเว้นการ์ดสรุปที่ hover ด้วยการยกการ์ดตาม The Linked Card Rule) และ `sidebar-accent` เป็นพื้นของสิ่งที่ถูกเลือกเท่านั้น ห้ามสลับบทบาทกัน

**The Theme Mode Rule.** มีสามโหมด: สว่าง, มืด และตามเครื่อง (ค่าเริ่มต้น ตาม `prefers-color-scheme`) ค่าที่เลือกจำไว้ต่อเครื่อง/เบราว์เซอร์ ไม่ผูกกับบัญชีผู้ใช้ ปุ่มสลับเป็น icon button ปุ่มเดียว กดครั้งเดียวเปลี่ยนทันที วนตามลำดับ ตามเครื่อง → สว่าง → มืด → ตามเครื่อง ไอคอนแสดงโหมดปัจจุบัน ไม่มีเมนูและไม่มี Tooltip ชื่อสำหรับ screen reader (`aria-label`) บอกทั้งโหมดปัจจุบันและผลของการกด (เช่น "ธีมสี: ตามเครื่อง — กดเพื่อเปลี่ยนเป็นสว่าง") และคู่มือเกาะ `data-tour="theme-toggle"` เพราะ aria-label เปลี่ยนตามโหมด ตำแหน่ง: บน app bar ทุกขนาดจอและนอก `<nav aria-label="เมนูหลัก">` (≥ 900px อยู่ก่อนไอคอนคู่มือ, < 900px อยู่ขวาของแบรนด์ กดได้โดยไม่ต้องเปิด drawer) ไม่อยู่ใน drawer และหน้าล็อกอิน/รออนุมัติอยู่มุมขวาบนของจอ โค้ดอ่านสีผ่าน `theme.vars.palette.*` หรือ palette path ใน `sx` เสมอ ห้ามฮาร์ดโค้ด hex ของโหมดใดโหมดหนึ่ง

## Typography

**Sans (ทุกอย่าง):** Poppins 400/600 ตามด้วย Noto Sans Thai 400/600, system-ui — โหลดจาก Google Fonts ทั้งคู่ เฉพาะสองน้ำหนักที่ใช้จริง (`fontWeightMedium`/`fontWeightBold` ของ MUI และ `<strong>` ชี้มาที่ 600) Poppins ไม่มีอักษรไทย อักษรไทยจึงมาจาก Noto Sans Thai ส่วนตัวเลขและละติน (รวมตัวเลขจำนวนเงิน) ยังเป็น Poppins
**Mono:** Fira Code 400 สำหรับ `code` และ JSON ในบันทึกการเปลี่ยนแปลง
**Serif:** Lora เป็น token ใน `theme.ts` เท่านั้น ไม่ได้โหลดและยังไม่มีที่ใช้ (shadcn ไม่ได้ใช้ serif เป็นค่าเริ่มต้น) — ถ้าจะใช้ต้องเพิ่มใน `web/index.html` ก่อน

**Character:** Poppins ทรงกลมเรขาคณิตเข้ากับความขี้เล่นของ Bubblegum letter-spacing 0 ทุกระดับ (`tracking-normal` ของธีม)

### Hierarchy

- **Headline Large** (Poppins 600, 1.75rem, 1.3): ชื่อหน้าหลัก ใช้หนึ่งครั้งต่อ surface
- **Headline Medium** (Poppins 600, 1.25rem, 1.4): หัวข้อส่วน, dialog และกลุ่มข้อมูล
- **Headline Small** (Poppins 600, 1rem, 1.5): หัวข้อย่อยในการ์ดใต้หัวข้อส่วน (h3) เช่นชื่อกราฟใน ChartCard
- **Data Display** (Poppins 400, line-height 1.3): ตัวเลขหลักของการ์ดสรุป ขนาดตามความกว้างการ์ด — การ์ดปกติ 1.25rem (xs) / 1.5rem (sm) / 1.75rem (lg), การ์ด dense (แถว 5 ใบขึ้นไป) 1.25rem (xs) / 1.125rem (md ที่การ์ดแคบสุด) / 1.5rem (lg: การ์ดกว้าง ~185px ที่ 1280px, "฿22,666.68" กว้าง ~130px) เป็นขั้นของ data display โดยตั้งใจ ไม่ snap เข้าขั้นอื่น · แดชบอร์ดใช้ dense ทั้งแถวเงินจริงและแถววางแผน ตัวเลขแผนจึงไม่ใหญ่กว่าเงินจริงในทุกขนาดจอ (เงินจริงคือเรื่องหลักของหน้า)
- **Description** (Poppins 400, 1rem, 1.6): ข้อความอธิบายและ empty-state copy จำกัดความยาวประมาณ 65–75 ตัวอักษรต่อบรรทัด
- **Body/Data** (Poppins 400, 1rem, 1.5): ข้อมูล ตาราง ค่าในช่องกรอก
- **Label** (Poppins 600, 0.875rem, 1.75): ปุ่ม, tab, table header และข้อความควบคุม ใช้ตัวพิมพ์ตามภาษาปกติ ไม่ใช้ uppercase

### Named Rules

**The One-Family Type Rule.** ทุกข้อความใช้ stack Poppins + Noto Sans Thai ชุดเดียว (Noto Sans Thai เติมเฉพาะอักษรไทย) แยกลำดับชั้นด้วยขนาดและน้ำหนัก (400 / 600) ไม่ใช่การสลับฟอนต์ ข้อยกเว้นเดียวคือ code/JSON ที่ใช้ Fira Code ใน code ยังใช้ชื่อ helper เดิม (`brandCopySx`, `dataTextSx`, `descriptionSx`) ซึ่งตอนนี้ชี้ไปที่ Poppins ทั้งหมด

**The Financial Clarity Rule.** ตัวเลข จำนวนเงิน เลขบัญชี และอีเมลผ่าน `dataTextSx` (`tabular-nums`) เสมอ ข้อจำกัดที่รู้อยู่: Poppins ไม่มี OpenType feature `tnum` และตัวเลขปกติกว้างไม่เท่ากัน (เช่น "1" แคบกว่า "0" เกือบครึ่ง) ตัวเลขในคอลัมน์จึงยังไม่ตรงแนวหลัก จนกว่าผู้ใช้จะตัดสินใจเรื่องฟอนต์ตัวเลข

## Elevation

ระบบใช้ **Hard Offset** ของ Bubblegum: เงาเป็นบล็อกเยื้อง 3px/3px ไม่ฟุ้ง (blur 0) สีชมพู hsl(325.78 58.18% 56.86%) ในธีมสว่าง และ #324859 ในธีมมืด ระดับ sm/md/lg ต่างกันที่ชั้นที่สองซึ่งฟุ้งเล็กน้อยตามค่าในไฟล์ธีม เงาเปลี่ยนตามธีมผ่าน CSS var (`palette.brand.shadow*`)

### Shadow Vocabulary

- **Card Offset** (`shadow-sm`, MUI elevation 1–3): การ์ดและ outlined Paper ทุกใบ
- **Floating Offset** (`shadow-md`, MUI elevation 4–11): menu, popover, drawer, แถบ action ที่ลอย และการ์ดคู่มือ
- **Dialog Offset** (`shadow-lg`, MUI elevation 12–24): dialog

### Named Rules

**The Hard Offset Rule.** เงาเป็นส่วนหนึ่งของอัตลักษณ์ ไม่ใช่ตัวบอกความลึกอย่างเดียว การ์ดทุกใบจึงมี Card Offset เสมอ แต่กล่องย่อยภายในการ์ด แถวตาราง และปุ่มไม่มีเงา ห้ามใช้เงานุ่มแบบ soft blur หรือ halo สีที่ไม่ได้มาจากธีม

**The Floating Selection Bar Rule.** แถบ action ที่ลอยเหนือเนื้อหาเมื่อมีรายการ/แถวถูกเลือก ใช้ Floating Offset (MUI elevation 8) และยึดติดขอบล่างจอ (fixed bottom) แถบต้องไม่บังการทำงานของ version badge มุมล่างขวา (ผู้ใช้ยังต้องอ่านเลขเวอร์ชันได้) และต้องไม่ทับ snackbar ระหว่างที่แถบแสดงอยู่ snackbar ย้ายไปขึ้นด้านบนจอแทน ใช้ `FloatingSelectionBar` (ใน `PlanSelectionBar.tsx`) เป็นโครงของแถบทุกหน้า (หน้าวางแผน, หน้าธุรกรรม) แล้วใส่ข้อความ "เลือก N รายการ" (`role="status"`) กับปุ่ม action ของหน้าเอง ปุ่มบอกจำนวนในวงเล็บ เช่น "ทำเครื่องหมายตรวจแล้ว (N)" เลือกได้เฉพาะแถวที่ action ทำได้จริง (หน้าธุรกรรม: เฉพาะแถวที่ยังไม่ตรวจ ไม่มีแถวแบบนั้นในหน้าก็ไม่มีคอลัมน์ checkbox) ที่เลือกล้างเมื่อตัวกรองหรือหน้าเปลี่ยน และเมื่อแถบหายไปพร้อมปุ่มที่ถือ focus อยู่ ย้าย focus ไปที่ตาราง

## Components

Component vocabulary คือ **คุ้นเคย มั่นใจ และเป็นมิตร** ใช้ MUI เป็นฐาน รัศมีมุมตามสเกล shadcn (r = 0.4rem = 6.4px: sm 2.4px, md 4.4px, lg 6.4px, xl 10.4px)

### Buttons

- **Shape:** มุม `md` และพื้นที่กดสูงอย่างน้อย 40px
- **Primary:** contained พื้น `primary` ตัวอักษร `primary-foreground` สำหรับ action สำคัญที่สุดในบริบทนั้น hover เข้มขึ้นตาม `primary.dark` ของ MUI
- **Focus / Disabled:** focus ใช้เส้น `ring` 2px; disabled ลด emphasis แต่ label ต้องยังอ่านได้ ปุ่มที่ถือ focus อยู่แล้วกดไม่ได้ชั่วคราว (ReviewDrawer: กำลังบันทึก, กำลังยืนยัน/ปฏิเสธคู่โอน, ก่อนหน้า/ถัดไปที่ปลายรายการ · ปุ่มทั้งหมดของ `ConfirmDialog` ระหว่าง busy · ปุ่มในแถบรายการที่เลือกของหน้าธุรกรรมระหว่างตรวจแบบกลุ่ม) ใช้ `aria-disabled` + กดแล้วไม่ทำอะไร แทน `disabled` ซึ่งถอดปุ่มออกจากลำดับ tab แล้ว focus ตกไปที่ `<body>` หน้าตาตอน aria-disabled ตั้งที่ `MuiButton` ใน `theme.ts` ให้เหมือน disabled ของ MUI ทุก variant และ hover ไม่เปลี่ยน: ตัวอักษร `action.disabled`, contained พื้น `action.disabledBackground`, outlined ขอบ `action.disabledBackground`, cursor ปกติ
- **Secondary / Ghost:** outlined สำหรับ action รอง, text/ghost สำหรับ cancel และ action ที่ไม่ควรแย่งความสนใจ
- **Destructive:** ใช้ `destructive` (`color="error"`) พร้อมคำกริยาที่ชัดเจนและ confirmation เมื่อผลย้อนกลับยาก

### Chips

- **Style:** มุม `md` ตาม Badge ของ shadcn (`rounded-md`) ใช้แสดงสถานะสั้น ๆ ไม่ใช้เป็นปุ่มทั่วไป
- **State:** success ใช้ `income`; self/selected ใช้ `primary` (filled); ทุก chip ต้องมี label ที่อธิบายความหมาย
- **Outlined สีปกติ** (ตัวกรอง, toggle ที่ไม่ได้เลือก, หมวดในตาราง): ขอบ `input` แทนขอบของ MUI (สว่าง 1.56 → 3.03/3.14/3.64, มืด 2.57 → 3.61/3.17/3.17 บน background/card/popover; แถวตารางตอน hover 3.64 / 3.39) ไอคอนลบ `muted-foreground` (บน background 1.44 → 4.71, มืด 2.12 → 7.67) chip ที่กดได้ตอน hover พื้น `accent` ตัวอักษรและไอคอนเป็น `accent-foreground` เหมือน tab (9.95 / 5.07 — มืดเดิม 2.54) ตั้งที่ `MuiChip` ใน `theme.ts` เฉพาะ `colorDefault` chip outlined สีสถานะ (เช่น "ยืนยันแล้ว") คงขอบสีของมัน
- **Toggle filter:** chip กดได้เฉพาะเมื่อเป็นตัวกรองแบบเปิด/ปิด ตาม The Toggle Chip Rule ด้านล่าง

**The Toggle Chip Rule.** chip ทำหน้าที่เป็นตัวกรองแบบเปิด/ปิดได้เมื่อมี `aria-pressed` บอกสถานะเสมอ ตอนเลือกใช้ `primary` (`color="primary"`, `variant="filled"`) ตอนไม่เลือกเป็น outlined สีปกติ และ label ต้องบอกว่ากรองอะไร (ตัวอย่าง: chip "ยังไม่ตรวจ" และ "ยังไม่จัดหมวด" (`?uncategorised=1` เปิดแล้วล้างหมวดที่เลือกไว้ เพราะขัดกัน) ในหน้าธุรกรรม อยู่แถวเดียวกับปุ่ม "ตัวกรองเพิ่มเติม" ซึ่งตัดบรรทัดได้ — จอ xs ปุ่มแสดงแค่ "ตัวกรอง" ตั้งใจให้สามตัวอยู่แถวเดียวที่ 375px (ไม่พอก็ตัดบรรทัด) ส่วน `aria-label` คงชื่อเต็ม · สอง chip นี้ต่อท้ายจำนวนรายการของคิวนั้นในเดือน/ช่วงวันที่และบัญชีที่เลือก ไม่รวมตัวกรองอื่น เช่น "ยังไม่ตรวจ 0" (`total_count` ของ `/api/transactions` ที่ `limit=1`, ตัวเลขผ่าน `dataTextSx`) โหลดใหม่เมื่อเดือน/บัญชีเปลี่ยนและทุกครั้งที่หน้าโหลดรายการซ้ำแบบ background (หลังบันทึก, ตรวจแบบกลุ่ม, ถัดไปข้ามหน้า) โหลดไม่ได้มีแค่ชื่อ ไม่แสดง 0 — เป็นจำนวนบน toggle ไม่ใช่ตัวนับปัญหา สีจึงตาม chip ไม่ใช้ `warning` ของ The Issue Count Rule) ห้ามใช้ chip แทนปุ่ม action ทั่วไป chip ที่กดได้สูงอย่างน้อย 40px (`minHeight: 40`) และบนมือถือไม่ยืดเต็มแถว ตัวกรองที่ซ่อนอยู่ในแผงที่พับไว้ ("ตัวกรองเพิ่มเติม") สรุปเป็น chip outlined ใต้แถบเครื่องมือ กด chip = เอาตัวกรองนั้นออก (`aria-label` "เอาตัวกรอง … ออก") แล้ว focus ไป chip ที่เลื่อนขึ้นมาแทน (เอาตัวท้ายออก = chip ก่อนหน้า) หรือปุ่ม "ตัวกรองเพิ่มเติม" เมื่อไม่เหลือ ต่อด้วยปุ่ม "ล้างตัวกรอง" ที่ล้างทุกอย่างยกเว้นเดือนและบัญชี (รวม toggle ทั้งสอง) แล้ว focus ไปช่องค้นหา ปุ่มเดียวกันอยู่ใน EmptyState ด้วย · จอ < sm ช่องบัญชีย้ายจากแถบเครื่องมือเข้าแผงนี้ (ช่องแรก) นับในตัวเลขบนปุ่มและมี chip "บัญชี: …" เหมือนตัวกรองในแผง แต่ "ล้างตัวกรอง" ยังไม่ล้างบัญชีและไม่ขึ้นเมื่อมีแค่ chip บัญชี และคำอธิบายใต้ชื่อหน้าซ่อน แถวแรกของตารางจึงขึ้นสูงขึ้น

### Cards / Containers

- **Corner Style:** มุม `xl` (10.4px)
- **Background:** `card` บน `background`
- **Border / Shadow:** 1px solid `border` + Card Offset ตาม The Hard Offset Rule
- **Internal Padding:** 24px เป็นค่าหลัก, 32px สำหรับ auth panel บนจอกว้าง

**The Linked Card Rule.** การ์ดสรุปที่พาไปหน้าอื่นเป็นลิงก์จริง (`SummaryCard to="/path"` → `<a href>` กดกลาง/เปิดแท็บใหม่ได้; `to="#id"` เลื่อนไปส่วนในหน้าเดียวกัน) มีลูกศร › ท้ายแถวหัวการ์ดเสมอ การ์ดที่ไม่มีลูกศรคือกดไม่ได้ hover ไม่เปลี่ยนพื้น (พื้น `accent` ของธีมมืดทำตัวเลขเหลือ ~1:1) แต่ยกการ์ด: เลื่อน −2px แล้วยืด hard offset เป็น 5px สี `divider` (= สีเงาของ Bubblegum ทั้งสองโหมด) ตัวอักษรจึงคง contrast ตอนปกติ focus ใช้ `ring` 2px offset 2px ส่วน `onClick` ใช้กับ action ที่ไม่ใช่การนำทางเท่านั้น

**The Issue Count Rule.** ตัวนับปัญหา (ยังไม่จัดหมวด, statement ล้มเหลว, บัญชีข้อมูลช้า, บิลเกินกำหนด) ค่า 0 เป็นสีรองเงียบ ๆ ค่ามากกว่า 0 ใช้ `warning` พร้อมไอคอนเตือน ไม่ใช้ `destructive` กับตัวนับ (แดง/ชมพูหมายถึง error ไม่ใช่ "ต้องจัดการ") แดชบอร์ดรวมเรื่องที่มากกว่า 0 ไว้ในแถบ "ต้องจัดการ" ใต้บรรทัดสถานะข้อมูล: ปุ่ม outlined `warning` + ลูกศร › ต่อเรื่องหนึ่งปุ่ม เป็นลิงก์ไปที่แก้ได้ ซ่อนทั้งแถบเมื่อไม่มีเรื่อง การ์ด 5 ใบของคุณภาพข้อมูลยังแสดงครบเหมือนเดิม เรื่องเดียวกันใช้ชื่อเดียวและปลายทางเดียวทุกที่ (แถบ การ์ด chip และคู่มือ): รายการที่ไม่มีหมวด = "ยังไม่จัดหมวด" ไม่นับโอนภายในและรายการที่ไม่นับรวม ซึ่งไม่ต้องจัดหมวด (`needsCategory` / `UNCATEGORISED_LABEL` ใน `TransactionTable.tsx`, รวมช่องหมวดในตารางและ drawer และชื่อกลุ่มในกราฟหมวดที่ API `reports.ts` ส่งมา) → `/transactions?uncategorised=1`, บัญชีที่ statement ตามไม่ทัน = "ข้อมูลช้า" → `#data-freshness`, statement อ่านไฟล์ไม่สำเร็จ / ยอดรวมไม่ตรง → `#statement-failures` (รายการทีละไฟล์พร้อมทางแก้) การ์ดที่นับได้ 0 และไม่มีอะไรให้ดูไม่เป็นลิงก์ (ยังไม่จัดหมวด, ยังไม่ตรวจ, statement ที่มีปัญหา) ยกเว้นบัญชีข้อมูลช้าที่ยังเป็นลิงก์ เพราะรายการความสดของทุกบัญชีด้านล่างมีให้ดูเสมอ

**The Awaiting Statement Rule.** statement ของเดือนที่แล้วมาถึงช่วงต้นเดือน จึงมีช่วงผ่อนผันถึงวันที่ 10: บัญชีที่ขาดเฉพาะเดือนที่แล้วในวันที่ 1–10 คือ "รอ statement" (`statement_awaiting`) ไม่ใช่ "ข้อมูลช้า" — chip outlined สีกลางพร้อมไอคอนนาฬิกาทราย และบรรทัดสีรอง "รอ statement ก.ย. 2569 (ปกติมาภายในวันที่ 10)" ไม่ใช้ `warning` ไม่นับในการ์ด "บัญชีข้อมูลช้า" และไม่อยู่ในแถบ "ต้องจัดการ" (ไม่มีอะไรให้ผู้ใช้ทำ) แถวที่รอ statement และแถว "ข้อมูลล่าสุด" ในรายการความสดของข้อมูลขึ้นบรรทัดหลัก (สีตัวอักษรปกติ) "statement ล่าสุดถึง <วันสิ้นรอบ>" ส่วนวันที่รายการล่าสุดเป็นบรรทัดรองโดยไม่มี "(n วันที่แล้ว)" ซึ่งอ่านขัดกับ chip ที่บอกว่าปกติ แถวข้อมูลช้า/ต้องเชื่อม Gmail ใหม่ยังบอกอายุของรายการ "ข้อมูลช้า" (`statement_behind`, `warning`) คือขาด 2 เดือนขึ้นไป หรือขาดเดือนที่แล้วหลังวันที่ 10 ส่วน "ต้องเชื่อม Gmail ใหม่" สำคัญกว่าทั้งสองสถานะจึงแสดงแทน

**The Pending Month Rule.** เดือนที่ statement ยังไม่มา (วันที่ข้อมูลล่าสุดอยู่ก่อนเดือนที่เลือก) การ์ดเงินเข้า/เงินออก/เหลือสุทธิ/โอนภายใน และการ์ดตัวนับของเดือนนั้น (ยังไม่จัดหมวด / ยังไม่ตรวจ) เป็น disabled (เส้นประ "—" ที่ screen reader อ่านว่า "ยังไม่มีข้อมูล" + บรรทัดสั้น "รอ statement" เพราะเส้นประในธีมมืดจางเหลือ 1.47:1 ไม่เป็นลิงก์) แทน ฿0.00 หรือ 0 ที่อ่านเหมือนไม่มีเงินเข้าออก/จัดครบแล้ว ส่วนการ์ดตัวนับที่นับทุกเดือน (statement ที่มีปัญหา, บัญชีข้อมูลช้า) ไม่ผูกกับเดือนจึงแสดงตามปกติ กราฟรายรับเทียบรายจ่ายไม่วาดแท่งของเดือนหลังเดือนข้อมูลล่าสุด tooltip และตารางซ่อนบอก "ยังไม่มี statement" และบรรทัดช่วงเวลาต่อท้าย "· ก.ย.–ต.ค. ยังไม่มี statement" ยอดคงเหลือรวมยังแสดงพร้อมบรรทัด "ณ <วันที่ข้อมูลล่าสุด>" และปุ่ม "ไปเดือนล่าสุดที่มีข้อมูล" ในประกาศด้านบนเป็นปุ่ม contained `primary` เพราะเป็นทางออกของสถานะนี้ เมื่อมีบัญชีที่ "รอ statement" และไม่มีบัญชีข้อมูลช้า/ต้องเชื่อม Gmail ใหม่ ประกาศบอกครั้งเดียวว่า "ข้อมูลล่าสุดถึง 31 ส.ค. 2569 · statement ก.ย. ปกติมาภายในวันที่ 10 ไม่ต้องทำอะไร" (ไม่ซ้ำในการ์ด) แดชบอร์ดยังเปิดที่เดือนปัจจุบันเสมอ ไม่กระโดดเดือนเอง

**The Quiet Notice Rule.** ประกาศสถานะที่คงอยู่ในหน้า (ข้อมูลถึงวันไหน, รายการ statement ที่มีปัญหา) ไม่ใช้ `role="alert"` ซึ่งเป็นค่าเริ่มต้นของ MUI Alert: ประกาศสถานะใช้ `role="status"` กล่องรายการใช้ `component="section"` + `role="region"` พร้อมหัวข้อ h3 ส่วน `LoadError` (ข้อผิดพลาดจริง) คง `alert`

**The Section Failure Rule.** แต่ละส่วนที่มาจาก request ของตัวเองแสดงสถานะของตัวเอง: กำลังโหลด = คงหัวการ์ด/กราฟไว้แล้วแทนตัวเลขด้วย skeleton (เปลี่ยนเดือนแล้ว layout ไม่กระโดด ไม่ใช้ skeleton ทั้งหน้า), โหลดไม่สำเร็จ = `LoadError` พร้อมปุ่ม "ลองใหม่" แทนที่ส่วนนั้น ห้ามแสดงเป็น 0, "ยังไม่มีข้อมูล" หรือกราฟว่าง และส่วนอื่นที่โหลดได้ยังแสดงตามปกติ

### Charts

- กราฟทุกใบอยู่ใน `ChartCard`: หัวข้อ h3 ขั้น Headline Small ใต้หัวส่วน, บรรทัดช่วงเวลา (เช่น "6 เดือนล่าสุด" หรือเดือนที่เลือก) เพราะกราฟในส่วนเดียวกันใช้ช่วงไม่เท่ากัน
- SVG ของ x-charts เป็น `aria-hidden` จึงห่อด้วย `role="figure"` (ชื่อ = หัวการ์ด, คำอธิบาย = ช่วงเวลา) และใส่ตารางข้อมูลชุดเดียวกันแบบซ่อน (`table` prop) ให้ screen reader อ่าน
- เปิด `experimentalFeatures={{ keyboardActivation: true }}` ให้ Enter/Space บนจุดที่ focus ด้วยคีย์บอร์ดเจาะดูรายการได้เหมือนคลิก
- แกนเงินใช้ `Intl.NumberFormat('th-TH', { notation: 'compact' })` แกนเดือนเป็นเดือนล้วน "ส.ค." แสดงครบทุกเดือน (`tickLabelInterval: () => true` ปีอยู่ในบรรทัดช่วงเวลาแล้ว — ป้าย ~25px ในแถบเดือนละ ~33px ที่จอ 320px) แกนวัน "31 ส.ค." (tooltip ใช้รูปเต็ม) และแกน x สูง 32px (ค่าเริ่มต้น 25px ตัดป้ายภาษาไทยทิ้ง)
- กราฟรายรับเทียบรายจ่าย: `income` กับ `expense` ธีมสว่างความสว่างเท่ากัน (1.01:1) ต่างกันแค่ hue แท่งรายจ่ายและช่องสีใน legend จึงเป็นพื้นสีอ่อน (fill-opacity 0.35) + ขอบทึบสี `expense` แยกได้โดยไม่ต้องเห็นสี ขอบยังผ่าน 3:1 บน `card` (4.81 / 4.63)
- แตะด้วยนิ้ว (click ที่มี `pointerdown` แบบ `pointerType: 'touch'` นำหน้า ไม่ใช่ดูจากชนิดเครื่อง): แตะแท่ง/ชิ้น/จุดครั้งแรกแสดง tooltip แตะซ้ำที่เดิมภายใน 4 วินาทีจึงไปหน้ารายการ เกินนั้นนับเป็นแตะแรกใหม่ เมาส์ ปากกา และ Enter จากคีย์บอร์ดไปทันทีแม้บนจอสัมผัส ไม่ยกเลิกตอน tooltip ปิด เพราะ x-charts ปิด tooltip ตอนยกนิ้วก่อน click จะมาถึง · จอสัมผัส (`hover: none`) tooltip มีบรรทัดสีรอง "แตะอีกครั้งเพื่อเปิดรายการ" (0.875rem) และ tooltip ของกราฟแท่ง/เส้นเป็น `trigger: 'item'` ขึ้นเฉพาะตอนแตะโดนแท่ง/จุดจริง (พายเป็น item อยู่แล้ว) — เครื่องที่มีทั้งเมาส์และจอสัมผัสไม่เห็นบรรทัดคำใบ้
- กราฟเส้นเปิด `showMark` เสมอ: x-charts 9 ไม่วาดจุดเป็นค่าเริ่มต้น และไม่มีจุดก็ไม่มี `onMarkClick` จุดเป็นวงสีของอนุกรมพร้อมขอบ `muted-foreground` ทุกอนุกรม (`shape: 'circle'` — ค่าเริ่มต้นวนรูปสี่เหลี่ยม/ข้าวหลามตัดตามลำดับอนุกรม) ตรงกับช่องสีวงกลมใน legend/tooltip (`labelMarkType: 'circle'`)
- ←/→ บนกราฟที่ focus อยู่เป็นของกราฟ คีย์ลัดเปลี่ยนเดือนของ MonthPicker ข้ามทุกอย่างใน `role="figure"` (x-charts ไม่ preventDefault ที่จุดแรก/สุดท้าย)
- ว่างเพราะ statement ยังไม่มา ใช้ข้อความเดียวกับบรรทัดสถานะ ("statement ต.ค. 2569 ยังไม่มา") ในกล่องที่เตี้ยกว่ากราฟ และ grid ของกราฟจัดชิดบน (`alignItems: start`) การ์ดที่ว่างจึงไม่ถูกยืดสูงตามใบข้าง ๆ · กราฟของเดือนที่เลือกว่างทั้งสองใบเพราะ statement ยังไม่มา: ≥ md grid เป็น 2 คอลัมน์ กราฟ 6 เดือนกินเต็มแถว (`gridColumn: span 2`) กล่องว่างสองใบอยู่คู่กันด้านล่าง (auto-fit เป็น 3 คอลัมน์ตั้งแต่ ~1040px ซึ่ง span 2 จะทิ้งกล่องว่างใบที่สองไว้แถวล่างใบเดียว)

### Popovers / Menus / Tooltips / Dialogs

- พื้น `popover`, ขอบ 1px `border`
- drawer เนื้อหาด้านขวา (ReviewDrawer, TaxDocumentDrawer) ก็เป็นพื้น `popover` + ขอบซ้าย 1px `border` ตาม The Content Drawer Rule
- หัวกลุ่มในเมนู (`ListSubheader` เช่นรายรับ/รายจ่ายในช่องหมวด) พื้น `popover` ไม่ใช่ `card` ของ MUI (`MuiListSubheader` ใน `theme.ts`) ตัวอักษร `muted-foreground` 5.66 / 6.75
- `ConfirmDialog` มีปุ่มที่สามได้ (`secondaryLabel`) ระหว่าง "ยกเลิก" กับปุ่มยืนยัน เช่น "ทิ้งการแก้ไข" (`color="error"` แบบ text) ปุ่มตัดบรรทัดได้ที่ 320px · `aria-describedby` ชี้ที่ `DialogContentText` (รวม Alert error ที่ผู้เรียกใส่ไว้ใน description) · ระหว่าง busy ทุกปุ่มเป็น `aria-disabled` และ Esc/คลิกฉากหลังไม่ปิด
- menu/popover/tooltip มุม `md`, dialog มุม `lg`
- menu/popover ใช้ Floating Offset, dialog ใช้ Dialog Offset และ MUI focus management

### Inputs / Fields

- **Style:** พื้นโปร่งใส (สว่าง) / `input` ที่ 30% (มืด) ตาม shadcn, เส้น `input`, มุม `md` และ label ที่ไม่หายเมื่อมีค่า
- **Focus:** เส้น `ring` หนา 2px โดยไม่เปลี่ยน layout
- **Error / Disabled:** error ใช้ `destructive` พร้อมข้อความที่บอกรูปแบบที่ถูก (ช่องยอดเงินของตัวกรองและแถวแยกยอด: "ใส่ตัวเลข เช่น 1,500.50" — `AMOUNT_FORMAT_HINT` ใน `format.ts`) (ขอบ error ไม่ถูก ring ทับ); disabled ลด emphasis และใช้ cursor/state ที่ชัดเจน
- **เลือกเดือน (`MonthPicker`):** ช่องแสดงเดือนไทย พ.ศ. ("ตุลาคม 2569") เหมือนข้อความที่ screen reader ได้ยิน ไม่ใช่ภาษา/ปฏิทินของเบราว์เซอร์ — เบราว์เซอร์ที่มี `type="month"` ใช้ช่องจริงแบบโปร่งใส (ชื่อ "เดือน" picker ของเบราว์เซอร์ คลิก/Enter/Space เรียก `showPicker()`) ทับด้วยข้อความเดือนและไอคอนปฏิทิน ส่วน Firefox/Safari เดสก์ท็อปที่ไม่มี picker เดือนใช้ช่อง `type="month"` ของเบราว์เซอร์ตรง ๆ

### Navigation

- ใช้ app bar แบบ sticky ทุกขนาดจอ พื้น `background` เส้นล่าง `border`
- จอ ≥ 1200px (MUI `lg`): แบรนด์ + tab navigation แบบไอคอนพร้อมชื่อเมนู ตามด้วยไอคอนธีมสี/คู่มือ/ประวัติ/ออกจากระบบ
- จอ 900–1199px (MUI `md`): แบรนด์ + tabs แบบไอคอนล้วน ชื่อเมนูอยู่ใน Tooltip (ขึ้นทั้งตอน hover และ focus) และเป็น accessible name ของ tab ตามด้วยไอคอนธีมสี/คู่มือ/ประวัติ/ออกจากระบบ
- tabs เมนูหลักคงเป็น scrollable ไว้กันตัดหายเงียบ ๆ เมื่อเมนูยาวขึ้น (เช่นเปิดหน้าภาษีกลับ) ลูกศรขึ้นเฉพาะตอนล้นจริง
- จอ < 900px: app bar เหลือปุ่ม ☰ แบรนด์ และปุ่มธีมสีชิดขวา ปุ่ม ☰ เปิด Drawer ด้านซ้าย (พื้น `sidebar`, เส้นขอบ `border`, Floating Offset) ที่มีเมนูหลักครบ + ตั้งค่า (แอดมิน) แล้วคั่นด้วย divider ก่อน คู่มือการใช้งาน / ประวัติการเปลี่ยนแปลง / ออกจากระบบ; กดรายการนำทางแล้ว drawer ปิดเอง
- tab ปกติใช้ `muted-foreground`; hover พื้น `accent` ตัวอักษร `accent-foreground`; tab ที่เลือกพื้น `sidebar-accent` ตัวอักษร `sidebar-accent-foreground` พร้อม indicator `primary`; รายการที่เลือกใน drawer ใช้คู่สีเดียวกัน (รวมไอคอน)
- ปุ่มธีมสีทำตาม The Theme Mode Rule (กดวนโหมด ไอคอน = โหมดปัจจุบัน ไม่มี Tooltip)
- เมนูหลักทั้งสองแบบอยู่ใน `<nav aria-label="เมนูหลัก">` ตัวเดียวที่ mount ตลอด (คู่มือในแอปไฮไลต์กล่องนี้)
- scrollable tabs ยังใช้กับเมนูตั้งค่าที่ยาว

### Tables

- ตารางใช้ขนาด compact, header น้ำหนัก 600 สี `muted-foreground`, เส้นแบ่ง `border` และเลื่อนแนวนอนได้บนจอแคบ
- แถวที่ hover ได้ใช้พื้นตาม The Table Hover Rule; แถวที่เลือกพื้น `sidebar-accent` ตัวอักษร `sidebar-accent-foreground` เฉพาะตารางที่ยอดเงินเป็นสีกลาง ตารางที่มียอดสีรายรับ/รายจ่าย (หน้าธุรกรรม) ไม่ใส่ `selected` ให้แถว checkbox บอกสถานะแทน เพราะบน `sidebar-accent` ยอดเหลือ 3.07–3.11 (สว่าง) / 1.11–1.67 (มืด)
- ช่องที่ไม่มีค่า (เช่นช่องเงินเข้าของรายการเงินออก) เว้นว่าง ไม่ใส่ "—" เมื่อหัวคอลัมน์บอกความหมายอยู่แล้ว
- จอแคบ (< md) ตัดคอลัมน์รองออกด้วย `display` ทั้งหัวและแถวพร้อมกัน แทนการตั้ง `minWidth` ที่บังคับเลื่อนแนวนอน คอลัมน์ข้อความหลักตั้ง `width: 100%` + `maxWidth: 0` ให้กินที่ที่เหลือแล้วตัดบรรทัด (line clamp) พร้อม `title` ข้อความเต็ม หน้าธุรกรรมที่ 320/375px เหลือ วันที่ · รายการ · จำนวนเงิน (เข้า/ออกรวมช่องเดียว มี +/−) · ลูกศร และช่องรายการ (ตัดที่ 2 บรรทัดทุกขนาดจอ) มีบรรทัดรองบรรทัดเดียวที่บอกเฉพาะสิ่งที่ต้องจัดการ "<บัญชี> · ยังไม่ตรวจ · ยังไม่จัดหมวด" / "<บัญชี> · อาหาร" (ชื่อบัญชีสีรอง, ตรวจแล้วไม่ขึ้น, ช่องหมวดเหมือนคอลัมน์หมวดรวม "ไม่ต้องจัดหมวด") แทนคอลัมน์บัญชี/สถานะ/หมวดที่ซ่อนไป
- สถานะที่ต้องจัดการ ("ยังไม่ตรวจ", "ยังไม่จัดหมวด") ใช้ตัวอักษรหลักน้ำหนัก 600 สถานะที่เสร็จแล้ว ("ตรวจแล้ว" ในคอลัมน์สถานะ, ชื่อหมวด) ใช้ `muted-foreground` น้ำหนัก 400 ทั้งคอลัมน์และบรรทัดรองบนมือถือ · โอนภายในและรายการที่ไม่นับรวมที่ยังไม่มีหมวดไม่ใช่งานค้าง คอลัมน์หมวดขึ้น "ไม่ต้องจัดหมวด" แบบเสร็จแล้ว ไม่ใช่ "ยังไม่จัดหมวด" (ตัวอักษรหลักบน `card` 5.86 / 11.35, แถว hover 6.79 / 12.13)
- หน้าธุรกรรม ≥ md: บัญชีและหมวดอยู่บรรทัดเดียว — บัญชีตัดด้วย … ที่ 180px, หมวดแสดงหมวดแรก (ตัดที่ 140px) + chip "+n" ชื่อเต็มอยู่ใน `title` และข้อความซ่อนให้ screen reader (ไม่อ่าน "+1")
- หน้าธุรกรรม: คำอธิบายรูปแบบ KBank "<ชื่อรายการ>: <รายละเอียด>" (ชื่อรายการ: รับโอนเงิน, โอนเงิน, หักบัญชี, ชำระเงิน, ชำระด้วยบัตรเดบิต, รายการแก้ไข, ถอนเงินสด) แสดงรายละเอียด (ผู้รับ/ร้าน) ก่อน ตามด้วย " · <ชื่อรายการ>" สี `muted-foreground` และต้นรายละเอียดที่เป็นแบบฟอร์มตามด้วยชื่อ ("โอนไป X1111", "จาก X2222", "เพื่อชำระ Ref X3333", "รหัสอ้างอิง EDC11111" รวม พร้อมเพย์/รหัสธนาคารก่อนเลขบัญชี) เป็นสี `muted-foreground` ในที่เดิม ชื่อผู้รับ/ร้านจึงเด่นก่อน รูปแบบอื่น (รวมรายละเอียดที่มีแต่รหัสอ้างอิง) แสดงตามเดิม เป็นการแสดงผลเท่านั้น: `title`, ข้อความที่ screen reader อ่าน, drawer และการค้นหายังเป็นข้อความเต็ม · ปุ่มลูกศรท้ายแถวชื่อ "ดูรายละเอียด <วันที่> <±ยอด> <ต้นรายละเอียด>" (ตัดที่ 30 ตัวอักษร ต่อท้าย … เมื่อยาวกว่านั้น) ไม่ใช่ข้อความดิบทั้งก้อน checkbox ของแถวใช้ชื่อเดียวกัน "เลือก <วันที่> <±ยอด> <ต้นรายละเอียด>" · ผลการกรองประกาศผ่าน `role="status"` ที่ซ่อนไว้นอกส่วนที่สลับเป็น skeleton ("120 รายการ" หรือหัวข้อของ EmptyState) และหัวข้อ EmptyState ของหน้าเป็น h2 ใต้ h1 ของหน้า (`headingLevel={2}`)
- กล่องเลื่อนของตาราง (`TableContainer`, focus ได้ด้วย `tabIndex={0}`) เป็น `role="region"` ชื่อ "ตารางธุรกรรม" คนละชื่อกับตาราง
- ตารางข้อมูลแน่นจัด action ในแถวตาม The Row Action Rule ด้านล่าง

**The Table Hover Rule.** แถวตารางตอน hover ใช้ `popover` (สว่าง #ffffff) / `muted` (มืด #24272b) ไม่ใช่ `accent` เพราะตัวอักษรในแถวไม่เปลี่ยนสีตาม: บน `accent` สว่าง สีรอง/ยอดเงินเหลือ 4.38–4.45 และมืดเหลือ 1.04–2.54 (รายจ่าย 1.04) บนพื้นใหม่ทุกคู่ผ่าน — สว่าง ตัวอักษร 6.79, สีรอง 5.66, primary 5.60, รายรับ 5.64, รายจ่าย 5.57, ขอบช่องกรอก 3.64; มืด 12.13 / 7.22 / 11.81 / 7.45 / 4.95 / 3.39 ตั้งที่ `MuiTableRow` ใน `theme.ts` ที่เดียว

**The Content Drawer Rule.** drawer ที่เป็นเนื้อหา (รายละเอียดรายการ ฟอร์มแก้ไข) ใช้พื้น `popover` เหมือน dialog ไม่ใช่ `sidebar` ซึ่งเป็นของเมนูนำทางเท่านั้น: บน `sidebar` สว่าง สีรอง/primary/error เหลือ 4.31/4.27/4.23 และขอบช่องกรอก/ring 2.77/2.79 บน `popover` เป็น 5.66/5.60/5.55 และ 3.64/3.66 (มืด 6.75/11.05/4.68 และ 3.17/5.44) หัวข้อส่วนใน drawer เป็น h3 ขั้น Headline Small ใต้ชื่อ drawer (h2) drawer ที่เปิดจากแถวของรายการมีปุ่ม "ก่อนหน้า" / "ถัดไป" และตำแหน่งในรายการทั้งหมด (`aria-live`, "รายการที่ 53 จาก 120" นับข้ามหน้า, แถวที่เพิ่งบันทึกหลุดจากตัวกรอง = "เหลือ 119 รายการ") เลื่อนไปแถวอื่นโดยไม่ต้องปิดและข้ามหน้าได้: "ถัดไป" ที่แถวสุดท้ายของหน้าโหลดหน้านี้ซ้ำก่อน (แถวที่หลุดจากคิวทำให้แถวแรกของหน้าถัดไปเลื่อนขึ้นมาอยู่หน้านี้ ไปหน้าถัดไปตรง ๆ จะข้ามมัน) แล้วเปิดแถวถัดไปในหน้านี้ หรือแถวแรกของหน้าถัดไป "ก่อนหน้า" ที่แถวแรกเปิดแถวสุดท้ายของหน้าก่อน ปลายรายการทั้งหมดปุ่มเป็น `aria-disabled` ไม่ใช่ `disabled` ปิดแล้วหน้าคืน focus เอง (`disableRestoreFocus` + `onExited`) ไปที่ปุ่มของแถวที่เปิดล่าสุด หรือแถวที่เลื่อนขึ้นมาแทนเมื่อแถวนั้นหลุดจากตัวกรอง ไม่ปล่อยให้ตกไปที่ `<body>` · drawer ที่เปิดอยู่อยู่ใน `?txn=`: เปิดจากแถว = push (ปุ่ม Back บนมือถือปิด drawer), ก่อนหน้า/ถัดไป = replace, ปิด = ย้อน entry ที่ push ไว้ (เปิดจากลิงก์ = replace) · ข้ามหน้า = replace ทั้ง `?page=` และ `?txn=` แล้วปิดเป็น replace (อยู่หน้าใหม่ ไม่ย้อนกลับไปหน้าเดิม)

**The Unsaved Edit Rule.** drawer ที่แก้ค่าได้ (ReviewDrawer) เทียบฟอร์มกับค่าที่โหลด/บันทึกล่าสุด (ประเภท หมวด โน้ต ภาษี และแถวแยกยอด) ถ้ามีการแก้ไขค้าง ทุกทางออกที่ยังอยู่ในหน้าธุรกรรม — ก่อนหน้า/ถัดไป, Esc, คลิกฉากหลัง, ปุ่มปิด และ Back ของเบราว์เซอร์ที่แค่ถอด `?txn=` (หน้าคืน `?txn=` แล้วให้ drawer ถาม) — เปิด `ConfirmDialog` "มีการแก้ไขที่ยังไม่บันทึก" บันทึก / ทิ้งการแก้ไข / ยกเลิก (focus เริ่มที่ยกเลิก) "บันทึก" บันทึกร่างแยกยอดก่อนแล้วจึงประเภท/หมวด/โน้ต (ซึ่งทำเครื่องหมายตรวจแล้ว — dialog บอกไว้) แล้วไปต่อตามที่กด บันทึกไม่สำเร็จ dialog ค้างพร้อมข้อความ error ไม่มีการแก้ไข = ไปต่อทันทีเหมือนเดิม ทางออกที่พาออกจากหน้า (เช่น Back ที่ย้อนไปหน้าอื่นเมื่อ drawer เปิดมาจากลิงก์, รีโหลด/ปิดแท็บ) ไม่ถาม — แอปใช้ `BrowserRouter` ซึ่งไม่มีตัวกั้นการนำทาง ข้าง "บันทึกและตรวจแล้ว" มีปุ่ม outlined "บันทึกแล้วไปถัดไป" เมื่อมีแถวถัดไป (รวมหน้าถัดไป) บันทึกแบบเดียวกันแล้วเปิดแถวถัดไป หลังโหลด focus ไปช่องหมวดของแถวใหม่ (แถวที่แยกหลายหมวดไม่มีช่องนั้น = ปุ่มเดิม, ไม่มีแถวถัดไปแล้ว = ปุ่มบันทึก) คีย์ลัด Ctrl/⌘+Enter ที่ไหนก็ได้ในแผงยกเว้นในเมนูที่เปิดอยู่ (`aria-keyshortcuts` บนปุ่ม และคำใบ้ "Ctrl + Enter" / "⌘ + Enter" สีรองข้างปุ่มตั้งแต่ sm — จอ xs ส่วนใหญ่ไม่มีคีย์บอร์ด) ช่องหมวดว่างขึ้น helper "ยังไม่ได้เลือกหมวด — รายการนี้จะยังอยู่ในคิว ยังไม่จัดหมวด" แทนคำอธิบายปกติ โดยไม่บล็อกการบันทึก (ประเภทที่เลือกเป็นโอนภายใน/ไม่นับรวม = "ไม่ต้องเลือกหมวด — โอนภายใน / รายการที่ไม่นับรวมไม่อยู่ในคิว ยังไม่จัดหมวด") คำตอบของการบันทึกที่มาถึงหลังเลื่อน/ปิดไปแถวอื่นแล้วไม่เขียนทับฟอร์มของแถวใหม่ (หน้ายังโหลดรายการซ้ำ ครั้งเดียวต่อการบันทึก) ยืนยัน/ปฏิเสธคู่โอนและบันทึกรายได้เต็มโหลดรายการซ้ำโดยคงช่องที่แก้ค้างไว้ (ช่องที่ไม่ได้แตะรับค่าใหม่จาก server) สำเร็จแล้วปุ่มคู่โอนหายไป focus จึงไปปุ่ม "บันทึกและตรวจแล้ว" ผลของการกดใน drawer ประกาศผ่าน live region `role="status"` ที่ซ่อนไว้ใน drawer (อยู่นอกส่วนที่ถูกแทนด้วย skeleton) เพราะ snackbar อยู่ใน `#root` ซึ่งเป็น `aria-hidden` ระหว่างที่ drawer เปิด snackbar ยังขึ้นให้คนที่มองเห็น — ประกาศครั้งเดียว ผลที่เกิดตอน dialog เปิดอยู่ประกาศหลัง dialog (หรือ drawer เมื่อปิด) ปิดสนิท ส่วนแยกยอด: ปุ่ม "แบ่งยอดเพิ่ม", แถว "หมวดที่ n" ปุ่มลบ "ลบหมวดที่ n" (ลบแล้ว focus ไปปุ่มลบของแถวที่เลื่อนขึ้นมา หรือ "แบ่งยอดเพิ่ม"), ไม่มีทั้งร่างและที่บันทึกไว้ไม่มีปุ่มบันทึก, ลบร่างหมดแต่มีที่บันทึกไว้ปุ่มเป็น "ล้างหมวดทั้งหมด" (`color="error"`) บรรทัดข้อมูลรายการ "วันที่ เวลา · บัญชี (ธนาคาร) · ช่องทาง" (ไม่ต่อ "(ธนาคาร)" เมื่อชื่อบัญชีมีชื่อธนาคารอยู่แล้ว, เวลา/ช่องทางที่ไม่มีไม่แสดง) ใต้ข้อมูลรายการมีสถานะตรวจ (ไอคอน + ข้อความ แบบเดียวกับคอลัมน์สถานะ)

**The Row Action Rule.** ในตารางข้อมูลแน่น action หลักของแถวคงเป็นปุ่มข้อความ ส่วน action รอง (แก้ไข / ข้าม / เอากลับเข้าแผน / ลบ / เลิกใช้) เป็น icon button ที่มี Tooltip และ `aria-label` บอกชื่อ action เพื่อให้ตารางพอดีกรอบโดยไม่ต้องเลื่อนแนวนอนบนเดสก์ท็อป

## Do's and Don'ts

### Do:

- **Do** ใช้ค่าของ Bubblegum ตรงตัว (รวมค่า AA ที่อนุมัติแล้ว) และบันทึกคู่สีใหม่ที่ไม่ผ่าน AA ไว้ในตาราง Contrast แทนการปรับเอง
- **Do** ใช้ `primary` เฉพาะ primary action, ลิงก์ และ indicator; `accent` เฉพาะ hover; `sidebar-accent` เฉพาะ selection
- **Do** ตรวจทั้งสองโหมดเมื่อเพิ่มสีหรือพื้นผิวใหม่ และอ่านสีผ่าน theme เสมอ
- **Do** ใช้ layout ที่อ่านง่ายและลำดับชั้นชัดเจนแบบแอปการเงินที่คุ้นเคย
- **Do** รักษาพื้นที่กดอย่างน้อย 40px และรองรับ viewport ตั้งแต่ 320px
- **Do** ใช้ข้อความหรือไอคอนควบคู่กับสีสถานะเสมอ
- **Do** ใช้ state transition ประมาณ 200ms และปิด motion ที่ไม่จำเป็นเมื่อผู้ใช้ตั้งค่า reduced motion (`theme.motion.reducedMotion: 'system'` ทำให้ transition ที่เคลื่อนที่ของ MUI เป็น 0, `styles.css` ตัด animation/การเลื่อนนุ่ม แต่คง transition สี/พื้นของ hover/focus ไว้)
- **Do** ตั้งชื่อแท็บตามหน้า "<ชื่อหน้า> · Hyacinthia Ledger" (`PageHeader` level 1 ตั้งให้เอง หน้าก่อนเข้าระบบตั้งใน `App.tsx`)

### Don't:

- **Don't** ใช้สีเขียวประจำแบรนด์หรืออัตลักษณ์ของ KBank เป็นสีหลักหรือสีอ้างอิง; สีเขียวใช้ได้เฉพาะ `income` และสถานะสำเร็จ
- **Don't** ลอกหน้าตาของ KBank โดยตรง การอ้างอิงจำกัดอยู่ที่แนวทาง layout เท่านั้น
- **Don't** ใช้ `destructive` แสดงจำนวนเงินรายจ่าย หรือใช้ `expense` กับ error/ปุ่มลบ
- **Don't** ซ้อน card ภายใน card หรือใส่เงาให้กล่องย่อย แถว หรือปุ่ม
- **Don't** ใช้เงานุ่มแบบ soft blur หรือสีเงาที่ไม่ได้มาจากธีม
- **Don't** เพิ่มฟอนต์ที่สี่ หรือใช้ Lora/Fira Code นอกบทบาทที่กำหนด
- **Don't** เปลี่ยนรูปแบบปุ่ม, input, dialog หรือ icon ระหว่างหน้าจอโดยไม่มีเหตุผลเชิงงาน
