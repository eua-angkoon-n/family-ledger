import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Checkbox, Chip, FormControlLabel, FormGroup, LinearProgress, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import CalculateRounded from '@mui/icons-material/CalculateRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import BookmarkAddRounded from '@mui/icons-material/BookmarkAddRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import PrintRounded from '@mui/icons-material/PrintRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import { post, req, type Account, type TaxCalculationSnapshot, type TaxEntity, type TaxSummary as TaxSummaryResponse } from '../api.js';
import DeductionClaimSection, { deductionLabel } from '../components/DeductionClaimSection.js';
import IncomeQuickAddModal from '../components/IncomeQuickAddModal.js';
import Money from '../components/Money.js';
import SummaryCard, { summaryRowSx } from '../components/SummaryCard.js';
import { formatBaht, formatDate, formatDateTime, formatMonth } from '../format.js';
import { taxYearBE, taxYearOptions } from '../components/TaxDocumentMetadataFields.js';
import { TAX_ENTITY_TYPE_LABEL } from '../taxDocumentLabels.js';
import { dataTextSx } from '../theme.js';
import {
  BELOW_MD, Disclosure, EmptyState, FeedbackSnackbar, LoadError, MD_UP, PageHeader, RowIconButton, TableSkeleton,
  useHashTarget, usePrintLightScheme, useStoredOpen, visuallyHiddenSx, type Notice,
} from '../ui.js';

// §16 ข้อ 13 ของแผนต้นฉบับ — ทุกรายงานต้องระบุว่าไม่รวมเงินสดและ e-Wallet · คำเตือนว่าเป็นประมาณการอยู่ประโยคเดียวกัน
// (เดิมกระจายเป็น 4 บรรทัดเหนือคำตอบ) · "ยังไม่ได้ตรวจกับกรมสรรพากร" ตาม TODO ใน src/services/tax-rules.ts
const DESCRIPTION =
  'ภาษีเงินได้บุคคลธรรมดาโดยประมาณ แยกตามผู้เสียภาษี — อัตราและค่าลดหย่อนที่ใช้ยังไม่ได้ตรวจกับกรมสรรพากร ใช้วางแผน ไม่ใช่ยอดยื่นจริง · เงินจากธนาคารนับเฉพาะ statement ที่นำเข้า ไม่รวมเงินสดและ e-Wallet';

// ปีภาษีเก็บและส่ง API เป็น ค.ศ. ทั้งระบบ (src/services/tax-rules.ts) — แสดงเป็น พ.ศ. ทุกที่ด้วย taxYearBE ตัวเดียวกับหน้าเอกสาร
const THIS_YEAR = new Date().getFullYear();
const parseYear = (raw: string | null) => {
  const n = Number(raw);
  return raw != null && Number.isInteger(n) && n >= 2000 && n <= 2200 ? n : THIS_YEAR;
};
// 'th-pit-2025.1' → 2025 · ผู้เสียภาษีที่ไม่ใช่บุคคลธรรมดา ('not-applicable:company') → null
const ruleYear = (version: string): number | null => {
  const m = /(\d{4})/.exec(version);
  return m ? Number(m[1]) : null;
};

// ยอดสุดท้ายบอกเป็นคำเสมอ ไม่ใช้ "+" (ทั้งแอป + = เงินเข้า) — ค่าสัมบูรณ์คู่คำกำกับ (The Money Color Rule)
const payableWord = (satang: number) => (satang > 0 ? 'ต้องชำระเพิ่ม' : satang < 0 ? 'ขอคืนได้' : 'ไม่ต้องชำระเพิ่ม');
const payableMoney = (satang: number) => <Money satang={Math.abs(satang)} tone={satang > 0 ? 'expense' : 'income'} />;

// ขั้นบันไดเป็นบาทเต็มเสมอ — ช่วงแบบตารางกรมสรรพากร "฿150,001 – ฿300,000" (มี ฿ เหมือนเงินทุกช่องในตาราง)
const wholeBaht = (satang: number) => `฿${formatBaht(satang).replace(/\.00$/, '')}`;
const bracketRange = (lower: number, upper: number | null) => {
  const from = lower === 0 ? '฿0' : wholeBaht(lower + 100);
  return upper == null ? `${from} ขึ้นไป` : `${from} – ${wholeBaht(upper)}`;
};

// "—" ล้วน screen reader อ่านเป็น "ขีด" หรือข้าม (เหมือน SummaryCard)
const noValue = (spoken: string) => (
  <>
    <span aria-hidden>—</span>
    <Box component="span" sx={visuallyHiddenSx}>{spoken}</Box>
  </>
);

// ชื่อรายได้ที่บันทึกจากเงินเข้ามีเลขอ้างอิงยาวของธนาคารติดมา ("… Ref 2026010112345") — ตัดออกเฉพาะที่แสดง ชื่อเต็มอยู่ใน title
const shortIncomeName = (name: string) => name.replace(/\s*\bRef\b\.?\s*[\w-]+/gi, '').trim() || name;

const CLAMP_2 = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere' } as const;
const CELL_PX = { '& .MuiTableCell-root': { px: { xs: 1, md: 2 } } } as const;
const NO_PRINT = { displayPrint: 'none' } as const;

// พิมพ์ (ปุ่มพิมพ์หรือ Ctrl+P) ตาม The Guide Page Rule: กางทุกส่วนที่พับ ซ่อนปุ่ม/ลูกศร/checkbox (แถบเครื่องมือ กล่องเงินเข้า
// คอลัมน์จัดการ และลูกศรของการ์ดใน SummaryCard ซ่อนด้วย displayPrint ที่ตัวเอง) และ usePrintLightScheme สลับเป็นธีมสว่างชั่วคราว
const PRINT_SX = {
  '@media print': {
    '& .MuiCollapse-root': { height: 'auto !important', visibility: 'visible !important' },
    '& .MuiIconButton-root, & .MuiBadge-badge, & .MuiButton-endIcon, & .MuiLinearProgress-root': { display: 'none' },
  },
} as const;

/** ตัวนับเรื่องที่ต้องตรวจ (The Issue Count Rule): 0 = สีรอง ไม่เป็นลิงก์ · > 0 = warning + ไอคอน และเป็นลิงก์ไปที่แก้ (ถ้ามี) */
function IssueItem({ n, label, to, hint }: { n: number; label: string; to?: string; hint?: string }) {
  // span ครอบ: Button เป็น inline-flex ช่องว่างระหว่างลูก flex ถูกทิ้ง ป้ายกับตัวเลขจะติดกัน
  const text = <span>{label} <Box component="span" sx={dataTextSx}>{n.toLocaleString('th-TH')}</Box></span>;
  return (
    <li>
      {n === 0 ? (
        <Typography color="text.secondary">{text}</Typography>
      ) : to ? (
        <Button component={Link} to={to} variant="outlined" color="warning" startIcon={<WarningAmberRounded aria-hidden />} endIcon={<ChevronRightRounded />} sx={{ textAlign: 'left' }}>
          {text}
        </Button>
      ) : (
        <Typography sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <WarningAmberRounded fontSize="small" aria-hidden />
          {text}
        </Typography>
      )}
      {n > 0 && hint && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{hint}</Typography>}
    </li>
  );
}

// innerRef + tabIndex -1 ที่หัวข้อ = ปลายทางของลิงก์ #id ผ่าน useHashTarget (เลื่อนมาแล้ว focus หัวข้อ) · scrollMarginTop พ้น app bar
function Section({ id, title, innerRef, children }: { id: string; title: string; innerRef?: RefObject<HTMLElement | null>; children: ReactNode }) {
  return (
    <Box component="section" ref={innerRef} aria-labelledby={id} sx={{ mt: 4, scrollMarginTop: 80 }}>
      <Typography variant="h2" id={id} tabIndex={innerRef ? -1 : undefined}>{title}</Typography>
      {children}
    </Box>
  );
}

export default function TaxSummary() {
  const [searchParams, setSearchParams] = useSearchParams();
  const year = parseYear(searchParams.get('year'));
  const taxEntityId = searchParams.get('tax_entity_id') ?? '';
  const setParam = (key: string, value: string) => setSearchParams((p) => { const n = new URLSearchParams(p); n.set(key, value); return n; });

  const [entities, setEntities] = useState<TaxEntity[] | null>(null);
  const [entitiesError, setEntitiesError] = useState(false);
  const [entitiesRevision, setEntitiesRevision] = useState(0);
  const [summary, setSummary] = useState<TaxSummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [snapshots, setSnapshots] = useState<TaxCalculationSnapshot[] | null>(null);
  const [snapshotsError, setSnapshotsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [calculating, setCalculating] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordFailures, setRecordFailures] = useState<string[]>([]);
  const [addIncomeOpen, setAddIncomeOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<{ id: number; month: string } | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [incomeOpen, setIncomeOpen] = useStoredOpen('hyacinthia.tax.incomeOpen');
  const [historyOpen, setHistoryOpen] = useStoredOpen('hyacinthia.tax.historyOpen');
  usePrintLightScheme();

  useEffect(() => {
    let current = true;
    // ใช้แค่ในช่องบัญชีรับเงินของฟอร์ม "เพิ่มรายได้เอง" (ไม่บังคับ) — โหลดไม่ได้ = ช่องว่าง ฟอร์มยังบันทึกได้
    void req<Account[]>('/api/accounts').then((rows) => { if (current) setAccounts(rows); }).catch(() => {});
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    setEntitiesError(false);
    req<TaxEntity[]>('/api/tax-entities')
      .then((rows) => { if (current) setEntities(rows); })
      .catch(() => { if (current) setEntitiesError(true); });
    return () => { current = false; };
  }, [entitiesRevision]);

  const entity = entities?.find((te) => String(te.id) === taxEntityId);
  // URL ไม่มีหรือชี้ผู้เสียภาษีที่ไม่มีแล้ว → รายแรก (replace ไม่เพิ่มประวัติ) · ระหว่างนั้นช่องเลือกเป็นค่าว่าง ไม่ใช่ค่าที่ไม่มีในตัวเลือก
  const fallbackEntityId = entities && !entity && entities.length > 0 ? String(entities[0]!.id) : null;
  useEffect(() => {
    if (fallbackEntityId) setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tax_entity_id', fallbackEntityId); return n; }, { replace: true });
  }, [fallbackEntityId, setSearchParams]);

  const entityKey = entity ? String(entity.id) : '';
  // ตัวเลือกที่ติ๊กไว้และผลบันทึกที่ล้มเหลวเป็นของปี/ผู้เสียภาษีเดิม — เปลี่ยนตัวกรองแล้วล้าง
  useEffect(() => { setSelected([]); setRecordFailures([]); }, [year, entityKey]);

  // สองส่วนจากสอง request แสดงสถานะของตัวเอง (The Section Failure Rule) · เปลี่ยนตัวกรอง/โหลดซ้ำคงข้อมูลเดิมไว้ + aria-busy
  // และแถบโหลดบาง ๆ · ล้มแล้วล้างข้อมูลเดิมทิ้ง ไม่โชว์ตัวเลขของปี/ผู้เสียภาษีก่อนหน้าแบบไม่มีป้าย
  useEffect(() => {
    if (entityKey === '') return;
    let current = true;
    setLoading(true); setSummaryError(false); setSnapshotsError(false);
    const query = `tax_entity_id=${entityKey}`;
    const summaryLoad = req<TaxSummaryResponse>(`/api/tax/${year}/summary?${query}`)
      .then((s) => {
        if (!current) return;
        setSummary(s);
        // รายการที่บันทึกไม่สำเร็จยังถูกเสนออยู่ จึงติ๊กค้างไว้ให้ลองใหม่ — ที่บันทึกแล้วหายจากข้อเสนอ ติ๊กก็หายตาม
        setSelected((prev) => prev.filter((id) => s.unrecorded_income_txns.some((t) => t.id === id)));
      })
      .catch(() => { if (current) { setSummary(null); setSummaryError(true); } });
    const snapshotsLoad = req<{ rows: TaxCalculationSnapshot[] }>(`/api/tax/${year}/snapshots?${query}`)
      .then((r) => { if (current) setSnapshots(r.rows); })
      .catch(() => { if (current) { setSnapshots(null); setSnapshotsError(true); } });
    void Promise.all([summaryLoad, snapshotsLoad]).then(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [year, entityKey, revision]);

  const reload = () => setRevision((n) => n + 1);

  // ระบบเจอเงินเข้าที่น่าจะเป็นรายได้ประจำ แต่ผู้ใช้ต้องติ๊กเองทีละรายการ (ไม่ติ๊กให้ก่อน) — heuristic ผิดได้ และรายได้ซ้ำ/ปลอม
  // ในฐานแก้ยากกว่ากดเพิ่มเอง · ยอดก่อนหัก default = ยอดที่เข้าบัญชีจริง (แก้ทีหลังได้จาก "ที่มาของเงินได้จากงานประจำ")
  // ยิง POST /api/income-records เดิมทีละรายการ — ล้มกี่รายการก็บอกครบทุกรายการ ไม่ใช่แค่ตัวแรก
  const recordSelectedIncome = async () => {
    if (!summary || recording) return;
    const chosen = summary.unrecorded_income_txns.filter((t) => selected.includes(t.id));
    if (chosen.length === 0) return;
    setRecording(true); setRecordFailures([]);
    const failed: { id: number; text: string }[] = [];
    for (const txn of chosen) {
      try {
        await post('/api/income-records', {
          month: txn.txn_date.slice(0, 7),
          name: txn.description.slice(0, 120),
          gross_amount_satang: txn.amount_satang,
          bank_account_id: txn.bank_account_id,
          income_date: txn.txn_date,
          auto_match: true,
          deductions: [],
        });
      } catch (err) {
        failed.push({ id: txn.id, text: `${formatDate(txn.txn_date)} ฿${formatBaht(txn.amount_satang)}: ${err instanceof Error ? err.message : 'ไม่สำเร็จ'}` });
      }
    }
    const saved = chosen.length - failed.length;
    setRecording(false);
    setSelected(failed.map((f) => f.id));
    setRecordFailures(failed.map((f) => f.text));
    setNotice(
      failed.length === 0
        ? { message: `บันทึกเป็นรายได้เต็มแล้ว ${saved} รายการ`, severity: 'success' }
        : { message: `บันทึกไม่สำเร็จ ${failed.length} จาก ${chosen.length} รายการ — รายละเอียดอยู่ในกล่องเงินเข้า`, severity: saved > 0 ? 'warning' : 'error' },
    );
    if (saved > 0) reload();
  };

  const calculate = async () => {
    if (!entity || calculating) return;
    setCalculating(true);
    try {
      await post(`/api/tax/${year}/calculate`, { tax_entity_id: entity.id });
      setNotice({ message: `บันทึกผลประมาณการปี ${taxYearBE(year)} แล้ว — ดูได้ในประวัติการคำนวณ`, severity: 'success' });
      setHistoryOpen(true); // เพิ่มรายการใหม่แล้วกางให้เอง (The Disclosure Section Rule)
      reload();
    } catch (err) {
      setNotice({ message: err instanceof Error ? err.message : 'บันทึกผลไม่สำเร็จ', severity: 'error' });
    } finally {
      setCalculating(false);
    }
  };

  const txnLink = (params: Record<string, string>) => `/transactions?${new URLSearchParams(params).toString()}`;
  const e = summary?.estimate ?? null;
  const rYear = summary ? ruleYear(summary.rule_version) : null;
  // เงินได้สุทธิก่อนปัดเป็น 0 — ลำดับเดียวกับ estimateTax (src/services/tax-calculation.ts)
  const rawNet = e ? e.assessableSatang - e.employmentExpenseSatang - e.personalAllowanceSatang - e.deductionClaimSatang : 0;

  // รายได้ที่วันที่และยอดเท่ากันมากกว่าหนึ่งรายการ — มักเป็นเงินเดือนเดียวกันที่บันทึกซ้ำ (ทำเครื่องหมาย ไม่ตัดสินแทน)
  const records = summary?.employment_income_records ?? [];
  const recordKey = (r: (typeof records)[number]) => `${r.income_date ?? r.month_start}|${r.gross_amount_satang}`;
  const keyCount = new Map<string, number>();
  for (const r of records) keyCount.set(recordKey(r), (keyCount.get(recordKey(r)) ?? 0) + 1);
  const isDuplicate = (r: (typeof records)[number]) => (keyCount.get(recordKey(r)) ?? 0) > 1;
  const duplicateCount = records.filter(isDuplicate).length;

  // ตัวเลขยังไม่ครบเมื่อยังมีเงินที่ไม่ถูกนับ (ธุรกรรมยังไม่ระบุการนับภาษี / รายได้ที่ไม่รู้ว่าเป็นของใคร) — เอกสารที่ยังไม่ตรวจ
  // ไม่เปลี่ยนตัวเลข จึงไม่นับ · ลิงก์ผ่าน router (ได้ location.key ใหม่) useHashTarget จึงเลื่อน+focus ทุกครั้งที่กด
  const incomplete = summary != null && (summary.missing_document.untreated_txn_count > 0 || summary.missing_document.unresolved_income_satang > 0);
  const issuesRef = useRef<HTMLElement>(null);
  useHashTarget('#tax-issues-heading', summary != null, issuesRef, 'tax-issues-heading');

  return (
    <Box sx={PRINT_SX}>
      <PageHeader level={1} id="tax-summary-heading" title="ประมาณการภาษี" description={DESCRIPTION} />
      {/* แถบเครื่องมือไม่พิมพ์ — กระดาษจึงต้องบอกเองว่าเป็นของปีไหน ใคร */}
      {entity && (
        <Typography sx={{ display: 'none', displayPrint: 'block', mt: 1, fontWeight: 600 }}>
          ปีภาษี {taxYearBE(year)} · {entity.display_name}
        </Typography>
      )}

      {entitiesError ? (
        <LoadError message="โหลดรายชื่อผู้เสียภาษีไม่สำเร็จ" onRetry={() => setEntitiesRevision((n) => n + 1)} />
      ) : entities == null ? (
        <TableSkeleton rows={4} />
      ) : entities.length === 0 ? (
        <EmptyState
          headingLevel={2}
          icon={<AccountBalanceRounded sx={{ fontSize: 40 }} />}
          title="ยังไม่มีผู้เสียภาษี"
          description='ประมาณการภาษีคิดแยกตามผู้เสียภาษี — เพิ่มผู้เสียภาษี (เช่นตัวคุณเอง) ที่ส่วน "ผู้เสียภาษี" ในหน้าบัญชีของฉันก่อน'
          action={<Button component={Link} to="/accounts#tax-entities-heading" variant="contained">ไปที่บัญชีของฉัน</Button>}
        />
      ) : (
        <>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            useFlexGap
            sx={{ mt: 3, alignItems: { sm: 'center' }, flexWrap: 'wrap', ...NO_PRINT }}
            data-tour="tax-toolbar"
          >
            <TextField select size="small" label="ปีภาษี" value={year} onChange={(ev) => setParam('year', String(ev.target.value))} sx={{ minWidth: 120 }}>
              {taxYearOptions(String(year)).map((y) => <MenuItem key={y} value={y} sx={dataTextSx}>{taxYearBE(y)}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="ผู้เสียภาษี" value={entity ? taxEntityId : ''} onChange={(ev) => setParam('tax_entity_id', ev.target.value)} sx={{ minWidth: 200 }}>
              {entities.map((te) => <MenuItem key={te.id} value={String(te.id)}>{te.display_name}</MenuItem>)}
            </TextField>
            <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }} />
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {/* ตัวเลขบนจอคำนวณสดทุกครั้งที่โหลด — ปุ่มนี้แค่เก็บผลไว้เทียบ (ไม่ใช่ปุ่มหลักที่ต้องกดก่อนเห็นตัวเลข) */}
              <Button
                variant="outlined"
                startIcon={<BookmarkAddRounded />}
                disabled={!entity}
                aria-disabled={calculating || undefined}
                aria-busy={calculating}
                onClick={() => void calculate()}
              >
                {calculating ? 'กำลังบันทึก…' : 'บันทึกผลไว้เทียบ'}
              </Button>
              <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setAddIncomeOpen(true)}>เพิ่มรายได้เอง</Button>
              <Button component="a" startIcon={<DownloadRounded />} href={entity ? `/api/tax/${year}/export.csv?tax_entity_id=${entityKey}` : undefined} disabled={!entity} download>
                ส่งออก CSV
              </Button>
              <Button startIcon={<PrintRounded />} onClick={() => window.print()}>พิมพ์</Button>
            </Stack>
          </Stack>

          {/* เกณฑ์ที่ใช้คำนวณ — กฎมีเฉพาะบางปี (src/services/tax-rules.ts) ปีที่ไม่มีใช้ปีล่าสุดที่ ≤ ปีที่เลือก (หรือปีแรกสุด) */}
          {summary && (e == null ? (
            <Alert severity="info" variant="outlined" role="status" sx={{ mt: 2 }}>
              ประมาณการภาษีมีเฉพาะผู้เสียภาษีแบบบุคคลธรรมดา — {entity ? TAX_ENTITY_TYPE_LABEL[entity.entity_type] : 'ประเภทนี้'}ใช้ภาษีคนละแบบ
              หน้านี้จึงแสดงเฉพาะยอดสรุปและสิ่งที่ยังต้องตรวจ
            </Alert>
          ) : rYear != null && rYear !== year ? (
            <Alert severity="info" variant="outlined" role="status" sx={{ mt: 2 }}>
              ยังไม่มีเกณฑ์ภาษีของปี {taxYearBE(year)} ในระบบ — คำนวณด้วยเกณฑ์ปี {taxYearBE(rYear)} ({rYear < year ? 'ปีล่าสุด' : 'ปีเก่าสุด'}ที่มี)
              ถ้าอัตราหรือค่าลดหย่อนของปีนี้เปลี่ยน ผลจะคลาดเคลื่อน
            </Alert>
          ) : rYear != null && (
            <Typography variant="body2" color="text.secondary" role="status" sx={{ mt: 1.5 }}>
              คำนวณด้วยเกณฑ์ภาษีปี <Box component="span" sx={dataTextSx}>{taxYearBE(rYear)}</Box>
            </Typography>
          ))}

          {summaryError && <LoadError message="โหลดประมาณการภาษีไม่สำเร็จ" onRetry={reload} />}
          {!summary ? (
            !summaryError && <TableSkeleton rows={4} />
          ) : (
            <Box aria-busy={loading} sx={{ position: 'relative' }}>
              {loading && <LinearProgress aria-label="กำลังโหลดประมาณการ" sx={{ position: 'absolute', top: -8, left: 0, right: 0, height: 2 }} />}

              {/* จำนวนการ์ดต้องตรงกับที่ render จริง: 4 ใบคงที่ + (ประมาณการ 2 ใบ หรือการ์ดปิด 1 ใบ) */}
              {/* หัวการ์ดสั้น — 6 ใบที่ 1280px หัวเหลือที่ราว 110px (คำนวณ ยังไม่ได้วัด) ชื่อเต็มอยู่ใน caption และบล็อกที่มาของเงินได้สุทธิ */}
              <Box sx={{ ...summaryRowSx(e ? 6 : 5), mt: 3 }} data-tour="tax-cards">
                <SummaryCard dense title="เงินเดือน" value={<Money satang={summary.inputs.employmentIncomeSatang} tone="income" />} caption="เงินได้จากงานประจำ (เงินเดือน ค่าจ้าง) — รายได้เต็มก่อนหักที่บันทึกไว้ในปีนี้ ดูทีละรายการได้ที่ส่วนที่มาของเงินได้จากงานประจำ" />
                <SummaryCard
                  dense
                  title="รายได้ธุรกิจ"
                  value={<Money satang={summary.inputs.otherIncomeSatang} tone="income" />}
                  caption="เงินเข้าที่ตั้งการนับภาษีเป็นรายได้ธุรกิจ"
                  to={summary.inputs.otherIncomeSatang !== 0 ? txnLink(summary.drilldown_params.other_income) : undefined}
                />
                <SummaryCard
                  dense
                  title="ค่าใช้จ่ายธุรกิจ"
                  value={<Money satang={summary.inputs.deductibleExpenseSatang} tone="expense" />}
                  caption="เงินออกที่ตั้งการนับภาษีเป็นค่าใช้จ่ายหักภาษีได้"
                  to={summary.inputs.deductibleExpenseSatang !== 0 ? txnLink(summary.drilldown_params.deductible_expense) : undefined}
                />
                <SummaryCard dense title="ค่าลดหย่อน" value={<Money satang={summary.inputs.deductionClaimSatang} />} caption="รวมจากตารางค่าลดหย่อนด้านล่าง ไม่รวมลดหย่อนส่วนตัวที่ระบบหักให้เอง" />
                {e ? (
                  <>
                    <SummaryCard
                      dense
                      title="เงินได้สุทธิ"
                      value={<Money satang={e.netSatang} />}
                      caption="เงินได้ทั้งหมด หักค่าใช้จ่ายงานประจำ ค่าใช้จ่ายธุรกิจ ลดหย่อนส่วนตัว และค่าลดหย่อน — ดูทีละบรรทัดที่ส่วนที่มาของเงินได้สุทธิ"
                    />
                    <SummaryCard
                      dense
                      title="ชำระเพิ่ม/ขอคืน"
                      value={payableMoney(e.estimatedPayableSatang)}
                      captionInline
                      caption={
                        <>
                          {payableWord(e.estimatedPayableSatang)}
                          {/* ยังมีเงินที่ไม่ถูกนับ — คำตอบต้องไม่ดูมั่นใจเกินข้อมูล (warning + ไอคอน + คำ) */}
                          {incomplete && (
                            <Box component="span" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mt: 0.5, color: 'warning.main' }}>
                              <WarningAmberRounded fontSize="small" aria-hidden sx={{ mt: 0.25 }} />
                              <Link to={{ search: searchParams.toString(), hash: '#tax-issues-heading' }} style={{ color: 'inherit' }}>
                                ยังไม่ครบ — ดูสิ่งที่ยังต้องตรวจ
                              </Link>
                            </Box>
                          )}
                        </>
                      }
                    />
                  </>
                ) : (
                  <SummaryCard dense title="ประมาณการภาษี" value="—" disabled disabledReason="มีเฉพาะบุคคลธรรมดา" />
                )}
              </Box>

              {summary.inputs.withholdingCertificateSatang > 0 && (
                summary.inputs.withholdingCertificateSatang !== summary.inputs.withholdingSatang ? (
                  <Alert severity="warning" variant="outlined" role="status" sx={{ mt: 2 }}>
                    ยอดหัก ณ ที่จ่ายตามหนังสือรับรอง <Money satang={summary.inputs.withholdingCertificateSatang} /> ไม่ตรงกับที่หักไว้ในรายได้เต็ม{' '}
                    <Money satang={summary.inputs.withholdingSatang} /> — ประมาณการใช้ยอดในรายได้เต็ม ตรวจรายการหักของรายได้ในส่วนที่มาของเงินได้ด้านล่าง
                  </Alert>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    ยอดหัก ณ ที่จ่ายตามหนังสือรับรอง <Money satang={summary.inputs.withholdingCertificateSatang} /> ตรงกับที่หักไว้ในรายได้เต็ม
                  </Typography>
                )
              )}

              {summary.unrecorded_income_txns.length > 0 && (
                // กล่องรายการพร้อมตัวเลือก = section ที่มีชื่อ ไม่ใช่ role="alert" ของ Alert (The Quiet Notice Rule) · ไม่พิมพ์
                <Alert
                  component="section"
                  role="region"
                  aria-labelledby="tax-suggest-heading"
                  severity="info"
                  variant="outlined"
                  sx={{ mt: 3, alignItems: 'flex-start', ...NO_PRINT }}
                >
                  <Typography component="h2" id="tax-suggest-heading" sx={{ fontWeight: 600 }}>
                    เงินเข้าที่อาจเป็นรายได้ประจำ <Box component="span" sx={dataTextSx}>{summary.unrecorded_income_txns.length}</Box> รายการ
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, maxWidth: '70ch' }}>
                    ยอดใกล้เคียงกันเข้าบัญชีหลายเดือน ถ้าเป็นเงินเดือนที่ยังไม่ได้บันทึกเป็นรายได้เต็ม ติ๊กแล้วกดบันทึก — ใช้ยอดที่เข้าบัญชีเป็นยอดก่อนหัก
                    (ถ้าสลิปมีหักประกันสังคมหรือภาษี ณ ที่จ่าย กดแก้ไขในส่วนที่มาของเงินได้ทีหลัง) รายการที่บันทึกไว้แล้วหรือไม่ใช่รายได้ ไม่ต้องติ๊ก
                    — รายได้ที่บันทึกไว้คนละวันกับวันที่เงินเข้าอาจยังถูกเสนอ ตรวจกับส่วนที่มาของเงินได้ให้ดีก่อนติ๊ก
                  </Typography>
                  <FormGroup aria-label="เลือกเงินเข้าที่จะบันทึกเป็นรายได้เต็ม" sx={{ my: 1 }} role="group">
                    {summary.unrecorded_income_txns.map((txn) => (
                      <FormControlLabel
                        key={txn.id}
                        sx={{ alignItems: 'flex-start', mr: 0 }}
                        control={
                          <Checkbox
                            checked={selected.includes(txn.id)}
                            onChange={(ev) => setSelected((prev) => (ev.target.checked ? [...prev, txn.id] : prev.filter((id) => id !== txn.id)))}
                          />
                        }
                        label={
                          <Box sx={{ pt: 1.125, minWidth: 0 }}>
                            <Typography variant="body2" sx={dataTextSx}>
                              {formatDate(txn.txn_date)} · {txn.account_nickname} · <Money satang={txn.amount_satang} tone="income" />
                            </Typography>
                            <Typography variant="body2" color="text.secondary" title={txn.description} sx={CLAMP_2}>{txn.description}</Typography>
                          </Box>
                        }
                      />
                    ))}
                  </FormGroup>
                  {recordFailures.length > 0 && (
                    <Box sx={{ mb: 1.5, color: 'error.main' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>บันทึกไม่สำเร็จ {recordFailures.length} รายการ (ยังติ๊กค้างไว้ให้ลองใหม่)</Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2.5, typography: 'body2', overflowWrap: 'anywhere' }}>
                        {recordFailures.map((text) => <li key={text}>{text}</li>)}
                      </Box>
                    </Box>
                  )}
                  <Button
                    variant="contained"
                    disabled={selected.length === 0}
                    aria-disabled={recording || undefined}
                    aria-busy={recording}
                    onClick={() => void recordSelectedIncome()}
                  >
                    {recording ? 'กำลังบันทึก…' : `บันทึกเป็นรายได้เต็ม (${selected.length})`}
                  </Button>
                </Alert>
              )}

              {records.length > 0 && (
                <Box sx={{ mt: 4 }}>
                  <Disclosure
                    id="tax-employment-heading"
                    title={`ที่มาของเงินได้จากงานประจำ (${records.length} รายการ)`}
                    open={incomeOpen}
                    onToggle={() => setIncomeOpen(!incomeOpen)}
                    notice={duplicateCount > 0 && (
                      <Typography variant="body2" sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
                        <WarningAmberRounded fontSize="small" aria-hidden />
                        {duplicateCount} รายการมีวันที่และยอดเท่ากับรายการอื่น อาจบันทึกซ้ำ — เงินได้จะนับเกินจริง (ยังลบรายได้เต็มจากหน้าจอไม่ได้ แจ้งผู้ดูแล)
                      </Typography>
                    )}
                  >
                    {/* < md เหลือ รายได้ · รายได้เต็ม · แก้ไข — วันที่และป้ายอาจซ้ำเป็นบรรทัดรอง */}
                    <TableContainer component={Paper} variant="outlined" role="region" aria-label="ตารางที่มาของเงินได้จากงานประจำ">
                      <Table size="small" aria-label="รายได้เต็มที่นับเป็นเงินได้จากงานประจำ" sx={CELL_PX}>
                        <TableHead>
                          <TableRow>
                            <TableCell>รายได้</TableCell>
                            <TableCell align="right">รายได้เต็ม</TableCell>
                            <TableCell align="right" sx={NO_PRINT}>แก้ไข</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {records.map((r) => {
                            const name = shortIncomeName(r.name);
                            const when = r.income_date ? formatDate(r.income_date) : formatMonth(r.month_start.slice(0, 7));
                            return (
                              <TableRow key={r.id} hover>
                                <TableCell sx={{ width: '100%', maxWidth: 0 }}>
                                  <Box title={r.name} sx={CLAMP_2}>{name}</Box>
                                  <Typography variant="body2" color="text.secondary" sx={dataTextSx}>{when}</Typography>
                                  {isDuplicate(r) && (
                                    <Typography variant="body2" sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <WarningAmberRounded fontSize="small" aria-hidden />
                                      อาจบันทึกซ้ำ
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}><Money satang={r.gross_amount_satang} /></TableCell>
                                <TableCell align="right" sx={{ ...NO_PRINT, py: 0.5, verticalAlign: 'top' }}>
                                  <RowIconButton label={`แก้ไข ${name} ${when}`} tooltip="แก้ไข" onClick={() => setEditingIncome({ id: r.id, month: r.month_start.slice(0, 7) })}>
                                    <EditRounded fontSize="small" />
                                  </RowIconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Disclosure>
                </Box>
              )}

              {e && (
                <Section id="tax-net-heading" title="ที่มาของเงินได้สุทธิ">
                  {/* ทุกบรรทัดมาจาก estimate ของ API — อัตรา/เพดานค่าใช้จ่ายงานประจำไม่ได้ส่งมา จึงไม่เขียนตัวเลขกฎหมายเอง */}
                  <TableContainer component={Paper} variant="outlined" role="region" aria-label="ตารางที่มาของเงินได้สุทธิ" sx={{ mt: 1.5 }}>
                    <Table size="small" aria-label="ลำดับการหักจากเงินได้ถึงเงินได้สุทธิ" sx={CELL_PX}>
                      <TableBody>
                        {([
                          ['เงินได้จากงานประจำ', e.employmentIncomeSatang, null],
                          ['รายได้ธุรกิจอื่น', e.otherIncomeSatang, null],
                          ['หักค่าใช้จ่ายงานประจำ', -e.employmentExpenseSatang, `หักแบบเหมาตามอัตราและเพดานของเกณฑ์ภาษีปี${rYear != null ? ` ${taxYearBE(rYear)}` : 'ที่ใช้'} คิดจากเงินได้จากงานประจำเท่านั้น`],
                          ['หักค่าใช้จ่ายธุรกิจ', -e.deductibleExpenseSatang, 'เงินออกที่ตั้งการนับภาษีเป็นค่าใช้จ่ายหักภาษีได้'],
                          ['หักลดหย่อนส่วนตัว', -e.personalAllowanceSatang, 'ระบบหักให้เองตามเกณฑ์ ไม่ต้องเพิ่มในค่าลดหย่อน'],
                          ['หักค่าลดหย่อนที่ยื่น', -e.deductionClaimSatang, 'รวมจากตารางค่าลดหย่อนด้านล่าง'],
                        ] as const).map(([label, satang, hint]) => (
                          <TableRow key={label}>
                            <TableCell>
                              {label}
                              {hint && <Typography variant="body2" color="text.secondary">{hint}</Typography>}
                            </TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}><Money satang={satang} /></TableCell>
                          </TableRow>
                        ))}
                        {/* สูตรเป็น max(0, …) (src/services/tax-calculation.ts) — ติดลบแล้วบรรทัดบนรวมไม่เท่ายอดสุทธิ จึงบอกตรง ๆ */}
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>
                            เงินได้สุทธิ
                            {rawNet < 0 && (
                              <Typography variant="body2" color="text.secondary">
                                รวมแล้วติดลบ <Money satang={rawNet} /> จึงนับเป็น 0
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}><Money satang={e.netSatang} /></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Section>
              )}

              {e && (
                <Section id="tax-brackets-heading" title="ขั้นบันไดภาษี">
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                    เงินได้สุทธิ <Money satang={e.netSatang} /> แบ่งเสียภาษีตามขั้น — แสดงทุกขั้นที่มีเงินได้ตกอยู่
                  </Typography>
                  {/* < md เหลือ ช่วงเงินได้ · อัตรา · ภาษีในขั้น — เงินได้ในขั้นเป็นบรรทัดรอง */}
                  <TableContainer component={Paper} variant="outlined" role="region" aria-label="ตารางขั้นบันไดภาษี">
                    <Table size="small" aria-label="ภาษีแยกตามขั้นบันไดของเงินได้สุทธิ" sx={CELL_PX}>
                      <TableHead>
                        <TableRow>
                          <TableCell>ช่วงเงินได้สุทธิ</TableCell>
                          <TableCell align="right">อัตรา</TableCell>
                          <TableCell align="right" sx={MD_UP}>เงินได้ในขั้น</TableCell>
                          <TableCell align="right">ภาษีในขั้น</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {e.bracketBreakdown.map((b, i) => {
                          const lower = i === 0 ? 0 : (e.bracketBreakdown[i - 1]!.upToSatang ?? 0);
                          // estimate ในหน้านี้คำนวณสดเสมอจึงมี incomeSatang (snapshot เก่าไม่มี แต่ประวัติไม่แสดงขั้นบันได)
                          const income = <Money satang={b.incomeSatang} />;
                          return (
                            <TableRow key={i}>
                              <TableCell sx={dataTextSx}>
                                {bracketRange(lower, b.upToSatang)}
                                <Typography variant="body2" color="text.secondary" sx={BELOW_MD}>เงินได้ในขั้น {income}</Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ ...dataTextSx, verticalAlign: 'top' }}>{Math.round(b.rate * 100)}%</TableCell>
                              <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}>{income}</TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}><Money satang={b.taxSatang} /></TableCell>
                            </TableRow>
                          );
                        })}
                        {/* แถวสรุป: ป้าย 2 ช่อง + ช่องว่างที่ซ่อนตามคอลัมน์ "เงินได้ในขั้น" — จำนวนคอลัมน์ตรงกับแถวบนทุกขนาดจอ */}
                        {([
                          ['ภาษีตามขั้นบันได', <Money key="tax" satang={e.estimatedTaxSatang} />],
                          ['หัก ณ ที่จ่ายแล้ว (จากรายได้เต็ม)', <Money key="wht" satang={-e.withholdingSatang} />],
                          [`${payableWord(e.estimatedPayableSatang)} (ประมาณการ)`, payableMoney(e.estimatedPayableSatang)],
                        ] as const).map(([label, value]) => (
                          <TableRow key={label}>
                            <TableCell colSpan={2} sx={{ fontWeight: 600 }}>{label}</TableCell>
                            <TableCell sx={MD_UP} />
                            <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Section>
              )}

              <Section id="tax-issues-heading" title="สิ่งที่ยังต้องตรวจ" innerRef={issuesRef}>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  ประมาณการจะครบเมื่อทุกธุรกรรมของปีนี้ถูกระบุว่าเกี่ยวกับภาษีไหม และเอกสารภาษีผ่านการตรวจแล้ว
                </Typography>
                <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, mt: 1.5, mb: 0 }}>
                  <IssueItem
                    n={summary.missing_document.untreated_txn_count}
                    label="ธุรกรรมที่ยังไม่ระบุว่าเกี่ยวกับภาษีไหม"
                    to={txnLink(summary.drilldown_params.untreated_txn)}
                    hint='กดเพื่อเปิดหน้าธุรกรรมที่กรองไว้ แล้วตั้ง "การนับภาษี" ในแผงรายละเอียดของแต่ละรายการ — ยังไม่ระบุ = ยังไม่ถูกนับในประมาณการ'
                  />
                  <IssueItem
                    n={summary.missing_document.draft_document_count}
                    label="เอกสารภาษีที่ยังไม่ตรวจ"
                    to={`/tax-documents?${new URLSearchParams({ tax_entity_id: entityKey, tax_year: String(year), status: 'draft' }).toString()}`}
                  />
                  {summary.missing_document.unresolved_income_satang > 0 && (
                    <li>
                      <Typography sx={{ color: 'warning.main', display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                        <WarningAmberRounded fontSize="small" aria-hidden sx={{ mt: 0.25 }} />
                        <span>รายได้เต็ม <Money satang={summary.missing_document.unresolved_income_satang} /> ยังไม่รู้ว่าเป็นของผู้เสียภาษีคนไหน</span>
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        รายได้เหล่านี้ไม่ได้ระบุบัญชีรับเงิน จึงไม่ถูกนับในหน้านี้ — ระบุบัญชีรับเงินของรายได้นั้นที่<Link to="/planning">หน้าวางแผน</Link>
                      </Typography>
                    </li>
                  )}
                  {summary.missing_document.unlinked_business_txn_count > 0 && (
                    <li>
                      <Typography>
                        ธุรกรรมธุรกิจที่ยังไม่ผูกเอกสาร <Box component="span" sx={dataTextSx}>{summary.missing_document.unlinked_business_txn_count}</Box>
                      </Typography>
                      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 0.75 }}>
                        {summary.missing_document.unlinked_business_txn_samples.map((s) => (
                          <Chip
                            key={s.id}
                            component={Link}
                            to={`/transactions?month=${s.txn_date.slice(0, 7)}&txn=${s.id}`}
                            clickable
                            variant="outlined"
                            title={s.description}
                            sx={{ minHeight: 40, maxWidth: '100%' }}
                            label={<>{formatDate(s.txn_date)} {s.description}: <Money satang={s.amount_satang} /></>}
                          />
                        ))}
                      </Stack>
                    </li>
                  )}
                  {summary.missing_document.unlinked_claim_count > 0 && (
                    <li>
                      <Typography>
                        ค่าลดหย่อนที่ยังไม่ผูกเอกสาร <Box component="span" sx={dataTextSx}>{summary.missing_document.unlinked_claim_count}</Box>
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {summary.missing_document.unlinked_claim_samples.map((s, i) => (
                          <span key={s.id}>{i > 0 && ' · '}{deductionLabel(s.deduction_type)} <Money satang={s.claimed_amount_satang} /></span>
                        ))}
                        {' '}— ผูกเอกสารได้ที่ปุ่มแก้ไขในตารางค่าลดหย่อน
                      </Typography>
                    </li>
                  )}
                </Stack>
              </Section>
            </Box>
          )}

          {/* ค่าลดหย่อนและประวัติมาจาก request ของตัวเอง — ไม่ขึ้นกับว่าสรุปโหลดได้หรือไม่ */}
          {entity && (
            <Box data-tour="tax-deductions" sx={{ mt: 4 }}>
              <DeductionClaimSection taxEntityId={entity.id} taxYear={year} onChanged={reload} />
            </Box>
          )}

          {entity && (
            <Box sx={{ mt: 4 }}>
              <Disclosure
                id="tax-history-heading"
                title={`ประวัติการคำนวณ${snapshots ? ` (${snapshots.length})` : ''}`}
                open={historyOpen}
                onToggle={() => setHistoryOpen(!historyOpen)}
                notice={snapshotsError && <LoadError message="โหลดประวัติการคำนวณไม่สำเร็จ" onRetry={reload} />}
              >
                {snapshots == null ? (
                  !snapshotsError && <TableSkeleton rows={2} />
                ) : snapshots.length === 0 ? (
                  <EmptyState
                    icon={<CalculateRounded sx={{ fontSize: 40 }} />}
                    title="ยังไม่เคยบันทึกผล"
                    description={`ตัวเลขด้านบนคำนวณสดทุกครั้ง — กด "บันทึกผลไว้เทียบ" เพื่อเก็บผลของปี ${taxYearBE(year)} ไว้ ผลที่บันทึกไม่เปลี่ยนตามข้อมูลที่แก้ทีหลัง`}
                  />
                ) : (
                  // < md เหลือ คำนวณเมื่อ · ผล — เกณฑ์และภาษีโดยประมาณเป็นบรรทัดรอง
                  <TableContainer component={Paper} variant="outlined" role="region" aria-label="ตารางประวัติการคำนวณ">
                    <Table size="small" aria-label="ผลประมาณการที่บันทึกไว้" sx={CELL_PX}>
                      <TableHead>
                        <TableRow>
                          <TableCell>คำนวณเมื่อ</TableCell>
                          <TableCell sx={MD_UP}>เกณฑ์ภาษี</TableCell>
                          <TableCell align="right" sx={MD_UP}>ภาษีโดยประมาณ</TableCell>
                          <TableCell align="right">ต้องชำระเพิ่ม/ขอคืน</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {snapshots.map((s) => {
                          const est = s.result_snapshot.estimate;
                          const sYear = ruleYear(s.rule_version);
                          const rule = sYear == null ? null : `ปี ${taxYearBE(sYear)}`;
                          return (
                            <TableRow key={s.id}>
                              <TableCell>
                                <Box component="span" sx={dataTextSx}>{formatDateTime(s.calculated_at)}</Box>
                                <Typography variant="body2" color="text.secondary" sx={BELOW_MD}>
                                  {rule ? `เกณฑ์${rule}` : 'ไม่มีประมาณการ'}{est && <> · ภาษี <Money satang={est.estimatedTaxSatang} /></>}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ ...MD_UP, ...dataTextSx }}>{rule ?? noValue('ไม่มีประมาณการ')}</TableCell>
                              <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}>{est ? <Money satang={est.estimatedTaxSatang} /> : noValue('ไม่มีประมาณการ')}</TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                {est ? (
                                  <>
                                    {payableMoney(est.estimatedPayableSatang)}
                                    <Typography variant="body2" color="text.secondary">{payableWord(est.estimatedPayableSatang)}</Typography>
                                  </>
                                ) : noValue('ไม่มีประมาณการ')}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Disclosure>
            </Box>
          )}
        </>
      )}

      {/* render เฉพาะตอนเปิด — กันค่าที่พิมพ์ไว้รอบก่อนค้างอยู่ในฟอร์มรอบถัดไป */}
      {addIncomeOpen && (
        <IncomeQuickAddModal
          open
          accounts={accounts}
          onClose={() => setAddIncomeOpen(false)}
          onSaved={() => {
            setNotice({ message: 'เพิ่มรายได้เต็มแล้ว', severity: 'success' });
            reload();
          }}
        />
      )}
      {editingIncome && (
        <IncomeQuickAddModal
          key={editingIncome.id}
          open
          incomeRecordId={editingIncome.id}
          month={editingIncome.month}
          onClose={() => setEditingIncome(null)}
          onSaved={() => {
            setNotice({ message: 'แก้ไขรายได้แล้ว', severity: 'success' });
            reload();
          }}
        />
      )}
      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
    </Box>
  );
}
