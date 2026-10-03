import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
  type ButtonProps,
  type IconButtonProps,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { GuideButton } from './guide/GuideButton.js';
import { AMOUNT_FORMAT_HINT, parseBahtToSatang } from './format.js';
import { dataTextSx, descriptionSx } from './theme.js';

// ซ่อนจากตาแต่ screen reader ยังอ่าน (ตารางข้อมูลของกราฟ, live region) — ค่าเป็น string เพราะ sx ตีความ 1 = 100%
export const visuallyHiddenSx = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

/** props ของ TextField ช่องยอดเงิน: ค่าที่อ่านไม่ได้เป็น error พร้อมรูปแบบที่ถูกใต้ช่อง (ช่องว่างไม่ใช่ error — required ดูแลเอง) */
export const amountFieldHelp = (value: string) =>
  value !== '' && parseBahtToSatang(value) == null ? { error: true, helperText: AMOUNT_FORMAT_HINT } : {};

// ตารางจอแคบ (< md) ตัดคอลัมน์รองด้วย display ทั้งหัวและแถวพร้อมกัน แล้วพับค่าลงบรรทัดรองใต้ชื่อ (Tables ใน DESIGN.md)
export const MD_UP = { display: { xs: 'none', md: 'table-cell' } } as const;
export const BELOW_MD = { display: { md: 'none' } } as const;

/**
 * action รองของแถวตาราง (The Row Action Rule): icon button + Tooltip — `label` คือชื่อเต็มสำหรับ screen reader
 * (ใส่ชื่อแถวด้วย เช่น "แก้ไข ค่าเช่าบ้าน") ส่วน `tooltip` คือคำสั้นที่ตาเห็น (ไม่ส่ง = ใช้ label)
 * `disabledReason` = ทำไม่ได้เพราะตัวรายการเอง: ปุ่มยังอยู่ในลำดับ tab (aria-disabled) tooltip บอกเหตุผล ทั้งเมาส์และ focus
 * Tooltip ห่อปุ่มตรง ๆ เหตุผลจึงเป็น accessible description ของปุ่มเอง (describeChild: title ตอนปิด, aria-describedby ตอนเปิด)
 * span ห่อเฉพาะตอน `disabled` จริง — Tooltip ของ MUI ฟัง event จากปุ่มที่ disabled ไม่ได้ ตอนนั้นใช้ describeChild ด้วย
 * ไม่งั้น Tooltip ใส่ aria-label ให้ span (generic ตั้งชื่อไม่ได้) — ชื่อคือ aria-label ของปุ่มเองเสมอ
 */
export function RowIconButton({
  label,
  tooltip,
  disabledReason,
  onClick,
  children,
  ...props
}: { label: string; tooltip?: string; disabledReason?: string | null } & Omit<IconButtonProps, 'aria-label'>) {
  const blocked = disabledReason != null && disabledReason !== '';
  const button = (
    <IconButton size="small" aria-label={label} aria-disabled={blocked || undefined} onClick={blocked ? undefined : onClick} {...props}>
      {children}
    </IconButton>
  );
  return (
    <Tooltip title={blocked ? disabledReason : (tooltip ?? label)} describeChild={blocked || Boolean(props.disabled)}>
      {props.disabled ? <span>{button}</span> : button}
    </Tooltip>
  );
}

/**
 * เลขเวอร์ชันมุมล่างขวา แสดงทุกหน้ารวมหน้าเข้าสู่ระบบ ค่ามาจาก `GET /api/me`
 * ใช้ฟอนต์ data ตาม Financial Clarity Rule (เลขเวอร์ชันคือข้อมูลเทคนิค ไม่ใช่ข้อความอธิบาย)
 * `pointerEvents: none` เพื่อไม่บังปุ่มใด ๆ และ z-index อยู่ต่ำกว่า dialog/snackbar ของ MUI
 */
export function VersionBadge({ version }: { version: string | null }) {
  if (!version) return null;
  return (
    // ไม่ใส่ aria-label: บน div ที่ไม่มี role screen reader ข้ามทิ้ง — ข้อความที่เห็น "v1.4.0" อ่านออกเสียงได้อยู่แล้ว
    <Box
      sx={{
        position: 'fixed',
        right: { xs: 8, sm: 12 },
        bottom: { xs: 6, sm: 10 },
        px: 0.75,
        color: 'text.secondary',
        fontSize: '0.875rem', // ขั้น `label` ของ DESIGN.md — ไม่ลด opacity ทับ เพราะ muted ต้องคง contrast AA
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: (theme) => theme.zIndex.fab,
        ...dataTextSx,
      }}
    >
      v{version}
    </Box>
  );
}

type HeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  level?: 1 | 2;
  id?: string;
};

export const APP_NAME = 'Hyacinthia Ledger';

export function PageHeader({ title, description, action, level = 2, id }: HeaderProps) {
  // ชื่อแท็บตามหน้า (WCAG 2.4.2) — ทุกหน้าที่ล็อกอินแล้วมี PageHeader level 1 ตัวเดียว จึงตั้งที่นี่ที่เดียว
  useEffect(() => {
    if (level === 1) document.title = `${title} · ${APP_NAME}`;
  }, [level, title]);
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' }, justifyContent: 'space-between' }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography component={level === 1 ? 'h1' : 'h2'} variant={level === 1 ? 'h1' : 'h2'} id={id}>
            {title}
          </Typography>
          {/* ปุ่มคู่มือขึ้นเฉพาะหัวข้อระดับหน้า — หัวข้อย่อยในหน้า (level 2) ไม่ต้องมี
              และ `action` ของ PageHeader ถูกใช้ไปแล้วเกือบทุกหน้า จึงห้ามยัดปุ่มนี้ลงไปที่นั้น */}
          {level === 1 && <GuideButton />}
        </Stack>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: '70ch', ...descriptionSx }}>
            {description}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** ระดับหัวข้อตามตำแหน่ง — ใต้ h1 ของหน้าตรง ๆ = 2, ในส่วนที่มีหัวข้อ h2 = 3 (ค่าเริ่มต้น) */
  headingLevel?: 2 | 3;
};

export function EmptyState({ icon, title, description, action, headingLevel = 3 }: EmptyStateProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ mt: 3, px: { xs: 2, sm: 4 }, py: { xs: 4, sm: 5 }, textAlign: 'center' }}
    >
      <Box sx={{ color: 'text.secondary', display: 'inline-flex', mb: 1.5 }}>{icon}</Box>
      <Typography component={headingLevel === 2 ? 'h2' : 'h3'} variant="h2">{title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mx: 'auto', maxWidth: '60ch', ...descriptionSx }}>
        {description}
      </Typography>
      {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
    </Paper>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      sx={{ mt: 2 }}
      action={onRetry ? <Button color="inherit" onClick={onRetry}>ลองใหม่</Button> : undefined}
    >
      {message}
    </Alert>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Paper variant="outlined" role="status" aria-label="กำลังโหลดข้อมูล" sx={{ mt: 3, p: 2 }}>
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={32} />
        {Array.from({ length: rows }, (_, index) => <Skeleton key={index} variant="rounded" height={44} />)}
      </Stack>
    </Paper>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  // ReactNode สำหรับ dialog แบบกลุ่มที่ต้องแสดงรายชื่อทุกรายการที่จะถูกแตะ
  description: ReactNode;
  confirmLabel: string;
  confirmColor?: ButtonProps['color'];
  /** ปุ่มปิดโดยไม่ทำอะไร — ไม่ใช้ "ยกเลิก" เป็นค่าเริ่มต้น เพราะชนกับ action อย่าง "ยกเลิกแผน"/"ยกเลิกการบันทึกจ่าย" */
  cancelLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** ปุ่มที่สามระหว่าง "ยกเลิก" กับปุ่มยืนยัน เช่น "ทิ้งการแก้ไข" */
  secondaryLabel?: string;
  secondaryColor?: ButtonProps['color'];
  onSecondary?: () => void;
  /** ปิดสนิทแล้ว (จบ transition) — ระหว่างที่ dialog เปิด ทุกอย่างข้างหลังเป็น aria-hidden ประกาศผลหลังจุดนี้ */
  onExited?: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmColor = 'primary',
  cancelLabel = 'ไม่ใช่ตอนนี้',
  busy = false,
  onClose,
  onConfirm,
  secondaryLabel,
  secondaryColor = 'inherit',
  onSecondary,
  onExited,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      slotProps={{ transition: { onExited } }}
    >
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      <DialogContent>
        {/* DialogContentText เป็น <p> — รายการ (<ul>) ข้างในผิด nesting จึงเปลี่ยนเป็น div เมื่อไม่ใช่ข้อความล้วน
            (Alert error ที่ผู้เรียกใส่มาใน description จึงอยู่ใน aria-describedby ด้วย) */}
        {typeof description === 'string' ? (
          <DialogContentText id="confirm-description">{description}</DialogContentText>
        ) : (
          <DialogContentText id="confirm-description" component="div">{description}</DialogContentText>
        )}
      </DialogContent>
      {/* gap แทน margin ของ MUI — สามปุ่มที่ 320px ตัดขึ้นบรรทัดใหม่โดยไม่เยื้อง
          busy = aria-disabled + กดแล้วไม่ทำอะไร ไม่ใช่ disabled — ปุ่มยืนยันที่ถือ focus อยู่ไม่ทำ focus หลุดไป <body> */}
      <DialogActions disableSpacing sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button color="inherit" onClick={busy ? undefined : onClose} aria-disabled={busy} autoFocus>{cancelLabel}</Button>
        {secondaryLabel && onSecondary && (
          <Button color={secondaryColor} onClick={busy ? undefined : onSecondary} aria-disabled={busy}>{secondaryLabel}</Button>
        )}
        <Button variant="contained" color={confirmColor} onClick={busy ? undefined : onConfirm} aria-disabled={busy} aria-busy={busy}>
          {busy ? 'กำลังดำเนินการ…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// info = ผลที่ไม่ใช่ทั้งสำเร็จและผิดพลาด เช่น ผู้ใช้กดยกเลิกเองในหน้าของ Google (สี info = muted ไม่ใช่สีสถานะใหม่)
// action = ปุ่มเดียวต่อท้ายข้อความ เช่น "เลิกทำ" — snackbar ค้างนานขึ้นให้ทันกด
export type Notice = { message: string; severity: 'success' | 'error' | 'info'; action?: { label: string; onClick: () => void } };

// placement="top" ใช้ตอนมีแถบลอยด้านล่างจอ (แถบรายการที่เลือกในหน้าวางแผน) ไม่งั้น snackbar ทับปุ่มของแถบ
export function FeedbackSnackbar({
  notice,
  onClose,
  placement = 'bottom',
}: {
  notice: Notice | null;
  onClose: () => void;
  placement?: 'top' | 'bottom';
}) {
  return (
    <Snackbar
      open={Boolean(notice)}
      autoHideDuration={notice?.action ? 8000 : 4500}
      // มีปุ่ม action: คลิกที่อื่น (เช่นเลือกแถว) ไม่ปิด ไม่งั้นปุ่มเลิกทำหายก่อนได้กด — ปิดได้ด้วย X, Esc และหมดเวลา
      onClose={(_, reason) => {
        if (reason === 'clickaway' && notice?.action) return;
        onClose();
      }}
      anchorOrigin={{ vertical: placement, horizontal: 'center' }}
    >
      {notice ? (
        <Alert
          severity={notice.severity}
          variant="filled"
          onClose={onClose}
          // action ของ Alert แทนที่ปุ่มปิดเดิม — ใส่ปุ่มปิดคืนเองคู่กัน
          action={
            notice.action && (
              <>
                <Button color="inherit" onClick={notice.action.onClick}>{notice.action.label}</Button>
                <IconButton color="inherit" aria-label="ปิด" onClick={onClose}><CloseRounded fontSize="small" /></IconButton>
              </>
            )
          }
        >
          {notice.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}

/** เปิด/พับของ Disclosure จำต่อเครื่อง — localStorage โดนบล็อกได้ (โหมดส่วนตัว) อ่านไม่ได้ = พับ เขียนไม่ได้ = จำแค่รอบนี้ */
export function useStoredOpen(storageKey: string): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });
  const set = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? '1' : '0');
    } catch {
      // เขียนไม่ได้ = จำแค่รอบนี้
    }
  };
  return [open, set];
}

/**
 * The Disclosure Section Rule: หัวข้อ h2 ห่อปุ่ม aria-expanded + aria-controls ลูกศรหมุนตามสถานะ (คู่กับ `useStoredOpen`)
 * `id` = id ของหัวข้อ (คู่มืออ้างได้) · `action` อยู่ข้างหัวข้อ `notice` (เช่น LoadError) อยู่ใต้หัวข้อ ทั้งสองอยู่นอกส่วนที่พับ
 * `unmountOnExit` ไม่ค้างตารางยาวไว้ใน DOM ตอนพับ — id ของ panel อยู่ที่กล่องนอก Collapse aria-controls จึงชี้เจอเสมอ
 */
export function Disclosure({
  id,
  title,
  open,
  onToggle,
  action,
  notice,
  unmountOnExit = false,
  children,
}: {
  id: string;
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  notice?: ReactNode;
  unmountOnExit?: boolean;
  children: ReactNode;
}) {
  const panelId = useId();
  return (
    <Box component="section" aria-labelledby={id}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <Typography variant="h2" id={id}>
          <Button
            color="inherit"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            endIcon={
              <ExpandMoreRounded
                sx={{
                  transform: open ? 'rotate(180deg)' : 'none',
                  transition: (theme) => theme.transitions.create('transform'),
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                }}
              />
            }
            sx={{ font: 'inherit', ml: -1, px: 1, textAlign: 'left' }}
          >
            {title}
          </Button>
        </Typography>
        {action}
      </Stack>
      {notice}
      <Box id={panelId}>
        <Collapse in={open} unmountOnExit={unmountOnExit}>{children}</Collapse>
      </Box>
    </Box>
  );
}
