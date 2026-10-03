import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Button, Collapse, IconButton, LinearProgress, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRounded from '@mui/icons-material/KeyboardArrowRightRounded';
import { req, type AuditLogEntry, type AuditLogListResponse, type Category, type User } from '../api.js';
import { ACTION_LABEL, AUDIT_ACTIONS, ENTITY_LABEL, changedFields, isTaxEntity, redactRaw, type CategoryNames } from '../auditLabels.js';
import { TAX_PAGES_ENABLED } from '../features.js';
import { dataTextSx, fontFamilies } from '../theme.js';
import { BELOW_MD, EmptyState, LoadError, MD_UP, PageHeader, TableSkeleton, visuallyHiddenSx } from '../ui.js';

const LIMIT = 50;
const PAGINATION_ARIA: Record<string, string> = { first: 'หน้าแรก', last: 'หน้าสุดท้าย', next: 'หน้าถัดไป', previous: 'หน้าก่อนหน้า' };
const CLEAR_FILTERS = { entity_type: null, action: null, user_id: null, from: null, to: null };
// เวลา/วันตามเขตเวลาของเครื่อง (created_at เป็น timestamptz) — ไม่ตัด 10 ตัวแรกของ ISO ซึ่งเป็นวันแบบ UTC
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
// code ที่ไม่มีป้ายไทย (action ใหม่ที่ยังไม่ได้เพิ่มใน auditLabels.ts) แสดง code ดิบ
const codeLabel = (labels: Record<string, string>, code: string) =>
  labels[code] ?? <Box component="span" sx={dataTextSx}>{code}</Box>;

// regex/รหัสของธนาคารอ่านทีละตัวอักษร — mono เฉพาะค่า ไม่รวมคำว่า "เดิม"
const Value = ({ text, mono }: { text: string; mono: boolean }) =>
  mono ? <Box component="code" sx={{ fontFamily: fontFamilies.mono }}>{text}</Box> : <>{text}</>;

/** รายการช่องที่เปลี่ยน "ชื่อช่อง: เดิม X → Y" — สร้าง/ลบมีฝั่งเดียว แสดงเป็นค่าที่บันทึก/ค่าก่อนลบ */
function ChangeList({ entry, categories }: { entry: AuditLogEntry; categories?: CategoryNames }) {
  const changes = changedFields(entry.before_data, entry.after_data, categories);
  if (changes.length === 0) {
    return entry.before_data == null && entry.after_data == null ? null : (
      <Typography variant="body2" color="text.secondary">ไม่มีช่องที่เปลี่ยนให้แสดง</Typography>
    );
  }
  const title = entry.before_data != null && entry.after_data != null ? 'สิ่งที่เปลี่ยน'
    : entry.after_data != null ? 'ข้อมูลที่บันทึก' : 'ข้อมูลก่อนลบ';
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
      <Box
        component="dl"
        sx={{ m: 0, mt: 0.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(8rem, max-content) 1fr' }, columnGap: 2, rowGap: { xs: 0, sm: 0.5 } }}
      >
        {changes.map((c) => (
          <Box key={c.key} sx={{ display: 'contents' }}>
            <Box component="dt" sx={{ color: 'text.secondary', mt: { xs: 0.5, sm: 0 } }}>{c.label}</Box>
            <Box component="dd" sx={{ m: 0, ...dataTextSx, overflowWrap: 'anywhere' }}>
              {c.before != null && c.after != null ? (
                <>
                  <Box component="span" sx={{ color: 'text.secondary' }}>เดิม</Box> <Value text={c.before} mono={c.mono} />{' '}
                  <span aria-hidden>→</span>
                  <Box component="span" sx={visuallyHiddenSx}>เป็น</Box> <Value text={c.after} mono={c.mono} />
                </>
              ) : <Value text={(c.after ?? c.before)!} mono={c.mono} />}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function LogRow({ entry, showUser, isAdmin, categories }: {
  entry: AuditLogEntry;
  showUser: boolean;
  isAdmin: boolean;
  categories?: CategoryNames;
}) {
  const [open, setOpen] = useState(false);
  const detailId = `audit-detail-${entry.id}`;
  const time = formatTime(entry.created_at);
  const who = entry.user_display_name || entry.user_email;
  const entityLabel = ENTITY_LABEL[entry.entity_type] ?? entry.entity_type;
  // แอดมินเท่านั้น: รหัสข้อมูลและ IP ไว้ไล่ปัญหา — IPv4 ที่ Node รายงานเป็น IPv6-mapped (::ffff:1.2.3.4) ตัดหัวออก
  const meta = [
    entry.entity_id != null ? `${entityLabel} รหัส ${entry.entity_id}` : entityLabel,
    showUser ? entry.user_email : null,
    entry.ip_address ? `IP ${entry.ip_address.replace(/^::ffff:/, '')}` : null,
  ].filter(Boolean).join(' · ');
  const hasRaw = entry.before_data != null || entry.after_data != null;
  const toggle = () => setOpen((v) => !v);
  return (
    <>
      {/* คลิกที่ไหนก็ได้ในแถว = ทางลัดของเมาส์ ปุ่มลูกศรยังเป็นตัวควบคุมหลักของคีย์บอร์ด/screen reader */}
      <TableRow hover onClick={toggle} sx={{ cursor: 'pointer', ...(open ? { '& > td': { borderBottom: 'none' } } : {}) }}>
        {/* py 0.5 + ปุ่ม 40px = กึ่งกลางลูกศรตรงกับบรรทัดแรกของข้อความ (ช่องอื่นเว้นบน 14px สูงบรรทัด 20px) */}
        <TableCell sx={{ width: 48, py: 0.5, pl: 1, pr: 0 }}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            aria-expanded={open}
            aria-controls={detailId}
            aria-label={`ดูรายละเอียด ${ACTION_LABEL[entry.action] ?? entry.action} ${time}`}
          >
            {open ? <KeyboardArrowDownRounded /> : <KeyboardArrowRightRounded />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ ...MD_UP, whiteSpace: 'nowrap' }}>{time}</TableCell>
        <TableCell>
          {codeLabel(ACTION_LABEL, entry.action)}
          <Typography component="div" variant="body2" color="text.secondary" sx={{ ...BELOW_MD, ...dataTextSx, overflowWrap: 'anywhere' }}>
            {showUser ? `${time} · ${who}` : time}
          </Typography>
        </TableCell>
        {showUser && <TableCell sx={{ ...MD_UP, overflowWrap: 'anywhere' }}>{who}</TableCell>}
      </TableRow>
      {/* id อยู่ที่ช่องที่ mount ตลอด (Collapse unmount ตอนพับ) aria-controls จึงชี้เจอเสมอ · ตอนพับซ่อนทั้งแถวจาก
          screen reader ไม่งั้นนับแถวของตารางเป็นสองเท่า */}
      <TableRow aria-hidden={open ? undefined : true}>
        <TableCell id={detailId} colSpan={showUser ? 4 : 3} sx={{ py: 0, ...(open ? {} : { borderBottom: 'none' }) }}>
          <Collapse in={open} unmountOnExit>
            <Stack spacing={1.5} sx={{ pb: 2, pl: { md: 6 } }}>
              <ChangeList entry={entry} categories={categories} />
              {isAdmin && (
                <Typography variant="body2" color="text.secondary" sx={{ ...dataTextSx, overflowWrap: 'anywhere' }}>{meta}</Typography>
              )}
              {isAdmin && hasRaw && (
                // แอดมินเท่านั้น — ค่าดิบทั้งก้อนไว้ไล่ปัญหา คนทั่วไปเห็นแค่รายการที่เปลี่ยนด้านบน
                <Box component="details" sx={{ '& > summary': { cursor: 'pointer', py: 1.25, lineHeight: '20px', width: 'fit-content', color: 'text.secondary' } }}>
                  <summary>ข้อมูลดิบ</summary>
                  <Box
                    component="pre"
                    sx={{ fontFamily: fontFamilies.mono, m: 0, p: 1.5, fontSize: '0.875rem', borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'background.default', overflowX: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {JSON.stringify({ before: redactRaw(entry.before_data), after: redactRaw(entry.after_data) }, null, 2)}
                  </Box>
                </Box>
              )}
            </Stack>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

/**
 * หน้าอ่านอย่างเดียว · ค่าเริ่มต้นคือสิ่งที่ผู้ใช้ทำเอง (audit_log.user_id = ผู้ลงมือ) — แอดมินขอดูทุกคนแบบชัดแจ้งด้วย
 * `?scope=all` (ดู comment ใน `src/routes/audit-log.ts`) คนที่ไม่ใช่แอดมินไม่ส่ง scope/user_id แม้อยู่ใน URL (ไม่งั้นได้ 403)
 */
export default function AuditLog({ isAdmin }: { isAdmin: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const scopeAll = isAdmin && searchParams.get('scope') === 'all';
  const entityType = searchParams.get('entity_type') ?? '';
  const action = searchParams.get('action') ?? '';
  const userId = scopeAll ? searchParams.get('user_id') ?? '' : '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const pageRaw = Number(searchParams.get('page') ?? '1');
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const [data, setData] = useState<AuditLogListResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [users, setUsers] = useState<User[] | null>(null);
  const [usersFailed, setUsersFailed] = useState(false);
  const [categories, setCategories] = useState<CategoryNames>();
  const entityRef = useRef<HTMLInputElement>(null);
  const userRef = useRef<HTMLInputElement>(null);

  // ตัวกรอง = replace (ไม่เพิ่ม history ทุกครั้งที่เลือก) · หน้าและขอบเขต = push (Back ย้อนได้)
  const setFilter = (patch: Record<string, string | null>, replace = true) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (!('page' in patch)) next.delete('page');
      return next;
    }, { replace });
  };

  useEffect(() => {
    let current = true;
    setBusy(true);
    setError('');
    const p = new URLSearchParams();
    if (entityType) p.set('entity_type', entityType);
    if (action) p.set('action', action);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (scopeAll) {
      // user_id เจาะจงชนะ scope=all ที่ฝั่ง route อยู่แล้ว ส่งทั้งคู่ได้ไม่ขัดกัน
      p.set('scope', 'all');
      if (userId) p.set('user_id', userId);
    }
    p.set('limit', String(LIMIT));
    p.set('offset', String((page - 1) * LIMIT));
    req<AuditLogListResponse>(`/api/audit-log?${p.toString()}`)
      .then((result) => { if (current) setData(result); })
      // แถวเดิมเป็นของตัวกรองก่อนหน้า — ไม่ค้างไว้ใต้ LoadError
      .catch((e: Error) => { if (current) { setError(e.message); setData(null); } })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [entityType, action, userId, from, to, page, scopeAll, reloadKey]);

  // รายชื่อผู้ใช้ของตัวกรองโหมดทุกคน — โหลดไม่ได้ยังกรองได้ด้วย "ทุกคน" (ไม่บล็อกทั้งหน้า) · ลองใหม่ = ล้าง usersFailed
  useEffect(() => {
    if (!scopeAll || users || usersFailed) return;
    req<User[]>('/api/admin/users').then(setUsers).catch(() => setUsersFailed(true));
  }, [scopeAll, users, usersFailed]);

  // ชื่อหมวดของ category_id ในรายละเอียดแถว — ไม่กรอง is_active เพราะประวัติอ้างหมวดที่ปิดใช้ไปแล้วได้
  // โหลดไม่ได้ไม่บล็อกหน้า ช่องหมวดขึ้นว่า "ไม่ทราบชื่อหมวด" แทน
  useEffect(() => {
    req<Category[]>('/api/categories')
      .then((rows) => setCategories(new Map(rows.map((c) => [c.id, c.name]))))
      .catch(() => {});
  }, []);

  // หน้าเกินช่วง (ลิงก์เก่า, ?page=99) — ไปหน้าสุดท้ายที่มีแถว หรือหน้าแรกถ้าไม่มีเลย แทนการค้างที่ "ไม่พบ" โดยไม่มีปุ่มเปลี่ยนหน้า
  const pastEnd = data != null && data.rows.length === 0 && page > 1;
  useEffect(() => {
    if (pastEnd && data) setFilter({ page: data.total_count > 0 ? String(Math.ceil(data.total_count / LIMIT)) : null });
  }, [data]);

  const rows = data?.rows ?? [];
  const total = data?.total_count ?? 0;
  const hasFilter = Boolean(entityType || action || userId || from || to);
  const emptyTitle = hasFilter ? 'ไม่พบประวัติที่ตรงตัวกรอง' : 'ยังไม่มีประวัติ';
  const clearFilters = () => {
    setFilter(CLEAR_FILTERS);
    entityRef.current?.focus(); // ปุ่มที่กดหายไปพร้อมตัวกรอง — focus ไปช่องแรกที่อยู่ตลอด
  };
  const clearButton = <Button color="inherit" onClick={clearFilters}>ล้างตัวกรอง</Button>;

  // หน้าภาษีปิดอยู่ = ไม่มีตัวเลือกของหน้าภาษี (เว้นค่าที่เลือกค้างมาจากลิงก์ ให้ยังเห็นและเอาออกได้)
  const entityOptions = Object.entries(ENTITY_LABEL).filter(([code]) => TAX_PAGES_ENABLED || !isTaxEntity(code) || code === entityType);
  const actionOptions = AUDIT_ACTIONS.filter(([code, , entity]) =>
    (!entityType || entity === entityType) && (TAX_PAGES_ENABLED || !isTaxEntity(entity) || code === action));
  const actionEntity = (code: string) => AUDIT_ACTIONS.find(([c]) => c === code)?.[2];

  const showUser = scopeAll;
  const colCount = showUser ? 4 : 3;
  // แบ่งแถวตามวัน (เรียงใหม่ → เก่าจาก server อยู่แล้ว) — วันหนึ่งข้ามหน้าได้ หัววันขึ้นซ้ำต้นหน้าถัดไป
  const days: { day: string; rows: AuditLogEntry[] }[] = [];
  for (const r of rows) {
    const day = formatDay(r.created_at);
    const last = days[days.length - 1];
    if (last?.day === day) last.rows.push(r);
    else days.push({ day, rows: [r] });
  }

  return (
    <Box>
      <PageHeader
        level={1}
        id="audit-log-heading"
        title="ประวัติการเปลี่ยนแปลง"
        description={scopeAll
          ? 'สิ่งที่สมาชิกทุกคนทำในระบบ รวมถึงการอนุมัติผู้ใช้และการแก้ธนาคาร กดที่แถวเพื่อดูว่าเปลี่ยนอะไร'
          : 'สิ่งที่คุณทำในระบบ เช่น เข้าสู่ระบบ ใส่หมวด บันทึกจ่าย ดูย้อนหลังได้แต่แก้หรือลบไม่ได้ กดที่แถวเพื่อดูว่าเปลี่ยนอะไร'}
        action={isAdmin ? (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={scopeAll ? 'all' : 'self'}
            onChange={(_, value: 'self' | 'all' | null) => {
              if (value) setFilter({ scope: value === 'all' ? 'all' : null, user_id: null }, false);
            }}
            aria-label="ดูประวัติของ"
            sx={{ alignSelf: 'flex-start', flexShrink: 0 }}
          >
            <ToggleButton value="self" sx={{ minHeight: 40, px: 2 }}>ของฉัน</ToggleButton>
            <ToggleButton value="all" sx={{ minHeight: 40, px: 2 }}>ทุกคน</ToggleButton>
          </ToggleButtonGroup>
        ) : undefined}
      />

      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'flex-start', mt: 3 }} data-tour="audit-filters">
        {showUser && (
          <TextField
            select
            size="small"
            label="ผู้ใช้"
            value={userId}
            inputRef={userRef}
            onChange={(e) => setFilter({ user_id: e.target.value })}
            helperText={usersFailed ? 'โหลดรายชื่อไม่สำเร็จ' : undefined}
            sx={{ flex: '1 1 180px', maxWidth: { sm: 240 } }}
          >
            <MenuItem value="">ทุกคน</MenuItem>
            {users?.map((u) => <MenuItem key={u.id} value={String(u.id)}>{u.display_name || u.email}</MenuItem>)}
            {userId && !users?.some((u) => String(u.id) === userId) && <MenuItem value={userId}>ผู้ใช้รหัส {userId}</MenuItem>}
          </TextField>
        )}
        {showUser && usersFailed && (
          // ปุ่มหายไปทันทีที่เริ่มโหลดใหม่ — focus ไปช่องผู้ใช้ที่อยู่ตลอด
          <Button color="inherit" onClick={() => { setUsersFailed(false); userRef.current?.focus(); }}>ลองโหลดรายชื่อใหม่</Button>
        )}
        <TextField
          select
          size="small"
          label="ประเภทข้อมูล"
          value={entityType}
          inputRef={entityRef}
          onChange={(e) => {
            const value = e.target.value;
            // การกระทำที่เลือกไว้ไม่ใช่ของประเภทใหม่ = ล้างทิ้ง ไม่งั้นได้ผลว่างโดยไม่รู้ตัว
            const keepAction = !action || !value || actionEntity(action) === value;
            setFilter({ entity_type: value, ...(keepAction ? {} : { action: null }) });
          }}
          sx={{ flex: '1 1 180px', maxWidth: { sm: 240 } }}
        >
          <MenuItem value="">ทั้งหมด</MenuItem>
          {entityOptions.map(([code, label]) => <MenuItem key={code} value={code}>{label}</MenuItem>)}
          {entityType && !(entityType in ENTITY_LABEL) && <MenuItem value={entityType} sx={dataTextSx}>{entityType}</MenuItem>}
        </TextField>
        <TextField
          select
          size="small"
          label="การกระทำ"
          value={action}
          onChange={(e) => setFilter({ action: e.target.value })}
          sx={{ flex: '1 1 200px', maxWidth: { sm: 280 } }}
        >
          <MenuItem value="">ทั้งหมด</MenuItem>
          {actionOptions.map(([code, label]) => <MenuItem key={code} value={code}>{label}</MenuItem>)}
          {action && !actionOptions.some(([code]) => code === action) && (
            <MenuItem value={action}>{codeLabel(ACTION_LABEL, action)}</MenuItem>
          )}
        </TextField>
        <TextField
          size="small"
          type="date"
          label="ตั้งแต่วันที่"
          value={from}
          onChange={(e) => setFilter({ from: e.target.value })}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: to || undefined } }}
          sx={{ flex: '1 1 150px', maxWidth: { sm: 180 } }}
        />
        <TextField
          size="small"
          type="date"
          label="ถึงวันที่"
          value={to}
          onChange={(e) => setFilter({ to: e.target.value })}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from || undefined } }}
          sx={{ flex: '1 1 150px', maxWidth: { sm: 180 } }}
        />
        {hasFilter && clearButton}
      </Stack>

      {/* ผลการกรองสำหรับ screen reader — อยู่นอกส่วนที่สลับเป็น skeleton */}
      <Box role="status" sx={visuallyHiddenSx}>
        {busy || error ? '' : rows.length === 0 ? emptyTitle : `${total} รายการ`}
      </Box>
      {error && <LoadError message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {/* skeleton เฉพาะตอนยังไม่มีอะไรให้ดู (โหลดครั้งแรก / ลองใหม่หลังพัง) — เปลี่ยนตัวกรอง/หน้า คงแถวเดิมไว้พร้อมแถบโหลด */}
      {(data == null && !error) || pastEnd ? (
        <TableSkeleton rows={8} />
      ) : data == null ? null : rows.length === 0 ? (
        <EmptyState
          headingLevel={2}
          icon={<HistoryRounded sx={{ fontSize: 40 }} />}
          title={emptyTitle}
          description={hasFilter
            ? 'ลองเปลี่ยนช่วงวันที่ หรือล้างตัวกรองที่ตั้งไว้'
            : scopeAll ? 'เมื่อสมาชิกเข้าสู่ระบบหรือแก้ข้อมูล จะมีบันทึกขึ้นที่นี่' : 'เมื่อคุณเข้าสู่ระบบหรือแก้ข้อมูล จะมีบันทึกขึ้นที่นี่'}
          action={hasFilter ? clearButton : undefined}
        />
      ) : (
        <>
          {/* ไม่ใส่ tabIndex: คอลัมน์รองพับลงบรรทัดรองบนจอแคบ ตารางไม่ล้นกล่อง (ข้อยกเว้นใน DESIGN.md Tables) */}
          <TableContainer
            component={Paper}
            variant="outlined"
            role="region"
            aria-label="ตารางประวัติการเปลี่ยนแปลง"
            aria-busy={busy}
            sx={{ mt: 3, position: 'relative' }}
          >
            {busy && <LinearProgress aria-label="กำลังโหลดประวัติ" sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 }} />}
            <Table size="small" aria-label="ประวัติการเปลี่ยนแปลง">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 48, pl: 1, pr: 0 }}><Box component="span" sx={visuallyHiddenSx}>รายละเอียด</Box></TableCell>
                  <TableCell sx={MD_UP}>เวลา</TableCell>
                  <TableCell>การกระทำ</TableCell>
                  {showUser && <TableCell sx={MD_UP}>ผู้ใช้</TableCell>}
                </TableRow>
              </TableHead>
              {days.map(({ day, rows: dayRows }) => (
                // tbody หนึ่งก้อนต่อวัน หัววันเป็น th scope="rowgroup" — screen reader รู้ว่าแถวไหนเป็นของวันไหน
                <TableBody key={`${day}-${dayRows[0]!.id}`}>
                  <TableRow>
                    <TableCell component="th" scope="rowgroup" colSpan={colCount} sx={{ py: 1, fontWeight: 600, bgcolor: 'background.default' }}>
                      {day}
                    </TableCell>
                  </TableRow>
                  {dayRows.map((r) => <LogRow key={r.id} entry={r} showUser={showUser} isAdmin={isAdmin} categories={categories} />)}
                </TableBody>
              ))}
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page - 1}
            onPageChange={(_, newPage) => setFilter({ page: String(newPage + 1) }, false)}
            rowsPerPage={LIMIT}
            rowsPerPageOptions={[LIMIT]}
            labelDisplayedRows={({ from: f, to: t, count }) => `${f}–${t} จาก ${count} รายการ`}
            getItemAriaLabel={(type) => PAGINATION_ARIA[type] ?? type}
            sx={dataTextSx}
          />
        </>
      )}
      {scopeAll && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          การพยายามเข้าสู่ระบบที่ไม่สำเร็จไม่ได้บันทึกไว้ที่นี่ แอดมินดูได้จากบันทึกของเซิร์ฟเวอร์
        </Typography>
      )}
    </Box>
  );
}
