import type { ReactElement } from 'react';
import { Chip } from '@mui/material';
import BlockRounded from '@mui/icons-material/BlockRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import DonutLargeRounded from '@mui/icons-material/DonutLargeRounded';
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded';
import LinkOffRounded from '@mui/icons-material/LinkOffRounded';
import RadioButtonUncheckedRounded from '@mui/icons-material/RadioButtonUncheckedRounded';
import SkipNextRounded from '@mui/icons-material/SkipNextRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import type { PaymentState, PlanKind } from '../api.js';

// สถานะการจ่ายตาม §8.2 — ไม่มี "รอ statement"/"ยืนยันแล้ว" แผนไม่ผูกกับ statement (ADR-0004)
// การจ่ายคือสิ่งที่ผู้ใช้บันทึกเอง จบที่ "จ่ายแล้ว" ส่วนรายได้จบที่ "บันทึกรายได้แล้ว"
//
// สี: success (= income) สำหรับที่จบแล้ว, warning + ไอคอนเตือนสำหรับ "เกินกำหนด" (ต้องจัดการ ไม่ใช่ error —
// The Issue Count Rule: สว่าง 5.28 บน card / 6.11 บนแถว hover, มืด 7.22 / 7.72) ที่เหลือเป็นสีกลาง แยกด้วยไอคอน + label
// accent สงวนไว้สำหรับ action/focus/selection (Restrained Accent Rule) ทุกตัวมี label จึงผ่าน Semantic Color Rule
type Spec = { label: string; color: 'default' | 'success' | 'warning'; icon: ReactElement };

const SPECS: Record<PaymentState, Spec> = {
  deducted: { label: 'หักจากรายได้', color: 'default', icon: <CheckCircleRounded /> },
  not_required: { label: 'ไม่ต้องรับเงิน', color: 'default', icon: <CheckCircleRounded /> },
  unpaid: { label: 'ยังไม่จ่าย', color: 'default', icon: <RadioButtonUncheckedRounded /> },
  overdue: { label: 'เกินกำหนด', color: 'warning', icon: <WarningAmberRounded /> },
  partial: { label: 'จ่ายบางส่วน', color: 'default', icon: <DonutLargeRounded /> },
  paid: { label: 'จ่ายแล้ว', color: 'success', icon: <CheckCircleRounded /> },
  received: { label: 'บันทึกรายได้แล้ว', color: 'success', icon: <CheckCircleRounded /> },
  // ไม่ใช่ "ข้ามเดือนนี้" — งวดผ่อนรายวัน/รายปีใช้ chip เดียวกัน
  skipped: { label: 'ข้ามแล้ว', color: 'default', icon: <SkipNextRounded /> },
  cancelled: { label: 'ยกเลิก', color: 'default', icon: <BlockRounded /> },
};

// รายการหักจากรายได้ไม่ได้จ่ายเอง (ถูกหักเมื่อบันทึกรายได้) และเงินกันไว้ไม่ใช่บิล — ยังไม่เกิดจึงไม่ใช่ "เกินกำหนด"
// หรือ "ยังไม่จ่าย" API ส่ง unpaid ให้สองประเภทนี้ (overdue ของข้อมูลเก่าก็ถือเป็นค่าเดียวกัน) สีกลางเสมอ
// เงินกันไว้ใช้คำของการกันเงินแทนคำว่า "จ่าย" ทุกสถานะ (คู่กับปุ่ม "บันทึกว่ากันแล้ว" ในหน้าวางแผน)
const DEDUCTION_PENDING: Spec = { label: 'รอบันทึกรายได้', color: 'default', icon: <HourglassEmptyRounded /> };
// เดือนที่บันทึกรายได้แล้วแต่รายการหักนี้ยังไม่ผูก ไม่ได้ "รอ" รายได้อีก — คู่กับปุ่ม "ผูกกับรายได้" บนแถว
const DEDUCTION_UNLINKED: Spec = { label: 'ยังไม่ผูกกับรายได้', color: 'default', icon: <LinkOffRounded /> };
const RESERVE_PENDING: Spec = { label: 'ยังไม่ได้กัน', color: 'default', icon: <RadioButtonUncheckedRounded /> };
const BY_KIND: Partial<Record<PlanKind, Partial<Record<PaymentState, Spec>>>> = {
  payroll_deduction: { unpaid: DEDUCTION_PENDING, overdue: DEDUCTION_PENDING },
  reserve: {
    unpaid: RESERVE_PENDING,
    overdue: RESERVE_PENDING,
    partial: { label: 'กันบางส่วน', color: 'default', icon: <DonutLargeRounded /> },
    paid: { label: 'กันแล้ว', color: 'success', icon: <CheckCircleRounded /> },
  },
};

// label ชุดเดียวกับชิป ให้ตัวกรองสถานะในหน้าวางแผนเรียกชื่อตรงกับที่เห็นในตาราง
export const PAYMENT_STATE_LABEL = Object.fromEntries(
  Object.entries(SPECS).map(([state, spec]) => [state, spec.label]),
) as Record<PaymentState, string>;

/** `incomeRecorded` = เดือนนี้บันทึกรายได้แล้ว — รายการหักที่ยังค้างขึ้น "ยังไม่ผูกกับรายได้" แทน "รอบันทึกรายได้" */
export default function PaymentStatusChip({ state, kind, incomeRecorded = false }: { state: PaymentState; kind?: PlanKind; incomeRecorded?: boolean }) {
  const byKind = kind != null ? BY_KIND[kind]?.[state] : undefined;
  const spec = (incomeRecorded && byKind === DEDUCTION_PENDING ? DEDUCTION_UNLINKED : byKind) ?? SPECS[state] ?? SPECS.unpaid;
  return <Chip size="small" icon={spec.icon} label={spec.label} color={spec.color} variant="outlined" />;
}
