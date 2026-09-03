import { Box, type SxProps, type Theme } from '@mui/material';
import { formatBaht } from '../format.js';
import { colors, dataTextSx } from '../theme.js';

type Tone = 'neutral' | 'income' | 'expense';

type MoneyProps = {
  satang: number;
  tone?: Tone;
  showSign?: boolean;
  sx?: SxProps<Theme>;
};

const TONE_COLOR: Record<Tone, string | undefined> = {
  neutral: undefined,
  income: colors.income,
  expense: colors.expense,
};

// แสดงจำนวนเงิน — system-ui + tabular-nums เสมอ (Financial Clarity Rule) ห้าม iannnnn-DOG แตะที่นี่
export default function Money({ satang, tone = 'neutral', showSign = false, sx }: MoneyProps) {
  const sign = showSign ? (satang > 0 ? '+' : satang < 0 ? '−' : '') : '';
  const color = TONE_COLOR[tone];
  return (
    <Box component="span" sx={{ ...dataTextSx, ...(color ? { color } : {}), ...sx }}>
      {sign}฿{formatBaht(Math.abs(satang))}
    </Box>
  );
}
