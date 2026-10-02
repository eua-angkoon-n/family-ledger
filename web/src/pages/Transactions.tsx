import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Collapse,
  MenuItem,
  Stack,
  TablePagination,
  TextField,
  Typography,
} from '@mui/material';
import DoneAllRounded from '@mui/icons-material/DoneAllRounded';
import FilterListRounded from '@mui/icons-material/FilterListRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import {
  post, req, TAX_TREATMENT_LABEL,
  type Account, type Bank, type BulkReviewResponse, type Category, type TaxEntity, type TaxTreatment, type TxnListResponse,
} from '../api.js';
import MonthPicker, { currentMonth } from '../components/MonthPicker.js';
import { FloatingSelectionBar } from '../components/PlanSelectionBar.js';
import ReviewDrawer from '../components/ReviewDrawer.js';
import TransactionTable from '../components/TransactionTable.js';
import { TAX_PAGES_ENABLED } from '../features.js';
import { formatBaht, formatDate, parseBahtToSatang } from '../format.js';
import { dataTextSx } from '../theme.js';
import { EmptyState, FeedbackSnackbar, LoadError, PageHeader, TableSkeleton, type Notice } from '../ui.js';

const LIMIT = 50;
const COVERAGE_NOTE = 'ข้อมูลเงินจริงคำนวณจาก bank statement ที่นำเข้าสู่ระบบเท่านั้น ไม่รวมเงินสดและ e-Wallet';
// ตัวกรองในแผง "ตัวกรองเพิ่มเติม" — ค้างอยู่ใน URL ได้แม้แผงพับ จึงต้องสรุปเป็น chip ให้เห็นและลบได้
const HIDDEN_FILTER_KEYS = ['bank_id', 'category_id', 'uncategorised', 'direction', 'account_purpose', 'is_internal_transfer', 'tax_treatment', 'tax_entity_id', 'min_baht', 'max_baht'] as const;
// "ล้างตัวกรอง" ล้างทุกอย่างยกเว้นเดือน/ช่วงวันที่และบัญชี
const CLEAR_ALL_PATCH = Object.fromEntries([...HIDDEN_FILTER_KEYS, 'q', 'review_status'].map((k) => [k, null]));
const PAGINATION_ARIA: Record<string, string> = { first: 'หน้าแรก', last: 'หน้าสุดท้าย', next: 'หน้าถัดไป', previous: 'หน้าก่อนหน้า' };
const bahtLabel = (raw: string) => {
  const satang = parseBahtToSatang(raw);
  return satang == null ? raw : `฿${formatBaht(satang)}`;
};

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxEntities, setTaxEntities] = useState<TaxEntity[]>([]);
  const [data, setData] = useState<TxnListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  // เปิดลิงก์ที่มีตัวกรองซ่อนอยู่ = กางแผงให้เห็นเลย
  const [showMoreFilters, setShowMoreFilters] = useState(() => HIDDEN_FILTER_KEYS.some((k) => searchParams.get(k)));
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
  const [minBahtInput, setMinBahtInput] = useState(searchParams.get('min_baht') ?? '');
  const [maxBahtInput, setMaxBahtInput] = useState(searchParams.get('max_baht') ?? '');
  const [selectedTxnId, setSelectedTxnId] = useState<number | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // ตำแหน่งล่าสุดของแถวที่เปิดใน drawer — แถวที่บันทึกแล้วหลุดจากตัวกรอง (คิว "ยังไม่ตรวจ") ยังเลื่อน/คืน focus ไปแถวถัดไปได้
  const selectedIndexRef = useRef(-1);
  const lastTxnIdRef = useRef<number | null>(null);
  const tableBoxRef = useRef<HTMLDivElement>(null);
  const reviewChipRef = useRef<HTMLDivElement>(null);
  const linkedTxnId = searchParams.get('txn');
  useEffect(() => {
    const txnId = Number(linkedTxnId);
    selectedIndexRef.current = -1;
    setSelectedTxnId(linkedTxnId != null && Number.isSafeInteger(txnId) && txnId > 0 ? txnId : null);
  }, [linkedTxnId]);
  const [refreshing, setRefreshing] = useState(false);
  const requestIdRef = useRef(0);

  // drill-down จากหน้าภาษี (ทั้งปี ไม่ใช่รายเดือน) ส่ง from/to มาแทน month — ต้องไม่ถูก MonthPicker
  // เบียดทับด้วยเดือนปัจจุบันเงียบ ๆ ไม่งั้นตัวเลขที่ drill-down มาจากการ์ดกับที่เห็นในตารางไม่ตรงกัน
  const rangeFrom = searchParams.get('from');
  const rangeTo = searchParams.get('to');
  const monthParam = searchParams.get('month');
  const rangeMode = monthParam == null && rangeFrom != null && rangeTo != null;
  const month = monthParam ?? currentMonth();
  const bankAccountId = searchParams.get('bank_account_id') ?? '';
  const bankId = searchParams.get('bank_id') ?? '';
  const categoryId = searchParams.get('category_id') ?? '';
  const uncategorised = searchParams.get('uncategorised') === '1';
  const direction = searchParams.get('direction') ?? '';
  const accountPurpose = searchParams.get('account_purpose') ?? '';
  const isInternalTransfer = searchParams.get('is_internal_transfer') ?? '';
  const reviewStatus = searchParams.get('review_status') ?? '';
  const minBaht = searchParams.get('min_baht') ?? '';
  const maxBaht = searchParams.get('max_baht') ?? '';
  const taxTreatment = searchParams.get('tax_treatment') ?? '';
  const taxEntityIdFilter = searchParams.get('tax_entity_id') ?? '';
  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  // replace = ไม่เพิ่ม history (ช่องข้อความ, หน้าที่ว่างแล้วถอยกลับ) — ปุ่มย้อนกลับของเบราว์เซอร์ไม่ต้องไล่ทีละ blur
  const setFilter = (patch: Record<string, string | null>, replace = false) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (!('page' in patch)) next.delete('page');
      return next;
    }, { replace });
  };

  useEffect(() => {
    void (async () => {
      const [accountsResult, banksResult, categoriesResult, taxEntitiesResult] = await Promise.allSettled([
        req<Account[]>('/api/accounts'),
        req<Bank[]>('/api/banks'),
        req<Category[]>('/api/categories?is_active=true'),
        TAX_PAGES_ENABLED ? req<TaxEntity[]>('/api/tax-entities') : Promise.resolve([]),
      ]);
      if (accountsResult.status === 'fulfilled') setAccounts(accountsResult.value);
      if (banksResult.status === 'fulfilled') setBanks(banksResult.value);
      if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value);
      if (taxEntitiesResult.status === 'fulfilled') setTaxEntities(taxEntitiesResult.value);
    })();
  }, []);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (rangeMode) { p.set('from', rangeFrom!); p.set('to', rangeTo!); } else { p.set('month', month); }
    if (bankAccountId) p.set('bank_account_id', bankAccountId);
    if (bankId) p.set('bank_id', bankId);
    if (categoryId) p.set('category_id', categoryId);
    if (uncategorised) p.set('uncategorised', 'true');
    if (direction) p.set('direction', direction);
    if (accountPurpose) p.set('account_purpose', accountPurpose);
    if (isInternalTransfer) p.set('is_internal_transfer', isInternalTransfer);
    if (reviewStatus) p.set('review_status', reviewStatus);
    if (taxTreatment) p.set('tax_treatment', taxTreatment);
    if (taxEntityIdFilter) p.set('tax_entity_id', taxEntityIdFilter);
    const minSatang = minBaht ? parseBahtToSatang(minBaht) : null;
    const maxSatang = maxBaht ? parseBahtToSatang(maxBaht) : null;
    if (minSatang != null) p.set('min_satang', String(minSatang));
    if (maxSatang != null) p.set('max_satang', String(maxSatang));
    if (q) p.set('q', q);
    p.set('limit', String(LIMIT));
    p.set('offset', String((page - 1) * LIMIT));
    return p.toString();
  }, [rangeMode, rangeFrom, rangeTo, month, bankAccountId, bankId, categoryId, uncategorised, direction, accountPurpose, isInternalTransfer, reviewStatus, taxTreatment, taxEntityIdFilter, minBaht, maxBaht, q, page]);

  // background=true (บันทึกใน drawer / ตรวจแบบกลุ่ม) = คำขอเดิมซ้ำ ไม่ใช่ filter เปลี่ยน — ไม่ unmount ตารางเป็น
  // skeleton (ปุ่มในแถวที่จะคืน focus ให้ยังอยู่) และ error จากคำขอ background ไม่ล้างแถวเดิมทิ้ง (ยังถูกต้องอยู่ก่อน
  // บันทึกครั้งนี้) ต่างจาก error ตอน filter เปลี่ยนจริง
  // requestIdRef กัน response ที่มาไม่เรียงลำดับ (เช่น สลับบัญชีเร็ว ๆ) เขียนทับผลของคำขอล่าสุด
  const reload = async (background = false) => {
    const requestId = ++requestIdRef.current;
    if (background) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const result = await req<TxnListResponse>(`/api/transactions?${queryString}`);
      if (requestId !== requestIdRef.current) return;
      setData(result);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'โหลดรายการธุรกรรมไม่สำเร็จ');
      if (!background) setData(null);
    } finally {
      if (requestId === requestIdRef.current) { setLoading(false); setRefreshing(false); }
    }
  };
  useEffect(() => { void reload(false); }, [queryString]);
  // ที่เลือกไว้ล้างทุกครั้งที่ตัวกรอง/หน้าเปลี่ยน — ไม่ตรวจแถวที่มองไม่เห็นแล้ว
  useEffect(() => { setChecked(new Set()); }, [queryString]);
  // q มาจาก URL ได้โดยไม่ผ่านการพิมพ์ (เช่น คลิก drill-down จากกราฟ) — sync ช่องค้นหาตามด้วย ไม่งั้นแสดงค่าเก่าค้าง
  useEffect(() => { setSearchInput(q); }, [q]);
  useEffect(() => { setMinBahtInput(minBaht); }, [minBaht]);
  useEffect(() => { setMaxBahtInput(maxBaht); }, [maxBaht]);

  // คิว "ยังไม่ตรวจ": ตรวจจนหน้าสุดท้ายว่าง ถอยไปหน้าสุดท้ายที่ยังมีแถว แทนการโชว์ "ไม่พบธุรกรรม" ทั้งที่ยังเหลือ
  useEffect(() => {
    if (data && data.rows.length === 0 && data.total_count > 0 && page > 1) {
      setFilter({ page: String(Math.ceil(data.total_count / LIMIT)) }, true);
    }
  }, [data]);

  // ค่าไม่เปลี่ยน (เช่น แค่ tab ผ่าน) ไม่ commit — ไม่งั้น blur แต่ละครั้งเพิ่ม history และรีเซ็ตกลับหน้า 1
  const commitSearch = (value: string) => {
    if (value !== q) setFilter({ q: value }, true);
  };
  // ยอดขั้นต่ำ/สูงสุด commit ตอน blur/Enter เหมือนช่องค้นหา ไม่ใช่ทุก keystroke (ไม่งั้นพิมพ์เลข 4 หลักได้ history
  // 4 entry และยิง API 4 ครั้ง) ค่าที่ parse ไม่ได้ไม่ commit เงียบ ๆ — ปล่อยให้ error state ในช่องค้างไว้แทน
  const commitAmountFilter = (field: 'min_baht' | 'max_baht', raw: string) => {
    const current = field === 'min_baht' ? minBaht : maxBaht;
    const value = raw.trim();
    if (value === current) return;
    if (value !== '' && parseBahtToSatang(value) == null) return;
    setFilter({ [field]: value }, true);
  };

  const rows = data?.rows ?? [];
  const totalCount = data?.total_count ?? 0;
  const unreviewedRows = rows.filter((r) => r.review_status === 'unreviewed');
  const checkedIds = unreviewedRows.filter((r) => checked.has(r.id)).map((r) => r.id);

  const hiddenFilters: [key: string, label: string][] = [];
  if (bankId) hiddenFilters.push(['bank_id', `ธนาคาร: ${banks.find((b) => String(b.id) === bankId)?.name ?? bankId}`]);
  if (uncategorised) hiddenFilters.push(['uncategorised', 'หมวด: ไม่ได้จัดหมวด']);
  if (categoryId) hiddenFilters.push(['category_id', `หมวด: ${categories.find((c) => String(c.id) === categoryId)?.name ?? categoryId}`]);
  if (direction) hiddenFilters.push(['direction', direction === 'credit' ? 'เงินเข้า' : 'เงินออก']);
  if (accountPurpose) hiddenFilters.push(['account_purpose', `ประเภทบัญชี: ${accountPurpose === 'business' ? 'ธุรกิจ' : 'ส่วนตัว'}`]);
  if (isInternalTransfer) hiddenFilters.push(['is_internal_transfer', isInternalTransfer === 'true' ? 'เฉพาะโอนภายใน' : 'ไม่รวมโอนภายใน']);
  // ภาษีโผล่ได้จากลิงก์เก่าแม้หน้าภาษีปิดอยู่ — ยังต้องเห็นและลบได้ ไม่งั้นตารางถูกกรองแบบมองไม่เห็น
  if (taxTreatment) hiddenFilters.push(['tax_treatment', `การนับภาษี: ${taxTreatment === 'none' ? 'ยังไม่ระบุ' : TAX_TREATMENT_LABEL[taxTreatment as TaxTreatment] ?? taxTreatment}`]);
  if (taxEntityIdFilter) hiddenFilters.push(['tax_entity_id', `ผู้เสียภาษี: ${taxEntities.find((te) => String(te.id) === taxEntityIdFilter)?.display_name ?? taxEntityIdFilter}`]);
  if (minBaht) hiddenFilters.push(['min_baht', `ยอดตั้งแต่ ${bahtLabel(minBaht)}`]);
  if (maxBaht) hiddenFilters.push(['max_baht', `ยอดไม่เกิน ${bahtLabel(maxBaht)}`]);
  const clearable = hiddenFilters.length > 0 || q !== '' || reviewStatus !== '';
  const clearAllButton = (
    <Button color="inherit" onClick={() => setFilter(CLEAR_ALL_PATCH)}>ล้างตัวกรอง</Button>
  );

  // แถวที่เปิดอยู่ใน drawer: หาไม่เจอ (บันทึกแล้วหลุดจากตัวกรอง) ใช้ตำแหน่งเดิม — แถวถัดไปเลื่อนขึ้นมาแทนที่ตรงนั้นพอดี
  const currentIndex = selectedTxnId == null ? -1 : rows.findIndex((r) => r.id === selectedTxnId);
  useEffect(() => {
    if (currentIndex >= 0) selectedIndexRef.current = currentIndex;
    if (selectedTxnId != null) lastTxnIdRef.current = selectedTxnId;
  });
  const anchorIndex = currentIndex >= 0 ? currentIndex : selectedIndexRef.current;
  const prevRow = anchorIndex >= 0 ? rows[anchorIndex - 1] : undefined;
  const nextRow = currentIndex >= 0 ? rows[currentIndex + 1] : anchorIndex >= 0 ? rows[anchorIndex] : undefined;
  const position = currentIndex >= 0
    ? `รายการที่ ${currentIndex + 1} จาก ${rows.length}`
    : anchorIndex >= 0 ? `เหลือ ${rows.length} รายการ` : undefined;
  const openTxn = (id: number) => {
    selectedIndexRef.current = rows.findIndex((r) => r.id === id);
    setSelectedTxnId(id);
  };

  // คืน focus เอง (drawer ตั้ง disableRestoreFocus): ปุ่มของแถวที่เปิดล่าสุด → แถวที่เลื่อนขึ้นมาแทน → กล่องตาราง → chip
  // "ยังไม่ตรวจ" (mount ตลอด) — ไม่ปล่อยให้ focus ตกไปที่ <body>
  const focusTable = (txnId: number | null, index: number) => {
    const box = tableBoxRef.current;
    const buttons = box ? [...box.querySelectorAll<HTMLElement>('[data-txn-id]')] : [];
    const target =
      buttons.find((b) => b.dataset.txnId === String(txnId)) ??
      (index >= 0 ? buttons[Math.min(index, buttons.length - 1)] : undefined) ??
      box?.querySelector<HTMLElement>('.MuiTableContainer-root') ??
      reviewChipRef.current;
    target?.focus();
  };

  // แถบหายพร้อมปุ่มที่ถือ focus อยู่ — ย้าย focus หลังตารางชุดใหม่ render แล้ว (หน้าอาจว่างจนตารางหายไปทั้งตาราง)
  const focusAfterLoadRef = useRef(false);
  useEffect(() => {
    if (!focusAfterLoadRef.current || loading || refreshing) return;
    focusAfterLoadRef.current = false;
    focusTable(null, -1);
  }, [data, loading, refreshing]);

  const bulkReview = async () => {
    setBulkBusy(true);
    try {
      const { reviewed } = await post<BulkReviewResponse>('/api/transactions/review', { txn_ids: checkedIds });
      setChecked(new Set());
      setNotice({ message: `ตรวจแล้ว ${reviewed} รายการ`, severity: 'success' });
      focusAfterLoadRef.current = true;
      await reload(true);
    } catch (e) {
      setNotice({ message: e instanceof Error ? e.message : 'ทำเครื่องหมายตรวจแล้วไม่สำเร็จ', severity: 'error' });
    } finally {
      setBulkBusy(false);
    }
  };

  const fromRow = (page - 1) * LIMIT + 1;
  const toRow = fromRow + rows.length - 1;

  return (
    <Box>
      <PageHeader
        level={1}
        id="transactions-heading"
        title="ธุรกรรม"
        description="จัดหมวด ตรวจรายการ และยืนยันคู่โอนภายใน ทุกรายการย้อนดูได้ถึง statement ต้นทาง"
      />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{COVERAGE_NOTE}</Typography>

      <Stack spacing={1.5} sx={{ mt: 3 }} data-tour="txn-toolbar">
        {/* useFlexGap: spacing แบบ margin ของ Stack ทำแถวที่ตัดขึ้นบรรทัดใหม่เยื้องเข้า */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap sx={{ alignItems: { sm: 'center' }, flexWrap: 'wrap' }}>
          <MonthPicker value={month} onChange={(m) => setFilter({ month: m, from: null, to: null })} keyboardShortcut />
          {rangeMode && (
            <Chip
              label={`ช่วง ${formatDate(rangeFrom!)} – ${formatDate(rangeTo!)}`}
              onDelete={() => setFilter({ from: null, to: null, month: currentMonth() })}
              sx={{ minHeight: 40, alignSelf: 'flex-start' }}
            />
          )}
          <TextField
            select
            size="small"
            label="บัญชี"
            value={bankAccountId}
            onChange={(e) => setFilter({ bank_account_id: e.target.value })}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">ทุกบัญชี</MenuItem>
            {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.nickname}</MenuItem>)}
          </TextField>
          <TextField
            size="small"
            label="ค้นหารายการ"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onBlur={(e) => commitSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitSearch((e.target as HTMLInputElement).value); }}
            sx={{ minWidth: 200, flexGrow: 1 }}
          />
          <Chip
            ref={reviewChipRef}
            label="ยังไม่ตรวจ"
            variant={reviewStatus === 'unreviewed' ? 'filled' : 'outlined'}
            color={reviewStatus === 'unreviewed' ? 'primary' : 'default'}
            onClick={() => setFilter({ review_status: reviewStatus === 'unreviewed' ? null : 'unreviewed' })}
            aria-pressed={reviewStatus === 'unreviewed'}
            sx={{ minHeight: 40, alignSelf: { xs: 'flex-start', sm: 'center' } }}
          />
          <Button
            startIcon={<FilterListRounded />}
            onClick={() => setShowMoreFilters((v) => !v)}
            color={hiddenFilters.length > 0 ? 'primary' : 'inherit'}
            aria-expanded={showMoreFilters}
            aria-controls="txn-more-filters"
            sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
          >
            ตัวกรองเพิ่มเติม{hiddenFilters.length > 0 ? ` (${hiddenFilters.length})` : ''}
          </Button>
        </Stack>

        <Collapse in={showMoreFilters} id="txn-more-filters">
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', pt: 0.5 }}>
            <TextField select size="small" label="ธนาคาร" value={bankId} onChange={(e) => setFilter({ bank_id: e.target.value })} sx={{ minWidth: 140 }}>
              <MenuItem value="">ทุกธนาคาร</MenuItem>
              {banks.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </TextField>
            <TextField
              select
              size="small"
              label="หมวด"
              value={uncategorised ? '__uncategorised__' : categoryId}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__uncategorised__') setFilter({ uncategorised: '1', category_id: null });
                else setFilter({ category_id: v || null, uncategorised: null });
              }}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">ทุกหมวด</MenuItem>
              <MenuItem value="__uncategorised__">ไม่ได้จัดหมวด</MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="เข้า/ออก" value={direction} onChange={(e) => setFilter({ direction: e.target.value })} sx={{ minWidth: 120 }}>
              <MenuItem value="">ทั้งหมด</MenuItem>
              <MenuItem value="credit">เงินเข้า</MenuItem>
              <MenuItem value="debit">เงินออก</MenuItem>
            </TextField>
            <TextField select size="small" label="ประเภทบัญชี" value={accountPurpose} onChange={(e) => setFilter({ account_purpose: e.target.value })} sx={{ minWidth: 130 }}>
              <MenuItem value="">ทั้งหมด</MenuItem>
              <MenuItem value="personal">ส่วนตัว</MenuItem>
              <MenuItem value="business">ธุรกิจ</MenuItem>
            </TextField>
            <TextField select size="small" label="โอนภายใน" value={isInternalTransfer} onChange={(e) => setFilter({ is_internal_transfer: e.target.value })} sx={{ minWidth: 130 }}>
              <MenuItem value="">ทั้งหมด</MenuItem>
              <MenuItem value="true">เฉพาะโอนภายใน</MenuItem>
              <MenuItem value="false">ไม่รวมโอนภายใน</MenuItem>
            </TextField>
            {TAX_PAGES_ENABLED && (
              <TextField select size="small" label="การนับภาษี" value={taxTreatment} onChange={(e) => setFilter({ tax_treatment: e.target.value })} sx={{ minWidth: 150 }}>
                <MenuItem value="">ทั้งหมด</MenuItem>
                <MenuItem value="none">ยังไม่ระบุ</MenuItem>
                {(Object.entries(TAX_TREATMENT_LABEL) as [TaxTreatment, string][]).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </TextField>
            )}
            {TAX_PAGES_ENABLED && (
              <TextField select size="small" label="ผู้เสียภาษี" value={taxEntityIdFilter} onChange={(e) => setFilter({ tax_entity_id: e.target.value })} sx={{ minWidth: 150 }}>
                <MenuItem value="">ทั้งหมด</MenuItem>
                {taxEntities.map((te) => <MenuItem key={te.id} value={te.id}>{te.display_name}</MenuItem>)}
              </TextField>
            )}
            <TextField
              size="small"
              label="ยอดขั้นต่ำ (บาท)"
              value={minBahtInput}
              onChange={(e) => setMinBahtInput(e.target.value)}
              onBlur={() => commitAmountFilter('min_baht', minBahtInput)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitAmountFilter('min_baht', minBahtInput); }}
              error={minBahtInput !== '' && parseBahtToSatang(minBahtInput) == null}
              helperText={minBahtInput !== '' && parseBahtToSatang(minBahtInput) == null ? 'รูปแบบไม่ถูกต้อง' : undefined}
              slotProps={{ htmlInput: { inputMode: 'decimal', sx: dataTextSx } }}
              sx={{ width: 130 }}
            />
            <TextField
              size="small"
              label="ยอดสูงสุด (บาท)"
              value={maxBahtInput}
              onChange={(e) => setMaxBahtInput(e.target.value)}
              onBlur={() => commitAmountFilter('max_baht', maxBahtInput)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitAmountFilter('max_baht', maxBahtInput); }}
              error={maxBahtInput !== '' && parseBahtToSatang(maxBahtInput) == null}
              helperText={maxBahtInput !== '' && parseBahtToSatang(maxBahtInput) == null ? 'รูปแบบไม่ถูกต้อง' : undefined}
              slotProps={{ htmlInput: { inputMode: 'decimal', sx: dataTextSx } }}
              sx={{ width: 130 }}
            />
          </Stack>
        </Collapse>

        {/* สรุปตัวกรองที่ซ่อนอยู่ในแผงที่พับไว้ — กด chip เพื่อเอาตัวกรองนั้นออก ตัวกรองภาษีตอนหน้าภาษีปิดไม่มีช่องในแผง จึงขึ้นเสมอ */}
        {clearable && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            {hiddenFilters.filter(([key]) => !showMoreFilters || (!TAX_PAGES_ENABLED && key.startsWith('tax_'))).map(([key, label]) => (
              <Chip
                key={key}
                label={label}
                variant="outlined"
                onClick={() => setFilter({ [key]: null })}
                onDelete={() => setFilter({ [key]: null })}
                aria-label={`เอาตัวกรอง ${label} ออก`}
                sx={{ minHeight: 40 }}
              />
            ))}
            {clearAllButton}
          </Stack>
        )}
      </Stack>

      {error && <LoadError message={error} onRetry={rows.length === 0 ? () => void reload() : undefined} />}

      {loading ? (
        <TableSkeleton rows={8} />
      ) : error && rows.length === 0 ? null : rows.length === 0 ? (
        <EmptyState
          icon={<ReceiptLongRounded sx={{ fontSize: 40 }} />}
          title={reviewStatus === 'unreviewed' && hiddenFilters.length === 0 && q === '' ? 'ไม่มีรายการที่ยังไม่ตรวจ' : 'ไม่พบธุรกรรมในเงื่อนไขนี้'}
          description={clearable ? 'ลองเปลี่ยนเดือน หรือล้างตัวกรองที่ตั้งไว้' : 'ลองเปลี่ยนเดือนหรือบัญชี'}
          action={clearable ? clearAllButton : undefined}
        />
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ ...dataTextSx, mt: 2 }}>
            {fromRow}–{toRow} จาก {totalCount} รายการ
          </Typography>
          <Box data-tour="txn-table" ref={tableBoxRef}>
            <TransactionTable
              rows={rows}
              showRunningBalance={Boolean(bankAccountId)}
              onRowClick={openTxn}
              busy={refreshing}
              selection={unreviewedRows.length > 0 ? {
                selected: checked,
                onToggle: (id) => setChecked((prev) => {
                  const next = new Set(prev);
                  if (!next.delete(id)) next.add(id);
                  return next;
                }),
                onToggleAll: () => setChecked(checkedIds.length === unreviewedRows.length ? new Set() : new Set(unreviewedRows.map((r) => r.id))),
              } : undefined}
            />
          </Box>
          <TablePagination
            component="div"
            count={totalCount}
            page={page - 1}
            onPageChange={(_, newPage) => setFilter({ page: String(newPage + 1) })}
            rowsPerPage={LIMIT}
            rowsPerPageOptions={[LIMIT]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count} รายการ`}
            getItemAriaLabel={(type) => PAGINATION_ARIA[type] ?? type}
            sx={dataTextSx}
          />
        </>
      )}

      {checkedIds.length > 0 && (
        <FloatingSelectionBar label="รายการที่เลือก">
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
            <Typography role="status" sx={{ fontWeight: 600 }}>
              เลือก {checkedIds.length} รายการ{bulkBusy ? ' · กำลังดำเนินการ…' : ''}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Button variant="contained" startIcon={<DoneAllRounded />} disabled={bulkBusy} aria-busy={bulkBusy} onClick={() => void bulkReview()}>
                ทำเครื่องหมายตรวจแล้ว ({checkedIds.length})
              </Button>
              <Button color="inherit" disabled={bulkBusy} onClick={() => setChecked(new Set())}>ล้างที่เลือก</Button>
            </Stack>
          </Stack>
        </FloatingSelectionBar>
      )}

      <ReviewDrawer
        txnId={selectedTxnId}
        categories={categories}
        taxEntities={taxEntities}
        onClose={() => setSelectedTxnId(null)}
        onExited={() => focusTable(lastTxnIdRef.current, selectedIndexRef.current)}
        onSaved={() => void reload(true)}
        onNotice={setNotice}
        onPrev={prevRow ? () => openTxn(prevRow.id) : undefined}
        onNext={nextRow ? () => openTxn(nextRow.id) : undefined}
        position={position}
      />
      {/* แถบที่เลือกอยู่ล่างจอ — snackbar ย้ายขึ้นบน (Floating Selection Bar Rule) */}
      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} placement={checkedIds.length > 0 ? 'top' : 'bottom'} />
    </Box>
  );
}
