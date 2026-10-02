import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Skeleton, Stack, Typography, useMediaQuery } from '@mui/material';
import { useColorScheme, type Theme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import CallReceivedRounded from '@mui/icons-material/CallReceivedRounded';
import CallMadeRounded from '@mui/icons-material/CallMadeRounded';
import CategoryRounded from '@mui/icons-material/CategoryRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import EventBusyRounded from '@mui/icons-material/EventBusyRounded';
import EventRepeatRounded from '@mui/icons-material/EventRepeatRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import PaidRounded from '@mui/icons-material/PaidRounded';
import SwapHorizRounded from '@mui/icons-material/SwapHorizRounded';
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';
import UpdateRounded from '@mui/icons-material/UpdateRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import {
  req,
  type AccountBalances,
  type AccountCoverage,
  type CashFlow,
  type CategoryBreakdown,
  type FailedStatement,
  type MonthlyPlan,
  type ReportSummary,
} from '../api.js';
import ChartCard, { type ChartTable } from '../components/ChartCard.js';
import DataFreshness from '../components/DataFreshness.js';
import Money from '../components/Money.js';
import MonthPicker, { currentMonth, validMonth } from '../components/MonthPicker.js';
import SummaryCard, { summaryRowSx } from '../components/SummaryCard.js';
import { dataTextSx, tokens } from '../theme.js';
import { formatBaht, formatDate, formatDateTime, formatDayMonth, formatMonth } from '../format.js';
import { LoadError, PageHeader } from '../ui.js';

function monthsBack(month: string, count: number): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const start = new Date(Date.UTC(y, m - 1 - (count - 1), 1));
  const end = new Date(Date.UTC(y, m, 1));
  const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { from: iso(start), to: iso(new Date(end.getTime() - 86400000)) };
}

type Load<T> = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: T };

// หนึ่งคำขอต่อหนึ่งส่วนของหน้า: ส่วนที่ล้มเหลวแสดง "โหลดไม่สำเร็จ" + ลองใหม่ของตัวเอง ส่วนอื่นยังแสดงได้ตามปกติ
// ผลผูกกับ url+key ที่ขอ — เปลี่ยนเดือนแล้วถือว่ากำลังโหลดตั้งแต่ render แรก ตัวเลขของเดือนก่อนจึงไม่ค้างใต้
// label เดือนใหม่ (bug เดิมตอน request fail) และคำตอบที่มาช้าของเดือนเก่าถูกทิ้ง (live = false)
function useLoad<T>(url: string): [Load<T>, () => void] {
  const [key, setKey] = useState(0);
  const [result, setResult] = useState<{ url: string; key: number; load: Load<T> } | null>(null);
  useEffect(() => {
    let live = true;
    req<T>(url).then(
      (data) => { if (live) setResult({ url, key, load: { status: 'ok', data } }); },
      () => { if (live) setResult({ url, key, load: { status: 'error' } }); },
    );
    return () => { live = false; };
  }, [url, key]);
  const load: Load<T> = result != null && result.url === url && result.key === key ? result.load : { status: 'loading' };
  return [load, () => setKey((k) => k + 1)];
}

const dataOf = <T,>(load: Load<T>): T | null => (load.status === 'ok' ? load.data : null);

// ศูนย์ = ไม่มีปัญหา จึงเงียบ (สีรอง) / มากกว่าศูนย์ = ต้องจัดการ: สี warning + ไอคอน (ไม่สื่อด้วยสีอย่างเดียว)
// warning ไม่ใช่ error: ตัวนับคือ "ต้องจัดการ" ไม่ใช่ข้อผิดพลาด (The Issue Count Rule)
function IssueCount({ n }: { n: number }) {
  if (n === 0) return <Box component="span" sx={{ color: 'text.secondary' }}>0</Box>;
  return (
    <Box component="span" sx={{ color: 'warning.main', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <WarningAmberRounded fontSize="inherit" titleAccess="ต้องจัดการ" />
      {n.toLocaleString('th-TH')}
    </Box>
  );
}

// error_reason ที่ worker เขียนจริง (src/worker.ts): decrypt_failed / pdftotext_failed / checksum_failed หรือข้อความ
// exception ของ parser (เช่น "ไม่พบชนิด KBank statement") — มีแค่รหัสผ่าน PDF ที่ผู้ใช้แก้เองได้ที่หน้าบัญชีของฉัน
// ที่เหลือเป็นเรื่องของ parser/เซิร์ฟเวอร์ จึงบอกให้แจ้งผู้ดูแล ไม่มีปุ่มที่กดแล้วแก้ไม่ได้ (ข้อความดิบไม่แสดง เลข #id พอให้ผู้ดูแลตามได้)
function failureInfo(s: FailedStatement): { text: string; selfFix: boolean } {
  const reason = typeof s.error_reason === 'string' ? s.error_reason : '';
  if (reason === 'decrypt_failed') return { text: 'เปิดไฟล์ไม่ได้ เพราะรหัสผ่าน PDF ไม่ตรง', selfFix: true };
  if (reason === 'pdftotext_failed') return { text: 'อ่านข้อความในไฟล์ไม่ได้ — แจ้งผู้ดูแล', selfFix: false };
  if (s.status === 'checksum_failed') return { text: 'ยอดรวมในไฟล์ไม่ตรงกับรายการ — แจ้งผู้ดูแล', selfFix: false };
  return { text: 'ธนาคารเปลี่ยนรูปแบบไฟล์ ระบบยังอ่านไม่ได้ — แจ้งผู้ดูแล', selfFix: false };
}

// ponytail: สีของหมวดมาจาก category_id mod จำนวนสี (ชนกันในเดือนเดียวกันขยับไปช่องว่างถัดไป) — หมวดเดิมได้สีเดิม
// ข้ามเดือนเกือบทุกครั้ง แต่ธีมมีแค่ 5 สี หมวดที่ 6+ วนซ้ำ; ต้องการสีประจำหมวดแน่นอนให้เก็บสีในตาราง category
function colorsByIdentity(ids: (number | null)[], palette: readonly string[]): string[] {
  const used = new Set<number>();
  return ids.map((id) => {
    let i = (((id ?? 0) % palette.length) + palette.length) % palette.length;
    for (let tries = 0; tries < palette.length && used.has(i); tries++) i = (i + 1) % palette.length;
    used.add(i);
    return palette[i]!;
  });
}

// จอสัมผัส (hover: none) ไม่มี hover ให้เห็น tooltip ก่อนกด — แตะแรกแค่โชว์ tooltip, แตะซ้ำจุดเดิมภายใน 4 วินาทีจึงไปหน้ารายการ
// (เกินนั้นนับเป็นแตะแรกใหม่) เมาส์/คีย์บอร์ดยังไปทันทีเหมือนเดิม key ต้องไม่ซ้ำข้ามกราฟ (ใส่ชื่อกราฟนำหน้า)
// ไม่ยกเลิกตอน tooltip ปิด: บนจอสัมผัส x-charts ปิด tooltip ตอนยกนิ้ว (pointerleave หลัง pointerup) ซึ่งมาก่อน click
// ถ้ายกเลิกตรงนั้น แตะที่สองจะกลายเป็นแตะแรกเสมอและไม่มีทางไปหน้ารายการได้
const TAP_ARM_MS = 4000;
function useTapToNavigate() {
  const touch = useMediaQuery('(hover: none)', { noSsr: true });
  const armed = useRef<{ key: string; at: number } | null>(null);
  return (key: string, go: () => void) => {
    const a = armed.current;
    if (touch && (a?.key !== key || Date.now() - a.at > TAP_ARM_MS)) {
      armed.current = { key, at: Date.now() };
      return;
    }
    armed.current = null;
    go();
  };
}

// คู่กับ useTapToNavigate: tooltip บนจอสัมผัสบอกว่าแตะซ้ำจะเปิดรายการ — tooltip ของ x-charts render ใน DOM ของกราฟ
// (container = layer ของกราฟเอง) sx ของกราฟจึงไปถึง paper ของมัน
const tapHintSx = {
  '@media (hover: none)': {
    '& .MuiChartsTooltip-paper::after': { content: '"แตะอีกครั้งเพื่อเปิดรายการ"', display: 'block', px: 1.5, pb: 1, fontSize: '0.75rem', color: 'text.secondary' },
  },
} as const;

// สี chart ของธีมบางสีแทบเท่าพื้นการ์ด (สว่าง chart-3 1.10, มืด chart-5 1.07 — DESIGN.md Contrast) จึงไม่เปลี่ยนสี แต่ใส่ขอบ
// muted-foreground ให้ชิ้น/จุด (บน card สว่าง 4.88 / มืด 6.75 ผ่าน 3:1) และช่องสีใน legend/tooltip (svg 13×13 ตัดขอบครึ่งนอกทิ้ง
// เส้น 3 จึงเหลือเห็น 1.5 เท่าชิ้น) — selector ชิ้นของพาย ต้องเว้น focusIndicator (ใช้ class arc ร่วม) ไม่งั้นวง focus หนา 3 ถูกทับ
function chartOutlineSx(itemSelector: string, stroke: string) {
  return {
    [itemSelector]: { stroke, strokeWidth: 1.5 },
    '& rect.MuiChartsLabelMark-fill': { stroke, strokeWidth: 3 },
  };
}

const compactNumber = new Intl.NumberFormat('th-TH', { notation: 'compact' });
const sectionHeadingSx = { fontSize: '1.25rem', mb: 1.5 } as const;

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // ?month= ที่พิมพ์ไม่ครบ/ผิดรูปแบบไม่ยิง request — ใช้เดือนปัจจุบันแทน (ไม่ replace URL ทิ้ง ค่าที่คำนวณได้คือสิ่งที่ใช้จริง)
  const month = validMonth(searchParams.get('month'), currentMonth()) ?? currentMonth();
  const setMonth = (m: string) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('month', m); return next; });

  const { from } = monthsBack(month, 6);
  const { to } = monthsBack(month, 1);
  const [summaryLoad, retrySummary] = useLoad<ReportSummary>(`/api/reports/summary?month=${month}`);
  const [breakdownLoad, retryBreakdown] = useLoad<CategoryBreakdown>(`/api/reports/category-breakdown?month=${month}`);
  const [cashFlowLoad, retryCashFlow] = useLoad<CashFlow>(`/api/reports/cash-flow?from=${from}&to=${to}`);
  const [balancesLoad, retryBalances] = useLoad<AccountBalances>(`/api/reports/account-balances?month=${month}`);
  // ความสดของข้อมูลไม่ผูกกับเดือน — url คงที่ จึงโหลดครั้งเดียว ไม่กระพริบตอนเปลี่ยนเดือน
  const [coverageLoad, retryCoverage] = useLoad<{ rows: AccountCoverage[] }>('/api/reports/data-coverage');
  // การ์ดวางแผนอ่านจาก endpoint เดียวกับหน้า /planning เพื่อไม่ให้ตัวเลขสองที่คำนวณคนละสูตร
  const [planLoad, retryPlan] = useLoad<MonthlyPlan>(`/api/monthly-plans/${month}`);
  const summary = dataOf(summaryLoad);
  const breakdown = dataOf(breakdownLoad);
  const cashFlow = dataOf(cashFlowLoad);
  const balances = dataOf(balancesLoad);
  const coverage = dataOf(coverageLoad)?.rows ?? null;
  const plan = dataOf(planLoad);

  // กราฟ SVG ต้องใช้ค่าสีจริง ไม่ใช่ CSS var — เลือกชุด token ตามธีมที่แสดงอยู่ (colorScheme = ค่าที่ resolve โหมด "ตามเครื่อง" แล้ว)
  const { colorScheme } = useColorScheme();
  const chartTokens = tokens[colorScheme === 'dark' ? 'dark' : 'light'];
  const categoryPalette = chartTokens.categoryPalette;
  // จอแคบ (การ์ดกราฟกว้าง ~256px ที่ 320px) legend ด้านขวาบีบวงกลมจนเล็ก — ย้ายไปไว้ล่าง
  const narrow = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'), { noSsr: true });

  // วันที่ข้อมูลล่าสุด = latest_txn_date ที่ใหม่สุดข้ามทุกบัญชี — บอกว่าเดือนที่เลือก "ยังไม่มี statement" หรือ "ยอด 0 จริง"
  const latestDate = coverage?.reduce<string | null>((max, a) => (a.latest_txn_date && (max == null || a.latest_txn_date > max) ? a.latest_txn_date : max), null) ?? null;
  const latestMonth = latestDate?.slice(0, 7) ?? null;
  // เดือนที่ statement ยังไม่มา: การ์ดเงินจริงเป็น "—" เส้นประ แทน ฿0.00 ที่อ่านเหมือนไม่มีเงินเข้าออกจริง
  // (ยอดคงเหลือรวมยังแสดงได้ — เป็นยอดล่าสุดที่รู้ บอกวันที่กำกับไว้)
  const pendingReason = coverage == null ? null
    : latestMonth == null ? 'ยังไม่มี statement ในระบบ'
    : latestMonth < month ? 'รอ statement ของเดือนนี้'
    : null;
  // รอ coverage ด้วย ไม่งั้นการ์ดแวบเป็น ฿0.00 ก่อนเปลี่ยนเป็นเส้นประ
  const moneyLoading = !summary || coverageLoad.status === 'loading';
  const tapToNavigate = useTapToNavigate();

  // ทุกการ์ด/กราฟคำนวณจาก EXCLUDED_FROM_FLOW_SQL (ตัดโอนภายในออกแล้ว) ยกเว้นการ์ดโอนภายในเอง — ต้องส่ง
  // is_internal_transfer=false เป็นค่าตั้งต้นเสมอ ไม่งั้น list ปลายทางรวมโอนภายในที่การ์ดตัดออกไปแล้ว ตัวเลข
  // จะไม่ตรงกัน (ผู้ใช้กด "เงินเข้า" แล้วเจอยอดในตารางมากกว่าที่การ์ดบอก) การ์ดที่ต้องการเห็นโอนภายในส่ง
  // is_internal_transfer: 'true' มาทับค่าตั้งต้นนี้ได้ตามปกติ
  const txnLink = (params: Record<string, string>) =>
    `/transactions?${new URLSearchParams({ month, is_internal_transfer: 'false', ...params }).toString()}`;

  const parseFailed = summary?.statement_health.find((s) => s.status === 'parse_failed')?.n ?? 0;
  const checksumFailed = summary?.statement_health.find((s) => s.status === 'checksum_failed')?.n ?? 0;
  const overdue = plan?.payment_status.overdue_count ?? 0;
  const behindCount = coverage?.filter((a) => a.statement_behind).length ?? 0;

  // แถบ "ต้องจัดการ": เฉพาะเรื่องที่ > 0 เป็นลิงก์ไปที่แก้ได้ ไม่มีเรื่องเลย = ไม่แสดงทั้งแถบ
  // นับเมื่อทั้งสามแหล่งโหลดเสร็จ (ที่ล้มเหลวข้ามไป ส่วนของมันแสดง LoadError เอง) — ระหว่างเปลี่ยนเดือนถ้ารอบก่อนมีแถบ
  // จอง skeleton สูงเท่าปุ่มไว้ เนื้อหาด้านล่างจะไม่กระโดดขึ้นแล้วลง
  const issuesReady = summaryLoad.status !== 'loading' && planLoad.status !== 'loading' && coverageLoad.status !== 'loading';
  const issues = issuesReady
    ? [
        { label: 'บิลเกินกำหนด', n: overdue, to: `/planning?month=${month}` },
        { label: 'statement ที่มีปัญหา', n: parseFailed + checksumFailed, to: '#statement-failures' },
        { label: 'บัญชีข้อมูลช้า', n: behindCount, to: '#data-freshness' },
        { label: 'ยังไม่จัดหมวด', n: summary?.uncategorised_count ?? 0, to: txnLink({ uncategorised: '1' }) },
        { label: 'ยังไม่ตรวจสอบ', n: summary?.unreviewed_count ?? 0, to: txnLink({ review_status: 'unreviewed' }) },
      ].filter((i) => i.n > 0)
    : [];
  const hadIssues = useRef(false);
  if (issuesReady) hadIssues.current = issues.length > 0;

  // กราฟว่างเพราะ statement ยังไม่มา ใช้ข้อความเดียวกับบรรทัดสถานะด้านบน แทน "ยังไม่มีข้อมูล" กลาง ๆ
  const pendingMessage = (fromMonth: string): string | undefined => {
    if (coverage == null) return undefined;
    if (latestMonth == null) return 'ยังไม่มีรายการจาก statement ในระบบ';
    if (latestMonth >= fromMonth) return undefined;
    return fromMonth === month
      ? `statement ${formatMonth(month)} ยังไม่มา`
      : `statement ช่วง ${formatMonth(fromMonth, '2-digit')} – ${formatMonth(month, '2-digit')} ยังไม่มา`;
  };
  const baht = (satang: number) => `฿${formatBaht(satang)}`;
  // เดือนในกราฟ 6 เดือนที่อยู่หลังเดือนข้อมูลล่าสุด = statement ยังไม่มา ไม่ใช่ ฿0 — แท่งเป็น null (ไม่วาด) tooltip/ตารางบอก
  // "ยังไม่มี statement" และบรรทัดช่วงเวลาบอกว่าเดือนไหน (เป็นช่วงท้ายติดกันเสมอ) · coverage ยังไม่มา = ยังไม่ตัดสิน
  const noStatement = (m: string) => coverage != null && latestMonth != null && m > latestMonth;
  const noStatementMonths = cashFlow?.rows.map((r) => r.month).filter(noStatement) ?? [];
  const [firstNo, lastNo] = [noStatementMonths[0], noStatementMonths.at(-1)];
  const noStatementNote = firstNo == null || lastNo == null ? ''
    : ` · ${formatMonth(firstNo, 'none')}${lastNo !== firstNo ? `–${formatMonth(lastNo, 'none')}` : ''} ยังไม่มี statement`;
  const cashValue = (satang: number, month: string) => (noStatement(month) ? null : satang / 100);
  const cashFormatter = (v: number | null) => (v == null ? 'ยังไม่มี statement' : formatBaht(Math.round(v * 100)));
  // ตารางแทนกราฟเส้น: แถว = วันที่, คอลัมน์ = บัญชี (ยอดปิดวันนั้น, "—" = วันนั้นไม่มีรายการ ยอดเท่าวันก่อน)
  let balancesTable: ChartTable | undefined;
  if (balances) {
    const accounts = Array.from(new Map(balances.rows.map((r) => [r.bank_account_id, r.account_nickname])));
    const dates = Array.from(new Set(balances.rows.map((r) => r.txn_date))).sort();
    const at = new Map(balances.rows.map((r) => [`${r.bank_account_id}|${r.txn_date}`, r.running_balance_satang]));
    balancesTable = {
      columns: ['วันที่', ...accounts.map(([, name]) => name)],
      rows: dates.map((d) => [formatDate(d), ...accounts.map(([id]) => { const v = at.get(`${id}|${d}`); return v == null ? '—' : baht(v); })]),
    };
  }

  return (
    <Box>
      <PageHeader
        level={1}
        id="dashboard-heading"
        title="แดชบอร์ด"
        description="ตัวเลขเงินจริงมาจาก statement ของธนาคารที่นำเข้าเท่านั้น ไม่รวมเงินสดและ e-Wallet"
        action={<MonthPicker value={month} onChange={setMonth} keyboardShortcut />}
      />

      {/* ข้อมูลถึงวันไหน — อยู่เหนือการ์ดแรก ไม่งั้น ฿0.00 ของเดือนที่ statement ยังไม่มาอ่านเหมือนไม่มีเงินเข้าออกจริง */}
      <Box sx={{ mt: 1.5 }}>
        {coverageLoad.status === 'loading' && <Skeleton width={180} />}
        {coverage != null && (latestDate == null || latestMonth == null ? (
          // role="status" ไม่ใช่ alert (ค่าเริ่มต้นของ Alert): เป็นสถานะของหน้า ไม่ใช่เหตุด่วนที่ต้องขัดจังหวะ screen reader
          // ปุ่มเป็น primary เพราะเป็นทางออกเดียวของสถานะนี้
          <Alert severity="info" variant="outlined" role="status">
            ยังไม่มีรายการจาก statement ในระบบ — เพิ่มบัญชีหรือสั่งดึงอีเมลที่หน้าบัญชีของฉัน
            <Box sx={{ mt: 1 }}>
              <Button component={Link} to="/accounts" variant="contained" size="small">ไปที่บัญชีของฉัน</Button>
            </Box>
          </Alert>
        ) : latestMonth < month ? (
          <Alert severity="info" variant="outlined" role="status">
            {month === currentMonth() ? 'statement ของเดือนนี้ยังไม่มา' : `statement ของ ${formatMonth(month)} ยังไม่มา`} — ข้อมูลล่าสุดถึง{' '}
            <Box component="span" sx={dataTextSx}>{formatDate(latestDate)}</Box>
            <Box sx={{ mt: 1 }}>
              <Button variant="contained" size="small" onClick={() => setMonth(latestMonth)}>ไปเดือนล่าสุดที่มีข้อมูล</Button>
            </Box>
          </Alert>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <UpdateRounded fontSize="small" aria-hidden />
            ข้อมูลถึง <Box component="span" sx={dataTextSx}>{formatDate(latestDate)}</Box>
          </Typography>
        ))}
      </Box>

      {issues.length > 0 ? (
        <Box role="group" aria-labelledby="dashboard-issues-label" sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Typography id="dashboard-issues-label" variant="body2" sx={{ fontWeight: 600, color: 'warning.main', display: 'inline-flex', alignItems: 'center', gap: 0.5, mr: 0.5 }}>
            <WarningAmberRounded fontSize="small" aria-hidden />
            ต้องจัดการ
          </Typography>
          {issues.map((i) => {
            // span ครอบ: Button เป็น inline-flex ช่องว่างล้วนระหว่างลูก flex ถูกทิ้ง ป้ายกับตัวเลขจะติดกัน
            const label = <span>{i.label} <Box component="span" sx={dataTextSx}>{i.n.toLocaleString('th-TH')}</Box></span>;
            // ส่วนในหน้าเดียวกันเป็น anchor ธรรมดา (router ไม่เลื่อนไปหา #id ให้)
            return i.to.startsWith('#') ? (
              <Button key={i.label} href={i.to} variant="outlined" color="warning" size="small" endIcon={<ChevronRightRounded />}>{label}</Button>
            ) : (
              <Button key={i.label} component={Link} to={i.to} variant="outlined" color="warning" size="small" endIcon={<ChevronRightRounded />}>{label}</Button>
            );
          })}
        </Box>
      ) : !issuesReady && hadIssues.current ? (
        <Skeleton variant="rounded" height={40} sx={{ mt: 1.5 }} />
      ) : null}

      <Stack spacing={4} sx={{ mt: 3 }}>
        <Box component="section" aria-labelledby="actual-heading">
          <Typography variant="h2" id="actual-heading" sx={sectionHeadingSx}>เงินจริงจาก statement</Typography>
          {summaryLoad.status === 'error' ? (
            <LoadError message="โหลดสรุปยอดไม่สำเร็จ" onRetry={retrySummary} />
          ) : (
            <Box sx={summaryRowSx(5)}>
              <SummaryCard
                dense
                loading={moneyLoading}
                disabled={pendingReason != null}
                disabledReason={pendingReason ?? undefined}
                title="เงินเข้า"
                icon={<CallReceivedRounded fontSize="small" />}
                value={summary && <Money satang={summary.money_in_satang} tone="income" />}
                to={txnLink({ direction: 'credit' })}
              />
              <SummaryCard
                dense
                loading={moneyLoading}
                disabled={pendingReason != null}
                disabledReason={pendingReason ?? undefined}
                title="เงินออก"
                icon={<CallMadeRounded fontSize="small" />}
                value={summary && <Money satang={summary.money_out_satang} tone="expense" />}
                to={txnLink({ direction: 'debit' })}
              />
              <SummaryCard
                dense
                loading={moneyLoading}
                disabled={pendingReason != null}
                disabledReason={pendingReason ?? undefined}
                title="เหลือสุทธิ (เข้า − ออก)"
                icon={<TrendingUpRounded fontSize="small" />}
                value={summary && <Money satang={summary.net_satang} tone={summary.net_satang >= 0 ? 'income' : 'expense'} showSign />}
                to={txnLink({})}
              />
              {/* ไม่มีลิงก์โดยตั้งใจ — เป็นยอดรวมข้าม "ทุกบัญชี" ไม่มีตาราง/บัญชีเดียวที่เป็น "รายการต้นทาง"
                  ของยอดรวมนี้ได้จริง (ต่างจากการ์ดอื่นที่ drill ไปยัง transaction ต้นทางเจาะจงได้) */}
              <SummaryCard
                dense
                loading={moneyLoading}
                title="ยอดคงเหลือรวมล่าสุด"
                icon={<AccountBalanceRounded fontSize="small" />}
                value={summary && <Money satang={summary.total_balance_satang} />}
                caption={pendingReason != null && latestDate ? `ณ ${formatDate(latestDate)}` : undefined}
                captionInline
              />
              <SummaryCard
                dense
                loading={moneyLoading}
                disabled={pendingReason != null}
                disabledReason={pendingReason ?? undefined}
                title="โอนภายใน (ไม่นับรายรับ/รายจ่าย)"
                icon={<SwapHorizRounded fontSize="small" />}
                value={summary && <Money satang={summary.internal_transfer_excluded_satang} />}
                caption={summary && `${summary.internal_transfer_count} รายการ (นับทั้งฝั่งโอนออกและโอนเข้า)`}
                to={txnLink({ is_internal_transfer: 'true' })}
              />
            </Box>
          )}
        </Box>

        <Box component="section" aria-labelledby="quality-heading">
          <Typography variant="h2" id="quality-heading" sx={sectionHeadingSx}>คุณภาพข้อมูล</Typography>
          {summaryLoad.status === 'error' ? (
            <LoadError message="โหลดคุณภาพข้อมูลไม่สำเร็จ" onRetry={retrySummary} />
          ) : (
            <>
              <Box sx={summaryRowSx(5)}>
                {/* นับรายการของเดือนที่เลือก: เดือนที่ statement ยังไม่มาใช้เส้นประ + เหตุผลเดียวกับแถวเงินจริง (0 ที่นี่ไม่ได้แปลว่า
                    จัดครบแล้ว) และรอ coverage เหมือนกัน ไม่งั้น 0 แวบก่อนเป็นเส้นประ · 0 = ไม่มีรายการให้ไปดู จึงไม่เป็นลิงก์ */}
                <SummaryCard
                  dense
                  loading={moneyLoading}
                  disabled={pendingReason != null}
                  disabledReason={pendingReason ?? undefined}
                  title="ยังไม่ได้จัดหมวด"
                  icon={<CategoryRounded fontSize="small" />}
                  value={summary && <IssueCount n={summary.uncategorised_count} />}
                  caption="รายการ"
                  to={summary && summary.uncategorised_count > 0 ? txnLink({ uncategorised: '1' }) : undefined}
                />
                <SummaryCard
                  dense
                  loading={moneyLoading}
                  disabled={pendingReason != null}
                  disabledReason={pendingReason ?? undefined}
                  title="ยังไม่ตรวจสอบ"
                  icon={<FactCheckRounded fontSize="small" />}
                  value={summary && <IssueCount n={summary.unreviewed_count} />}
                  caption="รายการ"
                  to={summary && summary.unreviewed_count > 0 ? txnLink({ review_status: 'unreviewed' }) : undefined}
                />
                {/* ทั้งสองใบไปที่รายการไฟล์ด้านล่าง (บอกสาเหตุและทางแก้ทีละไฟล์ เหมือนปุ่มในแถบ "ต้องจัดการ")
                    ศูนย์ = ไม่มีรายการให้ไปดู จึงไม่เป็นลิงก์ · ขอบเขต "นับทุกเดือน" อยู่ที่หัวรายการ ไม่ซ้ำในการ์ด */}
                <SummaryCard
                  dense
                  loading={!summary}
                  title="statement อ่านไฟล์ไม่สำเร็จ"
                  icon={<ErrorOutlineRounded fontSize="small" />}
                  value={summary && <IssueCount n={parseFailed} />}
                  caption="ไฟล์"
                  captionInline
                  to={parseFailed > 0 ? '#statement-failures' : undefined}
                />
                <SummaryCard
                  dense
                  loading={!summary}
                  title="statement ยอดรวมไม่ตรง"
                  icon={<ErrorOutlineRounded fontSize="small" />}
                  value={summary && <IssueCount n={checksumFailed} />}
                  caption="ไฟล์"
                  captionInline
                  to={checksumFailed > 0 ? '#statement-failures' : undefined}
                />
                <SummaryCard
                  dense
                  loading={coverageLoad.status === 'loading'}
                  disabled={coverageLoad.status === 'error'}
                  disabledReason="โหลดไม่สำเร็จ — ลองใหม่ที่ด้านล่าง"
                  title="บัญชีข้อมูลช้า"
                  icon={<EventBusyRounded fontSize="small" />}
                  value={coverage && <IssueCount n={behindCount} />}
                  caption="ดูรายละเอียดด้านล่าง"
                  // เป็นลิงก์แม้นับได้ 0: รายการด้านล่างมีให้ดูเสมอ (ทุกบัญชี รวมบัญชีที่ "รอ statement" ซึ่งไม่นับว่าช้า)
                  to="#data-freshness"
                />
              </Box>
              {summary && summary.failed_statements.length > 0 && (
                // warning ให้ตรงกับการ์ดตัวนับด้านบน — แต่ละแถวบอกสาเหตุเป็นภาษาคน และมีปุ่มเฉพาะแถวที่ผู้ใช้แก้เองได้
                // เป็น section ที่มีชื่อ ไม่ใช่ role="alert" (ค่าเริ่มต้นของ Alert) — รายการคงที่ ไม่ใช่เหตุด่วนให้ screen reader ขัดจังหวะ
                <Alert
                  id="statement-failures"
                  component="section"
                  role="region"
                  aria-labelledby="statement-failures-heading"
                  severity="warning"
                  variant="outlined"
                  // หลายบรรทัด: ไอคอนอยู่แนวหัวข้อ ไม่ลอยกลางกล่อง (theme ตั้ง Alert ให้จัดกลางสำหรับข้อความบรรทัดเดียว)
                  sx={{ mt: 2, scrollMarginTop: 80, alignItems: 'flex-start' }}
                >
                  <Typography component="h3" variant="h2" id="statement-failures-heading" sx={{ fontSize: '1rem', lineHeight: 1.5, mb: 1 }}>
                    statement ที่มีปัญหา — นับทุกเดือน ไม่ผูกกับเดือนที่เลือก
                  </Typography>
                  <Stack spacing={1}>
                    {summary.failed_statements.slice(0, 5).map((s) => {
                      const info = failureInfo(s);
                      return (
                        <Stack key={s.id} direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 1.5 }} sx={{ alignItems: { sm: 'center' } }}>
                          {/* เลขไฟล์นำหน้า: สองไฟล์ของบัญชีเดียวกันที่มาพร้อมกัน (เหตุผลเดียวกัน) แยกกันได้ด้วยเลขนี้ */}
                          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                            <Box component="span" sx={{ ...dataTextSx, fontWeight: 600 }}>ไฟล์ #{s.id}</Box>
                            {' · '}{s.account_nickname} · {info.text} · รับเมื่อ <Box component="span" sx={dataTextSx}>{formatDateTime(s.created_at)}</Box>
                          </Typography>
                          {info.selfFix && (
                            <Button component={Link} to="/accounts" variant="outlined" color="inherit" size="small" sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}>
                              ตั้งรหัสผ่าน PDF ใหม่
                            </Button>
                          )}
                        </Stack>
                      );
                    })}
                    {summary.failed_statements.length > 5 && (
                      <Typography variant="body2">และอีก {summary.failed_statements.length - 5} ไฟล์</Typography>
                    )}
                  </Stack>
                </Alert>
              )}
            </>
          )}
        </Box>

        <Box component="section" aria-labelledby="dashboard-planning-heading">
          <Typography variant="h2" id="dashboard-planning-heading" sx={sectionHeadingSx}>การวางแผนรายเดือน</Typography>
          {planLoad.status === 'error' ? (
            <LoadError message="โหลดแผนรายเดือนไม่สำเร็จ" onRetry={retryPlan} />
          ) : (
            <Box sx={summaryRowSx(2)}>
              {/* dense เหมือนแถวเงินจริง: ตัวเลขแผนต้องไม่ใหญ่กว่าเงินจริงทุกขนาดจอ (แถวแรกคือเรื่องหลักของหน้า) */}
              <SummaryCard
                dense
                loading={!plan}
                title="เงินเหลือใช้ตามแผน"
                icon={<EventRepeatRounded fontSize="small" />}
                value={plan && <Money satang={plan.totals.planned_available_satang} tone={plan.totals.planned_available_satang < 0 ? 'expense' : 'income'} showSign={plan.totals.planned_available_satang < 0} />}
                caption="รายได้เต็ม − รายการหัก − รายจ่ายตามแผน − เงินกันไว้"
                // GET /monthly-plans/:month สร้างแถวแผนให้เองแบบ lazy เพราะฉะนั้น plan ไม่เคยเป็น null
                // สำหรับเดือนที่เปิดดูได้ — เช็ค items.length ด้วย ไม่งั้นเดือนที่ไม่มีแผนเลยจะโชว์ ฿0.00
                // ซึ่งแยกไม่ออกจาก "วางแผนไว้พอดีเป็นศูนย์" (การ์ดข้าง ๆ เช็ค total_count === 0 อยู่แล้ว)
                disabled={plan != null && plan.items.length === 0}
                disabledReason="ยังไม่มีแผนของเดือนนี้"
                to={`/planning?month=${month}`}
              />
              <SummaryCard
                dense
                loading={!plan}
                title="สถานะการจ่ายบิล"
                icon={<PaidRounded fontSize="small" />}
                value={
                  plan && (
                    <>
                      {plan.payment_status.paid_count}
                      <Box component="span" sx={{ color: 'text.secondary', fontSize: '1rem' }}>
                        {` / ${plan.payment_status.total_count} รายการ`}
                      </Box>
                    </>
                  )
                }
                caption={
                  plan && (
                    <>
                      {/* เกินกำหนดคือเรื่องที่ต้องทำก่อน — แยกบรรทัด สี warning + ไอคอน ไม่ซ่อนในบรรทัดเล็ก
                          unpaid_count ไม่รวม overdue (PAYMENT_STATE_SQL: ยังไม่จ่ายและยังไม่เลย/ไม่มีวันครบกำหนด) — ชื่อสถานะคง
                          "ยังไม่จ่าย" ตรงกับหน้าวางแผน แต่ถ้ามีที่เกินกำหนดต้องบอกว่าไม่รวม ไม่งั้นอ่านเหมือนเกินกำหนดเป็นส่วนหนึ่งของมัน */}
                      {overdue > 0 && (
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main', fontWeight: 600, mb: 0.25 }}>
                          <WarningAmberRounded fontSize="small" aria-hidden />
                          เกินกำหนด {overdue} รายการ
                        </Box>
                      )}
                      {`${overdue === 0 ? 'ไม่มีรายการเกินกำหนด · ' : ''}จ่ายบางส่วน ${plan.payment_status.partial_count} · ยังไม่จ่าย${overdue > 0 ? ' (ไม่รวมที่เกินกำหนด)' : ''} ${plan.payment_status.unpaid_count}`}
                    </>
                  )
                }
                disabled={plan != null && plan.payment_status.total_count === 0}
                disabledReason="ยังไม่มีรายการที่ต้องจ่ายในเดือนนี้"
                to={`/planning?month=${month}`}
              />
            </Box>
          )}
        </Box>

        <Box component="section" aria-labelledby="charts-heading">
          <Typography variant="h2" id="charts-heading" sx={sectionHeadingSx}>แนวโน้ม</Typography>
          {/* min(100%, 320px): ที่ 320px จอเหลือ 288px — minmax(320px) เฉย ๆ ดันการ์ดล้นจอ */}
          {/* alignItems start: การ์ดที่ว่าง (กล่องเตี้ย) ไม่ถูกยืดสูงตามกราฟใบข้าง ๆ */}
          <Box sx={{ display: 'grid', gap: 2, alignItems: 'start', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
            <ChartCard
              title="รายรับเทียบรายจ่ายรายเดือน"
              period={`6 เดือนล่าสุด: ${formatMonth(from.slice(0, 7), '2-digit')} – ${formatMonth(month, '2-digit')}${noStatementNote}`}
              loading={cashFlowLoad.status === 'loading'}
              error={cashFlowLoad.status === 'error'}
              onRetry={retryCashFlow}
              empty={cashFlow != null && cashFlow.rows.every((r) => r.money_in_satang === 0 && r.money_out_satang === 0)}
              emptyMessage={pendingMessage(from.slice(0, 7))}
              table={cashFlow ? {
                columns: ['เดือน', 'รายรับ', 'รายจ่าย'],
                rows: cashFlow.rows.map((r) => (noStatement(r.month)
                  ? [formatMonth(r.month), 'ยังไม่มี statement', 'ยังไม่มี statement']
                  : [formatMonth(r.month), baht(r.money_in_satang), baht(r.money_out_satang)])),
              } : undefined}
            >
              {cashFlow && (
                <BarChart
                  height={280}
                  experimentalFeatures={{ keyboardActivation: true }}
                  xAxis={[{
                    scaleType: 'band',
                    // ค่าเริ่มต้น 25px เหลือที่ให้ป้าย 25 − ขีด 6 − ช่อง 3 = 16px แต่กล่องตัวอักษรไทย (Noto Sans Thai/Poppins
                    // ที่ 12px) สูง ~18px x-charts จึงตัดป้ายทิ้งเหลือ <text> ว่าง — 32px เหลือ 23px
                    height: 32,
                    data: cashFlow.rows.map((r) => r.month),
                    // ป้ายแกนเป็นเดือนล้วน ("ต.ค.") ครบทั้ง 6 เดือน — ปีอยู่ในบรรทัดช่วงเวลาของการ์ดแล้ว ป้ายมีปี ("ต.ค. 69")
                    // กว้างจน x-charts ซ่อนป้ายเว้นเดือน แถบละ ~33px ที่จอ 320px / ~42px ที่ 375px / ~45px ที่ 1280px ป้ายเดือนล้วน ~25px
                    tickLabelInterval: () => true,
                    valueFormatter: (m: string, ctx) => formatMonth(m, ctx.location === 'tick' ? 'none' : 'numeric'),
                  }]}
                  yAxis={[{ width: 56, valueFormatter: (v: number) => compactNumber.format(v) }]}
                  series={[
                    { id: 'income', label: 'รายรับ', data: cashFlow.rows.map((r) => cashValue(r.money_in_satang, r.month)), color: chartTokens.income, valueFormatter: cashFormatter },
                    { id: 'expense', label: 'รายจ่าย', data: cashFlow.rows.map((r) => cashValue(r.money_out_satang, r.month)), color: chartTokens.expense, valueFormatter: cashFormatter },
                  ]}
                  // income/expense ธีมสว่างต่างกันแค่ hue (ความสว่างแทบเท่ากัน 1.01:1) — แท่งรายจ่ายจึงเป็นสีอ่อน + ขอบทึบ
                  // ทั้งแท่งและช่องสีใน legend (ทั้งสองอยู่ใต้ [data-series="expense"]) แยกออกได้แม้ไม่เห็นสี ใช้ได้ทั้งสองโหมด
                  // ขอบใช้สี expense เต็ม (บน card 4.81 สว่าง / 4.63 มืด) ขอบแท่งจึงยังผ่าน 3:1
                  // ช่องสีใน legend เป็น svg 13×13 ที่ตัดขอบครึ่งนอกทิ้ง จึงใช้เส้นหนา 3 ให้เหลือเห็น 1.5 เท่าแท่ง
                  sx={{
                    ...tapHintSx,
                    '& [data-series="expense"] .MuiBarChart-element': { fillOpacity: 0.35, stroke: chartTokens.expense, strokeWidth: 1.5 },
                    '& [data-series="expense"] .MuiChartsLabelMark-fill': { fillOpacity: 0.35, stroke: chartTokens.expense, strokeWidth: 3 },
                  }}
                  onItemClick={(_event, item) => {
                    const row = cashFlow.rows[item.dataIndex];
                    if (row) tapToNavigate(`bar:${item.seriesId}:${item.dataIndex}`, () => navigate(`/transactions?${new URLSearchParams({ month: row.month, is_internal_transfer: 'false', direction: item.seriesId === 'income' ? 'credit' : 'debit' }).toString()}`));
                  }}
                  slotProps={{ legend: { direction: 'horizontal', position: { vertical: 'top', horizontal: 'end' } } }}
                />
              )}
            </ChartCard>

            <ChartCard
              title="ค่าใช้จ่ายแยกตามหมวด"
              period={formatMonth(month)}
              loading={breakdownLoad.status === 'loading'}
              error={breakdownLoad.status === 'error'}
              onRetry={retryBreakdown}
              empty={breakdown != null && breakdown.rows.length === 0}
              emptyMessage={pendingMessage(month)}
              table={breakdown ? { columns: ['หมวด', 'ยอดจ่าย'], rows: breakdown.rows.map((r) => [r.category_name, baht(r.total_satang)]) } : undefined}
            >
              {breakdown && (() => {
                const colors = colorsByIdentity(breakdown.rows.map((r) => r.category_id), categoryPalette);
                return (
                  <PieChart
                    height={280}
                    experimentalFeatures={{ keyboardActivation: true }}
                    series={[{
                      data: breakdown.rows.map((r, i) => ({
                        id: r.category_id ?? -1,
                        label: r.category_name,
                        value: r.total_satang / 100,
                        color: colors[i],
                      })),
                      valueFormatter: (item: { value: number }) => formatBaht(Math.round(item.value * 100)),
                      innerRadius: 40,
                    }]}
                    sx={{ ...tapHintSx, ...chartOutlineSx('& .MuiPieChart-arc:not(.MuiPieChart-focusIndicator)', chartTokens.mutedForeground) }}
                    onItemClick={(_event, item) => {
                      const row = breakdown.rows[item.dataIndex];
                      if (!row) return;
                      tapToNavigate(`pie:${item.dataIndex}`, () => navigate(txnLink(row.category_id == null ? { direction: 'debit', uncategorised: '1' } : { direction: 'debit', category_id: String(row.category_id) })));
                    }}
                    slotProps={{
                      legend: narrow
                        ? { direction: 'horizontal', position: { vertical: 'bottom', horizontal: 'center' } }
                        : { direction: 'vertical', position: { vertical: 'middle', horizontal: 'end' } },
                    }}
                  />
                );
              })()}
            </ChartCard>

            <ChartCard
              title="แนวโน้มยอดคงเหลือตามบัญชี"
              period={formatMonth(month)}
              loading={balancesLoad.status === 'loading'}
              error={balancesLoad.status === 'error'}
              onRetry={retryBalances}
              empty={balances != null && balances.rows.length === 0}
              emptyMessage={pendingMessage(month)}
              table={balancesTable}
            >
              {balances && (() => {
                // ทุกบัญชีเรียงบน x-axis วันที่ร่วมกันชุดเดียว — วันที่บัญชีหนึ่งไม่มี txn ค่าเป็น null
                // (ไม่ใช่ "ไม่มีข้อมูล" แต่ "ยอดไม่เปลี่ยนวันนั้น") connectNulls ลากเส้นทับช่องว่างนั้นให้ถูกต้อง
                const dates = Array.from(new Set(balances.rows.map((r) => r.txn_date))).sort();
                const accountIds = Array.from(new Set(balances.rows.map((r) => r.bank_account_id)));
                const seriesColor = (i: number) => categoryPalette[i % categoryPalette.length]!;
                return (
                  <LineChart
                    height={280}
                    experimentalFeatures={{ keyboardActivation: true }}
                    xAxis={[{
                      scaleType: 'point',
                      height: 32, // เหตุผลเดียวกับกราฟแท่ง: ป้ายวันที่ภาษาไทยสูงเกิน 16px ที่ค่าเริ่มต้นเหลือให้
                      data: dates,
                      valueFormatter: (d: string, ctx) => (ctx.location === 'tick' ? formatDayMonth(d) : formatDate(d)),
                    }]}
                    yAxis={[{ width: 56, valueFormatter: (v: number) => compactNumber.format(v) }]}
                    series={accountIds.map((id, i) => {
                      const nickname = balances.rows.find((r) => r.bank_account_id === id)?.account_nickname ?? '';
                      const byDate = new Map(balances.rows.filter((r) => r.bank_account_id === id).map((r) => [r.txn_date, r.running_balance_satang / 100]));
                      return {
                        id: String(id),
                        label: nickname,
                        data: dates.map((d) => byDate.get(d) ?? null),
                        color: seriesColor(i),
                        valueFormatter: (v: number | null) => (v == null ? '' : formatBaht(Math.round(v * 100))),
                        connectNulls: true,
                        // x-charts 9 ไม่วาดจุดถ้าไม่สั่ง — ไม่มีจุด onMarkClick ก็ไม่มีวันถูกเรียก (คลิก/Enter บนเส้นไม่เจาะดูรายการ)
                        showMark: true,
                      };
                    })}
                    // จุดเป็นวงสีของบัญชี + ขอบ chart outline — เส้นสีที่จมหายบนการ์ด (มืด chart-5) ยังเห็นได้จากจุดของมัน
                    sx={{
                      ...tapHintSx,
                      ...chartOutlineSx('& .MuiLineChart-mark', chartTokens.mutedForeground),
                      ...Object.fromEntries(accountIds.map((id, i) => [`& [data-series="${id}"] .MuiLineChart-mark`, { fill: seriesColor(i) }])),
                    }}
                    onMarkClick={(_event, item) => tapToNavigate(`line:${item.seriesId}:${item.dataIndex ?? ''}`, () => navigate(txnLink({ bank_account_id: String(item.seriesId) })))}
                    slotProps={{ legend: { direction: 'horizontal', position: { vertical: 'top', horizontal: 'end' } } }}
                  />
                );
              })()}
            </ChartCard>
          </Box>
        </Box>

        {/* เป้าของการ์ด "บัญชีข้อมูลช้า" — scrollMarginTop กัน app bar แบบ sticky บังหัวข้อ */}
        <Box id="data-freshness" sx={{ scrollMarginTop: 80 }}>
          {coverageLoad.status === 'error' ? (
            <LoadError message="โหลดความสดของข้อมูลแต่ละบัญชีไม่สำเร็จ" onRetry={retryCoverage} />
          ) : (
            coverage && <DataFreshness accounts={coverage} />
          )}
        </Box>
      </Stack>
    </Box>
  );
}
