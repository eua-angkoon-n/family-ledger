import type { ReactNode } from 'react';
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
import { descriptionSx } from './theme.js';

type HeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  level?: 1 | 2;
  id?: string;
};

export function PageHeader({ title, description, action, level = 2, id }: HeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' }, justifyContent: 'space-between' }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography component={level === 1 ? 'h1' : 'h2'} variant={level === 1 ? 'h1' : 'h2'} id={id}>
          {title}
        </Typography>
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
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ mt: 3, px: { xs: 2, sm: 4 }, py: { xs: 4, sm: 5 }, textAlign: 'center' }}
    >
      <Box sx={{ color: 'text.secondary', display: 'inline-flex', mb: 1.5 }}>{icon}</Box>
      <Typography component="h3" variant="h2">{title}</Typography>
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
  description: string;
  confirmLabel: string;
  confirmColor?: ButtonProps['color'];
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth aria-labelledby="confirm-title">
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={busy} autoFocus>ยกเลิก</Button>
        <Button variant="contained" color={confirmColor} onClick={onConfirm} disabled={busy} aria-busy={busy}>
          {busy ? 'กำลังดำเนินการ…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export type Notice = { message: string; severity: 'success' | 'error' };

export function FeedbackSnackbar({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  return (
    <Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      {notice ? <Alert severity={notice.severity} variant="filled" onClose={onClose}>{notice.message}</Alert> : undefined}
    </Snackbar>
  );
}
