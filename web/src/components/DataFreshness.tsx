import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import type { AccountCoverage } from '../api.js';
import { formatDate, formatDateTime } from '../format.js';
import { dataTextSx } from '../theme.js';

// §8.1: แสดงวันที่ข้อมูลล่าสุดของทุกบัญชี + เตือนเมื่อ statement ของเดือนยังมาไม่ครบ
// สีสถานะต้องมาพร้อมไอคอน/ข้อความเสมอ (Semantic Color Rule) — ไม่ใช้สีเดี่ยว ๆ สื่อความหมาย
export default function DataFreshness({ accounts }: { accounts: AccountCoverage[] }) {
  if (accounts.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h2" sx={{ fontSize: '1.25rem', mb: 2 }}>ความสดของข้อมูลแต่ละบัญชี</Typography>
      <Stack spacing={1.5}>
        {accounts.map((a) => (
          <Stack
            key={a.bank_account_id}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 0.5, sm: 2 }}
            sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0, pb: 0 } }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 650 }}>{a.account_nickname}</Typography>
              <Typography variant="body2" color="text.secondary">{a.bank_name}</Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
              <Typography variant="body2" color="text.secondary" sx={dataTextSx}>
                {a.latest_txn_date ? `รายการล่าสุด ${formatDate(a.latest_txn_date)}` : 'ยังไม่มีรายการ'}
                {a.last_synced_at && ` · ซิงก์ล่าสุด ${formatDateTime(a.last_synced_at)}`}
              </Typography>
              {a.statement_behind ? (
                // ไม่มีสี "warning" ใน DESIGN.md (มีแค่ accent/income/expense/neutral) — ไม่เพิ่มสีใหม่เอง
                // ใช้ไอคอน + ข้อความสื่อความหมายแทน (Semantic Color Rule ไม่ได้บังคับว่าต้องมีสีเสมอ)
                <Chip size="small" icon={<WarningAmberRounded />} label="ข้อมูลอาจไม่ครบ" variant="outlined" />
              ) : (
                <Chip size="small" icon={<CheckCircleRounded />} label="ข้อมูลล่าสุด" color="success" variant="outlined" />
              )}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
