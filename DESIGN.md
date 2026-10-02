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
- **Rose Ring (AA)** / **Teal Ring** (`ring`): focus ring 2px ทุก control และเส้นขอบของช่องกรอกตอน focus

### Secondary

- **Mint Lagoon** / **Dusty Rose** (`secondary`): สีรองของธีม (`palette.secondary`) ยังไม่ได้ใช้เป็นสีหลักของหน้าใด
- **Forest Balance** / **Mint Balance** (`income`): รายรับ สถานะสำเร็จ (`palette.success`) และระบบที่ทำงานปกติ
- **Brick Expense** / **Ember Expense** (`expense`, `palette.brand.expense`): จำนวนเงินรายจ่ายเท่านั้น แยกจาก `destructive`
- **Coral Alert (AA)** / **Hot Pink Alert (AA)** (`destructive`, `palette.error`): ข้อผิดพลาด การปฏิเสธ ปุ่มลบ/destructive action และ alert
- **Amber Caution** / **Amber Glow** (`warning`, สว่าง #9a4d00 / มืด #ffa726 ตั้งไว้ชัดใน `theme.ts`): confirm ที่ต้องระวัง, alert เตือน และตัวนับปัญหาที่มากกว่า 0 (The Issue Count Rule) เป็นตัวอักษรได้ทั้งสองโหมด (สว่าง 5.08/5.27 บน background/card, มืด 8.18/7.20)

### Neutral

- **Blush Mist** / **Deep Harbor** (`background`): พื้นหลักของทุกหน้าจอและ app bar
- **Butter Card** / **Harbor Card** (`card`, `palette.background.paper`): การ์ด ตาราง และ auth panel
- **Paper White** / **Harbor Card** (`popover`): menu, popover, tooltip และ dialog
- **Graphite** / **Petal Mist** (`foreground`): ข้อความหลัก
- **Soft Graphite (AA)** / **Dusty Rose** (`muted-foreground`): metadata, helper text, ข้อความรอง และ `info`
- **Sky Wash** / **Charcoal Wash** (`muted`): skeleton
- **Lemon Cream** / **Mauve** (`accent`, ตัวอักษรบนพื้นนี้ `accent-foreground` สว่าง #333333 / มืด #12242e (AA)): พื้นตอน hover ของ tab, รายการใน drawer/เมนู, แถวตาราง และ toggle button (`action.hover`)
- **Candy Pink** (`sidebar-accent`, ทั้งสองโหมด): พื้นของสิ่งที่ถูกเลือก (tab, รายการใน drawer/เมนู, แถวตาราง, toggle button, text selection) ตัวอักษรใช้ `sidebar-accent-foreground`
- **Petal Sidebar** / **Night Sidebar** (`sidebar`): พื้นของ drawer เมนูบนมือถือ
- **Bubblegum Pink** / **Harbor Line** (`border`, `palette.divider`): ขอบการ์ด เส้นตาราง เส้นแบ่ง และขอบ dialog/popover
- **Fog (AA)** / **Harbor Input (AA)** (`input`): ขอบช่องกรอก (มืด: พื้นช่องกรอกยังเป็น #20333d ที่ 30% ตามธีม)

### Category Palette

กราฟที่มีหลายอนุกรม (สัดส่วนค่าใช้จ่ายต่อหมวด ยอดคงเหลือต่อบัญชี) ใช้ `chart-1..5` ของธีมตรงตัว (`tokens.<mode>.categoryPalette`) อนุกรมที่เกิน 5 วนสีซ้ำ ทุกอนุกรมต้องมี label กราฟรายรับเทียบรายจ่ายใช้ `income` / `expense`

### Contrast

#### ปรับแล้วตามที่ผู้ใช้อนุมัติ 2026-10-02

ปรับเฉพาะสีที่เป็นตัวอักษร เส้นขอบช่องกรอก และ focus ring ส่วนพื้น การ์ด เงา เส้นขอบตกแต่ง (`border`) และสีกราฟยังตรงกับ Bubblegum ratio คิดบน `background` / `card` / `popover` (รายการเดียวกับ comment ใน `web/src/theme.ts`)

| โหมด | token (บทบาท) | เดิม → ใหม่ | ratio เดิม → ใหม่ | เกณฑ์ |
|---|---|---|---|---|
| สว่าง | `primary` เป็นตัวอักษร (ลิงก์ ปุ่ม text/outlined) | #d04f99 → #b43481 | 3.32/3.45/3.99 → 4.67/4.85/5.61 | 4.5 |
| สว่าง | ตัวอักษรขาวบน `primary` (ปุ่มหลัก) | #d04f99 → #b43481 | 3.99 → 5.61 | 4.5 |
| สว่าง | `muted-foreground` | #7a7a7a → #676767 | 3.57/3.70/4.29 → 4.70/4.88/5.65 | 4.5 |
| สว่าง | `destructive` เป็นตัวอักษร | #f96f70 → #bd373f | 2.32/2.41/2.79 → 4.62/4.80/5.56 | 4.5 |
| สว่าง | ตัวอักษรขาวบน `destructive` (ปุ่มลบ) | #f96f70 → #bd373f | 2.79 → 5.56 | 4.5 |
| สว่าง | `ring` (focus ring) | #e670ab → #d15d98 | 2.40/2.49/2.88 → 3.05/3.16/3.66 | 3.0 |
| สว่าง | `input` ขอบช่องกรอก | #e4e4e4 → #868686 | 1.06/1.10/1.27 → 3.03/3.15/3.65 | 3.0 |
| มืด | `accent-foreground` บน `accent` #c67b96 (ตอน hover) | #f3e3ea → #12242e | 2.54 → 5.06 | 4.5 |
| มืด | `destructive` เป็นตัวอักษร | #e35ea4 → #e66aaa | 4.85/4.27/4.27 → 5.30/4.67/4.67 | 4.5 |
| มืด | `destructive-foreground` #12242e บน `destructive` (ปุ่มลบ) | #e35ea4 → #e66aaa | 4.85 → 5.30 | 4.5 |
| มืด | `input` ขอบช่องกรอก (พื้นยังเป็น #20333d/30) | #20333d → #5d7c90 | 1.21/1.07 → 3.61/3.17 | 3.0 |

#### ยังไม่ผ่าน (ผู้ใช้ให้คงสีกราฟตามธีม)

| โหมด | คู่สี | ratio | เกณฑ์ | หมายเหตุ |
|---|---|---|---|---|
| สว่าง | `chart-1..5` บน `card` | 1.10–2.49 | 3.0 | chart-3 #fbe2a7 (1.10) แทบมองไม่เห็น |
| มืด | `chart-5` #24272b / `chart-4` #175c6c บน `card` | 1.07 / 1.86 | 3.0 | chart-5 มองไม่เห็น |

ทุกอนุกรมในกราฟจึงต้องมี label และกราฟทุกใบมีตารางข้อมูลซ่อนไว้ให้ screen reader อ่าน (ChartCard `table`)

### Named Rules

**The Bubblegum Source Rule.** token ทุกตัวมาจาก tweakcn Bubblegum ตรงตัว ยกเว้น (1) `income`, `expense`, `warning` ที่ธีมไม่มีและต้องผ่าน AA เสมอ และ (2) สีตัวอักษร/ขอบช่องกรอก/focus ring ที่ผู้ใช้อนุมัติให้ใช้ค่า AA เมื่อ 2026-10-02 (ตารางด้านบน) พื้น การ์ด เงา เส้นขอบตกแต่ง และสีกราฟห้ามปรับเอง คู่สีใหม่ที่ไม่ผ่าน AA ให้บันทึกในตาราง "ยังไม่ผ่าน" แล้วรอผู้ใช้ตัดสินใจ

**The Hyacine Identity Rule.** ใช้ layout ของ KBank เป็นข้อมูลอ้างอิงได้ แต่ห้ามนำสีเขียวประจำแบรนด์หรืออัตลักษณ์ของ KBank มาใช้เป็นสีหลัก สีเขียวสงวนไว้สำหรับ `income` และสถานะสำเร็จเท่านั้น

**The Money Color Rule.** จำนวนเงินรายจ่ายใช้ `expense` (แดงอิฐ / ส้มถ่าน) ไม่ใช้ `destructive` ซึ่งเป็นชมพูของธีมและหมายถึง error/การลบ ส่วนรายรับใช้ `income` (`success.main`) ยอด 0 เป็นสีกลางเสมอแม้ส่ง tone มา (`Money` จัดการให้) เพราะศูนย์ไม่ใช่ทั้งรายรับและรายจ่าย

**The Semantic Color Rule.** สีสถานะต้องมาพร้อมข้อความหรือไอคอนเสมอ ห้ามสื่อความหมายด้วยสีเพียงอย่างเดียว

**The Restrained Accent Rule.** `primary` มีไว้สำหรับ primary action, ลิงก์ และ indicator ของ tab ที่เลือก ไม่ใช่สีตกแต่งทั่วไป `accent` เป็นพื้น hover เท่านั้น (ยกเว้นการ์ดสรุปที่ hover ด้วยการยกการ์ดตาม The Linked Card Rule) และ `sidebar-accent` เป็นพื้นของสิ่งที่ถูกเลือกเท่านั้น ห้ามสลับบทบาทกัน

**The Theme Mode Rule.** มีสามโหมด: สว่าง, มืด และตามเครื่อง (ค่าเริ่มต้น ตาม `prefers-color-scheme`) ค่าที่เลือกจำไว้ต่อเครื่อง/เบราว์เซอร์ ไม่ผูกกับบัญชีผู้ใช้ ปุ่มสลับเป็น icon button ปุ่มเดียว กดครั้งเดียวเปลี่ยนทันที วนตามลำดับ ตามเครื่อง → สว่าง → มืด → ตามเครื่อง ไอคอนแสดงโหมดปัจจุบัน ไม่มีเมนูและไม่มี Tooltip ชื่อสำหรับ screen reader (`aria-label`) บอกทั้งโหมดปัจจุบันและผลของการกด (เช่น "ธีมสี: ตามเครื่อง — กดเพื่อเปลี่ยนเป็นสว่าง") และคู่มือเกาะ `data-tour="theme-toggle"` เพราะ aria-label เปลี่ยนตามโหมด ตำแหน่ง: บน app bar ทุกขนาดจอและนอก `<nav aria-label="เมนูหลัก">` (≥ 900px อยู่ก่อนไอคอนคู่มือ, < 900px อยู่ขวาของแบรนด์ กดได้โดยไม่ต้องเปิด drawer) ไม่อยู่ใน drawer และหน้าล็อกอิน/รออนุมัติอยู่มุมขวาบนของจอ โค้ดอ่านสีผ่าน `theme.vars.palette.*` หรือ palette path ใน `sx` เสมอ ห้ามฮาร์ดโค้ด hex ของโหมดใดโหมดหนึ่ง

## Typography

**Sans (ทุกอย่าง):** Poppins 400/500/600/700 ตามด้วย Noto Sans Thai 400/500/600/700, system-ui — โหลดจาก Google Fonts ทั้งคู่ Poppins ไม่มีอักษรไทย อักษรไทยจึงมาจาก Noto Sans Thai ส่วนตัวเลขและละติน (รวมตัวเลขจำนวนเงิน) ยังเป็น Poppins
**Mono:** Fira Code 400/500 สำหรับ `code` และ JSON ในบันทึกการเปลี่ยนแปลง
**Serif:** Lora เป็น token ใน `theme.ts` เท่านั้น ไม่ได้โหลดและยังไม่มีที่ใช้ (shadcn ไม่ได้ใช้ serif เป็นค่าเริ่มต้น) — ถ้าจะใช้ต้องเพิ่มใน `web/index.html` ก่อน

**Character:** Poppins ทรงกลมเรขาคณิตเข้ากับความขี้เล่นของ Bubblegum letter-spacing 0 ทุกระดับ (`tracking-normal` ของธีม)

### Hierarchy

- **Headline Large** (Poppins 600, 1.75rem, 1.3): ชื่อหน้าหลัก ใช้หนึ่งครั้งต่อ surface
- **Headline Medium** (Poppins 600, 1.25rem, 1.4): หัวข้อส่วน, dialog และกลุ่มข้อมูล
- **Headline Small** (Poppins 600, 1rem, 1.5): หัวข้อย่อยในการ์ดใต้หัวข้อส่วน (h3) เช่นชื่อกราฟใน ChartCard
- **Data Display** (Poppins 400, line-height 1.3): ตัวเลขหลักของการ์ดสรุป ขนาดตามความกว้างการ์ด — การ์ดปกติ 1.25rem (xs) / 1.5rem (sm) / 1.75rem (lg), การ์ด dense (แถว 5 ใบขึ้นไป) 1.25rem (xs) / 1.125rem (md ที่การ์ดแคบสุด) / 1.25rem (lg) เป็นขั้นของ data display โดยตั้งใจ ไม่ snap เข้าขั้นอื่น
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

**The Floating Selection Bar Rule.** แถบ action ที่ลอยเหนือเนื้อหาเมื่อมีรายการ/แถวถูกเลือก ใช้ Floating Offset (MUI elevation 8) และยึดติดขอบล่างจอ (fixed bottom) แถบต้องไม่บังการทำงานของ version badge มุมล่างขวา (ผู้ใช้ยังต้องอ่านเลขเวอร์ชันได้) และต้องไม่ทับ snackbar ระหว่างที่แถบแสดงอยู่ snackbar ย้ายไปขึ้นด้านบนจอแทน

## Components

Component vocabulary คือ **คุ้นเคย มั่นใจ และเป็นมิตร** ใช้ MUI เป็นฐาน รัศมีมุมตามสเกล shadcn (r = 0.4rem = 6.4px: sm 2.4px, md 4.4px, lg 6.4px, xl 10.4px)

### Buttons

- **Shape:** มุม `md` และพื้นที่กดสูงอย่างน้อย 40px
- **Primary:** contained พื้น `primary` ตัวอักษร `primary-foreground` สำหรับ action สำคัญที่สุดในบริบทนั้น hover เข้มขึ้นตาม `primary.dark` ของ MUI
- **Focus / Disabled:** focus ใช้เส้น `ring` 2px; disabled ลด emphasis แต่ label ต้องยังอ่านได้
- **Secondary / Ghost:** outlined สำหรับ action รอง, text/ghost สำหรับ cancel และ action ที่ไม่ควรแย่งความสนใจ
- **Destructive:** ใช้ `destructive` (`color="error"`) พร้อมคำกริยาที่ชัดเจนและ confirmation เมื่อผลย้อนกลับยาก

### Chips

- **Style:** มุม `md` ตาม Badge ของ shadcn (`rounded-md`) ใช้แสดงสถานะสั้น ๆ ไม่ใช้เป็นปุ่มทั่วไป
- **State:** success ใช้ `income`; self/selected ใช้ `primary` (filled); ทุก chip ต้องมี label ที่อธิบายความหมาย
- **Toggle filter:** chip กดได้เฉพาะเมื่อเป็นตัวกรองแบบเปิด/ปิด ตาม The Toggle Chip Rule ด้านล่าง

**The Toggle Chip Rule.** chip ทำหน้าที่เป็นตัวกรองแบบเปิด/ปิดได้เมื่อมี `aria-pressed` บอกสถานะเสมอ ตอนเลือกใช้ `primary` (`color="primary"`, `variant="filled"`) ตอนไม่เลือกเป็น outlined สีปกติ และ label ต้องบอกว่ากรองอะไร (ตัวอย่าง: chip "ยังไม่ตรวจสอบ" ในหน้าธุรกรรม) ห้ามใช้ chip แทนปุ่ม action ทั่วไป

### Cards / Containers

- **Corner Style:** มุม `xl` (10.4px)
- **Background:** `card` บน `background`
- **Border / Shadow:** 1px solid `border` + Card Offset ตาม The Hard Offset Rule
- **Internal Padding:** 24px เป็นค่าหลัก, 32px สำหรับ auth panel บนจอกว้าง

**The Linked Card Rule.** การ์ดสรุปที่พาไปหน้าอื่นเป็นลิงก์จริง (`SummaryCard to="/path"` → `<a href>` กดกลาง/เปิดแท็บใหม่ได้; `to="#id"` เลื่อนไปส่วนในหน้าเดียวกัน) มีลูกศร › ท้ายแถวหัวการ์ดเสมอ การ์ดที่ไม่มีลูกศรคือกดไม่ได้ hover ไม่เปลี่ยนพื้น (พื้น `accent` ของธีมมืดทำตัวเลขเหลือ ~1:1) แต่ยกการ์ด: เลื่อน −2px แล้วยืด hard offset เป็น 5px สี `divider` (= สีเงาของ Bubblegum ทั้งสองโหมด) ตัวอักษรจึงคง contrast ตอนปกติ focus ใช้ `ring` 2px offset 2px ส่วน `onClick` ใช้กับ action ที่ไม่ใช่การนำทางเท่านั้น

**The Issue Count Rule.** ตัวนับปัญหา (ยังไม่จัดหมวด, statement ล้มเหลว, บัญชีขาดช่วง, บิลเกินกำหนด) ค่า 0 เป็นสีรองเงียบ ๆ ค่ามากกว่า 0 ใช้ `warning` พร้อมไอคอนเตือน ไม่ใช้ `destructive` กับตัวนับ (แดง/ชมพูหมายถึง error ไม่ใช่ "ต้องจัดการ") แดชบอร์ดรวมเรื่องที่มากกว่า 0 ไว้ในแถบ "ต้องจัดการ" ใต้บรรทัดสถานะข้อมูล: ปุ่ม outlined `warning` + ลูกศร › ต่อเรื่องหนึ่งปุ่ม เป็นลิงก์ไปที่แก้ได้ ซ่อนทั้งแถบเมื่อไม่มีเรื่อง การ์ด 5 ใบของคุณภาพข้อมูลยังแสดงครบเหมือนเดิม

**The Section Failure Rule.** แต่ละส่วนที่มาจาก request ของตัวเองแสดงสถานะของตัวเอง: กำลังโหลด = คงหัวการ์ด/กราฟไว้แล้วแทนตัวเลขด้วย skeleton (เปลี่ยนเดือนแล้ว layout ไม่กระโดด ไม่ใช้ skeleton ทั้งหน้า), โหลดไม่สำเร็จ = `LoadError` พร้อมปุ่ม "ลองใหม่" แทนที่ส่วนนั้น ห้ามแสดงเป็น 0, "ยังไม่มีข้อมูล" หรือกราฟว่าง และส่วนอื่นที่โหลดได้ยังแสดงตามปกติ

### Charts

- กราฟทุกใบอยู่ใน `ChartCard`: หัวข้อ h3 ขั้น Headline Small ใต้หัวส่วน, บรรทัดช่วงเวลา (เช่น "6 เดือนล่าสุด" หรือเดือนที่เลือก) เพราะกราฟในส่วนเดียวกันใช้ช่วงไม่เท่ากัน
- SVG ของ x-charts เป็น `aria-hidden` จึงห่อด้วย `role="figure"` (ชื่อ = หัวการ์ด, คำอธิบาย = ช่วงเวลา) และใส่ตารางข้อมูลชุดเดียวกันแบบซ่อน (`table` prop) ให้ screen reader อ่าน
- เปิด `experimentalFeatures={{ keyboardActivation: true }}` ให้ Enter/Space บนจุดที่ focus ด้วยคีย์บอร์ดเจาะดูรายการได้เหมือนคลิก
- แกนเงินใช้ `Intl.NumberFormat('th-TH', { notation: 'compact' })` แกนเดือน "ส.ค. 69" แกนวัน "31 ส.ค." (tooltip ใช้รูปเต็ม) และแกน x สูง 32px (ค่าเริ่มต้น 25px ตัดป้ายภาษาไทยทิ้ง)
- ว่างเพราะ statement ยังไม่มา ใช้ข้อความเดียวกับบรรทัดสถานะ ("statement ต.ค. 2569 ยังไม่มา") ในกล่องที่เตี้ยกว่ากราฟ

### Popovers / Menus / Tooltips / Dialogs

- พื้น `popover`, ขอบ 1px `border`
- menu/popover/tooltip มุม `md`, dialog มุม `lg`
- menu/popover ใช้ Floating Offset, dialog ใช้ Dialog Offset และ MUI focus management

### Inputs / Fields

- **Style:** พื้นโปร่งใส (สว่าง) / `input` ที่ 30% (มืด) ตาม shadcn, เส้น `input`, มุม `md` และ label ที่ไม่หายเมื่อมีค่า
- **Focus:** เส้น `ring` หนา 2px โดยไม่เปลี่ยน layout
- **Error / Disabled:** error ใช้ `destructive` พร้อมข้อความ (ขอบ error ไม่ถูก ring ทับ); disabled ลด emphasis และใช้ cursor/state ที่ชัดเจน

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
- แถวที่ hover ได้ใช้พื้น `accent`; แถวที่เลือกพื้น `sidebar-accent` ตัวอักษร `sidebar-accent-foreground`
- ตารางข้อมูลแน่นจัด action ในแถวตาม The Row Action Rule ด้านล่าง

**The Row Action Rule.** ในตารางข้อมูลแน่น action หลักของแถวคงเป็นปุ่มข้อความ ส่วน action รอง (แก้ไข / ข้าม / เอากลับเข้าแผน / ลบ / เลิกใช้) เป็น icon button ที่มี Tooltip และ `aria-label` บอกชื่อ action เพื่อให้ตารางพอดีกรอบโดยไม่ต้องเลื่อนแนวนอนบนเดสก์ท็อป

## Do's and Don'ts

### Do:

- **Do** ใช้ค่าของ Bubblegum ตรงตัว (รวมค่า AA ที่อนุมัติแล้ว) และบันทึกคู่สีใหม่ที่ไม่ผ่าน AA ไว้ในตาราง Contrast แทนการปรับเอง
- **Do** ใช้ `primary` เฉพาะ primary action, ลิงก์ และ indicator; `accent` เฉพาะ hover; `sidebar-accent` เฉพาะ selection
- **Do** ตรวจทั้งสองโหมดเมื่อเพิ่มสีหรือพื้นผิวใหม่ และอ่านสีผ่าน theme เสมอ
- **Do** ใช้ layout ที่อ่านง่ายและลำดับชั้นชัดเจนแบบแอปการเงินที่คุ้นเคย
- **Do** รักษาพื้นที่กดอย่างน้อย 40px และรองรับ viewport ตั้งแต่ 320px
- **Do** ใช้ข้อความหรือไอคอนควบคู่กับสีสถานะเสมอ
- **Do** ใช้ state transition ประมาณ 200ms และปิด motion ที่ไม่จำเป็นเมื่อผู้ใช้ตั้งค่า reduced motion

### Don't:

- **Don't** ใช้สีเขียวประจำแบรนด์หรืออัตลักษณ์ของ KBank เป็นสีหลักหรือสีอ้างอิง; สีเขียวใช้ได้เฉพาะ `income` และสถานะสำเร็จ
- **Don't** ลอกหน้าตาของ KBank โดยตรง การอ้างอิงจำกัดอยู่ที่แนวทาง layout เท่านั้น
- **Don't** ใช้ `destructive` แสดงจำนวนเงินรายจ่าย หรือใช้ `expense` กับ error/ปุ่มลบ
- **Don't** ซ้อน card ภายใน card หรือใส่เงาให้กล่องย่อย แถว หรือปุ่ม
- **Don't** ใช้เงานุ่มแบบ soft blur หรือสีเงาที่ไม่ได้มาจากธีม
- **Don't** เพิ่มฟอนต์ที่สี่ หรือใช้ Lora/Fira Code นอกบทบาทที่กำหนด
- **Don't** เปลี่ยนรูปแบบปุ่ม, input, dialog หรือ icon ระหว่างหน้าจอโดยไม่มีเหตุผลเชิงงาน
