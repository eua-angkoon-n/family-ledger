import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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

const EMPTY = { bank_id: '', email_account_id: '', nickname: '', account_number: '', pdf_password: '', promptpay_id: '' };

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [mailboxes, setMailboxes] = useState<EmailAccount[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  const reload = () => {
    req<Account[]>('/api/accounts').then(setAccounts).catch((responseError: Error) => setError(responseError.message));
    req<Bank[]>('/api/banks').then(setBanks).catch((responseError: Error) => setError(responseError.message));
    req<EmailAccount[]>('/api/email-accounts').then(setMailboxes).catch((responseError: Error) => setError(responseError.message));
  };
  useEffect(reload, []);

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
    <Box sx={{ mt: 4 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography component="h2" variant="h2">บัญชีธนาคารของฉัน</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>จัดการบัญชีที่ใช้รับข้อมูลจาก statement</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={openAdd} sx={{ whiteSpace: 'nowrap' }}>เพิ่มบัญชี</Button>
      </Stack>

      {error && !modalOpen && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {accounts.length === 0 ? (
        <Box sx={{ mt: 3, py: 5, px: 2, textAlign: 'center', border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1 }}>
          <AccountBalanceRounded color="primary" sx={{ fontSize: 36 }} />
          <Typography color="text.secondary" sx={{ mt: 1 }}>ยังไม่มีบัญชีธนาคาร กด “เพิ่มบัญชี” เพื่อเริ่มต้น</Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 3 }}>
          <Table size="small" aria-label="บัญชีธนาคารของฉัน">
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
                        onClick={() => confirm(`ลบบัญชี “${account.nickname}” และรายการทั้งหมดของบัญชีนี้?`) && del(`/api/accounts/${account.id}`).then(reload).catch((responseError: Error) => alert(responseError.message))}
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

      <Modal open={modalOpen} title={editingId ? 'แก้ไขบัญชีธนาคาร' : 'เพิ่มบัญชีธนาคาร'} onClose={() => setModalOpen(false)}>
        <Box
          component="form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            try {
              if (editingId) await patch(`/api/accounts/${editingId}`, form);
              else await post('/api/accounts', form);
              setModalOpen(false);
              reload();
            } catch (submitError) {
              setError(submitError instanceof Error ? submitError.message : 'บันทึกไม่สำเร็จ');
            }
          }}
        >
          <Stack spacing={2.5}>
            <Box>
              <Typography color="text.secondary">
                ก่อนเพิ่มบัญชี ให้ขอ statement ย้อนหลังจากธนาคารส่งเข้ากล่องอีเมลของคุณ ระบบจะใช้เป็นข้อมูลตั้งต้น
              </Typography>
              <Link href="/auth/google?add=1" sx={{ display: 'inline-block', mt: 1 }}>+ ต่อกล่องอีเมลอื่นเพิ่ม</Link>
            </Box>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}>
              <TextField select label="ธนาคาร" value={form.bank_id} onChange={setFormField('bank_id')} required autoFocus>
                <MenuItem value=""><em>— เลือก —</em></MenuItem>
                {banks.filter((bank) => bank.is_active || String(bank.id) === form.bank_id).map((bank) => (
                  <MenuItem key={bank.id} value={bank.id}>{bank.name}</MenuItem>
                ))}
              </TextField>
              <TextField label="ชื่อเล่น" value={form.nickname} onChange={setFormField('nickname')} required slotProps={{ htmlInput: { maxLength: 60 } }} />
              <TextField select label="กล่องอีเมลที่ให้ระบบเข้าไปอ่าน" value={form.email_account_id} onChange={setFormField('email_account_id')} required>
                <MenuItem value=""><em>— เลือก —</em></MenuItem>
                {mailboxes.map((mailbox) => <MenuItem key={mailbox.id} value={mailbox.id}>{mailbox.email}</MenuItem>)}
              </TextField>
              <TextField label="เลขที่บัญชี" value={form.account_number} onChange={setFormField('account_number')} required slotProps={{ htmlInput: { maxLength: 40 } }} />
              <TextField
                type="password"
                label="รหัสผ่านเปิดไฟล์ statement"
                value={form.pdf_password}
                onChange={setFormField('pdf_password')}
                required={!editingId}
                placeholder={editingId ? 'เว้นว่างเพื่อใช้รหัสเดิม' : undefined}
                autoComplete="off"
              />
              <TextField label="พร้อมเพย์ (ไม่บังคับ)" value={form.promptpay_id} onChange={setFormField('promptpay_id')} slotProps={{ htmlInput: { maxLength: 40 } }} />
            </Box>
            <Alert severity="info">รหัสผ่านถูกเข้ารหัส AES-256-GCM ก่อนบันทึก และระบบจะไม่ส่งค่ากลับมาแสดงอีก</Alert>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button type="button" color="inherit" onClick={() => setModalOpen(false)}>ยกเลิก</Button>
              <Button type="submit" variant="contained">{editingId ? 'บันทึกการแก้ไข' : 'เพิ่มบัญชี'}</Button>
            </Stack>
          </Stack>
        </Box>
      </Modal>
    </Box>
  );
}
