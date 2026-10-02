import { useEffect, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
  type ButtonProps,
} from '@mui/material';
import { GuideButton } from './guide/GuideButton.js';
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
        <Button color="inherit" onClick={busy ? undefined : onClose} aria-disabled={busy} autoFocus>ยกเลิก</Button>
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
export type Notice = { message: string; severity: 'success' | 'error' | 'info' };

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
    <Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={onClose} anchorOrigin={{ vertical: placement, horizontal: 'center' }}>
      {notice ? <Alert severity={notice.severity} variant="filled" onClose={onClose}>{notice.message}</Alert> : undefined}
    </Snackbar>
  );
}
