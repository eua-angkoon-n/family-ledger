import { useEffect } from 'react';
import { Box, IconButton, Stack, TextField, Tooltip } from '@mui/material';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { dataTextSx } from '../theme.js';
import { formatMonth } from '../format.js';
import { visuallyHiddenSx } from '../ui.js';

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** ค่าเดือนที่ใช้ยิง request ได้: ต้องเป็น YYYY-MM จริง (Firefox แสดง type=month เป็นช่องข้อความ ค่าครึ่ง ๆ กลาง ๆ หลุดมาได้)
 *  และไม่เกิน max — ค่าเสียคืน null ให้ผู้เรียกใช้ค่าตั้งต้นแทน */
export function validMonth(value: string | null | undefined, max: string): string | null {
  if (value == null || !MONTH_RE.test(value)) return null;
  return value > max ? max : value;
}

// maxMonth: หน้าแดชบอร์ด/ธุรกรรมดูได้ถึงเดือนปัจจุบัน (ไม่มีข้อมูลจริงของอนาคต) แต่หน้าวางแผน
// ต้องเลือกเดือนข้างหน้าได้ (API จำกัดไว้ 12 เดือน) จึงส่งค่ามาทับได้
// keyboardShortcut: ←/→ ทั้งหน้าเปลี่ยนเดือน (แดชบอร์ด) — tooltip ของลูกศรบอกคีย์ลัดเฉพาะหน้าที่เปิดไว้
type MonthPickerProps = { value: string; onChange: (month: string) => void; maxMonth?: string; keyboardShortcut?: boolean };

// input[type=month] ของเบราว์เซอร์เอง — ไม่ต้องพึ่ง date picker library (§8.1: เปิดที่เดือนปัจจุบัน เลือกย้อนหลังได้)
// ข้อความในช่องเป็นภาษาของเบราว์เซอร์ ("September 2026" ยาวสุด) — มือถือให้ช่องยืดเต็มแถวแทนความกว้างตายตัว
// ที่ 320px: 288 − ลูกศร 2×40 − ช่องไฟ 2×4 ≈ 200px ไม่ตัดคำ และลูกศรถัดไปไม่หลุดจอ
export default function MonthPicker({ value, onChange, maxMonth, keyboardShortcut = false }: MonthPickerProps) {
  const max = maxMonth ?? currentMonth();
  const go = (delta: number) => {
    const next = validMonth(shiftMonth(value, delta), max);
    if (next && next !== value) onChange(next);
  };

  // ไม่แย่งปุ่มลูกศรจากช่องกรอก/แท็บ/เมนู และไม่ทำงานระหว่างมี dialog เปิด (GuideTour เป็น role="dialog" และใช้ ←/→ เอง)
  useEffect(() => {
    if (!keyboardShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="tablist"], [role="menu"], [role="listbox"], [role="slider"]')) return;
      if (document.querySelector('[role="dialog"], .MuiModal-root:not(.MuiModal-hidden)')) return;
      go(e.key === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const hint = keyboardShortcut ? ' (กด ← บนคีย์บอร์ดก็ได้)' : '';
  const hintNext = keyboardShortcut ? ' (กด → บนคีย์บอร์ดก็ได้)' : '';
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', width: { xs: '100%', sm: 'auto' } }}>
      <Tooltip title={`เดือนก่อนหน้า${hint}`}>
        <IconButton aria-label="เดือนก่อนหน้า" aria-keyshortcuts={keyboardShortcut ? 'ArrowLeft' : undefined} onClick={() => go(-1)}>
          <ChevronLeftRounded />
        </IconButton>
      </Tooltip>
      <TextField
        type="month"
        label="เดือน"
        size="small"
        value={value}
        onChange={(event) => {
          const next = validMonth(event.target.value, max);
          if (next) onChange(next);
        }}
        slotProps={{ htmlInput: { max, sx: dataTextSx } }}
        sx={{ flex: { xs: 1, sm: 'none' }, minWidth: 0, width: { sm: 196 } }}
      />
      <Tooltip title={`เดือนถัดไป${hintNext}`}>
        <span>
          <IconButton aria-label="เดือนถัดไป" aria-keyshortcuts={keyboardShortcut ? 'ArrowRight' : undefined} onClick={() => go(1)} disabled={value >= max}>
            <ChevronRightRounded />
          </IconButton>
        </span>
      </Tooltip>
      {/* live region อ่านเดือนใหม่ให้ screen reader หลังเปลี่ยน (ลูกศร/คีย์ลัด/ปุ่มย้อนกลับ) — อยู่ตลอดเพราะ live region ประกาศเฉพาะตอนเปลี่ยน */}
      <Box component="span" aria-live="polite" sx={visuallyHiddenSx}>{`เดือน ${formatMonth(value, 'numeric', 'long')}`}</Box>
    </Stack>
  );
}
