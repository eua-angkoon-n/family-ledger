import { lazy, Suspense, useEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Alert,
  AppBar,
  Badge,
  Box,
  Button,
  CircularProgress,
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
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import MenuBookRounded from '@mui/icons-material/MenuBookRounded';
import OpenInBrowserRounded from '@mui/icons-material/OpenInBrowserRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import SchoolRounded from '@mui/icons-material/SchoolRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import SwitchAccountRounded from '@mui/icons-material/SwitchAccountRounded';
import { req, type EmailAccount, type MeResponse, type User } from './api.js';
import ThemeModeToggle from './components/ThemeModeToggle.js';
import { isPageEnabled } from './features.js';
import { brandCopySx, dataTextSx, descriptionSx, radii } from './theme.js';
import { APP_NAME, emailText, FeedbackSnackbar, TableSkeleton, VersionBadge, visuallyHiddenSx, type Notice } from './ui.js';

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
const Accounts = lazy(() => import('./Accounts.js'));
// แอดมินเท่านั้น — ผู้ใช้ทั่วไปไม่ต้องโหลดโค้ดหน้าตั้งค่า
const SettingsPage = lazy(() => import('./Admin.js'));

// ?auth_error=<code> ที่ OAuth callback ส่งกลับมาเมื่อเข้าสู่ระบบไม่สำเร็จ — โค้ดที่ไม่รู้จักใช้ข้อความของ failed
const AUTH_ERROR_NOTICE: Record<string, Notice> = {
  access_denied: { message: 'คุณยกเลิกการเข้าสู่ระบบกับ Google', severity: 'info' },
  expired: { message: 'ลิงก์เข้าสู่ระบบหมดอายุ กดเข้าสู่ระบบอีกครั้ง', severity: 'warning' },
  // ล็อก 15 นาทีนับทั้งเครือข่าย (rate limit ฝั่ง server) — "รอสักครู่" ทำให้ลองซ้ำแล้วติดต่อ
  rate_limited: { message: 'ลองเข้าสู่ระบบหลายครั้งเกินไปจากเครือข่ายนี้ รอประมาณ 15 นาทีแล้วลองใหม่', severity: 'warning' },
  failed: { message: 'เข้าสู่ระบบกับ Google ไม่สำเร็จ ลองใหม่อีกครั้ง', severity: 'error' },
};
const authErrorNotice = (code: string | null) => (code === null ? null : AUTH_ERROR_NOTICE[code] ?? AUTH_ERROR_NOTICE.failed);

// Google ไม่ให้เข้าสู่ระบบในเบราว์เซอร์ของแอป (403 disallowed_useragent) — เตือนก่อนกด ไม่ใช่ปล่อยไปเจอหน้า error ของ Google
const userAgent = navigator.userAgent;
const IN_APP_BROWSER = /Line\//.test(userAgent) ? 'LINE' : /Instagram/.test(userAgent) ? 'Instagram' : /FBAN|FBAV/.test(userAgent) ? 'Facebook' : null;

// URL ของหน้านี้โดยไม่มีผลของ OAuth และ openExternalBrowser (refresh/แชร์/เปิดในเบราว์เซอร์อื่นแล้วข้อความเดิมไม่ขึ้นซ้ำ)
// openExternal: LINE เปิด URL ที่มี openExternalBrowser=1 ในเบราว์เซอร์ภายนอกให้เอง
const TRANSIENT_PARAMS = ['auth_error', 'gmail', 'openExternalBrowser'];
function pageUrl(openExternal = false) {
  const url = new URL(window.location.href);
  for (const key of TRANSIENT_PARAMS) url.searchParams.delete(key);
  if (openExternal) url.searchParams.set('openExternalBrowser', '1');
  return url.toString();
}

// สำรองของ navigator.clipboard (บาง WebView ไม่มี/ไม่ให้สิทธิ์) — textarea ชั่วคราว + execCommand แล้วคืน focus ให้ปุ่มเดิม
// font-size 16px กัน iOS ซูมตอน select · คืน false = คัดลอกไม่ได้
function copyWithTextarea(text: string) {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
  document.body.append(area);
  area.focus(); // execCommand คัดลอก selection ของ element ที่ focus อยู่
  area.select();
  area.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    // บางเบราว์เซอร์ throw แทนคืน false
  }
  area.remove();
  active?.focus();
  return copied;
}

// โลโก้ "G" ของ Google สีตาม brand guideline — guideline ให้ G อยู่บนพื้นขาว แต่ปุ่มหลักเป็นชมพู (สว่าง) / เหลือง (มืด)
// จึงมีวงกลมขาวรองไว้ในตัวโลโก้ (สีของ Google ไม่ใช่ token ของธีม)
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="24" fill="#fff" />
      <g transform="translate(9 9) scale(0.625)">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </g>
    </svg>
  );
}

// คำประสมที่ตัวตัดคำไทยของเบราว์เซอร์แยกกลางคำ ("ผู้|ดูแล", "ภาพ|รวม") — ใช้เฉพาะคำที่เห็นว่าตัดผิดจริง ไม่ใช่ทุกคำ
function NoBreak({ children }: { children: string }) {
  return <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{children}</Box>;
}

// สถานะเปลี่ยนระหว่างรออนุมัติ — การ์ด/แอปเปลี่ยนเองโดย screen reader ไม่รู้ จึงประกาศผ่าน snackbar ด้วย
const STATUS_CHANGE_NOTICE: Partial<Record<User['status'], Notice>> = {
  approved: { message: 'ได้รับอนุมัติแล้ว เริ่มใช้งานได้เลย', severity: 'success' },
  rejected: { message: 'ผู้ดูแลไม่ได้อนุมัติบัญชีนี้', severity: 'info' },
};

// ?gmail=<code> ที่ OAuth callback ส่งกลับมาหลังเชื่อม/เชื่อม Gmail ใหม่ — โค้ดที่ไม่รู้จักไม่แสดงอะไร
// แสดงเฉพาะเมื่อโหลดแรกเข้าแอปได้เลย (approved) — หน้ารออนุมัติบอก not_granted ในการ์ดเอง หน้าถูกปฏิเสธไม่บอก
const GMAIL_NOTICE: Record<string, Notice> = {
  connected: { message: 'เชื่อม Gmail สำเร็จ', severity: 'success' },
  not_granted: { message: 'ยังไม่ได้เชื่อม Gmail: ต้องติ๊กอนุญาตให้อ่านอีเมลในหน้าของ Google ระบบจึงนำเข้า statement ได้', severity: 'error' },
  denied: { message: 'ยกเลิกการเชื่อม Gmail แล้ว ไม่มีอะไรเปลี่ยน', severity: 'info' },
  wrong_account: { message: 'บัญชี Google ที่เลือกไม่ตรงกับกล่องอีเมลที่จะเชื่อมใหม่ ลองอีกครั้งแล้วเลือกบัญชีให้ถูก', severity: 'error' },
  no_refresh_token: { message: 'Google ไม่ได้ส่งสิทธิ์ระยะยาวกลับมา ลองเชื่อม Gmail ใหม่อีกครั้ง', severity: 'error' },
  expired: { message: 'ลิงก์เชื่อม Gmail หมดอายุ ลองเชื่อมใหม่อีกครั้ง', severity: 'warning' },
  failed: { message: 'เชื่อม Gmail ไม่สำเร็จ ลองใหม่อีกครั้ง', severity: 'error' },
  rate_limited: { message: 'ลองเชื่อม Gmail หลายครั้งเกินไปจากเครือข่ายนี้ รอประมาณ 15 นาทีแล้วลองใหม่', severity: 'warning' },
};

// /api/me ตอบ user null ระหว่างรออนุมัติ = session หมด/ถูกล้าง — หน้ากลายเป็นเข้าสู่ระบบ ต้องบอกว่าทำไม
const SESSION_EXPIRED_NOTICE: Notice = { message: 'เซสชันหมดอายุ เข้าสู่ระบบอีกครั้ง', severity: 'warning' };

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
  // ภาษีเป็นแท็บเดียว — ประมาณการ (/tax) กับเอกสาร (/tax-documents) เป็นแท็บย่อยของ TaxSubNav
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
        // มีชื่อ: กว้างตามชื่อ ขอบข้าง 10px (เดิม minWidth 104 + 16px) — แอดมินที่เปิดหน้าภาษีมี 7 tabs ไม่งั้นล้นที่ 1200–1280px
        sx={iconOnly ? { minWidth: 48 } : { minWidth: 0, px: 1.25 }}
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
// /tax-documents อยู่ใต้แท็บ "ภาษี" — ผ่าน known ด้วย ปิดหน้าภาษีแล้ว (ไม่มี /tax ในเมนู) จึงไม่ส่งค่าที่ Tabs ไม่รู้จัก
function activeNavPath(pathname: string): string | false {
  if (pathname.startsWith('/installments')) return '/planning';
  const segment = '/' + (pathname.split('/')[1] ?? '');
  const top = segment === '/tax-documents' ? '/tax' : segment;
  const known = [...NAV_ITEMS.map((n) => n.path), '/settings'] as string[];
  return known.includes(top) ? top : false;
}

// แท็บย่อยของเมนู "ภาษี" — สองหน้ายังเป็นสอง route เดิม แถบนี้เป็นลิงก์ไปมา (render เหนือหน้าใน route ทั้งสอง)
// ลิงก์พาปีและผู้เสียภาษีไปด้วยเฉพาะที่มีใน URL (ปีชื่อ query ต่างกัน: /tax `year` ↔ /tax-documents `tax_year`) ตัวกรองอื่นไม่พา
// ไม่ใส่ปีให้เองตอน URL ไม่มี — หน้าเอกสารไม่มีปี = ทุกปี · ไม่พิมพ์ เหมือน app bar
const TAX_TABS = [
  { path: '/tax', label: 'ประมาณการ', yearParam: 'year' },
  { path: '/tax-documents', label: 'เอกสาร', yearParam: 'tax_year' },
] as const;

// แท็บย่อยน้ำหนักรองจากเมนูหลัก: ที่เลือกมีแค่เส้นใต้ ไม่มีพื้น sidebar-accent (สีตัวอักษรของพื้นนั้นไม่ได้ตั้งมาสำหรับพื้นหน้า
// จึงใช้ text.primary — ring เป็น currentColor ตามธีม)
const taxTabsSx = { '& .MuiTab-root.Mui-selected, & .MuiTab-root.Mui-selected:hover': { bgcolor: 'transparent', color: 'text.primary' } } as const;

function TaxSubNav() {
  const { pathname, search } = useLocation();
  const current = TAX_TABS[pathname.startsWith('/tax-documents') ? 1 : 0]; // "/tax/" ก็ยังเป็นแท็บประมาณการ
  const params = new URLSearchParams(search);
  const entityId = params.get('tax_entity_id');
  const year = params.get(current.yearParam);
  const linkTo = (tab: (typeof TAX_TABS)[number]) => {
    const q = new URLSearchParams();
    if (entityId) q.set('tax_entity_id', entityId);
    if (year) q.set(tab.yearParam, year);
    return { pathname: tab.path, search: q.toString() };
  };
  return (
    <Box component="nav" aria-label="เมนูภาษี" sx={{ mb: 3, borderBottom: 1, borderColor: 'divider', displayPrint: 'none' }}>
      <Tabs value={current.path} variant="scrollable" scrollButtons="auto" sx={taxTabsSx}>
        {TAX_TABS.map((tab) => (
          <Tab key={tab.path} value={tab.path} label={tab.label} component={Link} to={linkTo(tab)} aria-current={current.path === tab.path ? 'page' : undefined} />
        ))}
      </Tabs>
    </Box>
  );
}

function AuthPanel({ children, version }: { children: ReactNode; version: string | null }) {
  return (
    // แถว auto ล่าง = เลขเวอร์ชัน (< sm อยู่ในลำดับเนื้อหา) — กล่องยังอยู่กลางจอ ≥ sm เลขเวอร์ชัน fixed แถวนี้จึงว่าง
    // 100dvh: iOS Safari 100vh สูงกว่าจอที่เห็น เลขเวอร์ชันไปอยู่ใต้ toolbar · 100vh เป็น fallback ของเบราว์เซอร์ที่ไม่รู้จัก dvh
    <Box component="main" sx={{ minHeight: '100vh', '@supports (min-height: 100dvh)': { minHeight: '100dvh' }, display: 'grid', gridTemplateRows: '1fr auto', placeItems: 'center', p: { xs: 2, sm: 3 } }}>
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
  // ออกจากระบบเฉย ๆ หรือออกเพื่อไปเลือกบัญชี Google อื่น — ระหว่างรอ ปุ่มทั้งสองเป็น aria-disabled
  const [leaving, setLeaving] = useState<'logout' | 'switch' | null>(null);
  const [goingToGoogle, setGoingToGoogle] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  // คัดลอกลิงก์ไม่ได้ทั้งสองทาง → แสดงลิงก์ในช่อง readOnly ให้คัดลอกเอง
  const [showLinkField, setShowLinkField] = useState(false);
  // OAuth callback ส่งผลกลับมาเป็น ?auth_error= / ?gmail= — อ่านตอน render แรก (ก่อน `/` ถูก Navigate ไป /dashboard จน query หาย)
  const [oauthParams] = useState(() => new URLSearchParams(window.location.search));
  const authError = oauthParams.get('auth_error');
  const [notice, setNotice] = useState<Notice | null>(null);
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
    if (!TRANSIENT_PARAMS.some((key) => oauthParams.has(key))) return;
    window.history.replaceState(window.history.state, '', pageUrl());
  }, [oauthParams]);

  useEffect(() => {
    if (user?.status !== 'approved') return;
    req<EmailAccount[]>('/api/email-accounts').then(setMailboxes).catch(() => {}); // แถบเสริม — โหลดไม่ได้ก็ไม่แสดง
  }, [user?.status]);

  // ทางเดียวที่อ่าน /api/me: โหลดแรก, หน้ารออนุมัติเช็คซ้ำ, ปุ่ม "ตรวจสอบอีกครั้ง" และตอนกลับจาก bfcache
  // คำขอที่ยังค้างอยู่ใช้ร่วมกัน — ไม่ยิงซ้อน และคำตอบเก่าไม่มาทับคำตอบใหม่
  const meRequest = useRef<Promise<MeResponse> | null>(null);
  const loadMe = () =>
    (meRequest.current ??= req<MeResponse>('/api/me')
      .then((response) => {
        setUser(response.user);
        setVersion(response.version);
        setPendingUserCount(response.pending_user_count ?? 0);
        return response;
      })
      .finally(() => {
        meRequest.current = null;
      }));

  useEffect(() => {
    loadMe()
      .then((response) => {
        // ยังไม่ล็อกอิน = Alert ในการ์ดเข้าสู่ระบบ · ล็อกอินอยู่แล้วก็ได้ ?auth_error= ได้ (เช่นเริ่ม /auth/google ซ้ำจนติด rate limit) → snackbar
        if (!response.user) return;
        const gmailNotice = response.user.status === 'approved' ? GMAIL_NOTICE[oauthParams.get('gmail') ?? ''] : undefined;
        setNotice(authErrorNotice(authError) ?? gmailNotice ?? null);
      })
      .catch(() => setUser(null));
  }, []);

  // รออนุมัติ: เช็คสถานะซ้ำทุก 30 วินาทีเฉพาะตอนแท็บมองเห็น และทันทีที่กลับมาที่แท็บ — อนุมัติแล้วเข้าแอปเอง ถูกปฏิเสธก็เปลี่ยนหน้าเอง
  // หยุดเมื่อสถานะไม่ใช่ pending แล้ว (cleanup ของ effect)
  const awaitingApproval = user?.status === 'pending';
  useEffect(() => {
    if (!awaitingApproval) return;
    const check = () => {
      // รอบก่อน (หรือปุ่มตรวจสอบ) ยังไม่จบ = ข้ามรอบนี้
      if (document.visibilityState !== 'visible' || meRequest.current) return;
      loadMe()
        .then((response) => {
          const changed = response.user ? STATUS_CHANGE_NOTICE[response.user.status] : SESSION_EXPIRED_NOTICE;
          if (changed) setNotice(changed);
        })
        .catch(() => {}); // เช็คเบื้องหลัง — พลาดรอบนี้ก็รอรอบหน้า
    };
    const timer = window.setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [awaitingApproval]);

  // กด Back กลับจาก Google แล้วเบราว์เซอร์คืนหน้านี้จาก bfcache: ปุ่มยังค้าง "กำลัง…" และ session อาจเปลี่ยนไปแล้ว
  // (เช่นกด "ใช้บัญชี Google อื่น" = ออกจากระบบก่อนไป Google) — ปลดปุ่มแล้วอ่านสถานะใหม่
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setGoingToGoogle(false);
      setLeaving(null);
      loadMe().catch(() => {});
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  // การไป Google ถูกยกเลิก (กด Stop, เน็ตหลุด) หน้านี้ไม่ได้ไปไหน — ปลดปุ่มเองหลัง 10 วินาที
  // ponytail: เน็ตช้ากว่า 10 วินาทีกดซ้ำได้ (oauthState ใหม่ทับของเดิม ครั้งแรกกลับมาเป็น expired) — ยอมรับ
  useEffect(() => {
    if (!goingToGoogle) return;
    const timer = window.setTimeout(() => setGoingToGoogle(false), 10_000);
    return () => window.clearTimeout(timer);
  }, [goingToGoogle]);

  // ออกจากหน้ารออนุมัติ (อนุมัติ → แอป, ปฏิเสธ, session หมด → เข้าสู่ระบบ) ปุ่มที่ถือ focus อาจหายไปกับหน้าเดิม focus ตกไป <body>
  // ย้ายไป h1 ของหน้าใหม่ — เข้าแอปใช้ <main> เพราะ h1 ของหน้าแรกยังอยู่ใน chunk ที่กำลังโหลด
  const lastStatus = useRef<User['status'] | undefined>(undefined);
  useEffect(() => {
    const was = lastStatus.current;
    lastStatus.current = user?.status;
    if (was !== 'pending' || user?.status === 'pending') return;
    document.getElementById(user?.status === 'approved' ? 'app-main' : 'auth-heading')?.focus();
  }, [user?.status]);
  // หลังแอดมินเปลี่ยนสถานะผู้ใช้ในหน้าตั้งค่า — อ่านเฉพาะตัวนับใหม่ (ตัวนับเป็นของเสริม โหลดไม่ได้คงค่าเดิม)
  const refreshPendingUserCount = () => {
    req<MeResponse>('/api/me').then((response) => setPendingUserCount(response.pending_user_count ?? 0)).catch(() => {});
  };

  // หน้าก่อนเข้าระบบไม่มี PageHeader (ที่ตั้ง document.title ให้หน้าอื่น) — ตั้งชื่อแท็บที่นี่
  useEffect(() => {
    if (user === undefined || user?.status === 'approved') return;
    const page = !user ? 'เข้าสู่ระบบ' : user.status === 'pending' ? 'รอการอนุมัติ' : 'บัญชีนี้ไม่ได้รับอนุมัติ';
    document.title = `${page} · ${APP_NAME}`;
  }, [user]);

  // 'logout' โหลดหน้าใหม่ (→ หน้าเข้าสู่ระบบ) · 'switch' ไป /auth/google ต่อ ซึ่ง Google ถามเลือกบัญชีทุกครั้ง
  // กันกดซ้ำที่นี่ที่เดียว ทุกปุ่มที่เรียกเป็น aria-disabled ระหว่างรอ (disabled ทำ focus หลุดไป <body> ถ้าล้มเหลว)
  const leave = async (next: 'logout' | 'switch') => {
    if (leaving) return;
    setLeaving(next);
    try {
      await req('/auth/logout', { method: 'POST' });
      if (next === 'switch') location.assign('/auth/google');
      else location.reload();
    } catch (error) {
      setLeaving(null);
      setMenuOpen(false); // Modal ของ drawer ตั้ง aria-hidden ให้ #root — ต้องปิดก่อน screen reader จึงจะอ่าน snackbar ได้
      setNotice({ message: error instanceof Error ? error.message : 'ออกจากระบบไม่สำเร็จ', severity: 'error' });
    }
  };
  const logout = () => void leave('logout');

  const checkStatus = async () => {
    if (checkingStatus) return;
    setCheckingStatus(true);
    try {
      const response = await loadMe();
      setNotice(response.user
        ? STATUS_CHANGE_NOTICE[response.user.status] ?? { message: 'ยังรอผู้ดูแลอนุมัติอยู่', severity: 'info' }
        : SESSION_EXPIRED_NOTICE);
    } catch {
      setNotice({ message: 'ตรวจสอบสถานะไม่สำเร็จ ลองใหม่อีกครั้ง', severity: 'error' });
    } finally {
      setCheckingStatus(false);
    }
  };

  // <a href> ไม่ใช่ปุ่มที่ตั้ง location.href (โหลดทั้งหน้าไป OAuth) · กดแล้วกันกดซ้ำ เพราะทุกครั้งสร้าง oauthState ใหม่
  // ทับของเดิม — callback ของครั้งแรกจะไม่ผ่าน · Ctrl/⌘/Shift-คลิกเปิดแท็บใหม่ แท็บนี้ไม่ได้ไปไหนจึงไม่ล็อกปุ่ม
  const goToGoogle = (event: MouseEvent) => {
    if (goingToGoogle) return event.preventDefault();
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setGoingToGoogle(true);
  };

  // ไม่มี navigator.clipboard = ใช้ textarea ทันที (ก่อน await ยังอยู่ในจังหวะคลิก) · writeText ถูกปฏิเสธ = ลอง textarea อีกครั้ง
  // ไม่ได้ทั้งคู่ = แสดงลิงก์ในช่องให้คัดลอกเอง
  const copyLink = async () => {
    const url = pageUrl();
    let copied = false;
    try {
      if (!navigator.clipboard) copied = copyWithTextarea(url);
      else {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch {
      copied = copyWithTextarea(url);
    }
    if (copied) setNotice({ message: 'คัดลอกลิงก์แล้ว วางในแถบที่อยู่ของ Chrome หรือ Safari', severity: 'success' });
    else setShowLinkField(true);
  };

  if (user === undefined) {
    return (
      <AuthPanel version={version}>
        {/* ข้อความซ่อนแทน aria-label — aria-label บน role=status (div) screen reader ไม่อ่าน */}
        <Stack spacing={2} role="status">
          <Skeleton variant="circular" width={72} height={72} />
          <Skeleton width="55%" height={38} />
          <Skeleton width="90%" height={24} />
          <Skeleton variant="rounded" height={40} sx={{ mt: 1 }} />
          <Box component="span" sx={visuallyHiddenSx}>กำลังโหลดข้อมูลผู้ใช้</Box>
        </Stack>
      </AuthPanel>
    );
  }

  // การ์ดหน้าก่อนเข้าแอปจัดกึ่งกลางทั้งสามหน้า (เข้าสู่ระบบ / รออนุมัติ / ถูกปฏิเสธ) · Alert ในการ์ดข้อความชิดซ้าย
  const authAlertSx = { width: '100%', textAlign: 'left', ...descriptionSx } as const;

  if (!user) {
    const authNotice = authErrorNotice(authError);
    return (
      <>
        <AuthPanel version={version}>
          <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <Box component="img" src="/logo-144.webp" alt="" width={72} height={72} sx={{ display: 'block' }} />
            <Box>
              <Typography variant="h1" id="auth-heading" tabIndex={-1}>Hyacinthia Ledger</Typography>
              <Typography color="text.secondary" sx={{ mt: 1, ...descriptionSx }}>
                เปลี่ยน statement จากธนาคารให้เป็น<NoBreak>ภาพรวม</NoBreak>การเงินที่ถูกต้องและดูแลง่าย
              </Typography>
            </Box>
            {/* role=alert (ค่าเริ่มต้น) — mount หลัง skeleton จึงถูกประกาศ */}
            {authNotice && <Alert severity={authNotice.severity} sx={authAlertSx}>{authNotice.message}</Alert>}
            {/* ประกาศที่คงอยู่ในหน้า → role=status (The Quiet Notice Rule) */}
            {IN_APP_BROWSER && (
              <Alert severity="warning" role="status" sx={authAlertSx}>
                หน้านี้เปิดอยู่ในแอป {IN_APP_BROWSER} ซึ่ง Google มักไม่ให้เข้าสู่ระบบ{' '}
                {IN_APP_BROWSER === 'LINE' ? 'กด "เปิดในเบราว์เซอร์"' : 'แตะเมนู ⋯ ของแอปแล้วเลือกเปิดในเบราว์เซอร์'}
                {' '}หรือคัดลอกลิงก์ไปเปิดใน Chrome หรือ Safari
              </Alert>
            )}
            {/* ในแอป: ทางออกจากแอปเป็นปุ่มหลัก ปุ่ม Google ลดเป็นรอง (บางแอปยังผ่าน) */}
            <Stack spacing={1.5} sx={{ width: '100%' }}>
              {IN_APP_BROWSER === 'LINE' && (
                <Button fullWidth variant="contained" href={pageUrl(true)} startIcon={<OpenInBrowserRounded />}>
                  เปิดในเบราว์เซอร์
                </Button>
              )}
              {IN_APP_BROWSER && (
                <Button fullWidth variant={IN_APP_BROWSER === 'LINE' ? 'outlined' : 'contained'} startIcon={<ContentCopyRounded />} onClick={copyLink}>
                  คัดลอกลิงก์
                </Button>
              )}
              {/* autoFocus → onFocus เลือกทั้งหมด screen reader อ่านชื่อ + คำแนะนำทันที · input ธรรมดาหน้าตาเดียวกับช่องกรอก
                  ไม่ใช่ TextField (ลาก Select/Menu เข้า chunk หลัก +56 kB เพื่อทางสำรองที่แทบไม่มีใครเห็น) · 16px กัน iOS ซูม */}
              {showLinkField && (
                <Box sx={{ textAlign: 'left' }}>
                  <Box
                    component="input"
                    readOnly
                    autoFocus
                    value={pageUrl()}
                    aria-label="ลิงก์ของหน้านี้"
                    aria-describedby="copy-link-help"
                    onFocus={(event: FocusEvent<HTMLInputElement>) => event.currentTarget.select()}
                    sx={{
                      ...dataTextSx,
                      width: '100%',
                      minHeight: 40,
                      px: 1.5,
                      fontSize: '1rem',
                      color: 'text.primary',
                      bgcolor: 'brand.inputBg',
                      border: 1,
                      borderColor: 'brand.input',
                      borderRadius: `${radii.md}px`,
                    }}
                  />
                  <Typography id="copy-link-help" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    คัดลอกให้อัตโนมัติไม่ได้ กดค้างที่ลิงก์แล้วเลือกคัดลอก
                  </Typography>
                </Box>
              )}
              <Button
                fullWidth
                variant={IN_APP_BROWSER ? 'outlined' : 'contained'}
                href="/auth/google"
                onClick={goToGoogle}
                aria-disabled={goingToGoogle}
                aria-busy={goingToGoogle}
                startIcon={goingToGoogle ? <CircularProgress size={16} color="inherit" /> : <GoogleMark />}
              >
                {goingToGoogle ? 'กำลังไปที่ Google…' : 'เข้าสู่ระบบด้วย Google'}
              </Button>
              {/* ป้ายของปุ่มที่ focus อยู่เปลี่ยนแล้ว screen reader ไม่อ่าน — live region อยู่นอกปุ่ม (aria-busy บนปุ่มกดการประกาศของลูก) */}
              <Box component="span" role="status" sx={visuallyHiddenSx}>{goingToGoogle ? 'กำลังไปที่ Google…' : ''}</Box>
            </Stack>
          </Stack>
        </AuthPanel>
        <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
      </>
    );
  }

  if (user.status !== 'approved') {
    const isPending = user.status === 'pending';
    const busy = leaving !== null;
    return (
      <>
        <AuthPanel version={version}>
          <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
            {isPending
              ? <HourglassTopRounded sx={{ color: 'text.secondary', fontSize: 40 }} />
              : <BlockRounded color="error" sx={{ fontSize: 40 }} />}
            <Box>
              <Typography variant="h1" id="auth-heading" tabIndex={-1}>{isPending ? 'รอการอนุมัติ' : 'บัญชีนี้ไม่ได้รับอนุมัติ'}</Typography>
              {/* อีเมลอยู่บรรทัดของตัวเอง — อยู่กลางประโยคแล้วดันคำไทยให้ตัดกลางคำ · ตัดหลัง @ ก่อนกลางโดเมน */}
              <Typography sx={{ mt: 1 }}>{emailText(user.email)}</Typography>
              {isPending ? (
                <>
                  {/* worker ดึงอีเมลเฉพาะผู้ใช้ที่ approved (src/worker.ts) */}
                  <Typography color="text.secondary" sx={{ mt: 2, ...descriptionSx }}>
                    บัญชีนี้รอ<NoBreak>ผู้ดูแล</NoBreak>อนุมัติ ระหว่างนี้ระบบยังไม่อ่านอีเมลหรือนำเข้า statement ของคุณ
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1, ...descriptionSx }}>
                    เปิดหน้านี้ทิ้งไว้ได้ เมื่อได้รับอนุมัติ หน้านี้จะพาเข้าแอปให้เอง
                  </Typography>
                </>
              ) : (
                // ปฏิเสธ = แอดมิน revoke token ทุกกล่องที่ Google (routes/admin.ts) และล็อกอินซ้ำก็ไม่เก็บ token ใหม่ (auth.ts)
                <Typography color="text.secondary" sx={{ mt: 2, ...descriptionSx }}>
                  ระบบไม่อ่านอีเมลของบัญชีนี้ และได้ขอ Google ยกเลิกสิทธิ์อ่านอีเมลที่บัญชีนี้เคยให้ไว้แล้ว
                </Typography>
              )}
            </Box>
            {/* ล็อกอินโดยไม่ติ๊กอ่านอีเมล — บอกสิ่งที่ทำได้หลังอนุมัติ (GmailBanner มีปุ่ม "เชื่อม Gmail" ทุกหน้า) */}
            {isPending && oauthParams.get('gmail') === 'not_granted' && (
              <Alert severity="info" role="status" sx={authAlertSx}>
                ยังไม่ได้ให้สิทธิ์อ่าน Gmail — ให้ทีหลังได้ เมื่อได้รับอนุมัติแล้ว กด <NoBreak>"เชื่อม Gmail"</NoBreak> ที่แถบด้านบนของแอป ระบบจึงจะนำเข้า statement ได้
              </Alert>
            )}
            <Stack spacing={1} sx={{ width: '100%' }}>
              {isPending && (
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={checkStatus}
                  aria-disabled={checkingStatus}
                  aria-busy={checkingStatus}
                  startIcon={checkingStatus ? <CircularProgress size={16} color="inherit" /> : <RefreshRounded />}
                >
                  {checkingStatus ? 'กำลังตรวจสอบ…' : 'ตรวจสอบอีกครั้ง'}
                </Button>
              )}
              <Button
                fullWidth
                variant={isPending ? 'text' : 'outlined'}
                onClick={() => void leave('switch')}
                aria-disabled={busy}
                aria-busy={leaving === 'switch'}
                startIcon={leaving === 'switch' ? <CircularProgress size={16} color="inherit" /> : <SwitchAccountRounded />}
              >
                {leaving === 'switch' ? 'กำลังไปที่ Google…' : 'ใช้บัญชี Google อื่น'}
              </Button>
              <Button
                fullWidth
                variant="text"
                onClick={logout}
                aria-disabled={busy}
                aria-busy={leaving === 'logout'}
                startIcon={leaving === 'logout' ? <CircularProgress size={16} color="inherit" /> : <LogoutRounded />}
              >
                {leaving === 'logout' ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
              </Button>
            </Stack>
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
              <Box component="img" src="/logo-144.webp" alt="" width={32} height={32} sx={{ display: 'block' }} />
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
                // ช่วงไอคอนล้วนพอดีเสมอ (8 tabs ก็ยังพอ) · ≥ lg แอดมินที่เปิดหน้าภาษี (features.ts) มี 7 tabs — ภาษีรวมเป็นแท็บเดียว
                // และ tab มีชื่อกว้างตามชื่อ (NavTab) — วัดในเบราว์เซอร์แล้ว (แอดมิน + เปิดหน้าภาษี) ไม่ล้นที่ 1440/1280/1200/1100/900px
                // scrollable กันตัดหายเงียบ ๆ ถ้าเมนูยาวขึ้นอีก ลูกศรขึ้นเฉพาะตอนล้นจริง
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
                  <IconButton color="inherit" aria-label="ออกจากระบบ" onClick={logout} aria-disabled={leaving !== null} aria-busy={leaving !== null}>
                    <LogoutRounded />
                  </IconButton>
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
            <ListItemButton onClick={logout} aria-disabled={leaving !== null} aria-busy={leaving !== null}>
              <ListItemIcon><LogoutRounded /></ListItemIcon>
              <ListItemText primary={leaving ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'} />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      {/* < sm เลขเวอร์ชันต่อท้ายหน้า (ไม่ลอย) ระยะล่างรวมกับบรรทัดเวอร์ชันจึงใกล้เดิม */}
      {/* tabIndex -1: ปลายทาง focus ตอนเพิ่งได้รับอนุมัติ — landmark ไม่ใช่ control จึงไม่วาด ring รอบทั้งหน้า */}
      <Container component="main" id="app-main" tabIndex={-1} maxWidth="lg" sx={{ py: { xs: 3, sm: 4 }, pb: { xs: 4, sm: 8 }, '&:focus-visible': { outline: 'none' } }}>
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
            {isPageEnabled('/tax') && <Route path="/tax" element={<Box component="section" aria-labelledby="tax-summary-heading"><TaxSubNav /><TaxSummary /></Box>} />}
            {isPageEnabled('/tax-documents') && <Route path="/tax-documents" element={<Box component="section" aria-labelledby="tax-documents-heading"><TaxSubNav /><TaxDocuments /></Box>} />}
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
