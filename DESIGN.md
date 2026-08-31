---
version: alpha
name: Hyacinthia Ledger
description: สมุดบัญชีครบวงจรที่สงบ น่าเชื่อถือ และเป็นมิตรสำหรับทุกคนในครอบครัว
colors:
  background: "#0e101f"
  surface: "#1a1e30"
  border: "#32364d"
  text: "#e9ebf2"
  muted: "#9498a5"
  accent: "#70adfb"
  income: "#52cd86"
  expense: "#f3625d"
typography:
  headline-large:
    fontFamily: "SOV BokThang, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1.3
  headline-medium:
    fontFamily: "SOV BokThang, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.4
  description:
    fontFamily: "SOV BokThang, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0.01em"
  body:
    fontFamily: "system-ui, Noto Sans Thai, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, Noto Sans Thai, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 650
    lineHeight: 1.75
rounded:
  md: "10px"
  pill: "999px"
spacing:
  half: "4px"
  base: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.background}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
    height: "40px"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "16px 14px"
    height: "56px"
  surface-outlined:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "24px"
  chip-success:
    backgroundColor: "{colors.income}"
    textColor: "{colors.background}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  nav-tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    padding: "12px 16px"
    height: "48px"
---

# Design System: Hyacinthia Ledger

## Overview

**Creative North Star: "Hyacinthia Ledger - สมุดบัญชีครบวงจร"**

Hyacinthia Ledger คือสมุดบัญชีครอบครัวยุคดิจิทัลที่ทำให้ข้อมูลการเงินซับซ้อนดูสงบ ชัดเจน และตรวจสอบได้ ภาษาภาพใช้ dark Hyacine palette ร่วมกับโครงสร้างผลิตภัณฑ์ที่คุ้นเคย เพื่อให้ผู้ใช้มุ่งกับงานแทนที่จะต้องเรียนรู้หน้าจอ

การจัดวางอ้างอิงความชัดเจนของแอป KBank เฉพาะระดับ layout และลำดับชั้นข้อมูล อัตลักษณ์สีและบุคลิกยังเป็นของ Hyacinthia Ledger อย่างชัดเจน ส่วนประกอบต้องรู้สึกคุ้นเคย มั่นใจ และเป็นมิตร โดยไม่ลดทอนความแม่นยำที่ผลิตภัณฑ์การเงินต้องมี

**Key Characteristics:**

- Dark-first และมี contrast สูง
- โครงสร้าง task-first ที่ใช้งานได้ทั้งเดสก์ท็อปและมือถือ
- พื้นผิวสงบ ใช้สีหลักเฉพาะ action และสถานะสำคัญ
- ความหนาแน่นระดับสบาย อ่านข้อมูลการเงินและตารางได้รวดเร็ว
- การเคลื่อนไหวสั้นและมีหน้าที่ พร้อม reduced-motion fallback

## Colors

พาเลตใช้ indigo ที่ลึกและสงบเป็นฐาน แล้วใช้ Hyacinthia Sky เป็นจุดนำสายตา พร้อมสีสถานะที่แยกความหมายชัดเจน

### Primary

- **Hyacinthia Sky** (`accent`): ใช้กับ primary action, focus, tab ที่เลือก และไอคอนนำทางสำคัญเท่านั้น

### Secondary

- **Mint Balance** (`income`): ใช้กับรายรับ สถานะสำเร็จ และระบบที่ทำงานปกติ
- **Coral Alert** (`expense`): ใช้กับรายจ่าย ข้อผิดพลาด การปฏิเสธ และ destructive action

### Neutral

- **Hyacinthia Midnight** (`background`): พื้นหลังหลักของทุกหน้าจอ
- **Quiet Indigo** (`surface`): พื้นผิวของ dialog, ตาราง, auth panel และ container ที่ต้องแยกจากฉากหลัง
- **Indigo Boundary** (`border`): เส้นแบ่ง ตาราง และ outlined controls
- **Lavender Ink** (`text`): ข้อความหลักที่ต้องอ่านชัด
- **Muted Lavender** (`muted`): metadata, helper text และข้อความรอง โดยต้องคง contrast ระดับ WCAG AA

### Named Rules

**The Hyacine Identity Rule.** ใช้ layout ของ KBank เป็นข้อมูลอ้างอิงได้ แต่ห้ามนำสีเขียวประจำแบรนด์หรืออัตลักษณ์ของ KBank มาใช้เป็นสีหลัก สีเขียวสงวนไว้สำหรับ `income` และสถานะสำเร็จเท่านั้น

**The Semantic Color Rule.** สีสถานะต้องมาพร้อมข้อความหรือไอคอนเสมอ ห้ามสื่อความหมายด้วยสีเพียงอย่างเดียว

**The Restrained Accent Rule.** Hyacinthia Sky มีไว้สำหรับ action, focus และ selection ไม่ใช่สีตกแต่งทั่วไป

## Typography

**Display Font:** SOV BokThang จาก `docs/font/SOV_BokThang.zip` พร้อม Noto Sans Thai และ system-ui fallback
**Description Font:** SOV BokThang สำหรับชื่อหน้า หัวข้อ แบรนด์ และข้อความอธิบายที่ไม่ใช่ข้อมูล
**Data/UI Font:** system-ui พร้อม Noto Sans Thai fallback สำหรับตัวเลข จำนวนเงิน ตาราง input ปุ่ม tab label อีเมล เลขบัญชี และข้อมูลเทคนิค; monospace ใช้เฉพาะ identifier ที่ควรแยกรูปทรงอักขระ

**Character:** SOV BokThang เติมบุคลิกไทยให้คำอธิบาย ขณะที่ฟอนต์ระบบรักษาความแม่นยำและความคุ้นเคยของข้อมูลการเงินและ controls

### Hierarchy

- **Headline Large** (SOV BokThang 400, 1.75rem, 1.3): ชื่อหน้าหลัก ใช้หนึ่งครั้งต่อ surface
- **Headline Medium** (SOV BokThang 400, 1.25rem, 1.4): หัวข้อส่วน, dialog และกลุ่มข้อมูล
- **Description** (SOV BokThang 400, 1rem, 1.6): ข้อความอธิบายและ empty-state copy จำกัดความยาวประมาณ 65–75 ตัวอักษรต่อบรรทัด
- **Body/Data** (system-ui 400, 1rem, 1.5): ข้อมูล ตาราง ค่าในช่องกรอก และเนื้อหาที่ต้องอ่านตัวเลขแม่นยำ
- **Label** (650, 0.875rem, 1.75): ปุ่ม, tab, table header และข้อความควบคุม ใช้ตัวพิมพ์ตามภาษาปกติ ไม่ใช้ uppercase แบบเว้นระยะกว้าง

### Named Rules

**The Two-Lane Type Rule.** ใช้ SOV BokThang เฉพาะชื่อหน้า หัวข้อ แบรนด์ และข้อความอธิบาย ส่วนข้อมูลและ controls ใช้ system-ui; ห้ามสลับบทบาทระหว่างสองชุดโดยไม่มีเหตุผลเชิงความหมาย

**The Financial Clarity Rule.** ตัวเลข จำนวนเงิน เลขบัญชี อีเมล และข้อมูลเทคนิคใช้ system-ui หรือ monospace พร้อม `tabular-nums` เมื่อมีตัวเลขที่ต้องเทียบแนว ห้ามใช้ SOV BokThang กับข้อมูลสำคัญ

## Elevation

ระบบใช้ **Layered Restraint**: พื้นผิวหลักแยกชั้นด้วยโทนสีและเส้นขอบก่อน แล้วใช้เงานุ่มเมื่อ elevation ช่วยอธิบายโครงสร้างจริง เช่น dialog, เมนูซ้อน และองค์ประกอบสำคัญในสถานะ hover เงาไม่ใช่สิ่งต้องห้าม แต่ต้องมีหน้าที่และไม่ปรากฏบนทุก container

### Shadow Vocabulary

- **Low Lift** (MUI elevation 1): ใช้กับ hover หรือพื้นผิวขนาดเล็กที่ยกขึ้นชั่วคราว
- **Floating Menu** (MUI elevation 8): ใช้กับ menu, popover และพื้นผิวที่ซ้อนเหนือเนื้อหา
- **Dialog Focus** (MUI elevation 24): ใช้กับ dialog เท่านั้น เพื่อแยกงานที่กำลังโฟกัสจากฉากหลัง

### Named Rules

**The Earned Shadow Rule.** ทุกเงาต้องอธิบายการซ้อนชั้นหรือ interaction state ได้ ถ้าเอาเงาออกแล้วความหมายไม่เปลี่ยน เงานั้นไม่จำเป็น

## Components

Component vocabulary คือ **คุ้นเคย มั่นใจ และเป็นมิตร** ใช้ MUI เป็นฐาน รูปทรง 10px และ state ที่สม่ำเสมอทั่วระบบ

### Buttons

- **Shape:** มุมโค้งระดับกลาง (`md`) และพื้นที่กดสูงอย่างน้อย 40px
- **Primary:** ใช้ `accent` บน `background` สำหรับ action สำคัญที่สุดในบริบทนั้น
- **Hover / Focus:** hover เปลี่ยนโทนอย่างนุ่มนวล; focus ใช้เส้น `accent` 2px ที่มองเห็นชัด; disabled ลด emphasis แต่ label ต้องยังอ่านได้
- **Secondary / Ghost:** outlined สำหรับ action รอง, text/ghost สำหรับ cancel และ action ที่ไม่ควรแย่งความสนใจ
- **Destructive:** ใช้ `expense` พร้อมคำกริยาที่ชัดเจนและ confirmation เมื่อผลย้อนกลับยาก

### Chips

- **Style:** รูปทรง pill ใช้แสดงสถานะสั้น ๆ ไม่ใช้เป็นปุ่มทั่วไป
- **State:** success ใช้ `income`; self/selected ใช้ `accent`; ทุก chip ต้องมี label ที่อธิบายความหมาย

### Cards / Containers

- **Corner Style:** มุมโค้ง 10px
- **Background:** `surface` บน `background`
- **Shadow Strategy:** เริ่มจากเส้น `border`; เพิ่มเงาตาม Earned Shadow Rule
- **Border:** 1px solid `border` สำหรับ outlined surface และตาราง
- **Internal Padding:** 24px เป็นค่าหลัก, 32px สำหรับ auth panel บนจอกว้าง

### Inputs / Fields

- **Style:** พื้น `background`, เส้น `border`, มุม 10px และ label ที่ไม่หายเมื่อมีค่า
- **Focus:** เส้น `accent` หนา 2px โดยไม่เปลี่ยน layout
- **Error / Disabled:** error ใช้ `expense` พร้อมข้อความ; disabled ลด emphasis และใช้ cursor/state ที่ชัดเจน

### Navigation

- ใช้ app bar แบบ sticky และ tab navigation ที่คุ้นเคย
- tab ปกติใช้ `muted`; tab ที่เลือกใช้ `accent` พร้อม indicator
- มือถือคง action หลักไว้ ลดรายละเอียดแบรนด์ที่ไม่จำเป็น และใช้ scrollable tabs สำหรับเมนูตั้งค่าที่ยาว

### Tables and Dialogs

- ตารางใช้ขนาด compact, header น้ำหนัก 650, เส้นแบ่ง `border` และเลื่อนแนวนอนได้บนจอแคบ
- dialog ใช้ MUI focus management, ความกว้างตามเนื้อหา, divider ชัด และ Dialog Focus elevation

## Do's and Don'ts

### Do:

- **Do** ใช้ Hyacinthia Sky เฉพาะ primary action, focus และ current selection
- **Do** ใช้ layout ที่อ่านง่ายและลำดับชั้นชัดเจนแบบแอปการเงินที่คุ้นเคย
- **Do** รักษาพื้นที่กดอย่างน้อย 40px และรองรับ viewport ตั้งแต่ 320px
- **Do** รักษา contrast ระดับ WCAG AA และใช้ข้อความหรือไอคอนควบคู่กับสีสถานะ
- **Do** ใช้ state transition ประมาณ 200ms และปิด motion ที่ไม่จำเป็นเมื่อผู้ใช้ตั้งค่า reduced motion
- **Do** ใช้เงานุ่มเฉพาะเมื่อช่วยอธิบายการซ้อนชั้นหรือ interaction

### Don't:

- **Don't** ใช้สีเขียวประจำแบรนด์หรืออัตลักษณ์ของ KBank เป็นสีหลักหรือสีอ้างอิง; สีเขียวใช้ได้เฉพาะ `income` และสถานะสำเร็จ
- **Don't** ลอกหน้าตาของ KBank โดยตรง การอ้างอิงจำกัดอยู่ที่แนวทาง layout เท่านั้น
- **Don't** ใช้ accent เป็นสีตกแต่งทั่วทั้งหน้าจอหรือใช้สีโดยไม่มี label/icon อธิบาย
- **Don't** ซ้อน card ภายใน card หรือใส่เงาให้ทุก container
- **Don't** ใช้ SOV BokThang หรือ display/pixel font กับตัวเลขการเงิน, input, button, tab หรือ table
- **Don't** เปลี่ยนรูปแบบปุ่ม, input, dialog หรือ icon ระหว่างหน้าจอโดยไม่มีเหตุผลเชิงงาน
