import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import { del, patch, post, req, type TaxDeductionClaim, type TaxDocument } from '../api.js';
import Modal from '../Modal.js';
import { AMOUNT_FORMAT_HINT, formatBaht, parseBahtToSatang } from '../format.js';
import { dataTextSx } from '../theme.js';
import { amountFieldHelp, BELOW_MD, ConfirmDialog, LoadError, MD_UP, PageHeader, RowIconButton, TableSkeleton } from '../ui.js';
import Money from './Money.js';

// รายการเดียวกับ src/services/tax-rules.ts (DEDUCTION_TYPES) — ไม่มี 'personal' เพราะลดหย่อนส่วนตัว
// มาจาก personalAllowanceSatang ในสูตรอยู่แล้ว เปิดให้กรอกที่นี่ด้วยจะนับซ้ำ
export const DEDUCTION_TYPE_LABEL: Record<string, string> = {
  spouse: 'คู่สมรส',
  child: 'บุตร',
  parent: 'บิดามารดา',
  life_insurance: 'ประกันชีวิต',
  health_insurance: 'ประกันสุขภาพ',
  social_security: 'ประกันสังคม',
  provident_fund: 'กองทุนสำรองเลี้ยงชีพ',
  ssf: 'SSF',
  rmf: 'RMF',
  mortgage_interest: 'ดอกเบี้ยเงินกู้ที่อยู่อาศัย',
  donation: 'เงินบริจาค',
  other: 'อื่น ๆ',
};

/** ป้ายไทยของประเภทค่าลดหย่อน — code ที่ไม่มีป้าย (กฎปีใหม่ที่เว็บยังไม่รู้จัก) แสดง code ดิบเป็น fallback */
export const deductionLabel = (type: string) => DEDUCTION_TYPE_LABEL[type] ?? type;

type Form = { deduction_type: string; eligible: string; claimed: string; tax_document_id: string; note: string };
const emptyForm = (): Form => ({ deduction_type: 'donation', eligible: '', claimed: '', tax_document_id: '', note: '' });

// ฟอร์มเป็น noValidate แล้วตรวจเองตอนกดบันทึก (error ไทยใต้ช่อง focus ช่องแรกที่ผิด) — id เรียงตามลำดับในฟอร์ม
const AMOUNT_ID = { eligible: 'deduction-claim-eligible', claimed: 'deduction-claim-claimed' } as const;
type AmountField = keyof typeof AMOUNT_ID;
function amountErrors(form: Form): Partial<Record<AmountField, string>> {
  const errors: Partial<Record<AmountField, string>> = {};
  const eligible = parseBahtToSatang(form.eligible);
  const claimed = parseBahtToSatang(form.claimed);
  if (form.eligible.trim() === '') errors.eligible = 'กรอกยอดที่มีสิทธิ์';
  else if (eligible == null) errors.eligible = AMOUNT_FORMAT_HINT;
  if (form.claimed.trim() === '') errors.claimed = 'กรอกยอดที่ยื่นขอ';
  else if (claimed == null) errors.claimed = AMOUNT_FORMAT_HINT;
  else if (eligible != null && claimed > eligible) errors.claimed = 'ยอดที่ยื่นขอต้องไม่เกินยอดที่มีสิทธิ์';
  return errors;
}

// เทียบค่าที่จะส่ง ไม่ใช่ข้อความ (แบบ taxDocumentMetaKey): พิมพ์ "1500" ทับ "1,500.00" ไม่นับว่าแก้ · ยอดที่อ่านไม่ได้คงเป็นข้อความ
const amountKey = (value: string) => (value.trim() === '' ? null : parseBahtToSatang(value) ?? value);
const formKey = (f: Form) => JSON.stringify([f.deduction_type, amountKey(f.eligible), amountKey(f.claimed), f.tax_document_id, f.note || null]);

const documentLabel = (d: TaxDocument) => (d.document_no ? `${d.issuer_name} · ${d.document_no}` : d.issuer_name);
// คอลัมน์จัดการไม่พิมพ์ (ปุ่มไม่มีความหมายบนกระดาษ) — หัวและแถวพร้อมกัน
const ACTIONS_SX = { displayPrint: 'none' } as const;

type Props = { taxEntityId: number; taxYear: number; onChanged: () => void };

// ค่าลดหย่อน (§7.5 tax_deduction_claim) — ลบได้จริงไม่ใช่ archive (ดูคอมเมนต์ migration 010) เพราะ
// audit_log เก็บ before_data ทั้งแถวไว้แล้ว และ snapshot ที่คำนวณไปแล้วก็ freeze ยอดไว้แล้ว
export default function DeductionClaimSection({ taxEntityId, taxYear, onChanged }: Props) {
  // null = ยังไม่มีข้อมูลของผู้เสียภาษี/ปีนี้ (skeleton) · โหลดซ้ำหลังบันทึก/ลบคงตารางเดิมไว้
  const [rows, setRows] = useState<TaxDeductionClaim[] | null>(null);
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<TaxDeductionClaim | 'new' | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [initialForm, setInitialForm] = useState<Form>(emptyForm);
  const [formError, setFormError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  // แยก open ออกจากแถว — ระหว่าง dialog กำลังปิด ชื่อรายการยังอยู่ในคำถาม
  const [deleting, setDeleting] = useState<TaxDeductionClaim | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deletedRef = useRef(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setRows(null), [taxEntityId, taxYear]);
  useEffect(() => {
    let current = true;
    setError('');
    Promise.all([
      req<{ rows: TaxDeductionClaim[] }>(`/api/tax/deduction-claims?tax_entity_id=${taxEntityId}&tax_year=${taxYear}`),
      req<{ rows: TaxDocument[] }>(`/api/tax-documents?tax_entity_id=${taxEntityId}&tax_year=${taxYear}&limit=200`),
    ])
      .then(([claims, docs]) => { if (current) { setRows(claims.rows); setDocuments(docs.rows); } })
      // The Section Failure Rule: ไม่แสดงตารางเดิมที่อาจไม่ตรงกับข้อมูลจริงแล้ว
      .catch((e: Error) => { if (current) { setError(e.message); setRows(null); } });
    return () => { current = false; };
  }, [taxEntityId, taxYear, revision]);

  const refresh = () => { setRevision((n) => n + 1); onChanged(); };
  const openEditor = (claim: TaxDeductionClaim | 'new') => {
    const next = claim === 'new' ? emptyForm() : {
      deduction_type: claim.deduction_type,
      eligible: formatBaht(claim.eligible_amount_satang),
      claimed: formatBaht(claim.claimed_amount_satang),
      tax_document_id: claim.tax_document_id == null ? '' : String(claim.tax_document_id),
      note: claim.note ?? '',
    };
    setFormError(''); setAttempted(false); setForm(next); setInitialForm(next); setEditing(claim);
  };

  // response ของค่าลดหย่อนมีแค่ tax_document_id — ชื่อผู้ออก/เลขที่มาจากรายการเอกสารของปีนี้ที่โหลดไว้แล้ว (ไม่เรียก API เพิ่ม)
  // ไม่อยู่ในรายการ (เอกสารปีอื่น/เอาออกจากรายการแล้ว/เกิน 200 ใบ) = บอกแค่ว่าผูกแล้ว
  const documentText = (claim: TaxDeductionClaim) => {
    if (claim.tax_document_id == null) return 'ไม่ผูกเอกสาร';
    const doc = documents.find((d) => d.id === claim.tax_document_id);
    return doc ? documentLabel(doc) : 'ผูกเอกสารแล้ว';
  };

  const fieldErrors = attempted ? amountErrors(form) : {};
  // error ตอนกดบันทึกมาก่อน ไม่งั้นใช้คำเตือนรูปแบบตัวเลขระหว่างพิมพ์ (amountFieldHelp) แล้วค่อยคำใบ้ปกติ
  const amountHelp = (field: AmountField, hint?: string) => {
    const error = fieldErrors[field];
    if (error) return { error: true, helperText: error };
    const format = amountFieldHelp(form[field]);
    return 'error' in format ? format : { helperText: hint };
  };

  const save = async () => {
    setFormError(''); setAttempted(true);
    const invalid = (Object.keys(AMOUNT_ID) as AmountField[]).find((f) => amountErrors(form)[f]);
    if (invalid) {
      document.getElementById(AMOUNT_ID[invalid])?.focus();
      return;
    }
    setBusy(true);
    try {
      const body = {
        eligible_amount_satang: parseBahtToSatang(form.eligible)!,
        claimed_amount_satang: parseBahtToSatang(form.claimed)!,
        tax_document_id: form.tax_document_id ? Number(form.tax_document_id) : null,
        note: form.note || null,
      };
      if (editing === 'new') {
        await post('/api/tax/deduction-claims', { ...body, tax_entity_id: taxEntityId, tax_year: taxYear, deduction_type: form.deduction_type });
      } else if (editing) {
        await patch(`/api/tax/deduction-claims/${editing.id}`, body);
      }
      setEditing(null);
      refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'บันทึกค่าลดหย่อนไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!deleting || busy) return;
    setBusy(true); setDeleteError('');
    del(`/api/tax/deduction-claims/${deleting.id}`)
      .then(() => { deletedRef.current = true; setDeleteOpen(false); refresh(); })
      .catch((e: Error) => setDeleteError(e.message))
      .finally(() => setBusy(false));
  };

  const formDocumentMissing = form.tax_document_id !== '' && !documents.some((d) => String(d.id) === form.tax_document_id);
  const deletingText = deleting
    ? `ลบค่าลดหย่อน "${deductionLabel(deleting.deduction_type)}" ยอดยื่นขอ ฿${formatBaht(deleting.claimed_amount_satang)} — ลบแล้วกู้คืนไม่ได้ (ยังดูย้อนหลังได้ในประวัติการเปลี่ยนแปลง)`
    : '';

  return (
    <Box component="section" aria-labelledby="deduction-claim-heading">
      <PageHeader
        id="deduction-claim-heading"
        // ปลายทางของลิงก์ #deduction-claim-heading จากตารางที่มาของหน้าประมาณการ (useHashTarget focus หัวข้อนี้)
        tabIndex={-1}
        title="ค่าลดหย่อน"
        // เพดาน/ประกันสังคมอยู่ใต้ช่องในฟอร์ม (ตอนกรอกจริง) — ส่วนนำของหน้าบนมือถือสั้นลง
        description="ยอดที่ยื่นขอรวมเข้าประมาณการ ไม่รวมลดหย่อนส่วนตัวที่ระบบหักให้เอง"
        action={
          <Button ref={addButtonRef} variant="outlined" startIcon={<AddRounded />} onClick={() => openEditor('new')} sx={{ whiteSpace: 'nowrap', displayPrint: 'none' }}>
            เพิ่มค่าลดหย่อน
          </Button>
        }
      />

      {error && <LoadError message={error} onRetry={() => setRevision((n) => n + 1)} />}
      {rows == null ? !error && <TableSkeleton rows={2} /> : rows.length === 0 ? (
        // บรรทัดเดียว ไม่ใช่การ์ดว่างใหญ่ — ปุ่มเพิ่มอยู่ที่หัวส่วนแล้ว
        <Typography color="text.secondary" sx={{ mt: 1.5 }}>ยังไม่มีค่าลดหย่อนที่บันทึกไว้ — กด "เพิ่มค่าลดหย่อน" เพื่อให้ประมาณการแม่นยำขึ้น</Typography>
      ) : (
        // < md เหลือ ประเภท · ยื่นขอ · จัดการ — ยอดที่มีสิทธิ์และเอกสารพับเป็นบรรทัดรอง ตารางไม่ล้นกล่องจึงไม่มี tabIndex
        <TableContainer component={Paper} variant="outlined" role="region" aria-label="ตารางค่าลดหย่อน" sx={{ mt: 2 }}>
          <Table size="small" aria-label="ค่าลดหย่อน" sx={{ '& .MuiTableCell-root': { px: { xs: 1, md: 2 } } }}>
            <TableHead>
              <TableRow>
                <TableCell>ประเภท</TableCell>
                <TableCell align="right" sx={MD_UP}>มีสิทธิ์</TableCell>
                <TableCell align="right">ยื่นขอ</TableCell>
                <TableCell sx={MD_UP}>เอกสาร</TableCell>
                <TableCell align="right" sx={ACTIONS_SX}>จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((claim) => {
                const label = deductionLabel(claim.deduction_type);
                const doc = documentText(claim);
                return (
                  <TableRow key={claim.id} hover>
                    <TableCell sx={{ overflowWrap: 'anywhere' }}>
                      {label}
                      <Typography variant="body2" color="text.secondary" sx={{ ...BELOW_MD, overflowWrap: 'anywhere' }}>
                        มีสิทธิ์ <Money satang={claim.eligible_amount_satang} /> · {doc}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ ...MD_UP, whiteSpace: 'nowrap' }}><Money satang={claim.eligible_amount_satang} /></TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Money satang={claim.claimed_amount_satang} /></TableCell>
                    <TableCell sx={{ ...MD_UP, overflowWrap: 'anywhere', color: claim.tax_document_id == null ? 'text.secondary' : undefined }}>{doc}</TableCell>
                    <TableCell align="right" sx={{ ...ACTIONS_SX, py: 0.5, whiteSpace: 'nowrap' }}>
                      <RowIconButton label={`แก้ไข ${label}`} tooltip="แก้ไข" onClick={() => openEditor(claim)}>
                        <EditRounded fontSize="small" />
                      </RowIconButton>
                      <RowIconButton label={`ลบ ${label}`} tooltip="ลบ" color="error" onClick={() => { setDeleteError(''); setDeleting(claim); setDeleteOpen(true); }}>
                        <DeleteOutlineRounded fontSize="small" />
                      </RowIconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal
        open={editing != null}
        title={editing === 'new' ? 'เพิ่มค่าลดหย่อน' : 'แก้ไขค่าลดหย่อน'}
        onClose={() => setEditing(null)}
        busy={busy}
        dirty={formKey(form) !== formKey(initialForm)}
        footer={{ formId: 'deduction-claim-form', submitLabel: editing === 'new' ? 'เพิ่มค่าลดหย่อน' : 'บันทึกการแก้ไข' }}
      >
        {/* noValidate: ช่องยอดเงินตรวจเองใน save (AMOUNT_ID) — `required` คงไว้เพื่อ * และ aria-required */}
        <Stack component="form" id="deduction-claim-form" noValidate spacing={2} onSubmit={(e) => { e.preventDefault(); if (!busy) void save(); }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            select label="ประเภทค่าลดหย่อน" required disabled={editing !== 'new'}
            value={form.deduction_type} onChange={(e) => setForm({ ...form, deduction_type: e.target.value })}
            helperText={editing !== 'new' ? 'เปลี่ยนประเภทไม่ได้ ถ้าเลือกผิดให้ลบแล้วเพิ่มใหม่' : 'ประกันสังคมที่หักจากเงินเดือนไม่ถูกนับเอง ต้องเพิ่มเป็นประเภท "ประกันสังคม"'}
          >
            {Object.entries(DEDUCTION_TYPE_LABEL).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <TextField id={AMOUNT_ID.eligible} label="ยอดที่มีสิทธิ์ (บาท)" required value={form.eligible} onChange={(e) => setForm({ ...form, eligible: e.target.value })} {...amountHelp('eligible')} slotProps={{ htmlInput: { inputMode: 'decimal', sx: dataTextSx } }} />
          <TextField id={AMOUNT_ID.claimed} label="ยอดที่ยื่นขอ (บาท)" required value={form.claimed} onChange={(e) => setForm({ ...form, claimed: e.target.value })} {...amountHelp('claimed', 'ยอดที่ใช้สิทธิ์ได้จริงหลังเทียบเพดานตามกฎหมายของประเภทนี้ — ระบบไม่ได้ตรวจเพดานให้')} slotProps={{ htmlInput: { inputMode: 'decimal', sx: dataTextSx } }} />
          <TextField select label="เอกสารอ้างอิง" value={form.tax_document_id} onChange={(e) => setForm({ ...form, tax_document_id: e.target.value })} helperText="ไม่บังคับ แต่ต้องมีก่อนถือว่าตรวจสอบครบ">
            <MenuItem value="">ไม่ผูกเอกสาร</MenuItem>
            {formDocumentMissing && <MenuItem value={form.tax_document_id}>เอกสารที่ผูกไว้เดิม (ไม่อยู่ในรายการปีนี้)</MenuItem>}
            {documents.map((d) => <MenuItem key={d.id} value={String(d.id)}>{documentLabel(d)}</MenuItem>)}
          </TextField>
          <TextField label="โน้ต (ไม่บังคับ)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 500 } }} />
        </Stack>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="ลบค่าลดหย่อน"
        description={deleteError ? <>{deletingText}<Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert></> : deletingText}
        confirmLabel="ลบ"
        confirmColor="error"
        busy={busy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        // แถวที่ลบหายไปพร้อมปุ่มต้นทาง — focus ไปปุ่มเพิ่มหลัง dialog ปิดสนิท (The Row Action Rule)
        onExited={() => {
          setDeleting(null);
          if (!deletedRef.current) return;
          deletedRef.current = false;
          addButtonRef.current?.focus();
        }}
      />
    </Box>
  );
}
