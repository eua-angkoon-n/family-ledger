import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import AssessmentRounded from '@mui/icons-material/AssessmentRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import LoginRounded from '@mui/icons-material/LoginRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import { post, req, type User } from './api.js';
import Accounts from './Accounts.js';
import Admin from './Admin.js';
import { brandCopySx, dataTextSx, descriptionSx } from './theme.js';

type Page = 'reports' | 'settings';
type SettingsTab = 'accounts' | 'banks' | 'users';

function AuthPanel({ children }: { children: ReactNode }) {
  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper component="section" variant="outlined" sx={{ width: 'min(100%, 26rem)', p: { xs: 3, sm: 4 } }}>
        {children}
      </Paper>
    </Box>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [signupInviteRequired, setSignupInviteRequired] = useState(false);
  const [page, setPage] = useState<Page>('reports');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('accounts');
  const [invite, setInvite] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [submittingInvite, setSubmittingInvite] = useState(false);

  useEffect(() => {
    req<{ user: User | null; signupInviteRequired: boolean }>('/api/me')
      .then((response) => {
        setUser(response.user);
        setSignupInviteRequired(response.signupInviteRequired);
      })
      .catch(() => setUser(null));
  }, []);

  const logout = () => req('/auth/logout', { method: 'POST' }).then(() => location.reload());

  if (user === undefined) {
    return (
      <Container component="main" maxWidth="md" sx={{ py: 4 }} aria-label="กำลังโหลด">
        <Skeleton width={156} height={32} />
        <Skeleton height={52} sx={{ mt: 1 }} />
        <Skeleton variant="rounded" height={180} sx={{ mt: 4 }} />
      </Container>
    );
  }

  if (!user) {
    if (signupInviteRequired) {
      return (
        <AuthPanel>
          <Stack
            component="form"
            spacing={3}
            onSubmit={async (event) => {
              event.preventDefault();
              setInviteError('');
              setSubmittingInvite(true);
              try {
                await post('/auth/signup', { inviteCode: invite });
                location.reload();
              } catch (error) {
                setInviteError(error instanceof Error ? error.message : 'สมัครสมาชิกไม่สำเร็จ');
                setSubmittingInvite(false);
              }
            }}
          >
            <Box>
              <Typography variant="h1">สมัครสมาชิก</Typography>
              <Typography color="text.secondary" sx={{ mt: 1, ...descriptionSx }}>
                ยืนยันบัญชี Google สำเร็จแล้ว กรุณากรอกรหัสเชิญเพื่อเริ่มใช้งาน
              </Typography>
            </Box>
            <TextField
              label="รหัสเชิญ"
              value={invite}
              onChange={(event) => setInvite(event.target.value)}
              autoComplete="one-time-code"
              autoFocus
              required
              fullWidth
            />
            {inviteError && <Alert severity="error">{inviteError}</Alert>}
            <Button type="submit" variant="contained" disabled={submittingInvite} aria-busy={submittingInvite}>
              {submittingInvite ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
            </Button>
          </Stack>
        </AuthPanel>
      );
    }

    return (
      <AuthPanel>
        <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <AccountBalanceWalletRounded color="primary" sx={{ fontSize: 44 }} />
          <Box>
            <Typography variant="h1">บัญชีครอบครัว</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, ...descriptionSx }}>
              เข้าสู่ระบบเพื่อจัดการบัญชีและรายรับรายจ่ายของครอบครัว
            </Typography>
          </Box>
          <Button fullWidth variant="contained" startIcon={<LoginRounded />} onClick={() => { location.href = '/auth/google'; }}>
            เข้าสู่ระบบด้วย Google
          </Button>
        </Stack>
      </AuthPanel>
    );
  }

  if (user.status !== 'approved') {
    return (
      <AuthPanel>
        <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
          <HourglassTopRounded color={user.status === 'pending' ? 'primary' : 'error'} sx={{ fontSize: 40 }} />
          <Box>
            <Typography variant="h1">รอการอนุมัติ</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, ...descriptionSx }}>
              บัญชี <Box component="span" sx={dataTextSx}>{user.email}</Box> สถานะ “<Box component="span" sx={dataTextSx}>{user.status === 'pending' ? 'รออนุมัติ' : 'ถูกปฏิเสธ'}</Box>” — ให้แอดมินอนุมัติก่อนจึงจะใช้งานได้
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<LogoutRounded />} onClick={logout}>ออกจากระบบ</Button>
        </Stack>
      </AuthPanel>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: { xs: 0.5, sm: 2 } }}>
            <Stack direction="row" spacing={1} sx={{ mr: 'auto', alignItems: 'center' }}>
              <AccountBalanceWalletRounded color="primary" />
              <Typography sx={{ display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap', ...brandCopySx }}>
                บัญชีครอบครัว
              </Typography>
            </Stack>
            <Tabs value={page} onChange={(_, value: Page) => setPage(value)} aria-label="เมนูหลัก">
              <Tab value="reports" icon={<AssessmentRounded />} iconPosition="start" label="รายงาน" sx={{ minWidth: { xs: 52, sm: 104 }, '& .MuiTab-icon': { mr: { xs: 0, sm: 1 } } }} />
              <Tab value="settings" icon={<SettingsRounded />} iconPosition="start" label="ตั้งค่า" sx={{ minWidth: { xs: 52, sm: 104 }, '& .MuiTab-icon': { mr: { xs: 0, sm: 1 } } }} />
            </Tabs>
            <Tooltip title="ออกจากระบบ">
              <IconButton color="inherit" aria-label="ออกจากระบบ" onClick={logout}><LogoutRounded /></IconButton>
            </Tooltip>
          </Toolbar>
        </Container>
      </AppBar>

      <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, sm: 4 }, pb: 8 }}>
        {page === 'reports' && (
          <Box component="section" aria-labelledby="reports-heading">
            <Typography component="h1" variant="h1" id="reports-heading">รายงาน</Typography>
          </Box>
        )}

        {page === 'settings' && (
          <Box component="section" aria-labelledby="settings-heading">
            <Typography component="h1" variant="h1" id="settings-heading">ตั้งค่า</Typography>
            <Tabs
              value={settingsTab}
              onChange={(_, value: SettingsTab) => setSettingsTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="เมนูตั้งค่า"
              sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab value="accounts" label="บัญชีธนาคารของฉัน" />
              {user.is_admin && <Tab value="banks" label="ธนาคาร (แอดมิน)" />}
              {user.is_admin && <Tab value="users" label="ผู้ใช้ (แอดมิน)" />}
            </Tabs>

            {settingsTab === 'accounts' && <Accounts />}
            {settingsTab === 'banks' && <Admin.Banks />}
            {settingsTab === 'users' && <Admin.Users currentUserId={user.id} />}
          </Box>
        )}
      </Container>
    </Box>
  );
}
