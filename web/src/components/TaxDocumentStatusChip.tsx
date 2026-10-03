import type { ReactElement } from 'react';
import { Chip } from '@mui/material';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRounded from '@mui/icons-material/RadioButtonUncheckedRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import type { TaxDocumentStatus } from '../api.js';

// ป้ายสถานะชุดเดียวของหน้าเอกสารภาษี (chip, ตัวกรอง, บรรทัดรองบนมือถือ, ลิ้นชัก) — คำเดียวกับหน้าธุรกรรม
export const TAX_DOC_STATUS_LABEL: Record<TaxDocumentStatus, string> = {
  draft: 'ยังไม่ตรวจ',
  verified: 'ตรวจแล้ว',
  submitted: 'ยื่นแล้ว',
};

// เหมือน PaymentStatusChip.tsx — accent สงวนไว้สำหรับ action (Restrained Accent Rule) จึงแยกสถานะกลาง ๆ ด้วยไอคอน + label
// "ยังไม่ตรวจ" คืองานค้าง: ตัวอักษรหลักน้ำหนัก 600 (Tables ใน DESIGN.md) ไอคอนวงกลมว่างแบบสถานะตรวจของหน้าธุรกรรม
const ICON: Record<TaxDocumentStatus, ReactElement> = {
  draft: <RadioButtonUncheckedRounded />,
  verified: <CheckCircleRounded />,
  submitted: <SendRounded />,
};

export default function TaxDocumentStatusChip({ status }: { status: TaxDocumentStatus }) {
  return (
    <Chip
      size="small"
      icon={ICON[status]}
      label={TAX_DOC_STATUS_LABEL[status]}
      color={status === 'verified' ? 'success' : 'default'}
      variant="outlined"
      sx={status === 'draft' ? { fontWeight: 600 } : undefined}
    />
  );
}
