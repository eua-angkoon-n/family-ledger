import { useId, useState, type Dispatch, type SetStateAction } from 'react';
import { Box, Button, Collapse, MenuItem, Stack, TextField } from '@mui/material';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { type TaxDocument, type TaxDocumentType, type TaxEntity } from '../api.js';
import { createFormFieldChangeHandler } from '../form.js';
import { AMOUNT_FORMAT_HINT, formatBaht, parseBahtToSatang } from '../format.js';
import { DOCUMENT_TYPE_LABEL } from '../taxDocumentLabels.js';
import { dataTextSx } from '../theme.js';
import { LoadError } from '../ui.js';

export type TaxDocumentMetaForm = {
  tax_entity_id: string;
  document_type: TaxDocumentType;
  tax_year: string;
  issuer_name: string;
  issuer_tax_id: string;
  document_no: string;
  issue_date: string;
  subtotal_baht: string;
  vat_baht: string;
  total_baht: string;
  withholding_baht: string;
};

export type TaxDocumentMetaErrors = Partial<Record<keyof TaxDocumentMetaForm, string>>;

export const EMPTY_TAX_DOC_META_FORM: TaxDocumentMetaForm = {
  tax_entity_id: '',
  document_type: 'receipt',
  // DB เก็บ tax_year แบบ ค.ศ. (migration 009: check between 2000-2200) — แสดงเป็น พ.ศ. ด้วย taxYearBE เท่านั้น ห้ามบวก 543 ในค่าที่ส่ง
  tax_year: String(new Date().getFullYear()),
  issuer_name: '',
  issuer_tax_id: '',
  document_no: '',
  issue_date: '',
  subtotal_baht: '',
  vat_baht: '',
  total_baht: '',
  withholding_baht: '',
};

/** ปีภาษี ค.ศ. (ค่าที่เก็บ/ส่ง API) → ข้อความ พ.ศ. ที่แสดงทุกที่ของหน้าเอกสารภาษี */
export const taxYearBE = (yearCE: number | string) => String(Number(yearCE) + 543);

/**
 * ตัวเลือกปีภาษี (ค่า ค.ศ. เรียงใหม่ → เก่า): ปีหน้าถึงย้อนหลัง 6 ปี + ค่าที่เลือกอยู่ถ้าอยู่นอกช่วง
 * (ลิงก์จากหน้าภาษี `?tax_year=`, เอกสารเก่าตอนแก้) — select แทนช่องพิมพ์ กันพิมพ์ 2569 แล้ว server ปฏิเสธ
 */
export function taxYearOptions(selected = ''): number[] {
  const now = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => now + 1 - i);
  const extra = Number(selected);
  if (selected !== '' && Number.isInteger(extra) && !years.includes(extra)) years.push(extra);
  return years.sort((a, b) => b - a);
}

// ช่องที่พับไว้ใน "รายละเอียดเพิ่มเติม" — หนังสือรับรองหัก ณ ที่จ่ายยกช่องหัก ณ ที่จ่ายขึ้นมาข้างบน (หน้าภาษีอ่านยอดนี้)
const OPTIONAL_KEYS = ['issuer_tax_id', 'document_no', 'issue_date', 'subtotal_baht', 'vat_baht', 'withholding_baht'] as const;
// ลำดับเดียวกับบนจอ — focus ช่องแรกที่ผิด
const FIELD_ORDER: (keyof TaxDocumentMetaForm)[] = ['tax_entity_id', 'document_type', 'tax_year', 'issuer_name', 'total_baht', ...OPTIONAL_KEYS];

export const metaFieldId = (prefix: string, key: keyof TaxDocumentMetaForm) => `${prefix}-${key}`;

/** id ของช่องแรกที่ผิด (ตามลำดับบนจอ) — ไม่มี = null */
export function firstMetaErrorId(prefix: string, errors: TaxDocumentMetaErrors): string | null {
  const key = FIELD_ORDER.find((k) => errors[k]);
  return key ? metaFieldId(prefix, key) : null;
}

/** ช่องเงินว่าง = ไม่กรอก, มีค่าแต่อ่านไม่ได้ = error (ไม่กลายเป็น null เงียบ ๆ) */
export function taxDocumentMetaErrors(form: TaxDocumentMetaForm): TaxDocumentMetaErrors {
  const errors: TaxDocumentMetaErrors = {};
  if (!form.tax_entity_id) errors.tax_entity_id = 'เลือกผู้เสียภาษี';
  if (!form.issuer_name.trim()) errors.issuer_name = 'กรอกชื่อผู้ออกเอกสาร';
  if (form.total_baht.trim() === '') errors.total_baht = 'กรอกยอดรวม';
  else if (parseBahtToSatang(form.total_baht) == null) errors.total_baht = AMOUNT_FORMAT_HINT;
  for (const key of ['subtotal_baht', 'vat_baht', 'withholding_baht'] as const) {
    if (form[key].trim() !== '' && parseBahtToSatang(form[key]) == null) errors[key] = AMOUNT_FORMAT_HINT;
  }
  return errors;
}

const optionalSatang = (value: string) => (value.trim() === '' ? null : parseBahtToSatang(value));

/** เรียกหลัง taxDocumentMetaErrors ว่างแล้วเท่านั้น — ส่งทุก key เสมอ (PATCH ล้างช่องที่ไม่บังคับได้ด้วย null) */
export function taxDocumentMetaPayload(form: TaxDocumentMetaForm) {
  return {
    tax_entity_id: Number(form.tax_entity_id),
    document_type: form.document_type,
    tax_year: Number(form.tax_year),
    issuer_name: form.issuer_name.trim(),
    issuer_tax_id: form.issuer_tax_id.trim() || null,
    document_no: form.document_no.trim() || null,
    issue_date: form.issue_date || null,
    subtotal_satang: optionalSatang(form.subtotal_baht),
    vat_satang: optionalSatang(form.vat_baht),
    total_satang: parseBahtToSatang(form.total_baht),
    withholding_satang: optionalSatang(form.withholding_baht),
  };
}

// ยอดที่อ่านไม่ได้คงเป็นข้อความ — ไม่งั้นพิมพ์ "abc" ในช่องที่ว่างอยู่ได้ null เท่าเดิม แล้วไม่นับว่าแก้
const amountKey = (value: string) => (value.trim() === '' ? null : parseBahtToSatang(value) ?? value);

/** ค่าที่ใช้เทียบว่าฟอร์มถูกแก้หรือยัง — เทียบค่าที่จะส่ง ไม่ใช่ข้อความ: พิมพ์ "1500" ทับ "1,500.00" ไม่นับว่าแก้ */
export function taxDocumentMetaKey(form: TaxDocumentMetaForm): string {
  return JSON.stringify({
    ...taxDocumentMetaPayload(form),
    subtotal_satang: amountKey(form.subtotal_baht),
    vat_satang: amountKey(form.vat_baht),
    total_satang: amountKey(form.total_baht),
    withholding_satang: amountKey(form.withholding_baht),
  });
}

const bahtInput = (satang: number | null) => (satang == null ? '' : formatBaht(satang));

/** ค่าเดิมของเอกสารเป็นฟอร์มแก้ไข — ยอดเงินรูปเดียวกับตัวอย่าง "1,500.00" (Inputs ใน DESIGN.md) */
export function taxDocumentToForm(doc: TaxDocument): TaxDocumentMetaForm {
  return {
    tax_entity_id: String(doc.tax_entity_id),
    document_type: doc.document_type,
    tax_year: String(doc.tax_year),
    issuer_name: doc.issuer_name,
    issuer_tax_id: doc.issuer_tax_id ?? '',
    document_no: doc.document_no ?? '',
    issue_date: doc.issue_date ?? '',
    subtotal_baht: bahtInput(doc.subtotal_satang),
    vat_baht: bahtInput(doc.vat_satang),
    total_baht: bahtInput(doc.total_satang),
    withholding_baht: bahtInput(doc.withholding_satang),
  };
}

// ใช้ร่วมกันระหว่าง TaxDocumentUploadModal, ลิ้นชักโหมดแก้ไข และ GmailAttachmentPicker — ฟอร์มเดียวกันทุกที่
// error ของช่องบังคับขึ้นหลังกดบันทึก (`attempted`) ส่วนยอดเงินที่อ่านไม่ได้ขึ้นทันทีที่พิมพ์
export function TaxDocumentMetadataFields({
  form, setForm, taxEntities, idPrefix, attempted, entitiesLoad, followIssueYear = false,
}: {
  /** เอกสารใหม่: กรอกวันที่ออกแล้วปีภาษีตามปีของวันที่นั้น จนกว่าผู้ใช้จะเลือกปีเอง (ปีตั้งต้นคือปีปัจจุบัน ซึ่งมักผิดกับเอกสารปีก่อน) */
  followIssueYear?: boolean;
  form: TaxDocumentMetaForm;
  setForm: Dispatch<SetStateAction<TaxDocumentMetaForm>>;
  taxEntities: TaxEntity[];
  /** prefix ของ id ช่อง (useId ของผู้เรียก) — ผู้เรียก focus ช่องแรกที่ผิดด้วย firstMetaErrorId */
  idPrefix: string;
  attempted: boolean;
  /** รายชื่อผู้เสียภาษีโหลดไม่ได้ = LoadError พร้อมลองใหม่ในฟอร์ม ไม่ใช่ช่องเลือกว่างเงียบ ๆ (The Section Failure Rule) */
  entitiesLoad?: { error: string; onRetry: () => void };
}) {
  const setFormField = createFormFieldChangeHandler(setForm);
  const errors = taxDocumentMetaErrors(form);
  // ช่องบังคับที่ว่างบอกหลังกดบันทึก · ยอดเงินผิดรูปบอกทันที
  const err = (key: keyof TaxDocumentMetaForm) =>
    attempted || (errors[key] === AMOUNT_FORMAT_HINT) ? errors[key] : undefined;
  const id = (key: keyof TaxDocumentMetaForm) => metaFieldId(idPrefix, key);
  const selectId = (key: keyof TaxDocumentMetaForm) => ({ select: { SelectDisplayProps: { id: id(key) } } });
  const amountInput = (key: keyof TaxDocumentMetaForm) => ({ htmlInput: { id: id(key), inputMode: 'decimal' as const, sx: dataTextSx } });

  const withholdingUp = form.document_type === 'withholding_certificate';
  const foldedKeys = OPTIONAL_KEYS.filter((k) => !(withholdingUp && k === 'withholding_baht'));
  // เปิดเองเมื่อช่องที่พับมีค่า (แก้เอกสารที่กรอกไว้แล้ว) หรือมี error ตอนกดบันทึก — ไม่งั้นค่า/ข้อผิดพลาดซ่อนอยู่
  const [moreOpen, setMoreOpen] = useState(() => foldedKeys.some((k) => form[k] !== ''));
  const foldedError = foldedKeys.some((k) => err(k));
  const open = moreOpen || foldedError;
  const panelId = useId();

  // ปีของวันที่ออก (ค.ศ.) — นอกช่วงที่ server รับ (2000–2200) ถือว่ายังไม่มี
  const yearOf = (date: string) => (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number(date.slice(0, 4)) >= 2000 && Number(date.slice(0, 4)) <= 2200 ? date.slice(0, 4) : '');
  const [yearTouched, setYearTouched] = useState(false);
  const issueYear = yearOf(form.issue_date);
  // ต่างกันได้จริงเฉพาะออกปีถัดไป (หนังสือรับรองหัก ณ ที่จ่ายของปีก่อนออกต้นปี) — กรณีอื่นมักกรอกผิด · เตือนใต้ช่อง ไม่บล็อก
  const yearHelp = issueYear === '' ? undefined : issueYear !== form.tax_year
    ? Number(issueYear) === Number(form.tax_year) + 1
      ? `วันที่ออกเอกสารเป็นปี ${taxYearBE(issueYear)} — ถ้าเป็นเอกสารของปีก่อน (เช่นหนังสือรับรองหัก ณ ที่จ่ายที่ออกต้นปี) ปีภาษีนี้ถูกแล้ว`
      : `วันที่ออกเอกสารเป็นปี ${taxYearBE(issueYear)} — ปีภาษีไม่ตรงกับวันที่ออก ตรวจอีกครั้ง`
    : followIssueYear && !yearTouched ? 'ตามปีของวันที่ออกเอกสาร' : undefined;

  const activeEntities = taxEntities.filter((e) => e.is_active || String(e.id) === form.tax_entity_id);
  const entityHelp = err('tax_entity_id')
    ?? (taxEntities.length === 0 && !entitiesLoad?.error ? 'ยังไม่มีผู้เสียภาษี เพิ่มได้ที่หน้า "บัญชีของฉัน"' : undefined);

  const withholdingField = (
    <TextField
      label="ภาษีหัก ณ ที่จ่าย (บาท)"
      value={form.withholding_baht}
      onChange={setFormField('withholding_baht')}
      error={Boolean(err('withholding_baht'))}
      helperText={err('withholding_baht') ?? 'ไม่กรอก = หน้าภาษีไม่นับยอดนี้'}
      slotProps={amountInput('withholding_baht')}
    />
  );

  return (
    <Stack spacing={2}>
      {entitiesLoad?.error && <LoadError message={entitiesLoad.error} onRetry={entitiesLoad.onRetry} />}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))' }}>
        <TextField
          select
          label="ผู้เสียภาษี"
          value={form.tax_entity_id}
          onChange={setFormField('tax_entity_id')}
          required
          error={Boolean(err('tax_entity_id'))}
          helperText={entityHelp}
          slotProps={selectId('tax_entity_id')}
        >
          <MenuItem value=""><em>— เลือก —</em></MenuItem>
          {activeEntities.map((e) => <MenuItem key={e.id} value={String(e.id)}>{e.display_name}</MenuItem>)}
          {/* รายชื่อยังโหลดไม่ได้แต่เอกสารมีค่าอยู่แล้ว — ไม่ปล่อยช่องว่างเหมือนยังไม่เลือก */}
          {form.tax_entity_id && !activeEntities.some((e) => String(e.id) === form.tax_entity_id) &&<MenuItem value={form.tax_entity_id}>ผู้เสียภาษีรหัส {form.tax_entity_id}</MenuItem>}
        </TextField>
        <TextField select label="ประเภทเอกสาร" value={form.document_type} onChange={setFormField('document_type')} required slotProps={selectId('document_type')}>
          {(Object.entries(DOCUMENT_TYPE_LABEL) as [TaxDocumentType, string][]).map(([value, label]) => (
            <MenuItem key={value} value={value}>{label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="ปีภาษี (พ.ศ.)"
          value={form.tax_year}
          onChange={(ev) => { setYearTouched(true); setFormField('tax_year')(ev); }}
          required
          helperText={yearHelp}
          slotProps={{ ...selectId('tax_year'), formHelperText: { sx: { color: issueYear !== '' && issueYear !== form.tax_year ? 'warning.main' : undefined } } }}
        >
          {taxYearOptions(form.tax_year).map((y) => <MenuItem key={y} value={String(y)} sx={dataTextSx}>{taxYearBE(y)}</MenuItem>)}
        </TextField>
        <TextField
          label="ผู้ออกเอกสาร"
          value={form.issuer_name}
          onChange={setFormField('issuer_name')}
          required
          error={Boolean(err('issuer_name'))}
          helperText={err('issuer_name')}
          slotProps={{ htmlInput: { id: id('issuer_name'), maxLength: 200 } }}
        />
        <TextField
          label="ยอดรวม (บาท)"
          value={form.total_baht}
          onChange={setFormField('total_baht')}
          required
          error={Boolean(err('total_baht'))}
          helperText={err('total_baht')}
          slotProps={amountInput('total_baht')}
        />
        {withholdingUp && withholdingField}
      </Box>

      <Box>
        <Button
          color="inherit"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setMoreOpen(!open)}
          endIcon={
            <ExpandMoreRounded
              sx={{
                transform: open ? 'rotate(180deg)' : 'none',
                transition: (theme) => theme.transitions.create('transform'),
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            />
          }
          sx={{ ml: -1, px: 1 }}
        >
          รายละเอียดเพิ่มเติม (ไม่บังคับ)
        </Button>
        <Box id={panelId}>
          <Collapse in={open}>
            <Box sx={{ display: 'grid', gap: 2, pt: 1.5, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))' }}>
              <TextField label="เลขที่เอกสาร" value={form.document_no} onChange={setFormField('document_no')} slotProps={{ htmlInput: { id: id('document_no'), maxLength: 100, sx: dataTextSx } }} />
              <TextField
                label="วันที่ออกเอกสาร"
                type="date"
                value={form.issue_date}
                onChange={(ev) => {
                  const date = ev.target.value;
                  const follow = followIssueYear && !yearTouched ? yearOf(date) : '';
                  setForm((f) => ({ ...f, issue_date: date, ...(follow ? { tax_year: follow } : {}) }));
                }}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { id: id('issue_date') } }}
              />
              <TextField label="เลขผู้เสียภาษีของผู้ออก" value={form.issuer_tax_id} onChange={setFormField('issuer_tax_id')} slotProps={{ htmlInput: { id: id('issuer_tax_id'), maxLength: 20, inputMode: 'numeric', sx: dataTextSx } }} />
              <TextField
                label="ยอดก่อนภาษี (บาท)"
                value={form.subtotal_baht}
                onChange={setFormField('subtotal_baht')}
                error={Boolean(err('subtotal_baht'))}
                helperText={err('subtotal_baht')}
                slotProps={amountInput('subtotal_baht')}
              />
              <TextField
                label="ภาษีมูลค่าเพิ่ม (บาท)"
                value={form.vat_baht}
                onChange={setFormField('vat_baht')}
                error={Boolean(err('vat_baht'))}
                helperText={err('vat_baht')}
                slotProps={amountInput('vat_baht')}
              />
              {!withholdingUp && withholdingField}
            </Box>
          </Collapse>
        </Box>
      </Box>
    </Stack>
  );
}
