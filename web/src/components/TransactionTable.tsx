import {
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import SwapHorizRounded from '@mui/icons-material/SwapHorizRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import type { TxnListRow } from '../api.js';
import { formatDate } from '../format.js';
import Money from './Money.js';

type TransactionTableProps = {
  rows: TxnListRow[];
  showRunningBalance: boolean;
  onRowClick: (id: number) => void;
  busy?: boolean;
};

function CategoryCell({ row }: { row: TxnListRow }) {
  if (row.split_count === 0) {
    return <Typography variant="body2" color="text.secondary">ไม่ได้จัดหมวด</Typography>;
  }
  const shown = row.categories.slice(0, 2);
  const extra = row.categories.length - shown.length;
  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
      {shown.map((c) => <Chip key={c.category_id} size="small" label={c.category_name} variant="outlined" />)}
      {extra > 0 && <Chip size="small" label={`+${extra}`} variant="outlined" />}
    </Stack>
  );
}

// ตาราง §8.3 — คอลัมน์ Running Balance โผล่เฉพาะกรองบัญชีเดียว (ยอดคงเหลือข้ามบัญชีเรียงต่อกันอ่านเป็นยอดรวมที่ไม่มีจริง)
// ปุ่มลูกศรท้ายแถวคือ path หลักสำหรับคีย์บอร์ด/screen reader ส่วนคลิกทั้งแถวคือทางลัดสำหรับเมาส์ (ไม่ใช่ hover-only)
export default function TransactionTable({ rows, showRunningBalance, onRowClick, busy = false }: TransactionTableProps) {
  return (
    <TableContainer component={Paper} variant="outlined" tabIndex={0} sx={{ mt: 3 }} aria-busy={busy}>
      {/* แถบบางบอกกำลังรีเฟรช แทนการลด opacity ทั้งตาราง — opacity จะลด contrast ของ text.secondary ที่ผ่าน AA
          อยู่แล้วให้ต่ำกว่าเกณฑ์ (ปัญหาเดียวกับที่แก้ใน SummaryCard) */}
      {busy && <LinearProgress sx={{ height: 2 }} />}
      <Table size="small" aria-label="รายการธุรกรรม" sx={{ minWidth: 1100 }}>
        <TableHead>
          <TableRow>
            <TableCell>วันที่</TableCell>
            <TableCell>รายการ</TableCell>
            <TableCell>บัญชี</TableCell>
            <TableCell align="right">เงินเข้า</TableCell>
            <TableCell align="right">เงินออก</TableCell>
            {showRunningBalance && <TableCell align="right">คงเหลือ</TableCell>}
            <TableCell>หมวด</TableCell>
            <TableCell>ประเภท</TableCell>
            <TableCell>ตรวจสอบ</TableCell>
            <TableCell align="right" sx={{ width: 48 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              hover
              onClick={() => onRowClick(row.id)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell>
                {formatDate(row.txn_date)}
                {row.txn_time && <Typography component="div" variant="body2" color="text.secondary">{row.txn_time.slice(0, 5)}</Typography>}
              </TableCell>
              <TableCell sx={{ maxWidth: 260 }}>
                <Typography sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</Typography>
                {row.is_internal_transfer && (
                  <Chip size="small" icon={<SwapHorizRounded />} label="โอนภายใน" variant="outlined" sx={{ mt: 0.5 }} />
                )}
              </TableCell>
              <TableCell>{row.account_nickname}</TableCell>
              <TableCell align="right">{row.direction === 'credit' ? <Money satang={row.amount_satang} tone="income" /> : '—'}</TableCell>
              <TableCell align="right">{row.direction === 'debit' ? <Money satang={row.amount_satang} tone="expense" /> : '—'}</TableCell>
              {showRunningBalance && (
                <TableCell align="right"><Money satang={row.running_balance_satang} /></TableCell>
              )}
              <TableCell><CategoryCell row={row} /></TableCell>
              <TableCell>
                <Chip size="small" label={row.account_purpose === 'business' ? 'ธุรกิจ' : 'ส่วนตัว'} variant="outlined" />
              </TableCell>
              <TableCell>
                {row.review_status === 'reviewed' ? (
                  <Chip size="small" icon={<CheckRounded />} label="ตรวจแล้ว" color="success" variant="outlined" />
                ) : (
                  <Chip size="small" label="ยังไม่ตรวจ" variant="outlined" />
                )}
              </TableCell>
              <TableCell align="right">
                <Tooltip title="ดูรายละเอียด">
                  <IconButton
                    size="small"
                    aria-label={`ดูรายละเอียดธุรกรรม ${row.description} วันที่ ${formatDate(row.txn_date)}`}
                    onClick={(event) => { event.stopPropagation(); onRowClick(row.id); }}
                  >
                    <ChevronRightRounded />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
