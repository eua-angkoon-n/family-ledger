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
  LinearProgress,
  Link as MuiLink,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import EventRepeatRounded from '@mui/icons-material/EventRepeatRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import LinkRounded from '@mui/icons-material/LinkRounded';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import LockOutlined from '@mui/icons-material/LockOutlined';
import LockOpenOutlined from '@mui/icons-material/LockOpenOutlined';
import PaidRounded from '@mui/icons-material/PaidRounded';
import SkipNextRounded from '@mui/icons-material/SkipNextRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import {
  del,
  patch,
  post,
  req,
  type Account,
  type Category,
  type IncomeRecord,
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
import IncomeSection, { type IncomeSectionHandle } from '../components/IncomeSection.js';
import PlanSelectionBar from '../components/PlanSelectionBar.js';
import SummaryCard, { summaryRowSx } from '../components/SummaryCard.js';
import { createFormFieldChangeHandler } from '../form.js';
import { formatBaht, formatDate, formatDayMonth, parseBahtToSatang, todayInBangkok } from '../format.js';
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
  PLAN_NOT_MATCHED_NOTE,
  STATUS_ORDER,
  type ItemFilter,
  type ItemSortKey,
  type RuleFilter,
  type RuleSortKey,
  type SortDir,
} from '../planSelection.js';
import { dataTextSx, descriptionSx, radii } from '../theme.js';
import {
  amountFieldHelp,
  BELOW_MD,
  ConfirmDialog,
  Disclosure,
  EmptyState,
  FeedbackSnackbar,
  LoadError,
  MD_UP,
  PageHeader,
  RowIconButton,
  TableSkeleton,
  useStoredOpen,
  type Notice,
} from '../ui.js';


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

// padding แนวนอน 10px แทน 16px ของ theme (จอแคบ 6px) — ตารางรายการ 9 คอลัมน์พอดีกล่อง ~1150px ที่จอ ≥ 1200px และ
// ตารางรายการประจำพอดีที่ 900px โดยไม่ต้องเลื่อนแนวนอน ยกเว้นคอลัมน์ checkbox ที่คุม padding เอง (พื้นที่กด 40px)
const COMPACT_CELLS = { '& .MuiTableCell-root:not(.MuiTableCell-paddingCheckbox)': { px: { xs: 0.75, md: 1.25 } } };
// ชื่อแถวตัดที่ 2 บรรทัด ข้อความเต็มอยู่ใน title (ท่าเดียวกับหน้าธุรกรรม)
const CLAMP_2 = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere' } as const;
// < md คอลัมน์ชื่อกินที่ที่เหลือ (maxWidth 0 กันไม่ให้ดันตารางกว้างเกินกล่อง) — ≥ md กว้างตามเนื้อหาเหมือนเดิม
const NAME_CELL = { width: { xs: '100%', md: 'auto' }, maxWidth: { xs: 0, md: 'none' } } as const;

const RULES_OPEN_KEY = 'hyacinthia.planning.rulesOpen';

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
type ChipStatus = 'in_plan' | 'unpaid' | 'overdue' | 'partial' | 'paid';

// ชิปบิล = รายจ่าย (ชุดเดียวกับ payment_status ของ API และแดชบอร์ด) ยกเว้น "เกินกำหนด" ซึ่งเป็นตัวนับปัญหาของทุกแถว:
// รายได้ที่เลยวันรับเงินแล้วยังไม่บันทึกก็ขึ้นเกินกำหนดในตาราง (API นับเฉพาะรายจ่าย) — ทุกชิปจึงนับจากแถวด้วยตัวกรอง
// ชุดเดียวกับที่กดแล้วได้ ตัวเลขบนชิปเท่ากับจำนวนแถวที่เห็นเสมอ
const chipFilter = (status: ChipStatus): ItemFilter => ({ kind: status === 'overdue' ? '' : 'expense', status, category: '' });
const sameFilter = (a: ItemFilter, b: ItemFilter) => a.kind === b.kind && a.status === b.status && a.category === b.category;

// คลิกคอลัมน์ใหม่ = เรียงขึ้นก่อน, คลิกคอลัมน์เดิม = กลับทิศ (null = ลำดับจาก API ตั้งแต่ยังไม่เคยกด)
function nextSort<K>(prev: Sort<K> | null, key: K): Sort<K> {
  return prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
}

function SortCell<K extends string>(props: {
  sortKey: K;
  sort: Sort<K> | null;
  onSort: (key: K) => void;
  align?: 'right';
  sx?: SxProps<Theme>;
  children: ReactNode;
}) {
  const dir = props.sort != null && props.sort.key === props.sortKey ? props.sort.dir : undefined;
  return (
    <TableCell align={props.align} sortDirection={dir ?? false} sx={props.sx}>
      {/* minHeight 40 = พื้นที่กดขั้นต่ำ, margin ติดลบกันหัวตารางสูงขึ้นตาม, nowrap กันหัวคอลัมน์หักเป็น "จ่าย/แล้ว" */}
      <TableSortLabel active={dir != null} direction={dir ?? 'asc'} onClick={() => props.onSort(props.sortKey)} sx={{ minHeight: 40, my: -1, whiteSpace: 'nowrap' }}>
        {props.children}
      </TableSortLabel>
    </TableCell>
  );
}

// บรรทัดรองใต้ชื่อแถว แทนคอลัมน์ที่จอ < md ซ่อนไป
function SecondaryLine({ parts }: { parts: ReactNode[] }) {
  if (parts.length === 0) return null;
  return (
    <Typography variant="body2" color="text.secondary" component="div" sx={{ overflowWrap: 'anywhere', ...BELOW_MD }}>
      {parts.map((node, i) => (
        <Box component="span" key={i}>
          {i > 0 && <Box component="span" aria-hidden>{' · '}</Box>}
          {node}
        </Box>
      ))}
    </Typography>
  );
}

// เงินกันไว้ไม่ใช่บิล — ปุ่มและฟอร์มใช้คำของการกันเงิน (คู่กับ "ยังไม่ได้กัน"/"กันแล้ว" ใน PaymentStatusChip)
// ส่วนรายจ่ายใช้ "บันทึกจ่าย" คำกริยาเดียวทั้งปุ่มบนแถว แถบที่เลือก และหัวฟอร์ม ("จ่ายแล้ว" เป็นชื่อสถานะเท่านั้น)
const payVerb = (item: PlanItem) => (item.kind === 'reserve' ? 'บันทึกว่ากันแล้ว' : 'บันทึกจ่าย');
// แถวที่จ่ายครบแล้ว (payment_state 'paid' = ยอดคงที่ครบ หรือยอดประมาณการที่บันทึกแล้ว) เปิดประวัติก่อน ไม่ใช่ฟอร์มที่เติมยอดให้กดซ้ำ
// (server กันจ่ายเกินเฉพาะงวดผ่อน) — บันทึกเพิ่มต้องกดเองและพิมพ์ยอดเอง แบบเดียวกับ "ดูการจ่าย" ของหน้าแผนผ่อน
const historyVerb = (item: PlanItem) => (item.kind === 'reserve' ? 'ดูการกันเงิน' : 'ดูการจ่าย');
const cancelPaymentVerb = (item: PlanItem) => (item.kind === 'reserve' ? 'ยกเลิกการบันทึกกันเงิน' : 'ยกเลิกการบันทึกจ่าย');

// หมวดที่มีจริงในแถวชุดนี้ (ไม่ใช่หมวดทั้งหมดของผู้ใช้) — ตัวกรองที่เลือกไว้แล้วแต่แถวสุดท้ายของหมวดนั้น
// เพิ่งถูกลบ/เลิกใช้ ต้องยังมีตัวเลือกอยู่ ไม่งั้น select ของ MUI ได้ค่าที่ไม่มีใน option
function categoryOptions(rows: { category_id: number | null; category_name: string | null }[], current: string) {
  const options = new Map<string, string>();
  for (const r of rows) if (r.category_id != null) options.set(String(r.category_id), r.category_name ?? 'ไม่มีชื่อ');
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
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
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

function frequencyLabel(rule: RecurringRule): string {
  const unit = UNITS.find((u) => u.value === rule.frequency_unit)?.label ?? '';
  return `ทุก ${rule.frequency_interval} ${unit}${rule.anchor_day != null ? ` (วันที่ ${rule.anchor_day})` : ''}`;
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
  // แต่ละส่วนบอกความล้มเหลวของ request ตัวเอง (The Section Failure Rule) — รายการประจำโหลดไม่ได้ไม่ใช่ "ยังไม่มี"
  const [rulesError, setRulesError] = useState('');
  const [refsError, setRefsError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const requestIdRef = useRef(0);
  const [rulesOpen, setRulesOpen] = useStoredOpen(RULES_OPEN_KEY);

  // ค่าตอนเปิดฟอร์มของทุก modal — ต่างจากนี้ = มีการแก้ค้าง Modal ถามก่อนปิด (The Unsaved Modal Rule)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [itemInitial, setItemInitial] = useState(EMPTY_ITEM);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const setItemField = createFormFieldChangeHandler(setItemForm);

  const [ruleForm, setRuleForm] = useState(EMPTY_RULE);
  const [ruleInitial, setRuleInitial] = useState(EMPTY_RULE);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const setRuleField = createFormFieldChangeHandler(setRuleForm);

  const [payingItem, setPayingItem] = useState<PlanItem | null>(null);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
  const [paymentInitial, setPaymentInitial] = useState(EMPTY_PAYMENT);
  const setPaymentField = createFormFieldChangeHandler(setPaymentForm);
  // แถวที่จ่ายครบแล้วเปิดเป็นประวัติ — true = กด "บันทึกเพิ่ม" แล้ว ฟอร์ม (ยอดว่าง) จึงขึ้น
  const [addingPayment, setAddingPayment] = useState(false);
  // ปุ่มของแถวที่เปิดฟอร์มจ่ายล่าสุด — ยกเลิกการบันทึกจ่ายปิดฟอร์มก่อนเปิด dialog ยืนยัน (เหมือนหน้าแผนผ่อน) จึงคืน focus มาที่นี่
  const payButtonRef = useRef<HTMLElement | null>(null);
  const [cancellingPayment, setCancellingPayment] = useState<{ item: PlanItem; payment: PlanItemPayment } | null>(null);
  const [deletingItem, setDeletingItem] = useState<PlanItem | null>(null);
  // เมนูเลือกรายได้ของ "ผูกกับรายได้" เมื่อเดือนนี้มีรายได้หลายรายการ — open แยกจากข้อมูล รายการในเมนูจึงไม่หายระหว่าง transition ปิด
  const [linkMenu, setLinkMenu] = useState<{ anchor: HTMLElement; item: PlanItem; incomes: IncomeRecord[]; open: boolean } | null>(null);
  // ผลสำเร็จที่เกิดตอน modal/dialog เปิดอยู่ — `#root` ยังเป็น aria-hidden จนปิดสนิท snackbar ที่ขึ้นตอนนั้น screen reader
  // ไม่อ่าน จึงเก็บไว้แล้วแสดงจาก onExited (เหมือน ConfirmDialog ของ ui.tsx) ทุก run() ที่เก็บไว้ต้องปิด dialog ของตัวเองเมื่อสำเร็จ
  const pendingNoticeRef = useRef<Notice | null>(null);
  const flushNotice = () => {
    const pending = pendingNoticeRef.current;
    pendingNoticeRef.current = null;
    if (pending) setNotice(pending);
  };

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
  const [bulkInitial, setBulkInitial] = useState('');
  const hadSelectionRef = useRef(false);
  // งานแบบกลุ่มแยกจาก submitting ของปุ่มรายแถว — ถ้าใช้ตัวเดียวกัน ปุ่มรายแถวที่กดกลางคัน
  // จะคืน submitting=false ตอนจบ แถบกลับมากดได้ แล้วกด "บันทึกจ่าย" ซ้ำกับเป้าหมายเดิม = บันทึกจ่ายซ้ำ
  // ref กันการกดซ้ำก่อน state รอบใหม่ render ทัน (closure ของ dialog ยังเห็นค่าเก่า)
  const [bulkRunning, setBulkRunning] = useState(false);
  const bulkRunningRef = useRef(false);
  const [bulkFailures, setBulkFailures] = useState<{
    verb: string;
    total: number;
    failed: { item: PlanItem; message: string }[];
  } | null>(null);

  const [archivingRule, setArchivingRule] = useState<RecurringRule | null>(null);
  // ปุ่มที่รับ focus แทนเมื่อ element ต้นทางหายไป (แถวที่ลบ, แถบเลือกที่ปิด, ปุ่มบันทึกรายได้ที่กลายเป็นลิงก์)
  const addItemButtonRef = useRef<HTMLButtonElement>(null);
  const incomeRef = useRef<IncomeSectionHandle>(null);
  const incomeChangedRef = useRef(false);

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
    const [planResult, rulesResult] = await Promise.allSettled([
      req<Plan>(`/api/monthly-plans/${monthRef.current}`),
      req<RecurringRule[]>('/api/recurring-rules'),
    ]);
    if (requestId !== requestIdRef.current) return;
    if (planResult.status === 'fulfilled') {
      setPlan(planResult.value);
      setError('');
    } else {
      setError(errorMessage(planResult.reason, 'โหลดแผนรายเดือนไม่สำเร็จ'));
      if (!background) setPlan(null);
    }
    if (rulesResult.status === 'fulfilled') {
      setRules(rulesResult.value);
      setRulesError('');
    } else setRulesError(errorMessage(rulesResult.reason, 'โหลดรายการประจำไม่สำเร็จ'));
    setLoading(false);
  };

  // บัญชี/หมวดของช่องเลือกในฟอร์ม — โหลดไม่ได้ต้องบอกพร้อมปุ่มลองใหม่ ไม่ใช่ช่องเลือกว่างเงียบ ๆ
  const loadRefs = async () => {
    setRefsError('');
    const [accountsResult, categoriesResult] = await Promise.allSettled([
      req<Account[]>('/api/accounts'),
      req<Category[]>('/api/categories?is_active=true'),
    ]);
    if (accountsResult.status === 'fulfilled') setAccounts(accountsResult.value);
    if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value);
    const failed = [accountsResult.status === 'rejected' && 'บัญชี', categoriesResult.status === 'rejected' && 'หมวด'].filter(Boolean);
    if (failed.length > 0) setRefsError(`โหลดรายชื่อ${failed.join('และ')}ไม่สำเร็จ ช่องเลือก${failed.join('และ')}จึงยังว่าง`);
  };

  useEffect(() => {
    void loadRefs();
  }, []);

  useEffect(() => {
    void reload(false);
    // id ของเดือนอื่นไม่มีความหมายที่นี่ ส่วนหมวดที่กรองไว้อาจไม่มีในเดือนใหม่ — ประเภท/สถานะคงไว้
    setSelected(new Set());
    setBulkFailures(null);
    setItemFilter((f) => ({ ...f, category: '' }));
    setLinkMenu(null);
    incomeChangedRef.current = false;
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

  // element ที่ถือ focus หายไปจาก DOM แล้ว focus ตกไปที่ body — ส่งต่อให้ checkbox หัวตาราง (ยังอยู่ใกล้งานที่ทำ)
  // หรือปุ่มเพิ่มรายการถ้าตารางหายไปแล้ว preventScroll: ไม่กระชากหน้าจอของคนที่ใช้เมาส์ แค่ให้ Tab ถัดไปเริ่มจากจุดที่สมเหตุสมผล
  const rescueFocus = () => {
    if (document.activeElement == null || document.activeElement === document.body) {
      (document.getElementById('plan-select-all') ?? addItemButtonRef.current)?.focus({ preventScroll: true });
    }
  };

  // แถบลอยหายไปพร้อมปุ่มที่ถือ focus อยู่ ("ล้างที่เลือก" หรือทำครบทุกแถว) — ปุ่มบนแถบเป็น aria-disabled ระหว่างทำ
  // แบบกลุ่ม focus จึงหายเฉพาะตอนที่แถบหายไปทั้งแถบเท่านั้น
  useEffect(() => {
    if (selected.size > 0) {
      hadSelectionRef.current = true;
      return;
    }
    if (!hadSelectionRef.current) return;
    hadSelectionRef.current = false;
    rescueFocus();
  }, [selected.size > 0]);

  // บันทึกรายได้จากปุ่มบนแถวแล้ว MUI คืน focus ให้ปุ่มนั้นตอนปิดฟอร์ม แต่ reload ทำให้ปุ่มหายไป
  // (แถวผูก income_record แล้วเหลือลิงก์ "จัดการในรายได้") — รอ plan ใหม่ commit ก่อนค่อยส่งต่อ
  // ตั้ง flag ที่ปุ่มบนแถวเท่านั้น ปุ่ม "แก้ไข"/"เพิ่มรายได้เต็ม" ในส่วนรายได้ไม่ควรถูกดึง focus ออกมาที่ตาราง
  useEffect(() => {
    if (!incomeChangedRef.current) return;
    incomeChangedRef.current = false;
    rescueFocus();
  }, [plan]);

  // ระหว่างสลับเดือน plan ยังเป็นของเดือนก่อน — ทุกส่วนที่มาจากแผนแสดง placeholder ในที่เดิมแทนข้อมูลเก่า
  const planReady = plan != null && !loading;
  const closed = planReady && plan.status === 'closed';
  const items = planReady ? plan.items : [];
  const activeRules = rules.filter((r) => r.is_active);
  // โหลดครั้งแรกยังไม่รู้จำนวน — ไม่แสดง "(0)" หรือ "ยังไม่มีรายการประจำ" ก่อนข้อมูลมา (รายการประจำไม่ผูกกับเดือน สลับเดือนแล้วคงของเดิมไว้)
  const rulesPending = loading && rules.length === 0;

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

  // ชิปสถานะ = ทางลัดของตัวกรอง (chipFilter) กดชิปที่เปิดอยู่ซ้ำ = ล้างตัวกรอง
  const chipOn = (status: ChipStatus) => sameFilter(itemFilter, chipFilter(status));
  const toggleChip = (status: ChipStatus) => setItemFilter(chipOn(status) ? EMPTY_ITEM_FILTER : chipFilter(status));
  const chipCount = (status: ChipStatus) => items.filter((i) => matchesItemFilter(i, chipFilter(status))).length;

  // แถวที่ถูกซ่อนด้วยตัวกรองยังนับ — ปุ่มแบบกลุ่มทำกับทุกแถวที่เลือก ไม่ใช่แค่ที่เห็น
  const selectedItems = items.filter((i) => selected.has(i.id));
  // ใช้ selectedItems ไม่ใช่ selected.size — ระหว่างรอ effect ตัด id ที่ถูกลบ แถบจะไม่โชว์ "เลือก 0 รายการ"
  const barVisible = selectedItems.length > 0;
  const hiddenSelectedCount = selectedItems.filter((i) => !matchesItemFilter(i, itemFilter)).length;
  const payPlan = partition(selectedItems, canPay);
  const skipPlan = partition(selectedItems, canSkip);
  const deletePlan = partition(selectedItems, canDelete);
  // เลือกแต่เงินกันไว้ = คำของการกันเงินทั้งหัวฟอร์ม ป้ายช่อง และผลลัพธ์ ("บันทึกว่ากันเงินแล้ว 2 รายการ") ปนรายจ่ายอยู่ด้วย
  // ใช้คำของรายจ่าย — ช่องยอดรายแถวยังบอกตามประเภทของแถวเสมอ
  const bulkAllReserve = payPlan.ok.length > 0 && payPlan.ok.every((i) => i.kind === 'reserve');
  const bulkWords = bulkAllReserve
    ? { verb: 'บันทึกว่ากันแล้ว', notice: 'บันทึกว่ากันเงิน', date: 'วันที่กัน', account: 'บัญชีที่กันเงินไว้' }
    : { verb: 'บันทึกจ่าย', notice: 'บันทึกจ่าย', date: 'วันที่จ่าย', account: 'บัญชีที่จ่าย' };
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

  // ปุ่มบนแถบเครื่องมือและปุ่มรายแถวที่ไม่มี dialog (คัดลอกเดือนก่อน / เปิดเดือน / ข้าม / เอากลับเข้าแผน) ไม่มี Alert
  // ของ formError ให้แสดง ถ้าโยน error ลง formError ตัวเดียวเสมอ ความล้มเหลวของปุ่มเหล่านั้นจะเงียบหายไปทั้งหมด —
  // มี modal/dialog เปิดอยู่ค่อยแสดงในนั้น (snackbar อยู่ใต้ aria-hidden ระหว่าง dialog เปิด) ไม่มีก็ส่งเข้า snackbar
  const run = async (action: () => Promise<unknown>, successMessage: string, onDone?: () => void) => {
    // ปุ่มรายแถว disabled ระหว่างงานแบบกลุ่มแล้ว — ตัวนี้กันคลิกที่หลุดมาก่อน re-render
    if (bulkRunningRef.current) return;
    // ConfirmDialog ปิดเดือน / เลิกใช้ / ลบ แสดง formError ใน description (dialogError) ค้างไว้ให้กดซ้ำได้
    const inModal =
      itemModalOpen || ruleModalOpen || payingItem != null || closing || archivingRule != null || deletingItem != null || cancellingPayment != null;
    setFormError('');
    setSubmitting(true);
    try {
      await action();
      // ใน modal = onDone ปิด modal นั้น แล้ว onExited ของมันเรียก flushNotice
      if (inModal) pendingNoticeRef.current = { message: successMessage, severity: 'success' };
      else setNotice({ message: successMessage, severity: 'success' });
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
  // แถวที่จ่ายครบแล้วไม่อยู่ใน payPlan.ok (canPay) ยอดที่ยังค้างจึงมากกว่า 0 เสมอ
  const openBulkPay = () => {
    if (bulkRunningRef.current) return;
    const form = { paid_date: todayInBangkok(), bank_account_id: accounts[0] ? String(accounts[0].id) : '' };
    const amounts = Object.fromEntries(
      payPlan.ok.map((i) => [
        i.id,
        i.amount_mode === 'estimated' ? '' : formatBaht(Math.max(0, i.planned_amount_satang - i.paid_satang)),
      ]),
    );
    setBulkPayForm(form);
    setBulkAmounts(amounts);
    setBulkInitial(JSON.stringify([form, amounts]));
    setFormError('');
    setBulkAction('pay');
  };

  const submitBulkPay = () => {
    if (bulkRunningRef.current || payPlan.ok.length === 0) return;
    const { paid_date, bank_account_id } = bulkPayForm;
    if (paid_date === '' || bank_account_id === '') {
      setFormError(`เลือก${bulkWords.date}และ${bulkWords.account}`);
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
      bulkWords.notice,
    );
  };

  const startItemForm = (id: number | null, form: typeof EMPTY_ITEM) => {
    setEditingItemId(id);
    setItemForm(form);
    setItemInitial(form);
    setFormError('');
    setItemModalOpen(true);
  };
  const openAddItem = () => startItemForm(null, EMPTY_ITEM);
  const openEditItem = (item: PlanItem) =>
    startItemForm(item.id, {
      kind: item.kind,
      name: item.name,
      amount_baht: formatBaht(item.planned_amount_satang),
      due_date: item.due_date ?? '',
      category_id: item.category_id == null ? '' : String(item.category_id),
      note: item.note ?? '',
    });

  const submitItem = () => {
    if (submitting) return;
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

  const startRuleForm = (id: number | null, form: typeof EMPTY_RULE) => {
    setEditingRuleId(id);
    setRuleForm(form);
    setRuleInitial(form);
    setFormError('');
    setRuleModalOpen(true);
  };
  const openAddRule = () => startRuleForm(null, { ...EMPTY_RULE, start_date: `${month}-01` });
  const openEditRule = (rule: RecurringRule) =>
    startRuleForm(rule.id, {
      name: rule.name,
      kind: rule.kind,
      amount_mode: rule.amount_mode,
      amount_baht: formatBaht(rule.amount_satang),
      frequency_unit: rule.frequency_unit,
      frequency_interval: String(rule.frequency_interval),
      anchor_day: rule.anchor_day == null ? '' : String(rule.anchor_day),
      start_date: rule.start_date,
      end_date: rule.end_date ?? '',
      default_account_id: rule.default_account_id == null ? '' : String(rule.default_account_id),
      category_id: rule.category_id == null ? '' : String(rule.category_id),
    });

  const submitRule = () => {
    if (submitting) return;
    const satang = parseBahtToSatang(ruleForm.amount_baht);
    if (satang == null) {
      setFormError('จำนวนเงินไม่ถูกต้อง');
      return;
    }
    // Number('x') เป็น NaN แล้ว JSON.stringify แปลงเป็น null ทำให้ฝั่ง server coalesce เป็น "ทุก 1"
    // และล้าง anchor_day เงียบ ๆ — ต้องดักที่นี่ให้ผู้ใช้เห็นว่ากรอกอะไรผิด
    const interval = Number(ruleForm.frequency_interval);
    if (!Number.isInteger(interval) || interval < 1 || interval > 366) {
      setFormError('ทุกกี่รอบต้องเป็นจำนวนเต็ม 1–366');
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
      () => {
        setRuleModalOpen(false);
        // ส่วนที่พับไว้ต้องกางให้เห็นกฎที่เพิ่งบันทึก
        if (!rulesOpen) setRulesOpen(true);
      },
    );
  };

  // เติมค่าเริ่มต้นให้ครบที่สุดที่รู้: ยอดคงเหลือที่ยังไม่จ่าย, วันครบกำหนด และ "บัญชีที่คาดว่าจะใช้"
  // ของรายการประจำต้นทาง (§9.2) — ถ้าไม่อ่านค่านั้นที่นี่ ช่องนั้นในฟอร์มกฎก็ไม่มีใครใช้เลย
  //
  // ยกเว้นยอด: รายการยอดประมาณการปล่อยช่องว่างให้พิมพ์ยอดจากบิลจริง — ยอดที่เดาไว้ถ้าเติมให้แล้วผู้ใช้กดผ่าน
  // จะนับเป็นยอดจ่ายทันที (ADR-0004 ไม่มี statement มาแก้ให้) ยอดจริงของเดือนนั้นจึงผิดไปเงียบ ๆ
  // แถวที่จ่ายครบแล้วก็ปล่อยว่าง (ไม่มียอดค้างให้เติม) และเปิดเป็นประวัติก่อน — ฟอร์มขึ้นเมื่อกด "บันทึกเพิ่ม" เท่านั้น
  const openPayment = (item: PlanItem, button: HTMLElement) => {
    payButtonRef.current = button;
    const remaining = Math.max(0, item.planned_amount_satang - item.paid_satang);
    const rule = item.recurring_rule_id == null ? undefined : rules.find((r) => r.id === item.recurring_rule_id);
    const defaultAccountId = rule?.default_account_id ?? accounts[0]?.id ?? null;
    const form = {
      amount_baht: item.amount_mode === 'estimated' || remaining === 0 ? '' : formatBaht(remaining),
      paid_date: item.due_date ?? `${month}-01`,
      bank_account_id: defaultAccountId == null ? '' : String(defaultAccountId),
    };
    setAddingPayment(false);
    setPayingItem(item);
    setPaymentForm(form);
    setPaymentInitial(form);
    setFormError('');
  };

  const submitPayment = () => {
    if (!payingItem || submitting) return;
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
      payingItem.kind === 'reserve' ? 'บันทึกว่ากันเงินแล้ว' : 'บันทึกจ่ายแล้ว',
      () => setPayingItem(null),
    );
  };

  const summary = planReady ? plan.payment_status : null;
  // payingItem เป็น snapshot ตอนกดปุ่ม — หลัง reload ต้องอ่านของจริงจาก plan ไม่งั้นรายการจ่าย
  // ที่เพิ่งบันทึกหรือเพิ่งยกเลิกจะไม่อัปเดตในกล่องที่ยังเปิดอยู่
  const payingItemLive = payingItem == null ? null : items.find((i) => i.id === payingItem.id) ?? payingItem;
  const reserving = payingItemLive?.kind === 'reserve';
  const payingVerb = payingItemLive ? payVerb(payingItemLive) : 'บันทึกจ่าย';
  // แถวที่จ่ายครบแล้ว = ประวัติอย่างเดียว (ไม่มีแถบปุ่มบันทึก) จนกด "บันทึกเพิ่ม" — แบบงวดที่ดูประวัติของหน้าแผนผ่อน
  const paymentFormOpen = payingItemLive != null && (payingItemLive.payment_state !== 'paid' || addingPayment);
  const paymentDirty = paymentFormOpen && JSON.stringify(paymentForm) !== JSON.stringify(paymentInitial);
  const refsAlert = refsError && <LoadError message={refsError} onRetry={() => void loadRefs()} />;
  // error ของ ConfirmDialog ปิดเดือน / เลิกใช้ / ลบ อยู่ใน description (รวมใน aria-describedby) — run() ส่งมาที่ formError
  const dialogError = formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>;
  // ปุ่มที่ถือ focus อยู่แล้วกดไม่ได้ชั่วคราว = aria-disabled (Buttons ใน DESIGN.md) — disabled ถอดออกจากลำดับ tab
  const toolbarBusy = submitting || bulkRunning;
  // รายได้ของเดือนนี้ที่บันทึกแล้ว (นับจากแถวของแผน ไม่ต้องรอส่วนรายได้โหลด) — รายการหักที่ยังรอแต่ไม่ได้ผูกตอนบันทึกรายได้ ผูกย้อนได้จากแถว
  const recordedIncomeCount = items.filter((i) => i.kind === 'income' && i.income_record_id != null).length;
  // รายได้รายการเดียว = เปิดฟอร์มแก้ไขรายได้นั้นเลย หลายรายการ = เมนูให้เลือกว่าหักจากรายได้ไหน (ไม่เดา) ทั้งสองทางเข้า
  // linkDeduction ตัวเดียวกัน — โหลดส่วนรายได้ไม่สำเร็จ IncomeSection เลื่อนไปให้เห็นปุ่มลองใหม่เอง
  const linkDeduction = (item: PlanItem, anchor: HTMLElement) => {
    const incomes = incomeRef.current?.incomes() ?? [];
    if (incomes.length > 1) setLinkMenu({ anchor, item, incomes, open: true });
    else if (incomeRef.current?.linkDeduction(item.id)) incomeChangedRef.current = true;
  };
  const linkMenuOpenFor = linkMenu?.open ? linkMenu.item.id : null;
  // MUI คืน focus ให้ปุ่มบนแถวตอนเมนูปิด (ก่อนฟอร์มเปิดใน commit เดียวกัน) ฟอร์มจึงคืน focus ที่ปุ่มนั้นต่อ
  const pickIncome = (incomeId: number) => {
    if (linkMenu == null) return;
    setLinkMenu({ ...linkMenu, open: false });
    if (incomeRef.current?.linkDeduction(linkMenu.item.id, incomeId)) incomeChangedRef.current = true;
  };

  // ปุ่มของแถว — วาดสองที่: คอลัมน์จัดการ (≥ md) และใต้ชื่อแถว (< md, ไม่มีไอคอนนำหน้าเพื่อให้พอดีความกว้าง)
  // แถวที่ผูกกับรายได้/แผนผ่อนจัดการที่ต้นทางเท่านั้น จึงเหลือลิงก์เดียวแทนปุ่มที่กดไม่ได้ 4 ปุ่ม
  // ปุ่มข้อความทุกปุ่มมีชื่อแถวต่อท้ายใน aria-label (ตารางมีปุ่มชื่อเดียวกันหลายสิบปุ่ม) โดยขึ้นต้นด้วยข้อความที่ตาเห็น
  const rowActions = (item: PlanItem, compact: boolean) => {
    if (item.income_record_id != null) {
      return <Button size="small" href="#income-section" aria-label={`จัดการในรายได้ ${item.name}`} sx={{ whiteSpace: 'nowrap' }}>จัดการในรายได้</Button>;
    }
    if (item.installment_due_id != null) {
      return <Button size="small" component={Link} to="/installments" aria-label={`ดูแผนผ่อน ${item.name}`} sx={{ whiteSpace: 'nowrap' }}>ดูแผนผ่อน</Button>;
    }
    const inactive = item.explicit_status !== 'active';
    const locked = closed || bulkRunning;
    const icon = compact ? undefined : <PaidRounded />;
    const deleteReason = canDelete(item);
    const rowPayLabel = item.payment_state === 'paid' ? historyVerb(item) : payVerb(item);
    return (
      <>
        {/* "บันทึกจ่าย" เป็นปุ่มของรายจ่าย/เงินกันไว้เท่านั้น — เงินเข้าต้องบันทึกที่ "รายได้และรายการหัก"
            เพื่อแยกยอดเต็มออกจากยอดสุทธิ (ADR-0002 ข้อ 5) รายการหักจากเงินเดือนไม่มีปุ่มจ่าย เงินไม่ได้ออกจาก
            บัญชีเรา มันขึ้น "หักจากรายได้" เองเมื่อถูกผูกจากฟอร์มรายได้ — เดือนที่บันทึกรายได้ไปแล้วแต่รายการนี้ยังค้าง
            มีปุ่ม "ผูกกับรายได้" แทน (รายได้หลายรายการ = เมนูให้เลือก จึงเป็น menu button)

            เงื่อนไข `paid_satang === 0`: แถวที่ยังมีการบันทึกจ่ายค้างอยู่ต้องเหลือปุ่มของ modal จ่ายไว้ เพราะปุ่ม
            ยกเลิกการบันทึกจ่ายอยู่ใน modal นั้นที่เดียว ยกเลิกแล้ว paid_satang กลับเป็น 0 ปุ่มจะสลับเป็น
            ปุ่มบันทึกรายได้ให้เอง ซึ่งเปิดฟอร์มรายได้ที่เชื่อมแถวนี้ไว้แล้วทันที — แถวที่จ่ายครบแล้วปุ่มเป็น "ดูการจ่าย"
            (historyVerb) เปิดประวัติก่อน ป้ายสลับแต่ key เดิม focus จึงอยู่ที่ปุ่มเดิมหลังบันทึก/ยกเลิก

            key แยกปุ่ม: ไม่มี key React จะใช้ <button> เดิมต่อแล้วแค่ disable หลังบันทึกรายได้
            focus จึงค้างบนปุ่ม disabled แทนที่จะตกไปที่ body ให้ effect ของ incomeChangedRef ส่งต่อ */}
        {item.kind === 'income' && item.paid_satang === 0 ? (
          <Button
            key="income"
            size="small"
            startIcon={icon}
            disabled={locked || inactive}
            aria-label={`บันทึกรายได้เต็ม ${item.name}`}
            onClick={() => {
              incomeChangedRef.current = true;
              incomeRef.current?.openNewFor(item.id);
            }}
            sx={{ whiteSpace: 'nowrap' }}
          >
            บันทึกรายได้เต็ม
          </Button>
        ) : item.kind === 'payroll_deduction' && item.paid_satang === 0 ? (
          recordedIncomeCount > 0 &&
          !inactive && (
            <Button
              key="link"
              size="small"
              startIcon={compact ? undefined : <LinkRounded />}
              disabled={locked}
              aria-label={`ผูกกับรายได้ ${item.name}`}
              aria-haspopup={recordedIncomeCount > 1 ? 'menu' : undefined}
              aria-expanded={recordedIncomeCount > 1 ? linkMenuOpenFor === item.id : undefined}
              aria-controls={linkMenuOpenFor === item.id ? 'plan-link-income-menu' : undefined}
              onClick={(event) => linkDeduction(item, event.currentTarget)}
              sx={{ whiteSpace: 'nowrap' }}
            >
              ผูกกับรายได้
            </Button>
          )
        ) : (
          <Button
            key="pay"
            size="small"
            startIcon={compact ? undefined : item.payment_state === 'paid' ? <HistoryRounded /> : <PaidRounded />}
            disabled={locked || inactive}
            aria-label={`${rowPayLabel} ${item.name}`}
            onClick={(event) => openPayment(item, event.currentTarget)}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {rowPayLabel}
          </Button>
        )}
        {/* กลุ่มไอคอนไม่ตัดบรรทัดกลางกลุ่ม (< md แถวปุ่มใต้ชื่อตัดบรรทัดได้ แต่ไอคอนสามตัวไปด้วยกัน) */}
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          <RowIconButton label={`แก้ไข ${item.name}`} tooltip="แก้ไข" disabled={locked} onClick={() => openEditItem(item)}>
            <EditRounded fontSize="small" />
          </RowIconButton>
          {inactive ? (
            <RowIconButton
              label={`เอา ${item.name} กลับเข้าแผน`}
              tooltip="เอากลับเข้าแผน"
              color="inherit"
              disabled={locked}
              onClick={() => void run(() => patch(`/api/monthly-plan-items/${item.id}`, { explicit_status: 'active' }), 'เอารายการกลับเข้าแผนแล้ว')}
            >
              <ReplayRounded fontSize="small" />
            </RowIconButton>
          ) : (
            <RowIconButton
              label={`ข้าม ${item.name}`}
              tooltip="ข้าม"
              color="inherit"
              disabled={locked}
              onClick={() => void run(() => post(`/api/monthly-plan-items/${item.id}/skip`, {}), 'ข้ามรายการนี้แล้ว')}
            >
              <SkipNextRounded fontSize="small" />
            </RowIconButton>
          )}
          {/* ลบไม่ได้เพราะตัวรายการเอง (รายการประจำ / มีการบันทึกจ่ายค้าง) = aria-disabled + tooltip บอกเหตุผล (ชุดเดียวกับ dialog แบบกลุ่ม) */}
          <RowIconButton
            label={`ลบ ${item.name}`}
            tooltip="ลบ"
            color="error"
            disabled={locked}
            disabledReason={locked || deleteReason == null ? null : `ลบไม่ได้ — ${deleteReason}`}
            onClick={() => {
              setFormError('');
              setDeletingItem(item);
            }}
          >
            <DeleteOutlineRounded fontSize="small" />
          </RowIconButton>
        </Stack>
      </>
    );
  };

  const paidPercent =
    summary != null && summary.total_due_satang > 0
      ? Math.min(100, Math.max(0, Math.round((summary.paid_satang / summary.total_due_satang) * 100)))
      : 0;
  const overdueCount = chipCount('overdue');

  return (
    // ที่ว่างท้ายหน้าให้พ้นแถบลอย PlanSelectionBar วัดความสูงจริงแล้วเว้นเอง
    <Box>
      {/* ข้อจำกัดของแผนบอกครั้งเดียวที่นี่ (และในฟอร์มบันทึกจ่าย) — data_coverage_note ของ API พูดถึงตัวเลขเงินจริง
          ซึ่งหน้านี้ไม่แสดง จึงไม่ขึ้นที่นี่ */}
      <PageHeader level={1} id="planning-heading" title="วางแผนรายเดือน" description={PLAN_NOT_MATCHED_NOTE} />

      {/* แถบเครื่องมือของเดือนแถวเดียว (คู่มือไฮไลต์ทั้งแถว): เลือกเดือน · ปิด/เปิดเดือน · คัดลอก · เพิ่มรายการ */}
      <Stack direction="row" data-tour="plan-toolbar" sx={{ mt: 3, alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <MonthPicker value={month} onChange={setMonth} maxMonth={MAX_MONTH} />
        {/* ระหว่างสลับเดือนยังไม่รู้สถานะของเดือนใหม่ ปุ่มล็อกจึงกดไม่ได้จนแผนของเดือนนี้มาถึง (คงที่ไว้ให้ layout
            ไม่กระโดด) — ปุ่มเดียวสลับป้าย ปิด ↔ เปิด React ใช้ <button> เดิม focus หลังปิด dialog จึงกลับมาที่เดิม */}
        {plan != null && (
          <Button
            variant="outlined"
            // ป้ายอ่านจากแผนที่มีอยู่ (ระหว่างโหลดเป็นของเดือนก่อน) ให้ความกว้างปุ่มไม่สลับไปมา แต่กดได้เมื่อแผนเดือนนี้มาถึงแล้วเท่านั้น
            startIcon={plan.status === 'closed' ? <LockOpenOutlined /> : <LockOutlined />}
            disabled={!planReady}
            aria-disabled={toolbarBusy}
            onClick={() => {
              if (toolbarBusy) return;
              if (closed) void run(() => post(`/api/monthly-plans/${month}/reopen`, {}), 'เปิดเดือนนี้ให้แก้ได้แล้ว');
              else {
                setFormError('');
                setClosing(true);
              }
            }}
          >
            {plan.status === 'closed' ? 'เปิดเดือนนี้อีกครั้ง' : 'ปิดเดือนนี้'}
          </Button>
        )}
        <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }} />
        <Button
          variant="outlined"
          startIcon={<ContentCopyRounded />}
          disabled={closed || !planReady}
          aria-disabled={toolbarBusy}
          onClick={() => {
            if (!toolbarBusy) void run(() => post(`/api/monthly-plans/${month}/copy-previous`, {}), 'คัดลอกจากเดือนก่อนแล้ว');
          }}
        >
          คัดลอกเดือนก่อน
        </Button>
        <Button ref={addItemButtonRef} variant="contained" startIcon={<AddRounded />} disabled={closed || !planReady} onClick={openAddItem}>
          เพิ่มรายการ
        </Button>
      </Stack>
      {/* ลิงก์ไปหน้าอื่น ไม่ใช่เครื่องมือของเดือน — เป็นลิงก์ข้อความ ไม่ใช่ปุ่ม outlined แบบเดียวกับแถบด้านบน */}
      <MuiLink component={Link} to="/installments" sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, mt: 0.5 }}>
        แผนผ่อนและยอดคงเหลือ
        <ChevronRightRounded fontSize="small" aria-hidden />
      </MuiLink>

      {closed && (
        <Alert severity="info" role="status" sx={{ mt: 2, ...descriptionSx }}>
          เดือนนี้ปิดแล้ว แก้รายการไม่ได้จนกดเปิดอีกครั้ง ตัวเลขด้านล่างคำนวณสดจากข้อมูลล่าสุดเสมอ ไม่ใช่ภาพนิ่งตอนปิดเดือน
        </Alert>
      )}

      {error && <LoadError message={error} onRetry={plan == null ? () => void reload() : undefined} />}

      <Stack spacing={4} sx={{ mt: 3 }}>
        {/* โหลดแผนไม่สำเร็จ = LoadError ด้านบนแทนส่วนที่มาจากแผน (Section Failure Rule) รายการประจำยังแสดงตามปกติ */}
        {(loading || plan != null) && (
          <>
            <Box component="section" aria-labelledby="plan-totals-heading">
              <Typography variant="h2" id="plan-totals-heading" sx={{ mb: 1.5 }}>
                สรุปตามแผน
              </Typography>
              {/* มือถือ ใบที่ 5 (เงินเหลือใช้ = ผลลัพธ์) กินเต็มแถว — summaryRowSx จัดให้ */}
              <Box sx={summaryRowSx(5)}>
                <SummaryCard dense loading={!planReady} title="รายได้เต็มตามแผน" value={<Money satang={plan?.totals.planned_income_satang ?? 0} tone="income" />} />
                <SummaryCard dense loading={!planReady} title="รายการหักจากรายได้" value={<Money satang={plan?.totals.planned_deduction_satang ?? 0} />} />
                <SummaryCard dense loading={!planReady} title="ค่าใช้จ่ายตามแผน" value={<Money satang={plan?.totals.planned_expense_satang ?? 0} tone="expense" />} />
                <SummaryCard
                  dense
                  loading={!planReady}
                  title="เงินกันไว้"
                  value={<Money satang={plan?.totals.planned_reserve_satang ?? 0} />}
                  caption="กันงบไว้ ไม่ใช่รายจ่าย และไม่ลดยอดคงเหลือในบัญชี"
                />
                <SummaryCard
                  dense
                  loading={!planReady}
                  title="เงินเหลือใช้ตามแผน"
                  value={
                    <Money
                      satang={plan?.totals.planned_available_satang ?? 0}
                      tone={(plan?.totals.planned_available_satang ?? 0) < 0 ? 'expense' : 'income'}
                    />
                  }
                  caption="รายได้เต็ม − รายการหัก − รายจ่ายตามแผน − เงินกันไว้"
                />
              </Box>
            </Box>

            {(!planReady || chipCount('in_plan') > 0 || overdueCount > 0) && (
              <Box component="section" aria-labelledby="plan-payment-heading">
                <Typography variant="h2" id="plan-payment-heading" sx={{ mb: 1.5 }}>
                  สถานะการจ่ายบิล
                </Typography>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  {summary == null ? (
                    <Stack spacing={1.5} role="status" aria-label="กำลังโหลดสถานะการจ่าย">
                      <Skeleton width="50%" />
                      <Skeleton variant="rounded" height={10} />
                      <Skeleton variant="rounded" height={40} />
                    </Stack>
                  ) : (
                    <>
                      {/* ความคืบหน้าของบิล (รายจ่าย) — ตัวเลขเป็นข้อความเสมอ แถบเป็นภาพประกอบ: เนื้อแถบ success บน card
                          4.87 / 6.97, ขอบรางสี input 3.14 / 3.17 (สว่าง/มืด) — รางโปร่งใส เพราะสีรางค่าเริ่มต้นของ MUI
                          คำนวณจาก palette ธีมสว่างแม้อยู่ธีมมืด */}
                      <Typography id="plan-paid-progress" sx={{ ...dataTextSx }}>
                        จ่ายแล้ว <Money satang={summary.paid_satang} sx={{ fontWeight: 600 }} /> จากยอดตามแผน{' '}
                        <Money satang={summary.total_due_satang} /> ({paidPercent}%)
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        color="success"
                        value={paidPercent}
                        aria-labelledby="plan-paid-progress"
                        sx={{ mt: 1, height: 10, borderRadius: `${radii.sm}px`, bgcolor: 'transparent', border: 1, borderColor: 'brand.input', maxWidth: 560 }}
                      />
                      {/* กดชิป = กรองตาราง "รายการของเดือนนี้" ด้านล่าง (The Toggle Chip Rule): เลือก = primary filled,
                          ไม่เลือก = outlined สีปกติ ยกเว้น "เกินกำหนด" ที่เป็นตัวนับปัญหาด้วย: > 0 ใช้ warning + ไอคอน
                          (The Issue Count Rule — บน card 5.28 / 7.22, hover พื้น warning 4% ของ MUI บน card 5.00 / 6.73)
                          จำนวน 0 ที่ไม่ได้เลือกเป็นสีรอง (บน card 4.88 / 6.75) ยังกดได้ — hover ใช้ accent-foreground ของ theme
                          (selector ของ theme เจาะจงกว่า sx) เพราะสีรองบนพื้น accent ไม่ผ่าน */}
                      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 2 }}>
                        {(
                          [
                            ['in_plan', 'ต้องจ่ายทั้งหมด'],
                            ['unpaid', 'ยังไม่จ่าย'],
                            ['overdue', 'เกินกำหนด'],
                            ['partial', 'จ่ายบางส่วน'],
                            ['paid', 'จ่ายแล้ว'],
                          ] as const
                        ).map(([status, label]) => {
                          const on = chipOn(status);
                          const issue = status === 'overdue' && overdueCount > 0 && !on;
                          const count = chipCount(status);
                          return (
                            <Chip
                              key={status}
                              label={`${label} ${count}`}
                              icon={status === 'overdue' && overdueCount > 0 ? <WarningAmberRounded /> : undefined}
                              variant={on ? 'filled' : 'outlined'}
                              color={on ? 'primary' : issue ? 'warning' : 'default'}
                              aria-pressed={on}
                              onClick={() => toggleChip(status)}
                              sx={{ minHeight: 40, ...dataTextSx, fontWeight: 600, ...(count === 0 && !on ? { color: 'text.secondary' } : {}) }}
                            />
                          );
                        })}
                      </Stack>
                    </>
                  )}
                </Paper>
              </Box>
            )}

            <Box component="section" aria-labelledby="plan-items-heading">
              <Typography variant="h2" id="plan-items-heading" sx={{ mb: 1.5 }}>
                รายการของเดือนนี้
              </Typography>
              {/* อยู่นอกเงื่อนไขของตาราง ให้เห็นแม้ตัวกรองซ่อนทุกแถว */}
              {bulkFailures && (
                <Alert severity="error" onClose={() => setBulkFailures(null)} closeText="ปิด" sx={{ mb: 1.5 }}>
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
              {!planReady ? (
                <TableSkeleton rows={6} />
              ) : items.length === 0 ? (
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
                    // < md เหลือ checkbox · รายการ · ตามแผน — ประเภท/หมวด/ครบกำหนด/จ่ายแล้วพับเป็นบรรทัดรอง สถานะและปุ่มอยู่ใต้ชื่อ
                    // ที่ 320px: กล่อง 286 − checkbox 50 − ยอด ~94 ≈ ชื่อ 142px (375px ≈ 197px) ไม่ต้องเลื่อนแนวนอน
                    // ≥ md คอลัมน์ครบ 9 ช่อง และคอลัมน์จัดการ padding 6px ชดเชย spacing ระหว่างปุ่ม ตารางยังพอดีที่ 1200px
                    <TableContainer component={Paper} variant="outlined" tabIndex={0} role="region" aria-label="ตารางรายการของเดือนนี้">
                      {/* แถวที่เลือกไม่ใส่ `selected`: พื้น sidebar-accent ทำชิป ปุ่ม และข้อความรองในแถวไม่ผ่าน (มืด 1.15–1.47)
                          checkbox บอกสถานะแทน (เหมือนหน้าธุรกรรม) */}
                      <Table
                        size="small"
                        aria-label="รายการในแผนเดือนนี้"
                        sx={{ minWidth: { md: 880 }, ...COMPACT_CELLS, '& .MuiTableCell-root:not(.MuiTableCell-paddingCheckbox):last-child': { px: 0.75 } }}
                      >
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox" sx={{ py: 0.5, px: { xs: 0.5, md: 1 } }}>
                              <Checkbox
                                id="plan-select-all"
                                checked={allVisibleSelected}
                                indeterminate={selectedVisibleCount > 0 && !allVisibleSelected}
                                onChange={toggleAllVisible}
                                slotProps={{ input: { 'aria-label': 'เลือกทุกรายการที่แสดงอยู่' } }}
                              />
                            </TableCell>
                            <SortCell sortKey="kind" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))} sx={MD_UP}>ประเภท</SortCell>
                            <SortCell sortKey="name" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))}>รายการ</SortCell>
                            <SortCell sortKey="category" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))} sx={MD_UP}>หมวด</SortCell>
                            <SortCell sortKey="due_date" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))} sx={MD_UP}>ครบกำหนด</SortCell>
                            <SortCell sortKey="planned" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))} align="right">ตามแผน</SortCell>
                            <SortCell sortKey="paid" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))} align="right" sx={MD_UP}>จ่ายแล้ว</SortCell>
                            <SortCell sortKey="status" sort={itemSort} onSort={(k) => setItemSort((s) => nextSort(s, k))} sx={MD_UP}>สถานะ</SortCell>
                            <TableCell align="right" sx={MD_UP}>จัดการ</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {visibleItems.map((item) => {
                            const isSelected = selected.has(item.id);
                            // ยอดประมาณการไม่มีสถานะ partial สถานะจึงไม่บอกว่ายอดจริงต่างจากที่เดาไว้เท่าไร — คิดสดจาก
                            // paid − planned ไม่ใส่สี เพราะสูง/ต่ำกว่าประมาณไม่ใช่ดี/ร้าย ข้ามแถวที่ผูก income_record:
                            // planned คือยอดเต็ม แต่ payment คือยอดสุทธิ ส่วนต่างคือรายการหัก ไม่ใช่การประมาณคลาด
                            const estimateNote =
                              item.amount_mode === 'estimated' &&
                              item.income_record_id == null &&
                              item.paid_satang > 0 &&
                              item.paid_satang !== item.planned_amount_satang ? (
                                <>
                                  {item.paid_satang < item.planned_amount_satang ? 'ต่ำกว่าประมาณ ' : 'สูงกว่าประมาณ '}
                                  <Money satang={Math.abs(item.paid_satang - item.planned_amount_satang)} />
                                </>
                              ) : null;
                            // ส่วนใหญ่ของแผนมาจากรายการประจำ — ป้ายข้อยกเว้น ("ครั้งเดียว") แทนป้าย "ประจำ" เกือบทุกแถว
                            const oneOff = item.recurring_rule_id == null && item.installment_due_id == null;
                            return (
                              <TableRow key={item.id} hover>
                                {/* เลือกผ่าน checkbox เท่านั้น ไม่ใช่คลิกทั้งแถว — แถวมีปุ่มจัดการอยู่แล้ว คลิกพลาดจะเลือกแถวโดยไม่ตั้งใจ */}
                                <TableCell padding="checkbox" sx={{ py: 0.5, px: { xs: 0.5, md: 1 } }}>
                                  <Checkbox
                                    checked={isSelected}
                                    onChange={() => toggleSelected(item.id)}
                                    slotProps={{ input: { 'aria-label': `เลือก ${item.name}` } }}
                                  />
                                </TableCell>
                                <TableCell sx={MD_UP}>{KIND_LABEL[item.kind]}</TableCell>
                                <TableCell sx={NAME_CELL}>
                                  <Box title={item.name} sx={CLAMP_2}>{item.name}</Box>
                                  {/* ≥ md ป้ายข้อยกเว้นเป็น chip outlined เล็กใต้ชื่อ (แบบ "ประมาณการ" ของรายการประจำ) — < md อยู่ในบรรทัดรอง */}
                                  {oneOff && <Chip size="small" variant="outlined" label="ครั้งเดียว" sx={{ mt: 0.5, display: { xs: 'none', md: 'inline-flex' } }} />}
                                  <SecondaryLine
                                    parts={[
                                      ...(oneOff ? ['ครั้งเดียว'] : []),
                                      KIND_LABEL[item.kind],
                                      ...(item.category_name ? [item.category_name] : []),
                                      ...(item.due_date ? [<Box component="span" sx={dataTextSx}>ครบ {formatDayMonth(item.due_date)}</Box>] : []),
                                      ...(item.paid_satang > 0 ? [<>{item.kind === 'reserve' ? 'กันแล้ว' : 'จ่ายแล้ว'} <Money satang={item.paid_satang} /></>] : []),
                                      ...(estimateNote ? [estimateNote] : []),
                                    ]}
                                  />
                                  <Stack direction="row" sx={{ ...BELOW_MD, flexWrap: 'wrap', gap: 0.5, mt: 0.75, alignItems: 'center' }}>
                                    <PaymentStatusChip state={item.payment_state} kind={item.kind} incomeRecorded={recordedIncomeCount > 0} />
                                    {rowActions(item, true)}
                                  </Stack>
                                </TableCell>
                                <TableCell sx={{ ...MD_UP, ...dataTextSx }}>{item.category_name}</TableCell>
                                <TableCell sx={{ ...MD_UP, ...dataTextSx }}>{item.due_date && formatDate(item.due_date)}</TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                  <Money satang={item.planned_amount_satang} />
                                </TableCell>
                                {/* ช่องที่ไม่มีค่าเว้นว่าง ไม่ใส่ "—" — หัวคอลัมน์บอกความหมายอยู่แล้ว */}
                                <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}>
                                  {item.paid_satang > 0 && <Money satang={item.paid_satang} />}
                                </TableCell>
                                <TableCell sx={MD_UP}>
                                  <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                                    <PaymentStatusChip state={item.payment_state} kind={item.kind} incomeRecorded={recordedIncomeCount > 0} />
                                    {estimateNote && (
                                      <Typography variant="caption" color="text.secondary">
                                        {estimateNote}
                                      </Typography>
                                    )}
                                  </Stack>
                                </TableCell>
                                <TableCell align="right" sx={MD_UP}>
                                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                                    {rowActions(item, false)}
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

            {/* โหลดข้อมูลของตัวเอง (skeleton ของตัวเอง) — ระหว่างแผนยังไม่มาถือว่าแก้ไม่ได้ กันบันทึกรายได้ผูกกับรายการของเดือนผิด */}
            <IncomeSection
              key={month}
              ref={incomeRef}
              month={month}
              closed={!planReady || closed}
              items={items}
              // เรียกตอนฟอร์มรายได้กำลังปิด — ผลขึ้นหลังปิดสนิท (onExited) ส่วน reload เริ่มทันที
              onChanged={() => {
                pendingNoticeRef.current = { message: 'บันทึกรายได้แล้ว', severity: 'success' };
                return reload(true);
              }}
              onExited={flushNotice}
            />
          </>
        )}

        {/* รายการประจำไม่ผูกกับเดือน ใช้ไม่บ่อย จึงพับไว้เป็นค่าเริ่มต้น จำต่อเครื่อง — หัวข้อเป็นปุ่ม disclosure
            (aria-expanded) ส่วนปุ่มเพิ่มและความล้มเหลวอยู่นอกส่วนที่พับ ให้เห็นเสมอ */}
        {/* โหลดไม่ได้ = ส่วนที่พับซ่อนอยู่แม้ตั้งให้กางไว้ (LoadError แสดงแทน) — aria-expanded บอกตามที่เห็นจริง */}
        <Disclosure
          id="plan-rules-heading"
          title={`รายการประจำ${rulesError || rulesPending ? '' : ` (${activeRules.length})`}`}
          open={rulesOpen && !rulesError}
          onToggle={() => setRulesOpen(!rulesOpen)}
          action={
            <Button variant="outlined" size="small" startIcon={<AddRounded />} onClick={openAddRule}>
              เพิ่มรายการประจำ
            </Button>
          }
          notice={rulesError && <LoadError message={rulesError} onRetry={() => void reload(true)} />}
        >
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, ...descriptionSx }}>
                ระบบสร้างรายการให้ทุกเดือนที่เปิดดู การแก้กฎจะปรับเดือนถัดไปที่ยังไม่จ่ายให้ด้วย
                โดยไม่ย้อนแก้เดือนปัจจุบัน เดือนที่ปิด หรือรายการที่มีประวัติรับจ่ายแล้ว
              </Typography>
              {rulesPending ? (
                <TableSkeleton rows={3} />
              ) : activeRules.length === 0 ? (
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
                    // < md เหลือ ชื่อ · ยอด · จัดการ — ประเภท/หมวด/ความถี่/ช่วงที่ใช้พับเป็นบรรทัดรอง
                    // ที่ 320px: กล่อง 286 − ยอด ~94 − ปุ่ม 2 × 40 + ช่องไฟ ~96 ≈ ชื่อ 96px (375px ≈ 151px)
                    <TableContainer component={Paper} variant="outlined" tabIndex={0} role="region" aria-label="ตารางรายการประจำ">
                      <Table size="small" aria-label="รายการประจำ" sx={{ minWidth: { md: 800 }, ...COMPACT_CELLS }}>
                        <TableHead>
                          <TableRow>
                            <SortCell sortKey="kind" sort={ruleSort} onSort={(k) => setRuleSort((s) => nextSort(s, k))} sx={MD_UP}>ประเภท</SortCell>
                            <SortCell sortKey="name" sort={ruleSort} onSort={(k) => setRuleSort((s) => nextSort(s, k))}>ชื่อ</SortCell>
                            <SortCell sortKey="category" sort={ruleSort} onSort={(k) => setRuleSort((s) => nextSort(s, k))} sx={MD_UP}>หมวด</SortCell>
                            <SortCell sortKey="frequency" sort={ruleSort} onSort={(k) => setRuleSort((s) => nextSort(s, k))} sx={MD_UP}>ความถี่</SortCell>
                            <SortCell sortKey="start_date" sort={ruleSort} onSort={(k) => setRuleSort((s) => nextSort(s, k))} sx={MD_UP}>ช่วงที่ใช้</SortCell>
                            <SortCell sortKey="amount" sort={ruleSort} onSort={(k) => setRuleSort((s) => nextSort(s, k))} align="right">ยอด</SortCell>
                            <TableCell align="right">จัดการ</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {visibleRules.map((rule) => {
                            const range = `${formatDate(rule.start_date)} – ${rule.end_date ? formatDate(rule.end_date) : 'ไม่กำหนด'}`;
                            return (
                              <TableRow key={rule.id} hover>
                                <TableCell sx={MD_UP}>{KIND_LABEL[rule.kind]}</TableCell>
                                <TableCell sx={NAME_CELL}>
                                  <Box title={rule.name} sx={CLAMP_2}>{rule.name}</Box>
                                  <SecondaryLine
                                    parts={[
                                      KIND_LABEL[rule.kind],
                                      ...(rule.category_name ? [rule.category_name] : []),
                                      frequencyLabel(rule),
                                      <Box component="span" sx={dataTextSx}>{range}</Box>,
                                    ]}
                                  />
                                </TableCell>
                                <TableCell sx={MD_UP}>{rule.category_name}</TableCell>
                                <TableCell sx={MD_UP}>{frequencyLabel(rule)}</TableCell>
                                <TableCell sx={{ ...MD_UP, ...dataTextSx }}>{range}</TableCell>
                                <TableCell align="right">
                                  <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                                    <Money satang={rule.amount_satang} sx={{ whiteSpace: 'nowrap' }} />
                                    {rule.amount_mode === 'estimated' && <Chip size="small" label="ประมาณการ" variant="outlined" />}
                                  </Stack>
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.5 }}>
                                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <RowIconButton label={`แก้ไข ${rule.name}`} tooltip="แก้ไข" onClick={() => openEditRule(rule)}>
                                      <EditRounded fontSize="small" />
                                    </RowIconButton>
                                    {/* ไม่มี unarchive ใน API (ดู docs/status.md) ย้อนกลับจากหน้าจอไม่ได้ ต้องถามก่อน */}
                                    <RowIconButton
                                      label={`เลิกใช้ ${rule.name}`}
                                      tooltip="เลิกใช้"
                                      color="error"
                                      onClick={() => {
                                        setFormError('');
                                        setArchivingRule(rule);
                                      }}
                                    >
                                      <ArchiveOutlined fontSize="small" />
                                    </RowIconButton>
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
        </Disclosure>
      </Stack>

      <Modal
        open={itemModalOpen}
        title={editingItemId == null ? 'เพิ่มรายการในแผน' : 'แก้ไขรายการในแผน'}
        onClose={() => setItemModalOpen(false)}
        busy={submitting}
        dirty={JSON.stringify(itemForm) !== JSON.stringify(itemInitial)}
        footer={{ formId: 'plan-item-form', submitLabel: 'บันทึก' }}
        onExited={flushNotice}
      >
        <Box
          component="form"
          id="plan-item-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitItem();
          }}
        >
          <Stack spacing={2.5}>
            {refsAlert}
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
                {...amountFieldHelp(itemForm.amount_baht)}
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
          </Stack>
        </Box>
      </Modal>

      <Modal
        open={ruleModalOpen}
        title={editingRuleId == null ? 'เพิ่มรายการประจำ' : 'แก้ไขรายการประจำ'}
        onClose={() => setRuleModalOpen(false)}
        busy={submitting}
        dirty={JSON.stringify(ruleForm) !== JSON.stringify(ruleInitial)}
        footer={{ formId: 'plan-rule-form', submitLabel: 'บันทึก' }}
        onExited={flushNotice}
      >
        <Box
          component="form"
          id="plan-rule-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitRule();
          }}
        >
          <Stack spacing={2.5}>
            {refsAlert}
            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1.5, color: 'text.primary', fontWeight: 600 }}>
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
                  {...amountFieldHelp(ruleForm.amount_baht)}
                  slotProps={{ htmlInput: { inputMode: 'decimal', sx: dataTextSx } }}
                />
                <TextField select label="ชนิดยอด" value={ruleForm.amount_mode} onChange={setRuleField('amount_mode')}>
                  <MenuItem value="fixed">ยอดคงที่</MenuItem>
                  <MenuItem value="estimated">ยอดประมาณการ</MenuItem>
                </TextField>
              </Box>
            </Box>

            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1.5, color: 'text.primary', fontWeight: 600 }}>
                ความถี่
              </FormLabel>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
                {/* คำเดียวกับฟอร์มแผนผ่อน ("ทุกกี่รอบ" + "หน่วยรอบ") */}
                <TextField
                  label="ทุกกี่รอบ"
                  value={ruleForm.frequency_interval}
                  onChange={setRuleField('frequency_interval')}
                  required
                  slotProps={{ htmlInput: { inputMode: 'numeric', sx: dataTextSx } }}
                />
                <TextField select label="หน่วยรอบ" value={ruleForm.frequency_unit} onChange={setRuleField('frequency_unit')} required>
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
          </Stack>
        </Box>
      </Modal>

      {/* แถวที่จ่ายครบแล้ว (paymentFormOpen = false) เปิดเป็นประวัติ ไม่มี footer — "บันทึกเพิ่ม" เปิดฟอร์มยอดว่าง ปุ่มหายไป
          พร้อมกัน focus จึงไปที่ช่องยอด (autoFocus) ฟอร์มอยู่บนเสมอเมื่อเปิดอยู่ ประวัติต่อท้าย */}
      <Modal
        open={payingItem != null}
        title={`${paymentFormOpen ? payingVerb : reserving ? 'การกันเงิน' : 'การจ่าย'} — ${payingItemLive?.name ?? ''}`}
        onClose={() => setPayingItem(null)}
        busy={submitting}
        dirty={paymentDirty}
        footer={paymentFormOpen ? { formId: 'plan-payment-form', submitLabel: payingVerb } : undefined}
        onExited={flushNotice}
      >
        <Stack spacing={2.5}>
          {paymentFormOpen && (
            <Box
              component="form"
              id="plan-payment-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitPayment();
              }}
            >
              <Stack spacing={2.5}>
                {refsAlert}
                {/* ADR-0004: การบันทึกจ่ายนับเป็นยอดจ่ายทันที ไม่มีขั้นรอจับคู่กับ statement */}
                <Alert severity="info" role="status" sx={descriptionSx}>
                  {PLAN_NOT_MATCHED_NOTE} · การบันทึกนี้ไม่สร้างรายการธุรกรรม ยอดบางส่วนบันทึกหลายครั้งได้
                </Alert>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
                  <TextField
                    label={reserving ? 'จำนวนเงินที่กันไว้ (บาท)' : 'จำนวนเงินที่จ่าย (บาท)'}
                    value={paymentForm.amount_baht}
                    onChange={setPaymentField('amount_baht')}
                    required
                    autoFocus={addingPayment}
                    {...amountFieldHelp(paymentForm.amount_baht)}
                    slotProps={{ htmlInput: { inputMode: 'decimal', sx: dataTextSx } }}
                  />
                  <TextField
                    type="date"
                    label={reserving ? 'วันที่กัน' : 'วันที่จ่าย'}
                    value={paymentForm.paid_date}
                    onChange={setPaymentField('paid_date')}
                    required
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { sx: dataTextSx } }}
                  />
                  <TextField select label={reserving ? 'บัญชีที่กันเงินไว้' : 'บัญชีที่จ่าย'} value={paymentForm.bank_account_id} onChange={setPaymentField('bank_account_id')} required>
                    <MenuItem value="">
                      <em>— เลือกบัญชี —</em>
                    </MenuItem>
                    {accounts.map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.nickname}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              </Stack>
            </Box>
          )}

          {payingItemLive != null && payingItemLive.payments.length > 0 && (
            <Box component="section" aria-labelledby="payment-history-heading">
              <Typography component="h3" variant="h2" id="payment-history-heading" sx={{ fontSize: '1rem', lineHeight: 1.5, mb: 1 }}>
                ประวัติการบันทึก
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
                          </Box>
                          <Box component="span" aria-hidden>{' · '}</Box>
                          {p.account_nickname}
                          <Box component="span" aria-hidden>{' · '}</Box>
                          {p.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'บันทึกไว้แล้ว'}
                        </Typography>
                      </Box>
                      {/* ชื่อเต็ม ไม่ใช่ "ยกเลิก" ซ้ำกับปุ่มปิดฟอร์มด้านล่าง — ชื่อเดียวกับหน้าแผนผ่อน (เงินกันไว้ใช้คำของการกันเงิน)
                          ถามก่อนเหมือนหน้าแผนผ่อน: ปิดฟอร์มนี้ก่อนเปิด dialog ยืนยัน */}
                      {p.status !== 'cancelled' && (
                        <Button
                          size="small"
                          color="error"
                          startIcon={<DeleteOutlineRounded />}
                          aria-disabled={submitting}
                          aria-label={`${cancelPaymentVerb(payingItemLive)} ${formatDate(p.paid_date)} ฿${formatBaht(p.amount_satang)}`}
                          onClick={() => {
                            if (submitting) return;
                            setFormError('');
                            setCancellingPayment({ item: payingItemLive, payment: p });
                            setPayingItem(null);
                          }}
                        >
                          {cancelPaymentVerb(payingItemLive)}
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          {payingItemLive != null && !paymentFormOpen && (
            <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setAddingPayment(true)} sx={{ alignSelf: 'flex-start' }}>
              บันทึกเพิ่ม
            </Button>
          )}

          {formError && <Alert severity="error">{formError}</Alert>}
        </Stack>
      </Modal>

      {/* ยกเลิกการบันทึกจ่ายถามก่อนเสมอ (เหมือนหน้าแผนผ่อน) — ฟอร์มจ่ายปิดไปก่อนแล้ว ปุ่มในฟอร์มที่ MUI จะคืน focus ให้หายไปด้วย
          จึงส่ง focus กลับปุ่มของแถว (ป้ายอาจสลับ "ดูการจ่าย" → "บันทึกจ่าย" แต่ key เดิม) หลัง dialog ปิดสนิท */}
      <ConfirmDialog
        open={cancellingPayment != null}
        title={cancellingPayment ? cancelPaymentVerb(cancellingPayment.item) : ''}
        description={
          cancellingPayment && (
            <>
              ยกเลิกยอด <Money satang={cancellingPayment.payment.amount_satang} /> วันที่{' '}
              <Box component="span" sx={dataTextSx}>{formatDate(cancellingPayment.payment.paid_date)}</Box> ของ "{cancellingPayment.item.name}" หรือไม่?
              ยอดนี้จะถูกนำออกจาก{cancellingPayment.item.kind === 'reserve' ? 'ยอดที่กันแล้ว' : 'ยอดจ่ายแล้ว'} ประวัติยังเห็นเป็น "ยกเลิกแล้ว"
              {dialogError}
            </>
          )
        }
        confirmLabel={cancellingPayment ? cancelPaymentVerb(cancellingPayment.item) : ''}
        confirmColor="error"
        busy={submitting}
        onClose={() => setCancellingPayment(null)}
        onConfirm={() => {
          if (!cancellingPayment) return;
          const { item, payment } = cancellingPayment;
          void run(
            () => patch(`/api/monthly-item-payments/${payment.id}`, { status: 'cancelled' }),
            `${cancelPaymentVerb(item)}แล้ว`,
            () => setCancellingPayment(null),
          );
        }}
        onExited={() => {
          const row = payButtonRef.current;
          if ((document.activeElement == null || document.activeElement === document.body) && row?.isConnected) row.focus({ preventScroll: true });
          else rescueFocus();
          flushNotice();
        }}
      />

      <ConfirmDialog
        open={closing}
        title="ปิดเดือนนี้"
        description={
          <>
            ปิดเดือนแล้วแก้รายการไม่ได้จนกดเปิดอีกครั้ง ระบบเก็บภาพสรุปตอนปิดไว้ตรวจย้อนหลัง
            {dialogError}
          </>
        }
        confirmLabel="ปิดเดือน"
        confirmColor="warning"
        busy={submitting}
        onClose={() => setClosing(false)}
        onConfirm={() => void run(() => post(`/api/monthly-plans/${month}/close`, {}), 'ปิดเดือนแล้ว', () => setClosing(false))}
        onExited={flushNotice}
      />

      <ConfirmDialog
        open={archivingRule != null}
        title="เลิกใช้รายการประจำ"
        description={
          <>
            เลิกใช้ "{archivingRule?.name ?? ''}" หรือไม่? รายการในเดือนถัดไปที่ยังไม่จ่ายจะถูกนำออก ส่วนเดือนปัจจุบัน เดือนที่ปิด และรายการที่มีประวัติรับจ่ายแล้วจะคงอยู่ — ตอนนี้ยังไม่มีปุ่มเปิดใช้กลับ ต้องสร้างกฎใหม่
            {dialogError}
          </>
        }
        confirmLabel="เลิกใช้"
        confirmColor="error"
        busy={submitting}
        onClose={() => setArchivingRule(null)}
        onConfirm={() => {
          if (!archivingRule) return;
          void run(
            () => post(`/api/recurring-rules/${archivingRule.id}/archive`, {}),
            'ปิดใช้งานรายการประจำแล้ว — นำรายการเดือนถัดไปที่ยังไม่จ่ายออกแล้ว',
            () => setArchivingRule(null),
          );
        }}
        // แถวของกฎหายไปพร้อมปุ่มต้นทาง — MUI คืน focus ไม่ได้
        onExited={() => {
          rescueFocus();
          flushNotice();
        }}
      />

      {/* ลบทีละแถวต้องถามก่อนเสมอ (กู้คืนไม่ได้) — แถวหายไปพร้อมปุ่มต้นทาง จึงส่ง focus ต่อหลัง dialog ปิดสนิท */}
      <ConfirmDialog
        open={deletingItem != null}
        title={`ลบ "${deletingItem?.name ?? ''}"`}
        description={
          <>
            ลบแล้วกู้คืนไม่ได้ ต้องเพิ่มรายการใหม่เอง ถ้าแค่เดือนนี้ไม่ต้องจ่าย ใช้ ข้าม แทน
            {dialogError}
          </>
        }
        confirmLabel="ลบรายการ"
        confirmColor="error"
        busy={submitting}
        onClose={() => setDeletingItem(null)}
        onConfirm={() => {
          if (!deletingItem) return;
          const target = deletingItem;
          void run(() => del(`/api/monthly-plan-items/${target.id}`), 'ลบรายการแล้ว', () => setDeletingItem(null));
        }}
        onExited={() => {
          rescueFocus();
          flushNotice();
        }}
      />

      <Modal
        open={bulkAction === 'pay'}
        title={`${bulkWords.verb} ${payPlan.ok.length} รายการ`}
        onClose={() => setBulkAction(null)}
        busy={bulkRunning}
        dirty={JSON.stringify([bulkPayForm, bulkAmounts]) !== bulkInitial}
        footer={{ formId: 'plan-bulk-pay-form', submitLabel: `${bulkWords.verb} ${payPlan.ok.length} รายการ` }}
      >
        <Box
          component="form"
          id="plan-bulk-pay-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitBulkPay();
          }}
        >
          <Stack spacing={2.5}>
            {refsAlert}
            <Alert severity="info" role="status" sx={descriptionSx}>
              {PLAN_NOT_MATCHED_NOTE} · การบันทึกนี้ไม่สร้างรายการธุรกรรม
            </Alert>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
              <TextField
                type="date"
                label={bulkWords.date}
                value={bulkPayForm.paid_date}
                onChange={setBulkPayField('paid_date')}
                required
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { sx: dataTextSx } }}
              />
              <TextField select label={bulkWords.account} value={bulkPayForm.bank_account_id} onChange={setBulkPayField('bank_account_id')} required>
                <MenuItem value="">
                  <em>— เลือกบัญชี —</em>
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
                const amountLabel = i.kind === 'reserve' ? 'ยอดที่กัน (บาท)' : 'ยอดที่จ่าย (บาท)';
                return (
                  <Box
                    component="li"
                    key={i.id}
                    sx={{ display: 'grid', gap: 1, alignItems: 'center', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 14rem' } }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{i.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {i.amount_mode === 'estimated' ? 'ยอดประมาณการ — กรอกยอดจากบิลจริง' : 'ยอดคงที่'}
                      </Typography>
                    </Box>
                    <TextField
                      size="small"
                      label={amountLabel}
                      value={value}
                      onChange={(e) => setBulkAmounts((prev) => ({ ...prev, [i.id]: e.target.value }))}
                      required
                      {...amountFieldHelp(value)}
                      slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': `${amountLabel} — ${i.name}`, sx: dataTextSx } }}
                    />
                  </Box>
                );
              })}
            </Stack>

            {payPlan.excluded.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
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
          </Stack>
        </Box>
      </Modal>

      {/* dialog แบบกลุ่มปิดตัวเองก่อนเริ่มยิง (ต่างจาก ConfirmDialog ตัวอื่นที่รอ busy) — ปุ่มบนแถบเป็น aria-disabled
          ระหว่างทำ MUI จึงคืน focus ให้ปุ่มต้นทางได้ และแถบบอก "กำลังดำเนินการ…" */}
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

      {/* "ผูกกับรายได้" เมื่อมีรายได้หลายรายการ: เลือกรายได้ที่หักรายการนี้ (ชื่อ · ยอดสุทธิ) แล้วเปิดฟอร์มแก้ไขรายได้นั้น
          ยอดสีกลาง — พื้น hover ของเมนูเป็น accent ซึ่งสีรายรับไม่ผ่าน */}
      <Menu
        id="plan-link-income-menu"
        anchorEl={linkMenu?.anchor}
        open={linkMenu?.open ?? false}
        onClose={() => setLinkMenu((m) => (m ? { ...m, open: false } : m))}
        slotProps={{ list: { 'aria-label': `เลือกรายได้ที่หัก ${linkMenu?.item.name ?? ''}` } }}
      >
        {(linkMenu?.incomes ?? []).map((income) => (
          <MenuItem key={income.id} onClick={() => pickIncome(income.id)} sx={{ minHeight: 40, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
            {/* span เดียวห่อทั้งบรรทัด — MenuItem เป็น flex ช่องว่างรอบ " · " จะหายถ้าแยกเป็น flex item */}
            <Box component="span">
              {income.name}
              <Box component="span" aria-hidden>{' · '}</Box>
              สุทธิ <Money satang={income.expected_net_satang} />
            </Box>
          </MenuItem>
        ))}
      </Menu>

      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} placement={barVisible ? 'top' : 'bottom'} />
    </Box>
  );
}
