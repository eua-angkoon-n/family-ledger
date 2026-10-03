import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { del, patch, post, req, type Account, type Bank, type EmailAccount, type SyncSummary, type TaxEntity, type TaxEntityType } from './api.js';
import { TAX_PAGES_ENABLED } from './features.js';
import { createFormFieldChangeHandler } from './form.js';
import { formatDateTime } from './format.js';
import Modal from './Modal.js';
import { TAX_ENTITY_TYPE_LABEL } from './taxDocumentLabels.js';
import { dataTextSx, descriptionSx } from './theme.js';
import { BELOW_MD, ConfirmDialog, EmptyState, FeedbackSnackbar, LoadError, MD_UP, PageHeader, RowIconButton, TableSkeleton, type Notice } from './ui.js';

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
  const [archiving, setArchiving] = useState<Account | null>(null);
  const [archiveError, setArchiveError] = useState('');
  const [syncing, setSyncing] = useState<ReadonlySet<number>>(new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  // ผลสำเร็จที่เกิดตอน modal/dialog เปิดอยู่ — `#root` เป็น aria-hidden จนปิดสนิท จึงแสดงจาก onExited (เหมือนหน้าแผนผ่อน)
  const pendingNoticeRef = useRef<Notice | null>(null);
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

  const flushNotice = () => {
    const pending = pendingNoticeRef.current;
    pendingNoticeRef.current = null;
    if (pending) setNotice(pending);
  };

  const setFormField = createFormFieldChangeHandler(setForm);
  const setEntityFormField = createFormFieldChangeHandler(setEntityForm);

  const openForm = (id: number | null, values: typeof EMPTY) => {
    setEditingId(id);
    setForm(values);
    setFormInitial(values);
    setShowPassword(false);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (account: Account) => openForm(account.id, {
    bank_id: String(account.bank_id),
    email_account_id: String(account.email_account_id),
    nickname: account.nickname,
    account_number: account.account_number,
    pdf_password: '',
    promptpay_id: account.promptpay_id ?? '',
    default_tax_entity_id: account.default_tax_entity_id == null ? '' : String(account.default_tax_entity_id),
  });

  const saveAccount = async () => {
    setFormError('');
    setSubmitting(true);
    const { default_tax_entity_id: taxEntityId, ...fields } = form;
    // หน้าภาษีปิด = ไม่ส่ง key นี้เลย: PATCH คงค่าเดิม (server เช็ค hasOwnProperty) POST ได้ null
    // ห้ามส่ง '' — server อ่านเป็นเลข 0 แล้วตอบ 400
    const body = TAX_PAGES_ENABLED ? { ...fields, default_tax_entity_id: taxEntityId ? Number(taxEntityId) : null } : fields;
    try {
      if (editingId) await patch(`/api/accounts/${editingId}`, body);
      else await post('/api/accounts', body);
      pendingNoticeRef.current = {
        message: editingId ? 'บันทึกการแก้ไขบัญชีแล้ว' : 'เพิ่มบัญชีธนาคารแล้ว ระบบกำลังดึง statement ย้อนหลังให้',
        severity: 'success',
      };
      setModalOpen(false);
      void reload();
    } catch (e) {
      setFormError(errorText(e, 'บันทึกไม่สำเร็จ'));
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
      pendingNoticeRef.current = { message: `เก็บบัญชี “${archiving.nickname}” เข้าคลังแล้ว`, severity: 'success' };
      focusAddAfterExitRef.current = true;
      setArchiving(null);
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

  // request รอจนดึงจบ (หลายวินาทีได้) — ปุ่มเป็น aria-disabled ระหว่างนั้น ผลแจ้งใน snackbar
  const syncMailbox = async (mailbox: EmailAccount) => {
    setSyncingFor(mailbox.id, true);
    try {
      const summary = await post<SyncSummary>(`/api/email-accounts/${mailbox.id}/sync`, {});
      const rows = await fetchMailboxes();
      if (rows) setMailboxes(rows);
      const fresh = rows?.find((m) => m.id === mailbox.id);
      const count = summary.statements_inserted;
      // กล่องที่กำลังดึงอยู่แล้ว (เช่นดึงย้อนหลังหลังเพิ่มบัญชี) server ตอบ 0 ทันทีโดยไม่ขยับเวลาดึงล่าสุด
      // ส่วนการดึงจริงขยับเวลานี้ทุกครั้ง — แยกจาก "ไม่มี statement ใหม่" ได้ด้วยเวลานี้
      const alreadyRunning = count === 0 && summary.messages_scanned === 0 && fresh != null && fresh.last_synced_at === mailbox.last_synced_at;
      setNotice(
        count > 0
          ? { message: `${mailbox.email}: ได้ statement ใหม่ ${count.toLocaleString('th-TH')} ไฟล์`, severity: 'success' }
          : alreadyRunning
            ? { message: `${mailbox.email}: ระบบกำลังดึงอีเมลของกล่องนี้อยู่แล้ว statement ที่พบจะเข้ามาเอง ลองดูอีกครั้งในอีกสักครู่`, severity: 'info' }
            : { message: `${mailbox.email}: ไม่มี statement ใหม่`, severity: 'success' },
      );
    } catch (e) {
      // 409 = server ตั้งให้กล่องนี้ต้องเชื่อม Gmail ใหม่แล้ว โหลดซ้ำแล้วแถวเปลี่ยนเป็นปุ่ม "เชื่อม Gmail ใหม่" เอง · 502 = ข้อความของ server
      const rows = await fetchMailboxes();
      if (rows?.find((m) => m.id === mailbox.id)?.reauth_required_at) focusReconnectRef.current = mailbox.id;
      if (rows) setMailboxes(rows);
      setNotice({ message: errorText(e, 'ดึงอีเมลไม่สำเร็จ'), severity: 'error' });
    } finally {
      setSyncingFor(mailbox.id, false);
    }
  };

  const openEntityForm = (id: number | null, values: typeof EMPTY_ENTITY) => {
    setEntityEditingId(id);
    setEntityForm(values);
    setEntityInitial(values);
    setEntityError('');
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
      pendingNoticeRef.current = { message: entityEditingId ? 'บันทึกการแก้ไขผู้เสียภาษีแล้ว' : 'เพิ่มผู้เสียภาษีแล้ว', severity: 'success' };
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
      setNotice({ message: errorText(e, 'เปลี่ยนสถานะไม่สำเร็จ'), severity: 'error' });
    }
  };

  // ช่องเลือกของฟอร์มที่โหลดไม่ได้ = LoadError พร้อมลองใหม่ในฟอร์ม ไม่ใช่ช่องเลือกว่างเงียบ ๆ (The Section Failure Rule)
  const formLoadError = [
    banks == null && loadErrors.banks,
    mailboxes == null && loadErrors.mailboxes,
    TAX_PAGES_ENABLED && taxEntities == null && loadErrors.taxEntities,
  ].filter(Boolean).join(' • ');

  return (
    <Box>
      <PageHeader
        level={1}
        id="accounts-heading"
        title="บัญชีธนาคารของฉัน"
        description="จัดการบัญชีและกล่องอีเมลที่ระบบใช้รับข้อมูลจาก statement"
        action={<Button ref={addButtonRef} variant="contained" startIcon={<AddRounded />} onClick={() => openForm(null, EMPTY)} sx={{ whiteSpace: 'nowrap' }}>เพิ่มบัญชี</Button>}
      />

      <Loaded data={accounts} error={loadErrors.accounts} onRetry={retry}>
        {(rows) => rows.length === 0 ? (
          <EmptyState
            headingLevel={2}
            icon={<AccountBalanceRounded sx={{ fontSize: 40 }} />}
            title="ยังไม่มีบัญชีธนาคาร"
            description="เพิ่มบัญชีและเลือกกล่องอีเมลที่รับ statement เพื่อเริ่มนำเข้ารายการโดยอัตโนมัติ"
            action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm(null, EMPTY)}>เพิ่มบัญชีแรก</Button>}
          />
        ) : (
          // < md เหลือ ชื่อเล่น · จัดการ — ธนาคาร · เลขบัญชี และกล่องอีเมลพับเป็นบรรทัดรองใต้ชื่อ (Tables ใน DESIGN.md)
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
                  <TableCell sx={MD_UP}>กล่องอีเมล</TableCell>
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
                        <Typography variant="body2" color="text.secondary" sx={dataTextSx}>{account.email}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={MD_UP}>{account.bank_name}</TableCell>
                    <TableCell sx={{ ...MD_UP, ...dataTextSx }}>{account.account_number}</TableCell>
                    <TableCell sx={{ ...MD_UP, ...dataTextSx, overflowWrap: 'anywhere' }}>{account.email}</TableCell>
                    <TableCell align="right" sx={{ py: 0.5 }}>
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                        <RowIconButton label={`แก้ไข ${account.nickname}`} tooltip="แก้ไข" onClick={() => openEdit(account)}>
                          <EditRounded fontSize="small" />
                        </RowIconButton>
                        {/* ไม่มี endpoint เอากลับ ย้อนจากหน้าจอไม่ได้ — สีเดียวกับ "เลิกใช้" ของหน้าวางแผน */}
                        <RowIconButton
                          label={`เก็บเข้าคลัง ${account.nickname}`}
                          tooltip="เก็บเข้าคลัง"
                          color="error"
                          onClick={() => {
                            setArchiveError('');
                            setArchiving(account);
                          }}
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
        title={editingId ? 'แก้ไขบัญชีธนาคาร' : 'เพิ่มบัญชีธนาคาร'}
        onClose={() => setModalOpen(false)}
        busy={submitting}
        dirty={JSON.stringify(form) !== JSON.stringify(formInitial)}
        footer={{ formId: 'account-form', submitLabel: editingId ? 'บันทึกการแก้ไข' : 'เพิ่มบัญชี' }}
        onExited={flushNotice}
      >
        <Box
          component="form"
          id="account-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!submitting) void saveAccount();
          }}
        >
          <Stack spacing={2.5}>
            <Typography color="text.secondary" sx={descriptionSx}>
              ก่อนเพิ่มบัญชี ให้ขอ statement ย้อนหลังจากธนาคารส่งเข้ากล่องอีเมลของคุณ ระบบจะใช้เป็นข้อมูลตั้งต้น
            </Typography>
            {formLoadError && <LoadError message={formLoadError} onRetry={retry} />}
            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1.5, color: 'text.primary', fontWeight: 600 }}>การเชื่อมต่อ statement</FormLabel>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
                <TextField select label="ธนาคาร" helperText="เลือกธนาคารเจ้าของบัญชี" value={form.bank_id} onChange={setFormField('bank_id')} required autoFocus>
                  <MenuItem value=""><em>— เลือก —</em></MenuItem>
                  {(banks ?? []).filter((bank) => bank.is_active || String(bank.id) === form.bank_id).map((bank) => (
                    <MenuItem key={bank.id} value={bank.id}>{bank.name}</MenuItem>
                  ))}
                </TextField>
                {/* ลิงก์ต่อกล่องอีเมลพาออกจากหน้า (ค่าที่กรอกหาย) จึงไม่อยู่ในฟอร์ม — ปุ่มอยู่ที่ส่วนกล่องอีเมล */}
                <TextField
                  select
                  label="กล่องอีเมลที่ให้ระบบเข้าไปอ่าน"
                  helperText="กล่องที่รับ statement ของบัญชีนี้ — ต่อกล่องอื่นเพิ่มได้ที่ส่วนกล่องอีเมลในหน้านี้"
                  value={form.email_account_id}
                  onChange={setFormField('email_account_id')}
                  required
                >
                  <MenuItem value=""><em>— เลือก —</em></MenuItem>
                  {(mailboxes ?? []).map((mailbox) => (
                    <MenuItem key={mailbox.id} value={mailbox.id} sx={dataTextSx}>{mailbox.email}</MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>
            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1.5, color: 'text.primary', fontWeight: 600 }}>รายละเอียดบัญชี</FormLabel>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
                <TextField label="ชื่อเล่น" helperText="ชื่อที่ช่วยให้จำบัญชีนี้ได้ง่าย" value={form.nickname} onChange={setFormField('nickname')} required slotProps={{ htmlInput: { maxLength: 60 } }} />
                <TextField label="เลขที่บัญชี" helperText="กรอกตามที่แสดงใน statement" value={form.account_number} onChange={setFormField('account_number')} required slotProps={{ htmlInput: { maxLength: 40 } }} />
                <TextField
                  type={showPassword ? 'text' : 'password'}
                  label="รหัสผ่านเปิดไฟล์ statement"
                  // PATCH ที่ช่องนี้ว่าง server คงรหัสเดิมไว้ (src/routes/accounts.ts)
                  helperText={editingId
                    ? 'เว้นว่างไว้ = ใช้รหัสเดิม · ระบบเก็บแบบเข้ารหัสและไม่แสดงกลับอีก'
                    : 'รหัสเปิดไฟล์ PDF ที่ธนาคารส่งมา · ระบบเก็บแบบเข้ารหัสและไม่แสดงกลับอีก'}
                  value={form.pdf_password}
                  onChange={setFormField('pdf_password')}
                  required={!editingId}
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
                      <MenuItem key={e.id} value={e.id}>{e.display_name}</MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>
            </Box>
            {formError && <Alert severity="error">{formError}</Alert>}
          </Stack>
        </Box>
      </Modal>
      <ConfirmDialog
        open={archiving != null}
        title="เก็บบัญชีเข้าคลัง"
        description={
          <>
            เก็บบัญชี “{archiving?.nickname ?? ''}” เข้าคลังหรือไม่? บัญชีจะหายจากหน้านี้และจากช่องเลือกบัญชี หยุดรับ statement ใหม่
            และไม่นับในยอดคงเหลือรวม ส่วน statement และรายการเดิมยังอยู่ครบ (ยังเห็นในหน้าธุรกรรม) — ตอนนี้ยังไม่มีปุ่มเอากลับ
            {archiveError && <Alert severity="error" sx={{ mt: 2 }}>{archiveError}</Alert>}
          </>
        }
        confirmLabel="เก็บเข้าคลัง"
        confirmColor="error"
        busy={submitting}
        onClose={() => setArchiving(null)}
        onConfirm={() => void archiveAccount()}
        onExited={() => {
          if (focusAddAfterExitRef.current) {
            focusAddAfterExitRef.current = false;
            addButtonRef.current?.focus();
          }
          flushNotice();
        }}
      />

      <Box component="section" aria-labelledby="mailboxes-heading" sx={{ mt: 5 }}>
        <PageHeader
          level={2}
          id="mailboxes-heading"
          title="กล่องอีเมล"
          description='กล่อง Gmail ที่ระบบค้นเฉพาะอีเมล statement จากธนาคาร ระบบดึงให้เองทุกชั่วโมง หรือกด "ดึงอีเมลใหม่" เพื่อดึงทันที'
          action={<Button variant="outlined" startIcon={<AddRounded />} href="/auth/google?add=1" sx={{ whiteSpace: 'nowrap' }}>ต่อกล่องอีเมลอื่นเพิ่ม</Button>}
        />
        <Loaded data={mailboxes} error={loadErrors.mailboxes} onRetry={retry} rows={2}>
          {(rows) => rows.length === 0 ? (
            <EmptyState
              icon={<MailOutlineRounded sx={{ fontSize: 40 }} />}
              title="ยังไม่ได้เชื่อม Gmail"
              description="เชื่อมกล่อง Gmail ที่รับ statement จากธนาคาร ระบบจึงจะนำเข้ารายการให้อัตโนมัติ"
              action={<Button variant="outlined" href="/auth/google?add=1">เชื่อม Gmail</Button>}
            />
          ) : (
            // แถวแบบ DataFreshness แทนตาราง — มีไม่กี่กล่อง ไม่ต้องเลื่อนแนวนอนที่ 320px
            <Paper component="ul" variant="outlined" sx={{ mt: 3, mb: 0, mx: 0, px: 2, py: 0, listStyle: 'none' }}>
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
            {entityError && <Alert severity="error">{entityError}</Alert>}
          </Stack>
        </Box>
      </Modal>

      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
    </Box>
  );
}
