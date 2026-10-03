import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Radio,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SchoolRounded from '@mui/icons-material/SchoolRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import PercentRounded from '@mui/icons-material/PercentRounded';
import SavingsRounded from '@mui/icons-material/SavingsRounded';
import ScienceRounded from '@mui/icons-material/ScienceRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import { put, req, type StudentLoanProjection, type StudentLoanResponse, type StudentLoanScenario } from '../api.js';
import Money from '../components/Money.js';
import SummaryCard, { summaryRowSx } from '../components/SummaryCard.js';
import Modal from '../Modal.js';
import { AMOUNT_FORMAT_HINT, formatBaht, formatDate, parseBahtToSatang, todayInBangkok } from '../format.js';
import { dataTextSx, descriptionSx } from '../theme.js';
import {
  amountFieldHelp,
  BELOW_MD,
  Disclosure,
  EmptyState,
  FeedbackSnackbar,
  LoadError,
  MD_UP,
  PageHeader,
  TableSkeleton,
  useStoredOpen,
  visuallyHiddenSx,
  type Notice,
} from '../ui.js';

const SCENARIO_LABEL: Record<StudentLoanScenario, string> = {
  lump_sum: 'เก็บออมแล้วปิดทีเดียว',
  extra_monthly: 'โปะเข้า กยศ. ทุกเดือน',
  minimum_only: 'จ่ายขั้นต่ำอย่างเดียว',
};

// บอกกลไก ไม่บอกผล — ผล (ถูก/แพง, เร็ว/ช้า) ขึ้นกับตัวเลขที่ลองใส่ ตารางเทียบบอกเองแล้ว
const SCENARIO_HINT: Record<StudentLoanScenario, string> = {
  lump_sum: 'จ่าย กยศ. ตามปกติ เก็บเงินไว้ต่างหาก แล้วปิดบัญชีทีเดียวเมื่อเงินพอ (ได้ส่วนลดเงินต้น)',
  extra_monthly: 'ส่งเงินที่จะเก็บออมเข้า กยศ. ทุกเดือนแทน เงินต้นลดเร็ว ดอกเบี้ยจึงเดินน้อยลง แต่ส่วนลดปิดบัญชีคิดจากเงินต้นที่เหลือตอนปิด',
  minimum_only: 'ไม่โปะเลย เดินตามตาราง Step Up จนครบ 15 งวด',
};

const SCENARIOS: StudentLoanScenario[] = ['lump_sum', 'extra_monthly', 'minimum_only'];

/** รอให้พิมพ์นิ่งก่อนค่อยคำนวณใหม่ — สั้นกว่านี้หน้าจะกระตุกระหว่างพิมพ์ ยาวกว่านี้จะรู้สึกหน่วง */
const WHAT_IF_DEBOUNCE_MS = 500;

/** ต่างกันเกินเท่านี้ถือว่ากรอกเลขผิด ไม่ใช่ความคลาดเคลื่อนตามปกติ (500 บาท) */
const CALIBRATION_TOLERANCE_SATANG = 500 * 100;

const WHAT_IF_PAYMENT_ID = 'student-loan-what-if-payment';
const WHAT_IF_SAVING_ID = 'student-loan-what-if-saving';
const EDIT_BUTTON_ID = 'student-loan-edit';

/** query override ของค่าทดลอง — ค่าที่อ่านไม่ได้ไม่ถูกส่ง (ใช้ค่าที่บันทึกไว้) ช่องนั้นขึ้น error บอกรูปแบบที่ถูกแทนการเงียบ */
function trialQuery(saving: string, payment: string): string {
  const p = new URLSearchParams();
  const savingSatang = parseBahtToSatang(saving);
  if (savingSatang != null) p.set('monthly_saving_satang', String(savingSatang));
  const paymentSatang = parseBahtToSatang(payment);
  if (paymentSatang != null) p.set('monthly_payment_satang', String(paymentSatang));
  return p.toString();
}

// < md ตัดคอลัมน์รอง (MD_UP / BELOW_MD) แล้วพับลงบรรทัดรอง + padding แนวนอน 6px — ที่ 320px กล่องตารางกว้าง 286
// ตารางรายเดือน 3 คอลัมน์: จ่าย ~82 + คงเหลือ ~100 เหลือวันที่ ~100px ไม่ต้องเลื่อนแนวนอน (ท่าเดียวกับหน้าวางแผน)
const COMPACT_CELLS = { '& .MuiTableCell-root': { px: { xs: 0.75, sm: 1.5, md: 2 } } } as const;
// คอลัมน์แรกกินที่ที่เหลือ < md (maxWidth 0 กันดันตารางกว้างเกินกล่อง) ≥ md กว้างตามเนื้อหา
const NAME_CELL = { width: { xs: '100%', md: 'auto' }, maxWidth: { xs: 0, md: 'none' } } as const;
const NUM_CELL = { whiteSpace: 'nowrap' } as const;
const SECONDARY_LINE = { ...BELOW_MD, mt: 0.5 } as const;

type FormState = {
  principal_original_baht: string;
  first_due_date: string;
  as_of_date: string;
  principal_remaining_baht: string;
  interest_accrued_baht: string;
  app_annual_due_baht: string;
  monthly_payment_baht: string;
  monthly_saving_baht: string;
  savings_balance_baht: string;
  payoff_discount_percent: string;
  payment_day: string;
};
type FormKey = keyof FormState;
type FieldErrors = Partial<Record<FormKey, string>>;

// วันนี้คำนวณตอนเปิดฟอร์ม ไม่ใช่ตอนโหลดไฟล์ — เปิดแท็บค้างข้ามคืนแล้วค่าตั้งต้นยังเป็นวันนี้ตามเวลาไทย
const emptyForm = (): FormState => ({
  principal_original_baht: '',
  first_due_date: '',
  as_of_date: todayInBangkok(),
  principal_remaining_baht: '',
  interest_accrued_baht: '0',
  app_annual_due_baht: '',
  monthly_payment_baht: '',
  monthly_saving_baht: '',
  savings_balance_baht: '0',
  payoff_discount_percent: '3',
  payment_day: '5',
});

/** ลำดับเดียวกับช่องในฟอร์ม — กดบันทึกแล้ว focus ไปช่องแรกที่ผิด */
const FIELD_ORDER: FormKey[] = [
  'principal_original_baht',
  'first_due_date',
  'as_of_date',
  'principal_remaining_baht',
  'interest_accrued_baht',
  'app_annual_due_baht',
  'monthly_payment_baht',
  'monthly_saving_baht',
  'savings_balance_baht',
  'payoff_discount_percent',
  'payment_day',
];

const MONEY_KEYS: ReadonlySet<FormKey> = new Set([
  'principal_original_baht',
  'principal_remaining_baht',
  'interest_accrued_baht',
  'app_annual_due_baht',
  'monthly_payment_baht',
  'monthly_saving_baht',
  'savings_balance_baht',
]);

// ช่องที่ไม่อยู่ในนี้ว่างได้ (ยอดครบกำหนดปีนี้) หรือว่างไม่ได้อยู่แล้ว (วันที่ชำระเป็นช่องเลือก)
const REQUIRED_MESSAGE: FieldErrors = {
  principal_original_baht: 'กรอกยอดกู้ตามสัญญา',
  first_due_date: 'เลือกวันครบกำหนดชำระครั้งแรก',
  as_of_date: 'เลือกวันที่ที่เปิดแอปดูยอดชุดนี้',
  principal_remaining_baht: 'กรอกเงินต้นคงเหลือ',
  interest_accrued_baht: 'กรอกดอกเบี้ยค้าง (ไม่มีให้ใส่ 0)',
  monthly_payment_baht: 'กรอกยอดที่จ่าย กยศ. ต่อเดือน',
  monthly_saving_baht: 'กรอกยอดเก็บออมต่อเดือน (ไม่เก็บให้ใส่ 0)',
  savings_balance_baht: 'กรอกเงินเก็บที่มีอยู่แล้ว (ไม่มีให้ใส่ 0)',
  payoff_discount_percent: 'กรอกส่วนลด — ปัจจุบัน กยศ. ลด 3%',
};

const DISCOUNT_HINT = 'ใส่ 0–100 ทศนิยมไม่เกิน 2 ตำแหน่ง เช่น 3';

/** % ทศนิยม 2 ตำแหน่ง = basis point จำนวนเต็ม — แยกที่จุดแบบเดียวกับสตางค์ (parseBahtToSatang) ไม่คูณ float */
function discountBp(input: string): number | null {
  const value = input.trim();
  const bp = /^\d+(\.\d{1,2})?$/.test(value) ? parseBahtToSatang(value) : null;
  return bp != null && bp <= 10_000 ? bp : null;
}

/** error ที่รู้ได้ระหว่างพิมพ์ (ไม่รวม "ยังไม่ได้กรอก" ซึ่งบอกตอนกดบันทึก) — ชุดเดียวกับที่ server ปฏิเสธ */
function liveError(form: FormState, key: FormKey): string | undefined {
  const value = form[key].trim();
  if (value === '') return undefined;
  if (key === 'payoff_discount_percent') return discountBp(value) == null ? DISCOUNT_HINT : undefined;
  if (!MONEY_KEYS.has(key)) return undefined;
  const satang = parseBahtToSatang(value);
  if (satang == null) return AMOUNT_FORMAT_HINT;
  if (key === 'principal_original_baht' && satang === 0) return 'ต้องมากกว่า 0';
  if (key === 'app_annual_due_baht' && satang === 0) return 'ต้องมากกว่า 0 หรือเว้นว่างไว้';
  if (key === 'principal_remaining_baht') {
    const original = parseBahtToSatang(form.principal_original_baht);
    if (original != null && satang > original) return 'ต้องไม่มากกว่ายอดกู้ตามสัญญา';
  }
  return undefined;
}

/** แผนที่ค่าต่ำสุด — ทุกแผนเท่ากันไม่มีใครชนะ ไม่ติดป้าย (เช่นเก็บออม 0 ทั้งสามแผนเหมือนกัน) */
function winners(entries: [StudentLoanScenario, number][]): StudentLoanScenario[] {
  const min = Math.min(...entries.map(([, v]) => v));
  return entries.some(([, v]) => v > min) ? entries.filter(([, v]) => v === min).map(([s]) => s) : [];
}

/** บรรทัดเทียบกับจ่ายขั้นต่ำ — แผนที่ยังปิดไม่ได้ไม่เทียบ เพราะยอดจ่ายรวมยังไม่ใช่ยอดจนปิดหนี้ */
function vsMinimum(p: StudentLoanProjection, base: StudentLoanProjection): ReactNode {
  if (p.payoff_date == null || base.payoff_date == null) return null;
  const cheaper = base.total_payment_satang - p.total_payment_satang;
  const sooner = base.months_remaining - p.months_remaining;
  const parts: ReactNode[] = [];
  if (cheaper !== 0) parts.push(<>{cheaper > 0 ? 'จ่ายรวมถูกกว่า' : 'จ่ายรวมแพงกว่า'} <Money satang={Math.abs(cheaper)} /></>);
  if (sooner !== 0) {
    parts.push(<>{sooner > 0 ? 'เร็วกว่า' : 'ช้ากว่า'} <Box component="span" sx={dataTextSx}>{Math.abs(sooner)}</Box> เดือน</>);
  }
  if (parts.length === 0) return 'เท่ากับจ่ายขั้นต่ำ';
  return <>เทียบจ่ายขั้นต่ำ: {parts[0]}{parts[1] && <> · {parts[1]}</>}</>;
}

const payoffText = (p: StudentLoanProjection) => (p.payoff_date ? formatDate(p.payoff_date) : 'ยังปิดไม่ได้');
const num = (n: number | string) => <Box component="span" sx={dataTextSx}>{n}</Box>;
/** วันปิดหนี้ในประโยค — วันที่ใช้ฟอนต์ตัวเลข คำว่า "ยังปิดไม่ได้" เป็นข้อความ */
const payoffNode = (p: StudentLoanProjection) => (p.payoff_date ? num(formatDate(p.payoff_date)) : 'ยังปิดไม่ได้');

/** "เดิม X → Y" — ลูกศรซ่อนจาก screen reader แล้วอ่านว่า "เป็น" แทน */
const beforeAfter = (before: ReactNode, after: ReactNode) => (
  <>
    เดิม {before} <span aria-hidden>→</span>
    <Box component="span" sx={visuallyHiddenSx}>เป็น</Box> {after}
  </>
);

export default function StudentLoan() {
  const [data, setData] = useState<StudentLoanResponse | null>(null);
  // ผลล่าสุดที่ไม่มีค่าทดลอง — ไว้บอก "เดิม → ใหม่" ระหว่างลองตัวเลข (data === baseline = บนจอไม่ใช่ค่าทดลอง)
  const [baseline, setBaseline] = useState<StudentLoanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [scenario, setScenario] = useState<StudentLoanScenario>('lump_sum');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  // ค่าตอนเปิดฟอร์ม — ต่างจากนี้ = dirty (The Unsaved Modal Rule)
  const [formInitial, setFormInitial] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [focusField, setFocusField] = useState<FormKey | null>(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingTrial, setSavingTrial] = useState(false);
  // บันทึกค่าทดลองไม่สำเร็จ — แสดงค้างในส่วนนั้น ไม่ใช่ snackbar ที่หายเอง
  const [trialError, setTrialError] = useState('');
  const [monthlyOpen, setMonthlyOpen] = useStoredOpen('hyacinthia.studentLoan.monthlyOpen');
  const [methodOpen, setMethodOpen] = useStoredOpen('hyacinthia.studentLoan.methodOpen');
  // ลองปรับตัวเลขดูโดยไม่บันทึกทับของเดิม — ส่งเป็น query override ให้ server คำนวณใหม่
  const [whatIfSaving, setWhatIfSaving] = useState('');
  const [whatIfPayment, setWhatIfPayment] = useState('');
  // ค่าที่ "ยิงจริง" ตามหลังค่าที่พิมพ์อยู่ WHAT_IF_DEBOUNCE_MS — ผูก queryString กับ state ที่พิมพ์
  // ตรง ๆ จะยิง request ทุกครั้งที่กดคีย์ กว่าจะพิมพ์ 10000 ครบก็โหลดใหม่ไปห้ารอบ
  const [appliedSaving, setAppliedSaving] = useState('');
  const [appliedPayment, setAppliedPayment] = useState('');
  const requestIdRef = useRef(0);
  // ปุ่มที่เปิดฟอร์ม (EmptyState / แถบเตือน) หายไปได้เมื่อข้อมูลใหม่มา — ตอนนั้น focus ตกไป <body>
  const refocusEditRef = useRef(false);
  // ผลสำเร็จของฟอร์มใน Modal — `#root` เป็น aria-hidden จนปิดสนิท จึงแสดงจาก onExited (เหมือนหน้าวางแผน/แผนผ่อน)
  const pendingNoticeRef = useRef<Notice | null>(null);
  const flushNotice = () => {
    const pending = pendingNoticeRef.current;
    pendingNoticeRef.current = null;
    if (pending) setNotice(pending);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSaving(whatIfSaving);
      setAppliedPayment(whatIfPayment);
    }, WHAT_IF_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [whatIfSaving, whatIfPayment]);

  const queryString = useMemo(() => trialQuery(appliedSaving, appliedPayment), [appliedSaving, appliedPayment]);
  // ค่าล่าสุดสำหรับงาน async — closure ที่รอ PUT อยู่ถือค่าก่อน debounce ยิง
  const queryStringRef = useRef(queryString);
  queryStringRef.current = queryString;

  // qs ส่งตรงได้ — หลังบันทึก state ของค่าทดลองถูกล้างแล้วแต่ closure ยังถือ queryString เดิม
  const reload = async (qs = queryString) => {
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    setError('');
    try {
      const result = await req<StudentLoanResponse>(`/api/student-loan${qs ? `?${qs}` : ''}`);
      if (requestId !== requestIdRef.current) return;
      setData(result);
      if (qs === '') setBaseline(result);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลหนี้ กยศ. ไม่สำเร็จ');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  useEffect(() => {
    if (!refocusEditRef.current) return;
    refocusEditRef.current = false;
    if (document.activeElement === document.body) document.getElementById(EDIT_BUTTON_ID)?.focus();
  }, [data]);

  const clearTrial = () => {
    setWhatIfSaving('');
    setWhatIfPayment('');
    setAppliedSaving('');
    setAppliedPayment('');
    setTrialError('');
  };

  /** ล้างค่าทดลองแล้วโหลดค่าที่บันทึกไว้ครั้งเดียว — มีค่าทดลองอยู่ effect ของ queryString โหลดให้เอง */
  const clearTrialAndReload = () => {
    const hadTrial = queryStringRef.current !== '';
    clearTrial();
    if (!hadTrial) void reload('');
  };

  const openEdit = (focus: FormKey | null = null) => {
    const loan = data?.loan;
    const next: FormState =
      loan == null
        ? emptyForm()
        : {
            principal_original_baht: formatBaht(loan.principal_original_satang),
            first_due_date: loan.first_due_date,
            as_of_date: loan.as_of_date,
            principal_remaining_baht: formatBaht(loan.principal_remaining_satang),
            interest_accrued_baht: formatBaht(loan.interest_accrued_satang),
            app_annual_due_baht: loan.app_annual_due_satang == null ? '' : formatBaht(loan.app_annual_due_satang),
            monthly_payment_baht: formatBaht(loan.monthly_payment_satang),
            monthly_saving_baht: formatBaht(loan.monthly_saving_satang),
            savings_balance_baht: formatBaht(loan.savings_balance_satang),
            payoff_discount_percent: String(loan.payoff_discount_bp / 100),
            payment_day: String(loan.payment_day),
          };
    setForm(next);
    setFormInitial(next);
    setFieldErrors({});
    setFormError('');
    setFocusField(focus);
    setModalOpen(true);
  };

  const onField = (key: FormKey) => (event: { target: { value: string } }) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((errors) => (errors[key] ? { ...errors, [key]: undefined } : errors));
  };

  // props ร่วมของทุกช่องในฟอร์ม: error ของช่องนั้นแทน helper ปกติ (ไม่ใช่ Alert ก้อนเดียวท้ายฟอร์ม)
  const fieldProps = (key: FormKey, helper?: ReactNode) => {
    const message = fieldErrors[key] ?? liveError(form, key);
    return {
      id: `student-loan-${key}`,
      value: form[key],
      onChange: onField(key),
      error: message != null,
      helperText: message ?? helper,
      autoFocus: focusField === key,
      fullWidth: true,
    };
  };

  const submit = async () => {
    if (submitting) return;
    const errors: FieldErrors = {};
    for (const key of FIELD_ORDER) {
      const message = form[key].trim() === '' ? REQUIRED_MESSAGE[key] : liveError(form, key);
      if (message) errors[key] = message;
    }
    const firstInvalid = FIELD_ORDER.find((key) => errors[key]);
    if (firstInvalid) {
      setFieldErrors(errors);
      document.getElementById(`student-loan-${firstInvalid}`)?.focus();
      return;
    }
    const amount = (key: FormKey) => parseBahtToSatang(form[key])!;
    setFormError('');
    setSubmitting(true);
    try {
      await put('/api/student-loan', {
        principal_original_satang: amount('principal_original_baht'),
        first_due_date: form.first_due_date,
        as_of_date: form.as_of_date,
        principal_remaining_satang: amount('principal_remaining_baht'),
        interest_accrued_satang: amount('interest_accrued_baht'),
        monthly_payment_satang: amount('monthly_payment_baht'),
        monthly_saving_satang: amount('monthly_saving_baht'),
        savings_balance_satang: amount('savings_balance_baht'),
        app_annual_due_satang: form.app_annual_due_baht.trim() === '' ? null : amount('app_annual_due_baht'),
        payoff_discount_bp: discountBp(form.payoff_discount_percent)!,
        payment_day: Number(form.payment_day),
      });
      pendingNoticeRef.current = { message: 'บันทึกข้อมูลหนี้ กยศ. แล้ว', severity: 'success' };
      refocusEditRef.current = true;
      setModalOpen(false);
      clearTrialAndReload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const loan = data?.loan ?? null;
  const projections = data?.projections ?? null;
  const projection = projections?.[scenario] ?? null;
  const current = projection?.installments.find((r) => r.is_current) ?? null;

  // ใช้ค่าที่พิมพ์อยู่ (สิ่งที่เห็น) ไม่ใช่ค่าที่ยิงไปแล้ว — กดภายในครึ่งวินาทีหลังพิมพ์ก็บันทึกเลขที่เห็น
  const saveTrial = async () => {
    if (savingTrial || loan == null) return;
    const payment = whatIfPayment.trim() === '' ? loan.monthly_payment_satang : parseBahtToSatang(whatIfPayment);
    const saving = whatIfSaving.trim() === '' ? loan.monthly_saving_satang : parseBahtToSatang(whatIfSaving);
    if (payment == null || saving == null) {
      setTrialError(`ยังบันทึกไม่ได้ — ช่องที่ขึ้นสีแดงต้อง${AMOUNT_FORMAT_HINT}`);
      document.getElementById(payment == null ? WHAT_IF_PAYMENT_ID : WHAT_IF_SAVING_ID)?.focus();
      return;
    }
    setTrialError('');
    setSavingTrial(true);
    try {
      // ส่งข้อมูลที่บันทึกไว้ทั้งชุด เปลี่ยนแค่สองช่อง — server อ่านเฉพาะช่องของตัวเอง (id/created_at ถูกข้าม)
      await put('/api/student-loan', { ...loan, monthly_payment_satang: payment, monthly_saving_satang: saving });
      clearTrialAndReload();
      setNotice({
        message: `บันทึกเป็นค่าจริงแล้ว — จ่าย กยศ. เดือนละ ฿${formatBaht(payment)} · เก็บออมเดือนละ ฿${formatBaht(saving)}`,
        severity: 'success',
        // เลิกทำ = ส่งค่าเดิมสองช่องกลับไป (loan ตอนนี้คือข้อมูลก่อนบันทึก)
        action: { label: 'เลิกทำ', onClick: () => void undoTrialSave(loan) },
      });
      // ปุ่มหายไปพร้อมค่าทดลอง — ส่ง focus ไปช่องแรกของส่วนนี้แทนการตกไปที่ <body>
      document.getElementById(WHAT_IF_PAYMENT_ID)?.focus();
    } catch (e) {
      setTrialError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingTrial(false);
    }
  };

  const undoTrialSave = async (previous: NonNullable<StudentLoanResponse['loan']>) => {
    setNotice(null);
    // ปุ่มเลิกทำหายไปกับ snackbar — focus กลับไปที่ส่วนลองปรับตัวเลข
    document.getElementById(WHAT_IF_PAYMENT_ID)?.focus();
    try {
      await put('/api/student-loan', previous);
      clearTrialAndReload();
      setNotice({
        message: `คืนค่าเดิมแล้ว — จ่าย กยศ. เดือนละ ฿${formatBaht(previous.monthly_payment_satang)} · เก็บออมเดือนละ ฿${formatBaht(previous.monthly_saving_satang)}`,
        severity: 'success',
      });
    } catch (e) {
      setTrialError(e instanceof Error ? `เลิกทำไม่สำเร็จ — ${e.message}` : 'เลิกทำไม่สำเร็จ');
    }
  };

  const trialTyped = whatIfPayment.trim() !== '' || whatIfSaving.trim() !== '';
  // ป้ายตามตัวเลขที่อยู่บนจอจริง (ผลที่โหลดมาแล้ว) ไม่ใช่ค่าที่ยังพิมพ์ค้างหรือกำลังโหลด
  const trialShown = data != null && data !== baseline;
  // หมุนเฉพาะตอนที่จะคำนวณใหม่จริง — ค่าที่อ่านไม่ได้ไม่ถูกส่ง พิมพ์ผิดรูปแบบ query จึงไม่เปลี่ยน
  const recalculating = (loading && data != null) || trialQuery(whatIfSaving, whatIfPayment) !== queryString;
  const trialChip = <Chip size="small" variant="outlined" icon={<ScienceRounded />} label="ตัวเลขทดลอง" />;
  // แผนเดียวกันจากค่าที่บันทึกไว้ — มีเฉพาะตอนบนจอเป็นค่าทดลอง
  const base = trialShown ? (baseline?.projections?.[scenario] ?? null) : null;
  // ค่าทดลองไม่เปลี่ยนผลของแผนนี้เลย (จ่ายขั้นต่ำไม่ใช้ทั้งสองช่อง หรือใส่เท่าค่าที่บันทึกไว้)
  const trialNoEffect = base != null && projection != null && JSON.stringify(base) === JSON.stringify(projection);
  /** caption ของการ์ด + "เดิม X → Y" เมื่อค่าทดลองเปลี่ยนตัวเลขนั้น */
  const withBefore = (caption: ReactNode, pick: (p: StudentLoanProjection) => ReactNode, key: (p: StudentLoanProjection) => unknown) =>
    base != null && projection != null && key(base) !== key(projection) ? (
      <>
        {caption}
        <Box component="span" sx={{ display: 'block' }}>{beforeAfter(pick(base), pick(projection))}</Box>
      </>
    ) : (
      caption
    );

  // เทียบยอดครบกำหนดปีนี้ที่แอปแจ้ง กับที่ระบบคำนวณได้ — จับกรณีกรอกเลขผิดตั้งแต่ต้น
  // ต่างกันเล็กน้อยเป็นเรื่องปกติ เพราะเงินต้นคงเหลือ ณ 5 ก.ค. กับ ณ วันที่กรอกไม่เท่ากัน
  const calibration =
    loan?.app_annual_due_satang != null && current != null
      ? {
          entered: loan.app_annual_due_satang,
          modelled: current.total_satang,
          ok: Math.abs(loan.app_annual_due_satang - current.total_satang) <= CALIBRATION_TOLERANCE_SATANG,
        }
      : null;

  // แก้ยอดคงเหลือแต่วันที่ยังเป็นวันเดิม — ดอกเบี้ยเดินรายวัน วันเก่าทำให้ทั้งแผนคลาด ไม่เปลี่ยนวันให้เอง (ฟอร์มจะ dirty ตั้งแต่เปิด)
  // เทียบเป็นสตางค์ ค่าตั้งต้น "1,234.00" กับที่พิมพ์ "1234" คือยอดเดียวกัน · เพิ่มข้อมูลครั้งแรก (loan == null) ไม่มีค่าเดิมให้เทียบ
  const balanceChanged = (key: FormKey) => parseBahtToSatang(form[key]) !== parseBahtToSatang(formInitial[key]);
  const staleAsOf =
    loan != null &&
    form.as_of_date === formInitial.as_of_date &&
    (balanceChanged('principal_remaining_baht') || balanceChanged('interest_accrued_baht'));

  // เทียบเฉพาะแผนที่ปิดได้ — ยอดรวมของแผนที่ยังปิดไม่ได้ไม่ใช่ยอดจนปิดหนี้ · "จ่ายรวม" นับส่วนลดปิดบัญชีแล้ว
  // (ดอกเบี้ยน้อยสุดไม่ใช่แผนที่ถูกสุดเสมอ ปิดทีเดียวได้ส่วนลดเงินต้นจนจ่ายรวมน้อยกว่าได้)
  const payable = projections ? SCENARIOS.filter((s) => projections[s].payoff_date != null) : [];
  const cheapest = projections ? winners(payable.map((s) => [s, projections[s].total_payment_satang])) : [];
  const fastest = projections ? winners(payable.map((s) => [s, projections[s].months_remaining])) : [];

  return (
    <>
      <PageHeader
        level={1}
        id="student-loan-heading"
        title="แผนปลดหนี้ กยศ."
        description="ดูว่าจะปิดหนี้ กยศ. ได้เมื่อไหร่ และแบบไหนจ่ายรวมน้อยสุด"
        // ยังไม่มีข้อมูล = ปุ่มเดียวอยู่ใน EmptyState
        action={loan != null ? <Button id={EDIT_BUTTON_ID} variant="contained" onClick={() => openEdit()}>แก้ไขข้อมูล</Button> : undefined}
      />
      {/* ข้อมูลถึงวันไหน = ประกาศสถานะที่คงอยู่ (The Quiet Notice Rule) — บรรทัดเงียบใต้หัวหน้า ไม่ใช่แถบที่กินที่ทุกครั้งที่เปิด */}
      {loan != null && (
        <Typography variant="body2" color="text.secondary" role="status" sx={{ mt: 1, maxWidth: '70ch' }}>
          ข้อมูล ณ วันที่ {num(formatDate(loan.as_of_date))} — ดอกเบี้ยเดินทุกวัน ควรกลับมาอัปเดตยอดคงเหลือเป็นระยะ
        </Typography>
      )}

      {error && <LoadError message={error} onRetry={() => void reload()} />}

      {loading && data == null ? (
        <TableSkeleton rows={6} />
      ) : loan == null || projections == null || projection == null ? (
        data != null && (
          <EmptyState
            headingLevel={2}
            icon={<SchoolRounded fontSize="large" />}
            title="ยังไม่มีข้อมูลหนี้ กยศ."
            description="กรอกยอดกู้ตามสัญญา วันครบกำหนดชำระครั้งแรก และยอดคงเหลือล่าสุดจากแอป กยศ. Connect แล้วระบบจะคำนวณให้ว่าจะปิดหนี้ได้เดือนไหน"
            action={<Button variant="contained" onClick={() => openEdit()}>เพิ่มข้อมูลหนี้</Button>}
          />
        )
      ) : (
        <Stack spacing={4} sx={{ mt: 3 }}>
          {/* ยอดไม่ตรงกับแอป = เตือน (warning ผ่าน AA ทั้งสองโหมด) พร้อมไอคอน + ข้อความ และทางแก้ในแถบเดียวกัน
              ข้อความรองใช้สีของแถบเอง ไม่ใช่ text.secondary ที่เป็นเทาบนพื้นสี */}
          {calibration && current && (
            <Alert
              severity={calibration.ok ? 'success' : 'warning'}
              role="status"
              icon={calibration.ok ? <CheckCircleRounded /> : <WarningAmberRounded />}
            >
              <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                <Typography variant="body2">
                  ยอดครบกำหนดงวดที่ {num(current.installment_no)} — แอปแจ้ง <Money satang={calibration.entered} /> ·
                  ระบบคำนวณได้ <Money satang={calibration.modelled} />
                </Typography>
                <Typography variant="body2">
                  {calibration.ok
                    ? 'ใกล้เคียงกัน แปลว่าเลขที่กรอกถูกต้อง'
                    : 'ต่างกันมาก — น่าจะกรอกวันครบกำหนดครั้งแรกหรือยอดกู้ตามสัญญาผิด ไม่ใช่การคำนวณผิด'}
                </Typography>
                {/* ชื่อปุ่มบอกช่องที่ฟอร์มจะเปิดไป — ไม่ซ้ำกับ "แก้ไขข้อมูล" ข้างชื่อหน้า */}
                {!calibration.ok && (
                  <Button variant="outlined" color="inherit" onClick={() => openEdit('first_due_date')} sx={{ mt: 0.5 }}>
                    แก้วันครบกำหนดครั้งแรก
                  </Button>
                )}
              </Stack>
            </Alert>
          )}

          {/* เลือกแผน = แถวของตารางเทียบ และช่องลองปรับตัวเลขอยู่เหนือตารางนี้ ผลจึงเปลี่ยนในจอที่เห็นอยู่ */}
          <Box component="section" aria-labelledby="student-loan-compare-heading">
            <Typography variant="h2" id="student-loan-compare-heading">เทียบสามทางเลือก</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2.5, maxWidth: '70ch', ...descriptionSx }}>
              ตัวเลขชุดเดียวกัน ต่างกันแค่ว่าเอาเงินที่เก็บได้ไปทำอะไร เลือกแถวเพื่อดูรายละเอียดของแผนนั้นด้านล่าง
            </Typography>

            <Box role="group" aria-labelledby="student-loan-what-if-heading" data-tour="student-loan-what-if" sx={{ mb: 2.5 }}>
              <Stack direction="row" useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, minHeight: 28, mb: 0.5 }}>
                <Typography component="h3" variant="h2" id="student-loan-what-if-heading" sx={{ fontSize: '1rem', lineHeight: 1.5 }}>
                  ลองปรับตัวเลขดู
                </Typography>
                {trialShown && trialChip}
                {recalculating && <CircularProgress size={16} aria-label="กำลังคำนวณใหม่" />}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                ไม่ทับค่าที่บันทึกไว้จนกว่าจะกด “บันทึกค่านี้”
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  id={WHAT_IF_PAYMENT_ID}
                  label="จ่าย กยศ. ต่อเดือน (บาท)"
                  value={whatIfPayment}
                  onChange={(e) => {
                    setWhatIfPayment(e.target.value);
                    setTrialError('');
                  }}
                  fullWidth
                  helperText={<>ที่บันทึกไว้ <Money satang={loan.monthly_payment_satang} /></>}
                  {...amountFieldHelp(whatIfPayment.trim())}
                  slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                />
                <TextField
                  id={WHAT_IF_SAVING_ID}
                  label="เก็บออมต่อเดือน (บาท)"
                  value={whatIfSaving}
                  onChange={(e) => {
                    setWhatIfSaving(e.target.value);
                    setTrialError('');
                  }}
                  fullWidth
                  helperText={<>ที่บันทึกไว้ <Money satang={loan.monthly_saving_satang} /></>}
                  {...amountFieldHelp(whatIfSaving.trim())}
                  slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                />
              </Stack>
              {/* ผลของแผนที่เลือกอยู่ติดช่องที่พิมพ์ — มือถือไม่ต้องเลื่อนลงไปดูตาราง และ screen reader ได้ยินทุกครั้งที่คำนวณใหม่
                  กล่อง status อยู่ใน DOM ตลอด เปลี่ยนแค่ข้อความ ไม่งั้นบางตัวอ่านไม่ประกาศ */}
              <Typography variant="body2" role="status" sx={{ mt: trialShown ? 1.5 : 0 }}>
                {trialShown && (
                  <>
                    แผนที่เลือก: {projection.payoff_date ? <>ปิด {payoffNode(projection)}</> : 'ยังปิดไม่ได้'} · จ่ายรวม{' '}
                    <Money satang={projection.total_payment_satang} />
                    {trialNoEffect && ' · ค่าทดลองไม่มีผลกับแผนนี้'}
                  </>
                )}
              </Typography>
              {trialTyped && (
                <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                  <Button
                    color="inherit"
                    onClick={() => {
                      clearTrial();
                      document.getElementById(WHAT_IF_PAYMENT_ID)?.focus();
                    }}
                  >
                    ล้างค่าทดลอง
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={savingTrial ? undefined : () => void saveTrial()}
                    aria-disabled={savingTrial}
                    aria-busy={savingTrial}
                  >
                    {savingTrial ? 'กำลังบันทึก…' : 'บันทึกค่านี้'}
                  </Button>
                </Stack>
              )}
              {trialError && <Alert severity="error" sx={{ mt: 1.5 }}>{trialError}</Alert>}
            </Box>

            {/* ไม่ใส่ tabIndex: ทั้งสามตารางของหน้านี้พับคอลัมน์รองจนไม่ล้นกล่องทุกขนาดจอ (< md เหลือสองถึงสามคอลัมน์
                ≥ md กล่องกว้าง ≥ 852px) — กล่องที่ไม่มีอะไรให้เลื่อนไม่ควรเป็นจุดแวะของปุ่ม Tab */}
            <TableContainer component={Paper} variant="outlined" role="region" aria-label="ตารางเทียบสามทางเลือก">
              {/* แถวที่เลือกไม่ใส่ `selected` (พื้น sidebar-accent ทำยอดสีเหลือ 1.11–1.67 ในธีมมืด) — radio บอกสถานะแทน
                  radio name เดียวกัน = ลูกศรขึ้น/ลงเลือกแผนได้ คลิกทั้งแถวก็เลือกได้ (พื้นที่กดของนิ้ว) */}
              <Table size="small" aria-label="เทียบสามทางเลือกในการปลดหนี้" sx={{ minWidth: { md: 680 }, ...COMPACT_CELLS }}>
                <TableHead>
                  <TableRow>
                    <TableCell>ทางเลือก</TableCell>
                    <TableCell align="right" sx={MD_UP}>ปิดหนี้เมื่อ</TableCell>
                    <TableCell align="right" sx={MD_UP}>จ่ายรวมอีก</TableCell>
                    <TableCell align="right" sx={MD_UP}>ดอกเบี้ยรวม</TableCell>
                    <TableCell align="right" sx={MD_UP}>ส่วนลด</TableCell>
                    <TableCell align="right" sx={BELOW_MD}>ปิดหนี้เมื่อ<br />จ่ายรวมอีก</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {SCENARIOS.map((s) => {
                    const p = projections[s];
                    const checked = s === scenario;
                    const delta = s === 'minimum_only' ? null : vsMinimum(p, projections.minimum_only);
                    // แถวที่เลือกระหว่างลองตัวเลข: ยอดรวมเดิม → ใหม่ (การ์ดด้านล่างบอกครบทุกตัว)
                    const before = checked && base != null && base.total_payment_satang !== p.total_payment_satang ? base : null;
                    const badges = [
                      cheapest.includes(s) && <Chip key="cheapest" size="small" variant="outlined" color="success" icon={<PaymentsRounded />} label="จ่ายรวมน้อยสุด" />,
                      fastest.includes(s) && <Chip key="fastest" size="small" variant="outlined" color="success" icon={<EventAvailableRounded />} label="ปิดเร็วสุด" />,
                    ].filter(Boolean);
                    return (
                      <TableRow key={s} hover onClick={() => setScenario(s)} sx={{ cursor: 'pointer' }}>
                        <TableCell sx={NAME_CELL}>
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                            <Radio
                              id={`student-loan-plan-${s}`}
                              name="student-loan-plan"
                              value={s}
                              checked={checked}
                              onChange={() => setScenario(s)}
                              // ชื่อกลุ่มของ radio (ห่อ radiogroup ข้ามแถวตารางไม่ได้) — "เทียบสามทางเลือก"
                              slotProps={{ input: { 'aria-describedby': 'student-loan-compare-heading' } }}
                              sx={{ p: 0.75, my: -0.75, ml: -0.75, flexShrink: 0 }}
                            />
                            <Box sx={{ minWidth: 0 }}>
                              <Box component="label" htmlFor={`student-loan-plan-${s}`} sx={{ cursor: 'pointer', fontWeight: checked ? 600 : 400 }}>
                                {SCENARIO_LABEL[s]}
                              </Box>
                              {badges.length > 0 && (
                                <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>{badges}</Stack>
                              )}
                              {delta && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{delta}</Typography>}
                              {before && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                  จ่ายรวม {beforeAfter(<Money satang={before.total_payment_satang} />, <Money satang={p.total_payment_satang} />)}
                                </Typography>
                              )}
                              <Typography variant="body2" color="text.secondary" sx={SECONDARY_LINE}>
                                ดอกเบี้ย <Money satang={p.total_interest_satang} tone="expense" /> · ส่วนลด{' '}
                                <Money satang={p.discount_satang} tone="income" />
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell align="right" sx={{ ...MD_UP, ...NUM_CELL }}>{payoffText(p)}</TableCell>
                        <TableCell align="right" sx={{ ...MD_UP, ...NUM_CELL }}><Money satang={p.total_payment_satang} /></TableCell>
                        <TableCell align="right" sx={{ ...MD_UP, ...NUM_CELL }}><Money satang={p.total_interest_satang} tone="expense" /></TableCell>
                        <TableCell align="right" sx={{ ...MD_UP, ...NUM_CELL }}><Money satang={p.discount_satang} tone="income" /></TableCell>
                        <TableCell align="right" sx={{ ...BELOW_MD, ...NUM_CELL }}>
                          {payoffText(p)}
                          <br />
                          <Money satang={p.total_payment_satang} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          <Box component="section" aria-labelledby="student-loan-plan-heading">
            <Stack direction="row" useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h2" id="student-loan-plan-heading">ถ้า{SCENARIO_LABEL[scenario]}</Typography>
              {/* แผนที่ค่าทดลองไม่เปลี่ยนอะไรเลย (เช่นจ่ายขั้นต่ำ) ไม่ติดป้าย "ตัวเลขทดลอง" ให้เข้าใจผิดว่าเลขชุดนี้ขยับแล้ว */}
              {trialShown &&
                (trialNoEffect ? <Chip size="small" variant="outlined" label="ค่าทดลองไม่มีผลกับแผนนี้" /> : trialChip)}
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2, maxWidth: '70ch', ...descriptionSx }}>
              {SCENARIO_HINT[scenario]}
            </Typography>
            <Box sx={summaryRowSx(4)}>
              <SummaryCard
                title="ปิดหนี้ได้เมื่อ"
                icon={<EventAvailableRounded fontSize="small" />}
                value={payoffText(projection)}
                caption={withBefore(
                  projection.payoff_date ? (
                    <>อีก {num(projection.months_remaining)} เดือน · งวดที่ {num(projection.payoff_installment_no ?? '')}</>
                  ) : (
                    'ยอดจ่ายไม่พอไล่ดอกเบี้ยทัน'
                  ),
                  payoffNode,
                  (p) => p.payoff_date,
                )}
              />
              <SummaryCard
                title="ยอดรวมที่ต้องจ่ายอีก"
                icon={<PaymentsRounded fontSize="small" />}
                value={<Money satang={projection.total_payment_satang} />}
                caption={withBefore(
                  projection.final_payoff_satang > 0 ? (
                    <>ก้อนปิดบัญชี <Money satang={projection.final_payoff_satang} /></>
                  ) : (
                    'จ่ายจนหมดตามตาราง ไม่มีก้อนปิดบัญชี'
                  ),
                  (p) => <Money satang={p.total_payment_satang} />,
                  (p) => p.total_payment_satang,
                )}
              />
              <SummaryCard
                title="ดอกเบี้ยที่ต้องจ่ายอีก"
                icon={<PercentRounded fontSize="small" />}
                value={<Money satang={projection.total_interest_satang} tone="expense" />}
                caption={withBefore(
                  'ค้างอยู่ตอนนี้ + ที่จะเดินต่อจนปิด',
                  (p) => <Money satang={p.total_interest_satang} />,
                  (p) => p.total_interest_satang,
                )}
              />
              <SummaryCard
                title="ส่วนลดที่ได้"
                icon={<SavingsRounded fontSize="small" />}
                value={<Money satang={projection.discount_satang} tone="income" />}
                caption={withBefore(
                  projection.discount_satang > 0 ? (
                    <>ลดเงินต้น {num(`${loan.payoff_discount_bp / 100}%`)} จากการปิดก่อนกำหนด</>
                  ) : (
                    'ไม่ได้ปิดก่อนกำหนด จึงไม่มีส่วนลด'
                  ),
                  (p) => <Money satang={p.discount_satang} />,
                  (p) => p.discount_satang,
                )}
              />
            </Box>
          </Box>

          <Box component="section" aria-labelledby="student-loan-yearly-heading">
            <Typography variant="h2" id="student-loan-yearly-heading">ตารางงวดรายปี</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2, maxWidth: '70ch', ...descriptionSx }}>
              เงินต้นแต่ละงวดคิดเป็น % ของยอดกู้ตามสัญญา และเพิ่มขึ้นทุกปี — ขั้นต่ำต่อเดือนจึงไม่ใช่ตัวเลขคงที่
            </Typography>
            <TableContainer component={Paper} variant="outlined" role="region" aria-label="ตารางงวดรายปี">
              <Table size="small" aria-label="งวดรายปีตามตาราง Step Up" sx={COMPACT_CELLS}>
                <TableHead>
                  <TableRow>
                    <TableCell>งวดที่</TableCell>
                    <TableCell sx={MD_UP}>ครบกำหนด</TableCell>
                    <TableCell align="right" sx={MD_UP}>เงินต้น</TableCell>
                    <TableCell align="right" sx={MD_UP}>ดอกเบี้ย</TableCell>
                    <TableCell align="right">รวมทั้งงวด</TableCell>
                    <TableCell align="right" sx={MD_UP}>ขั้นต่ำ/เดือน</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {projection.installments.map((row) => (
                    <TableRow key={row.installment_no}>
                      <TableCell sx={NAME_CELL}>
                        <Stack direction="row" useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                          {row.installment_no}
                          {/* ไม่ใช้ `selected` ของแถว — chip primary แบบ filled บอกงวดปัจจุบันแทน (Tables ใน DESIGN.md) */}
                          {row.is_current && <Chip size="small" color="primary" label="งวดปัจจุบัน" />}
                        </Stack>
                        <Box sx={SECONDARY_LINE}>
                          <Typography variant="body2" color="text.secondary">ครบ {formatDate(row.due_date)}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            เงินต้น <Money satang={row.principal_satang} /> · ดอกเบี้ย <Money satang={row.interest_satang} tone="expense" />
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            ขั้นต่ำ <Money satang={row.min_monthly_satang} /> ต่อเดือน
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...MD_UP, ...NUM_CELL }}>{formatDate(row.due_date)}</TableCell>
                      <TableCell align="right" sx={{ ...MD_UP, ...NUM_CELL }}><Money satang={row.principal_satang} /></TableCell>
                      <TableCell align="right" sx={{ ...MD_UP, ...NUM_CELL }}><Money satang={row.interest_satang} tone="expense" /></TableCell>
                      <TableCell align="right" sx={NUM_CELL}><Money satang={row.total_satang} /></TableCell>
                      <TableCell align="right" sx={{ ...MD_UP, ...NUM_CELL }}><Money satang={row.min_monthly_satang} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* unmountOnExit: ตารางยาวหลายร้อยแถวไม่ค้างใน DOM ตอนพับ — ค่าทดลองเปลี่ยนก็ไม่ต้องอัปเดตแถวที่มองไม่เห็น */}
          <Disclosure
            id="student-loan-monthly-heading"
            title={`ตารางรายเดือน (${projection.monthly.length} เดือน)`}
            open={monthlyOpen}
            onToggle={() => setMonthlyOpen(!monthlyOpen)}
            unmountOnExit
          >
            <TableContainer component={Paper} variant="outlined" role="region" aria-label="ตารางรายเดือน">
              <Table size="small" aria-label="รายเดือนจนถึงวันปิดหนี้" sx={COMPACT_CELLS}>
                <TableHead>
                  <TableRow>
                    <TableCell>วันที่</TableCell>
                    <TableCell align="right">จ่าย</TableCell>
                    <TableCell align="right" sx={MD_UP}>ดอกเบี้ยเดือนนี้</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: { xs: 'normal', md: 'nowrap' } }}>เงินต้นคงเหลือ</TableCell>
                    <TableCell align="right" sx={MD_UP}>เงินออมสะสม</TableCell>
                    <TableCell align="right" sx={MD_UP}>ยอดปิดบัญชี</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {projection.monthly.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell sx={NAME_CELL}>
                        {formatDate(row.date)}
                        <Box sx={SECONDARY_LINE}>
                          <Typography variant="body2" color="text.secondary">
                            ดอกเบี้ยเดือนนี้ <Money satang={row.interest_accrued_satang} tone="expense" />
                          </Typography>
                          <Typography variant="body2" color="text.secondary">เงินออมสะสม <Money satang={row.savings_satang} /></Typography>
                          <Typography variant="body2" color="text.secondary">ยอดปิดบัญชี <Money satang={row.payoff_quote_satang} /></Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={NUM_CELL}><Money satang={row.paid_satang} /></TableCell>
                      <TableCell align="right" sx={{ ...MD_UP, ...NUM_CELL }}><Money satang={row.interest_accrued_satang} tone="expense" /></TableCell>
                      <TableCell align="right" sx={NUM_CELL}><Money satang={row.closing_principal_satang} /></TableCell>
                      <TableCell align="right" sx={{ ...MD_UP, ...NUM_CELL }}><Money satang={row.savings_satang} /></TableCell>
                      <TableCell align="right" sx={{ ...MD_UP, ...NUM_CELL }}><Money satang={row.payoff_quote_satang} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Disclosure>
        </Stack>
      )}

      {/* วิธีคำนวณใช้ไม่บ่อย จึงพับไว้ท้ายหน้า (The Disclosure Section Rule) — ขึ้นทั้งตอนมีข้อมูลและตอนยังว่าง */}
      {data != null && (
        <Box sx={{ mt: 4 }}>
          <Disclosure id="student-loan-method-heading" title="วิธีคำนวณ" open={methodOpen} onToggle={() => setMethodOpen(!methodOpen)}>
            <Box component="ul" sx={{ m: 0, pl: 2.5, maxWidth: '70ch', color: 'text.secondary', ...descriptionSx, '& > li + li': { mt: 0.75 } }}>
              <li>เงินต้นที่ต้องจ่ายแต่ละปีตามตาราง Step Up 15 งวดของ กยศ. คิดเป็น % ของยอดกู้ตามสัญญา</li>
              <li>ดอกเบี้ย 1% ต่อปี เดินรายวันบนเงินต้นคงเหลือ</li>
              <li>เงินที่จ่ายตัดตามลำดับของ พ.ร.บ. 2566: เงินต้นงวดที่ครบกำหนด → ดอกเบี้ย → เบี้ยปรับ</li>
              <li>ยอดจ่ายต่อเดือนที่ต่ำกว่าขั้นต่ำของงวดไหน ระบบใช้ขั้นต่ำของงวดนั้นแทน — ขั้นต่ำขึ้นทุกปีตามตาราง Step Up</li>
              <li>“จ่ายรวม” นับส่วนลดเงินต้นจากการปิดบัญชีก่อนกำหนดแล้ว แผนที่ดอกเบี้ยน้อยสุดจึงไม่จำเป็นต้องจ่ายรวมน้อยสุด</li>
            </Box>
          </Disclosure>
        </Box>
      )}

      <Modal
        open={modalOpen}
        title="ข้อมูลหนี้ กยศ."
        onClose={() => setModalOpen(false)}
        busy={submitting}
        dirty={JSON.stringify(form) !== JSON.stringify(formInitial)}
        footer={{ formId: 'student-loan-form', submitLabel: 'บันทึก' }}
        onExited={flushNotice}
      >
        {/* noValidate: ข้อความผิดของทุกช่องมาจาก fieldProps (ภาษาเดียวกันทุกเบราว์เซอร์) ไม่ใช่ bubble ของเบราว์เซอร์ */}
        <Box
          component="form"
          id="student-loan-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              ตัวเลขทั้งหมดดูได้จากแอป กยศ. Connect — ยอดกู้ตามสัญญาคือยอดตั้งต้นทั้งหมด ไม่ใช่ยอดคงเหลือ
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="ยอดกู้ตามสัญญา (บาท)"
                required
                {...fieldProps('principal_original_baht', 'ฐานของตาราง Step Up ทุกงวด')}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              <TextField
                label="วันครบกำหนดชำระครั้งแรก"
                type="date"
                required
                {...fieldProps('first_due_date', '5 ก.ค. แรกหลังพ้นช่วงปลอดหนี้ 2 ปี')}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>

            {/* แถวสามช่องเรียงกันเฉพาะ ≥ md — ที่ 600–760px ช่องกว้าง 152–205px ป้าย outlined ไม่ตัดบรรทัด
                "เงินเก็บที่มีอยู่แล้ว (บาท)" (~200px) จึงถูกตัด · ≥ md (dialog 836px) ช่องละ ~252px */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="ข้อมูล ณ วันที่"
                type="date"
                required
                {...fieldProps(
                  'as_of_date',
                  staleAsOf ? (
                    <Box component="span" sx={{ color: 'warning.main' }}>
                      อัปเดตยอดแล้ว — อย่าลืมเปลี่ยน “ข้อมูล ณ วันที่” ให้ตรงกับวันที่ดูยอดในแอป
                    </Box>
                  ) : (
                    'วันที่เปิดแอปดูยอดคงเหลือชุดนี้'
                  ),
                )}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="เงินต้นคงเหลือ (บาท)"
                required
                {...fieldProps('principal_remaining_baht')}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              <TextField
                label="ดอกเบี้ยค้าง (บาท)"
                required
                {...fieldProps(
                  'interest_accrued_baht',
                  (() => {
                    const p = parseBahtToSatang(form.principal_remaining_baht);
                    const i = parseBahtToSatang(form.interest_accrued_baht);
                    return p != null && i != null ? <>เงินต้นรวมดอกเบี้ย <Money satang={p + i} /></> : 'ยอดดอกเบี้ยรวม ณ ปัจจุบัน';
                  })(),
                )}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
            </Stack>

            <TextField
              label="ยอดครบกำหนดปีนี้ตามแอป (บาท)"
              {...fieldProps('app_annual_due_baht', 'ไม่บังคับ — ใส่ไว้เพื่อให้ระบบเทียบว่าเลขที่กรอกด้านบนถูกต้องไหม ไม่ได้เข้าสูตรคำนวณ')}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="จ่าย กยศ. ต่อเดือน (บาท)"
                required
                {...fieldProps('monthly_payment_baht', 'ต่ำกว่าขั้นต่ำของงวดไหน ระบบใช้ขั้นต่ำแทน')}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              <TextField
                label="เก็บออมต่อเดือน (บาท)"
                required
                {...fieldProps('monthly_saving_baht', 'เงินที่กันไว้จ่ายก้อนเดียวตอนปิดบัญชี')}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              <TextField
                label="เงินเก็บที่มีอยู่แล้ว (บาท)"
                required
                {...fieldProps('savings_balance_baht')}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="ส่วนลดเมื่อปิดบัญชี (%)"
                required
                {...fieldProps('payoff_discount_percent', 'ปัจจุบัน กยศ. ลดเงินต้น 3% เมื่อปิดทีเดียว — ปรับได้ถ้ามาตรการเปลี่ยน')}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              {/* ช่องเลือกแบบ native: มือถือได้วงล้อเลือกวัน และกรอกค่านอก 1–28 ไม่ได้ตั้งแต่ต้น */}
              <TextField
                select
                label="วันที่ชำระของทุกเดือน"
                {...fieldProps('payment_day', 'วันที่ 1–28 ของทุกเดือน')}
                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {i + 1}
                  </option>
                ))}
              </TextField>
            </Stack>

            {/* error จาก server (ช่องที่ตรวจในเครื่องได้ขึ้นใต้ช่องของมันแล้ว) */}
            {formError && <Alert severity="error">{formError}</Alert>}
          </Stack>
        </Box>
      </Modal>

      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
    </>
  );
}
