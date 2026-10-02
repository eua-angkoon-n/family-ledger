import {
  Box,
  Checkbox,
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
import RadioButtonUncheckedRounded from '@mui/icons-material/RadioButtonUncheckedRounded';
import type { TxnListRow } from '../api.js';
import { formatDate, formatDayMonth } from '../format.js';
import { visuallyHiddenSx } from '../ui.js';
import Money from './Money.js';

/** เลือกได้เฉพาะแถวที่ยังไม่ตรวจ — ไม่ส่งมา = หน้านี้ไม่มีแถวให้เลือก ไม่มีคอลัมน์ checkbox เลย */
export type TxnSelection = {
  selected: ReadonlySet<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
};

type TransactionTableProps = {
  rows: TxnListRow[];
  showRunningBalance: boolean;
  onRowClick: (id: number) => void;
  busy?: boolean;
  selection?: TxnSelection;
};

// < md เหลือ วันที่ · รายการ · จำนวนเงิน (รวมเข้า/ออกเป็นช่องเดียวมีเครื่องหมาย) — ที่ 320px: กล่อง 286 − checkbox 50
// − วันที่ ~57 − ยอด ~88 − ลูกศร 40 ≈ รายการ 51px (ไม่มี checkbox 101px), 375px ≈ 106px (156px) ไม่ต้องเลื่อนแนวนอน
const MD_UP = { display: { xs: 'none', md: 'table-cell' } } as const;
const BELOW_MD = { display: { md: 'none' } } as const;

function CategoryCell({ row }: { row: TxnListRow }) {
  if (row.split_count === 0) {
    return <Typography variant="body2" color="text.secondary">ไม่ได้จัดหมวด</Typography>;
  }
  const shown = row.categories.slice(0, 2);
  const extra = row.categories.length - shown.length;
  return (
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
      {shown.map((c) => <Chip key={c.category_id} size="small" label={c.category_name} variant="outlined" />)}
      {extra > 0 && <Chip size="small" label={`+${extra}`} variant="outlined" />}
    </Stack>
  );
}

// ตรวจแล้ว = เงียบ (สีรอง) ยังไม่ตรวจ = เน้น (สีตัวอักษรหลัก ตัวหนา) เพราะเป็นสิ่งที่ต้องจัดการ — ทั้งคู่มีข้อความ ไม่ใช่สีอย่างเดียว
function ReviewCell({ row }: { row: TxnListRow }) {
  const reviewed = row.review_status === 'reviewed';
  const Icon = reviewed ? CheckRounded : RadioButtonUncheckedRounded;
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', whiteSpace: 'nowrap', color: reviewed ? 'text.secondary' : 'text.primary' }}>
      <Icon fontSize="small" aria-hidden />
      <Typography variant="body2" component="span" sx={{ fontWeight: reviewed ? 400 : 600 }}>
        {reviewed ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ'}
      </Typography>
    </Stack>
  );
}

// ตาราง §8.3 — คอลัมน์ Running Balance โผล่เฉพาะกรองบัญชีเดียว (ยอดคงเหลือข้ามบัญชีเรียงต่อกันอ่านเป็นยอดรวมที่ไม่มีจริง)
// ปุ่มลูกศรท้ายแถวคือ path หลักสำหรับคีย์บอร์ด/screen reader ส่วนคลิกทั้งแถวคือทางลัดสำหรับเมาส์ (ไม่ใช่ hover-only)
// data-txn-id บนปุ่มลูกศรให้หน้าธุรกรรมคืน focus หลังปิด drawer · แถวไม่ใช้ `selected` เพราะพื้น sidebar-accent ทำยอดเงิน
// เข้า/ออกเหลือ 3.07–3.11 (สว่าง) / 1.11–1.67 (มืด) — checkbox บอกสถานะที่เลือกแทน
export default function TransactionTable({ rows, showRunningBalance, onRowClick, busy = false, selection }: TransactionTableProps) {
  const selectable = rows.filter((r) => r.review_status === 'unreviewed');
  const selectedCount = selection ? selectable.filter((r) => selection.selected.has(r.id)).length : 0;
  // position relative ที่ TableContainer: ข้อความซ่อน (position absolute) ในหัวคอลัมน์ต้องถูก overflow ของกล่องนี้ตัด
  // ไม่งั้นมันหลุดไปยึดหน้าแล้วดันหน้าให้เลื่อนข้างที่ 900–1100px
  return (
    <TableContainer component={Paper} variant="outlined" tabIndex={0} sx={{ mt: 1.5, position: 'relative' }} aria-busy={busy}>
      {/* แถบบางบอกกำลังรีเฟรช แทนการลด opacity ทั้งตาราง — opacity จะลด contrast ของ text.secondary ที่ผ่าน AA
          อยู่แล้วให้ต่ำกว่าเกณฑ์ (ปัญหาเดียวกับที่แก้ใน SummaryCard) */}
      {busy && <LinearProgress aria-label="กำลังรีเฟรชรายการ" sx={{ height: 2 }} />}
      <Table
        size="small"
        aria-label="รายการธุรกรรม"
        sx={{
          minWidth: { md: showRunningBalance ? 1100 : 1000 },
          // ไม่รวมช่อง checkbox/ลูกศร (ตั้ง padding เองต่อช่อง) — selector ระดับตารางเจาะจงกว่า sx ของช่อง
          '& .MuiTableCell-root:not(.MuiTableCell-paddingCheckbox):not(:last-child)': { px: { xs: 0.75, md: 1.5 } },
        }}
      >
        <TableHead>
          <TableRow>
            {selection && (
              <TableCell padding="checkbox" sx={{ py: 0.5, px: 0.5 }}>
                <Checkbox
                  checked={selectedCount === selectable.length}
                  indeterminate={selectedCount > 0 && selectedCount < selectable.length}
                  onChange={selection.onToggleAll}
                  slotProps={{ input: { 'aria-label': 'เลือกทุกแถวที่ยังไม่ตรวจในหน้านี้' } }}
                />
              </TableCell>
            )}
            <TableCell>วันที่</TableCell>
            <TableCell>รายการ</TableCell>
            <TableCell sx={MD_UP}>บัญชี</TableCell>
            <TableCell align="right" sx={MD_UP}>เงินเข้า</TableCell>
            <TableCell align="right" sx={MD_UP}>เงินออก</TableCell>
            <TableCell align="right" sx={BELOW_MD}>จำนวนเงิน</TableCell>
            {showRunningBalance && <TableCell align="right" sx={MD_UP}>คงเหลือ</TableCell>}
            <TableCell sx={MD_UP}>หมวด</TableCell>
            <TableCell sx={MD_UP}>ประเภทบัญชี</TableCell>
            <TableCell sx={MD_UP}>สถานะ</TableCell>
            <TableCell align="right" sx={{ px: { xs: 0, md: 1 } }}><Box component="span" sx={visuallyHiddenSx}>เปิดรายละเอียด</Box></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            // โอนภายในไม่ใช่ทั้งรายรับและรายจ่าย — สีกลาง (The Money Color Rule)
            const tone = row.is_internal_transfer ? 'neutral' : row.direction === 'credit' ? 'income' : 'expense';
            const amount = <Money satang={row.amount_satang} tone={tone} />;
            return (
              <TableRow key={row.id} hover onClick={() => onRowClick(row.id)} sx={{ cursor: 'pointer' }}>
                {selection && (
                  // คลิกรอบ ๆ checkbox ต้องไม่เปิด drawer
                  <TableCell padding="checkbox" sx={{ py: 0.5, px: 0.5 }} onClick={(event) => event.stopPropagation()}>
                    {row.review_status === 'unreviewed' && (
                      <Checkbox
                        checked={selection.selected.has(row.id)}
                        onChange={() => selection.onToggle(row.id)}
                        slotProps={{ input: { 'aria-label': `เลือก ${row.description} วันที่ ${formatDate(row.txn_date)}` } }}
                      />
                    )}
                  </TableCell>
                )}
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {/* จอแคบตัดปีออก (เดือนที่เลือกอยู่บอกปีแล้ว) */}
                  <Box component="span" sx={BELOW_MD}>{formatDayMonth(row.txn_date)}</Box>
                  <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>{formatDate(row.txn_date)}</Box>
                  {row.txn_time && <Typography component="div" variant="body2" color="text.secondary">{row.txn_time.slice(0, 5)}</Typography>}
                </TableCell>
                {/* maxWidth 0 + width 100% = คอลัมน์นี้กินที่ที่เหลือและไม่ดันตารางให้กว้างเกินกล่อง ข้อความเต็มอยู่ใน title */}
                <TableCell sx={{ width: '100%', maxWidth: 0, overflow: 'hidden' }}>
                  <Box
                    title={row.description}
                    sx={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: { xs: 3, md: 2 },
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {row.description}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ ...BELOW_MD, overflowWrap: 'anywhere' }}>{row.account_nickname}</Typography>
                  {row.is_internal_transfer && (
                    <Typography variant="body2" color="text.secondary">
                      <SwapHorizRounded aria-hidden fontSize="inherit" sx={{ verticalAlign: '-0.125em', mr: 0.5 }} />
                      โอนภายใน
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={MD_UP}>{row.account_nickname}</TableCell>
                {/* ช่องที่ไม่ใช่ทิศของรายการเว้นว่าง ไม่ใส่ "—" — หัวคอลัมน์บอกทิศอยู่แล้ว */}
                <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}>{row.direction === 'credit' && amount}</TableCell>
                <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}>{row.direction === 'debit' && amount}</TableCell>
                <TableCell align="right" sx={{ ...BELOW_MD, whiteSpace: 'nowrap' }}>
                  <Money satang={row.direction === 'debit' ? -row.amount_satang : row.amount_satang} tone={tone} showSign />
                </TableCell>
                {showRunningBalance && (
                  <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}><Money satang={row.running_balance_satang} /></TableCell>
                )}
                <TableCell sx={MD_UP}><CategoryCell row={row} /></TableCell>
                <TableCell sx={MD_UP}>{row.account_purpose === 'business' ? 'ธุรกิจ' : 'ส่วนตัว'}</TableCell>
                <TableCell sx={MD_UP}><ReviewCell row={row} /></TableCell>
                <TableCell align="right" sx={{ py: 0.5, px: { xs: 0, md: 1 } }}>
                  <Tooltip title="ดูรายละเอียด">
                    <IconButton
                      size="small"
                      data-txn-id={row.id}
                      aria-label={`ดูรายละเอียดธุรกรรม ${row.description} วันที่ ${formatDate(row.txn_date)}`}
                      onClick={(event) => { event.stopPropagation(); onRowClick(row.id); }}
                    >
                      <ChevronRightRounded />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
