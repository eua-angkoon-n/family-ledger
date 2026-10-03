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
import { Fragment } from 'react';
import type { Classification, ReviewStatus, TxnListRow } from '../api.js';
import { formatBaht, formatDate, formatDayMonth } from '../format.js';
import { visuallyHiddenSx } from '../ui.js';
import Money from './Money.js';

/** ชื่อเดียวของสถานะนี้ทุกที่ (แถบ "ต้องจัดการ", การ์ดแดชบอร์ด, chip ตัวกรอง, ตาราง, drawer, คู่มือ) */
export const UNCATEGORISED_LABEL = 'ยังไม่จัดหมวด';
const NO_CATEGORY_NEEDED_LABEL = 'ไม่ต้องจัดหมวด';

/** โอนภายในและรายการที่ไม่นับรวมไม่อยู่ในรายงาน จึงไม่ต้องจัดหมวด — ชุดเดียวกับที่คิว/ตัวนับ "ยังไม่จัดหมวด" ตัดออก
 *  (classification ของ API รวม is_internal_transfer เป็น internal_transfer ให้แล้ว) */
export const needsCategory = (classification: Classification) => classification !== 'internal_transfer' && classification !== 'excluded';

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

// ตรวจแล้ว/จัดหมวดแล้ว/ไม่ต้องจัดหมวด = เงียบ (สีรอง) · ยังไม่ตรวจ/ยังไม่จัดหมวด = เน้น (สีตัวอักษรหลัก ตัวหนา) เพราะเป็นสิ่งที่ต้องจัดการ
// ทั้งคู่มีข้อความ ไม่ใช่สีอย่างเดียว (บน card 5.86 / 11.35, hover 6.79 / 12.13 สว่าง/มืด)
const todoSx = (todo: boolean) => ({ color: todo ? 'text.primary' : 'text.secondary', fontWeight: todo ? 600 : 400 });
const reviewLabel = (status: ReviewStatus) => (status === 'reviewed' ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ');
const categoryNames = (row: TxnListRow) => row.categories.map((c) => c.category_name).join(', ');
// ≥ md บัญชี/หมวดอยู่บรรทัดเดียวที่ 1280px — ชื่อยาวตัดด้วย … ชื่อเต็มอยู่ใน title (กล่องข้างในเพราะ max-width ของ td ไม่มีผล)
const ELLIPSIS_SX = { maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

// KBank เขียนคำอธิบายเป็น "<ชื่อรายการ>: <รายละเอียด>" (src/parsers/kbank.ts) — ชื่อรายการซ้ำกันเกือบทุกแถว ตารางจึงขึ้น
// รายละเอียด (ผู้รับ/ร้าน) ก่อน ชื่อรายการเป็นสีรองต่อท้าย · รูปแบบอื่น (SCB, ธนาคารที่ยังไม่รู้จัก) แสดงตามเดิม
// เฉพาะการแสดงผล — title, ชื่อสำหรับ screen reader, drawer และการค้นหายังเป็นข้อความเต็ม
const BANK_ITEM_PREFIX = /^(รับโอนเงิน|โอนเงิน|หักบัญชี|ชำระเงิน|ชำระด้วยบัตรเดบิต|รายการแก้ไข|ถอนเงินสด): (.+)$/;
function splitBankPrefix(description: string): { lead: string; item: string } | null {
  const m = BANK_ITEM_PREFIX.exec(description);
  return m ? { lead: m[2]!, item: m[1]! } : null;
}

// ต้นรายละเอียดที่เป็นแบบฟอร์มของ KBank (splitMainFields ใน kbank.ts): "โอนไป X1111 <ผู้รับ>", "จาก X2222 <ผู้โอน>",
// "เพื่อชำระ Ref X3333 <ร้าน>", "รหัสอ้างอิง EDC11111 <ร้าน>" (+ พร้อมเพย์/รหัสธนาคาร ก่อนเลขบัญชี) — เป็นสีรอง ชื่อผู้รับ/ร้าน
// จึงเด่นก่อน · ไม่มีชื่อต่อท้าย (เช่น "รหัสอ้างอิง EDC22222" ล้วน) หรือรูปแบบที่ไม่รู้จัก = คงเดิม
const DETAIL_BOILERPLATE = /^((?:(?:โอนไป|จาก|เพื่อชำระ)(?: พร้อมเพย์| [A-Z]{2,5})?(?: Ref)?|Ref) X\d+|รหัสอ้างอิง [A-Z]*\d+) (\S.*)$/;

function Description({ text }: { text: string }) {
  const parts = splitBankPrefix(text);
  if (!parts) return <>{text}</>;
  const boilerplate = DETAIL_BOILERPLATE.exec(parts.lead);
  return (
    <>
      <Box component="span" aria-hidden>
        {boilerplate ? <><Box component="span" sx={{ color: 'text.secondary' }}>{boilerplate[1]}</Box> {boilerplate[2]}</> : parts.lead}
        <Box component="span" sx={{ color: 'text.secondary' }}> · {parts.item}</Box>
      </Box>
      <Box component="span" sx={visuallyHiddenSx}>{text}</Box>
    </>
  );
}

// ชื่อปุ่มลูกศร: วันที่ ยอด และต้นข้อความ ~30 ตัวอักษร (ไม่ใช่ข้อความดิบทั้งก้อน) — ตัดตรงสระ/วรรณยุกต์ได้ ยอมรับ
const SHORT_NAME_LENGTH = 30;
function rowName(row: TxnListRow) {
  const text = splitBankPrefix(row.description)?.lead ?? row.description;
  const short = text.length > SHORT_NAME_LENGTH ? `${text.slice(0, SHORT_NAME_LENGTH)}…` : text;
  return `${formatDate(row.txn_date)} ${row.direction === 'debit' ? '−' : '+'}฿${formatBaht(row.amount_satang)} ${short}`;
}

function CategoryCell({ row }: { row: TxnListRow }) {
  if (row.split_count === 0) {
    const todo = needsCategory(row.classification);
    return <Typography variant="body2" component="span" sx={todoSx(todo)}>{todo ? UNCATEGORISED_LABEL : NO_CATEGORY_NEEDED_LABEL}</Typography>;
  }
  // หมวดแรก + "+n" ในบรรทัดเดียว — screen reader อ่านชื่อครบจากข้อความซ่อนแทน "+1"
  const extra = row.categories.length - 1;
  return (
    <>
      <Stack direction="row" aria-hidden title={categoryNames(row)} sx={{ gap: 0.5, alignItems: 'center' }}>
        <Chip size="small" label={row.categories[0]?.category_name} variant="outlined" sx={{ maxWidth: 140 }} />
        {extra > 0 && <Chip size="small" label={`+${extra}`} variant="outlined" />}
      </Stack>
      <Box component="span" sx={visuallyHiddenSx}>{categoryNames(row)}</Box>
    </>
  );
}

export function ReviewStatusLabel({ status }: { status: ReviewStatus }) {
  const reviewed = status === 'reviewed';
  const Icon = reviewed ? CheckRounded : RadioButtonUncheckedRounded;
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', whiteSpace: 'nowrap', color: todoSx(!reviewed).color }}>
      <Icon fontSize="small" aria-hidden />
      <Typography variant="body2" component="span" sx={todoSx(!reviewed)}>{reviewLabel(status)}</Typography>
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
    // กล่องเลื่อนที่ focus ได้ต้องมีชื่อ — คนละชื่อกับตาราง ("รายการธุรกรรม") ข้างใน
    <TableContainer component={Paper} variant="outlined" tabIndex={0} role="region" aria-label="ตารางธุรกรรม" sx={{ mt: 1.5, position: 'relative' }} aria-busy={busy}>
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
            const tone = row.classification === 'internal_transfer' ? 'neutral' : row.direction === 'credit' ? 'income' : 'expense';
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
                        slotProps={{ input: { 'aria-label': `เลือก ${rowName(row)}` } }}
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
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <Description text={row.description} />
                  </Box>
                  {/* < md ไม่มีคอลัมน์บัญชี/หมวด/สถานะ — สรุปเป็นบรรทัดรองบรรทัดเดียว มือถือจึงยังเห็นว่าแถวไหนต้องจัดการ:
                      บัญชี · "ยังไม่ตรวจ" (ตรวจแล้วไม่ขึ้น) · หมวด / "ยังไม่จัดหมวด" / "ไม่ต้องจัดหมวด" (เหมือนคอลัมน์หมวด) */}
                  <Typography variant="body2" component="div" sx={{ ...BELOW_MD, overflowWrap: 'anywhere' }}>
                    {[
                      <Box component="span" sx={{ color: 'text.secondary' }}>{row.account_nickname}</Box>,
                      row.review_status !== 'reviewed' && <Box component="span" sx={todoSx(true)}>{reviewLabel(row.review_status)}</Box>,
                      row.split_count > 0
                        ? <Box component="span" sx={todoSx(false)}>{categoryNames(row)}</Box>
                        : <Box component="span" sx={todoSx(needsCategory(row.classification))}>{needsCategory(row.classification) ? UNCATEGORISED_LABEL : NO_CATEGORY_NEEDED_LABEL}</Box>,
                    ].filter(Boolean).map((part, i) => (
                      <Fragment key={i}>
                        {i > 0 && <>{' '}<Box component="span" aria-hidden sx={{ color: 'text.secondary' }}>·</Box>{' '}</>}
                        {part}
                      </Fragment>
                    ))}
                  </Typography>
                  {row.classification === 'internal_transfer' && (
                    <Typography variant="body2" color="text.secondary">
                      <SwapHorizRounded aria-hidden fontSize="inherit" sx={{ verticalAlign: '-0.125em', mr: 0.5 }} />
                      โอนภายใน
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={MD_UP}><Box title={row.account_nickname} sx={ELLIPSIS_SX}>{row.account_nickname}</Box></TableCell>
                {/* ช่องที่ไม่ใช่ทิศของรายการเว้นว่าง ไม่ใส่ "—" — หัวคอลัมน์บอกทิศอยู่แล้ว */}
                <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}>{row.direction === 'credit' && amount}</TableCell>
                <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}>{row.direction === 'debit' && amount}</TableCell>
                <TableCell align="right" sx={{ ...BELOW_MD, whiteSpace: 'nowrap' }}>
                  <Money satang={row.direction === 'debit' ? -row.amount_satang : row.amount_satang} tone={tone} showSign />
                </TableCell>
                {showRunningBalance && (
                  <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}><Money satang={row.running_balance_satang} /></TableCell>
                )}
                <TableCell sx={{ ...MD_UP, whiteSpace: 'nowrap' }}><CategoryCell row={row} /></TableCell>
                <TableCell sx={{ ...MD_UP, whiteSpace: 'nowrap' }}>{row.account_purpose === 'business' ? 'ธุรกิจ' : 'ส่วนตัว'}</TableCell>
                <TableCell sx={MD_UP}><ReviewStatusLabel status={row.review_status} /></TableCell>
                <TableCell align="right" sx={{ py: 0.5, px: { xs: 0, md: 1 } }}>
                  <Tooltip title="ดูรายละเอียด">
                    <IconButton
                      size="small"
                      data-txn-id={row.id}
                      aria-label={`ดูรายละเอียด ${rowName(row)}`}
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
