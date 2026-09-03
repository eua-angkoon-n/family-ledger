import type { ReactNode } from 'react';
import { Box, Paper, Typography } from '@mui/material';

type ChartCardProps = {
  title: string;
  empty?: boolean;
  emptyMessage?: string;
  height?: number;
  children: ReactNode;
};

// กรอบมาตรฐานของกราฟทุกตัวในแดชบอร์ด — ไม่ซ้อน Paper ใน Paper, หัวข้อใช้ h2 (เป็นหัวข้อ ไม่ใช่ข้อมูล จึงใช้ iannnnn-DOG ได้)
export default function ChartCard({ title, empty, emptyMessage, height = 280, children }: ChartCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h2" sx={{ fontSize: '1.25rem', mb: 2 }}>{title}</Typography>
      {empty ? (
        <Box sx={{ height, display: 'grid', placeItems: 'center' }}>
          <Typography color="text.secondary">{emptyMessage ?? 'ยังไม่มีข้อมูลในช่วงเวลานี้'}</Typography>
        </Box>
      ) : (
        <Box sx={{ height }}>{children}</Box>
      )}
    </Paper>
  );
}
