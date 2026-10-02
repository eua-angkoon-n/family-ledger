import { useEffect, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { Box, IconButton, Stack, TextField, Tooltip } from '@mui/material';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
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

// เบราว์เซอร์ที่มี type=month จริง (Chrome/Edge/มือถือ) — Firefox/Safari เดสก์ท็อปตีเป็นช่องข้อความ อ่าน type กลับได้ 'text'
const nativeMonthInput = typeof document !== 'undefined' && (() => {
  const input = document.createElement('input');
  input.type = 'month';
  return input.type === 'month';
})();

// ช่องจริงโปร่งใส (opacity 0) จึงไม่เห็นไอคอนปฏิทินของเบราว์เซอร์ — คลิก/Enter/Space เปิด picker ให้แทน (Chrome เดสก์ท็อปคลิกที่ตัวช่อง
// แค่เลือกส่วนของวันที่) ถ้า showPicker ไม่ได้ (ไม่มีเมธอด/ไม่มี user activation) ช่องยังเป็น input ของเบราว์เซอร์ที่แก้ด้วย ↑/↓
// กดไอคอนปฏิทินที่อยู่ใต้ไอคอนของเรา และแตะเปิดเองบนมือถือได้ ไม่มีทางตัน
function openPicker(input: HTMLInputElement) {
  try {
    input.showPicker();
  } catch {
    // ไม่มี picker ให้เปิด — ปล่อยตามปกติของเบราว์เซอร์
  }
}

// input[type=month] ของเบราว์เซอร์เอง — ไม่ต้องพึ่ง date picker library (§8.1: เปิดที่เดือนปัจจุบัน เลือกย้อนหลังได้)
// ข้อความของเบราว์เซอร์เป็นภาษา/ปฏิทินของเครื่อง ("October 2026") ไม่ตรงกับ live region และทั้งแอป ("ตุลาคม 2569") — เบราว์เซอร์ที่มี
// type=month จึงทำช่องจริงให้โปร่งใส (ยังรับ focus, ชื่อ "เดือน" จาก label, picker ของเบราว์เซอร์) แล้ววางเดือนไทย พ.ศ. + ไอคอนปฏิทินทับ
// (aria-hidden, pointer-events none — คลิกทะลุถึงช่องจริง ไอคอนอยู่ตรงปุ่มปฏิทินของเบราว์เซอร์) เบราว์เซอร์ที่ไม่มี type=month ใช้ช่องเดิมตรง ๆ
// มือถือให้ช่องยืดเต็มแถวแทนความกว้างตายตัว ที่ 320px: 288 − ลูกศร 2×40 − ช่องไฟ 2×4 ≈ 200px ("พฤศจิกายน 2569" ยาวสุด) ลูกศรถัดไปไม่หลุดจอ
export default function MonthPicker({ value, onChange, maxMonth, keyboardShortcut = false }: MonthPickerProps) {
  const max = maxMonth ?? currentMonth();
  const go = (delta: number) => {
    const next = validMonth(shiftMonth(value, delta), max);
    if (next && next !== value) onChange(next);
  };

  // ไม่แย่งปุ่มลูกศรจากช่องกรอก/แท็บ/เมนู/กราฟ และไม่ทำงานระหว่างมี dialog เปิด (GuideTour เป็น role="dialog" และใช้ ←/→ เอง)
  // กราฟ: x-charts ใช้ ←/→ เลื่อน focus ระหว่างจุด แต่ที่จุดแรก/สุดท้ายมัน return โดยไม่ preventDefault — คีย์จึงหลุดมาเปลี่ยนเดือน
  // svg ที่รับ focus อยู่ใน ChartCard role="figure" เสมอ
  useEffect(() => {
    if (!keyboardShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="tablist"], [role="menu"], [role="listbox"], [role="slider"], [role="figure"]')) return;
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
        slotProps={nativeMonthInput ? {
          input: {
            startAdornment: (
              <Box
                component="span"
                aria-hidden
                sx={{ ...dataTextSx, position: 'absolute', inset: 0, px: 1.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden' }}
              >
                {formatMonth(value, 'numeric', 'long')}
                <CalendarMonthRounded fontSize="small" sx={{ color: 'action.active' }} />
              </Box>
            ),
          },
          htmlInput: {
            max,
            sx: { ...dataTextSx, opacity: 0, cursor: 'pointer' },
            onClick: (event: ReactMouseEvent<HTMLInputElement>) => openPicker(event.currentTarget),
            onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              openPicker(event.currentTarget);
            },
          },
        } : { htmlInput: { max, sx: dataTextSx } }}
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
