import { IconButton } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import SettingsBrightnessRounded from '@mui/icons-material/SettingsBrightnessRounded';

// ลำดับการวน: ตามเครื่อง → สว่าง → มืด → ตามเครื่อง
const MODES = [
  { mode: 'system', label: 'ตามเครื่อง', Icon: SettingsBrightnessRounded },
  { mode: 'light', label: 'สว่าง', Icon: LightModeRounded },
  { mode: 'dark', label: 'มืด', Icon: DarkModeRounded },
] as const;

/**
 * ปุ่มธีมสี — กดครั้งเดียวเปลี่ยนโหมดทันที ไอคอนบอกโหมดปัจจุบัน ไม่มี Tooltip/เมนู
 * ชื่อที่ screen reader อ่านบอกทั้งโหมดปัจจุบันและผลของการกด เพราะไม่มีข้อความให้เห็น
 * MUI เก็บค่าที่เลือกใน localStorage ของเครื่องนี้เอง; aria-label เปลี่ยนตามโหมด คู่มือจึงเกาะ data-tour แทน
 */
export default function ThemeModeToggle() {
  const { mode, setMode } = useColorScheme();
  // mode เป็น undefined ได้ก่อน provider อ่าน localStorage — ถือเป็นค่าเริ่มต้น "ตามเครื่อง"
  const index = Math.max(0, MODES.findIndex((m) => m.mode === (mode ?? 'system')));
  const current = MODES[index];
  const next = MODES[(index + 1) % MODES.length];
  return (
    <IconButton
      color="inherit"
      data-tour="theme-toggle"
      aria-label={`ธีมสี: ${current.label} — กดเพื่อเปลี่ยนเป็น${next.label}`}
      onClick={() => setMode(next.mode)}
    >
      <current.Icon />
    </IconButton>
  );
}
