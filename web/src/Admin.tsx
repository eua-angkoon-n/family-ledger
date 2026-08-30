import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import PowerSettingsNewRounded from '@mui/icons-material/PowerSettingsNewRounded';
import { del, patch, post, req, type Bank, type User } from './api.js';
import Modal from './Modal.js';

const EMPTY = {
  name: '',
  sender_email: '',
  sender_domain: '',
  subject_monthly: '',
  subject_ondemand: '',
  attachment_filename_pattern: '\\.pdf$',
  parser_key: 'kbank',
};

function Banks() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  const reload = () => { req<Bank[]>('/api/banks').then(setBanks).catch((responseError: Error) => setError(responseError.message)); };
  useEffect(reload, []);

  const set = (key: keyof typeof EMPTY) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (bank: Bank) => {
    setEditingId(bank.id);
    setForm({
      name: bank.name,
      sender_email: bank.sender_email,
      sender_domain: bank.sender_domain,
      subject_monthly: bank.subject_monthly,
      subject_ondemand: bank.subject_ondemand,
      attachment_filename_pattern: bank.attachment_filename_pattern,
      parser_key: bank.parser_key,
    });
    setError('');
    setModalOpen(true);
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography component="h2" variant="h2">ธนาคารที่รองรับ</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>กำหนดรูปแบบอีเมลและตัวแกะข้อมูลของแต่ละธนาคาร</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={openAdd} sx={{ whiteSpace: 'nowrap' }}>เพิ่มธนาคาร</Button>
      </Stack>

      {error && !modalOpen && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined" sx={{ mt: 3 }}>
        <Table size="small" aria-label="ธนาคารที่รองรับ">
          <TableHead>
            <TableRow>
              <TableCell>ชื่อ</TableCell>
              <TableCell>ผู้ส่ง / โดเมน</TableCell>
              <TableCell>หัวข้อรายเดือน / ขอเอง</TableCell>
              <TableCell>สถานะปัจจุบัน</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {banks.map((bank) => (
              <TableRow key={bank.id} hover>
                <TableCell>{bank.name}<br /><code>{bank.parser_key}</code></TableCell>
                <TableCell><code>{bank.sender_email}</code><br /><code>{bank.sender_domain}</code></TableCell>
                <TableCell><code>{bank.subject_monthly}</code><br /><code>{bank.subject_ondemand}</code></TableCell>
                <TableCell>
                  <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
                    <Chip size="small" color={bank.is_active ? 'success' : 'default'} label={bank.is_active ? 'เปิดใช้งานอยู่' : 'ปิดใช้งานอยู่'} />
                    <Button
                      size="small"
                      color={bank.is_active ? 'inherit' : 'success'}
                      startIcon={<PowerSettingsNewRounded />}
                      onClick={() => patch(`/api/banks/${bank.id}`, { is_active: !bank.is_active }).then(reload).catch((responseError: Error) => alert(responseError.message))}
                    >
                      {bank.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    </Button>
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                    <Button size="small" variant="outlined" startIcon={<EditRounded />} onClick={() => openEdit(bank)}>แก้ไข</Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteOutlineRounded />}
                      onClick={() => confirm(`ลบธนาคาร “${bank.name}”?`) && del(`/api/banks/${bank.id}`).then(reload).catch((responseError: Error) => alert(responseError.message))}
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

      <Modal open={modalOpen} title={editingId ? 'แก้ไขข้อมูลธนาคาร' : 'เพิ่มธนาคาร'} onClose={() => setModalOpen(false)}>
        <Box
          component="form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            try {
              if (editingId) await patch(`/api/banks/${editingId}`, form);
              else await post('/api/banks', form);
              setModalOpen(false);
              reload();
            } catch (submitError) {
              setError(submitError instanceof Error ? submitError.message : 'บันทึกไม่สำเร็จ');
            }
          }}
        >
          <Stack spacing={2.5}>
            <Alert severity="info">อีเมลผู้ส่งต้องเป็นอีเมลของธนาคารที่ส่ง statement และโดเมนใช้ตรวจ DKIM</Alert>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 18rem), 1fr))' }}>
              <TextField label="ชื่อธนาคาร" value={form.name} onChange={set('name')} required autoFocus />
              <TextField label="อีเมลผู้ส่งของธนาคาร" value={form.sender_email} onChange={set('sender_email')} required placeholder="statement@kasikornbank.com" />
              <TextField label="โดเมนผู้ส่ง (ตรวจ DKIM)" value={form.sender_domain} onChange={set('sender_domain')} required placeholder="kasikornbank.com" />
              <TextField label="หัวข้ออีเมล statement รายเดือน (regex)" value={form.subject_monthly} onChange={set('subject_monthly')} required />
              <TextField label="หัวข้ออีเมล statement ที่ผู้ใช้ขอเอง (regex)" value={form.subject_ondemand} onChange={set('subject_ondemand')} required />
              <TextField label="ชื่อไฟล์แนบ (regex)" value={form.attachment_filename_pattern} onChange={set('attachment_filename_pattern')} required />
              <TextField select label="ตัวแกะข้อมูล" value={form.parser_key} onChange={set('parser_key')}>
                <MenuItem value="kbank">kbank</MenuItem>
                <MenuItem value="scb">scb</MenuItem>
              </TextField>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button type="button" color="inherit" onClick={() => setModalOpen(false)}>ยกเลิก</Button>
              <Button type="submit" variant="contained">{editingId ? 'บันทึกการแก้ไข' : 'เพิ่มธนาคาร'}</Button>
            </Stack>
          </Stack>
        </Box>
      </Modal>
    </Box>
  );
}

function Users({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const reload = () => { req<User[]>('/api/admin/users').then(setUsers).catch((responseError: Error) => setError(responseError.message)); };
  useEffect(reload, []);

  const setStatus = (user: User, status: User['status']) => {
    if (status === 'rejected' && !confirm(`ปฏิเสธ ${user.email}? สิทธิ์เข้าถึง Gmail จะถูกยกเลิกและลบทิ้ง`)) return;
    patch(`/api/admin/users/${user.id}`, { status }).then(reload).catch((responseError: Error) => setError(responseError.message));
  };

  const setRole = (user: User, isAdmin: boolean) => {
    const label = isAdmin ? 'ผู้ดูแล' : 'ผู้ใช้ทั่วไป';
    if (!confirm(`เปลี่ยนบทบาทของ ${user.email} เป็น “${label}”?`)) return;
    patch(`/api/admin/users/${user.id}`, { is_admin: isAdmin }).then(reload).catch((responseError: Error) => setError(responseError.message));
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography component="h2" variant="h2">ผู้ใช้งาน</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>ปรับสถานะการเข้าใช้งานและบทบาทของสมาชิก</Typography>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined" sx={{ mt: 3 }}>
        <Table size="small" aria-label="ผู้ใช้งาน">
          <TableHead>
            <TableRow><TableCell>อีเมล</TableCell><TableCell>ชื่อ</TableCell><TableCell>สถานะ</TableCell><TableCell>บทบาท</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <code>{user.email}</code>
                      {isSelf && <Chip size="small" color="primary" label="คุณ" />}
                    </Stack>
                  </TableCell>
                  <TableCell>{user.display_name}</TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      aria-label={`สถานะของ ${user.email}`}
                      value={user.status}
                      disabled={isSelf}
                      onChange={(event) => setStatus(user, event.target.value as User['status'])}
                      sx={{ minWidth: 150 }}
                    >
                      <MenuItem value="pending">รออนุมัติ</MenuItem>
                      <MenuItem value="approved">อนุมัติแล้ว</MenuItem>
                      <MenuItem value="rejected">ปฏิเสธ</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      aria-label={`บทบาทของ ${user.email}`}
                      value={user.is_admin ? 'admin' : 'user'}
                      disabled={isSelf}
                      onChange={(event) => setRole(user, event.target.value === 'admin')}
                      sx={{ minWidth: 150 }}
                    >
                      <MenuItem value="user">ผู้ใช้ทั่วไป</MenuItem>
                      <MenuItem value="admin">ผู้ดูแล</MenuItem>
                    </TextField>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default { Banks, Users };
