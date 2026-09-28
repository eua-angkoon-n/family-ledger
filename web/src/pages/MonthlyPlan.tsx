import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Chip,
  FormLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
  type IconButtonProps,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import EventRepeatRounded from '@mui/icons-material/EventRepeatRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import LockOutlined from '@mui/icons-material/LockOutlined';
import LockOpenOutlined from '@mui/icons-material/LockOpenOutlined';
import PaidRounded from '@mui/icons-material/PaidRounded';
import SkipNextRounded from '@mui/icons-material/SkipNextRounded';
import {
  del,
  patch,
  post,
  req,
  type Account,
  type Category,
  type MonthlyPlan as Plan,
  type PlanItem,
  type PlanItemPayment,
  type PlanKind,
  type RecurringRule,
} from '../api.js';
import Modal from '../Modal.js';
import Money from '../components/Money.js';
import MonthPicker, { currentMonth, shiftMonth } from '../components/MonthPicker.js';
import PaymentStatusChip, { PAYMENT_STATE_LABEL } from '../components/PaymentStatusChip.js';
import IncomeSection from '../components/IncomeSection.js';
import PlanSelectionBar from '../components/PlanSelectionBar.js';
import SummaryCard from '../components/SummaryCard.js';
import { createFormFieldChangeHandler } from '../form.js';
import { formatDate, parseBahtToSatang } from '../format.js';
import {
  canDelete,
  canPay,
  canSkip,
  comparePlanItems,
  compareRules,
  EMPTY_ITEM_FILTER,
  EMPTY_RULE_FILTER,
  matchesItemFilter,
  matchesRuleFilter,
  NO_CATEGORY,
  STATUS_ORDER,
  todayLocal,
  type ItemFilter,
  type ItemSortKey,
  type RuleFilter,
  type RuleSortKey,
  type SortDir,
} from '../planSelection.js';
import { dataTextSx, descriptionSx } from '../theme.js';
import { ConfirmDialog, EmptyState, FeedbackSnackbar, LoadError, PageHeader, TableSkeleton, type Notice } from '../ui.js';


// API จำกัดการวางแผนล่วงหน้าไว้ 12 เดือน (MAX_MONTHS_AHEAD ใน src/routes/monthly-plans.ts)
const MAX_MONTH = shiftMonth(currentMonth(), 12);

const KINDS: { value: PlanKind; label: string }[] = [
  { value: 'income', label: 'รายได้' },
  { value: 'payroll_deduction', label: 'รายการหักจากรายได้' },
  { value: 'expense', label: 'รายจ่าย' },
  { value: 'reserve', label: 'เงินกันไว้' },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<PlanKind, string>;
const UNITS = [
  { value: 'day', label: 'วัน' },
  { value: 'week', label: 'สัปดาห์' },
  { value: 'month', label: 'เดือน' },
  { value: 'year', label: 'ปี' },
] as const;

// padding แนวนอน 10px แทน 16px ของ theme — ตารางรายการ 9 คอลัมน์พอดีกล่อง ~1150px ที่จอ ≥ 1200px และ
// ตารางรายการประจำพอดีที่ 900px โดยไม่ต้องเลื่อนแนวนอน ยกเว้นคอลัมน์ checkbox ที่คุม padding เอง (พื้นที่กด 40px)
const COMPACT_CELLS = { '& .MuiTableCell-root:not(.MuiTableCell-paddingCheckbox)': { px: 1.25 } };

const EMPTY_ITEM = { kind: 'expense', name: '', amount_baht: '', due_date: '', category_id: '', note: '' };
const EMPTY_RULE = {
  name: '',
  kind: 'expense',
  amount_mode: 'fixed',
  amount_baht: '',
  frequency_unit: 'month',
  frequency_interval: '1',
  anchor_day: '',
  start_date: '',
  end_date: '',
  default_account_id: '',
  category_id: '',
};
const EMPTY_PAYMENT = { amount_baht: '', paid_date: '', bank_account_id: '' };

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

type Sort<K> = { key: K; dir: SortDir };
type Excluded = { item: PlanItem; reason: string };

// คลิกคอลัมน์ใหม่ = เรียงขึ้นก่อน, คลิกคอลัมน์เดิม = กลับทิศ (null = ลำดับจาก API ตั้งแต่ยังไม่เคยกด)
function nextSort<K>(prev: Sort<K> | null, key: K): Sort<K> {
  return prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
}

function SortCell<K extends string>(props: {
  sortKey: K;
  sort: Sort<K> | null;
  onSort: (key: K) => void;
  align?: 'right';
  children: ReactNode;
}) {
  const dir = props.sort != null && props.sort.key === props.sortKey ? props.sort.dir : undefined;
  return (
    <TableCell align={props.align} sortDirection={dir ?? false}>
      {/* minHeight 40 = พื้นที่กดขั้นต่ำ, margin ติดลบกันหัวตารางสูงขึ้นตาม, nowrap กันหัวคอลัมน์หักเป็น "จ่าย/แล้ว" */}
      <TableSortLabel active={dir != null} direction={dir ?? 'asc'} onClick={() => props.onSort(props.sortKey)} sx={{ minHeight: 40, my: -1, whiteSpace: 'nowrap' }}>
        {props.children}
      </TableSortLabel>
    </TableCell>
  );
}

// ปุ่มรองของแถวเป็นไอคอน + tooltip ให้ตารางพอดี 1152px โดยไม่ต้องเลื่อนแนวนอน (ปุ่มหลักของแถวยังเป็นข้อความ)
// span ห่อไว้เสมอ: Tooltip ของ MUI ฟัง event จากปุ่มที่ disabled ไม่ได้ (ท่าเดียวกับปุ่มออกจากระบบใน App.tsx)
function RowIconButton({ label, children, ...props }: { label: string } & Omit<IconButtonProps, 'aria-label'>) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton size="small" aria-label={label} {...props}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

// หมวดที่มีจริงในแถวชุดนี้ (ไม่ใช่หมวดทั้งหมดของผู้ใช้) — ตัวกรองที่เลือกไว้แล้วแต่แถวสุดท้ายของหมวดนั้น
// เพิ่งถูกลบ/เลิกใช้ ต้องยังมีตัวเลือกอยู่ ไม่งั้น select ของ MUI ได้ค่าที่ไม่มีใน option
function categoryOptions(rows: { category_id: number | null; category_name: string | null }[], current: string) {
  const options = new Map<string, string>();
  for (const r of rows) if (r.category_id != null) options.set(String(r.category_id), r.category_name ?? '—');
  if (current !== '' && current !== NO_CATEGORY && !options.has(current)) options.set(current, 'หมวดที่เลือกไว้');
  return [...options].sort((a, b) => a[1].localeCompare(b[1], 'th'));
}

function partition(items: PlanItem[], check: (item: PlanItem) => string | null) {
  const ok: PlanItem[] = [];
  const excluded: Excluded[] = [];
  for (const item of items) {
    const reason = check(item);
    if (reason == null) ok.push(item);
    else excluded.push({ item, reason });
  }
  return { ok, excluded };
}

// dialog แบบกลุ่มต้องบอกชื่อทุกแถวที่จะถูกแตะ — แถวที่เลือกอาจถูกตัวกรองซ่อนอยู่ ผู้ใช้ต้องเห็นครบก่อนกดยืนยัน
function BulkList({ intro, targets, excluded }: { intro: string; targets: PlanItem[]; excluded: Excluded[] }) {
  return (
    <Stack spacing={1.5}>
      <Typography sx={descriptionSx}>{intro}</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {targets.map((i) => (
          <li key={i.id}>
            {i.name} · <Money satang={i.planned_amount_satang} />
          </li>
        ))}
      </Box>
      {excluded.length > 0 && (
        <>
          <Typography variant="body2" sx={{ fontWeight: 650 }}>
            ตัดออก {excluded.length} รายการ
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary' }}>
            {excluded.map(({ item, reason }) => (
              <li key={item.id}>
                {item.name} — {reason}
              </li>
            ))}
          </Box>
        </>
      )}
    </Stack>
  );
}

export default function MonthlyPlan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const month = searchParams.get('month') ?? currentMonth();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const requestIdRef = useRef(0);

  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const setItemField = createFormFieldChangeHandler(setItemForm);

  const [ruleForm, setRuleForm] = useState(EMPTY_RULE);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const setRuleField = createFormFieldChangeHandler(setRuleForm);

  const [payingItem, setPayingItem] = useState<PlanItem | null>(null);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
  const setPaymentField = createFormFieldChangeHandler(setPaymentForm);

  // ตัวกรองชุดเดียวใช้ร่วมกันระหว่างชิปสถานะกับ dropdown เหนือตาราง — จำนวนแถวจึงเท่ากับเลขบนชิปเสมอ
  const [itemFilter, setItemFilter] = useState<ItemFilter>(EMPTY_ITEM_FILTER);
  const [itemSort, setItemSort] = useState<Sort<ItemSortKey> | null>(null);
  // เลือกค้างไว้ข้ามการเปลี่ยนตัวกรองได้ (เลือกจากหลายมุมมองรวมกัน) แต่ล้างเมื่อเปลี่ยนเดือน
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>(EMPTY_RULE_FILTER);
  const [ruleSort, setRuleSort] = useState<Sort<RuleSortKey> | null>(null);
  const [bulkAction, setBulkAction] = useState<'pay' | 'skip' | 'delete' | null>(null);
  const [bulkPayForm, setBulkPayForm] = useState({ paid_date: '', bank_account_id: '' });
  const setBulkPayField = createFormFieldChangeHandler(setBulkPayForm);
  const [bulkAmounts, setBulkAmounts] = useState<Record<number, string>>({});
  const hadSelectionRef = useRef(false);
  // งานแบบกลุ่มแยกจาก submitting ของปุ่มรายแถว — ถ้าใช้ตัวเดียวกัน ปุ่มรายแถวที่กดกลางคัน
  // จะคืน submitting=false ตอนจบ แถบกลับมากดได้ แล้วกด "จ่ายแล้ว" ซ้ำกับเป้าหมายเดิม = ประกาศจ่ายซ้ำ
  // ref กันการกดซ้ำก่อน state รอบใหม่ render ทัน (closure ของ dialog ยังเห็นค่าเก่า)
  const [bulkRunning, setBulkRunning] = useState(false);
  const bulkRunningRef = useRef(false);
  const hadBulkRef = useRef(false);
  const [bulkFailures, setBulkFailures] = useState<{
    verb: string;
    total: number;
    failed: { item: PlanItem; message: string }[];
  } | null>(null);
  const failureAlertRef = useRef<HTMLDivElement>(null);

  const [archivingRule, setArchivingRule] = useState<RecurringRule | null>(null);
  // ปุ่มต้นทางของ dialog บางตัวหายไปหลังทำสำเร็จ ("ปิดเดือนนี้" ถูกแทนด้วยปุ่มเปิดเดือน, "เลือกคู่"
  // หายเมื่อ payment ไม่ needs_review แล้ว) MUI คืน focus ให้เฉพาะเมื่อ element เดิมยังอยู่ —
  // ไม่งั้น focus ตกไปที่ body ใช้ปุ่มที่อยู่ถาวรบนหน้าเป็นที่รับ focus แทน (ท่าเดียวกับ Accounts.tsx)
  const addItemButtonRef = useRef<HTMLButtonElement>(null);

  const setMonth = (next: string) =>
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('month', next);
      return params;
    });

  // reload อ่านเดือนจาก ref ไม่ใช่ `month` ของ closure — run()/runBulk() เรียก reload หลังรอคำขอเสร็จ
  // ถ้าผู้ใช้สลับเดือนระหว่างนั้น closure เก่าจะโหลดแผนของเดือนเดิมมาแสดงใต้ URL ของเดือนใหม่
  const monthRef = useRef(month);
  monthRef.current = month;

  // requestIdRef กัน response ที่มาไม่เรียงลำดับ (สลับเดือนเร็ว ๆ) เขียนทับผลของคำขอล่าสุด
  const reload = async (background = false) => {
    const requestId = ++requestIdRef.current;
    if (!background) setLoading(true);
    setError('');
    const [planResult, rulesResult] = await Promise.allSettled([
      req<Plan>(`/api/monthly-plans/${monthRef.current}`),
      req<RecurringRule[]>('/api/recurring-rules'),
    ]);
    if (requestId !== requestIdRef.current) return;
    const failures: string[] = [];
    if (planResult.status === 'fulfilled') setPlan(planResult.value);
    else {
      failures.push(errorMessage(planResult.reason, 'โหลดแผนรายเดือนไม่สำเร็จ'));
      if (!background) setPlan(null);
    }
    if (rulesResult.status === 'fulfilled') setRules(rulesResult.value);
    else failures.push(errorMessage(rulesResult.reason, 'โหลดรายการประจำไม่สำเร็จ'));
    setError(failures.join(' • '));
    setLoading(false);
  };

  useEffect(() => {
    void (async () => {
      const [accountsResult, categoriesResult] = await Promise.allSettled([
        req<Account[]>('/api/accounts'),
        req<Category[]>('/api/categories?is_active=true'),
      ]);
      if (accountsResult.status === 'fulfilled') setAccounts(accountsResult.value);
      if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value);
    })();
  }, []);

  useEffect(() => {
    void reload(false);
    // id ของเดือนอื่นไม่มีความหมายที่นี่ ส่วนหมวดที่กรองไว้อาจไม่มีในเดือนใหม่ — ประเภท/สถานะคงไว้
    setSelected(new Set());
    setBulkFailures(null);
    setItemFilter((f) => ({ ...f, category: '' }));
  }, [month]);

  // ตัด id ที่หายไปหลัง reload (ลบแล้ว) — ผูกกับ plan ไม่ใช่ items เพราะ items เป็น [] ใหม่ทุก render
  // ตอน plan เป็น null แล้วจะวน setState ไม่จบ คืน prev เดิมเมื่อไม่มีอะไรถูกตัดให้ React ไม่ render ซ้ำ
  useEffect(() => {
    const ids = new Set((plan?.items ?? []).map((i) => i.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [plan]);

  // แถบลอยหายไปพร้อมปุ่มที่ถือ focus อยู่ ("ล้างที่เลือก" หรือทำครบทุกแถว) focus จึงตกไปที่ body —
  // ส่งต่อให้ checkbox หัวตาราง (ยังอยู่ใกล้งานที่ทำ) หรือปุ่มเพิ่มรายการถ้าตารางหายไปแล้ว
  // preventScroll: ไม่กระชากหน้าจอของคนที่ใช้เมาส์ แค่ให้ Tab ถัดไปเริ่มจากจุดที่สมเหตุสมผล
  useEffect(() => {
    if (selected.size > 0) {
      hadSelectionRef.current = true;
      return;
    }
    if (!hadSelectionRef.current) return;
    hadSelectionRef.current = false;
    if (document.activeElement == null || document.activeElement === document.body) {
      (document.getElementById('plan-select-all') ?? addItemButtonRef.current)?.focus({ preventScroll: true });
    }
  }, [selected.size > 0]);

  // ปุ่มบนแถบ disabled ตลอดงานแบบกลุ่ม focus ที่ MUI คืนให้หลังปิด dialog จึงตกไปที่ body —
  // พอจบงานส่งให้ Alert รายการที่ไม่สำเร็จ (ถ้ามี) ไม่งั้น checkbox หัวตาราง ทำงานตอนเปลี่ยนจาก
  // กำลังทำ → เสร็จเท่านั้น และ effect รันหลัง commit แล้ว Alert ที่เพิ่ง set จึงอยู่ใน DOM แล้ว
  useEffect(() => {
    if (bulkRunning) {
      hadBulkRef.current = true;
      return;
    }
    if (!hadBulkRef.current) return;
    hadBulkRef.current = false;
    if (document.activeElement == null || document.activeElement === document.body) {
      (failureAlertRef.current ?? document.getElementById('plan-select-all') ?? addItemButtonRef.current)?.focus({ preventScroll: true });
    }
  }, [bulkRunning]);

  const closed = plan?.status === 'closed';
  const items = plan?.items ?? [];
  const activeRules = rules.filter((r) => r.is_active);

  const visibleItems = items.filter((i) => matchesItemFilter(i, itemFilter));
  if (itemSort) visibleItems.sort(comparePlanItems(itemSort.key, itemSort.dir));
  const itemFilterActive = itemFilter.kind !== '' || itemFilter.category !== '' || itemFilter.status !== '';
  const itemCategoryOptions = categoryOptions(items, itemFilter.category);
  const setItemFilterField = (key: keyof ItemFilter) => (event: { target: { value: string } }) =>
    setItemFilter((f) => ({ ...f, [key]: event.target.value }));

  const visibleRules = activeRules.filter((r) => matchesRuleFilter(r, ruleFilter));
  if (ruleSort) visibleRules.sort(compareRules(ruleSort.key, ruleSort.dir));
  const ruleFilterActive = ruleFilter.kind !== '' || ruleFilter.category !== '' || ruleFilter.amount_mode !== '';
  const ruleCategoryOptions = categoryOptions(activeRules, ruleFilter.category);
  const setRuleFilterField = (key: keyof RuleFilter) => (event: { target: { value: string } }) =>
    setRuleFilter((f) => ({ ...f, [key]: event.target.value }));

  // ชิปสถานะ = ทางลัดของตัวกรอง {รายจ่าย, สถานะ X} กดชิปที่เปิดอยู่ซ้ำ = ล้างตัวกรอง
  const chipOn = (status: ItemFilter['status']) =>
    itemFilter.kind === 'expense' && itemFilter.status === status && itemFilter.category === '';
  const toggleChip = (status: ItemFilter['status']) =>
    setItemFilter(chipOn(status) ? EMPTY_ITEM_FILTER : { kind: 'expense', status, category: '' });

  // แถวที่ถูกซ่อนด้วยตัวกรองยังนับ — ปุ่มแบบกลุ่มทำกับทุกแถวที่เลือก ไม่ใช่แค่ที่เห็น
  const selectedItems = items.filter((i) => selected.has(i.id));
  // ใช้ selectedItems ไม่ใช่ selected.size — ระหว่างรอ effect ตัด id ที่ถูกลบ แถบจะไม่โชว์ "เลือก 0 รายการ"
  const barVisible = selectedItems.length > 0;
  const hiddenSelectedCount = selectedItems.filter((i) => !matchesItemFilter(i, itemFilter)).length;
  const payPlan = partition(selectedItems, canPay);
  const skipPlan = partition(selectedItems, canSkip);
  const deletePlan = partition(selectedItems, canDelete);
  const selectedVisibleCount = visibleItems.filter((i) => selected.has(i.id)).length;
  const allVisibleSelected = visibleItems.length > 0 && selectedVisibleCount === visibleItems.length;

  const toggleSelected = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  // checkbox หัวตารางแตะเฉพาะแถวที่เห็น แถวที่เลือกไว้ใต้ตัวกรองอื่นยังค้างอยู่
  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of visibleItems) {
        if (allVisibleSelected) next.delete(i.id);
        else next.add(i.id);
      }
      return next;
    });

  // ปุ่มบนแถบเครื่องมือ (คัดลอกเดือนก่อน / ปิด-เปิดเดือน / ข้าม / เลิกใช้) ไม่มี Alert ของ formError
  // ให้แสดง ถ้าโยน error ลง formError ตัวเดียวเสมอ ความล้มเหลวของปุ่มเหล่านั้นจะเงียบหายไปทั้งหมด —
  // มี modal เปิดอยู่ค่อยแสดงในฟอร์ม (อยู่ติดกับสิ่งที่ผู้ใช้กรอกผิด) ไม่มีก็ส่งเข้า snackbar
  const run = async (action: () => Promise<unknown>, successMessage: string, onDone?: () => void) => {
    // ปุ่มรายแถว disabled ระหว่างงานแบบกลุ่มแล้ว — ตัวนี้กันคลิกที่หลุดมาก่อน re-render
    if (bulkRunningRef.current) return;
    // ConfirmDialog (closing / archivingRule) ไม่มีช่องแสดง error ในตัว จึงไม่นับเป็น "อยู่ในฟอร์ม"
    const inModal = itemModalOpen || ruleModalOpen || payingItem != null;
    setFormError('');
    setSubmitting(true);
    try {
      await action();
      setNotice({ message: successMessage, severity: 'success' });
      onDone?.();
      await reload(true);
    } catch (e) {
      const message = errorMessage(e, 'บันทึกไม่สำเร็จ');
      if (inModal) setFormError(message);
      else setNotice({ message, severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // ไม่มี endpoint แบบกลุ่ม — ยิงทีละรายการตามลำดับ ไม่ขนาน (ไม่ถล่ม server ด้วยคำขอพร้อมกันหลายสิบตัว
  // และสรุป error เรียงตามลำดับเดียวกับที่ผู้ใช้เห็น) แถวที่พังไม่หยุดแถวถัดไป แล้วสรุปรวมทีเดียว
  // แถวที่สำเร็จออกจากการเลือก แถวที่พังค้างไว้ให้กดซ้ำหรือแก้ทีละแถวได้
  //
  // ไม่แตะ submitting — ใช้ bulkRunning ของตัวเอง (เหตุผลที่ประกาศ state) ส่วนปุ่มบนแถบเครื่องมือเช็กทั้งสองตัว
  // รายการที่ไม่สำเร็จขึ้น Alert เหนือตาราง (snackbar หายเองใน 4.5 วินาที อ่านรายชื่อไม่ทัน)
  const runBulk = async (targets: PlanItem[], fn: (item: PlanItem) => Promise<unknown>, verb: string) => {
    if (bulkRunningRef.current) return;
    bulkRunningRef.current = true;
    setBulkRunning(true);
    setBulkFailures(null);
    const startMonth = monthRef.current;
    const failed: { item: PlanItem; message: string }[] = [];
    try {
      for (const item of targets) {
        try {
          await fn(item);
        } catch (e) {
          failed.push({ item, message: errorMessage(e, 'ไม่สำเร็จ') });
        }
      }
      await reload(true);
      const failedIds = new Set(failed.map((f) => f.item.id));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const t of targets) if (!failedIds.has(t.id)) next.delete(t.id);
        return next;
      });
      const done = targets.length - failed.length;
      if (failed.length === 0) setNotice({ message: `${verb}แล้ว ${done} รายการ`, severity: 'success' });
      else if (monthRef.current !== startMonth) {
        // สลับเดือนระหว่างทำ — Alert เหนือตารางของเดือนใหม่จะชี้ผิดเดือน สรุปใน snackbar แทน
        setNotice({
          message: `เดือนก่อนหน้า ${verb}สำเร็จ ${done}/${targets.length} — ไม่สำเร็จ: ${failed.map((f) => `${f.item.name} (${f.message})`).join(', ')}`,
          severity: 'error',
        });
      } else {
        // Alert อาจอยู่นอกจอถ้าเลื่อนลงไปท้ายตาราง — snackbar สั้น ๆ ชี้ไปหา ไม่ซ้ำรายชื่อ
        setBulkFailures({ verb, total: targets.length, failed });
        setNotice({ message: `ไม่สำเร็จ ${failed.length} รายการ — ดูรายละเอียดเหนือตาราง`, severity: 'error' });
      }
    } finally {
      bulkRunningRef.current = false;
      setBulkRunning(false);
    }
  };

  // ยอดตั้งต้นเหมือน openPayment: ยอดคงที่เติมยอดที่ยังค้าง, ยอดประมาณการปล่อยว่างให้พิมพ์จากบิลจริง
  // (เหตุผลอยู่ที่ comment ของ openPayment) ส่วนวันที่ใช้วันนี้ เพราะหลายแถวมีวันครบกำหนดคนละวัน
  const openBulkPay = () => {
    if (bulkRunningRef.current) return;
    setBulkPayForm({ paid_date: todayLocal(), bank_account_id: accounts[0] ? String(accounts[0].id) : '' });
    setBulkAmounts(
      Object.fromEntries(
        payPlan.ok.map((i) => [
          i.id,
          i.amount_mode === 'estimated' ? '' : (Math.max(0, i.planned_amount_satang - i.paid_satang) / 100).toFixed(2),
        ]),
      ),
    );
    setFormError('');
    setBulkAction('pay');
  };

  const submitBulkPay = () => {
    if (bulkRunningRef.current) return;
    const { paid_date, bank_account_id } = bulkPayForm;
    if (paid_date === '' || bank_account_id === '') {
      setFormError('เลือกวันที่จ่ายและบัญชีที่จ่าย');
      return;
    }
    const amounts = new Map(payPlan.ok.map((i) => [i.id, parseBahtToSatang(bulkAmounts[i.id] ?? '')]));
    const invalid = payPlan.ok.filter((i) => (amounts.get(i.id) ?? 0) <= 0);
    if (invalid.length > 0) {
      setFormError(`จำนวนเงินไม่ถูกต้อง: ${invalid.map((i) => i.name).join(', ')}`);
      return;
    }
    // ปิด modal ก่อนเริ่ม ผลลัพธ์ไปที่ snackbar — ปุ่มบนแถบยังอยู่ให้ MUI คืน focus ระหว่างรอ
    setBulkAction(null);
    void runBulk(
      payPlan.ok,
      (i) =>
        post(`/api/monthly-plan-items/${i.id}/payments`, {
          amount_satang: amounts.get(i.id),
          paid_date,
          bank_account_id: Number(bank_account_id),
        }),
      'บันทึกการจ่าย',
    );
  };

  const openAddItem = () => {
    setEditingItemId(null);
    setItemForm({ ...EMPTY_ITEM, due_date: '' });
    setFormError('');
    setItemModalOpen(true);
  };

  const openEditItem = (item: PlanItem) => {
    setEditingItemId(item.id);
    setItemForm({
      kind: item.kind,
      name: item.name,
      amount_baht: (item.planned_amount_satang / 100).toFixed(2),
      due_date: item.due_date ?? '',
      category_id: item.category_id == null ? '' : String(item.category_id),
      note: item.note ?? '',
    });
    setFormError('');
    setItemModalOpen(true);
  };

  const submitItem = () => {
    const satang = parseBahtToSatang(itemForm.amount_baht);
    if (satang == null) {
      setFormError('จำนวนเงินไม่ถูกต้อง');
      return;
    }
    const body: Record<string, unknown> = {
      name: itemForm.name,
      planned_amount_satang: satang,
      due_date: itemForm.due_date === '' ? null : itemForm.due_date,
      category_id: itemForm.category_id === '' ? null : Number(itemForm.category_id),
      note: itemForm.note === '' ? null : itemForm.note,
    };
    // kind เปลี่ยนหลังสร้างไม่ได้ (รายจ่ายกับเงินกันไว้คนละความหมายในสูตร §8.2) — ส่งเฉพาะตอนสร้างใหม่
    if (editingItemId == null) body.kind = itemForm.kind;
    void run(
      () =>
        editingItemId == null
          ? post(`/api/monthly-plans/${month}/items`, body)
          : patch(`/api/monthly-plan-items/${editingItemId}`, body),
      editingItemId == null ? 'เพิ่มรายการในแผนแล้ว' : 'บันทึกการแก้ไขแล้ว',
      () => setItemModalOpen(false),
    );
  };

  const openAddRule = () => {
    setEditingRuleId(null);
    setRuleForm({ ...EMPTY_RULE, start_date: `${month}-01` });
    setFormError('');
    setRuleModalOpen(true);
  };

  const openEditRule = (rule: RecurringRule) => {
    setEditingRuleId(rule.id);
    setRuleForm({
      name: rule.name,
      kind: rule.kind,
      amount_mode: rule.amount_mode,
      amount_baht: (rule.amount_satang / 100).toFixed(2),
      frequency_unit: rule.frequency_unit,
      frequency_interval: String(rule.frequency_interval),
      anchor_day: rule.anchor_day == null ? '' : String(rule.anchor_day),
      start_date: rule.start_date,
      end_date: rule.end_date ?? '',
      default_account_id: rule.default_account_id == null ? '' : String(rule.default_account_id),
      category_id: rule.category_id == null ? '' : String(rule.category_id),
    });
    setFormError('');
    setRuleModalOpen(true);
  };

  const submitRule = () => {
    const satang = parseBahtToSatang(ruleForm.amount_baht);
    if (satang == null) {
      setFormError('จำนวนเงินไม่ถูกต้อง');
      return;
    }
    // Number('x') เป็น NaN แล้ว JSON.stringify แปลงเป็น null ทำให้ฝั่ง server coalesce เป็น "ทุก 1"
    // และล้าง anchor_day เงียบ ๆ — ต้องดักที่นี่ให้ผู้ใช้เห็นว่ากรอกอะไรผิด
    const interval = Number(ruleForm.frequency_interval);
    if (!Number.isInteger(interval) || interval < 1 || interval > 366) {
      setFormError('ความถี่ต้องเป็นจำนวนเต็ม 1–366');
      return;
    }
    const anchorDay = ruleForm.anchor_day === '' ? null : Number(ruleForm.anchor_day);
    if (anchorDay != null && (!Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31)) {
      setFormError('วันครบกำหนดต้องเป็นจำนวนเต็ม 1–31');
      return;
    }
    const body: Record<string, unknown> = {
      name: ruleForm.name,
      kind: ruleForm.kind,
      amount_mode: ruleForm.amount_mode,
      amount_satang: satang,
      frequency_unit: ruleForm.frequency_unit,
      frequency_interval: interval,
      anchor_day: anchorDay,
      start_date: ruleForm.start_date,
      end_date: ruleForm.end_date === '' ? null : ruleForm.end_date,
      default_account_id: ruleForm.default_account_id === '' ? null : Number(ruleForm.default_account_id),
      category_id: ruleForm.category_id === '' ? null : Number(ruleForm.category_id),
    };
    void run(
      () =>
        editingRuleId == null
          ? post('/api/recurring-rules', body)
          : patch(`/api/recurring-rules/${editingRuleId}`, body),
      editingRuleId == null ? 'เพิ่มรายการประจำแล้ว' : 'บันทึกรายการประจำแล้ว — มีผลกับเดือนที่ยังไม่สร้างรายการ',
      () => setRuleModalOpen(false),
    );
  };

  // เติมค่าเริ่มต้นให้ครบที่สุดที่รู้: ยอดคงเหลือที่ยังไม่จ่าย, วันครบกำหนด และ "บัญชีที่คาดว่าจะใช้"
  // ของรายการประจำต้นทาง (§9.2) — ถ้าไม่อ่านค่านั้นที่นี่ ช่องนั้นในฟอร์มกฎก็ไม่มีใครใช้เลย
  //
  // ยกเว้นยอด: รายการยอดประมาณการปล่อยช่องว่างให้พิมพ์ยอดจากบิลจริง — reconcile เทียบยอดเป๊ะถึงสตางค์
  // (`t.amount_satang = p.amount_satang`) เติมยอดที่เดาไว้ให้แล้วผู้ใช้กดผ่าน = ประกาศจ่าย 4,000
  // ที่ไม่มี txn ไหนตรง ค้างรอ statement ถาวร ขณะที่เงินออกจริง 3,800 ลอยไม่ถูกจับคู่
  const openPayment = (item: PlanItem) => {
    const remaining = Math.max(0, item.planned_amount_satang - item.paid_satang);
    const rule = item.recurring_rule_id == null ? undefined : rules.find((r) => r.id === item.recurring_rule_id);
    const defaultAccountId = rule?.default_account_id ?? accounts[0]?.id ?? null;
    setPayingItem(item);
    setPaymentForm({
      amount_baht:
        item.amount_mode === 'estimated'
          ? ''
          : ((remaining > 0 ? remaining : item.planned_amount_satang) / 100).toFixed(2),
      paid_date: item.due_date ?? `${month}-01`,
      bank_account_id: defaultAccountId == null ? '' : String(defaultAccountId),
    });
    setFormError('');
  };

  const submitPayment = () => {
    if (!payingItem) return;
    const satang = parseBahtToSatang(paymentForm.amount_baht);
    if (satang == null || satang <= 0) {
      setFormError('จำนวนเงินไม่ถูกต้อง');
      return;
    }
    void run(
      () =>
        post(`/api/monthly-plan-items/${payingItem.id}/payments`, {
          amount_satang: satang,
          paid_date: paymentForm.paid_date,
          bank_account_id: Number(paymentForm.bank_account_id),
        }),
      'บันทึกการจ่ายแล้ว',
      () => setPayingItem(null),
    );
  };

  const summary = plan?.payment_status;
  // payingItem เป็น snapshot ตอนกดปุ่ม — หลัง reload ต้องอ่านของจริงจาก plan ไม่งั้นรายการจ่าย
  // ที่เพิ่งบันทึกหรือเพิ่งยกเลิกจะไม่อัปเดตในกล่องที่ยังเปิดอยู่
  const payingItemLive = payingItem == null ? null : items.find((i) => i.id === payingItem.id) ?? payingItem;

  return (
    // ที่ว่างท้ายหน้าให้พ้นแถบลอย PlanSelectionBar วัดความสูงจริงแล้วเว้นเอง
    <Box>
      <PageHeader
        level={1}
        id="planning-heading"
        title="วางแผนรายเดือน"
        description="รายการประจำ รายการเฉพาะเดือน และการยืนยันการจ่ายกับ statement จริง"
        action={
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }} data-tour="plan-toolbar">
            <Button
              variant="outlined"
              startIcon={<ContentCopyRounded />}
              disabled={closed || submitting || bulkRunning || loading}
              onClick={() => void run(() => post(`/api/monthly-plans/${month}/copy-previous`, {}), 'คัดลอกจากเดือนก่อนแล้ว')}
            >
              คัดลอกเดือนก่อน
            </Button>
            <Button
              ref={addItemButtonRef}
              variant="contained"
              startIcon={<AddRounded />}
              disabled={closed || loading}
              onClick={openAddItem}
            >
              เพิ่มรายการ
            </Button>
          </Stack>
        }
      />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {plan?.data_coverage_note ??
          'ข้อมูลเงินจริงคำนวณจาก Bank Statement ที่นำเข้าสู่ระบบเท่านั้น ไม่รวมเงินสดและ e-Wallet'}
      </Typography>

      <Stack direction="row" spacing={1.5} sx={{ mt: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <MonthPicker value={month} onChange={setMonth} maxMonth={MAX_MONTH} />
        <Button component={Link} to="/installments" variant="outlined">แผนผ่อนและยอดคงเหลือ</Button>
        {/* ระหว่างสลับเดือน `closed` ยังเป็นค่าของเดือนก่อน และถ้าโหลดพลาด (plan == null) ก็ไม่รู้สถานะ
            เลย — ปุ่มล็อกจึงต้องรอให้ plan ของเดือนนี้มาถึงก่อน ไม่งั้นกดปิด/เปิดใส่เดือนผิดได้ */}
        {plan != null && !loading && (
          closed ? (
            <Button
              variant="outlined"
              startIcon={<LockOpenOutlined />}
              disabled={submitting || bulkRunning}
              onClick={() => void run(() => post(`/api/monthly-plans/${month}/reopen`, {}), 'เปิดเดือนนี้ให้แก้ได้แล้ว')}
            >
              เปิดเดือนนี้อีกครั้ง
            </Button>
          ) : (
            <Button
              variant="outlined"
              startIcon={<LockOutlined />}
              disabled={submitting || bulkRunning}
              onClick={() => setClosing(true)}
            >
              ปิดเดือนนี้
            </Button>
          )
        )}
      </Stack>

      {closed && !loading && (
        <Alert severity="info" sx={{ mt: 2, ...descriptionSx }}>
          เดือนนี้ปิดแล้ว แก้รายการไม่ได้จนกดเปิดอีกครั้ง — statement ที่มาถึงภายหลังยังจับคู่กับรายการที่ประกาศจ่ายไว้ได้
          ตัวเลขด้านล่างคำนวณสดจากข้อมูลล่าสุดเสมอ ไม่ใช่ภาพนิ่งตอนปิดเดือน
        </Alert>
      )}

      {error && <LoadError message={error} onRetry={plan == null ? () => void reload() : undefined} />}

      {loading ? (
        <TableSkeleton rows={8} />
      ) : plan == null ? null : (
        <Stack spacing={4} sx={{ mt: 3 }}>
          <Box component="section" aria-labelledby="plan-totals-heading">
            <Typography variant="h2" id="plan-totals-heading" sx={{ fontSize: '1.25rem', mb: 1.5 }}>
              สรุปตามแผน
            </Typography>
            {/* minmax(0, 1fr) ไม่ใช่ 1fr เฉย ๆ — 1fr มี min เป็น auto ยอดเงินยาว ๆ จะดันคอลัมน์จนล้นจอ 320px
                มือถือ 2 คอลัมน์ ใบที่ 5 (เงินเหลือใช้ = ผลลัพธ์) กินเต็มแถวแทนที่จะค้างอยู่ครึ่งแถว */}
            <Box
              sx={{
                display: 'grid',
                gap: { xs: 1.5, md: 2 },
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
              }}
            >
              <SummaryCard dense title="รายได้เต็มตามแผน" value={<Money satang={plan.totals.planned_income_satang} tone="income" />} />
              <SummaryCard dense title="รายการหักจากรายได้" value={<Money satang={plan.totals.planned_deduction_satang} />} />
              <SummaryCard dense title="ค่าใช้จ่ายตามแผน" value={<Money satang={plan.totals.planned_expense_satang} tone="expense" />} />
              <SummaryCard
                dense
                title="เงินกันไว้"
                value={<Money satang={plan.totals.planned_reserve_satang} />}
                caption="กันงบไว้ ไม่ใช่รายจ่าย และไม่ลดยอดคงเหลือในบัญชี"
              />
              <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, minWidth: 0, display: 'grid' }}>
                <SummaryCard
                  dense
                  title="เงินเหลือใช้ตามแผน"
                  value={
                    // Money แสดงค่าสัมบูรณ์ ติดลบต้องมี "−" ด้วย ไม่ใช่บอกด้วยสีแดงอย่างเดียว (Semantic Color Rule)
                    <Money
                      satang={plan.totals.planned_available_satang}
                      tone={plan.totals.planned_available_satang < 0 ? 'expense' : 'income'}
                      showSign={plan.totals.planned_available_satang < 0}
                    />
                  }
                  caption="รายได้เต็ม − รายการหัก − รายจ่ายตามแผน − เงินกันไว้"
                />
              </Box>
            </Box>
          </Box>

          {summary && summary.total_count > 0 && (
            <Box component="section" aria-labelledby="plan-payment-heading">
              <Typography variant="h2" id="plan-payment-heading" sx={{ fontSize: '1.25rem', mb: 1.5 }}>
                สถานะการจ่ายบิล
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                {/* กดชิป = กรองตาราง "รายการของเดือนนี้" ด้านล่าง (ท่าเดียวกับชิปใน Transactions.tsx)
                    ชิปที่เลือกใช้ accent ตาม Restrained Accent Rule (selection) ส่วนสีสถานะเดิมคงไว้เป็นเส้นขอบ */}
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {(
                    [
                      ['in_plan', 'ต้องจ่ายทั้งหมด', summary.total_count, 'default'],
                      ['unpaid', 'ยังไม่จ่าย', summary.unpaid_count, 'default'],
                      ['overdue', 'เกินกำหนด', summary.overdue_count, summary.overdue_count > 0 ? 'error' : 'default'],
                      ['partial', 'จ่ายบางส่วน', summary.partial_count, 'default'],
                      ['paid', 'จ่ายแล้ว', summary.paid_count, summary.paid_count > 0 ? 'success' : 'default'],
                    ] as const
                  ).map(([status, label, count, color]) => {
                    const on = chipOn(status);
                    return (
                      <Chip
                        key={status}
                        label={`${label} ${count}`}
                        variant={on ? 'filled' : 'outlined'}
                        color={on ? 'primary' : color}
                        aria-pressed={on}
                        onClick={() => toggleChip(status)}
                        sx={{ minHeight: 40 }}
                      />
                    );
                  })}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  จ่ายแล้ว <Money satang={summary.paid_satang} /> จากยอดตามแผน <Money satang={summary.total_due_satang} />
                </Typography>
              </Paper>
            </Box>
          )}

          <IncomeSection key={month} month={month} closed={closed} items={items} onChanged={() => reload(true)} />

          <Box component="section" aria-labelledby="plan-items-heading">
            <Typography variant="h2" id="plan-items-heading" sx={{ fontSize: '1.25rem', mb: 1.5 }}>
              รายการของเดือนนี้
            </Typography>
            {/* อยู่นอกเงื่อนไขของตาราง ให้เห็นแม้ตัวกรองซ่อนทุกแถว — tabIndex -1 รับ focus หลังงานแบบกลุ่มจบ */}
            {bulkFailures && (
              <Alert severity="error" ref={failureAlertRef} tabIndex={-1} onClose={() => setBulkFailures(null)} closeText="ปิด" sx={{ mb: 1.5 }}>
                <AlertTitle>
                  {bulkFailures.verb}สำเร็จ {bulkFailures.total - bulkFailures.failed.length} จาก {bulkFailures.total} รายการ —
                  ไม่สำเร็จ {bulkFailures.failed.length} รายการ
                </AlertTitle>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {bulkFailures.failed.map(({ item, message }) => (
                    <li key={item.id}>
                      {item.name} — {message}
                    </li>
                  ))}
                </Box>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  รายการที่ไม่สำเร็จยังเลือกค้างไว้ แก้แล้วกดซ้ำได้
                </Typography>
              </Alert>
            )}
            {items.length === 0 ? (
              <EmptyState
                icon={<EventRepeatRounded sx={{ fontSize: 40 }} />}
                title="ยังไม่มีรายการในแผนเดือนนี้"
                description="เพิ่มรายการเฉพาะเดือน คัดลอกจากเดือนก่อน หรือสร้างรายการประจำเพื่อให้ระบบสร้างให้ทุกเดือน"
                action={
                  <Button variant="contained" startIcon={<AddRounded />} disabled={closed} onClick={openAddItem}>
                    เพิ่มรายการแรก
                  </Button>
                }
              />
            ) : (
              <>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
                  <TextField select size="small" label="ประเภท" value={itemFilter.kind} onChange={setItemFilterField('kind')} sx={{ minWidth: 160, flexGrow: { xs: 1, sm: 0 } }}>
                    <MenuItem value="">ทุกประเภท</MenuItem>
                    {KINDS.map((k) => (
                      <MenuItem key={k.value} value={k.value}>
                        {k.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField select size="small" label="หมวด" value={itemFilter.category} onChange={setItemFilterField('category')} sx={{ minWidth: 160, flexGrow: { xs: 1, sm: 0 } }}>
                    <MenuItem value="">ทุกหมวด</MenuItem>
                    {itemCategoryOptions.map(([id, name]) => (
                      <MenuItem key={id} value={id}>
                        {name}
                      </MenuItem>
                    ))}
                    <MenuItem value={NO_CATEGORY}>ไม่ระบุ</MenuItem>
                  </TextField>
                  <TextField select size="small" label="สถานะ" value={itemFilter.status} onChange={setItemFilterField('status')} sx={{ minWidth: 200, flexGrow: { xs: 1, sm: 0 } }}>
                    <MenuItem value="">ทุกสถานะ</MenuItem>
                    <MenuItem value="in_plan">อยู่ในแผน (ไม่รวมข้าม/ยกเลิก)</MenuItem>
                    {STATUS_ORDER.map((s) => (
                      <MenuItem key={s} value={s}>
                        {PAYMENT_STATE_LABEL[s]}
                      </MenuItem>
                    ))}
                  </TextField>
                  {itemFilterActive && (
                    <Button color="inherit" onClick={() => setItemFilter(EMPTY_ITEM_FILTER)}>
                      ล้างตัวกรอง
                    </Button>
                  )}
                  <Typography variant="body2" color="text.secondary" role="status">
                    แสดง {visibleItems.length} จาก {items.length} รายการ
                  </Typography>
                </Stack>
                {visibleItems.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary" sx={descriptionSx}>
                      ไม่มีรายการที่ตรงกับตัวกรอง
                    </Typography>
                    <Button sx={{ mt: 1.5 }} onClick={() => setItemFilter(EMPTY_ITEM_FILTER)}>
                      ล้างตัวกรอง
                    </Button>
                  </Paper>
                ) : (
                  <TableContainer component={Paper} variant="outlined" tabIndex={0}>
                    {/* คอลัมน์จัดการ padding 6px: ชดเชย 8px ที่ spacing 0.5 ระหว่างปุ่มเพิ่ม (4 ช่องว่าง × 2px)
                        ให้ความกว้างเท่าเดิม ตารางยังพอดีที่ 1200px — selector ต้องเจาะจงกว่า COMPACT_CELLS */}
                    <Table
                      size="small"
                      aria-label="รายการในแผนเดือนนี้"
                      sx={{ minWidth: 880, ...COMPACT_CELLS, '& .MuiTableCell-root:not(.MuiTableCell-paddingCheckbox):last-child': { px: 0.75 } }}
                    >
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox" sx={{ py: 0.5, px: 1 }}>
                            <Checkbox
                              id="plan-select-all"
                              checked={allVisibleSelected}
                              indeterminate={selectedVisibleCount > 0 && !allVisibleSelected}
                              onChange={toggleAllVisible}
                              slotProps={{ input: { 'aria-label': 'เลือกทุกรายการที่แสดงอยู่' } }}
                            />
                          </TableCell>
                          <SortCell sortKey="kind" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))}>ประเภท</SortCell>
                          <SortCell sortKey="name" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))}>รายการ</SortCell>
                          <SortCell sortKey="category" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))}>หมวด</SortCell>
                          <SortCell sortKey="due_date" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))}>ครบกำหนด</SortCell>
                          <SortCell sortKey="planned" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))} align="right">ตามแผน</SortCell>
                          <SortCell sortKey="paid" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))} align="right">จ่ายแล้ว</SortCell>
                          <SortCell sortKey="status" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))}>สถานะ</SortCell>
                          <TableCell align="right">จัดการ</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visibleItems.map((item) => {
                          const inactive = item.explicit_status !== 'active';
                          const isSelected = selected.has(item.id);
                          return (
                            <TableRow key={item.id} hover selected={isSelected}>
                              {/* เลือกผ่าน checkbox เท่านั้น ไม่ใช่คลิกทั้งแถว — แถวมีปุ่มจัดการอยู่แล้ว คลิกพลาดจะเลือกแถวโดยไม่ตั้งใจ */}
                              <TableCell padding="checkbox" sx={{ py: 0.5, px: 1 }}>
                                <Checkbox
                                  checked={isSelected}
                                  onChange={() => toggleSelected(item.id)}
                                  slotProps={{ input: { 'aria-label': `เลือก ${item.name}` } }}
                                />
                              </TableCell>
                              <TableCell>{KIND_LABEL[item.kind]}</TableCell>
                              <TableCell>
                                {item.name}
                                {item.recurring_rule_id != null && (
                                  <Chip size="small" label="ประจำ" variant="outlined" sx={{ ml: 1 }} />
                                )}
                              </TableCell>
                              <TableCell>{item.category_name ?? '—'}</TableCell>
                              <TableCell sx={dataTextSx}>{item.due_date ? formatDate(item.due_date) : '—'}</TableCell>
                              <TableCell align="right">
                                <Money satang={item.planned_amount_satang} />
                              </TableCell>
                              <TableCell align="right">
                                {item.paid_satang > 0 ? <Money satang={item.paid_satang} /> : '—'}
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                                  <PaymentStatusChip state={item.payment_state} />
                                  {/* ยอดประมาณการไม่มีสถานะ partial แล้ว สถานะจึงไม่บอกว่ายอดจริงต่าง
                                      จากที่เดาไว้เท่าไร ต้องโชว์ตรงนี้ — คิดสดจาก paid − planned ไม่มี
                                      field ใหม่จาก API ไม่ใส่สี เพราะสูง/ต่ำกว่าประมาณไม่ใช่ดี/ร้าย
                                      (เหตุผลเดียวกับ comment ใน PaymentStatusChip.tsx)

                                      ข้าม item ที่ผูก income_record: `planned_amount_satang` ของมันคือ
                                      ยอดเต็ม แต่ payment คือยอดสุทธิ ส่วนต่างจึงเป็นรายการหัก ไม่ใช่
                                      การประมาณคลาด — ยอดเต็ม/หัก/สุทธิ ดูได้ในตาราง "รายได้และรายการหัก" */}
                                  {item.amount_mode === 'estimated' &&
                                    item.income_record_id == null &&
                                    item.paid_satang > 0 &&
                                    item.paid_satang !== item.planned_amount_satang && (
                                      <Typography variant="caption" color="text.secondary">
                                        {item.paid_satang < item.planned_amount_satang
                                          ? 'ต่ำกว่าประมาณ '
                                          : 'สูงกว่าประมาณ '}
                                        <Money satang={item.paid_satang - item.planned_amount_satang} />
                                      </Typography>
                                    )}
                                </Stack>
                              </TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                                  {/* "จ่ายแล้ว" เป็นปุ่มของรายจ่าย/เงินกันไว้เท่านั้น — เงินเข้าต้องบันทึกที่
                                      "รายได้และรายการหัก" เพื่อแยกยอดเต็มออกจากยอดสุทธิ (ADR-0002 ข้อ 5)
                                      เดิมปุ่มนี้กดบนรายการรายได้ได้ แล้วประกาศจ่ายยอดสุทธิที่เข้าบัญชีจริง
                                      (26,125) ไปเทียบกับยอดเต็มตามแผน (27,000) → ค้าง "จ่ายบางส่วน"
                                      รายการหักจากเงินเดือนไม่มีปุ่มอะไรเลย เงินไม่ได้ออกจากบัญชีเรา
                                      มันขึ้น "หักจากรายได้" เองเมื่อถูกผูกจากฟอร์มรายได้

                                      เงื่อนไข `paid_satang === 0`: แถวที่ยังมีประกาศจ่ายค้างอยู่ต้องเหลือ
                                      ปุ่ม "จ่ายแล้ว" ไว้ เพราะปุ่มยกเลิกการประกาศจ่ายอยู่ใน modal นั้น
                                      ที่เดียว ถ้าสลับเป็น anchor ทั้งหมด จะยกเลิกของเก่าไม่ได้ และ
                                      dropdown ในฟอร์มรายได้ซ่อนรายการที่ยังมี payment อยู่ = ตัน
                                      ยกเลิกแล้ว paid_satang กลับเป็น 0 ปุ่มจะสลับเป็น anchor ให้เอง */}
                                  {item.kind === 'income' && item.income_record_id == null && item.paid_satang === 0 ? (
                                    <Button size="small" startIcon={<PaidRounded />} href="#income-heading" disabled={closed || inactive || bulkRunning} sx={{ whiteSpace: 'nowrap' }}>
                                      บันทึกรายได้เต็ม
                                    </Button>
                                  ) : item.kind === 'payroll_deduction' &&
                                    item.income_record_id == null &&
                                    item.paid_satang === 0 ? null : (
                                    <Button
                                      size="small"
                                      startIcon={<PaidRounded />}
                                      disabled={closed || inactive || item.income_record_id != null || item.installment_due_id != null || bulkRunning}
                                      onClick={() => openPayment(item)}
                                      sx={{ whiteSpace: 'nowrap' }}
                                    >
                                      จ่ายแล้ว
                                    </Button>
                                  )}
                                  <RowIconButton
                                    label="แก้ไข"
                                    disabled={closed || item.income_record_id != null || item.installment_due_id != null || bulkRunning}
                                    onClick={() => openEditItem(item)}
                                  >
                                    <EditRounded fontSize="small" />
                                  </RowIconButton>
                                  {inactive ? (
                                    <RowIconButton
                                      label="เอากลับเข้าแผน"
                                      color="inherit"
                                      disabled={closed || item.income_record_id != null || item.installment_due_id != null || bulkRunning}
                                      onClick={() =>
                                        void run(
                                          () => patch(`/api/monthly-plan-items/${item.id}`, { explicit_status: 'active' }),
                                          'เอารายการกลับเข้าแผนแล้ว',
                                        )
                                      }
                                    >
                                      <ReplayRounded fontSize="small" />
                                    </RowIconButton>
                                  ) : (
                                    <RowIconButton
                                      label="ข้าม"
                                      color="inherit"
                                      disabled={closed || item.income_record_id != null || item.installment_due_id != null || bulkRunning}
                                      onClick={() =>
                                        void run(
                                          () => post(`/api/monthly-plan-items/${item.id}/skip`, {}),
                                          'ข้ามรายการนี้แล้ว',
                                        )
                                      }
                                    >
                                      <SkipNextRounded fontSize="small" />
                                    </RowIconButton>
                                  )}
                                  <RowIconButton
                                    label="ลบ"
                                    color="error"
                                    disabled={closed || item.income_record_id != null || item.installment_due_id != null || bulkRunning}
                                    onClick={() =>
                                      void run(
                                        () => del(`/api/monthly-plan-items/${item.id}`),
                                        'ลบรายการแล้ว',
                                      )
                                    }
                                  >
                                    <DeleteOutlineRounded fontSize="small" />
                                  </RowIconButton>
                                  {item.income_record_id != null && <Typography variant="body2" color="text.secondary">จัดการในรายได้ด้านบน</Typography>}
                                  {item.installment_due_id != null && <Button component={Link} to="/installments" sx={{ whiteSpace: 'nowrap' }}>ดูแผนผ่อน</Button>}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </Box>

          <Box component="section" aria-labelledby="plan-rules-heading">
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="h2" id="plan-rules-heading" sx={{ fontSize: '1.25rem' }}>
                รายการประจำ
              </Typography>
              <Button variant="outlined" size="small" startIcon={<AddRounded />} onClick={openAddRule}>
                เพิ่มรายการประจำ
              </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, ...descriptionSx }}>
              ระบบสร้างรายการให้ทุกเดือนที่เปิดดู การแก้กฎมีผลกับเดือนที่ยังไม่ได้สร้างรายการเท่านั้น
              ไม่ย้อนแก้เดือนที่ตรวจหรือปิดไปแล้ว
            </Typography>
            {activeRules.length === 0 ? (
              <EmptyState
                icon={<EventRepeatRounded sx={{ fontSize: 40 }} />}
                title="ยังไม่มีรายการประจำ"
                description="เช่น ค่าเช่าบ้านทุกวันที่ 5 หรือเบี้ยประกันทุกปี — สร้างครั้งเดียวแล้วระบบสร้างรายการให้ทุกเดือน"
              />
            ) : (
              <>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
                  <TextField select size="small" label="ประเภท" value={ruleFilter.kind} onChange={setRuleFilterField('kind')} sx={{ minWidth: 160, flexGrow: { xs: 1, sm: 0 } }}>
                    <MenuItem value="">ทุกประเภท</MenuItem>
                    {KINDS.map((k) => (
                      <MenuItem key={k.value} value={k.value}>
                        {k.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField select size="small" label="หมวด" value={ruleFilter.category} onChange={setRuleFilterField('category')} sx={{ minWidth: 160, flexGrow: { xs: 1, sm: 0 } }}>
                    <MenuItem value="">ทุกหมวด</MenuItem>
                    {ruleCategoryOptions.map(([id, name]) => (
                      <MenuItem key={id} value={id}>
                        {name}
                      </MenuItem>
                    ))}
                    <MenuItem value={NO_CATEGORY}>ไม่ระบุ</MenuItem>
                  </TextField>
                  <TextField select size="small" label="ชนิดยอด" value={ruleFilter.amount_mode} onChange={setRuleFilterField('amount_mode')} sx={{ minWidth: 160, flexGrow: { xs: 1, sm: 0 } }}>
                    <MenuItem value="">ทุกชนิด</MenuItem>
                    <MenuItem value="fixed">ยอดคงที่</MenuItem>
                    <MenuItem value="estimated">ยอดประมาณการ</MenuItem>
                  </TextField>
                  {ruleFilterActive && (
                    <Button color="inherit" onClick={() => setRuleFilter(EMPTY_RULE_FILTER)}>
                      ล้างตัวกรอง
                    </Button>
                  )}
                  <Typography variant="body2" color="text.secondary" role="status">
                    แสดง {visibleRules.length} จาก {activeRules.length} รายการ
                  </Typography>
                </Stack>
                {visibleRules.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary" sx={descriptionSx}>
                      ไม่มีรายการประจำที่ตรงกับตัวกรอง
                    </Typography>
                    <Button sx={{ mt: 1.5 }} onClick={() => setRuleFilter(EMPTY_RULE_FILTER)}>
                      ล้างตัวกรอง
                    </Button>
                  </Paper>
                ) : (
                  <TableContainer component={Paper} variant="outlined" tabIndex={0}>
                    <Table size="small" aria-label="รายการประจำ" sx={{ minWidth: 800, ...COMPACT_CELLS }}>
                      <TableHead>
                        <TableRow>
                          <SortCell sortKey="kind" sort={ruleSort} onSort={(k) => setRuleSort((s) => nextSort(s, k))}>ประเภท</SortCell>
                          <SortCell sortKey="name" sort={ruleSort} onSort={(k) => setRuleSort((s) => nextSort(s, k))}>ชื่อ</SortCell>
                          <SortCell sortKey="category" sort={ruleSort} onSort={(k) => setRuleSort((s) => nextSort(s, k))}>หมวด</SortCell>
                          <SortCell sortKey="frequency" sort={ruleSort} onSort={(k) => setRuleSort((s) => nextSort(s, k))}>ความถี่</SortCell>
                          <SortCell sortKey="start_date" sort={ruleSort} onSort={(k) => setRuleSort((s) => nextSort(s, k))}>ช่วงที่ใช้</SortCell>
                          <SortCell sortKey="amount" sort={ruleSort} onSort={(k) => setRuleSort((s) => nextSort(s, k))} align="right">ยอด</SortCell>
                          <TableCell align="right">จัดการ</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visibleRules.map((rule) => (
                          <TableRow key={rule.id} hover>
                            <TableCell>{KIND_LABEL[rule.kind]}</TableCell>
                            <TableCell>{rule.name}</TableCell>
                            <TableCell>{rule.category_name ?? '—'}</TableCell>
                            <TableCell>
                              ทุก {rule.frequency_interval} {UNITS.find((u) => u.value === rule.frequency_unit)?.label}
                              {rule.anchor_day != null && ` (วันที่ ${rule.anchor_day})`}
                            </TableCell>
                            <TableCell sx={dataTextSx}>
                              {formatDate(rule.start_date)} – {rule.end_date ? formatDate(rule.end_date) : 'ไม่กำหนด'}
                            </TableCell>
                            <TableCell align="right">
                              <Money satang={rule.amount_satang} />
                              {rule.amount_mode === 'estimated' && (
                                <Chip size="small" label="ประมาณการ" variant="outlined" sx={{ ml: 1 }} />
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                                <RowIconButton label="แก้ไข" onClick={() => openEditRule(rule)}>
                                  <EditRounded fontSize="small" />
                                </RowIconButton>
                                {/* ไม่มี unarchive ใน API (ดู docs/status.md) ย้อนกลับจากหน้าจอไม่ได้ ต้องถามก่อน */}
                                <RowIconButton label="เลิกใช้" color="error" onClick={() => setArchivingRule(rule)}>
                                  <ArchiveOutlined fontSize="small" />
                                </RowIconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </Box>
        </Stack>
      )}

      <Modal
        open={itemModalOpen}
        title={editingItemId == null ? 'เพิ่มรายการในแผน' : 'แก้ไขรายการในแผน'}
        onClose={() => setItemModalOpen(false)}
        busy={submitting}
      >
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            submitItem();
          }}
        >
          <Stack spacing={2.5}>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
              <TextField
                select
                label="ประเภท"
                value={itemForm.kind}
                onChange={setItemField('kind')}
                disabled={editingItemId != null}
                helperText={editingItemId == null ? 'เงินกันไว้ไม่นับเป็นรายจ่าย' : 'เปลี่ยนประเภทหลังสร้างไม่ได้'}
                required
              >
                {KINDS.map((k) => (
                  <MenuItem key={k.value} value={k.value}>
                    {k.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="ชื่อรายการ" value={itemForm.name} onChange={setItemField('name')} required slotProps={{ htmlInput: { maxLength: 120 } }} />
              <TextField
                label="จำนวนเงิน (บาท)"
                value={itemForm.amount_baht}
                onChange={setItemField('amount_baht')}
                required
                error={itemForm.amount_baht !== '' && parseBahtToSatang(itemForm.amount_baht) == null}
                helperText={itemForm.amount_baht !== '' && parseBahtToSatang(itemForm.amount_baht) == null ? 'กรอกเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง' : ' '}
                slotProps={{ htmlInput: { inputMode: 'decimal', sx: dataTextSx } }}
              />
              <TextField
                type="date"
                label="ครบกำหนด (ไม่บังคับ)"
                value={itemForm.due_date}
                onChange={setItemField('due_date')}
                helperText="ต้องอยู่ในเดือนของแผนนี้"
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: `${month}-01`, sx: dataTextSx } }}
              />
              <TextField select label="หมวด (ไม่บังคับ)" value={itemForm.category_id} onChange={setItemField('category_id')}>
                <MenuItem value="">
                  <em>— ไม่ระบุ —</em>
                </MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="บันทึกเพิ่มเติม" value={itemForm.note} onChange={setItemField('note')} slotProps={{ htmlInput: { maxLength: 500 } }} />
            </Box>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button type="button" color="inherit" onClick={() => setItemModalOpen(false)} disabled={submitting}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="contained" disabled={submitting} aria-busy={submitting}>
                {submitting ? 'กำลังบันทึก…' : 'บันทึก'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Modal>

      <Modal
        open={ruleModalOpen}
        title={editingRuleId == null ? 'เพิ่มรายการประจำ' : 'แก้ไขรายการประจำ'}
        onClose={() => setRuleModalOpen(false)}
        busy={submitting}
      >
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            submitRule();
          }}
        >
          <Stack spacing={2.5}>
            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1.5, color: 'text.primary', fontWeight: 650 }}>
                รายการและยอด
              </FormLabel>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
                <TextField select label="ประเภท" value={ruleForm.kind} onChange={setRuleField('kind')} required>
                  {KINDS.map((k) => (
                    <MenuItem key={k.value} value={k.value}>
                      {k.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="ชื่อรายการ" value={ruleForm.name} onChange={setRuleField('name')} required slotProps={{ htmlInput: { maxLength: 120 } }} />
                <TextField
                  label="จำนวนเงิน (บาท)"
                  value={ruleForm.amount_baht}
                  onChange={setRuleField('amount_baht')}
                  required
                  error={ruleForm.amount_baht !== '' && parseBahtToSatang(ruleForm.amount_baht) == null}
                  slotProps={{ htmlInput: { inputMode: 'decimal', sx: dataTextSx } }}
                />
                <TextField select label="ชนิดยอด" value={ruleForm.amount_mode} onChange={setRuleField('amount_mode')}>
                  <MenuItem value="fixed">ยอดคงที่</MenuItem>
                  <MenuItem value="estimated">ยอดประมาณการ</MenuItem>
                </TextField>
              </Box>
            </Box>

            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1.5, color: 'text.primary', fontWeight: 650 }}>
                ความถี่
              </FormLabel>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
                <TextField
                  label="ทุกกี่ครั้ง"
                  value={ruleForm.frequency_interval}
                  onChange={setRuleField('frequency_interval')}
                  required
                  slotProps={{ htmlInput: { inputMode: 'numeric', sx: dataTextSx } }}
                />
                <TextField select label="หน่วย" value={ruleForm.frequency_unit} onChange={setRuleField('frequency_unit')} required>
                  {UNITS.map((u) => (
                    <MenuItem key={u.value} value={u.value}>
                      {u.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="วันครบกำหนด (1–31)"
                  value={ruleForm.anchor_day}
                  onChange={setRuleField('anchor_day')}
                  disabled={ruleForm.frequency_unit === 'day' || ruleForm.frequency_unit === 'week'}
                  helperText="ตั้ง 29–31 ได้ เดือนที่ไม่มีวันนั้นจะใช้วันสุดท้ายของเดือน"
                  slotProps={{ htmlInput: { inputMode: 'numeric', sx: dataTextSx } }}
                />
                <TextField
                  type="date"
                  label="วันเริ่มต้น"
                  value={ruleForm.start_date}
                  onChange={setRuleField('start_date')}
                  required
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { sx: dataTextSx } }}
                />
                <TextField
                  type="date"
                  label="วันสิ้นสุด (ไม่บังคับ)"
                  value={ruleForm.end_date}
                  onChange={setRuleField('end_date')}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { sx: dataTextSx } }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
              <TextField select label="บัญชีที่คาดว่าจะใช้" value={ruleForm.default_account_id} onChange={setRuleField('default_account_id')}>
                <MenuItem value="">
                  <em>— ไม่ระบุ —</em>
                </MenuItem>
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.nickname}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="หมวด (ไม่บังคับ)" value={ruleForm.category_id} onChange={setRuleField('category_id')}>
                <MenuItem value="">
                  <em>— ไม่ระบุ —</em>
                </MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button type="button" color="inherit" onClick={() => setRuleModalOpen(false)} disabled={submitting}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="contained" disabled={submitting} aria-busy={submitting}>
                {submitting ? 'กำลังบันทึก…' : 'บันทึก'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Modal>

      <Modal
        open={payingItem != null}
        title={`บันทึกการจ่าย — ${payingItemLive?.name ?? ''}`}
        onClose={() => setPayingItem(null)}
        busy={submitting}
      >
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            submitPayment();
          }}
        >
          <Stack spacing={2.5}>
            <Alert severity="info" sx={descriptionSx}>
              {/* ADR-0004: การประกาศจ่ายนับเป็นยอดจ่ายทันที ไม่มีขั้นรอจับคู่กับ statement */}
              การบันทึกนี้เป็นการประกาศว่าจ่ายแล้ว ระบบ<strong>ไม่สร้างรายการธุรกรรมปลอม</strong> นับเป็นยอดจ่ายทันที
              ไม่ผูกกับ statement จ่ายบางส่วนบันทึกหลายครั้งได้
            </Alert>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
              <TextField
                label="จำนวนเงินที่จ่าย (บาท)"
                value={paymentForm.amount_baht}
                onChange={setPaymentField('amount_baht')}
                required
                error={paymentForm.amount_baht !== '' && parseBahtToSatang(paymentForm.amount_baht) == null}
                slotProps={{ htmlInput: { inputMode: 'decimal', sx: dataTextSx } }}
              />
              <TextField
                type="date"
                label="วันที่จ่าย"
                value={paymentForm.paid_date}
                onChange={setPaymentField('paid_date')}
                required
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { sx: dataTextSx } }}
              />
              <TextField select label="บัญชีที่จ่าย" value={paymentForm.bank_account_id} onChange={setPaymentField('bank_account_id')} required>
                <MenuItem value="">
                  <em>— เลือก —</em>
                </MenuItem>
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.nickname}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {payingItemLive != null && payingItemLive.payments.length > 0 && (
              <Box component="section" aria-labelledby="payment-history-heading">
                <Typography component="h3" id="payment-history-heading" variant="body2" sx={{ fontWeight: 650, mb: 1 }}>
                  ที่ประกาศจ่ายไว้แล้ว
                </Typography>
                <Stack spacing={1}>
                  {payingItemLive.payments.map((p) => (
                    <Paper key={p.id} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
                      >
                        <Box>
                          <Money satang={p.amount_satang} />
                          <Typography variant="body2" color="text.secondary">
                            <Box component="span" sx={dataTextSx}>
                              {formatDate(p.paid_date)}
                            </Box>{' '}
                            · {p.account_nickname} ·{' '}
                            {p.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'บันทึกไว้แล้ว'}
                          </Typography>
                        </Box>
                        {p.status !== 'cancelled' && (
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteOutlineRounded />}
                            disabled={submitting}
                            onClick={() =>
                              void run(
                                () => patch(`/api/monthly-item-payments/${p.id}`, { status: 'cancelled' }),
                                'ยกเลิกการประกาศจ่ายแล้ว',
                              )
                            }
                          >
                            ยกเลิก
                          </Button>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}

            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button type="button" color="inherit" onClick={() => setPayingItem(null)} disabled={submitting}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="contained" disabled={submitting} aria-busy={submitting}>
                {submitting ? 'กำลังบันทึก…' : 'บันทึกการจ่าย'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Modal>

      <ConfirmDialog
        open={closing}
        title="ปิดเดือนนี้"
        description="ปิดเดือนแล้วจะแก้รายการไม่ได้จนกดเปิดอีกครั้ง ระบบจะเก็บภาพสรุปตอนปิดไว้ตรวจย้อนหลัง — statement ที่มาถึงภายหลังยังจับคู่กับการจ่ายที่ประกาศไว้ได้ตามปกติ"
        confirmLabel="ปิดเดือน"
        confirmColor="warning"
        busy={submitting}
        onClose={() => setClosing(false)}
        onConfirm={() =>
          void run(() => post(`/api/monthly-plans/${month}/close`, {}), 'ปิดเดือนแล้ว', () => {
            setClosing(false);
            // ปุ่ม "ปิดเดือนนี้" ถูกแทนด้วยปุ่มเปิดเดือนแล้ว element ต้นทางไม่มีอยู่ให้คืน focus
            addItemButtonRef.current?.focus();
          })
        }
      />

      <ConfirmDialog
        open={archivingRule != null}
        title="เลิกใช้รายการประจำ"
        description={`เลิกใช้ "${archivingRule?.name ?? ''}" หรือไม่? เดือนถัดไปจะไม่สร้างรายการนี้ให้อีก รายการที่สร้างไว้แล้วยังอยู่ครบ — ตอนนี้ยังไม่มีปุ่มเปิดใช้กลับ ต้องสร้างกฎใหม่`}
        confirmLabel="เลิกใช้"
        confirmColor="error"
        busy={submitting}
        onClose={() => setArchivingRule(null)}
        onConfirm={() => {
          if (!archivingRule) return;
          void run(
            () => post(`/api/recurring-rules/${archivingRule.id}/archive`, {}),
            'ปิดใช้งานรายการประจำแล้ว — รายการที่สร้างไว้แล้วยังอยู่',
            () => setArchivingRule(null),
          );
        }}
      />

      <Modal
        open={bulkAction === 'pay'}
        title={`บันทึกการจ่าย ${payPlan.ok.length} รายการ`}
        onClose={() => setBulkAction(null)}
        busy={bulkRunning}
      >
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            submitBulkPay();
          }}
        >
          <Stack spacing={2.5}>
            <Alert severity="info" sx={descriptionSx}>
              การบันทึกนี้เป็นการประกาศว่าจ่ายแล้ว ระบบ<strong>ไม่สร้างรายการธุรกรรมปลอม</strong> นับเป็นยอดจ่ายทันที
              ไม่ผูกกับ statement
            </Alert>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
              <TextField
                type="date"
                label="วันที่จ่าย"
                value={bulkPayForm.paid_date}
                onChange={setBulkPayField('paid_date')}
                required
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { sx: dataTextSx } }}
              />
              <TextField select label="บัญชีที่จ่าย" value={bulkPayForm.bank_account_id} onChange={setBulkPayField('bank_account_id')} required>
                <MenuItem value="">
                  <em>— เลือก —</em>
                </MenuItem>
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.nickname}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Stack spacing={2} component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
              {payPlan.ok.map((i) => {
                const value = bulkAmounts[i.id] ?? '';
                const invalid = value !== '' && parseBahtToSatang(value) == null;
                return (
                  <Box
                    component="li"
                    key={i.id}
                    sx={{ display: 'grid', gap: 1, alignItems: 'center', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 14rem' } }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 650, overflowWrap: 'anywhere' }}>{i.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {i.amount_mode === 'estimated' ? 'ยอดประมาณการ — กรอกยอดจากบิลจริง' : 'ยอดคงที่'}
                      </Typography>
                    </Box>
                    <TextField
                      size="small"
                      label="ยอดที่จ่าย (บาท)"
                      value={value}
                      onChange={(e) => setBulkAmounts((prev) => ({ ...prev, [i.id]: e.target.value }))}
                      required
                      error={invalid}
                      slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': `ยอดที่จ่าย (บาท) — ${i.name}`, sx: dataTextSx } }}
                    />
                  </Box>
                );
              })}
            </Stack>

            {payPlan.excluded.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 650, mb: 0.5 }}>
                  ตัดออก {payPlan.excluded.length} รายการ
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary' }}>
                  {payPlan.excluded.map(({ item, reason }) => (
                    <li key={item.id}>
                      {item.name} — {reason}
                    </li>
                  ))}
                </Box>
              </Box>
            )}

            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button type="button" color="inherit" onClick={() => setBulkAction(null)} disabled={bulkRunning}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="contained" disabled={bulkRunning || payPlan.ok.length === 0} aria-busy={bulkRunning}>
                {bulkRunning ? 'กำลังบันทึก…' : `บันทึกการจ่าย ${payPlan.ok.length} รายการ`}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Modal>

      {/* dialog แบบกลุ่มปิดตัวเองก่อนเริ่มยิง (ต่างจาก ConfirmDialog ตัวอื่นที่รอ busy) — ถ้ารอจนเสร็จ
          แถบลอยที่เป็นต้นทางของ dialog อาจหายไปแล้ว MUI จะคืน focus ไม่ได้ ระหว่างรอแถบบอก "กำลังดำเนินการ…" */}
      <ConfirmDialog
        open={bulkAction === 'skip'}
        title={`ข้าม ${skipPlan.ok.length} รายการในเดือนนี้`}
        description={
          <BulkList
            intro="รายการเหล่านี้จะไม่นับในแผนเดือนนี้ ยังเห็นอยู่ในตารางและกด ‘เอากลับเข้าแผน’ ทีละรายการได้"
            targets={skipPlan.ok}
            excluded={skipPlan.excluded}
          />
        }
        confirmLabel={`ข้าม ${skipPlan.ok.length} รายการ`}
        busy={bulkRunning}
        onClose={() => setBulkAction(null)}
        onConfirm={() => {
          if (bulkRunningRef.current) return;
          const targets = skipPlan.ok;
          setBulkAction(null);
          void runBulk(targets, (i) => post(`/api/monthly-plan-items/${i.id}/skip`, {}), 'ข้าม');
        }}
      />

      <ConfirmDialog
        open={bulkAction === 'delete'}
        title={`ลบ ${deletePlan.ok.length} รายการ`}
        description={
          <BulkList
            intro="ลบแล้วกู้คืนไม่ได้ ต้องเพิ่มรายการใหม่เอง"
            targets={deletePlan.ok}
            excluded={deletePlan.excluded}
          />
        }
        confirmLabel={`ลบ ${deletePlan.ok.length} รายการ`}
        confirmColor="error"
        busy={bulkRunning}
        onClose={() => setBulkAction(null)}
        onConfirm={() => {
          if (bulkRunningRef.current) return;
          const targets = deletePlan.ok;
          setBulkAction(null);
          void runBulk(targets, (i) => del(`/api/monthly-plan-items/${i.id}`), 'ลบ');
        }}
      />

      {barVisible && (
        <PlanSelectionBar
          items={selectedItems}
          hiddenCount={hiddenSelectedCount}
          payCount={payPlan.ok.length}
          skipCount={skipPlan.ok.length}
          deleteCount={deletePlan.ok.length}
          disabled={closed || submitting || bulkRunning}
          busy={bulkRunning}
          onPay={openBulkPay}
          onSkip={() => setBulkAction('skip')}
          onDelete={() => setBulkAction('delete')}
          onClear={() => setSelected(new Set())}
        />
      )}

      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} placement={barVisible ? 'top' : 'bottom'} />
    </Box>
  );
}
