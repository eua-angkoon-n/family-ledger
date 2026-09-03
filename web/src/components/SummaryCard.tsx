import type { ReactNode } from 'react';
import { Box, ButtonBase, Paper, Stack, Typography } from '@mui/material';
import { dataTextSx } from '../theme.js';

type SummaryCardProps = {
  title: string;
  icon?: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
};

// การ์ดสรุปตัวเดียว ไม่ซ้อน Paper ใน Paper (Don't ของ DESIGN.md) — value ผ่าน dataTextSx เสมอ
// (ตัวเลข/เงินห้ามใช้ iannnnn-DOG ตาม Financial Clarity Rule) ต่างจาก title/caption ที่เป็นคำอธิบาย
export default function SummaryCard({ title, icon, value, caption, onClick, disabled, disabledReason }: SummaryCardProps) {
  const content = (
    <Stack spacing={0.75} sx={{ p: 3, textAlign: 'left', height: '100%' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
        {icon}
        <Typography variant="body2" sx={{ fontWeight: 650 }}>{title}</Typography>
      </Stack>
      <Box sx={{ ...dataTextSx, fontSize: '1.75rem', lineHeight: 1.3 }}>{disabled ? '—' : value}</Box>
      {(caption != null || (disabled && disabledReason)) && (
        <Typography variant="body2" color="text.secondary">
          {disabled ? disabledReason : caption}
        </Typography>
      )}
    </Stack>
  );

  if (disabled) {
    // เส้นประแทน opacity ทั้งใบ — opacity ลด contrast ของ text.secondary ที่ผ่าน WCAG AA อยู่แล้วให้ต่ำกว่าเกณฑ์
    return (
      <Paper variant="outlined" sx={{ borderStyle: 'dashed' }}>
        {content}
      </Paper>
    );
  }

  if (onClick) {
    return (
      <ButtonBase
        component={Paper}
        variant="outlined"
        onClick={onClick}
        sx={{
          display: 'block',
          width: '100%',
          borderRadius: '10px',
          transition: 'background-color 200ms',
          '&:hover': { bgcolor: 'action.hover' },
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}
      >
        {content}
      </ButtonBase>
    );
  }

  return <Paper variant="outlined">{content}</Paper>;
}
