import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, type ButtonProps } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import BlockRounded from '@mui/icons-material/BlockRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import EventRepeatRounded from '@mui/icons-material/EventRepeatRounded';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import SkipNextRounded from '@mui/icons-material/SkipNextRounded';
import { patch, post, req, type Account, type Category, type InstallmentDetail, type InstallmentDue, type InstallmentPlan, type InstallmentTotals, type PaymentState } from '../api.js';
import Modal from '../Modal.js';
import Money from '../components/Money.js';
import PaymentStatusChip from '../components/PaymentStatusChip.js';
import SummaryCard, { summaryRowSx } from '../components/SummaryCard.js';
import { AMOUNT_FORMAT_HINT, formatBaht, formatDate, parseBahtToSatang, todayInBangkok } from '../format.js';
import { amountFieldHelp, BELOW_MD, ConfirmDialog, EmptyState, FeedbackSnackbar, LoadError, MD_UP, PageHeader, RowIconButton, TableSkeleton, type Notice } from '../ui.js';

const STATUS = { active: 'กำลังผ่อน', completed: 'ชำระครบแล้ว', cancelled: 'ยกเลิกแล้ว' };
// สถานะงวด (src/services/installments.ts) → ชิปกลาง ให้หน้าแผนผ่อนกับแผนรายเดือนเรียกชื่อเดียวกัน
const DUE_STATE: Record<InstallmentDue['status'], PaymentState> = { planned: 'unpaid', partially_paid: 'partial', paid: 'paid', overdue: 'overdue', skipped: 'skipped', cancelled: 'cancelled' };
// คำเดียวกับประวัติการบันทึกในหน้าวางแผน
const PAYMENT_STATUS = { declared: 'บันทึกไว้แล้ว', cancelled: 'ยกเลิกแล้ว' };
const MONEY_FIELDS = { total_amount_satang: 'ราคาซื้อ (บาท)', down_payment_satang: 'เงินดาวน์ (บาท)', interest_satang: 'ดอกเบี้ยรวม (บาท)', fee_satang: 'ค่าธรรมเนียมรวม (บาท)' };
type MoneyField = keyof typeof MONEY_FIELDS;
type Form = Record<MoneyField, string> & { name: string; installment_count: string; frequency_unit: 'day' | 'month' | 'year'; frequency_interval: string; first_due_date: string; down_payment_date: string; default_account_id: string; category_id: string };
type Confirmation = { title: string; description: string; confirmLabel: string; confirmColor?: ButtonProps['color']; success: string; action: () => Promise<unknown> };
// < md ตัดคอลัมน์รองออกทั้งหัวและแถว (MD_UP / BELOW_MD ของ ui.tsx) แล้วสรุปไว้เป็นบรรทัดรองในคอลัมน์แรก (ท่าเดียวกับ TransactionTable)
const CELL_SX = { '& .MuiTableCell-root': { px: { xs: 0.75, md: 2 } } } as const;
const emptyForm = (): Form => ({ name: '', total_amount_satang: '', down_payment_satang: '0', interest_satang: '0', fee_satang: '0', installment_count: '12', frequency_unit: 'month', frequency_interval: '1', first_due_date: todayInBangkok(), down_payment_date: '', default_account_id: '', category_id: '' });
function readAmount(value: string) {
  const n = parseBahtToSatang(value);
  if (n == null || !Number.isSafeInteger(n)) throw new Error(AMOUNT_FORMAT_HINT);
  return n;
}
// ตัวคั่นที่ตาเห็นเท่านั้น — screen reader ไม่ต้องอ่าน "จุด" ระหว่างค่า (เหมือนบรรทัดรองของหน้าวางแผน)
const SEP = <Box component="span" aria-hidden>{' · '}</Box>;
const dueName = (due: InstallmentDue) => (due.installment_no === 0 ? 'เงินดาวน์' : `งวด ${due.installment_no}`);

function Totals({ totals }: { totals: InstallmentTotals }) {
  return <Box sx={summaryRowSx(3)}>
    <SummaryCard title="ต้องชำระทั้งหมด" value={<Money satang={totals.total_payable_satang} />} />
    <SummaryCard title="จ่ายแล้ว" value={<Money satang={totals.paid_satang} />} />
    <SummaryCard title="คงเหลือ" value={<Money satang={totals.outstanding_satang} />} />
  </Box>;
}

function PlanStatusChip({ status }: { status: InstallmentPlan['status'] }) {
  const icon = status === 'completed' ? <CheckCircleRounded /> : status === 'cancelled' ? <BlockRounded /> : <EventRepeatRounded />;
  return <Chip size="small" variant="outlined" icon={icon} label={STATUS[status]} color={status === 'completed' ? 'success' : 'default'} />;
}

export default function Installments() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState<{ rows: InstallmentPlan[]; totals: InstallmentTotals } | null>(null);
  const [detail, setDetail] = useState<InstallmentDetail | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  // ค่าตอนเปิดฟอร์ม — ต่างจากนี้ = มีการแก้ค้าง Modal ถามก่อนปิด (The Unsaved Modal Rule)
  const [formInitial, setFormInitial] = useState<Form>(emptyForm);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState<InstallmentDue | null>(null);
  const [payment, setPayment] = useState({ amount: '', paid_date: todayInBangkok(), bank_account_id: '' });
  const [paymentInitial, setPaymentInitial] = useState(payment);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // ปุ่มของแถวที่เปิดฟอร์มจ่ายล่าสุด — "ยกเลิกการบันทึกจ่าย" ปิดฟอร์มก่อนเปิด dialog ยืนยัน MUI จึงคืน focus ให้ปุ่มในฟอร์ม
  // ที่หายไปแล้ว (focus ตกไป <body>) หลัง dialog ปิดสนิทส่งกลับมาที่ปุ่มของแถวแทน
  const payButtonRef = useRef<HTMLElement | null>(null);
  // ปุ่มย้อนกลับ = ที่รับ focus แทนเมื่อปุ่มต้นทางหายไปทั้งปุ่ม ("ยกเลิกแผน" หายเมื่อแผนไม่ได้กำลังผ่อนแล้ว) — h1 focus ไม่ได้
  const backRef = useRef<HTMLAnchorElement>(null);
  // โหลดซ้ำหลังทำสำเร็จอาจลบปุ่มที่ถือ focus อยู่ (หลัง dialog ปิดสนิทไปแล้วก็ได้) — ส่งต่อหลังข้อมูลใหม่ commit
  const rescueAfterLoadRef = useRef(false);
  // ผลสำเร็จที่เกิดตอน modal/dialog เปิดอยู่ — `#root` เป็น aria-hidden จนปิดสนิท จึงแสดงจาก onExited (เหมือนหน้าวางแผน)
  const pendingNoticeRef = useRef<Notice | null>(null);
  const flushNotice = () => {
    const pending = pendingNoticeRef.current;
    pendingNoticeRef.current = null;
    if (pending) setNotice(pending);
  };
  // id ที่โหลดอยู่ — refresh ของ id เดิมเป็น background: คงข้อมูลเดิม ไม่ขึ้น skeleton ตำแหน่งเลื่อนและ focus จึงไม่หาย
  // ยังไม่มีข้อมูล (detail/list เป็น null ใน render นี้ เช่นลองใหม่หลังโหลดครั้งแรกไม่สำเร็จ) = โหลดเต็มพร้อม skeleton
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    let current = true;
    const background = loadedIdRef.current === (id ?? '') && (detail != null || list != null);
    loadedIdRef.current = id ?? '';
    if (!background) {
      setLoading(true); setDetail(null); setList(null);
      setEditor(false); setPaying(null); setConfirmation(null);
    }
    setError('');
    const data = id ? req<InstallmentDetail>(`/api/installment-plans/${id}`) : req<{ rows: InstallmentPlan[]; totals: InstallmentTotals }>('/api/installment-plans');
    Promise.all([data, req<Account[]>('/api/accounts'), req<Category[]>('/api/categories')])
      .then(([result, banks, cats]) => { if (current) { if ('dues' in result) setDetail(result); else setList(result); setAccounts(banks); setCategories(cats); } })
      .catch((e: Error) => { if (current) setError(e.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id, revision]);

  const refresh = () => setRevision((n) => n + 1);
  // สำเร็จ = ปิดฟอร์ม/dialog ที่เปิดอยู่ แจ้งผลใน snackbar หลังปิดสนิท แล้วโหลดซ้ำแบบ background — ไม่สำเร็จ = ค้างไว้พร้อม error ในนั้น
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setFormError('');
    try { await action(); setPaying(null); setConfirmation(null); pendingNoticeRef.current = { message: success, severity: 'success' }; rescueAfterLoadRef.current = true; refresh(); }
    catch (e) { setFormError(e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ'); }
    finally { setBusy(false); }
  };
  const openConfirm = (c: Confirmation) => { setFormError(''); setConfirmation(c); };
  const rescueFocus = () => {
    if (document.activeElement != null && document.activeElement !== document.body) return;
    const row = payButtonRef.current;
    (row?.isConnected ? row : backRef.current)?.focus();
  };
  useEffect(() => {
    if (!rescueAfterLoadRef.current) return;
    rescueAfterLoadRef.current = false;
    rescueFocus();
  }, [detail]);
  const openEditor = () => {
    const next = detail ? {
      name: detail.name, total_amount_satang: formatBaht(detail.total_amount_satang), down_payment_satang: formatBaht(detail.down_payment_satang), interest_satang: formatBaht(detail.interest_satang), fee_satang: formatBaht(detail.fee_satang),
      installment_count: String(detail.installment_count), frequency_unit: detail.frequency_unit, frequency_interval: String(detail.frequency_interval), first_due_date: detail.first_due_date, down_payment_date: detail.down_payment_date ?? '',
      default_account_id: detail.default_account_id == null ? '' : String(detail.default_account_id), category_id: detail.category_id == null ? '' : String(detail.category_id),
    } : emptyForm();
    setFormError(''); setEditor(true); setForm(next); setFormInitial(next);
  };
  const openPayment = (due: InstallmentDue, button: HTMLElement) => {
    payButtonRef.current = button;
    const next = { amount: formatBaht(due.outstanding_satang), paid_date: todayInBangkok(), bank_account_id: detail?.default_account_id == null ? '' : String(detail.default_account_id) };
    setFormError(''); setPaying(due); setPayment(next); setPaymentInitial(next);
  };
  const structureLocked = detail != null && !detail.structural_editable;
  const save = async () => {
    setBusy(true); setFormError('');
    try {
      const metadata = { name: form.name, default_account_id: form.default_account_id ? Number(form.default_account_id) : null, category_id: form.category_id ? Number(form.category_id) : null };
      const body = structureLocked ? metadata : { ...metadata, total_amount_satang: readAmount(form.total_amount_satang), down_payment_satang: readAmount(form.down_payment_satang), interest_satang: readAmount(form.interest_satang), fee_satang: readAmount(form.fee_satang), installment_count: Number(form.installment_count), frequency_unit: form.frequency_unit, frequency_interval: Number(form.frequency_interval), first_due_date: form.first_due_date, down_payment_date: form.down_payment_date || null };
      if (detail) { await patch(`/api/installment-plans/${detail.id}`, body); setEditor(false); pendingNoticeRef.current = { message: 'บันทึกแผนผ่อนแล้ว', severity: 'success' }; refresh(); }
      else { const created = await post<{ id: number }>('/api/installment-plans', body); setEditor(false); pendingNoticeRef.current = { message: 'เพิ่มแผนผ่อนแล้ว', severity: 'success' }; navigate(`/installments/${created.id}`); }
    } catch (e) { setFormError(e instanceof Error ? e.message : 'บันทึกแผนผ่อนไม่สำเร็จ'); }
    finally { setBusy(false); }
  };
  let payable: number | null = null;
  let financed: number | null = null;
  try { payable = readAmount(form.total_amount_satang) + readAmount(form.interest_satang) + readAmount(form.fee_satang); financed = readAmount(form.total_amount_satang) - readAmount(form.down_payment_satang); } catch { /* incomplete form */ }
  const liveDue = detail?.dues.find((d) => d.id === paying?.id) ?? paying;
  const canPay = (due: InstallmentDue) => detail?.status === 'active' && due.outstanding_satang > 0 && due.status !== 'skipped' && !due.plan_closed;
  // ฟอร์มจ่ายขึ้นเฉพาะงวดที่ยังจ่ายได้ — งวดที่ดูประวัติอย่างเดียวไม่มีแถบปุ่มบันทึก ปิดด้วยปุ่ม X
  const payFormOpen = liveDue != null && canPay(liveDue);
  // ไม่มีแผนเลย = ปุ่มเพิ่มอยู่ใน EmptyState ปุ่มเดียว
  const listEmpty = !id && list?.rows.length === 0;

  const dueStatus = (due: InstallmentDue) => <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
    <PaymentStatusChip state={DUE_STATE[due.status]} />
    {due.status === 'skipped' && <Typography variant="body2" color="text.secondary">หนี้งวดนี้ยังอยู่</Typography>}
    {due.plan_closed && <Typography variant="body2" color="text.secondary">เดือนปิดแล้ว</Typography>}
  </Stack>;

  return <Stack spacing={2}>
    {/* ป้ายปุ่มย้อนกลับ = ชื่อหน้าปลายทาง */}
    <Button ref={backRef} component={Link} to={id ? '/installments' : '/planning'} startIcon={<ArrowBackRounded />} sx={{ alignSelf: 'flex-start' }}>{id ? 'แผนผ่อนและยอดคงเหลือ' : 'วางแผนรายเดือน'}</Button>
    <PageHeader level={1} id="installments-heading" title={detail?.name ?? (id ? 'รายละเอียดแผนผ่อน' : 'แผนผ่อนและยอดคงเหลือ')} description="บันทึกการจ่ายแต่ละงวดเอง ยอดจ่ายแล้วและคงเหลือเปลี่ยนทันทีที่บันทึก" action={listEmpty ? undefined : <Button variant="contained" startIcon={id ? <EditRounded /> : <AddRounded />} disabled={loading || Boolean(error) || detail?.status === 'cancelled'} onClick={openEditor}>{id ? 'แก้ไขแผนผ่อน' : 'เพิ่มแผนผ่อน'}</Button>} />
    {error && <LoadError message={error} onRetry={refresh} />}
    {loading ? <TableSkeleton rows={5} /> : detail ? <>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <PlanStatusChip status={detail.status} />
        {detail.status === 'active' && <Button color="error" onClick={() => { payButtonRef.current = null; openConfirm({ title: 'ยกเลิกแผนผ่อน', description: 'งวดที่ยังไม่เคยบันทึกจ่ายจะถูกนำออกจากหน้าวางแผนของเดือนที่ยังเปิด ประวัติการจ่ายและเดือนที่ปิดแล้วยังคงอยู่ การยกเลิกไม่ได้หมายถึงชำระหนี้แล้ว', confirmLabel: 'ยกเลิกแผน', confirmColor: 'error', success: 'ยกเลิกแผนผ่อนแล้ว', action: () => patch(`/api/installment-plans/${detail.id}`, { status: 'cancelled' }) }); }}>ยกเลิกแผน</Button>}
        {detail.status === 'cancelled' && <Button startIcon={<ReplayRounded />} onClick={() => { payButtonRef.current = null; openConfirm({ title: 'นำแผนผ่อนกลับมาใช้', description: 'งวดจะกลับเข้าแผนรายเดือนของเดือนที่ยังเปิด งวดที่เคยข้ามจะยังคงถูกข้าม และเดือนที่ปิดแล้วจะไม่เปลี่ยน', confirmLabel: 'นำแผนกลับมาใช้', success: 'นำแผนผ่อนกลับมาใช้แล้ว', action: () => patch(`/api/installment-plans/${detail.id}`, { status: 'active' }) }); }}>นำแผนกลับมาใช้</Button>}
      </Stack>
      <Typography variant="body2">ราคาซื้อ <Money satang={detail.total_amount_satang} />{SEP}ดาวน์ <Money satang={detail.down_payment_satang} />{SEP}เงินต้นผ่อน <Money satang={detail.financed_amount_satang} />{SEP}ดอกเบี้ย <Money satang={detail.interest_satang} />{SEP}ค่าธรรมเนียม <Money satang={detail.fee_satang} /></Typography>
      <Totals totals={detail} />
      <TableContainer component={Paper} variant="outlined" tabIndex={0} role="region" aria-label="ตารางงวดผ่อน"><Table size="small" aria-label="งวดผ่อน" sx={CELL_SX}>
        <TableHead><TableRow><TableCell>งวด</TableCell><TableCell sx={MD_UP}>ครบกำหนด</TableCell><TableCell align="right" sx={MD_UP}>ต้องชำระ</TableCell><TableCell align="right" sx={MD_UP}>จ่ายแล้ว</TableCell><TableCell align="right">คงเหลือ</TableCell><TableCell sx={MD_UP}>สถานะ</TableCell><TableCell align="right">จัดการ</TableCell></TableRow></TableHead>
        <TableBody>{detail.dues.map((due) => {
          const skipped = due.status === 'skipped';
          const payLabel = canPay(due) ? 'บันทึกจ่าย' : 'ดูการจ่าย';
          // เดือนปิด/แผนไม่ได้กำลังผ่อน = disabled (สถานะของหน้า) · มีการบันทึกจ่ายแล้ว = เหตุผลของตัวงวดเอง (The Row Action Rule)
          const skipLocked = due.plan_closed || detail.status !== 'active';
          return <TableRow key={due.id}>
            <TableCell sx={{ width: { xs: '100%', md: 'auto' } }}>
              {due.installment_no === 0 ? 'เงินดาวน์' : <><Box component="span" sx={BELOW_MD}>งวด </Box>{due.installment_no}</>}
              <Box sx={{ ...BELOW_MD, mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">ครบ {formatDate(due.due_date)}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>ต้องชำระ <Money satang={due.amount_satang} /></Typography>
                {dueStatus(due)}
              </Box>
            </TableCell>
            <TableCell sx={{ ...MD_UP, whiteSpace: 'nowrap' }}>{formatDate(due.due_date)}</TableCell>
            <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}><Money satang={due.amount_satang} /></TableCell>
            <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}><Money satang={due.paid_satang} /></TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Money satang={due.outstanding_satang} /></TableCell>
            <TableCell sx={MD_UP}>{dueStatus(due)}</TableCell>
            <TableCell align="right" sx={{ py: 1 }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={0.5} sx={{ alignItems: { xs: 'flex-end', md: 'center' }, justifyContent: 'flex-end' }}>
              {(canPay(due) || due.payments.length > 0) && <Button aria-label={`${payLabel} ${dueName(due)}`} sx={{ whiteSpace: 'nowrap' }} onClick={(e) => openPayment(due, e.currentTarget)}>{payLabel}</Button>}
              <RowIconButton
                label={skipped ? `นำ${dueName(due)} กลับเข้าแผน` : `ข้าม${dueName(due)}`}
                tooltip={skipped ? 'นำกลับเข้าแผน' : 'ข้ามงวด'}
                color="inherit"
                disabled={skipLocked}
                disabledReason={!skipLocked && due.paid_satang > 0 ? `${skipped ? 'นำกลับเข้าแผน' : 'ข้าม'}ไม่ได้ — มีการบันทึกจ่ายแล้ว` : null}
                onClick={() => openConfirm(skipped
                  ? { title: `นำ${dueName(due)} กลับเข้าแผน`, description: 'งวดนี้จะกลับไปอยู่ในแผนรายเดือนและนับเป็นยอดที่ต้องจ่ายตามเดิม', confirmLabel: 'นำกลับเข้าแผน', success: 'นำงวดกลับเข้าแผนแล้ว', action: () => post(`/api/installment-dues/${due.id}/restore`, {}) }
                  : { title: `ข้าม${dueName(due)}`, description: 'การข้ามงวดไม่ลดหนี้คงเหลือและไม่ถือว่าจ่ายแล้ว', confirmLabel: 'ข้ามงวด', confirmColor: 'warning', success: 'ข้ามงวดแล้ว', action: () => post(`/api/installment-dues/${due.id}/skip`, {}) })}
              >
                {skipped ? <ReplayRounded fontSize="small" /> : <SkipNextRounded fontSize="small" />}
              </RowIconButton>
            </Stack></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table></TableContainer>
    </> : list && (list.rows.length === 0
      ? <EmptyState headingLevel={2} icon={<EventRepeatRounded sx={{ fontSize: 40 }} />} title="ยังไม่มีแผนผ่อน" description="เพิ่มราคาซื้อ เงินดาวน์ และจำนวนงวด เพื่อเห็นภาระทั้งหมดและติดตามยอดจ่าย" action={<Button variant="contained" startIcon={<AddRounded />} onClick={openEditor}>เพิ่มแผนผ่อนแรก</Button>} />
      : <>
        <Typography variant="body2" color="text.secondary">ยอดรวมเฉพาะแผนที่กำลังผ่อน</Typography>
        <Totals totals={list.totals} />
        <TableContainer component={Paper} variant="outlined" tabIndex={0} role="region" aria-label="ตารางแผนผ่อน" data-tour="installments-table"><Table size="small" aria-label="แผนผ่อนทั้งหมด" sx={CELL_SX}>
          <TableHead><TableRow><TableCell>แผนผ่อน</TableCell><TableCell sx={MD_UP}>สถานะ</TableCell><TableCell align="right" sx={MD_UP}>ทั้งหมด</TableCell><TableCell align="right" sx={MD_UP}>จ่ายแล้ว</TableCell><TableCell align="right">คงเหลือ</TableCell></TableRow></TableHead>
          <TableBody>{list.rows.map((plan) => <TableRow key={plan.id}>
            <TableCell sx={{ width: { xs: '100%', md: 'auto' } }}>
              <Button component={Link} to={`/installments/${plan.id}`} sx={{ px: 0.75, ml: -0.75, textAlign: 'left', justifyContent: 'flex-start', overflowWrap: 'anywhere' }}>{plan.name}</Button>
              <Box sx={{ ...BELOW_MD, mt: 0.5 }}>
                <PlanStatusChip status={plan.status} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>ทั้งหมด <Money satang={plan.total_payable_satang} />{SEP}จ่ายแล้ว <Money satang={plan.paid_satang} /></Typography>
              </Box>
            </TableCell>
            <TableCell sx={MD_UP}><PlanStatusChip status={plan.status} /></TableCell>
            <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}><Money satang={plan.total_payable_satang} /></TableCell>
            <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}><Money satang={plan.paid_satang} /></TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Money satang={plan.outstanding_satang} /></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>
      </>)}
    <Modal open={editor} title={detail ? 'แก้ไขแผนผ่อน' : 'เพิ่มแผนผ่อน'} onClose={() => setEditor(false)} busy={busy} dirty={JSON.stringify(form) !== JSON.stringify(formInitial)} footer={{ formId: 'installment-plan-form', submitLabel: 'บันทึกแผนผ่อน' }} onExited={flushNotice}>
      <Stack component="form" id="installment-plan-form" spacing={2} onSubmit={(e) => { e.preventDefault(); if (!busy) void save(); }}>
        <TextField label="ชื่อแผนผ่อน" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        {structureLocked && <Alert severity="info" role="status">แผนนี้มีประวัติการจ่ายหรือเดือนปิดแล้ว จึงแก้ได้เฉพาะชื่อ หมวด และบัญชี</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {(Object.entries(MONEY_FIELDS) as [MoneyField, string][]).map(([key, label]) => <TextField key={key} label={label} required disabled={structureLocked} value={form[key]} {...(structureLocked ? {} : amountFieldHelp(form[key]))} onChange={(e) => setForm({ ...form, [key]: e.target.value })} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />)}
        </Box>
        {payable != null && financed != null && <Typography aria-live="polite">เงินต้นผ่อน <Money satang={financed} />{SEP}ต้องชำระรวมดาวน์ <Money satang={payable} /></Typography>}
        <TextField label="วันครบกำหนดเงินดาวน์" type="date" disabled={structureLocked} value={form.down_payment_date} required={(parseBahtToSatang(form.down_payment_satang) ?? 0) > 0} onChange={(e) => setForm({ ...form, down_payment_date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="จำนวนงวด (ไม่รวมดาวน์)" type="number" required disabled={structureLocked} value={form.installment_count} onChange={(e) => setForm({ ...form, installment_count: e.target.value })} slotProps={{ htmlInput: { min: 1, step: 1 } }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField fullWidth label="ทุกกี่รอบ" type="number" required disabled={structureLocked} value={form.frequency_interval} onChange={(e) => setForm({ ...form, frequency_interval: e.target.value })} slotProps={{ htmlInput: { min: 1, step: 1 } }} /><TextField fullWidth select label="หน่วยรอบ" disabled={structureLocked} value={form.frequency_unit} onChange={(e) => setForm({ ...form, frequency_unit: e.target.value as Form['frequency_unit'] })}><MenuItem value="day">วัน</MenuItem><MenuItem value="month">เดือน</MenuItem><MenuItem value="year">ปี</MenuItem></TextField></Stack>
        <TextField label="วันครบกำหนดงวดแรก" type="date" required disabled={structureLocked} value={form.first_due_date} onChange={(e) => setForm({ ...form, first_due_date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField select label="บัญชีที่ใช้จ่าย" value={form.default_account_id} onChange={(e) => setForm({ ...form, default_account_id: e.target.value })}><MenuItem value="">เลือกตอนจ่าย</MenuItem>{accounts.map((a) => <MenuItem key={a.id} value={String(a.id)}>{a.nickname}</MenuItem>)}</TextField>
        <TextField select label="หมวดรายจ่าย" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><MenuItem value="">ยังไม่ระบุ</MenuItem>{categories.filter((c) => c.kind === 'expense' && c.is_active).map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}</TextField>
        <Typography variant="body2" color="text.secondary">งวดสุดท้ายรับเศษสตางค์จากการหาร จ่ายล่วงหน้าได้ทีละงวด ดอกเบี้ยและค่าธรรมเนียมใช้ยอดรวมที่กรอก</Typography>
        {formError && <Alert severity="error">{formError}</Alert>}
      </Stack>
    </Modal>
    <Modal
      open={paying != null}
      title={paying ? `${payFormOpen ? 'บันทึกจ่าย' : 'การจ่าย'} — ${dueName(paying)}` : ''}
      onClose={() => setPaying(null)}
      busy={busy}
      dirty={payFormOpen && JSON.stringify(payment) !== JSON.stringify(paymentInitial)}
      footer={payFormOpen ? { formId: 'installment-payment-form', submitLabel: 'บันทึกจ่าย' } : undefined}
      onExited={flushNotice}
    >
      <Stack spacing={2}>
        {liveDue && <Typography>ครบกำหนด {formatDate(liveDue.due_date)}{SEP}คงเหลือ <Money satang={liveDue.outstanding_satang} /></Typography>}
        {liveDue?.payments.map((p) => <Box key={p.id} sx={{ borderBottom: 1, borderColor: 'divider', pb: 1.5 }}><Typography>{formatDate(p.paid_date)}{SEP}<Money satang={p.amount_satang} />{SEP}{p.account_nickname}{SEP}{PAYMENT_STATUS[p.status]}</Typography>
          {/* ชื่อเดียวกับหน้าวางแผน — busy = aria-disabled (ปุ่มที่ถือ focus ไม่หลุดไป <body>) เดือนปิด = disabled */}
          {p.status !== 'cancelled' && <Button color="error" aria-label={`ยกเลิกการบันทึกจ่าย ${formatDate(p.paid_date)} ฿${formatBaht(p.amount_satang)}`} disabled={liveDue.plan_closed} aria-disabled={busy} onClick={() => { if (busy) return; setPaying(null); openConfirm({ title: 'ยกเลิกการบันทึกจ่าย', description: 'ยอดนี้จะถูกนำออกจากยอดจ่ายแล้ว และคืนเป็นยอดคงเหลือ', confirmLabel: 'ยกเลิกการบันทึกจ่าย', confirmColor: 'error', success: 'ยกเลิกการบันทึกจ่ายแล้ว', action: () => patch(`/api/monthly-item-payments/${p.id}`, { status: 'cancelled' }) }); }}>ยกเลิกการบันทึกจ่าย</Button>}
        </Box>)}
        {liveDue && canPay(liveDue) && <Stack component="form" id="installment-payment-form" spacing={2} onSubmit={(e) => { e.preventDefault(); if (!busy) void run(async () => post(`/api/installment-dues/${liveDue.id}/payments`, { amount_satang: readAmount(payment.amount), paid_date: payment.paid_date, bank_account_id: Number(payment.bank_account_id) }), 'บันทึกจ่ายแล้ว'); }}>
          <TextField label="ยอดที่จ่าย (บาท)" required value={payment.amount} {...amountFieldHelp(payment.amount)} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
          <TextField label="วันที่จ่ายจริง" type="date" required value={payment.paid_date} onChange={(e) => setPayment({ ...payment, paid_date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select label="บัญชีที่จ่าย" required value={payment.bank_account_id} onChange={(e) => setPayment({ ...payment, bank_account_id: e.target.value })}><MenuItem value=""><em>— เลือกบัญชี —</em></MenuItem>{accounts.map((a) => <MenuItem key={a.id} value={String(a.id)}>{a.nickname}</MenuItem>)}</TextField>
          <Typography variant="body2" color="text.secondary">จ่ายเต็มหรือบางส่วน ก่อนวันครบกำหนดก็ได้ ยอดคงเหลือลดทันทีที่บันทึก</Typography>
          {formError && <Alert severity="error">{formError}</Alert>}
        </Stack>}
        {liveDue?.plan_closed && <Alert severity="info" role="status">เดือนของงวดนี้ปิดแล้ว ต้องเปิดเดือนก่อนจึงเพิ่มหรือยกเลิกการบันทึกจ่ายได้</Alert>}
      </Stack>
    </Modal>
    <ConfirmDialog open={confirmation != null} title={confirmation?.title ?? ''} description={<>{confirmation?.description}{formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}</>} confirmLabel={confirmation?.confirmLabel ?? ''} confirmColor={confirmation?.confirmColor} busy={busy} onClose={() => setConfirmation(null)} onConfirm={() => { if (confirmation) void run(confirmation.action, confirmation.success); }} onExited={() => { rescueFocus(); flushNotice(); }} />
    <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
  </Stack>;
}
