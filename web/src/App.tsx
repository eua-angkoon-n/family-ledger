import { lazy, Suspense, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Alert,
  AppBar,
  Badge,
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
import { req, type EmailAccount, type MeResponse, type User } from './api.js';
import Accounts from './Accounts.js';
import ThemeModeToggle from './components/ThemeModeToggle.js';
import { isPageEnabled } from './features.js';
import { brandCopySx, dataTextSx, descriptionSx } from './theme.js';
import { APP_NAME, FeedbackSnackbar, TableSkeleton, VersionBadge, visuallyHiddenSx, type Notice } from './ui.js';

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
// แอดมินเท่านั้น — ผู้ใช้ทั่วไปไม่ต้องโหลดโค้ดหน้าตั้งค่า
const SettingsPage = lazy(() => import('./Admin.js'));

// ?gmail=<code> ที่ OAuth callback ส่งกลับมาหลังเชื่อม/เชื่อม Gmail ใหม่ — โค้ดที่ไม่รู้จักไม่แสดงอะไร
const GMAIL_NOTICE: Record<string, Notice> = {
  connected: { message: 'เชื่อม Gmail สำเร็จ', severity: 'success' },
  not_granted: { message: 'ยังไม่ได้เชื่อม Gmail: ต้องติ๊กอนุญาตให้อ่านอีเมลในหน้าของ Google ระบบจึงนำเข้า statement ได้', severity: 'error' },
  denied: { message: 'ยกเลิกการเชื่อม Gmail แล้ว ไม่มีอะไรเปลี่ยน', severity: 'info' },
  wrong_account: { message: 'บัญชี Google ที่เลือกไม่ตรงกับกล่องอีเมลที่จะเชื่อมใหม่ ลองอีกครั้งแล้วเลือกบัญชีให้ถูก', severity: 'error' },
  no_refresh_token: { message: 'Google ไม่ได้ส่งสิทธิ์ระยะยาวกลับมา ลองเชื่อม Gmail ใหม่อีกครั้ง', severity: 'error' },
};

// แถบเตือนทุกหน้า: กล่องอีเมลที่ Google ปฏิเสธสิทธิ์ (invalid_grant) หรือยังไม่มีกล่องอีเมลเลย — ทั้งสองกรณีนำเข้า statement ไม่ได้
// ปุ่มไป /auth/google ต้องเป็น <a href> (โหลดทั้งหน้าไป OAuth) ไม่ใช่ Link ของ router; ปุ่มอยู่ใต้ข้อความ ไม่ใช้ action
// ของ Alert เพราะที่ 320px ข้อความจะเหลือที่แคบมาก · ไม่พิมพ์ (ไม่งั้นติดหัวคู่มือ/หน้าภาษีบนกระดาษ)
function GmailBanner({ mailboxes }: { mailboxes: EmailAccount[] | null }) {
  if (!mailboxes) return null;
  if (mailboxes.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 3, displayPrint: 'none', ...descriptionSx }}>
        ยังไม่ได้เชื่อม Gmail — ระบบยังนำเข้า statement ไม่ได้
        <Box sx={{ mt: 1 }}><Button variant="outlined" color="inherit" href="/auth/google?add=1">เชื่อม Gmail</Button></Box>
      </Alert>
    );
  }
  const broken = mailboxes.filter((m) => m.reauth_required_at);
  if (broken.length === 0) return null;
  return (
    <Alert severity="error" sx={{ mb: 3, displayPrint: 'none', ...descriptionSx }}>
      ต้องเชื่อม Gmail ใหม่: สิทธิ์อ่านอีเมลของ <Box component="span" sx={{ ...dataTextSx, overflowWrap: 'anywhere' }}>{broken.map((m) => m.email).join(', ')}</Box>{' '}
      หมดอายุหรือถูกยกเลิก ระบบจึงหยุดนำเข้า statement จากกล่องอีเมลนี้
      <Box sx={{ mt: 1 }}>
        {broken.length === 1
          ? <Button variant="outlined" color="inherit" href={`/auth/google?reconnect=${broken[0].id}`}>เชื่อม Gmail ใหม่</Button>
          : <Button variant="outlined" color="inherit" component={Link} to="/accounts#mailboxes-heading">เชื่อม Gmail ใหม่</Button>}
      </Box>
    </Alert>
  );
}

// a11yLabel = ชื่อที่ screen reader อ่านเมื่อต่างจากชื่อที่เห็น (ตั้งค่า + จำนวนผู้ใช้รออนุมัติ)
type NavItem = { path: string; label: string; icon: ReactElement; a11yLabel?: string };

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'แดชบอร์ด', icon: <AssessmentRounded /> },
  { path: '/transactions', label: 'ธุรกรรม', icon: <ReceiptLongRounded /> },
  { path: '/planning', label: 'วางแผน', icon: <EventRepeatRounded /> },
  { path: '/student-loan', label: 'หนี้ กยศ.', icon: <SchoolRounded /> },
  { path: '/tax-documents', label: 'เอกสารภาษี', icon: <ReceiptRounded /> },
  { path: '/tax', label: 'ภาษี', icon: <CalculateRounded /> },
  { path: '/accounts', label: 'บัญชีของฉัน', icon: <AccountBalanceRounded /> },
].filter((n) => isPageEnabled(n.path));

// แอดมินเท่านั้น — ต่อท้ายเมนูทั้งใน tabs และ drawer · มีผู้ใช้รออนุมัติ = ตัวนับ warning บนไอคอน (The Issue Count Rule)
// ตัวเลขซ่อนจาก screen reader แล้วบอกเป็นประโยคในชื่อของเมนูแทน
function settingsItem(pending: number): NavItem {
  if (pending <= 0) return { path: '/settings', label: 'ตั้งค่า', icon: <SettingsRounded /> };
  return {
    path: '/settings',
    label: 'ตั้งค่า',
    a11yLabel: `ตั้งค่า (รออนุมัติ ${pending} คน)`,
    icon: (
      <Badge badgeContent={pending} max={99} color="warning" slotProps={{ badge: { 'aria-hidden': true } }}>
        <SettingsRounded />
      </Badge>
    ),
  };
}

// Tabs อ่าน value จากลูกตรง ๆ แล้ว clone ส่ง selected/onChange/indicator มาให้ — ใส่ Tooltip เป็นลูกของ Tabs ตรง ๆ
// ไม่ได้ (value หาย tab ไม่ active) wrapper นี้จึงรับ value แล้วส่ง props ที่ Tabs ฉีดมาทั้งหมดต่อให้ Tab
// iconOnly (900–1199px) ซ่อนชื่อเมนูไว้ใน Tooltip; aria-label ตั้งตลอดให้ชื่อที่ screen reader อ่านตรงกับชื่อเมนู
function NavTab({ item, iconOnly, ...tabsProps }: { item: NavItem; iconOnly: boolean; value: string }) {
  return (
    <Tooltip title={iconOnly ? (item.a11yLabel ?? item.label) : ''}>
      <Tab
        {...tabsProps}
        component={Link}
        to={item.path}
        icon={item.icon}
        iconPosition="start"
        label={iconOnly ? undefined : item.label}
        aria-label={item.a11yLabel ?? item.label}
        sx={{ minWidth: iconOnly ? 48 : 104 }}
      />
    </Tooltip>
  );
}

// รายการที่เลือกใน drawer เหมือน tab ที่เลือก: พื้น sidebar-accent มาจาก theme ส่วนนี้ทำให้ไอคอนใช้สีตัวอักษรเดียวกัน
const drawerItemSx = { '&.Mui-selected, &.Mui-selected .MuiListItemIcon-root': { color: 'brand.sidebarAccentForeground' } } as const;
// ไอคอนคู่มือ/ประวัติบน AppBar ตอนอยู่หน้านั้น = สีเดียวกับ tab ที่เลือก · ring ใช้สีตัวอักษร (ring ของธีมบน sidebar-accent ไม่ผ่าน)
const activeIconSx = {
  bgcolor: 'brand.sidebarAccent',
  color: 'brand.sidebarAccentForeground',
  '&:hover': { bgcolor: 'brand.sidebarAccent' },
  '&.Mui-focusVisible': { outlineColor: 'currentColor' },
} as const;

// Tabs ต้อง value ตรงกับ value ของ Tab ลูกเป๊ะ — ตัดเหลือ segment แรกของ path (ตัด query/segment ย่อยทิ้ง
// เช่น /transactions?month=... ยังนับเป็น /transactions) ไม่ตรงกับ NAV_ITEMS/settings เลย = ไม่มี tab ไหน active
// /audit ตั้งใจไม่อยู่ใน NAV_ITEMS (เหมือน /installments ไม่อยู่แต่ routed) — เข้าถึงผ่านไอคอนข้างปุ่มออกจากระบบ (จอ < md อยู่ใน drawer)
function activeNavPath(pathname: string): string | false {
  if (pathname.startsWith('/installments')) return '/planning';
  const top = '/' + (pathname.split('/')[1] ?? '');
  const known = [...NAV_ITEMS.map((n) => n.path), '/settings'] as string[];
  return known.includes(top) ? top : false;
}

function AuthPanel({ children, version }: { children: ReactNode; version: string | null }) {
  return (
    // แถว auto ล่าง = เลขเวอร์ชัน (< sm อยู่ในลำดับเนื้อหา) — กล่องยังอยู่กลางจอ ≥ sm เลขเวอร์ชัน fixed แถวนี้จึงว่าง
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', gridTemplateRows: '1fr auto', placeItems: 'center', p: { xs: 2, sm: 3 } }}>
      <Box sx={{ position: 'fixed', top: { xs: 8, sm: 16 }, right: { xs: 8, sm: 16 } }}>
        <ThemeModeToggle />
      </Box>
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
  // จำนวนผู้ใช้รออนุมัติ (มีค่าเฉพาะแอดมิน) — ตัวนับบนเมนูตั้งค่าและแท็บผู้ใช้
  const [pendingUserCount, setPendingUserCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  // OAuth callback ส่งผลกลับมาเป็น ?auth_error= / ?gmail= — อ่านตอน render แรก (ก่อน `/` ถูก Navigate ไป /dashboard จน query หาย)
  const [oauthParams] = useState(() => new URLSearchParams(window.location.search));
  const authError = oauthParams.get('auth_error');
  const [notice, setNotice] = useState<Notice | null>(() => GMAIL_NOTICE[oauthParams.get('gmail') ?? ''] ?? null);
  // null = ยังโหลดไม่เสร็จ/โหลดไม่ได้ → ไม่แสดงแถบ (กันแถบ "ยังไม่ได้เชื่อม Gmail" แวบขึ้นก่อนข้อมูลมา)
  const [mailboxes, setMailboxes] = useState<EmailAccount[] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // noSsr: ไม่งั้น render แรกได้ false เสมอ แล้วจอกว้างจะเห็นปุ่ม ☰ แวบหนึ่งก่อนสลับเป็น tabs
  const isDesktop = useMediaQuery((theme: Theme) => theme.breakpoints.up('md'), { noSsr: true });
  // ≥ lg tabs มีชื่อเมนู; 900–1199px เหลือไอคอน (แอดมิน 6 tabs มีชื่อจะล้น Toolbar ~174px)
  const isWide = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'), { noSsr: true });

  // ปิด drawer เมื่อเปลี่ยนหน้า (รวมกด back/forward) และเมื่อขยายจอข้าม md ไม่ให้ค้างเปิดอยู่หลัง tabs
  useEffect(() => setMenuOpen(false), [routerLocation.pathname, isDesktop]);

  // ลบ query ของ OAuth ออกจาก URL หลังอ่านแล้ว ไม่ให้ refresh/แชร์ลิงก์แล้วข้อความขึ้นซ้ำ
  useEffect(() => {
    if (!oauthParams.has('auth_error') && !oauthParams.has('gmail')) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('auth_error');
    url.searchParams.delete('gmail');
    window.history.replaceState(window.history.state, '', url);
  }, [oauthParams]);

  useEffect(() => {
    if (user?.status !== 'approved') return;
    req<EmailAccount[]>('/api/email-accounts').then(setMailboxes).catch(() => {}); // แถบเสริม — โหลดไม่ได้ก็ไม่แสดง
  }, [user?.status]);

  useEffect(() => {
    req<MeResponse>('/api/me')
      .then((response) => {
        setUser(response.user);
        setVersion(response.version);
        setPendingUserCount(response.pending_user_count ?? 0);
      })
      .catch(() => setUser(null));
  }, []);
  // หลังแอดมินเปลี่ยนสถานะผู้ใช้ในหน้าตั้งค่า — อ่านเฉพาะตัวนับใหม่ (ตัวนับเป็นของเสริม โหลดไม่ได้คงค่าเดิม)
  const refreshPendingUserCount = () => {
    req<MeResponse>('/api/me').then((response) => setPendingUserCount(response.pending_user_count ?? 0)).catch(() => {});
  };

  // หน้าก่อนเข้าระบบไม่มี PageHeader (ที่ตั้ง document.title ให้หน้าอื่น) — ตั้งชื่อแท็บที่นี่
  useEffect(() => {
    if (user === undefined || user?.status === 'approved') return;
    const page = !user ? 'เข้าสู่ระบบ' : user.status === 'pending' ? 'รอการอนุมัติ' : 'ไม่สามารถเข้าใช้งานได้';
    document.title = `${page} · ${APP_NAME}`;
  }, [user]);

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
          <Skeleton variant="circular" width={72} height={72} />
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
          <Box component="img" src="/logo-192.png" alt="" width={72} height={72} sx={{ display: 'block' }} />
          <Box>
            <Typography variant="h1">Hyacinthia Ledger</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, ...descriptionSx }}>
              เปลี่ยน statement จากธนาคารให้เป็นภาพรวมการเงินที่ถูกต้องและดูแลง่าย
            </Typography>
          </Box>
          {authError && (
            <Alert severity={authError === 'access_denied' ? 'info' : 'error'} sx={{ width: '100%', textAlign: 'left', ...descriptionSx }}>
              {authError === 'access_denied' ? 'คุณยกเลิกการเข้าสู่ระบบกับ Google' : 'เข้าสู่ระบบกับ Google ไม่สำเร็จ ลองใหม่อีกครั้ง'}
            </Alert>
          )}
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

  const navItems = user.is_admin ? [...NAV_ITEMS, settingsItem(pendingUserCount)] : NAV_ITEMS;
  const activeNav = activeNavPath(routerLocation.pathname);
  // คู่มือ/ประวัติไม่อยู่ใน tabs — ไอคอนบน AppBar และรายการใน drawer บอกเองว่าอยู่หน้านั้น (aria-current + พื้น sidebar-accent)
  const topPath = '/' + (routerLocation.pathname.split('/')[1] ?? '');
  const onHelp = topPath === '/help';
  const onAudit = topPath === '/audit';
  const closeMenu = () => setMenuOpen(false);

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider', displayPrint: 'none' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: { xs: 56, sm: 64 }, gap: { xs: 0.5, sm: 2 } }}>
            <Stack direction="row" spacing={1} sx={{ mr: 'auto', alignItems: 'center' }}>
              <Box component="img" src="/logo-192.png" alt="" width={32} height={32} sx={{ display: 'block' }} />
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
                // มีผู้ใช้รออนุมัติ (แอดมิน) = จุด warning บน ☰ ตัวเลขอยู่ที่ตั้งค่าใน drawer — screen reader ได้ประโยคในชื่อปุ่ม
                <IconButton
                  color="inherit"
                  aria-label={pendingUserCount > 0 ? `เปิดเมนู (รออนุมัติ ${pendingUserCount} คน)` : 'เปิดเมนู'}
                  aria-controls={menuOpen ? 'main-menu-drawer' : undefined}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(true)}
                >
                  <Badge variant="dot" color="warning" invisible={pendingUserCount <= 0}>
                    <MenuRounded />
                  </Badge>
                </IconButton>
              )}
            </Box>
            {/* ทุกขนาดจอ: อยู่นอก nav "เมนูหลัก" (ไม่ใช่ปลายทางนำทาง และคู่มือไฮไลต์กล่อง nav ทั้งกล่อง)
                ≥ md อยู่ก่อนไอคอนคู่มือ; < md อยู่ขวาของแบรนด์ (แบรนด์ mr: auto ดันไปชิดขวา) กดได้โดยไม่ต้องเปิด drawer */}
            <ThemeModeToggle />
            {isDesktop && (
              <>
                <Tooltip title="คู่มือการใช้งาน">
                  <IconButton
                    color="inherit"
                    aria-label="คู่มือการใช้งาน"
                    aria-current={onHelp ? 'page' : undefined}
                    component={Link}
                    to="/help"
                    sx={onHelp ? activeIconSx : undefined}
                  >
                    <MenuBookRounded />
                  </IconButton>
                </Tooltip>
                <Tooltip title="ประวัติการเปลี่ยนแปลง">
                  <IconButton
                    color="inherit"
                    aria-label="ประวัติการเปลี่ยนแปลง"
                    aria-current={onAudit ? 'page' : undefined}
                    component={Link}
                    to="/audit"
                    sx={onAudit ? activeIconSx : undefined}
                  >
                    <HistoryRounded />
                  </IconButton>
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

      {/* elevation 8 = Floating Offset (shadow-md) ตาม DESIGN.md; พื้น sidebar เฉพาะเมนูนี้ (drawer เนื้อหาใช้ popover จาก theme);
          ขอบขวาแยก drawer ออกจากเนื้อหา */}
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
            sx: { width: 'min(85vw, 300px)', bgcolor: 'brand.sidebar', borderRight: 1, borderColor: 'divider' },
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
                {/* ไม่ใช้ aria-label ที่ปุ่ม (จะทับข้อความที่เห็น) — ส่วนที่ต่างจากชื่อที่เห็นเป็นข้อความซ่อน */}
                <ListItemText
                  primary={item.a11yLabel
                    ? <>{item.label}<Box component="span" sx={visuallyHiddenSx}>{item.a11yLabel.slice(item.label.length)}</Box></>
                    : item.label}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/help" selected={onHelp} aria-current={onHelp ? 'page' : undefined} onClick={closeMenu} sx={drawerItemSx}>
              <ListItemIcon><MenuBookRounded /></ListItemIcon>
              <ListItemText primary="คู่มือการใช้งาน" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/audit" selected={onAudit} aria-current={onAudit ? 'page' : undefined} onClick={closeMenu} sx={drawerItemSx}>
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

      {/* < sm เลขเวอร์ชันต่อท้ายหน้า (ไม่ลอย) ระยะล่างรวมกับบรรทัดเวอร์ชันจึงใกล้เดิม */}
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, sm: 4 }, pb: { xs: 4, sm: 8 } }}>
        <GmailBanner mailboxes={mailboxes} />
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
            {/* แอดมินสลับ "ของฉัน / ทุกคน" ที่ /audit เอง (?scope=all) — หน้าตั้งค่ามีแค่ลิงก์มา */}
            <Route path="/audit" element={<Box component="section" aria-labelledby="audit-log-heading"><AuditLog isAdmin={user.is_admin} /></Box>} />
            <Route path="/help" element={<Box component="section" aria-labelledby="help-heading"><Help isAdmin={user.is_admin} /></Box>} />
            <Route path="/accounts" element={<Box component="section" aria-labelledby="accounts-heading"><Accounts /></Box>} />
            {user.is_admin && (
              <Route
                path="/settings"
                element={<SettingsPage userId={user.id} pendingUserCount={pendingUserCount} onUsersChanged={refreshPendingUserCount} />}
              />
            )}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </Container>
      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
      <VersionBadge version={version} />
    </Box>
  );
}
