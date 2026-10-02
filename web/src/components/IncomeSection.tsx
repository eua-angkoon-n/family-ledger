import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Alert, Box, Button, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import { post, patch, req, type Account, type IncomeDeduction, type IncomeRecord, type PlanItem } from '../api.js';
import Modal from '../Modal.js';
import { AMOUNT_FORMAT_HINT, formatBaht, formatDate, parseBahtToSatang } from '../format.js';
import { amountFieldHelp as amountHelp, BELOW_MD, LoadError, MD_UP, PageHeader, RowIconButton, TableSkeleton } from '../ui.js';
import { dataTextSx } from '../theme.js';
import Money from './Money.js';
import { shiftMonth } from './MonthPicker.js';

const DEDUCTIONS = { social_security: 'ประกันสังคม', withholding_tax: 'ภาษีหัก ณ ที่จ่าย', other: 'รายการหักอื่น' };
type DeductionForm = { deduction_type: IncomeDeduction['deduction_type']; name: string; amount: string; monthly_plan_item_id: string };
type Form = { name: string; gross: string; monthly_plan_item_id: string; bank_account_id: string; income_date: string; deductions: DeductionForm[] };
const emptyForm = (): Form => ({ name: '', gross: '', monthly_plan_item_id: '', bank_account_id: '', income_date: '', deductions: [] });
const NEGATIVE_NET = 'ยอดหักรวมมากกว่ารายได้เต็ม — ลดยอดหักหรือแก้รายได้เต็มก่อนบันทึก';

function amount(value: string): number {
  const result = parseBahtToSatang(value);
  if (result == null || !Number.isSafeInteger(result)) throw new Error(`จำนวนเงินไม่ถูกต้อง — ${AMOUNT_FORMAT_HINT}`);
  return result;
}

export type IncomeSectionHandle = {
  openNewFor: (itemId: number) => void;
  /**
   * true = เปิดฟอร์มแก้ไขรายได้แล้ว: `incomeId` ที่เลือกจากเมนู หรือรายได้รายการเดียวของเดือน
   * false = เลื่อนไปที่ส่วนรายได้แทน (โหลดไม่สำเร็จ / หารายได้หรือรายการหักไม่เจอ)
   */
  linkDeduction: (itemId: number, incomeId?: number) => boolean;
  /** รายได้ที่บันทึกแล้วของเดือนนี้ (ว่างเมื่อโหลดไม่สำเร็จ) — ตัวเลือกของเมนู "ผูกกับรายได้" เมื่อมีหลายรายการ */
  incomes: () => IncomeRecord[];
};

type Props = {
  month: string;
  closed: boolean;
  items: PlanItem[];
  onChanged: () => Promise<void>;
  /** ฟอร์มรายได้ปิดสนิทแล้ว — ผู้เรียกประกาศผลการบันทึกที่จุดนี้ (`#root` เป็น aria-hidden ระหว่าง modal เปิด) */
  onExited?: () => void;
};

export default forwardRef<IncomeSectionHandle, Props>(function IncomeSection({ month, closed, items, onChanged, onExited }, ref) {
  const [rows, setRows] = useState<IncomeRecord[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<IncomeRecord | 'new' | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  // ค่าตอนเปิดฟอร์ม — ต่างจากนี้ = มีการแก้ค้าง Modal ถามก่อนปิด (The Unsaved Modal Rule)
  const [initialForm, setInitialForm] = useState<Form>(emptyForm);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    Promise.all([req<{ rows: IncomeRecord[] }>(`/api/income-records?month=${month}`), req<Account[]>('/api/accounts')])
      .then(([income, banks]) => { if (current) { setRows(income.rows); setAccounts(banks); } })
      .catch((e: Error) => { if (current) setError(e.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [month, revision]);


  const refresh = async () => { setRevision((n) => n + 1); await onChanged(); };
  const startForm = (income: IncomeRecord | 'new', next: Form) => {
    setFormError(''); setEditing(income); setForm(next); setInitialForm(next);
  };
  const formFor = (income: IncomeRecord): Form => ({
    name: income.name, gross: formatBaht(income.gross_amount_satang), monthly_plan_item_id: String(income.monthly_plan_item_id),
    bank_account_id: income.bank_account_id == null ? '' : String(income.bank_account_id), income_date: income.income_date ?? '',
    deductions: income.deductions.map((d) => ({ deduction_type: d.deduction_type, name: d.name, amount: formatBaht(d.amount_satang), monthly_plan_item_id: String(d.monthly_plan_item_id) })),
  });
  const openEditor = (income: IncomeRecord | 'new') => startForm(income, income === 'new' ? emptyForm() : formFor(income));
  const scrollToSection = () => document.getElementById('income-section')?.scrollIntoView({ block: 'start' });
  const available = (kind: PlanItem['kind'], selected = '') => items.filter((item) =>
    item.kind === kind && (String(item.id) === selected || (item.income_record_id == null && item.installment_due_id == null && item.explicit_status === 'active' && !item.payments.some((p) => p.status !== 'cancelled'))));
  // ปุ่ม "บันทึกรายได้เต็ม" บนแถวของแผนเปิดฟอร์มใหม่ที่เชื่อมรายการนั้นไว้แล้ว — ผลเท่ากับเลือกใน
  // dropdown "เชื่อมรายได้ในแผน" เอง โหลดส่วนนี้ไม่สำเร็จ → เลื่อนไปให้เห็นปุ่มลองใหม่ ส่วนรายการที่ไม่อยู่ใน
  // dropdown (ผูกไปแล้ว/มีการจ่าย) ไม่เปิดฟอร์มว่าง เพราะจะได้รายได้ซ้ำที่ไม่ผูกกับแผน
  //
  // "ผูกกับรายได้" บนแถวรายการหักที่ค้าง "ยังไม่ผูกกับรายได้" — เปิดฟอร์มแก้ไขรายได้นั้นพร้อมแถวหักที่เชื่อมรายการนี้ไว้แล้ว
  // (ผลเท่ากับกด "เพิ่มรายการหัก" แล้วเลือกเอง) หลายรายการไม่เดาว่าหักจากรายได้ไหน — ผู้เรียกให้เลือกจากเมนู (incomes) แล้วส่ง incomeId มา
  useImperativeHandle(ref, () => ({
    openNewFor: (itemId) => {
      if (error) { scrollToSection(); return; }
      const item = available('income').find((i) => i.id === itemId);
      if (!item) return;
      startForm('new', { ...emptyForm(), monthly_plan_item_id: String(item.id), name: item.name, gross: formatBaht(item.planned_amount_satang) });
    },
    incomes: () => (error ? [] : rows),
    linkDeduction: (itemId, incomeId) => {
      const item = available('payroll_deduction').find((i) => i.id === itemId);
      const income = incomeId != null ? rows.find((r) => r.id === incomeId) : rows.length === 1 ? rows[0] : undefined;
      if (error || !item || !income) { scrollToSection(); return false; }
      const base = formFor(income);
      startForm(income, { ...base, deductions: [...base.deductions, { deduction_type: 'other', name: item.name, amount: formatBaht(item.planned_amount_satang), monthly_plan_item_id: String(item.id) }] });
      return true;
    },
  }));
  const updateDeduction = (index: number, changes: Partial<DeductionForm>) => setForm((f) => ({ ...f, deductions: f.deductions.map((d, i) => i === index ? { ...d, ...changes } : d) }));
  // วันรับเงินอยู่ได้ตั้งแต่ต้นเดือนก่อนหน้าถึงสิ้นเดือนถัดไป (กติกาเดียวกับ backend) — Date.UTC(y, m, 0) คือวันสุดท้ายของเดือน m
  const minDate = `${shiftMonth(month, -1)}-01`;
  const nextMonth = shiftMonth(month, 1);
  const [ny, nm] = nextMonth.split('-').map(Number);
  const maxDate = `${nextMonth}-${new Date(Date.UTC(ny!, nm!, 0)).getUTCDate()}`;
  let preview: number | null = null;
  try { preview = amount(form.gross) - form.deductions.reduce((sum, d) => sum + amount(d.amount), 0); } catch { /* incomplete form */ }
  const save = async () => {
    // ปุ่มบันทึกไม่ถูกปิดตอนสุทธิติดลบ — กดแล้วบอกเหตุผลตรงนี้ (และบรรทัดยอดสุทธิบอกอยู่แล้ว)
    if (preview != null && preview < 0) { setFormError(NEGATIVE_NET); return; }
    setBusy(true); setFormError('');
    try {
      const deductions = form.deductions.map((d) => ({ deduction_type: d.deduction_type, name: d.name, amount_satang: amount(d.amount), ...(d.monthly_plan_item_id ? { monthly_plan_item_id: Number(d.monthly_plan_item_id) } : {}) }));
      const body = { name: form.name, gross_amount_satang: amount(form.gross), bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : null, income_date: form.income_date || null, deductions };
      if (editing === 'new') await post('/api/income-records', { ...body, month, ...(form.monthly_plan_item_id ? { monthly_plan_item_id: Number(form.monthly_plan_item_id) } : {}) });
      else if (editing) await patch(`/api/income-records/${editing.id}`, body);
      setEditing(null); await refresh();
    } catch (e) { setFormError(e instanceof Error ? e.message : 'บันทึกรายได้ไม่สำเร็จ'); }
    finally { setBusy(false); }
  };

  // เป้าของลิงก์ "จัดการในรายได้" บนแถวของแผน — scrollMarginTop กัน app bar แบบ sticky บังหัวข้อ (เหมือน #data-freshness)
  return <Box component="section" id="income-section" aria-labelledby="income-heading" sx={{ scrollMarginTop: 80 }}>
    <PageHeader id="income-heading" title="รายได้และรายการหัก" description="รายได้เต็มก่อนหักและรายการหัก ยอดสุทธิไว้อ้างอิง" action={<Button startIcon={<AddRounded />} variant="outlined" disabled={closed || loading || Boolean(error)} onClick={() => openEditor('new')}>เพิ่มรายได้เต็ม</Button>} />
    {error && <LoadError message={error} onRetry={() => setRevision((n) => n + 1)} />}
    {loading ? <TableSkeleton rows={2} /> : !error && (rows.length === 0 ? <Typography color="text.secondary" sx={{ mt: 2 }}>ยังไม่มีรายได้เต็มในเดือนนี้ เลือกเชื่อมรายได้เดิมในแผน หรือเพิ่มรายการใหม่ได้</Typography> :
      // < md เหลือ รายได้ · รายได้เต็ม · แก้ไข — หัก/สุทธิพับลงบรรทัดรอง ที่ 320px: กล่อง 286 − ยอด ~98 − ปุ่ม 56 ≈ ชื่อ 132px
      <TableContainer component={Paper} variant="outlined" tabIndex={0} role="region" aria-label="ตารางรายได้เต็ม" sx={{ mt: 2 }}>
        <Table size="small" aria-label="รายได้เต็มและเงินเข้าสุทธิ" sx={{ '& .MuiTableCell-root': { px: { xs: 1, md: 2 } } }}>
          <TableHead><TableRow><TableCell>รายได้</TableCell><TableCell align="right">รายได้เต็ม</TableCell><TableCell align="right" sx={MD_UP}>หักทั้งหมด</TableCell><TableCell align="right" sx={MD_UP}>สุทธิ</TableCell><TableCell align="right">จัดการ</TableCell></TableRow></TableHead>
          <TableBody>{rows.map((income) => <TableRow key={income.id} hover>
            <TableCell sx={{ width: '100%', maxWidth: 0 }}>
              <Box title={income.name} sx={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere' }}>{income.name}</Box>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {income.income_date ? formatDate(income.income_date) : 'ยังไม่กำหนดวันรับเงิน'}
                <Box component="span" sx={BELOW_MD}> · หัก <Money satang={income.gross_amount_satang - income.expected_net_satang} /> · สุทธิ <Money satang={income.expected_net_satang} tone="income" /></Box>
              </Typography>
            </TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Money satang={income.gross_amount_satang} /></TableCell>
            <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}><Money satang={income.gross_amount_satang - income.expected_net_satang} /></TableCell>
            <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}><Money satang={income.expected_net_satang} tone="income" /></TableCell>
            <TableCell align="right" sx={{ py: 0.5 }}>
              <RowIconButton label={`แก้ไข ${income.name}`} tooltip="แก้ไข" disabled={closed} onClick={() => openEditor(income)}><EditRounded fontSize="small" /></RowIconButton>
            </TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </TableContainer>)}
    <Modal
      open={editing != null}
      title={editing === 'new' ? 'เพิ่มรายได้เต็ม' : 'แก้ไขรายได้เต็ม'}
      onClose={() => setEditing(null)}
      busy={busy}
      dirty={JSON.stringify(form) !== JSON.stringify(initialForm)}
      footer={{ formId: 'income-form', submitLabel: 'บันทึกรายได้' }}
      onExited={onExited}
    >
      <Stack component="form" id="income-form" spacing={2} onSubmit={(e) => { e.preventDefault(); if (!busy) void save(); }}>
        {editing === 'new' && <TextField select label="เชื่อมรายได้ในแผน" value={form.monthly_plan_item_id} onChange={(e) => { const item = items.find((i) => String(i.id) === e.target.value); setForm({ ...form, monthly_plan_item_id: e.target.value, ...(item ? { name: item.name, gross: formatBaht(item.planned_amount_satang) } : {}) }); }} helperText="แสดงเฉพาะรายการที่ยังไม่เชื่อมและไม่มีการบันทึกจ่ายที่ใช้งาน">
          <MenuItem value="">สร้างรายการใหม่</MenuItem>{available('income').map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.name}</MenuItem>)}
        </TextField>}
        <TextField label="ชื่อรายได้" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField label="รายได้เต็ม (บาท)" required value={form.gross} onChange={(e) => setForm({ ...form, gross: e.target.value })} {...amountHelp(form.gross)} slotProps={{ htmlInput: { inputMode: 'decimal', sx: dataTextSx } }} />
        {/* หัวข้อย่อยใต้ชื่อ dialog (h2) — ขั้น Headline Small ไม่ใช่ h3 ค่าเริ่มต้นของ MUI (3rem) */}
        <Typography component="h3" variant="h2" sx={{ fontSize: '1rem', lineHeight: 1.5 }}>รายการหักจากรายได้</Typography>
        {form.deductions.map((d, index) => <Box key={index} sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
          <Stack spacing={1.5}>
            <TextField select label={`ประเภทการหัก ${index + 1}`} value={d.deduction_type} onChange={(e) => updateDeduction(index, { deduction_type: e.target.value as DeductionForm['deduction_type'] })}>{Object.entries(DEDUCTIONS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
            <TextField select label="เชื่อมรายการหักในแผน" value={d.monthly_plan_item_id} onChange={(e) => { const item = items.find((i) => String(i.id) === e.target.value); updateDeduction(index, { monthly_plan_item_id: e.target.value, ...(item ? { name: item.name, amount: formatBaht(item.planned_amount_satang) } : {}) }); }}>
              <MenuItem value="">สร้างรายการหักใหม่</MenuItem>{available('payroll_deduction', d.monthly_plan_item_id).filter((i) => !form.deductions.some((other, n) => n !== index && other.monthly_plan_item_id === String(i.id))).map((i) => <MenuItem key={i.id} value={String(i.id)}>{i.name}</MenuItem>)}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'flex-start' } }}>
              <TextField fullWidth label="ชื่อรายการหัก" required value={d.name} onChange={(e) => updateDeduction(index, { name: e.target.value })} />
              <TextField fullWidth label="ยอดหัก (บาท)" required value={d.amount} onChange={(e) => updateDeduction(index, { amount: e.target.value })} {...amountHelp(d.amount)} slotProps={{ htmlInput: { inputMode: 'decimal', sx: dataTextSx } }} />
              <Button color="error" aria-label={`ลบรายการหัก ${index + 1}`} onClick={() => setForm({ ...form, deductions: form.deductions.filter((_, i) => i !== index) })}>ลบ</Button>
            </Stack>
          </Stack>
        </Box>)}
        <Button onClick={() => setForm({ ...form, deductions: [...form.deductions, { deduction_type: 'other', name: '', amount: '', monthly_plan_item_id: '' }] })}>เพิ่มรายการหัก</Button>
        {preview != null && <Box aria-live="polite">
          <Typography>ยอดสุทธิหลังหัก: <Money satang={preview} tone={preview < 0 ? 'expense' : 'income'} /></Typography>
          {preview < 0 && <Typography variant="body2" color="error">{NEGATIVE_NET}</Typography>}
        </Box>}
        <TextField select label="บัญชีรับเงิน" value={form.bank_account_id} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}><MenuItem value="">ยังไม่ระบุ</MenuItem>{accounts.map((a) => <MenuItem key={a.id} value={String(a.id)}>{a.nickname}</MenuItem>)}</TextField>
        <TextField label="วันที่รับเงิน" type="date" value={form.income_date} onChange={(e) => setForm({ ...form, income_date: e.target.value })} helperText={`เลือกได้ตั้งแต่ ${formatDate(minDate)} ถึง ${formatDate(maxDate)} เช่น เงินเดือนที่ออกก่อนสิ้นเดือน`} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: minDate, max: maxDate, sx: dataTextSx } }} />
        {formError && <Alert severity="error">{formError}</Alert>}
      </Stack>
    </Modal>
  </Box>;
});
