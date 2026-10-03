import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import GroupRounded from '@mui/icons-material/GroupRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import { del, patch, post, req, type AdminBank, type Bank, type BankUpdateResponse, type User } from './api.js';
import { createFormFieldChangeHandler } from './form.js';
import Modal from './Modal.js';
import { dataTextSx, descriptionSx, fontFamilies } from './theme.js';
import {
  BELOW_MD,
  ConfirmDialog,
  EmptyState,
  FeedbackSnackbar,
  LoadError,
  MD_UP,
  PageHeader,
  RowIconButton,
  TableSkeleton,
  visuallyHiddenSx,
  type Notice,
} from './ui.js';

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
// < md คอลัมน์ชื่อกินที่ที่เหลือแล้วตัดบรรทัด (maxWidth 0 กันดันตารางเกินกล่อง) — ท่าเดียวกับหน้าบัญชีของฉัน
const NAME_CELL = { width: { xs: '100%', md: 'auto' }, maxWidth: { xs: 0, md: 'none' }, overflowWrap: 'anywhere' } as const;
const SEP = <Box component="span" aria-hidden>{' · '}</Box>;
// error ของฟอร์มอยู่บนสุด — เลื่อนมาให้เห็นตอนเพิ่งขึ้น (ปุ่มบันทึกอยู่นอกส่วนที่เลื่อน) เหมือนหน้าบัญชีของฉัน
const revealOnMount = (el: HTMLElement | null) => el?.scrollIntoView({ block: 'nearest' });
const resyncText = (n: number) => `ระบบกำลังอ่านอีเมลย้อนหลังของ ${n.toLocaleString('th-TH')} กล่องใหม่ทั้งหมด ผลจะเข้ามาในไม่กี่นาที`;

const EMPTY = {
  name: '',
  parser_key: '',
  sender_email: '',
  sender_domain: '',
  subject_monthly: '',
  subject_ondemand: '',
  attachment_filename_pattern: '\\.pdf$',
};
type BankForm = typeof EMPTY;
type BankField = keyof BankForm;
// ลำดับตามฟอร์ม ช่องแรกที่ผิดรับ focus · select ใส่ id ที่ตัว combobox (SelectDisplayProps) ไม่ใช่ input ที่ซ่อนอยู่
const FIELD_ID: Record<BankField, string> = {
  name: 'bank-name',
  parser_key: 'bank-parser',
  sender_email: 'bank-sender-email',
  sender_domain: 'bank-sender-domain',
  subject_monthly: 'bank-subject-monthly',
  subject_ondemand: 'bank-subject-ondemand',
  attachment_filename_pattern: 'bank-filename',
};

// ตัวอย่างจริงของ SCB (migrations/003, ชื่อไฟล์จาก test fixture) — ไม่มีเลขบัญชีปน · บอก "ตัวอย่างจาก SCB" เพราะขึ้นตอนแก้ธนาคารอื่นด้วย
const REGEX_FIELDS = [
  {
    key: 'subject_monthly',
    short: 'หัวข้อรายเดือน',
    label: 'หัวข้ออีเมล statement รายเดือน',
    helper: 'หัวข้ออีเมลที่ธนาคารส่ง statement ให้ทุกเดือน — ตัวอย่างจาก SCB: “SCB E PASSBOOK: e-Statement”',
    placeholder: '^SCB E PASSBOOK: e-Statement$',
  },
  {
    key: 'subject_ondemand',
    short: 'หัวข้อขอเอง',
    label: 'หัวข้ออีเมล statement ที่ขอย้อนหลังเอง',
    helper: 'หัวข้อตอนผู้ใช้ขอ statement ย้อนหลังจากแอปธนาคาร (เหมือนรายเดือนก็ใส่ซ้ำได้) — ตัวอย่างจาก SCB: “Sending deposit account statement with annotations from SCB Easy Application system”',
    placeholder: '^Sending deposit account statement with annotations from SCB Easy Application system$',
  },
  {
    key: 'attachment_filename_pattern',
    short: 'ชื่อไฟล์',
    label: 'ชื่อไฟล์ PDF ที่แนบมา',
    helper: 'ไฟล์แนบที่ชื่อไม่ตรงจะถูกข้าม (เช่นคู่มือที่แนบมาด้วย) — ตัวอย่างจาก SCB: “AcctSt_Jan26.pdf”',
    placeholder: '^(?:X{4}\\d{6}|AcctSt_[A-Za-z]{3}\\d{2})\\.pdf$',
  },
] as const satisfies readonly { key: BankField; short: string; label: string; helper: string; placeholder: string }[];

const REGEX_INVALID = 'รูปแบบนี้ใช้ไม่ได้ — ตรวจวงเล็บ [ ] ( ) และเครื่องหมาย \\ ให้ครบคู่';
const NAME_TAKEN = 'มีธนาคารชื่อนี้อยู่แล้ว';

// server ตรวจและใช้ด้วย `new RegExp(pattern)` ไม่มี flag หลัง trim (src/http.ts regex(), src/worker.ts, src/gmail.ts)
// ตัวพิมพ์เล็ก/ใหญ่จึงต้องตรง — ห้ามเติม flag ฝั่งนี้ ไม่งั้นผลทดสอบในฟอร์มไม่ตรงกับที่ระบบหยิบอีเมลจริง
function compile(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern.trim());
  } catch {
    return null;
  }
}

/** error ของแต่ละช่อง เรียงตามฟอร์ม · regex ผิดรูปแบบและชื่อซ้ำขึ้นทันที ช่องว่างขึ้นหลังกดบันทึก (`showRequired`) */
function bankFormErrors(f: BankForm, others: AdminBank[], showRequired: boolean): Partial<Record<BankField, string>> {
  const errors: Partial<Record<BankField, string>> = {};
  const name = f.name.trim().toLowerCase();
  // unique index ของ server คือ lower(name) (migrations/001)
  if (name === '') {
    if (showRequired) errors.name = 'กรอกชื่อธนาคาร';
  } else if (others.some((b) => b.name.toLowerCase() === name)) errors.name = NAME_TAKEN;
  if (showRequired && f.parser_key === '') errors.parser_key = 'เลือกตัวแกะข้อมูล';
  if (showRequired && f.sender_email.trim() === '') errors.sender_email = 'กรอกอีเมลผู้ส่ง';
  if (showRequired && f.sender_domain.trim() === '') errors.sender_domain = 'กรอกโดเมนผู้ส่ง';
  for (const { key } of REGEX_FIELDS) {
    if (f[key].trim() === '') {
      if (showRequired) errors[key] = 'กรอกรูปแบบ';
    } else if (!compile(f[key])) errors[key] = REGEX_INVALID;
  }
  return errors;
}

/** ช่องลองหัวข้อ/ชื่อไฟล์: ตรงกับรูปแบบไหนบ้าง — ใช้ทดสอบกับทั้งสามรูปแบบพร้อมกันเหมือนที่ worker ใช้ · matched null = ยังไม่ได้ลอง */
function sampleResult(f: BankForm, sample: string): { text: string; matched: boolean | null } {
  if (sample === '') return { text: 'วางหัวข้ออีเมลหรือชื่อไฟล์จริงเพื่อดูว่าตรงกับรูปแบบไหน — ช่องนี้ไม่ถูกบันทึก', matched: null };
  const matched: string[] = [];
  const skipped: string[] = [];
  for (const { key, short } of REGEX_FIELDS) {
    const re = f[key].trim() === '' ? null : compile(f[key]);
    if (!re) skipped.push(short);
    else if (re.test(sample)) matched.push(short);
  }
  const result = matched.length > 0 ? `ตรงกับ ${matched.join(', ')}` : 'ไม่ตรงกับรูปแบบไหนเลย';
  return {
    text: skipped.length > 0 ? `${result} (ยังไม่ได้ลอง ${skipped.join(', ')} เพราะรูปแบบว่างหรือใช้ไม่ได้)` : result,
    matched: matched.length > 0,
  };
}

function Banks() {
  const [banks, setBanks] = useState<AdminBank[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [parserKeys, setParserKeys] = useState<string[] | null>(null);
  const [parserKeysError, setParserKeysError] = useState('');
  const [form, setForm] = useState(EMPTY);
  // ค่าตอนเปิดฟอร์ม — ต่างจากนี้ = มีการแก้ค้าง Modal ถามก่อนปิด (The Unsaved Modal Rule)
  const [formInitial, setFormInitial] = useState(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [sample, setSample] = useState('');
  // ข้อความที่ประกาศ (role="status") — ตั้งเฉพาะตอนช่องตัวอย่างเปลี่ยน พิมพ์ช่องรูปแบบแล้วไม่ประกาศทุกตัวอักษร
  const [sampleStatus, setSampleStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // ธนาคารที่ถามลบค้างไว้จน dialog ปิดสนิท — ไม่งั้นชื่อในคำถามว่างระหว่าง fade ออก
  const [deleting, setDeleting] = useState<AdminBank | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // ปิดใช้งานธนาคารที่มีบัญชีผูก — ถามก่อน (ค้างไว้จน dialog ปิดสนิทเหมือน deleting)
  const [disabling, setDisabling] = useState<AdminBank | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableError, setDisableError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  // ผลของการกดใน dialog ขึ้นหลัง dialog ปิดสนิท (`#root` เป็น aria-hidden จนถึง onExited) — เปิดได้ทีละ dialog จึงพอช่องเดียว
  const noticeAfterCloseRef = useRef<Notice | null>(null);
  const focusAddAfterExitRef = useRef(false);
  // สวิตช์ใช้งานที่กำลังส่ง — กดซ้ำระหว่างรอไม่ยิงซ้ำ (สวิตช์ไม่ disabled focus จึงไม่หลุด)
  const togglingRef = useRef(new Set<number>());
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // ข้อมูลเดิมคงไว้ระหว่างโหลดซ้ำ — โหลดซ้ำไม่สำเร็จ = LoadError เหนือตารางเดิม (The Section Failure Rule)
  const reload = async () => {
    setLoadError('');
    try {
      setBanks(await req<AdminBank[]>('/api/admin/banks'));
    } catch (e) {
      setLoadError(errorText(e, 'โหลดข้อมูลธนาคารไม่สำเร็จ'));
    }
  };
  const loadParserKeys = async () => {
    setParserKeysError('');
    try {
      setParserKeys((await req<{ keys: string[] }>('/api/admin/parser-keys')).keys);
    } catch (e) {
      setParserKeysError(errorText(e, 'โหลดรายชื่อตัวแกะข้อมูลไม่สำเร็จ'));
    }
  };
  useEffect(() => {
    void reload();
    void loadParserKeys();
  }, []);

  const flushNotice = () => {
    if (noticeAfterCloseRef.current) setNotice(noticeAfterCloseRef.current);
    noticeAfterCloseRef.current = null;
  };

  const setFormField = createFormFieldChangeHandler(setForm);
  // regex เป็นบรรทัดเดียว — ช่องเป็น multiline ให้เห็นทั้งสาย แต่ขึ้นบรรทัดใหม่ที่วางมาถูกตัดทิ้ง และ Enter = บันทึกเหมือนช่องอื่น
  const setRegexField = (key: BankField) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value.replace(/[\r\n]+/g, '') }));
  const submitOnEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    (event.target as HTMLTextAreaElement).form?.requestSubmit();
  };

  const openForm = (id: number | null, values: BankForm) => {
    setEditingId(id);
    setForm(values);
    setFormInitial(values);
    setFormError('');
    setAttempted(false);
    setSample('');
    setSampleStatus('');
    setModalOpen(true);
  };
  const openEdit = (bank: AdminBank) => openForm(bank.id, {
    name: bank.name,
    parser_key: bank.parser_key,
    sender_email: bank.sender_email,
    sender_domain: bank.sender_domain,
    subject_monthly: bank.subject_monthly,
    subject_ondemand: bank.subject_ondemand,
    attachment_filename_pattern: bank.attachment_filename_pattern,
  });

  const others = (banks ?? []).filter((b) => b.id !== editingId);
  const fieldErrors = bankFormErrors(form, others, attempted);

  const saveBank = async () => {
    setFormError('');
    const invalid = Object.keys(bankFormErrors(form, others, true))[0] as BankField | undefined;
    if (invalid) {
      setAttempted(true);
      document.getElementById(FIELD_ID[invalid])?.focus();
      return;
    }
    setSubmitting(true);
    const body = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
    try {
      if (editingId) {
        const saved = await patch<BankUpdateResponse>(`/api/banks/${editingId}`, body);
        noticeAfterCloseRef.current = {
          message: saved.resync_mailboxes > 0 ? `บันทึกแล้ว ${resyncText(saved.resync_mailboxes)}` : 'บันทึกข้อมูลธนาคารแล้ว',
          severity: 'success',
        };
      } else {
        const created = await post<Bank>('/api/banks', body);
        noticeAfterCloseRef.current = { message: `เพิ่มธนาคาร ${created.name} แล้ว`, severity: 'success' };
      }
      setModalOpen(false);
      void reload();
    } catch (e) {
      setFormError(errorText(e, 'บันทึกไม่สำเร็จ'));
    } finally {
      setSubmitting(false);
    }
  };

  // เปลี่ยนสถานะในตารางทันที (สวิตช์คือสถานะ) ไม่สำเร็จ = คืนค่าเดิม + แจ้งใน snackbar
  // ปิดธนาคารที่มีบัญชีผูก (รวมที่เก็บเข้าคลัง) ถามก่อน — เปิดกลับและธนาคารที่ไม่มีบัญชีไม่ต้องถาม
  const toggleBank = async (bank: AdminBank) => {
    if (togglingRef.current.has(bank.id)) return;
    if (bank.is_active && bank.account_count > 0) {
      setDisableError('');
      setDisabling(bank);
      setDisableOpen(true);
      return;
    }
    togglingRef.current.add(bank.id);
    const next = !bank.is_active;
    const setActive = (value: boolean) => setBanks((rows) => rows && rows.map((b) => (b.id === bank.id ? { ...b, is_active: value } : b)));
    setActive(next);
    try {
      const saved = await patch<BankUpdateResponse>(`/api/banks/${bank.id}`, { is_active: next });
      setNotice({
        message: !next
          // worker หยิบเฉพาะธนาคารที่เปิดใช้งาน (src/worker.ts)
          ? `ปิดใช้งาน ${bank.name} แล้ว ระบบหยุดหยิบ statement ใหม่ของธนาคารนี้`
          : saved.resync_mailboxes > 0 ? `เปิดใช้งาน ${bank.name} แล้ว ${resyncText(saved.resync_mailboxes)}` : `เปิดใช้งาน ${bank.name} แล้ว`,
        severity: 'success',
      });
    } catch (e) {
      setActive(bank.is_active);
      setNotice({ message: errorText(e, 'เปลี่ยนสถานะธนาคารไม่สำเร็จ'), severity: 'error' });
    } finally {
      togglingRef.current.delete(bank.id);
    }
  };

  // ผลขึ้นหลัง dialog ปิดสนิท (flushNotice) · ไม่สำเร็จ = error ใน dialog สวิตช์ยังเปิดอยู่
  const disableBank = async () => {
    if (!disabling) return;
    setDisableError('');
    setSubmitting(true);
    try {
      await patch<BankUpdateResponse>(`/api/banks/${disabling.id}`, { is_active: false });
      const id = disabling.id;
      setBanks((rows) => rows && rows.map((b) => (b.id === id ? { ...b, is_active: false } : b)));
      noticeAfterCloseRef.current = { message: `ปิดใช้งาน ${disabling.name} แล้ว ระบบหยุดหยิบ statement ใหม่ของธนาคารนี้`, severity: 'success' };
      setDisableOpen(false);
    } catch (e) {
      setDisableError(errorText(e, 'ปิดใช้งานธนาคารไม่สำเร็จ'));
    } finally {
      setSubmitting(false);
    }
  };

  const openDelete = (bank: AdminBank) => {
    setDeleteError('');
    setDeleting(bank);
    setDeleteOpen(true);
  };
  const deleteBank = async () => {
    if (!deleting) return;
    setDeleteError('');
    setSubmitting(true);
    try {
      await del(`/api/banks/${deleting.id}`);
      const deletedId = deleting.id;
      setBanks((rows) => rows && rows.filter((b) => b.id !== deletedId));
      noticeAfterCloseRef.current = { message: `ลบธนาคาร ${deleting.name} แล้ว`, severity: 'success' };
      focusAddAfterExitRef.current = true;
      setDeleteOpen(false);
    } catch (e) {
      // 409 = มีบัญชีผูกเพิ่มระหว่างนั้น — error อยู่ใน dialog และโหลดจำนวนบัญชีใหม่ ปุ่มลบของแถวจึงกดไม่ได้หลังปิด
      setDeleteError(errorText(e, 'ลบธนาคารไม่สำเร็จ'));
      void reload();
    } finally {
      setSubmitting(false);
    }
  };

  // ตัวเลือก parser: ค่าเดิมของธนาคารที่แก้อยู่ต้องมีเสมอ แม้โหลดรายชื่อไม่ได้ (ไม่งั้น select ว่างเหมือนไม่เคยตั้ง)
  const parserOptions = [...new Set([...(parserKeys ?? []), formInitial.parser_key].filter(Boolean))];
  const sampleCheck = sampleResult(form, sample);

  // สวิตช์และปุ่มของแถวใช้ทั้งคอลัมน์ (≥ md) และบรรทัดใต้ชื่อ (< md) — อันที่ซ่อนเป็น display:none จึงไม่ซ้ำใน tab/screen reader
  // ชื่อคงที่ สถานะบอกด้วย checked (เหมือนผู้เสียภาษีในหน้าบัญชีของฉัน)
  // < md สวิตช์เป็นตัวควบคุมหลักของแถว — ขนาดปกติให้พื้นที่กดพอ (small สูง ~24px)
  const activeSwitch = (bank: AdminBank, size: 'small' | 'medium' = 'small') => (
    <Switch
      size={size}
      checked={bank.is_active}
      onChange={() => void toggleBank(bank)}
      slotProps={{ input: { 'aria-label': `ใช้งาน ${bank.name}` } }}
    />
  );
  const rowActions = (bank: AdminBank) => (
    <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
      <RowIconButton label={`แก้ไข ${bank.name}`} tooltip="แก้ไข" onClick={() => openEdit(bank)}>
        <EditRounded fontSize="small" />
      </RowIconButton>
      {/* มีบัญชีผูก (รวมที่เก็บเข้าคลัง) = FK กันลบ — บอกเหตุผลและทางเลือกแทนการให้กดแล้วเจอ 409 */}
      <RowIconButton
        label={`ลบ ${bank.name}`}
        tooltip="ลบ"
        color="error"
        disabledReason={bank.account_count > 0 ? `ลบไม่ได้ — มีบัญชีผูกอยู่ ${bank.account_count.toLocaleString('th-TH')} บัญชี (รวมที่เก็บเข้าคลัง) ปิดใช้งานแทน` : null}
        onClick={() => openDelete(bank)}
      >
        <DeleteOutlineRounded fontSize="small" />
      </RowIconButton>
    </Stack>
  );

  return (
    <Box sx={{ mt: 4 }}>
      <PageHeader
        title="ธนาคารที่รองรับ"
        description="รูปแบบอีเมลและไฟล์แนบที่ระบบใช้หยิบ statement ของแต่ละธนาคาร"
        action={<Button ref={addButtonRef} variant="contained" startIcon={<AddRounded />} onClick={() => openForm(null, EMPTY)} sx={{ whiteSpace: 'nowrap' }}>เพิ่มธนาคาร</Button>}
      />

      {banks == null ? (
        loadError ? <LoadError message={loadError} onRetry={() => void reload()} /> : <TableSkeleton />
      ) : (
        <>
          {loadError && <LoadError message={loadError} onRetry={() => void reload()} />}
          {banks.length === 0 ? (
            <EmptyState
              icon={<AccountBalanceRounded sx={{ fontSize: 40 }} />}
              title="ยังไม่มีธนาคารที่รองรับ"
              description="เพิ่มข้อมูลผู้ส่งและรูปแบบ statement เพื่อให้ระบบตรวจสอบและนำเข้าไฟล์ได้ถูกต้อง"
              action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm(null, EMPTY)}>เพิ่มธนาคารแรก</Button>}
            />
          ) : (
            // < md เหลือคอลัมน์เดียว: ชื่อ ตัวแกะ อีเมลผู้ส่ง แล้วสวิตช์ + ปุ่มเป็นบรรทัดล่าง (ท่าเดียวกับตารางผู้ใช้ — ที่ 320px
            // สวิตช์ + สองปุ่มข้างชื่อเหลือที่ให้ชื่อราว 70px) หัวข้ออีเมล (regex ยาว) ดูในฟอร์มแก้ไข
            // ไม่มี minWidth จึงไม่ล้นกล่อง ไม่ใส่ tabIndex (ไม่มีอะไรให้เลื่อน)
            <TableContainer component={Paper} variant="outlined" role="region" aria-label="ตารางธนาคารที่รองรับ" sx={{ mt: 3, position: 'relative' }}>
              <Table size="small" aria-label="ธนาคารที่รองรับ">
                <TableHead>
                  <TableRow>
                    <TableCell>ธนาคาร</TableCell>
                    <TableCell sx={MD_UP}>ผู้ส่ง</TableCell>
                    <TableCell sx={MD_UP}>หัวข้ออีเมล</TableCell>
                    <TableCell sx={MD_UP}>ใช้งาน</TableCell>
                    <TableCell align="right" sx={MD_UP}>จัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {banks.map((bank) => (
                    <TableRow key={bank.id} hover>
                      <TableCell sx={NAME_CELL}>
                        {bank.name}
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          ตัวแกะ <code>{bank.parser_key}</code>{SEP}<Box component="span" sx={dataTextSx}>{bank.account_count.toLocaleString('th-TH')}</Box> บัญชี
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ ...BELOW_MD, ...dataTextSx }}>{bank.sender_email}</Typography>
                        <Stack direction="row" sx={{ ...BELOW_MD, mt: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                          {/* label ที่ตาเห็นแทนหัวคอลัมน์ที่ซ่อน · ชื่อที่ screen reader อ่านยังเป็น aria-label "ใช้งาน <ธนาคาร>" */}
                          <FormControlLabel control={activeSwitch(bank, 'medium')} label="ใช้งาน" sx={{ ml: 0 }} />
                          {rowActions(bank)}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ ...MD_UP, overflowWrap: 'anywhere' }}>
                        <Box sx={dataTextSx}>{bank.sender_email}</Box>
                        <Typography variant="body2" color="text.secondary" sx={dataTextSx}>DKIM {bank.sender_domain}</Typography>
                      </TableCell>
                      <TableCell sx={MD_UP}>
                        <Typography variant="body2" color="text.secondary">รายเดือน <code>{bank.subject_monthly}</code></Typography>
                        <Typography variant="body2" color="text.secondary">ขอเอง <code>{bank.subject_ondemand}</code></Typography>
                      </TableCell>
                      <TableCell sx={MD_UP}>{activeSwitch(bank)}</TableCell>
                      <TableCell align="right" sx={{ ...MD_UP, py: 0.5 }}>{rowActions(bank)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        // ชื่อจากค่าตอนเปิด ไม่เปลี่ยนตามช่องชื่อที่กำลังพิมพ์
        title={editingId ? `แก้ไขธนาคาร “${formInitial.name}”` : 'เพิ่มธนาคาร'}
        onClose={() => {
          setModalOpen(false);
          setFormError('');
        }}
        busy={submitting}
        dirty={JSON.stringify(form) !== JSON.stringify(formInitial)}
        footer={{ formId: 'bank-form', submitLabel: editingId ? 'บันทึกการแก้ไข' : 'เพิ่มธนาคาร' }}
        onExited={flushNotice}
      >
        {/* noValidate: ช่องบังคับตรวจเองใน saveBank (error ไทยใต้ช่อง) — `required` คงไว้เพื่อ * และ aria-required */}
        <Box
          component="form"
          id="bank-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!submitting) void saveBank();
          }}
        >
          <Stack spacing={2.5}>
            {formError && <Alert ref={revealOnMount} severity="error">{formError}</Alert>}
            {parserKeys == null && parserKeysError && <LoadError message={parserKeysError} onRetry={() => void loadParserKeys()} />}
            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1.5, color: 'text.primary', fontWeight: 600 }}>ข้อมูลธนาคาร</FormLabel>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
                <TextField
                  id={FIELD_ID.name}
                  label="ชื่อธนาคาร"
                  error={fieldErrors.name != null}
                  helperText={fieldErrors.name ?? 'ชื่อที่ผู้ใช้เห็นตอนเลือกธนาคารของบัญชี'}
                  value={form.name}
                  onChange={setFormField('name')}
                  required
                  autoFocus
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                />
                <TextField
                  select
                  label="ตัวแกะข้อมูล"
                  error={fieldErrors.parser_key != null}
                  helperText={fieldErrors.parser_key ?? 'ตัวอ่าน PDF ที่ตรงกับรูปแบบ statement ของธนาคารนี้'}
                  value={form.parser_key}
                  onChange={setFormField('parser_key')}
                  required
                  slotProps={{ select: { SelectDisplayProps: { id: FIELD_ID.parser_key } } }}
                >
                  <MenuItem value=""><em>— เลือก —</em></MenuItem>
                  {parserOptions.map((key) => <MenuItem key={key} value={key}><code>{key}</code></MenuItem>)}
                </TextField>
              </Box>
            </Box>
            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1.5, color: 'text.primary', fontWeight: 600 }}>การยืนยันผู้ส่ง</FormLabel>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
                <TextField
                  id={FIELD_ID.sender_email}
                  label="อีเมลผู้ส่งของธนาคาร"
                  error={fieldErrors.sender_email != null}
                  helperText={fieldErrors.sender_email ?? 'อีเมล From ที่ธนาคารใช้ส่ง statement'}
                  value={form.sender_email}
                  onChange={setFormField('sender_email')}
                  required
                  placeholder="scbeasynet@scb.co.th"
                  slotProps={{ htmlInput: { maxLength: 200, inputMode: 'email', autoCapitalize: 'off', spellCheck: false } }}
                />
                <TextField
                  id={FIELD_ID.sender_domain}
                  label="โดเมนผู้ส่ง (ตรวจ DKIM)"
                  error={fieldErrors.sender_domain != null}
                  helperText={fieldErrors.sender_domain ?? 'ระบบรับเฉพาะอีเมลที่ลายเซ็น DKIM ของโดเมนนี้ผ่าน กันอีเมลปลอม'}
                  value={form.sender_domain}
                  onChange={setFormField('sender_domain')}
                  required
                  placeholder="scb.co.th"
                  slotProps={{ htmlInput: { maxLength: 200, autoCapitalize: 'off', spellCheck: false } }}
                />
              </Box>
            </Box>
            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 600 }}>รูปแบบการจับคู่ (regex)</FormLabel>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, ...descriptionSx }}>
                <code>^</code> = ขึ้นต้นด้วย · <code>$</code> = ลงท้ายด้วย · <code>\.</code> = จุดจริง ๆ · <code>\d</code> = ตัวเลข — ตัวพิมพ์เล็ก/ใหญ่ต้องตรง
              </Typography>
              <Stack spacing={2}>
                {/* ช่องลองอยู่บนสุด ผลเป็น helper ของช่องเอง (เห็นโดยไม่ต้องเลื่อน) — ตรง = success ไม่ตรง = warning พร้อมไอคอน
                    Enter ไม่บันทึกฟอร์ม (ช่องนี้ไม่ถูกบันทึก — กด Enter หลังวางมักเป็นการ "ลอง" ไม่ใช่ "บันทึก") */}
                <TextField
                  label="ลองกับหัวข้ออีเมลหรือชื่อไฟล์ตัวอย่าง"
                  value={sample}
                  onChange={(event) => {
                    setSample(event.target.value);
                    setSampleStatus(event.target.value === '' ? '' : sampleResult(form, event.target.value).text);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
                  }}
                  placeholder="ตัวอย่างจาก SCB: SCB E PASSBOOK: e-Statement"
                  helperText={
                    <Box component="span" sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', overflowWrap: 'anywhere' }}>
                      {sampleCheck.matched === true && <CheckCircleRounded aria-hidden sx={{ fontSize: '1.125rem' }} />}
                      {sampleCheck.matched === false && <WarningAmberRounded aria-hidden sx={{ fontSize: '1.125rem' }} />}
                      {sampleCheck.text}
                    </Box>
                  }
                  slotProps={{
                    htmlInput: { autoCapitalize: 'off', spellCheck: false },
                    formHelperText: {
                      sx: { color: sampleCheck.matched === true ? 'success.main' : sampleCheck.matched === false ? 'warning.main' : undefined },
                    },
                  }}
                />
                {REGEX_FIELDS.map(({ key, label, helper, placeholder }) => (
                  // mono ให้แยก \ . [ ] ออกจากกัน · multiline ยืดตามความยาวให้เห็นทั้งสาย (regex ยังเป็นบรรทัดเดียว — setRegexField)
                  <TextField
                    key={key}
                    id={FIELD_ID[key]}
                    label={label}
                    error={fieldErrors[key] != null}
                    helperText={fieldErrors[key] ?? helper}
                    value={form[key]}
                    onChange={setRegexField(key)}
                    onKeyDown={submitOnEnter}
                    required
                    multiline
                    placeholder={placeholder}
                    slotProps={{
                      input: { sx: { fontFamily: fontFamilies.mono } },
                      htmlInput: { maxLength: 500, autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false },
                    }}
                  />
                ))}
              </Stack>
              {/* ประกาศผลเฉพาะตอนช่องตัวอย่างเปลี่ยน — ผลล่าสุดหลังแก้ช่องรูปแบบอ่านได้จาก helper ของช่องตัวอย่าง (aria-describedby) */}
              <Box role="status" sx={visuallyHiddenSx}>{sampleStatus}</Box>
            </Box>
          </Stack>
        </Box>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="ลบธนาคาร"
        description={
          <Stack spacing={1.5}>
            <Typography sx={descriptionSx}>
              {/* ลบไม่สำเร็จ (เช่น 409 มีบัญชีผูกเพิ่มระหว่างนั้น) = ไม่ยืนยันว่ายังไม่มีบัญชีผูก — error ด้านล่างบอกเหตุผลเอง */}
              ลบธนาคาร “{deleting?.name}” หรือไม่? {!deleteError && 'ยังไม่มีบัญชีใดผูกกับธนาคารนี้ '}ลบแล้วกู้คืนไม่ได้ ถ้าจะใช้อีกต้องเพิ่มและกรอกรูปแบบใหม่ทั้งหมด
            </Typography>
            {deleteError && <Alert severity="error">{deleteError}</Alert>}
          </Stack>
        }
        confirmLabel="ลบธนาคาร"
        confirmColor="error"
        busy={submitting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void deleteBank()}
        onExited={() => {
          // แถวที่ลบหายไปพร้อมปุ่มต้นทาง — focus ไปปุ่ม "เพิ่มธนาคาร"
          if (focusAddAfterExitRef.current) addButtonRef.current?.focus();
          focusAddAfterExitRef.current = false;
          flushNotice();
        }}
      />
      {/* ข้อเท็จจริงจาก src/worker.ts (หยิบเฉพาะธนาคารที่เปิดใช้งาน) และ src/routes/banks.ts (เปิดกลับ = อ่านอีเมลย้อนหลังใหม่
          ของกล่องที่มีบัญชีของธนาคารนี้) · account_count นับรวมบัญชีที่เก็บเข้าคลัง จึงบอกไว้ในวงเล็บ */}
      <ConfirmDialog
        open={disableOpen}
        title="ปิดใช้งานธนาคาร"
        description={
          <Stack spacing={1.5}>
            <Typography sx={descriptionSx}>
              ปิดใช้งาน “{disabling?.name}” หรือไม่? มีบัญชีของสมาชิกผูกกับธนาคารนี้{' '}
              <Box component="span" sx={dataTextSx}>{disabling?.account_count.toLocaleString('th-TH')}</Box> บัญชี (รวมที่เก็บเข้าคลัง)
              ระบบจะหยุดรับ statement ใหม่ของบัญชีเหล่านี้จนกว่าจะเปิดใช้งานกลับ เมื่อเปิดกลับ ระบบอ่านอีเมลย้อนหลังใหม่ให้เอง
            </Typography>
            {disableError && <Alert severity="error">{disableError}</Alert>}
          </Stack>
        }
        confirmLabel="ปิดใช้งาน"
        confirmColor="warning"
        busy={submitting}
        onClose={() => setDisableOpen(false)}
        onConfirm={() => void disableBank()}
        onExited={flushNotice}
      />
      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
    </Box>
  );
}

const STATUS_LABEL: Record<User['status'], string> = { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ปฏิเสธแล้ว' };
const roleLabel = (isAdmin: boolean) => (isAdmin ? 'ผู้ดูแล' : 'ผู้ใช้ทั่วไป');

// การเปลี่ยนที่ทำให้ผู้ใช้ใช้งานไม่ได้ (ปฏิเสธ, อนุมัติแล้ว → รออนุมัติ) และการเปลี่ยนบทบาทถามก่อนเสมอ
type PendingUserAction =
  | { kind: 'status'; user: User; status: 'pending' | 'rejected' }
  | { kind: 'role'; user: User; isAdmin: boolean };

function actionCopy(action: PendingUserAction | null) {
  if (!action) return { title: '', description: '', confirmLabel: '', color: 'primary' as const };
  const who = `${action.user.display_name || action.user.email} (${action.user.email})`;
  if (action.kind === 'role') {
    const to = roleLabel(action.isAdmin);
    return {
      title: 'เปลี่ยนบทบาทผู้ใช้',
      description: `เปลี่ยนบทบาทของ ${who} เป็น “${to}” หรือไม่? ${action.isAdmin
        ? 'ผู้ดูแลเข้าหน้าตั้งค่านี้ได้ ซึ่งมีผลกับทุกคนในระบบ'
        : 'ผู้ใช้นี้จะเข้าหน้าตั้งค่าไม่ได้อีก'}`,
      confirmLabel: `เปลี่ยนเป็น${to}`,
      color: 'primary' as const,
    };
  }
  // ข้อเท็จจริงจาก src/auth.ts (ตรวจสถานะทุกคำขอ) และ src/routes/admin.ts (ปฏิเสธ = ขอ Google revoke token ของทุกกล่อง ไม่ลบแถวใด)
  if (action.status === 'rejected') {
    return {
      title: 'ปฏิเสธผู้ใช้',
      description: `ปฏิเสธ ${who} หรือไม่? ${action.user.status === 'approved' ? 'ผู้ใช้นี้จะใช้งานระบบไม่ได้ทันที' : 'ผู้ใช้นี้จะเข้าใช้งานไม่ได้'} และระบบจะขอ Google ยกเลิกสิทธิ์อ่าน Gmail ของทุกกล่องที่ผู้ใช้นี้เชื่อมไว้ ถ้าอนุมัติภายหลังผู้ใช้ต้องเชื่อม Gmail ใหม่ ข้อมูลเดิมไม่ถูกลบ`,
      confirmLabel: 'ปฏิเสธผู้ใช้',
      color: 'error' as const,
    };
  }
  return {
    title: 'เปลี่ยนเป็นรออนุมัติ',
    description: `เปลี่ยน ${who} กลับเป็นรออนุมัติหรือไม่? ผู้ใช้นี้จะใช้งานระบบไม่ได้ทันทีจนกว่าจะอนุมัติอีกครั้ง ข้อมูลเดิมไม่ถูกลบ`,
    confirmLabel: 'เปลี่ยนเป็นรออนุมัติ',
    color: 'warning' as const,
  };
}

// รออนุมัติขึ้นบนสุด (งานที่ต้องจัดการ) — sort ของ JS เสถียร ที่เหลือคงลำดับวันที่สมัครจาก server
const pendingFirst = (rows: User[]) => [...rows].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));

function Users({ currentUserId, onUsersChanged }: { currentUserId: number; onUsersChanged: () => void }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  // ค้างไว้จน dialog ปิดสนิท — ข้อความในคำถามไม่ว่างระหว่าง fade ออก
  const [pendingAction, setPendingAction] = useState<PendingUserAction | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeAfterCloseRef = useRef<Notice | null>(null);

  const reload = async () => {
    setLoadError('');
    try {
      setUsers(pendingFirst(await req<User[]>('/api/admin/users')));
      // คนที่สมัครหลังโหลดแอปขึ้นในตารางแล้ว — ตัวนับบนเมนู/แท็บต้องตามด้วย
      onUsersChanged();
    } catch (e) {
      setLoadError(errorText(e, 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ'));
    }
  };
  useEffect(() => { void reload(); }, []);

  // แก้แถวในที่เดิม ไม่โหลดใหม่ — ลำดับไม่กระโดดใต้ select ที่ถือ focus อยู่ (รออนุมัติขึ้นบนเฉพาะตอนเปิดหน้า)
  // แล้วให้ App โหลดตัวนับรออนุมัติบนเมนูใหม่
  const updateUser = async (user: User, body: { status?: User['status']; is_admin?: boolean }) => {
    setUpdatingUserId(user.id);
    try {
      const saved = await patch<Pick<User, 'id' | 'status' | 'is_admin'>>(`/api/admin/users/${user.id}`, body);
      setUsers((rows) => rows && rows.map((u) => (u.id === user.id ? { ...u, status: saved.status, is_admin: saved.is_admin } : u)));
      onUsersChanged();
    } finally {
      setUpdatingUserId(null);
    }
  };

  const changeStatus = async (user: User, status: User['status']) => {
    if (status === user.status) return;
    if (status === 'rejected' || (status === 'pending' && user.status === 'approved')) {
      setActionError('');
      setPendingAction({ kind: 'status', user, status });
      setActionOpen(true);
      return;
    }
    // อนุมัติ หรือ ปฏิเสธแล้ว → รออนุมัติ (ยังใช้งานไม่ได้เหมือนเดิม) ไม่ต้องถาม
    try {
      await updateUser(user, { status });
      setNotice({ message: `${status === 'approved' ? 'อนุมัติ' : 'เปลี่ยนเป็นรออนุมัติ'} ${user.display_name || user.email} แล้ว`, severity: 'success' });
    } catch (e) {
      setNotice({ message: errorText(e, 'บันทึกข้อมูลผู้ใช้ไม่สำเร็จ'), severity: 'error' });
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    const { user } = pendingAction;
    setActionError('');
    try {
      if (pendingAction.kind === 'role') {
        await updateUser(user, { is_admin: pendingAction.isAdmin });
        noticeAfterCloseRef.current = { message: `เปลี่ยนบทบาทของ ${user.display_name || user.email} เป็น${roleLabel(pendingAction.isAdmin)}แล้ว`, severity: 'success' };
      } else {
        await updateUser(user, { status: pendingAction.status });
        noticeAfterCloseRef.current = {
          message: `${pendingAction.status === 'rejected' ? 'ปฏิเสธ' : 'เปลี่ยนเป็นรออนุมัติ'} ${user.display_name || user.email} แล้ว`,
          severity: 'success',
        };
      }
      setActionOpen(false);
    } catch (e) {
      setActionError(errorText(e, 'บันทึกข้อมูลผู้ใช้ไม่สำเร็จ'));
    }
  };

  // select ไม่มี label ที่ตาเห็น (หัวคอลัมน์บอกแล้ว) — ชื่อที่ screen reader อ่านต้องอยู่ที่ตัว combobox (htmlInput → SelectInput)
  // ไม่ใช่ที่ TextField ซึ่งไปตกที่ div ครอบ · แถวที่กำลังบันทึกเป็น readOnly (เปิดเมนูไม่ได้ focus ไม่หลุด) แถวอื่นยังใช้ได้
  const statusSelect = (user: User) => (
    <TextField
      select
      size="small"
      value={user.status}
      onChange={(event) => void changeStatus(user, event.target.value as User['status'])}
      slotProps={{ htmlInput: { 'aria-label': `สถานะของ ${user.display_name || user.email}`, readOnly: updatingUserId === user.id } }}
      sx={{ minWidth: 140 }}
    >
      {(Object.keys(STATUS_LABEL) as User['status'][]).map((status) => <MenuItem key={status} value={status}>{STATUS_LABEL[status]}</MenuItem>)}
    </TextField>
  );
  const roleSelect = (user: User) => (
    <TextField
      select
      size="small"
      value={user.is_admin ? 'admin' : 'user'}
      onChange={(event) => {
        setActionError('');
        setPendingAction({ kind: 'role', user, isAdmin: event.target.value === 'admin' });
        setActionOpen(true);
      }}
      slotProps={{ htmlInput: { 'aria-label': `บทบาทของ ${user.display_name || user.email}`, readOnly: updatingUserId === user.id } }}
      sx={{ minWidth: 140 }}
    >
      <MenuItem value="user">ผู้ใช้ทั่วไป</MenuItem>
      <MenuItem value="admin">ผู้ดูแล</MenuItem>
    </TextField>
  );
  // แถวของตัวเอง: server ไม่ให้เปลี่ยน (src/routes/admin.ts) — แสดงค่าเป็นข้อความพร้อมเหตุผล ไม่ใช่ select ที่กดไม่ได้
  const selfNote = <Typography variant="body2" color="text.secondary">เปลี่ยนสิทธิ์ของตัวเองไม่ได้</Typography>;

  const copy = actionCopy(pendingAction);

  return (
    <Box sx={{ mt: 4 }}>
      <PageHeader title="ผู้ใช้งาน" description="อนุมัติคนที่เข้าสู่ระบบด้วย Google และกำหนดผู้ดูแล — คนที่รออนุมัติอยู่บนสุด" />
      {users == null ? (
        loadError ? <LoadError message={loadError} onRetry={() => void reload()} /> : <TableSkeleton />
      ) : (
        <>
          {loadError && <LoadError message={loadError} onRetry={() => void reload()} />}
          {users.length === 0 ? (
            <EmptyState
              icon={<GroupRounded sx={{ fontSize: 40 }} />}
              title="ยังไม่มีผู้ใช้งาน"
              description="สมาชิกจะปรากฏที่นี่หลังจากเข้าสู่ระบบด้วย Google รอให้แอดมินอนุมัติ"
            />
          ) : (
            // < md เหลือคอลัมน์เดียว: ชื่อ อีเมล แล้ว select สถานะ/บทบาทใต้กัน (ที่ 320px สอง select ข้างชื่อไม่พอ)
            <TableContainer component={Paper} variant="outlined" role="region" aria-label="ตารางผู้ใช้งาน" sx={{ mt: 3, position: 'relative' }}>
              <Table size="small" aria-label="ผู้ใช้งาน">
                <TableHead>
                  <TableRow>
                    <TableCell>ผู้ใช้</TableCell>
                    <TableCell sx={MD_UP}>สถานะ</TableCell>
                    <TableCell sx={MD_UP}>บทบาท</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => {
                    const isSelf = user.id === currentUserId;
                    return (
                      <TableRow key={user.id} hover>
                        <TableCell sx={NAME_CELL}>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <span>{user.display_name || user.email}</span>
                            {isSelf && <Chip size="small" color="primary" label="คุณ" />}
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={dataTextSx}>{user.email}</Typography>
                          <Stack spacing={1} sx={{ ...BELOW_MD, mt: 1, alignItems: 'flex-start' }}>
                            {isSelf ? (
                              <>
                                <Typography variant="body2">{STATUS_LABEL[user.status]}{SEP}{roleLabel(user.is_admin)}</Typography>
                                {selfNote}
                              </>
                            ) : (
                              <>
                                {statusSelect(user)}
                                {roleSelect(user)}
                              </>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell sx={MD_UP}>{isSelf ? STATUS_LABEL[user.status] : statusSelect(user)}</TableCell>
                        <TableCell sx={MD_UP}>
                          {isSelf ? <>{roleLabel(user.is_admin)}{selfNote}</> : roleSelect(user)}
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
      <ConfirmDialog
        open={actionOpen}
        title={copy.title}
        description={
          <Stack spacing={1.5}>
            <Typography sx={descriptionSx}>{copy.description}</Typography>
            {actionError && <Alert severity="error">{actionError}</Alert>}
          </Stack>
        }
        confirmLabel={copy.confirmLabel}
        confirmColor={copy.color}
        busy={updatingUserId !== null}
        onClose={() => setActionOpen(false)}
        onConfirm={() => void confirmAction()}
        onExited={() => {
          if (noticeAfterCloseRef.current) setNotice(noticeAfterCloseRef.current);
          noticeAfterCloseRef.current = null;
        }}
      />
      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
    </Box>
  );
}

type SettingsTab = 'banks' | 'users';

/**
 * หน้าตั้งค่า (แอดมินเท่านั้น — App.tsx ไม่ route ให้คนอื่น) โหลดแบบ lazy ผู้ใช้ทั่วไปไม่ต้องโหลดโค้ดนี้
 * แท็บอยู่ใน `?tab=` (replace — สลับแท็บไม่เพิ่มประวัติ) ค่าอื่นนอกจาก users = ธนาคาร
 * บันทึกระบบของทุกคนอยู่ที่ `/audit?scope=all` (หน้าเดียวกับประวัติของตัวเอง) — หน้านี้มีแค่ลิงก์ไป
 */
export default function SettingsPage({ userId, pendingUserCount, onUsersChanged }: {
  userId: number;
  pendingUserCount: number;
  onUsersChanged: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: SettingsTab = searchParams.get('tab') === 'users' ? 'users' : 'banks';
  return (
    <Box component="section" aria-labelledby="settings-heading">
      <PageHeader
        level={1}
        id="settings-heading"
        title="ตั้งค่า"
        description="เห็นเฉพาะแอดมิน — ทุกอย่างที่แก้ที่นี่มีผลกับทุกคน"
        action={
          <Button variant="outlined" component={Link} to="/audit?scope=all" startIcon={<HistoryRounded />} sx={{ whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
            ดูบันทึกระบบของทุกคน
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={(_, value: SettingsTab) => setSearchParams({ tab: value }, { replace: true })}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="เมนูตั้งค่า"
        sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {/* aria-controls เฉพาะแท็บที่เลือก — panel ของแท็บอื่นไม่ได้ render (IDREF ที่ชี้ไปไม่เจอผิด ARIA) */}
        <Tab value="banks" id="settings-tab-banks" aria-controls={tab === 'banks' ? 'settings-panel' : undefined} label="ธนาคาร" />
        <Tab
          value="users"
          id="settings-tab-users"
          aria-controls={tab === 'users' ? 'settings-panel' : undefined}
          label={
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              ผู้ใช้
              {/* ตัวนับรออนุมัติ (The Issue Count Rule: warning) — ตัวเลขซ่อนจาก screen reader อ่านเป็นประโยคแทน */}
              {pendingUserCount > 0 && (
                <>
                  <Badge
                    badgeContent={pendingUserCount}
                    max={99}
                    color="warning"
                    slotProps={{ badge: { 'aria-hidden': true } }}
                    sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none' } }}
                  />
                  <Box component="span" sx={visuallyHiddenSx}>รออนุมัติ {pendingUserCount} คน</Box>
                </>
              )}
            </Box>
          }
        />
      </Tabs>
      <Box role="tabpanel" id="settings-panel" aria-labelledby={`settings-tab-${tab}`}>
        {tab === 'banks' ? <Banks /> : <Users currentUserId={userId} onUsersChanged={onUsersChanged} />}
      </Box>
    </Box>
  );
}
