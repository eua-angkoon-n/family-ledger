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
import BlockRounded from '@mui/icons-material/BlockRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import LoginRounded from '@mui/icons-material/LoginRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import { post, req, type User } from './api.js';
import Accounts from './Accounts.js';
import Admin from './Admin.js';
import { brandCopySx, dataTextSx, descriptionSx } from './theme.js';
import { EmptyState, FeedbackSnackbar, PageHeader, type Notice } from './ui.js';

type Page = 'reports' | 'settings';
type SettingsTab = 'accounts' | 'banks' | 'users';

function AuthPanel({ children }: { children: ReactNode }) {
  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: { xs: 2, sm: 3 } }}>
      <Paper component="section" variant="outlined" sx={{ width: 'min(100%, 27rem)', p: { xs: 3, sm: 4 } }}>
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
  const [loggingOut, setLoggingOut] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    req<{ user: User | null; signupInviteRequired: boolean }>('/api/me')
      .then((response) => {
        setUser(response.user);
        setSignupInviteRequired(response.signupInviteRequired);
      })
      .catch(() => setUser(null));
  }, []);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await req('/auth/logout', { method: 'POST' });
      location.reload();
    } catch (error) {
      setLoggingOut(false);
      setNotice({ message: error instanceof Error ? error.message : 'ออกจากระบบไม่สำเร็จ', severity: 'error' });
    }
  };

  if (user === undefined) {
    return (
      <AuthPanel>
        <Stack spacing={2} role="status" aria-label="กำลังโหลดข้อมูลผู้ใช้">
          <Skeleton variant="circular" width={44} height={44} />
          <Skeleton width="55%" height={38} />
          <Skeleton width="90%" height={24} />
          <Skeleton variant="rounded" height={40} sx={{ mt: 1 }} />
        </Stack>
      </AuthPanel>
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
          <Box sx={{ display: 'grid', placeItems: 'center', width: 56, height: 56, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default', color: 'text.primary' }}>
            <AccountBalanceWalletRounded sx={{ fontSize: 34 }} />
          </Box>
          <Box>
            <Typography variant="h1">บัญชีครอบครัว</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, ...descriptionSx }}>
              เปลี่ยน statement จากธนาคารให้เป็นภาพรวมการเงินที่ถูกต้องและดูแลง่าย
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
    const isPending = user.status === 'pending';
    return (
      <>
        <AuthPanel>
          <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
            {isPending
              ? <HourglassTopRounded sx={{ color: 'text.secondary', fontSize: 40 }} />
              : <BlockRounded color="error" sx={{ fontSize: 40 }} />}
            <Box>
              <Typography variant="h1">{isPending ? 'รอการอนุมัติ' : 'ไม่สามารถเข้าใช้งานได้'}</Typography>
              <Typography color="text.secondary" sx={{ mt: 1, ...descriptionSx }}>
                บัญชี <Box component="span" sx={dataTextSx}>{user.email}</Box> {isPending
                  ? 'อยู่ระหว่างรอผู้ดูแลอนุมัติ เมื่อได้รับอนุมัติแล้วจึงจะเริ่มใช้งานได้'
                  : 'ไม่ได้รับอนุมัติให้เข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบหากต้องการตรวจสอบสถานะ'}
              </Typography>
            </Box>
            <Button variant="outlined" startIcon={<LogoutRounded />} onClick={logout} disabled={loggingOut} aria-busy={loggingOut}>
              {loggingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
            </Button>
          </Stack>
        </AuthPanel>
        <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
      </>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: { xs: 56, sm: 64 }, gap: { xs: 0.5, sm: 2 } }}>
            <Stack direction="row" spacing={1} sx={{ mr: 'auto', alignItems: 'center' }}>
              <AccountBalanceWalletRounded sx={{ color: 'text.primary' }} />
              <Typography sx={{ display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap', ...brandCopySx }}>
                บัญชีครอบครัว
              </Typography>
            </Stack>
            <Tabs value={page} onChange={(_, value: Page) => setPage(value)} aria-label="เมนูหลัก">
              <Tab value="reports" aria-label="รายงาน" icon={<AssessmentRounded />} iconPosition="start" label={<Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>รายงาน</Box>} sx={{ minWidth: { xs: 48, sm: 104 }, px: { xs: 1, sm: 2 }, '& .MuiTab-icon': { mr: { xs: 0, sm: 1 } } }} />
              <Tab value="settings" aria-label="ตั้งค่า" icon={<SettingsRounded />} iconPosition="start" label={<Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>ตั้งค่า</Box>} sx={{ minWidth: { xs: 48, sm: 104 }, px: { xs: 1, sm: 2 }, '& .MuiTab-icon': { mr: { xs: 0, sm: 1 } } }} />
            </Tabs>
            <Tooltip title="ออกจากระบบ">
              <span>
                <IconButton color="inherit" aria-label="ออกจากระบบ" onClick={logout} disabled={loggingOut}><LogoutRounded /></IconButton>
              </span>
            </Tooltip>
          </Toolbar>
        </Container>
      </AppBar>

      <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, sm: 4 }, pb: 8 }}>
        {page === 'reports' && (
          <Box component="section" aria-labelledby="reports-heading">
            <PageHeader
              level={1}
              id="reports-heading"
              title="รายงาน"
              description="ภาพรวมรายรับรายจ่ายจะพร้อมเมื่อเชื่อมบัญชีธนาคารและนำเข้า statement แล้ว"
            />
            <EmptyState
              icon={<AssessmentRounded sx={{ fontSize: 40 }} />}
              title="เริ่มต้นด้วยการเชื่อมบัญชีธนาคาร"
              description="เพิ่มบัญชีและเลือกกล่องอีเมลที่รับ statement เพื่อให้ระบบนำเข้าข้อมูลและสร้างรายงานโดยอัตโนมัติ"
              action={(
                <Button
                  variant="contained"
                  startIcon={<SettingsRounded />}
                  onClick={() => { setSettingsTab('accounts'); setPage('settings'); }}
                >
                  ไปตั้งค่าบัญชีธนาคาร
                </Button>
              )}
            />
          </Box>
        )}

        {page === 'settings' && (
          <Box component="section" aria-labelledby="settings-heading">
            <PageHeader
              level={1}
              id="settings-heading"
              title="ตั้งค่า"
              description="จัดการแหล่งข้อมูล สมาชิก และการเชื่อมต่อที่ใช้สร้างบัญชีครอบครัว"
            />
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
      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
    </Box>
  );
}
