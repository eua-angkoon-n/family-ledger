import { useState, type ReactNode } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { ConfirmDialog } from './ui.js';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  /** ฟอร์มต่างจากค่าตอนเปิด — Esc, คลิกฉากหลัง, ปุ่มปิด และ "ยกเลิก" ถามก่อนทิ้ง (The Unsaved Edit Rule) */
  dirty?: boolean;
  /**
   * Modal วาดแถบปุ่มล่างเอง "ยกเลิก" + ปุ่มบันทึก — ทุกฟอร์มหน้าตาเดียวกัน และปุ่มยกเลิกผ่านการถามเดียวกับ Esc
   * ปุ่มบันทึกอยู่นอก <form> จึงผูกด้วย attribute `form` ผู้เรียกใส่ `id={formId}` ให้ form และกันกดซ้ำตอน busy
   * ใน onSubmit เอง (busy = aria-disabled ไม่ใช่ disabled — Enter ในช่องกรอกยัง submit ได้)
   */
  footer?: { formId: string; submitLabel: string };
};

export default function Modal({ open, title, onClose, children, busy = false, dirty = false, footer }: Props) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };
  return (
    <>
      <Dialog open={open} onClose={requestClose} maxWidth="md" fullWidth aria-labelledby="modal-title">
        <DialogTitle component="div" id="modal-title">
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography component="h2" variant="h2">{title}</Typography>
            {/* busy = aria-disabled: ปุ่มที่ถือ focus อยู่ไม่ทำ focus หลุดไป <body> (Buttons ใน DESIGN.md) */}
            <IconButton type="button" aria-label="ปิด" onClick={requestClose} aria-disabled={busy}><CloseRounded /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>{children}</DialogContent>
        {footer && (
          // gap แทน margin ของ MUI — ปุ่มตัดบรรทัดที่ 320px โดยไม่เยื้อง (เหมือน ConfirmDialog)
          <DialogActions disableSpacing sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button type="button" color="inherit" onClick={requestClose} aria-disabled={busy}>ยกเลิก</Button>
            <Button type="submit" form={footer.formId} variant="contained" aria-disabled={busy} aria-busy={busy}>
              {busy ? 'กำลังบันทึก…' : footer.submitLabel}
            </Button>
          </DialogActions>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirmDiscard}
        title="ทิ้งการแก้ไขหรือไม่"
        description="ค่าที่กรอกไว้ในฟอร์มนี้ยังไม่ได้บันทึก ปิดแล้วจะหายไป"
        confirmLabel="ทิ้งการแก้ไข"
        confirmColor="error"
        cancelLabel="แก้ต่อ"
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}
