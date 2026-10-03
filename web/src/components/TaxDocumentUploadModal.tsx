import { useEffect, useId, useRef, useState } from 'react';
import { Alert, Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import UploadFileRounded from '@mui/icons-material/UploadFileRounded';
import { post, type TaxEntity } from '../api.js';
import Modal from '../Modal.js';
import { dataTextSx } from '../theme.js';
import type { Notice } from '../ui.js';
import {
  EMPTY_TAX_DOC_META_FORM, firstMetaErrorId, TaxDocumentMetadataFields, taxDocumentMetaErrors, taxDocumentMetaKey, taxDocumentMetaPayload,
} from './TaxDocumentMetadataFields.js';

type Props = {
  open: boolean;
  taxEntities: TaxEntity[];
  entitiesLoad?: { error: string; onRetry: () => void };
  /** ผู้เสียภาษีตั้งต้น: ตัวกรองที่เลือกอยู่ หรือคนเดียวที่มี (ว่าง = ให้เลือกเอง) */
  defaultTaxEntityId: string;
  onClose: () => void;
  onSaved: () => void;
  onNotice: (notice: Notice) => void;
};

// เพดานเดียวกับ server: detectMime รับแค่ PDF/JPEG/PNG (src/routes/tax-documents.ts) และ MAX_FILE_BYTES 10MB หลัง decode (src/http.ts)
// base64 โต ~4/3 → 13.4MB ยังต่ำกว่าเพดาน 15MB ต่อคำขอ (src/server.ts) — web import src/ ไม่ได้ จึงเขียนค่าซ้ำไว้ที่นี่
const MAX_FILE_BYTES = 10 * 1024 * 1024;
// image/jpg = ชนิดที่ Android บางรุ่นรายงานแทน image/jpeg (server ดู magic bytes ไม่ดูชนิดนี้)
const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/jpg,image/png';
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const FILE_HELP = 'PDF, JPEG หรือ PNG ไม่เกิน 10MB';

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;

// type ว่าง (บางเครื่องไม่รู้ชนิด) ปล่อยให้ server ตรวจ magic bytes เอง · 0 ไบต์ = ไฟล์เสียหรือดาวน์โหลดไม่จบ บอกก่อนส่ง
function fileProblem(file: File): string {
  if (file.size === 0) return 'ไฟล์นี้ว่าง (0 ไบต์) เลือกไฟล์อื่น';
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) return `รับเฉพาะ ${FILE_HELP}`;
  if (file.size > MAX_FILE_BYTES) return `ไฟล์นี้ ${formatSize(file.size)} เกินเพดาน 10MB`;
  return '';
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

const revealOnMount = (el: HTMLElement | null) => el?.scrollIntoView({ block: 'nearest' });

// ยัด base64 ใน JSON แทน multipart — ไม่เพิ่ม dependency ใหม่ · ไม่มีแถบความคืบหน้าจริง (fetch ไม่รายงานการส่ง) บอกเป็นสถานะ "กำลังอัปโหลด"
export default function TaxDocumentUploadModal({ open, taxEntities, entitiesLoad, defaultTaxEntityId, onClose, onSaved, onNotice }: Props) {
  const idPrefix = useId();
  const fileId = `${idPrefix}-file`;
  const [initial, setInitial] = useState(EMPTY_TAX_DOC_META_FORM);
  const [form, setForm] = useState(EMPTY_TAX_DOC_META_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // snackbar อยู่ใน #root ซึ่งเป็น aria-hidden ระหว่าง modal เปิด — ประกาศผลหลังปิดสนิท
  const exitNoticeRef = useRef<Notice | null>(null);

  // ค่าตั้งต้นทุกครั้งที่เปิด (ปีปัจจุบัน + ผู้เสียภาษีตั้งต้น) — dirty เทียบกับค่านี้ · กรอกวันที่ออกแล้วปีตามวันที่ (followIssueYear)
  useEffect(() => {
    if (!open) return;
    const start = { ...EMPTY_TAX_DOC_META_FORM, tax_year: String(new Date().getFullYear()), tax_entity_id: defaultTaxEntityId };
    setInitial(start);
    setForm(start);
    setFile(null);
    setAttempted(false);
    setError('');
  }, [open]);

  const fileError = file ? fileProblem(file) : attempted ? 'เลือกไฟล์เอกสาร' : '';

  const submit = async () => {
    if (submitting) return;
    setError('');
    setAttempted(true);
    const errors = taxDocumentMetaErrors(form);
    const firstError = !file || fileProblem(file) ? fileId : firstMetaErrorId(idPrefix, errors);
    if (firstError) {
      // ช่องที่ผิดอาจอยู่ในส่วนที่เพิ่งกางออก — รอ render ก่อน focus
      requestAnimationFrame(() => document.getElementById(firstError)?.focus());
      return;
    }
    setSubmitting(true);
    try {
      const fileBase64 = await readAsBase64(file!);
      await post('/api/tax-documents', { ...taxDocumentMetaPayload(form), filename: file!.name, file_base64: fileBase64 });
      exitNoticeRef.current = { message: `อัปโหลดเอกสารของ “${form.issuer_name.trim()}” แล้ว`, severity: 'success' };
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="อัปโหลดเอกสารภาษี"
      onClose={onClose}
      busy={submitting}
      dirty={file != null || taxDocumentMetaKey(form) !== taxDocumentMetaKey(initial)}
      footer={{ formId: `${idPrefix}-form`, submitLabel: 'อัปโหลด' }}
      onExited={() => {
        // ล้างตอนปิดสนิท — ไม่งั้นเปิดครั้งถัดไปเห็นค่าเก่าหนึ่งเฟรม และส่วนที่พับคำนวณกาง/พับจากค่าเก่า
        setInitial(EMPTY_TAX_DOC_META_FORM);
        setForm(EMPTY_TAX_DOC_META_FORM);
        setFile(null);
        setAttempted(false);
        setError('');
        const notice = exitNoticeRef.current;
        exitNoticeRef.current = null;
        if (notice) onNotice(notice);
      }}
    >
      {/* noValidate: ช่องบังคับตรวจเอง (error ไทยใต้ช่อง + focus ช่องแรกที่ผิด) — `required` คงไว้เพื่อ * และ aria-required */}
      <Box
        component="form"
        id={`${idPrefix}-form`}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Stack spacing={2.5}>
          {error && <Alert ref={revealOnMount} severity="error">{error}</Alert>}
          <Box>
            {/* ปุ่มจริงสั่ง input ที่ซ่อนไว้ — Button component="label" กด Enter/Space แล้วไม่เปิดหน้าต่างเลือกไฟล์ */}
            <Button
              id={fileId}
              variant="outlined"
              startIcon={<UploadFileRounded />}
              onClick={() => fileInputRef.current?.click()}
              aria-describedby={`${fileId}-help`}
              color={fileError ? 'error' : 'primary'}
            >
              {file ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) setFile(picked);
                e.target.value = ''; // เลือกไฟล์เดิมซ้ำ (หลังแก้ไฟล์) ยังได้ change
              }}
            />
            <Box id={`${fileId}-help`} sx={{ mt: 0.75 }}>
              {file && (
                <Typography variant="body2" sx={{ ...dataTextSx, overflowWrap: 'anywhere' }}>
                  {file.name} · {formatSize(file.size)}
                </Typography>
              )}
              <Typography variant="body2" color={fileError ? 'error' : 'text.secondary'}>{fileError || FILE_HELP}</Typography>
            </Box>
          </Box>
          <TaxDocumentMetadataFields
            form={form}
            setForm={setForm}
            taxEntities={taxEntities}
            idPrefix={idPrefix}
            attempted={attempted}
            entitiesLoad={entitiesLoad}
            followIssueYear
          />
          {/* live region อยู่ใน DOM ตลอด — ข้อความขึ้นตอนเริ่มส่ง จึงประกาศแน่นอน */}
          <Box role="status">
            {submitting && file && (
              <>
                <Typography variant="body2" color="text.secondary">
                  กำลังอัปโหลดไฟล์ <Box component="span" sx={dataTextSx}>{formatSize(file.size)}</Box> — ไฟล์ใหญ่อาจใช้เวลาสักครู่
                </Typography>
                <LinearProgress aria-label="กำลังอัปโหลด" sx={{ mt: 1, height: 2 }} />
              </>
            )}
          </Box>
        </Stack>
      </Box>
    </Modal>
  );
}
