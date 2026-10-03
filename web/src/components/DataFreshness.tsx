import { Link } from 'react-router-dom';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded';
import LinkOffRounded from '@mui/icons-material/LinkOffRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import type { AccountCoverage } from '../api.js';
import { daysSince, formatDate, formatDateTime, formatMonth } from '../format.js';
import { dataTextSx } from '../theme.js';
import { currentMonth, shiftMonth } from './MonthPicker.js';

// "32 วันที่แล้ว" — ภาษาคนแทนวันที่ล้วน ๆ ให้เห็นทันทีว่าบัญชีไหนนิ่งไปนาน
function ago(isoDate: string): string {
  const d = daysSince(isoDate);
  return d <= 0 ? 'วันนี้' : d === 1 ? 'เมื่อวาน' : `${d.toLocaleString('th-TH')} วันที่แล้ว`;
}

// statement_behind (src/services/report-query.ts) = ขาด statement เกินช่วงผ่อนผัน: ขาด 2 เดือนขึ้นไป หรือขาดเดือนที่แล้ว
// และเลยวันที่ 10 แล้ว — บอกว่าขาดกี่เดือนนับจากเดือนที่แล้ว (เดือนล่าสุดที่ควรมี statement แล้ว)
function behindText(a: AccountCoverage): string {
  if (!a.latest_parsed_period_end) return 'ยังไม่มี statement ที่อ่านได้เลย';
  const now = new Date();
  const lastMonth = now.getFullYear() * 12 + now.getMonth() - 1;
  const [y, m] = a.latest_parsed_period_end.split('-').map(Number) as [number, number];
  const gap = lastMonth - (y * 12 + m - 1);
  const until = `statement ล่าสุดถึง ${formatDate(a.latest_parsed_period_end)}`;
  return gap > 0 ? `${until} — ขาดไป ${gap} เดือน` : until;
}

// §8.1: แสดงวันที่ข้อมูลล่าสุดของทุกบัญชี + เตือนเมื่อ statement ของเดือนยังมาไม่ครบ
// สีสถานะต้องมาพร้อมไอคอน/ข้อความเสมอ (Semantic Color Rule) — "ข้อมูลช้า" (คำเดียวกับการ์ดและแถบ "ต้องจัดการ" บนแดชบอร์ด) ใช้ warning เหมือนตัวนับปัญหาบนการ์ด
// (The Issue Count Rule) และ "ต้องเชื่อม Gmail ใหม่" ใช้ error (destructive ที่ปรับให้ผ่าน AA แล้ว)
// statement_awaiting = ขาดแค่เดือนที่แล้วและยังอยู่วันที่ 1–10 — ธนาคารยังส่งไม่ถึงรอบ ไม่ใช่ช้า จึงเป็นสีกลาง ไม่ใช่ warning
// (The Awaiting Statement Rule) และไม่นับในการ์ด/แถบ "ข้อมูลช้า"
export default function DataFreshness({ accounts }: { accounts: AccountCoverage[] }) {
  if (accounts.length === 0) return null;
  const awaitingText = `รอ statement ${formatMonth(shiftMonth(currentMonth(), -1))} (ปกติมาภายในวันที่ 10)`;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>ความสดของข้อมูลแต่ละบัญชี</Typography>
        <Button component={Link} to="/accounts#mailboxes-heading" variant="outlined" size="small" sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
          ดึงอีเมลใหม่ที่บัญชีของฉัน
        </Button>
      </Stack>
      <Stack spacing={1.5}>
        {accounts.map((a) => {
          const calm = !a.statement_behind && !a.reauth_required_at;
          return (
            <Stack
              key={a.bank_account_id}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 0.5, sm: 2 }}
              sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0, pb: 0 } }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{a.account_nickname}</Typography>
                {/* ชื่อเรียกที่ตั้งเป็นชื่อธนาคารอยู่แล้ว ("KBank") ไม่ต้องซ้ำอีกบรรทัด */}
                {a.bank_name !== a.account_nickname && (
                  <Typography variant="body2" color="text.secondary">{a.bank_name}</Typography>
                )}
                {/* แถวที่ปกติ/รอ statement: บรรทัดหลักคือ statement ครอบคลุมถึงวันไหน — "(59 วันที่แล้ว)" ของรายการล่าสุดอ่านขัดกับ chip
                    ที่บอกว่าปกติ (บัญชีที่ไม่ค่อยมีรายการ) จึงเหลือแค่วันที่ในบรรทัดรอง อายุของรายการเก็บไว้เฉพาะแถวข้อมูลช้า/ต้องเชื่อมใหม่ */}
                {calm && a.latest_parsed_period_end && (
                  <Typography variant="body2" sx={dataTextSx}>statement ล่าสุดถึง {formatDate(a.latest_parsed_period_end)}</Typography>
                )}
                {a.statement_awaiting && calm && (
                  <Typography variant="body2" color="text.secondary" sx={dataTextSx}>{awaitingText}</Typography>
                )}
                <Typography variant="body2" color="text.secondary" sx={dataTextSx}>
                  {a.latest_txn_date ? `รายการล่าสุด ${formatDate(a.latest_txn_date)}${calm ? '' : ` (${ago(a.latest_txn_date)})`}` : 'ยังไม่มีรายการ'}
                  {a.last_synced_at && ` · ดึงอีเมลล่าสุด ${formatDateTime(a.last_synced_at)}`}
                </Typography>
                {a.statement_behind && !a.reauth_required_at && (
                  <Typography variant="body2" sx={{ ...dataTextSx, color: 'warning.main' }}>{behindText(a)}</Typography>
                )}
              </Box>
              <Box sx={{ flexShrink: 0 }}>
                {a.reauth_required_at ? (
                  // ซิงก์หยุดแล้วจนกว่าจะเชื่อมใหม่ — สำคัญกว่าสถานะความครบของ statement จึงแสดงแทน
                  // ไม่ทำเป็นลิงก์เพราะ chip เล็กสูง 28px ต่ำกว่า tap target 40px — ปุ่มไปหน้าบัญชีของฉันอยู่หัวกล่องนี้
                  <Chip size="small" icon={<LinkOffRounded />} label="ต้องเชื่อม Gmail ใหม่" color="error" variant="outlined" />
                ) : a.statement_behind ? (
                  <Chip size="small" icon={<WarningAmberRounded />} label="ข้อมูลช้า" color="warning" variant="outlined" />
                ) : a.statement_awaiting ? (
                  <Chip size="small" icon={<HourglassEmptyRounded />} label="รอ statement" variant="outlined" />
                ) : (
                  <Chip size="small" icon={<CheckCircleRounded />} label="ข้อมูลล่าสุด" color="success" variant="outlined" />
                )}
              </Box>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}
