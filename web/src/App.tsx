import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  type Theme,
} from '@mui/material';
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import AssessmentRounded from '@mui/icons-material/AssessmentRounded';
import CalculateRounded from '@mui/icons-material/CalculateRounded';
import EventRepeatRounded from '@mui/icons-material/EventRepeatRounded';
import BlockRounded from '@mui/icons-material/BlockRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import LoginRounded from '@mui/icons-material/LoginRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import MenuBookRounded from '@mui/icons-material/MenuBookRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import ReceiptRounded from '@mui/icons-material/ReceiptRounded';
import SchoolRounded from '@mui/icons-material/SchoolRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import { req, type User } from './api.js';
import Accounts from './Accounts.js';
import Admin from './Admin.js';
import { isPageEnabled } from './features.js';
import { brandCopySx, dataTextSx, descriptionSx } from './theme.js';
import { FeedbackSnackbar, PageHeader, TableSkeleton, VersionBadge, type Notice } from './ui.js';

// แยก chunk เฉพาะ Dashboard — เป็นหน้าเดียวที่ดึง @mui/x-charts (~600KB) เข้ามา หน้าอื่นไม่ต้องรอโหลดมันด้วย
const Dashboard = lazy(() => import('./pages/Dashboard.js'));
const Transactions = lazy(() => import('./pages/Transactions.js'));
const MonthlyPlan = lazy(() => import('./pages/MonthlyPlan.js'));
const Installments = lazy(() => import('./pages/Installments.js'));
const StudentLoan = lazy(() => import('./pages/StudentLoan.js'));
const TaxDocuments = lazy(() => import('./pages/TaxDocuments.js'));
const TaxSummary = lazy(() => import('./pages/TaxSummary.js'));
const AuditLog = lazy(() => import('./pages/AuditLog.js'));
const Help = lazy(() => import('./pages/Help.js'));

type SettingsTab = 'banks' | 'users' | 'audit';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'แดชบอร์ด', icon: <AssessmentRounded /> },
  { path: '/transactions', label: 'ธุรกรรม', icon: <ReceiptLongRounded /> },
  { path: '/planning', label: 'วางแผน', icon: <EventRepeatRounded /> },
  { path: '/student-loan', label: 'หนี้ กยศ.', icon: <SchoolRounded /> },
  { path: '/tax-documents', label: 'เอกสารภาษี', icon: <ReceiptRounded /> },
  { path: '/tax', label: 'ภาษี', icon: <CalculateRounded /> },
  { path: '/accounts', label: 'บัญชีของฉัน', icon: <AccountBalanceRounded /> },
].filter((n) => isPageEnabled(n.path));

// แอดมินเท่านั้น — ต่อท้ายเมนูทั้งใน tabs และ drawer
const SETTINGS_ITEM = { path: '/settings', label: 'ตั้งค่า', icon: <SettingsRounded /> };

type NavItem = (typeof NAV_ITEMS)[number];

// Tabs อ่าน value จากลูกตรง ๆ แล้ว clone ส่ง selected/onChange/indicator มาให้ — ใส่ Tooltip เป็นลูกของ Tabs ตรง ๆ
// ไม่ได้ (value หาย tab ไม่ active) wrapper นี้จึงรับ value แล้วส่ง props ที่ Tabs ฉีดมาทั้งหมดต่อให้ Tab
// iconOnly (900–1199px) ซ่อนชื่อเมนูไว้ใน Tooltip; aria-label ตั้งตลอดให้ชื่อที่ screen reader อ่านตรงกับชื่อเมนู
function NavTab({ item, iconOnly, ...tabsProps }: { item: NavItem; iconOnly: boolean; value: string }) {
  return (
    <Tooltip title={iconOnly ? item.label : ''}>
      <Tab
        {...tabsProps}
        component={Link}
        to={item.path}
        icon={item.icon}
        iconPosition="start"
        label={iconOnly ? undefined : item.label}
        aria-label={item.label}
        sx={{ minWidth: iconOnly ? 48 : 104 }}
      />
    </Tooltip>
  );
}

// รายการที่เลือกใน drawer ใช้ accent แบบเดียวกับ tab ที่เลือก (พื้นจาง ๆ มาจาก Mui-selected ของ theme อยู่แล้ว)
const drawerItemSx = { '&.Mui-selected, &.Mui-selected .MuiListItemIcon-root': { color: 'primary.main' } } as const;

// Tabs ต้อง value ตรงกับ value ของ Tab ลูกเป๊ะ — ตัดเหลือ segment แรกของ path (ตัด query/segment ย่อยทิ้ง
// เช่น /transactions?month=... ยังนับเป็น /transactions) ไม่ตรงกับ NAV_ITEMS/settings เลย = ไม่มี tab ไหน active
// /audit ตั้งใจไม่อยู่ใน NAV_ITEMS (เหมือน /installments ไม่อยู่แต่ routed) — เข้าถึงผ่านไอคอนข้างปุ่มออกจากระบบ (จอ < md อยู่ใน drawer)
function activeNavPath(pathname: string): string | false {
  if (pathname.startsWith('/installments')) return '/planning';
  const top = '/' + (pathname.split('/')[1] ?? '');
  const known = [...NAV_ITEMS.map((n) => n.path), '/settings'] as string[];
  return known.includes(top) ? top : false;
}

function SettingsPage({ userId }: { userId: number }) {
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('banks');
  return (
    <Box component="section" aria-labelledby="settings-heading">
      <PageHeader
        level={1}
        id="settings-heading"
        title="ตั้งค่า"
        description="จัดการแหล่งข้อมูล สมาชิก และการเชื่อมต่อของ Hyacinthia Ledger"
      />
      <Tabs
        value={settingsTab}
        onChange={(_, value: SettingsTab) => setSettingsTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="เมนูตั้งค่า"
        sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="banks" label="ธนาคาร (แอดมิน)" />
        <Tab value="users" label="ผู้ใช้ (แอดมิน)" />
        <Tab value="audit" label="บันทึกระบบ (แอดมิน)" />
      </Tabs>

      {settingsTab === 'banks' && <Admin.Banks />}
      {settingsTab === 'users' && <Admin.Users currentUserId={userId} />}
      {/* ใช้คอมโพเนนต์เดียวกับหน้า /audit — ต่างกันแค่ variant ที่ส่ง scope=all ไปให้ API */}
      {settingsTab === 'audit' && (
        <Suspense fallback={<TableSkeleton rows={8} />}><AuditLog variant="admin" /></Suspense>
      )}
    </Box>
  );
}

function AuthPanel({ children, version }: { children: ReactNode; version: string | null }) {
  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: { xs: 2, sm: 3 } }}>
      <Paper component="section" variant="outlined" sx={{ width: 'min(100%, 27rem)', p: { xs: 3, sm: 4 } }}>
        {children}
      </Paper>
      <VersionBadge version={version} />
    </Box>
  );
}

export default function App() {
  const routerLocation = useLocation();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [version, setVersion] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // noSsr: ไม่งั้น render แรกได้ false เสมอ แล้วจอกว้างจะเห็นปุ่ม ☰ แวบหนึ่งก่อนสลับเป็น tabs
  const isDesktop = useMediaQuery((theme: Theme) => theme.breakpoints.up('md'), { noSsr: true });
  // ≥ lg tabs มีชื่อเมนู; 900–1199px เหลือไอคอน (แอดมิน 6 tabs มีชื่อจะล้น Toolbar ~174px)
  const isWide = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'), { noSsr: true });

  // ปิด drawer เมื่อเปลี่ยนหน้า (รวมกด back/forward) และเมื่อขยายจอข้าม md ไม่ให้ค้างเปิดอยู่หลัง tabs
  useEffect(() => setMenuOpen(false), [routerLocation.pathname, isDesktop]);

  useEffect(() => {
    req<{ user: User | null; version: string }>('/api/me')
      .then((response) => {
        setUser(response.user);
        setVersion(response.version);
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
      setMenuOpen(false); // Modal ของ drawer ตั้ง aria-hidden ให้ #root — ต้องปิดก่อน screen reader จึงจะอ่าน snackbar ได้
      setNotice({ message: error instanceof Error ? error.message : 'ออกจากระบบไม่สำเร็จ', severity: 'error' });
    }
  };

  if (user === undefined) {
    return (
      <AuthPanel version={version}>
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
    return (
      <AuthPanel version={version}>
        <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Box sx={{ display: 'grid', placeItems: 'center', width: 56, height: 56, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default', color: 'text.primary' }}>
            <AccountBalanceWalletRounded sx={{ fontSize: 34 }} />
          </Box>
          <Box>
            <Typography variant="h1">Hyacinthia Ledger</Typography>
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
        <AuthPanel version={version}>
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

  const navItems = user.is_admin ? [...NAV_ITEMS, SETTINGS_ITEM] : NAV_ITEMS;
  const activeNav = activeNavPath(routerLocation.pathname);
  const closeMenu = () => setMenuOpen(false);

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: { xs: 56, sm: 64 }, gap: { xs: 0.5, sm: 2 } }}>
            <Stack direction="row" spacing={1} sx={{ mr: 'auto', alignItems: 'center' }}>
              <AccountBalanceWalletRounded sx={{ color: 'text.primary' }} />
              <Typography sx={{ whiteSpace: 'nowrap', ...brandCopySx }}>
                Hyacinthia Ledger
              </Typography>
            </Stack>
            {/* nav นี้ mount ตลอดทุกขนาดจอ เพราะคู่มือ (guides.ts) ไฮไลต์ [aria-label="เมนูหลัก"] — Drawer แบบ temporary
                ไม่ render ลูกตอนปิด และ tabs ที่ display:none ให้กรอบ 0×0 ป้ายจึงต้องอยู่ที่กล่องนอกนี้
                order: -1 ใต้ md ย้ายปุ่ม ☰ ไปซ้ายสุดโดยไม่สลับ DOM (แบรนด์ไม่ใช่ปุ่ม ลำดับ focus จึงไม่เพี้ยน)
                minWidth: 0 ให้กล่องหดได้ ไม่งั้น tabs แบบ scrollable จะดันล้น Toolbar แทนที่จะขึ้นลูกศร */}
            <Box component="nav" aria-label="เมนูหลัก" sx={{ order: { xs: -1, md: 0 }, minWidth: 0 }}>
              {isDesktop ? (
                // ช่วงไอคอนล้วนพอดีเสมอ (8 tabs ก็ยังพอ) แต่ ≥ lg แอดมิน 6 tabs มีชื่อเหลือที่แค่ราว ±40px ที่ 1200px และถ้าเปิด
                // หน้าภาษีกลับ (features.ts) เป็น 8 tabs จะล้นแน่ — scrollable กันตัดหายเงียบ ๆ ลูกศรขึ้นเฉพาะตอนล้นจริง
                // ไม่ใส่ aria-label ที่ Tabs เพราะ nav ด้านนอกมีชื่อ "เมนูหลัก" แล้ว (screen reader จะอ่านซ้ำสองรอบ)
                <Tabs value={activeNav} variant="scrollable" scrollButtons="auto">
                  {navItems.map((item) => (
                    <NavTab key={item.path} value={item.path} item={item} iconOnly={!isWide} />
                  ))}
                </Tabs>
              ) : (
                <IconButton
                  color="inherit"
                  aria-label="เปิดเมนู"
                  aria-controls={menuOpen ? 'main-menu-drawer' : undefined}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(true)}
                >
                  <MenuRounded />
                </IconButton>
              )}
            </Box>
            {isDesktop && (
              <>
                <Tooltip title="คู่มือการใช้งาน">
                  <IconButton color="inherit" aria-label="คู่มือการใช้งาน" component={Link} to="/help"><MenuBookRounded /></IconButton>
                </Tooltip>
                <Tooltip title="ประวัติการเปลี่ยนแปลง">
                  <IconButton color="inherit" aria-label="ประวัติการเปลี่ยนแปลง" component={Link} to="/audit"><HistoryRounded /></IconButton>
                </Tooltip>
                <Tooltip title="ออกจากระบบ">
                  <span>
                    <IconButton color="inherit" aria-label="ออกจากระบบ" onClick={logout} disabled={loggingOut}><LogoutRounded /></IconButton>
                  </span>
                </Tooltip>
              </>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* elevation 8 = Floating Menu ตาม DESIGN.md; ขอบขวาช่วยแยกขอบบนพื้นมืดที่เงาแทบมองไม่เห็น */}
      <Drawer
        anchor="left"
        open={menuOpen}
        onClose={closeMenu}
        elevation={8}
        slotProps={{
          paper: {
            id: 'main-menu-drawer',
            role: 'dialog',
            'aria-modal': true,
            'aria-label': 'เมนูทั้งหมด',
            sx: { width: 'min(85vw, 300px)', borderRight: 1, borderColor: 'divider' },
          },
        }}
      >
        <List>
          {/* ListItem = <li> ครอบปุ่ม ไม่งั้น <a>/<div> อยู่ใน <ul> ตรง ๆ ผิดโครง list */}
          {navItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={activeNav === item.path}
                aria-current={activeNav === item.path ? 'page' : undefined}
                onClick={closeMenu}
                sx={drawerItemSx}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/help" onClick={closeMenu}>
              <ListItemIcon><MenuBookRounded /></ListItemIcon>
              <ListItemText primary="คู่มือการใช้งาน" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/audit" onClick={closeMenu}>
              <ListItemIcon><HistoryRounded /></ListItemIcon>
              <ListItemText primary="ประวัติการเปลี่ยนแปลง" />
            </ListItemButton>
          </ListItem>
          {/* ไม่ปิด drawer ตอนกด ให้เห็นสถานะกำลังออก — ถ้าล้มเหลว logout() ปิดให้เองแล้วแจ้งใน snackbar */}
          <ListItem disablePadding>
            <ListItemButton onClick={logout} disabled={loggingOut} aria-busy={loggingOut}>
              <ListItemIcon><LogoutRounded /></ListItemIcon>
              <ListItemText primary={loggingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'} />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, sm: 4 }, pb: 8 }}>
        <Suspense fallback={<TableSkeleton rows={6} />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Box component="section" aria-labelledby="dashboard-heading"><Dashboard /></Box>} />
            <Route path="/transactions" element={<Box component="section" aria-labelledby="transactions-heading"><Transactions /></Box>} />
            <Route path="/planning" element={<Box component="section" aria-labelledby="planning-heading"><MonthlyPlan /></Box>} />
            <Route path="/installments" element={<Installments />} />
            <Route path="/installments/:id" element={<Installments />} />
            <Route path="/student-loan" element={<Box component="section" aria-labelledby="student-loan-heading"><StudentLoan /></Box>} />
            {isPageEnabled('/tax-documents') && <Route path="/tax-documents" element={<Box component="section" aria-labelledby="tax-documents-heading"><TaxDocuments /></Box>} />}
            {isPageEnabled('/tax') && <Route path="/tax" element={<Box component="section" aria-labelledby="tax-summary-heading"><TaxSummary /></Box>} />}
            <Route path="/audit" element={<Box component="section" aria-labelledby="audit-log-heading"><AuditLog /></Box>} />
            <Route path="/help" element={<Box component="section" aria-labelledby="help-heading"><Help /></Box>} />
            <Route path="/accounts" element={<Box component="section" aria-labelledby="accounts-heading"><Accounts /></Box>} />
            {user.is_admin && <Route path="/settings" element={<SettingsPage userId={user.id} />} />}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </Container>
      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
      <VersionBadge version={version} />
    </Box>
  );
}
