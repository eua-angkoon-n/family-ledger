import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function Modal({ open, title, onClose, children }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="modal-title">
      <DialogTitle component="div" id="modal-title">
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography component="h2" variant="h2">{title}</Typography>
          <IconButton type="button" aria-label="ปิด" onClick={onClose}><CloseRounded /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
    </Dialog>
  );
}
