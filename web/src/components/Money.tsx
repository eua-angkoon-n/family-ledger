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
  // ไม่ใช่ error.main — ใน Bubblegum นั่นคือ destructive (ชมพู) ซึ่งไม่ผ่าน AA เป็นตัวอักษร และไม่ได้แปลว่ารายจ่าย
  expense: 'brand.expense',
};

// แสดงจำนวนเงิน — dataTextSx เสมอ (Financial Clarity Rule); Poppins ไม่มี tnum ตัวเลขจึงยังกว้างไม่เท่ากัน
export default function Money({ satang, tone = 'neutral', showSign = false, sx }: MoneyProps) {
  const sign = showSign ? (satang > 0 ? '+' : satang < 0 ? '−' : '') : '';
  const color = TONE_COLOR[tone];
  return (
    <Box component="span" sx={{ ...dataTextSx, ...(color ? { color } : {}), ...sx }}>
      {sign}฿{formatBaht(Math.abs(satang))}
    </Box>
  );
}
