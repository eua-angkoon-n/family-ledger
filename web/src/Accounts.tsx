import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import LinkOffRounded from '@mui/icons-material/LinkOffRounded';
import MailOutlineRounded from '@mui/icons-material/MailOutlineRounded';
import SyncRounded from '@mui/icons-material/SyncRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import { del, patch, post, req, type Account, type AccountSaveResponse, type Bank, type EmailAccount, type SyncSummary, type TaxEntity, type TaxEntityType } from './api.js';
import { TAX_PAGES_ENABLED } from './features.js';
import { createFormFieldChangeHandler } from './form.js';
import { formatDateTime } from './format.js';
import Modal from './Modal.js';
import { TAX_ENTITY_TYPE_LABEL } from './taxDocumentLabels.js';
import { dataTextSx, descriptionSx } from './theme.js';
import { BELOW_MD, ConfirmDialog, EmptyState, FeedbackSnackbar, LoadError, MD_UP, PageHeader, RowIconButton, TableSkeleton, useHashTarget, type Notice } from './ui.js';

const EMPTY = {
  bank_id: '', email_account_id: '', nickname: '', account_number: '', pdf_password: '', promptpay_id: '',
  default_tax_entity_id: '',
};

const EMPTY_ENTITY = { entity_type: 'individual' as TaxEntityType, display_name: '', tax_id: '', vat_registered: false };

type Resource = 'accounts' | 'banks' | 'mailboxes' | 'taxEntities';
const LOAD_FAILED: Record<Resource, string> = {
  accounts: 'โหลดรายชื่อบัญชีไม่สำเร็จ',
  banks: 'โหลดรายชื่อธนาคารไม่สำเร็จ',
  mailboxes: 'โหลดกล่องอีเมลไม่สำเร็จ',
  taxEntities: 'โหลดรายชื่อผู้เสียภาษีไม่สำเร็จ',
};
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

// < md คอลัมน์ชื่อกินที่ที่เหลือแล้วตัดบรรทัด (maxWidth 0 กันดันตารางเกินกล่อง) — ท่าเดียวกับหน้าวางแผน
const NAME_CELL = { width: { xs: '100%', md: 'auto' }, maxWidth: { xs: 0, md: 'none' }, overflowWrap: 'anywhere' } as const;
// ตัวคั่นที่ตาเห็นเท่านั้น — screen reader ไม่ต้องอ่าน "จุด"
const SEP = <Box component="span" aria-hidden>{' · '}</Box>;
// error ของฟอร์มอยู่บนสุด แต่บนมือถือคนที่เลื่อนลงไปกรอกช่องล่าง ๆ แล้วกดบันทึก (ปุ่มอยู่นอกส่วนที่เลื่อน) มองไม่เห็น — เลื่อนมาให้เห็น
// ตอนเพิ่งขึ้น · ฟังก์ชันระดับไฟล์ (ref คงที่) React จึงเรียกเฉพาะตอน mount ไม่ใช่ทุก render ระหว่างพิมพ์
const revealOnMount = (el: HTMLElement | null) => el?.scrollIntoView({ block: 'nearest' });
const accountEditId = (id: number) => `account-edit-${id}`;
// ฟอร์มบัญชีเป็น noValidate แล้วตรวจช่องบังคับเองทุกช่อง (error ไทยใต้ช่อง ไม่มีบับเบิลของเบราว์เซอร์ปน ช่องว่างล้วนนับเป็นว่าง)
// id เรียงตามลำดับในฟอร์ม ช่องแรกที่ผิดรับ focus · select ใส่ id ที่ตัว combobox (SelectDisplayProps) — id ของ TextField select
// ไปตกที่ input ที่ซ่อนอยู่ ซึ่ง focus แล้วไม่เห็นอะไร
const FIELD_ID = {
  bank_id: 'account-bank',
  email_account_id: 'account-mailbox',
  account_number: 'account-number',
  pdf_password: 'account-pdf-password',
  nickname: 'account-nickname',
} as const;
type Field = keyof typeof FIELD_ID;
// ข้อความของ server เรื่องเลขบัญชี (src/routes/accounts.ts: 400 / 409) — req() ให้มาแค่ข้อความ ไม่มี status จึงจับจากข้อความ
// แก้ฝั่งใดต้องแก้อีกฝั่งด้วย ไม่งั้นตกไปเป็น Alert บนสุดแทน error ของช่อง
const NUMBER_NOT_DIGITS = 'เลขที่บัญชีต้องเป็นตัวเลข';
const NUMBER_TAKEN = 'มีบัญชีเลขนี้อยู่แล้ว';
const digitsOnly = (value: string) => value.replace(/\D/g, '');

/** error ของแต่ละช่อง — key เรียงตามฟอร์ม key แรกคือช่องที่รับ focus */
function accountFormErrors(f: typeof EMPTY, passwordRequired: boolean): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (f.bank_id === '') errors.bank_id = 'เลือกธนาคาร';
  if (f.email_account_id === '') errors.email_account_id = 'เลือกกล่องอีเมล';
  // ขีด/ช่องว่างแบบที่แอปธนาคารแสดงพิมพ์มาได้ ส่งไปเป็นตัวเลขล้วน (server เก็บแบบนั้น)
  const number = f.account_number.trim();
  if (number === '') errors.account_number = 'กรอกเลขที่บัญชี';
  else if (!/^\d+$/.test(number.replace(/[\s-]/g, ''))) errors.account_number = NUMBER_NOT_DIGITS;
  if (passwordRequired && f.pdf_password.trim() === '') errors.pdf_password = 'กรอกรหัสผ่านเปิดไฟล์ statement';
  if (f.nickname.trim() === '') errors.nickname = 'กรอกชื่อเล่น';
  return errors;
}

/**
 * The Section Failure Rule: ยังไม่เคยโหลดได้ = skeleton หรือ LoadError แทนที่ส่วนนั้น (ไม่ใช่ EmptyState)
 * โหลดซ้ำแบบ background ไม่สำเร็จ = LoadError เหนือข้อมูลเดิม ตารางไม่ re-mount focus จึงไม่หาย
 */
function Loaded<T>({ data, error, onRetry, rows, children }: {
  data: T | null; error?: string; onRetry: () => void; rows?: number; children: (data: T) => ReactNode;
}) {
  if (data == null) return error ? <LoadError message={error} onRetry={onRetry} /> : <TableSkeleton rows={rows} />;
  return <>{error && <LoadError message={error} onRetry={onRetry} />}{children(data)}</>;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [mailboxes, setMailboxes] = useState<EmailAccount[] | null>(null);
  const [taxEntities, setTaxEntities] = useState<TaxEntity[] | null>(null);
  const [loadErrors, setLoadErrors] = useState<Partial<Record<Resource, string>>>({});
  const [form, setForm] = useState(EMPTY);
  // ค่าตอนเปิดฟอร์ม — ต่างจากนี้ = มีการแก้ค้าง Modal ถามก่อนปิด (The Unsaved Modal Rule)
  const [formInitial, setFormInitial] = useState(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  // กดบันทึกแล้วอย่างน้อยครั้งหนึ่ง — ช่องที่ผิดขึ้น error ของช่องนั้นตั้งแต่ตอนนี้ และหายเองเมื่อแก้ถูก
  const [attempted, setAttempted] = useState(false);
  // เลขบัญชีที่ server ปฏิเสธ (ซ้ำ / ไม่ใช่ตัวเลข) — error ค้างที่ช่องเลขบัญชีจนกว่าเลขในช่องจะเปลี่ยน
  const [rejectedNumber, setRejectedNumber] = useState<{ digits: string; message: string } | null>(null);
  // บัญชีที่ถามค้างไว้จน dialog ปิดสนิท — ไม่งั้นชื่อในคำถามว่างเป็น “” ระหว่าง fade ออก
  const [archiving, setArchiving] = useState<Account | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [syncing, setSyncing] = useState<ReadonlySet<number>>(new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  // ผลทุกอย่างผ่าน `announce` เข้าคิวนี้แล้วขึ้นทีละอันตามลำดับ — ผลดึงอีเมลที่มาระหว่างฟอร์มเปิดไม่ถูกผลบันทึกทับ (เคยเก็บช่องเดียว)
  const queueRef = useRef<Notice[]>([]);
  // snackbar อยู่บนจอ (จนถึง onExited ของมัน)
  const showingRef = useRef(false);
  // dialog ใด ๆ ของหน้าเปิดอยู่ (จนถึง onExited) — `#root` เป็น aria-hidden จนปิดสนิท ผลจึงรอในคิว (เหมือนหน้าแผนผ่อน)
  const dialogOpenRef = useRef(false);
  // เปิดฟอร์มแก้ไขจากลิงก์ `?edit=` (ไฟล์ที่เปิดไม่ได้บนแดชบอร์ด) — focus ช่องรหัสผ่าน PDF แทนช่องแรก
  const [focusPassword, setFocusPassword] = useState(false);
  const navigate = useNavigate();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // แถวที่เก็บเข้าคลังหายไปพร้อมปุ่มต้นทาง — หลัง dialog ปิดสนิทส่ง focus ไปปุ่ม "เพิ่มบัญชี"
  const focusAddAfterExitRef = useRef(false);
  // ดึงอีเมลแล้วเจอว่าต้องเชื่อม Gmail ใหม่ — ปุ่มดึงที่ถือ focus หายไป ปุ่ม "เชื่อม Gmail ใหม่" ของกล่องนั้นรับ focus แทน
  const focusReconnectRef = useRef<number | null>(null);

  const [entityForm, setEntityForm] = useState(EMPTY_ENTITY);
  const [entityInitial, setEntityInitial] = useState(EMPTY_ENTITY);
  const [entityEditingId, setEntityEditingId] = useState<number | null>(null);
  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const [entitySubmitting, setEntitySubmitting] = useState(false);
  const [entityError, setEntityError] = useState('');
  const addEntityButtonRef = useRef<HTMLButtonElement>(null);

  // ข้อมูลที่โหลดได้แล้วคงไว้ระหว่างโหลดซ้ำ (หลังบันทึก/ลองใหม่) — skeleton ขึ้นเฉพาะส่วนที่ยังไม่เคยโหลดได้
  const reload = async () => {
    setLoadErrors({});
    const [accountsResult, banksResult, mailboxesResult, entitiesResult] = await Promise.allSettled([
      req<Account[]>('/api/accounts'),
      req<Bank[]>('/api/banks'),
      req<EmailAccount[]>('/api/email-accounts'),
      // หน้าภาษีปิด = ไม่มีส่วนผู้เสียภาษีในหน้านี้ ไม่ต้องโหลด (เหมือนหน้าธุรกรรม)
      TAX_PAGES_ENABLED ? req<TaxEntity[]>('/api/tax-entities') : Promise.resolve([]),
    ]);
    const errors: Partial<Record<Resource, string>> = {};
    if (accountsResult.status === 'fulfilled') setAccounts(accountsResult.value);
    else errors.accounts = errorText(accountsResult.reason, LOAD_FAILED.accounts);
    if (banksResult.status === 'fulfilled') setBanks(banksResult.value);
    else errors.banks = errorText(banksResult.reason, LOAD_FAILED.banks);
    if (mailboxesResult.status === 'fulfilled') setMailboxes(mailboxesResult.value);
    else errors.mailboxes = errorText(mailboxesResult.reason, LOAD_FAILED.mailboxes);
    if (entitiesResult.status === 'fulfilled') setTaxEntities(entitiesResult.value);
    else errors.taxEntities = errorText(entitiesResult.reason, LOAD_FAILED.taxEntities);
    setLoadErrors(errors);
  };
  useEffect(() => { void reload(); }, []);
  const retry = () => void reload();

  // มีผลรอ + อันเดิมค้างบนจอ = ปิดอันเดิมก่อน (ผลใหม่สำคัญกว่า เหมือนก่อนมีคิว) อันถัดไปขึ้นหลังปิดสนิท — สลับข้อความตอนเปิดค้าง
  // ไม่ได้ (FeedbackSnackbar onExited)
  const pumpNotice = () => {
    if (dialogOpenRef.current || queueRef.current.length === 0) return;
    if (showingRef.current) {
      setNotice(null);
      return;
    }
    showingRef.current = true;
    setNotice(queueRef.current.shift()!);
  };
  const announce = (next: Notice) => {
    queueRef.current.push(next);
    pumpNotice();
  };
  const flushNotice = () => {
    dialogOpenRef.current = false;
    pumpNotice();
  };

  const setFormField = createFormFieldChangeHandler(setForm);
  const setEntityFormField = createFormFieldChangeHandler(setEntityForm);

  const openForm = (id: number | null, values: typeof EMPTY, focusPdf = false) => {
    setEditingId(id);
    setForm(values);
    setFormInitial(values);
    setShowPassword(false);
    setFormError('');
    setAttempted(false);
    setRejectedNumber(null);
    setFocusPassword(focusPdf);
    dialogOpenRef.current = true;
    setModalOpen(true);
  };

  const openEdit = (account: Account, focusPdf = false) => openForm(account.id, {
    bank_id: String(account.bank_id),
    email_account_id: String(account.email_account_id),
    nickname: account.nickname,
    account_number: account.account_number,
    pdf_password: '',
    promptpay_id: account.promptpay_id ?? '',
    default_tax_entity_id: account.default_tax_entity_id == null ? '' : String(account.default_tax_entity_id),
  }, focusPdf);

  const openArchive = (account: Account) => {
    setArchiveError('');
    setArchiving(account);
    dialogOpenRef.current = true;
    setArchiveOpen(true);
  };

  // `/accounts?edit=<id>` เปิดฟอร์มแก้บัญชีนั้นหลังโหลดรายชื่อเสร็จ แล้วลบ query ทิ้ง (refresh/back ไม่เปิดซ้ำ)
  // ไม่พบ (เก็บเข้าคลังแล้ว/ลิงก์เก่า) = แจ้งเฉย ๆ ไม่ใช่ error
  const [searchParams, setSearchParams] = useSearchParams();
  const editParam = searchParams.get('edit');
  useEffect(() => {
    if (editParam == null || accounts == null) return;
    setSearchParams((params) => {
      params.delete('edit');
      return params;
    }, { replace: true });
    const target = accounts.find((a) => String(a.id) === editParam);
    if (target) {
      // มาจากลิงก์ focus อยู่ที่ <body> Modal จึงไม่มีที่คืน focus ตอนปิด — ให้ปุ่มแก้ไขของแถวนั้นถือไว้ก่อนเปิด (Modal คืนให้ปุ่มนี้)
      document.getElementById(accountEditId(target.id))?.focus({ preventScroll: true });
      openEdit(target, true);
    } else announce({ message: 'ไม่พบบัญชีที่ลิงก์ชี้มา อาจถูกเก็บเข้าคลังไปแล้ว', severity: 'info' });
  }, [editParam, accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // `/accounts#mailboxes-heading` (ข้อมูลช้า → ดึงอีเมล) — ส่วนนี้อยู่ใต้ตารางบัญชี จึงรอทั้งสองส่วนโหลดจบ (หรือพัง) ก่อนเลื่อน
  const mailboxesSectionRef = useRef<HTMLElement>(null);
  const sectionsSettled = (accounts != null || loadErrors.accounts != null) && (mailboxes != null || loadErrors.mailboxes != null);
  useHashTarget('#mailboxes-heading', sectionsSettled, mailboxesSectionRef, 'mailboxes-heading');

  // มาจากลิงก์ซ่อม (`?edit=`) = มาเพื่อใส่รหัสใหม่ จึงบังคับเหมือนตอนเพิ่ม · แก้ปกติเว้นว่าง = ใช้รหัสเดิม
  const passwordRequired = !editingId || focusPassword;
  const fieldErrors = attempted ? accountFormErrors(form, passwordRequired) : {};
  if (fieldErrors.account_number == null && rejectedNumber?.digits === digitsOnly(form.account_number)) {
    fieldErrors.account_number = rejectedNumber.message;
  }

  const saveAccount = async () => {
    setFormError('');
    const invalid = Object.keys(accountFormErrors(form, passwordRequired))[0] as Field | undefined;
    if (invalid) {
      setAttempted(true);
      document.getElementById(FIELD_ID[invalid])?.focus();
      return;
    }
    setSubmitting(true);
    // รหัสผ่าน PDF ส่งตามที่พิมพ์ ไม่ trim (server ก็ไม่ trim — ช่องว่างหัวท้ายเป็นส่วนของรหัสได้) · ช่องว่างล้วนนับเป็นว่างเหมือน server:
    // ส่ง '' = PATCH คงรหัสเดิม
    const { default_tax_entity_id: taxEntityId, ...rest } = form;
    const fields = {
      ...rest,
      nickname: form.nickname.trim(),
      account_number: digitsOnly(form.account_number),
      promptpay_id: form.promptpay_id.trim(),
      pdf_password: form.pdf_password.trim() === '' ? '' : form.pdf_password,
    };
    // หน้าภาษีปิด = ไม่ส่ง key นี้เลย: PATCH คงค่าเดิม (server เช็ค hasOwnProperty) POST ได้ null
    // ห้ามส่ง '' — server อ่านเป็นเลข 0 แล้วตอบ 400
    const body = TAX_PAGES_ENABLED ? { ...fields, default_tax_entity_id: taxEntityId ? Number(taxEntityId) : null } : fields;
    try {
      const saved = editingId
        ? await patch<AccountSaveResponse>(`/api/accounts/${editingId}`, body)
        : await post<AccountSaveResponse>('/api/accounts', body);
      // resync = server เริ่มอ่าน statement ทั้งกล่องใหม่เบื้องหลัง (เพิ่มบัญชี / เปลี่ยนธนาคาร เลขบัญชี รหัสผ่าน PDF หรือกล่องอีเมล)
      const email = mailboxes?.find((m) => m.id === saved.email_account_id)?.email;
      const done = editingId ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มบัญชีธนาคารแล้ว';
      announce({
        message: saved.resync
          ? `${done} ระบบกำลังอ่าน statement ของกล่อง ${email ?? 'อีเมลนี้'} ใหม่ทั้งหมด ผลจะเข้ามาในไม่กี่นาที`
          : done,
        severity: 'success',
      });
      setModalOpen(false);
      void reload();
    } catch (e) {
      const message = errorText(e, 'บันทึกไม่สำเร็จ');
      // เรื่องของช่องเลขบัญชี = error ที่ช่อง + focus (ไม่ใช่ Alert บนสุดที่ไม่บอกว่าช่องไหน)
      if (message === NUMBER_TAKEN || message === NUMBER_NOT_DIGITS) {
        setRejectedNumber({ digits: fields.account_number, message });
        document.getElementById(FIELD_ID.account_number)?.focus();
      } else setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const archiveAccount = async () => {
    if (!archiving) return;
    setArchiveError('');
    setSubmitting(true);
    try {
      await del(`/api/accounts/${archiving.id}`);
      const archivedId = archiving.id;
      setAccounts((rows) => rows && rows.filter((a) => a.id !== archivedId));
      announce({ message: `เก็บบัญชี “${archiving.nickname}” เข้าคลังแล้ว`, severity: 'success' });
      focusAddAfterExitRef.current = true;
      setArchiveOpen(false);
    } catch (e) {
      setArchiveError(errorText(e, 'เก็บบัญชีเข้าคลังไม่สำเร็จ'));
    } finally {
      setSubmitting(false);
    }
  };

  const setSyncingFor = (id: number, on: boolean) => setSyncing((current) => {
    const next = new Set(current);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  });

  // โหลดเฉพาะกล่องอีเมลซ้ำ ไม่ขึ้น skeleton — โหลดไม่ได้คงของเดิมไว้ (ผลของการดึงยังแจ้งใน snackbar ตามปกติ)
  const fetchMailboxes = () => req<EmailAccount[]>('/api/email-accounts').catch(() => null);

  // กล่องเดียว (หรือไม่มี) = ทุกบัญชีอยู่กล่องเดียวกัน คอลัมน์อีเมลซ้ำทุกแถวเปล่า ๆ · โหลดกล่องไม่ได้ = คงคอลัมน์ไว้
  // เงื่อนไขเดียวกันตัดชื่อกล่องหน้าผลดึงอีเมล — กล่องเดียวไม่ต้องบอกว่ากล่องไหน
  const showEmail = mailboxes == null || mailboxes.length > 1;

  // request รอจนดึงจบ (หลายวินาทีได้) — ปุ่มเป็น aria-disabled ระหว่างนั้น ผลแจ้งใน snackbar
  const syncMailbox = async (mailbox: EmailAccount) => {
    setSyncingFor(mailbox.id, true);
    try {
      const summary = await post<SyncSummary>(`/api/email-accounts/${mailbox.id}/sync`, {});
      const rows = await fetchMailboxes();
      if (rows) setMailboxes(rows);
      const read = summary.statements_inserted;
      const failed = summary.statements_failed;
      const readText = `อ่าน statement ใหม่สำเร็จ ${read.toLocaleString('th-TH')} ไฟล์`;
      const box = showEmail ? `${mailbox.email}: ` : '';
      announce(
        summary.already_running
          ? { message: `${box}ระบบกำลังดึงอีเมลของกล่องนี้อยู่แล้ว statement ที่พบจะเข้ามาเอง`, severity: 'info' }
          // statements_failed นับเฉพาะไฟล์ที่ล้มเหลวในรอบดึงนี้ (src/worker.ts) แต่รายการปลายทางบนแดชบอร์ดคือทุกไฟล์ทุกเดือนทุกกล่อง
          // ข้อความจึงบอก "รอบนี้" ปุ่มบอก "ทั้งหมด" — รายการนั้นบอกสาเหตุและทางแก้ทีละไฟล์ (มี action = snackbar ไม่หายเอง)
          : failed > 0
            ? {
                message: `${box}${read > 0 ? `${readText} · ` : ''}รอบนี้พบ statement ที่มีปัญหา ${failed.toLocaleString('th-TH')} ไฟล์`,
                severity: 'warning',
                action: { label: 'ดูไฟล์ที่มีปัญหาทั้งหมด', onClick: () => navigate('/dashboard#statement-failures') },
              }
            : read > 0
              ? { message: `${box}${readText}`, severity: 'success' }
              : { message: `${box}ไม่มี statement ใหม่`, severity: 'success' },
      );
    } catch (e) {
      // 409 = server ตั้งให้กล่องนี้ต้องเชื่อม Gmail ใหม่แล้ว โหลดซ้ำแล้วแถวเปลี่ยนเป็นปุ่ม "เชื่อม Gmail ใหม่" เอง · 502 = ข้อความของ server
      const rows = await fetchMailboxes();
      if (rows?.find((m) => m.id === mailbox.id)?.reauth_required_at) focusReconnectRef.current = mailbox.id;
      if (rows) setMailboxes(rows);
      announce({ message: errorText(e, 'ดึงอีเมลไม่สำเร็จ'), severity: 'error' });
    } finally {
      setSyncingFor(mailbox.id, false);
    }
  };

  const openEntityForm = (id: number | null, values: typeof EMPTY_ENTITY) => {
    setEntityEditingId(id);
    setEntityForm(values);
    setEntityInitial(values);
    setEntityError('');
    dialogOpenRef.current = true;
    setEntityModalOpen(true);
  };

  const saveEntity = async () => {
    setEntityError('');
    setEntitySubmitting(true);
    try {
      const payload = {
        entity_type: entityForm.entity_type,
        display_name: entityForm.display_name,
        vat_registered: entityForm.vat_registered,
        // เว้นว่าง = ไม่ส่ง server จึงคงเลขเดิมไว้
        ...(entityForm.tax_id ? { tax_id: entityForm.tax_id } : {}),
      };
      if (entityEditingId) await patch(`/api/tax-entities/${entityEditingId}`, payload);
      else await post('/api/tax-entities', payload);
      announce({ message: entityEditingId ? 'บันทึกการแก้ไขผู้เสียภาษีแล้ว' : 'เพิ่มผู้เสียภาษีแล้ว', severity: 'success' });
      setEntityModalOpen(false);
      void reload();
    } catch (e) {
      setEntityError(errorText(e, 'บันทึกไม่สำเร็จ'));
    } finally {
      setEntitySubmitting(false);
    }
  };

  const toggleEntityActive = async (entity: TaxEntity) => {
    try {
      await patch(`/api/tax-entities/${entity.id}`, { is_active: !entity.is_active });
      setTaxEntities((rows) => rows && rows.map((e) => (e.id === entity.id ? { ...e, is_active: !entity.is_active } : e)));
    } catch (e) {
      announce({ message: errorText(e, 'เปลี่ยนสถานะไม่สำเร็จ'), severity: 'error' });
    }
  };

  // ช่องเลือกของฟอร์มที่โหลดไม่ได้ = LoadError พร้อมลองใหม่ในฟอร์ม ไม่ใช่ช่องเลือกว่างเงียบ ๆ (The Section Failure Rule)
  const formLoadError = [
    banks == null && loadErrors.banks,
    mailboxes == null && loadErrors.mailboxes,
    TAX_PAGES_ENABLED && taxEntities == null && loadErrors.taxEntities,
  ].filter(Boolean).join(' • ');

  // ยังไม่มีกล่องอีเมลเลย = ฟอร์มเพิ่มบัญชีเลือกกล่องไม่ได้ ทางแรกจึงเป็นเชื่อม Gmail
  const noMailbox = mailboxes != null && mailboxes.length === 0;

  return (
    <Box>
      <PageHeader
        level={1}
        id="accounts-heading"
        title="บัญชีของฉัน"
        description="จัดการบัญชีและกล่องอีเมลที่ระบบใช้รับข้อมูลจาก statement"
        // ยังไม่มีกล่องอีเมล = ฟอร์มเลือกกล่องไม่ได้ ทางเดียวคือ "เชื่อม Gmail" ในกล่องว่างด้านล่าง (ไม่ใช่ CTA ซ้ำหลายจุด)
        action={noMailbox ? undefined : <Button ref={addButtonRef} variant="contained" startIcon={<AddRounded />} onClick={() => openForm(null, EMPTY)} sx={{ whiteSpace: 'nowrap' }}>เพิ่มบัญชี</Button>}
      />

      <Loaded data={accounts} error={loadErrors.accounts} onRetry={retry}>
        {(rows) => rows.length === 0 ? (
          <EmptyState
            headingLevel={2}
            icon={<AccountBalanceRounded sx={{ fontSize: 40 }} />}
            title="ยังไม่มีบัญชีธนาคาร"
            description={noMailbox
              ? 'เชื่อมกล่อง Gmail ที่รับ statement จากธนาคารก่อน แล้วจึงเพิ่มบัญชีและเลือกกล่องนั้น ระบบจะนำเข้ารายการให้อัตโนมัติ'
              : 'เพิ่มบัญชีและเลือกกล่องอีเมลที่รับ statement เพื่อเริ่มนำเข้ารายการโดยอัตโนมัติ'}
            action={noMailbox
              ? <Button variant="contained" startIcon={<MailOutlineRounded />} href="/auth/google?add=1">เชื่อม Gmail</Button>
              : <Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm(null, EMPTY)}>เพิ่มบัญชีแรก</Button>}
          />
        ) : (
          // < md เหลือ ชื่อเล่น · จัดการ — ธนาคาร · เลขบัญชี และกล่องอีเมล (เมื่อมีหลายกล่อง) พับเป็นบรรทัดรองใต้ชื่อ (Tables ใน DESIGN.md)
          // ไม่มี minWidth จึงไม่ล้นกล่องทุกขนาดจอ — ไม่ใส่ tabIndex (กล่องที่ไม่มีอะไรให้เลื่อนไม่ควรเป็นจุดแวะของ Tab แบบหน้า กยศ.)
          <TableContainer
            component={Paper}
            variant="outlined"
            role="region"
            aria-label="ตารางบัญชีธนาคาร"
            data-tour="accounts-table"
            sx={{ mt: 3, position: 'relative' }}
          >
            <Table size="small" aria-label="บัญชีธนาคาร">
              <TableHead>
                <TableRow>
                  <TableCell>ชื่อเล่น</TableCell>
                  <TableCell sx={MD_UP}>ธนาคาร</TableCell>
                  <TableCell sx={MD_UP}>เลขที่บัญชี</TableCell>
                  {showEmail && <TableCell sx={MD_UP}>กล่องอีเมล</TableCell>}
                  <TableCell align="right">จัดการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((account) => (
                  <TableRow key={account.id} hover>
                    <TableCell sx={NAME_CELL}>
                      {account.nickname}
                      <Box sx={{ ...BELOW_MD, mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {account.bank_name}{SEP}<Box component="span" sx={dataTextSx}>{account.account_number}</Box>
                        </Typography>
                        {showEmail && <Typography variant="body2" color="text.secondary" sx={dataTextSx}>{account.email}</Typography>}
                      </Box>
                    </TableCell>
                    <TableCell sx={MD_UP}>{account.bank_name}</TableCell>
                    <TableCell sx={{ ...MD_UP, ...dataTextSx }}>{account.account_number}</TableCell>
                    {showEmail && <TableCell sx={{ ...MD_UP, ...dataTextSx, overflowWrap: 'anywhere' }}>{account.email}</TableCell>}
                    <TableCell align="right" sx={{ py: 0.5 }}>
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                        <RowIconButton id={accountEditId(account.id)} label={`แก้ไข ${account.nickname}`} tooltip="แก้ไข" onClick={() => openEdit(account)}>
                          <EditRounded fontSize="small" />
                        </RowIconButton>
                        {/* ไม่มี endpoint เอากลับ ย้อนจากหน้าจอไม่ได้ — สีเดียวกับ "เลิกใช้" ของหน้าวางแผน */}
                        <RowIconButton
                          label={`เก็บเข้าคลัง ${account.nickname}`}
                          tooltip="เก็บเข้าคลัง"
                          color="error"
                          onClick={() => openArchive(account)}
                        >
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
      </Loaded>

      <Modal
        open={modalOpen}
        // ชื่อจากค่าตอนเปิด ไม่เปลี่ยนตามช่องชื่อเล่นที่กำลังพิมพ์
        // มาจากปุ่ม "ตั้งรหัสผ่าน PDF ใหม่" บนแดชบอร์ด = หัวตรงกับปุ่มที่พามา
        title={!editingId ? 'เพิ่มบัญชีธนาคาร'
          : focusPassword ? `ตั้งรหัสผ่าน PDF ใหม่ — “${formInitial.nickname}”`
          : `แก้ไขบัญชี “${formInitial.nickname}”`}
        onClose={() => setModalOpen(false)}
        busy={submitting}
        dirty={JSON.stringify(form) !== JSON.stringify(formInitial)}
        // มาจากลิงก์ซ่อม = ปุ่มบอกสิ่งที่มาทำ ตรงกับหัว dialog
        footer={{ formId: 'account-form', submitLabel: !editingId ? 'เพิ่มบัญชี' : focusPassword ? 'ตั้งรหัสใหม่' : 'บันทึกการแก้ไข' }}
        onExited={flushNotice}
      >
        {/* noValidate: ช่องบังคับตรวจเองใน saveAccount (FIELD_ID) — `required` คงไว้เพื่อเครื่องหมาย * และ aria-required */}
        <Box
          component="form"
          id="account-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!submitting) void saveAccount();
          }}
        >
          <Stack spacing={2.5}>
            {formError && <Alert ref={revealOnMount} severity="error">{formError}</Alert>}
            {formLoadError && <LoadError message={formLoadError} onRetry={retry} />}
            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1.5, color: 'text.primary', fontWeight: 600 }}>การเชื่อมต่อ statement</FormLabel>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
                <TextField
                  select
                  label="ธนาคาร"
                  error={fieldErrors.bank_id != null}
                  helperText={fieldErrors.bank_id ?? 'เลือกธนาคารเจ้าของบัญชี'}
                  value={form.bank_id}
                  onChange={setFormField('bank_id')}
                  required
                  autoFocus={!editingId}
                  slotProps={{ select: { SelectDisplayProps: { id: FIELD_ID.bank_id } } }}
                >
                  <MenuItem value=""><em>— เลือก —</em></MenuItem>
                  {(banks ?? []).filter((bank) => bank.is_active || String(bank.id) === form.bank_id).map((bank) => (
                    <MenuItem key={bank.id} value={String(bank.id)}>{bank.name}</MenuItem>
                  ))}
                </TextField>
                {/* ลิงก์ต่อกล่องอีเมลพาออกจากหน้า (ค่าที่กรอกหาย) จึงไม่อยู่ในฟอร์ม — ปุ่มอยู่ที่ส่วนกล่องอีเมล */}
                <TextField
                  select
                  label="กล่องอีเมลที่ให้ระบบเข้าไปอ่าน"
                  error={fieldErrors.email_account_id != null}
                  helperText={fieldErrors.email_account_id ?? 'กล่องที่รับ statement ของบัญชีนี้ — ต่อกล่องอื่นเพิ่มได้ที่ส่วนกล่องอีเมลในหน้านี้'}
                  value={form.email_account_id}
                  onChange={setFormField('email_account_id')}
                  required
                  slotProps={{ select: { SelectDisplayProps: { id: FIELD_ID.email_account_id } } }}
                >
                  <MenuItem value=""><em>— เลือก —</em></MenuItem>
                  {(mailboxes ?? []).map((mailbox) => (
                    <MenuItem key={mailbox.id} value={String(mailbox.id)} sx={dataTextSx}>{mailbox.email}</MenuItem>
                  ))}
                </TextField>
                {/* เลขบัญชีคือสิ่งที่ระบบใช้จับคู่ statement กับบัญชี — เปลี่ยนแล้วอ่านใหม่ทั้งกล่องเหมือนช่องอื่นในชุดนี้ */}
                {/* statement ปิดบางหลัก (`xxx-x-x6231-x`) ระบบเทียบเฉพาะตัวเลขกับหลักที่เห็น (src/account-match.ts) จึงต้องเป็นเลขเต็ม */}
                <TextField
                  id={FIELD_ID.account_number}
                  label="เลขที่บัญชี"
                  error={fieldErrors.account_number != null}
                  helperText={fieldErrors.account_number ?? 'เลขเต็มจากแอปธนาคารหรือสมุดบัญชี (statement ปิดบางหลักไว้) มีขีดหรือไม่ก็ได้'}
                  value={form.account_number}
                  onChange={setFormField('account_number')}
                  required
                  slotProps={{ htmlInput: { maxLength: 40, inputMode: 'numeric' } }}
                />
                {/* รหัสเปิดไฟล์คือข้อมูลการเชื่อมต่อ — ไฟล์ที่เปิดไม่ได้บนแดชบอร์ดลิงก์มาที่ช่องนี้ (`?edit=` → autoFocus) */}
                <TextField
                  id={FIELD_ID.pdf_password}
                  type={showPassword ? 'text' : 'password'}
                  label="รหัสผ่านเปิดไฟล์ statement"
                  error={fieldErrors.pdf_password != null}
                  // PATCH ที่ช่องนี้ว่าง server คงรหัสเดิมไว้ (src/routes/accounts.ts) · คำใบ้ตามคู่มือ (guides.ts)
                  // มาจากลิงก์ซ่อม = มาเพื่อใส่รหัสใหม่ จึงบังคับกรอกและไม่บอกว่าเว้นว่างได้ · บริบท "ทำไมถึงมา" อยู่ต้น helper ไม่ใช่ย่อหน้าแยก
                  // เพราะ focus ลงช่องนี้ตรง ๆ helper ผูก aria-describedby screen reader จึงอ่านพร้อมช่อง · PATCH ที่มีรหัสใหม่สั่งอ่านทั้งกล่องใหม่
                  // ไฟล์ที่ค้าง parse_failed ถูกเปิดอีกรอบ
                  helperText={fieldErrors.pdf_password ?? (focusPassword
                    ? 'มี statement ที่เปิดด้วยรหัสเดิมไม่ได้ ใส่รหัสใหม่แล้วระบบจะลองเปิดไฟล์เดิมอีกครั้ง · ธนาคารตั้งให้ มักเป็นเลขบัตรประชาชนหรือวันเกิด · ระบบเก็บแบบเข้ารหัสและไม่แสดงกลับอีก'
                    : editingId
                      ? 'เว้นว่างไว้ = ใช้รหัสเดิม · ธนาคารตั้งให้ มักเป็นเลขบัตรประชาชนหรือวันเกิด · ระบบเก็บแบบเข้ารหัสและไม่แสดงกลับอีก'
                      : 'รหัสเปิดไฟล์ PDF ที่ธนาคารตั้งให้ มักเป็นเลขบัตรประชาชนหรือวันเกิด · ระบบเก็บแบบเข้ารหัสและไม่แสดงกลับอีก')}
                  value={form.pdf_password}
                  onChange={setFormField('pdf_password')}
                  required={passwordRequired}
                  autoFocus={focusPassword}
                  autoComplete="new-password"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          {/* ชื่อคงที่ สถานะบอกด้วย aria-pressed */}
                          <IconButton edge="end" aria-label="แสดงรหัสผ่าน" aria-pressed={showPassword} onClick={() => setShowPassword((on) => !on)}>
                            {showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>
            </Box>
            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1.5, color: 'text.primary', fontWeight: 600 }}>รายละเอียดบัญชี</FormLabel>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
                <TextField
                  id={FIELD_ID.nickname}
                  label="ชื่อเล่น"
                  error={fieldErrors.nickname != null}
                  helperText={fieldErrors.nickname ?? 'ชื่อที่ช่วยให้จำบัญชีนี้ได้ง่าย'}
                  value={form.nickname}
                  onChange={setFormField('nickname')}
                  required
                  slotProps={{ htmlInput: { maxLength: 60 } }}
                />
                <TextField label="พร้อมเพย์ (ไม่บังคับ)" helperText="ใช้ช่วยจับคู่รายการโอนภายในครอบครัว" value={form.promptpay_id} onChange={setFormField('promptpay_id')} slotProps={{ htmlInput: { maxLength: 40 } }} />
                {TAX_PAGES_ENABLED && (
                  <TextField
                    select
                    label="ผู้เสียภาษีเริ่มต้น (ไม่บังคับ)"
                    helperText="ธุรกรรมจากบัญชีนี้จะผูกกับผู้เสียภาษีรายนี้ให้เอง แก้เป็นรายธุรกรรมได้ทีหลัง"
                    value={form.default_tax_entity_id}
                    onChange={setFormField('default_tax_entity_id')}
                  >
                    <MenuItem value=""><em>— ไม่กำหนด —</em></MenuItem>
                    {(taxEntities ?? []).filter((e) => e.is_active || String(e.id) === form.default_tax_entity_id).map((e) => (
                      <MenuItem key={e.id} value={String(e.id)}>{e.display_name}</MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>
            </Box>
            {/* คำแนะนำ ไม่ใช่สิ่งที่ต้องกรอก — อยู่ท้ายฟอร์ม ไม่ดันช่องแรกลง */}
            {!editingId && (
              <Typography color="text.secondary" sx={descriptionSx}>
                ถ้าอยากได้ข้อมูลย้อนหลัง ขอ statement ย้อนหลังจากธนาคารให้ส่งเข้ากล่องอีเมลของบัญชีนี้ได้ ระบบจะอ่านและใช้เป็นข้อมูลตั้งต้นให้เอง
              </Typography>
            )}
          </Stack>
        </Box>
      </Modal>
      <ConfirmDialog
        open={archiveOpen}
        title="เก็บบัญชีเข้าคลัง"
        description={
          <Stack spacing={1.5}>
            <Typography sx={descriptionSx}>เก็บบัญชี “{archiving?.nickname}” เข้าคลังหรือไม่?</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              <li>หายจากหน้านี้และจากช่องเลือกบัญชี</li>
              <li>หยุดรับ statement ใหม่</li>
              <li>ไม่นับในยอดคงเหลือรวม</li>
              <li>statement และรายการเดิมยังอยู่ครบ (ยังเห็นในหน้าธุรกรรม)</li>
            </Box>
            <Typography sx={descriptionSx}>ตอนนี้ยังไม่มีปุ่มเอากลับ</Typography>
            {archiveError && <Alert severity="error">{archiveError}</Alert>}
          </Stack>
        }
        confirmLabel="เก็บเข้าคลัง"
        confirmColor="error"
        busy={submitting}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => void archiveAccount()}
        onExited={() => {
          if (focusAddAfterExitRef.current) {
            focusAddAfterExitRef.current = false;
            addButtonRef.current?.focus();
          }
          flushNotice();
        }}
      />

      {/* scrollMarginTop = ความสูง AppBar แบบ sticky (เหมือน #statement-failures ของแดชบอร์ด) — ลิงก์ #mailboxes-heading */}
      <Box component="section" ref={mailboxesSectionRef} aria-labelledby="mailboxes-heading" sx={{ mt: 5, scrollMarginTop: 80 }}>
        <PageHeader
          level={2}
          id="mailboxes-heading"
          tabIndex={-1}
          title="กล่องอีเมล"
          description='ระบบค้นเฉพาะอีเมล statement ดึงเองทุกชั่วโมง หรือกด "ดึงอีเมลใหม่" เพื่อดึงทันที'
          // จอแคบ PageHeader ยืด action เต็มกว้าง — ปุ่มรองนี้ไม่ยืด จะได้ไม่เด่นกว่า "ดึงอีเมลใหม่" ของแต่ละกล่อง
          // ยังไม่มีกล่อง = ซ่อน (ทางเดียวคือ "เชื่อม Gmail" ในกล่องว่างของตารางบัญชี)
          action={noMailbox ? undefined : <Button variant="outlined" startIcon={<AddRounded />} href="/auth/google?add=1" sx={{ whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>ต่อกล่องอีเมลอื่นเพิ่ม</Button>}
        />
        <Loaded data={mailboxes} error={loadErrors.mailboxes} onRetry={retry} rows={2}>
          {(rows) => rows.length === 0 ? (
            <EmptyState
              icon={<MailOutlineRounded sx={{ fontSize: 40 }} />}
              title="ยังไม่ได้เชื่อม Gmail"
              description="เชื่อมกล่อง Gmail ที่รับ statement จากธนาคาร ระบบจึงจะนำเข้ารายการให้อัตโนมัติ"
            />
          ) : (
            // แถวแบบ DataFreshness แทนตาราง — มีไม่กี่กล่อง ไม่ต้องเลื่อนแนวนอนที่ 320px
            // role="list": Safari ทิ้ง list semantics ของ <ul> ที่ listStyle none
            <Paper component="ul" role="list" variant="outlined" sx={{ mt: 3, mb: 0, mx: 0, px: 2, py: 0, listStyle: 'none' }}>
              {rows.map((mailbox) => {
                const busy = syncing.has(mailbox.id);
                return (
                  <Stack
                    component="li"
                    key={mailbox.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 1, sm: 2 }}
                    sx={{ alignItems: { sm: 'center' }, py: 1.5, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                  >
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography sx={{ ...dataTextSx, fontWeight: 600, overflowWrap: 'anywhere' }}>{mailbox.email}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={dataTextSx}>
                        {mailbox.last_synced_at ? `ดึงอีเมลล่าสุด ${formatDateTime(mailbox.last_synced_at)}` : 'ยังไม่เคยดึงอีเมล'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      {mailbox.reauth_required_at ? (
                        <>
                          <Chip size="small" icon={<LinkOffRounded />} label="ต้องเชื่อม Gmail ใหม่" color="error" variant="outlined" />
                          <Button
                            ref={(el: HTMLElement | null) => {
                              if (el == null || focusReconnectRef.current !== mailbox.id) return;
                              focusReconnectRef.current = null;
                              if (document.activeElement === document.body) el.focus();
                            }}
                            variant="contained"
                            href={`/auth/google?reconnect=${mailbox.id}`}
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            เชื่อม Gmail ใหม่
                          </Button>
                        </>
                      ) : (
                        <>
                          <Chip size="small" icon={<CheckCircleRounded />} label="ใช้งานได้" color="success" variant="outlined" />
                          {/* ดึงจนจบในคำขอเดียว (หลายวินาที) — aria-disabled ไม่ใช่ disabled ปุ่มที่ถือ focus จึงไม่ทำ focus หลุด */}
                          <Button
                            variant="outlined"
                            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SyncRounded />}
                            aria-label={`${busy ? 'กำลังดึงอีเมล' : 'ดึงอีเมลใหม่'} ${mailbox.email}`}
                            aria-disabled={busy}
                            aria-busy={busy}
                            onClick={busy ? undefined : () => void syncMailbox(mailbox)}
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            {busy ? 'กำลังดึงอีเมล…' : 'ดึงอีเมลใหม่'}
                          </Button>
                        </>
                      )}
                    </Stack>
                  </Stack>
                );
              })}
            </Paper>
          )}
        </Loaded>
      </Box>

      {/* ผู้เสียภาษีใช้กับหน้าภาษีเท่านั้น — ปิดหน้าภาษีแล้วซ่อนทั้งส่วน (ค่าเดิมของแต่ละบัญชีไม่ถูกแตะ ดู saveAccount) */}
      {TAX_PAGES_ENABLED && (
        <Box component="section" aria-labelledby="tax-entities-heading" sx={{ mt: 5 }}>
          <PageHeader
            level={2}
            id="tax-entities-heading"
            title="ผู้เสียภาษี"
            description="แยกบุคคลธรรมดา ร้านค้า หรือบริษัท เพื่อผูกกับบัญชีธนาคารและเอกสารภาษี — หนึ่งคนมีได้หลายราย"
            action={<Button ref={addEntityButtonRef} variant="outlined" startIcon={<AddRounded />} onClick={() => openEntityForm(null, EMPTY_ENTITY)} sx={{ whiteSpace: 'nowrap' }}>เพิ่มผู้เสียภาษี</Button>}
          />
          <Loaded data={taxEntities} error={loadErrors.taxEntities} onRetry={retry} rows={2}>
            {(rows) => rows.length === 0 ? (
              <EmptyState
                icon={<AccountBalanceRounded sx={{ fontSize: 40 }} />}
                title="ยังไม่มีผู้เสียภาษี"
                description="เพิ่มผู้เสียภาษีเพื่อกำหนดเจ้าของเอกสารภาษีและบัญชีธนาคาร"
                action={<Button variant="outlined" startIcon={<AddRounded />} onClick={() => openEntityForm(null, EMPTY_ENTITY)}>เพิ่มรายแรก</Button>}
              />
            ) : (
              // < md เหลือ ชื่อ · ใช้งาน · จัดการ — ประเภทและการจดภาษีมูลค่าเพิ่มพับเป็นบรรทัดรอง
              <TableContainer component={Paper} variant="outlined" role="region" aria-label="ตารางผู้เสียภาษี" sx={{ mt: 3, position: 'relative' }}>
                <Table size="small" aria-label="ผู้เสียภาษี">
                  <TableHead>
                    <TableRow>
                      <TableCell>ชื่อ</TableCell>
                      <TableCell sx={MD_UP}>ประเภท</TableCell>
                      <TableCell sx={MD_UP}>ภาษีมูลค่าเพิ่ม</TableCell>
                      <TableCell>ใช้งาน</TableCell>
                      <TableCell align="right">จัดการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((entity) => (
                      <TableRow key={entity.id} hover>
                        <TableCell sx={NAME_CELL}>
                          {entity.display_name}
                          <Typography variant="body2" color="text.secondary" sx={{ ...BELOW_MD, mt: 0.5 }}>
                            {TAX_ENTITY_TYPE_LABEL[entity.entity_type]}
                            {entity.vat_registered && <>{SEP}จดภาษีมูลค่าเพิ่ม</>}
                          </Typography>
                        </TableCell>
                        <TableCell sx={MD_UP}>{TAX_ENTITY_TYPE_LABEL[entity.entity_type]}</TableCell>
                        <TableCell sx={MD_UP}>{entity.vat_registered && <Chip size="small" label="จดทะเบียนแล้ว" variant="outlined" />}</TableCell>
                        <TableCell>
                          {/* ชื่อคงที่ สถานะบอกด้วย checked */}
                          <Switch
                            size="small"
                            checked={entity.is_active}
                            onChange={() => void toggleEntityActive(entity)}
                            slotProps={{ input: { 'aria-label': `ใช้งาน ${entity.display_name}` } }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ py: 0.5 }}>
                          <RowIconButton
                            label={`แก้ไข ${entity.display_name}`}
                            tooltip="แก้ไข"
                            onClick={() => openEntityForm(entity.id, { entity_type: entity.entity_type, display_name: entity.display_name, tax_id: '', vat_registered: entity.vat_registered })}
                          >
                            <EditRounded fontSize="small" />
                          </RowIconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Loaded>
        </Box>
      )}

      <Modal
        open={entityModalOpen}
        title={entityEditingId ? 'แก้ไขผู้เสียภาษี' : 'เพิ่มผู้เสียภาษี'}
        onClose={() => setEntityModalOpen(false)}
        busy={entitySubmitting}
        dirty={JSON.stringify(entityForm) !== JSON.stringify(entityInitial)}
        footer={{ formId: 'tax-entity-form', submitLabel: entityEditingId ? 'บันทึกการแก้ไข' : 'เพิ่มผู้เสียภาษี' }}
        onExited={flushNotice}
      >
        <Box
          component="form"
          id="tax-entity-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!entitySubmitting) void saveEntity();
          }}
        >
          <Stack spacing={2.5}>
            {entityError && <Alert ref={revealOnMount} severity="error">{entityError}</Alert>}
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
              <TextField select label="ประเภท" value={entityForm.entity_type} onChange={setEntityFormField('entity_type')} required autoFocus>
                {(Object.entries(TAX_ENTITY_TYPE_LABEL) as [TaxEntityType, string][]).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </TextField>
              <TextField label="ชื่อ" value={entityForm.display_name} onChange={setEntityFormField('display_name')} required slotProps={{ htmlInput: { maxLength: 100 } }} />
              <TextField
                label="เลขผู้เสียภาษี (ไม่บังคับ)"
                helperText={entityEditingId
                  ? 'เว้นว่างไว้ = ใช้เลขเดิม · ระบบเก็บแบบเข้ารหัสและไม่แสดงกลับอีก'
                  : 'ระบบเก็บแบบเข้ารหัสและไม่แสดงกลับอีก'}
                value={entityForm.tax_id}
                onChange={setEntityFormField('tax_id')}
                autoComplete="off"
                slotProps={{ htmlInput: { maxLength: 20 } }}
              />
            </Box>
            <FormControlLabel
              control={<Switch checked={entityForm.vat_registered} onChange={(e) => setEntityForm((f) => ({ ...f, vat_registered: e.target.checked }))} />}
              label="จดทะเบียนภาษีมูลค่าเพิ่ม"
            />
          </Stack>
        </Box>
      </Modal>

      <FeedbackSnackbar
        notice={notice}
        onClose={() => setNotice(null)}
        onExited={() => {
          showingRef.current = false;
          pumpNotice();
        }}
      />
    </Box>
  );
}
