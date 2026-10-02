import { useId, type ReactNode } from 'react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { LoadError, visuallyHiddenSx } from '../ui.js';

/** ข้อมูลชุดเดียวกับที่กราฟวาด ในรูปตาราง — ซ่อนจากตาแต่ screen reader อ่านได้ (WCAG 1.1.1: SVG ของ x-charts เป็น aria-hidden) */
export type ChartTable = { columns: string[]; rows: string[][] };

type ChartCardProps = {
  title: string;
  /** ช่วงเวลาที่กราฟนี้ครอบคลุม เช่น "6 เดือนล่าสุด" — กราฟแต่ละใบในแดชบอร์ดใช้ช่วงไม่เท่ากัน */
  period?: string;
  empty?: boolean;
  emptyMessage?: string;
  loading?: boolean;
  /** โหลดไม่สำเร็จ — แสดงแทนที่กราฟ ไม่ใช่ "ยังไม่มีข้อมูล" (คนละความหมาย) */
  error?: boolean;
  onRetry?: () => void;
  table?: ChartTable;
  height?: number;
  children: ReactNode;
};

// กรอบมาตรฐานของกราฟทุกตัวในแดชบอร์ด — ไม่ซ้อน Paper ใน Paper, หัวข้อเป็น h3 ขั้น Headline Small ใต้หัวส่วน (h2)
// SVG ของ x-charts เป็น aria-hidden และ title/desc ของมันไปอยู่บน div role="none" (ถูกข้าม) — จึงห่อกราฟด้วย
// role="figure" ที่ชื่อมาจากหัวการ์ด คำอธิบายมาจากช่วงเวลา และมีตารางข้อมูลซ่อนอยู่ข้างใน
// ว่าง = กล่องเตี้ยกว่ากราฟ (ไม่ต้องจองที่ 280px ให้ข้อความบรรทัดเดียว — เห็นผลบนมือถือที่การ์ดเรียงคอลัมน์เดียว)
export default function ChartCard({ title, period, empty, emptyMessage, loading, error, onRetry, table, height = 280, children }: ChartCardProps) {
  const id = useId();
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
      <Typography component="h3" variant="h2" id={`${id}-title`} sx={{ fontSize: '1rem', lineHeight: 1.5 }}>{title}</Typography>
      {period && (
        <Typography id={`${id}-period`} variant="body2" color="text.secondary">{period}</Typography>
      )}
      <Box sx={{ mt: 2 }}>
        {error ? (
          <Box sx={{ minHeight: 140, display: 'grid', placeItems: 'center' }}><LoadError message={`โหลดกราฟ${title}ไม่สำเร็จ`} onRetry={onRetry} /></Box>
        ) : loading ? (
          <Skeleton variant="rounded" height={height} />
        ) : empty ? (
          <Box sx={{ minHeight: 120, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
            <Typography color="text.secondary">{emptyMessage ?? 'ยังไม่มีข้อมูลในช่วงเวลานี้'}</Typography>
          </Box>
        ) : (
          <Box
            role="figure"
            aria-labelledby={`${id}-title`}
            aria-describedby={period ? `${id}-period` : undefined}
            sx={{ position: 'relative', minHeight: height }}
          >
            {children}
            {table && (
              // table ไม่สนใจ width/overflow ของตัวเอง (ขยายตามเนื้อหาจนจอมือถือเลื่อนข้างได้) — ซ่อนที่กล่องครอบแทน
              <Box sx={visuallyHiddenSx}>
                <table>
                  <caption>{period ? `${title} (${period})` : title}</caption>
                  <thead>
                    <tr>{table.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {table.rows.map((r, i) => (
                      <tr key={i}>{r.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}</tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
