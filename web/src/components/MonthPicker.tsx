import { IconButton, Stack, TextField, Tooltip } from '@mui/material';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { dataTextSx } from '../theme.js';

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// maxMonth: หน้าแดชบอร์ด/ธุรกรรมดูได้ถึงเดือนปัจจุบัน (ไม่มีข้อมูลจริงของอนาคต) แต่หน้าวางแผน
// ต้องเลือกเดือนข้างหน้าได้ (API จำกัดไว้ 12 เดือน) จึงส่งค่ามาทับได้
type MonthPickerProps = { value: string; onChange: (month: string) => void; maxMonth?: string };

// input[type=month] ของเบราว์เซอร์เอง — ไม่ต้องพึ่ง date picker library (§8.1: เปิดที่เดือนปัจจุบัน เลือกย้อนหลังได้)
export default function MonthPicker({ value, onChange, maxMonth }: MonthPickerProps) {
  const max = maxMonth ?? currentMonth();
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Tooltip title="เดือนก่อนหน้า">
        <IconButton aria-label="เดือนก่อนหน้า" onClick={() => onChange(shiftMonth(value, -1))}>
          <ChevronLeftRounded />
        </IconButton>
      </Tooltip>
      <TextField
        type="month"
        label="เดือน"
        size="small"
        value={value}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        slotProps={{ htmlInput: { max, sx: dataTextSx } }}
        sx={{ width: { xs: 148, sm: 168 } }}
      />
      <Tooltip title="เดือนถัดไป">
        <span>
          <IconButton aria-label="เดือนถัดไป" onClick={() => onChange(shiftMonth(value, 1))} disabled={value >= max}>
            <ChevronRightRounded />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
