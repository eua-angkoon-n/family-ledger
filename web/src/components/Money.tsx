import { Box, type SxProps, type Theme } from '@mui/material';
import { formatBaht } from '../format.js';
import { dataTextSx } from '../theme.js';

type Tone = 'neutral' | 'income' | 'expense';

type MoneyProps = {
  satang: number;
  tone?: Tone;
  showSign?: boolean;
  sx?: SxProps<Theme>;
};

// path ของ palette — sx แปลงเป็น CSS var ของธีมที่ใช้อยู่
const TONE_COLOR: Record<Tone, string | undefined> = {
  neutral: undefined,
  income: 'success.main',
  // ไม่ใช่ error.main — นั่นคือ destructive (error/การลบ) ไม่ได้แปลว่ารายจ่าย (The Money Color Rule)
  expense: 'brand.expense',
};

// แสดงจำนวนเงิน — dataTextSx เสมอ (Financial Clarity Rule); Poppins ไม่มี tnum ตัวเลขจึงยังกว้างไม่เท่ากัน
export default function Money({ satang, tone = 'neutral', showSign = false, sx }: MoneyProps) {
  const sign = showSign ? (satang > 0 ? '+' : satang < 0 ? '−' : '') : '';
  // ศูนย์ไม่ใช่ทั้งรายรับและรายจ่าย — สีกลางเสมอ ไม่งั้น ฿0.00 สีเขียว/แดงอ่านเหมือนมีเงินเข้า/ออก
  const color = satang === 0 ? undefined : TONE_COLOR[tone];
  return (
    <Box component="span" sx={{ ...dataTextSx, ...(color ? { color } : {}), ...sx }}>
      {sign}฿{formatBaht(Math.abs(satang))}
    </Box>
  );
}
