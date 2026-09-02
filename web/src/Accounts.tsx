import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormLabel,
  Link,
  MenuItem,
  Paper,
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
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import { del, patch, post, req, type Account, type Bank, type EmailAccount } from './api.js';
import { createFormFieldChangeHandler } from './form.js';
import Modal from './Modal.js';
import { dataTextSx, descriptionSx } from './theme.js';
import { ConfirmDialog, EmptyState, FeedbackSnackbar, LoadError, PageHeader, TableSkeleton, type Notice } from './ui.js';

const EMPTY = { bank_id: '', email_account_id: '', nickname: '', account_number: '', pdf_password: '', promptpay_id: '' };

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [mailboxes, setMailboxes] = useState<EmailAccount[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const reload = async () => {
    setLoading(true);
    setError('');
    const [accountsResult, banksResult, mailboxesResult] = await Promise.allSettled([
        req<Account[]>('/api/accounts'),
        req<Bank[]>('/api/banks'),
        req<EmailAccount[]>('/api/email-accounts'),
    ]);
    const failures: string[] = [];
    if (accountsResult.status === 'fulfilled') setAccounts(accountsResult.value);
    else failures.push(accountsResult.reason instanceof Error ? accountsResult.reason.message : 'โหลดข้อมูลบัญชีไม่สำเร็จ');
    if (banksResult.status === 'fulfilled') setBanks(banksResult.value);
    else failures.push(banksResult.reason instanceof Error ? banksResult.reason.message : 'โหลดข้อมูลธนาคารไม่สำเร็จ');
    if (mailboxesResult.status === 'fulfilled') setMailboxes(mailboxesResult.value);
    else failures.push(mailboxesResult.reason instanceof Error ? mailboxesResult.reason.message : 'โหลดข้อมูลกล่องอีเมลไม่สำเร็จ');
    setError(failures.join(' • '));
    setLoading(false);
  };
  useEffect(() => { void reload(); }, []);

  const setFormField = createFormFieldChangeHandler(setForm);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditingId(account.id);
    setForm({
      bank_id: String(account.bank_id),
      email_account_id: String(account.email_account_id),
      nickname: account.nickname,
      account_number: account.account_number,
      pdf_password: '',
      promptpay_id: account.promptpay_id ?? '',
    });
    setError('');
    setModalOpen(true);
  };

  return (
    <Box>
      <PageHeader
        level={1}
        id="accounts-heading"
        title="บัญชีธนาคารของฉัน"
        description="จัดการบัญชีและกล่องอีเมลที่ระบบใช้รับข้อมูลจาก statement"
        action={<Button ref={addButtonRef} variant="contained" startIcon={<AddRounded />} onClick={openAdd} sx={{ whiteSpace: 'nowrap' }}>เพิ่มบัญชี</Button>}
      />

      {error && !modalOpen && (
        <LoadError message={error} onRetry={accounts.length === 0 ? () => void reload() : undefined} />
      )}

      {loading ? (
        <TableSkeleton />
      ) : error && accounts.length === 0 ? null
      : accounts.length === 0 ? (
        <EmptyState
          icon={<AccountBalanceRounded sx={{ fontSize: 40 }} />}
          title="ยังไม่มีบัญชีธนาคาร"
          description="เพิ่มบัญชีและเลือกกล่องอีเมลที่รับ statement เพื่อเริ่มนำเข้ารายการโดยอัตโนมัติ"
          action={<Button variant="contained" startIcon={<AddRounded />} onClick={openAdd}>เพิ่มบัญชีแรก</Button>}
        />
      ) : (
        <TableContainer component={Paper} variant="outlined" tabIndex={0} sx={{ mt: 3 }}>
          <Table size="small" aria-label="บัญชีธนาคารของฉัน" sx={{ minWidth: 780 }}>
            <TableHead>
              <TableRow>
                <TableCell>ชื่อเล่น</TableCell>
                <TableCell>ธนาคาร</TableCell>
                <TableCell>เลขที่บัญชี</TableCell>
                <TableCell>กล่องอีเมล</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id} hover>
                  <TableCell>{account.nickname}</TableCell>
                  <TableCell>{account.bank_name}</TableCell>
                  <TableCell><code>{account.account_number}</code></TableCell>
                  <TableCell><code>{account.email}</code></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                      <Button size="small" variant="outlined" startIcon={<EditRounded />} onClick={() => openEdit(account)}>แก้ไข</Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteOutlineRounded />}
                        onClick={() => setDeletingAccount(account)}
                      >
                        ลบ
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal open={modalOpen} title={editingId ? 'แก้ไขบัญชีธนาคาร' : 'เพิ่มบัญชีธนาคาร'} onClose={() => setModalOpen(false)} busy={submitting}>
        <Box
          component="form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            setSubmitting(true);
            try {
              if (editingId) await patch(`/api/accounts/${editingId}`, form);
              else await post('/api/accounts', form);
              setModalOpen(false);
              setNotice({ message: editingId ? 'บันทึกการแก้ไขบัญชีแล้ว' : 'เพิ่มบัญชีธนาคารแล้ว', severity: 'success' });
              await reload();
            } catch (submitError) {
              setError(submitError instanceof Error ? submitError.message : 'บันทึกไม่สำเร็จ');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Stack spacing={2.5}>
            <Box>
              <Typography color="text.secondary" sx={descriptionSx}>
                ก่อนเพิ่มบัญชี ให้ขอ statement ย้อนหลังจากธนาคารส่งเข้ากล่องอีเมลของคุณ ระบบจะใช้เป็นข้อมูลตั้งต้น
              </Typography>
              <Link href="/auth/google?add=1" sx={{ display: 'inline-block', mt: 1 }}>+ ต่อกล่องอีเมลอื่นเพิ่ม</Link>
            </Box>
            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1.5, color: 'text.primary', fontWeight: 650 }}>การเชื่อมต่อ statement</FormLabel>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
                <TextField select label="ธนาคาร" helperText="เลือกธนาคารเจ้าของบัญชี" value={form.bank_id} onChange={setFormField('bank_id')} required autoFocus>
                  <MenuItem value=""><em>— เลือก —</em></MenuItem>
                  {banks.filter((bank) => bank.is_active || String(bank.id) === form.bank_id).map((bank) => (
                    <MenuItem key={bank.id} value={bank.id}>{bank.name}</MenuItem>
                  ))}
                </TextField>
                <TextField select label="กล่องอีเมลที่ให้ระบบเข้าไปอ่าน" helperText="กล่องอีเมลที่รับ statement ของบัญชีนี้" value={form.email_account_id} onChange={setFormField('email_account_id')} required>
                  <MenuItem value=""><em>— เลือก —</em></MenuItem>
                  {mailboxes.map((mailbox) => <MenuItem key={mailbox.id} value={mailbox.id}>{mailbox.email}</MenuItem>)}
                </TextField>
              </Box>
            </Box>
            <Box component="fieldset" sx={{ m: 0, p: 0, minWidth: 0, border: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1.5, color: 'text.primary', fontWeight: 650 }}>รายละเอียดบัญชี</FormLabel>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
                <TextField label="ชื่อเล่น" helperText="ชื่อที่ช่วยให้จำบัญชีนี้ได้ง่าย" value={form.nickname} onChange={setFormField('nickname')} required slotProps={{ htmlInput: { maxLength: 60 } }} />
                <TextField label="เลขที่บัญชี" helperText="กรอกตามที่แสดงใน statement" value={form.account_number} onChange={setFormField('account_number')} required slotProps={{ htmlInput: { maxLength: 40 } }} />
                <TextField
                  type="password"
                  label="รหัสผ่านเปิดไฟล์ statement"
                  helperText={editingId ? 'เว้นว่างเพื่อใช้รหัสเดิม' : 'ใช้สำหรับเปิดไฟล์ PDF ที่ธนาคารส่งมา'}
                  value={form.pdf_password}
                  onChange={setFormField('pdf_password')}
                  required={!editingId}
                  autoComplete="off"
                />
                <TextField label="พร้อมเพย์ (ไม่บังคับ)" helperText="ใช้ช่วยจับคู่รายการโอนภายในครอบครัว" value={form.promptpay_id} onChange={setFormField('promptpay_id')} slotProps={{ htmlInput: { maxLength: 40 } }} />
              </Box>
            </Box>
            <Alert severity="info" sx={descriptionSx}>
              รหัสผ่านถูกเข้ารหัส <Box component="span" sx={dataTextSx}>AES-256-GCM</Box> ก่อนบันทึก และระบบจะไม่ส่งค่ากลับมาแสดงอีก
            </Alert>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button type="button" color="inherit" onClick={() => setModalOpen(false)} disabled={submitting}>ยกเลิก</Button>
              <Button type="submit" variant="contained" disabled={submitting} aria-busy={submitting}>
                {submitting ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มบัญชี'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Modal>
      <ConfirmDialog
        open={Boolean(deletingAccount)}
        title="ลบบัญชีธนาคาร"
        description={`ลบบัญชี “${deletingAccount?.nickname ?? ''}” และรายการทั้งหมดของบัญชีนี้หรือไม่? การดำเนินการนี้ย้อนกลับไม่ได้`}
        confirmLabel="ลบบัญชี"
        confirmColor="error"
        busy={submitting}
        onClose={() => setDeletingAccount(null)}
        onConfirm={async () => {
          if (!deletingAccount) return;
          setSubmitting(true);
          try {
            await del(`/api/accounts/${deletingAccount.id}`);
            setDeletingAccount(null);
            setNotice({ message: 'ลบบัญชีธนาคารแล้ว', severity: 'success' });
            await reload();
            addButtonRef.current?.focus();
          } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'ลบบัญชีไม่สำเร็จ');
            setDeletingAccount(null);
          } finally {
            setSubmitting(false);
          }
        }}
      />
      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
    </Box>
  );
}
