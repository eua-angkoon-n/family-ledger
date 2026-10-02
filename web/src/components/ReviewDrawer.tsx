import { useEffect, useRef, useState } from 'react';
import { TAX_PAGES_ENABLED } from '../features.js';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  ListSubheader,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import SwapHorizRounded from '@mui/icons-material/SwapHorizRounded';
import {
  patch, post, put, req,
  TAX_TREATMENT_LABEL,
  type Category, type Classification, type TaxEntity, type TaxTreatment, type TxnDetail, type TxnSplit,
} from '../api.js';
import { formatBaht, formatDate, parseBahtToSatang } from '../format.js';
import { dataTextSx, radii } from '../theme.js';
import { LoadError, type Notice } from '../ui.js';
import IncomeQuickAddModal from './IncomeQuickAddModal.js';
import Money from './Money.js';

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  income: 'รายรับ',
  expense: 'รายจ่าย',
  internal_transfer: 'โอนภายใน',
  excluded: 'ไม่นับรวม',
};

// h3 ใต้ชื่อ drawer (h2) ขั้น Headline Small ของ DESIGN.md
const SECTION_HEADING_SX = { fontSize: '1rem', lineHeight: 1.5 } as const;

// category_id เป็น string เสมอ (ค่าว่าง = ยังไม่เลือก) — เลี่ยงปัญหา MUI Select ที่ value เป็น union
// number | '' แล้ว TS สืบ generic type ของ onChange event ไม่ได้ตรงกับที่ประกาศ แปลงเป็น number ตอน submit
type SplitRow = { key: string; category_id: string; amountText: string; note: string };

// สตางค์ → ข้อความในช่องกรอก ด้วยเลขจำนวนเต็ม (ไม่หาร 100 แบบทศนิยม)
const satangToInput = (satang: number) => `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, '0')}`;

function splitsToRows(splits: TxnSplit[]): SplitRow[] {
  return splits.map((s) => ({ key: String(s.id), category_id: String(s.category_id), amountText: satangToInput(s.amount_satang), note: s.note ?? '' }));
}

const singleCategoryOf = (splits: TxnSplit[]) => (splits.length === 1 ? String(splits[0]!.category_id) : '');

function amountError(row: SplitRow, submitted: boolean): string {
  if (row.amountText.trim() === '') return submitted ? 'กรอกยอด' : '';
  const satang = parseBahtToSatang(row.amountText);
  if (satang == null) return 'รูปแบบไม่ถูกต้อง';
  return satang > 0 ? '' : 'ต้องมากกว่า 0';
}

function initialClassification(detail: TxnDetail): Classification {
  if (detail.is_internal_transfer) return 'internal_transfer';
  if (detail.classification) return detail.classification;
  return detail.direction === 'credit' ? 'income' : 'expense';
}

type ReviewDrawerProps = {
  txnId: number | null;
  categories: Category[];
  taxEntities: TaxEntity[];
  onClose: () => void;
  /** ปิดเสร็จ (จบ transition) — ผู้เรียกคืน focus เอง เพราะปุ่มที่เปิด drawer อาจหายไปแล้ว (คิวยังไม่ตรวจ) หรือเป็นแถวอื่น (ก่อนหน้า/ถัดไป) */
  onExited?: () => void;
  onSaved: () => void;
  onNotice: (notice: Notice) => void;
  /** undefined = ไม่มีแถวก่อนหน้า/ถัดไปในรายการที่แสดงอยู่ */
  onPrev?: () => void;
  onNext?: () => void;
  /** "รายการที่ 3 จาก 50 ในหน้านี้" — ไม่ส่งมา = เปิดจากลิงก์ ไม่อยู่ในรายการ ไม่มีแถบเลื่อนรายการ */
  position?: string;
};

// Drawer เดียวทำสามงาน: จัดประเภท+หมวด, แยกยอดหลายหมวด, ยืนยัน/ปฏิเสธคู่โอนที่ระบบ suggest ไว้ —
// นี่คือจุดแรกที่ผู้ใช้เห็นและกดยืนยัน suggested transfer match จริง (ย้ายมาจาก 4A ตาม 4b-dashboard.md)
export default function ReviewDrawer({ txnId, categories, taxEntities, onClose, onExited, onSaved, onNotice, onPrev, onNext, position }: ReviewDrawerProps) {
  const [detail, setDetail] = useState<TxnDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [classification, setClassification] = useState<Classification>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [taxEntityOverride, setTaxEntityOverride] = useState('');
  const [taxTreatment, setTaxTreatment] = useState('');
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [savingClassification, setSavingClassification] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [splitSubmitted, setSplitSubmitted] = useState(false);
  const [savingSplits, setSavingSplits] = useState(false);
  const [actingMatchId, setActingMatchId] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  // กันคำขอที่มาไม่เรียงลำดับ (คลิกแถว A แล้ว B เร็ว ๆ ถ้า A ตอบช้ากว่าจะเขียนทับรายละเอียดของ B ที่กำลังเปิดอยู่)
  const load = async (id: number) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const d = await req<TxnDetail>(`/api/transactions/${id}`);
      if (requestId !== requestIdRef.current) return;
      setDetail(d);
      setClassification(initialClassification(d));
      setCategoryId(singleCategoryOf(d.splits));
      setNote(d.annotation_note ?? '');
      setTaxEntityOverride(d.tax_entity_id == null ? '' : String(d.tax_entity_id));
      setTaxTreatment(d.tax_treatment ?? '');
      setSplits(splitsToRows(d.splits));
      setSplitSubmitted(false);
      setIncomeModalOpen(false);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'โหลดรายละเอียดไม่สำเร็จ');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (txnId != null) void load(txnId);
  }, [txnId]);

  const putSplits = async (txn: TxnDetail, payload: { category_id: number; amount_satang: number; note: string | null }[]) => {
    const saved = await put<{ id: number; category_id: number; amount_satang: number; note: string | null }[]>(
      `/api/transactions/${txn.id}/splits`,
      payload,
    );
    // PUT คืนแถว txn_split ดิบ ไม่มีชื่อหมวด — หมวดที่เลิกใช้แล้วไม่อยู่ใน categories จึงใช้ชื่อเดิมจาก detail
    const withNames = saved.map((s) => ({
      ...s,
      category_name: categories.find((c) => c.id === s.category_id)?.name ?? txn.splits.find((x) => x.category_id === s.category_id)?.category_name ?? '',
    }));
    setDetail((d) => (d ? { ...d, splits: withNames } : d));
    setSplits(splitsToRows(withNames));
    setCategoryId(singleCategoryOf(withNames));
    setSplitSubmitted(false);
  };

  // บันทึก = ตั้งประเภทรายการ + หมวด (ทั้งยอดเข้าหมวดเดียว) + ทำเครื่องหมายตรวจแล้ว (PATCH annotation ตั้ง reviewed เสมอ)
  // หมวดเดียวบันทึกผ่าน PUT splits เป็น split เดียวเต็มยอด — ส่งเฉพาะเมื่อเปลี่ยน และไม่แตะเมื่อแยกไว้หลายหมวด
  const saveClassification = async () => {
    if (!detail) return;
    setSavingClassification(true);
    let splitsSaved = false;
    try {
      if (detail.splits.length <= 1 && categoryId !== singleCategoryOf(detail.splits)) {
        await putSplits(
          detail,
          categoryId === '' ? [] : [{ category_id: Number(categoryId), amount_satang: detail.amount_satang, note: detail.splits[0]?.note ?? null }],
        );
        splitsSaved = true;
      }
      // หน้าภาษีปิดอยู่ = ไม่ส่งสองช่องนี้ ซึ่ง API ถือว่าไม่แตะค่าเดิม (ข้อมูลที่ตั้งไว้แล้วอยู่ครบ)
      const taxFields = TAX_PAGES_ENABLED
        ? { tax_entity_id: taxEntityOverride === '' ? null : Number(taxEntityOverride), tax_treatment: taxTreatment === '' ? null : taxTreatment }
        : {};
      const updated = await patch<{ classification: Classification; note: string | null; review_status: string; tax_entity_id: number | null; tax_treatment: TaxTreatment | null }>(
        `/api/transactions/${detail.id}/annotation`,
        { classification, note: note || null, ...taxFields },
      );
      setDetail((d) => (d ? {
        ...d, classification: updated.classification, review_status: 'reviewed',
        annotation_note: updated.note, tax_entity_id: updated.tax_entity_id, tax_treatment: updated.tax_treatment,
      } : d));
      onNotice({ message: 'บันทึกแล้ว และทำเครื่องหมายตรวจแล้ว', severity: 'success' });
      onSaved();
    } catch (e) {
      onNotice({ message: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', severity: 'error' });
      // หมวดบันทึกไปแล้วแม้ขั้นถัดไปพัง — ตารางต้องเห็นหมวดใหม่
      if (splitsSaved) onSaved();
    } finally {
      setSavingClassification(false);
    }
  };

  const splitTotalSatang = splits.reduce((sum, s) => sum + (parseBahtToSatang(s.amountText) ?? 0), 0);
  const remainingSatang = detail ? detail.amount_satang - splitTotalSatang : 0;
  const splitsRowsValid = splits.every((s) => s.category_id !== '' && amountError(s, true) === '');

  // ปุ่มบันทึกกดได้เสมอ — ตรวจตอนกด แล้วบอกที่ช่องที่ผิดและใน snackbar ว่าต้องแก้อะไร
  const saveSplits = async () => {
    if (!detail) return;
    setSplitSubmitted(true);
    if (!splitsRowsValid) {
      onNotice({ message: 'กรอกหมวดและจำนวนเงินให้ครบทุกแถว', severity: 'error' });
      return;
    }
    if (splits.length > 0 && remainingSatang !== 0) {
      onNotice({
        message: `ยอดแยกรวมต้องเท่ากับ ฿${formatBaht(detail.amount_satang)} (${remainingSatang > 0 ? 'ยังขาด' : 'เกิน'} ฿${formatBaht(Math.abs(remainingSatang))})`,
        severity: 'error',
      });
      return;
    }
    setSavingSplits(true);
    try {
      await putSplits(
        detail,
        splits.map((s) => ({ category_id: Number(s.category_id), amount_satang: parseBahtToSatang(s.amountText)!, note: s.note || null })),
      );
      onNotice({ message: splits.length === 0 ? 'ล้างการแยกยอดแล้ว' : 'บันทึกการแยกยอดแล้ว', severity: 'success' });
      onSaved();
    } catch (e) {
      onNotice({ message: e instanceof Error ? e.message : 'บันทึกการแยกยอดไม่สำเร็จ', severity: 'error' });
    } finally {
      setSavingSplits(false);
    }
  };

  const actOnMatch = async (matchId: number, action: 'confirm' | 'reject') => {
    if (!detail) return;
    setActingMatchId(matchId);
    try {
      await post(`/api/transfer-matches/${matchId}/${action}`, {});
      onNotice({ message: action === 'confirm' ? 'ยืนยันคู่โอนภายในแล้ว' : 'ปฏิเสธคู่โอนที่ระบบเสนอแล้ว', severity: 'success' });
      await load(detail.id);
      onSaved();
    } catch (e) {
      onNotice({ message: e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ', severity: 'error' });
    } finally {
      setActingMatchId(null);
    }
  };

  // Select อ่าน children ตรง ๆ (ห้ามห่อ Fragment) จึงเป็น array — กลุ่มที่ตรงกับประเภทรายการขึ้นก่อน
  // หมวดที่เลิกใช้แล้วแต่ยังผูกกับรายการนี้อยู่ใส่ไว้ด้วย ไม่งั้นช่องว่างเปล่าเหมือนยังไม่ได้จัดหมวด
  const categoryOptions = (() => {
    const group = (kind: Category['kind'], label: string) => [
      <ListSubheader key={`h-${kind}`}>{label}</ListSubheader>,
      ...categories.filter((c) => c.kind === kind).map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>),
    ];
    const groups = classification === 'income' ? [group('income', 'รายรับ'), group('expense', 'รายจ่าย')] : [group('expense', 'รายจ่าย'), group('income', 'รายรับ')];
    const retired = (detail?.splits ?? []).filter((s) => !categories.some((c) => c.id === s.category_id));
    return [...groups.flat(), ...retired.map((s) => <MenuItem key={`r-${s.category_id}`} value={String(s.category_id)}>{s.category_name} (เลิกใช้แล้ว)</MenuItem>)];
  })();

  const isTaxClassification = classification === 'income' || classification === 'expense';

  return (
    <Drawer
      anchor="right"
      open={txnId != null}
      onClose={onClose}
      disableRestoreFocus
      slotProps={{ paper: { 'aria-labelledby': 'review-drawer-heading' }, transition: { onExited } }}
    >
      <Box sx={{ width: { xs: '100vw', sm: 440 }, p: 3, height: '100%', overflowY: 'auto' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: position ? 1 : 2 }}>
          <Typography variant="h2" id="review-drawer-heading" sx={{ fontSize: '1.25rem', pt: 0.75 }}>รายละเอียดธุรกรรม</Typography>
          <IconButton aria-label="ปิด" onClick={onClose}><CloseRounded /></IconButton>
        </Stack>
        {/* เลื่อนรายการโดยไม่ต้องปิด — focus อยู่ที่ปุ่มเดิม กด Enter ซ้ำได้ ตำแหน่งประกาศผ่าน live region */}
        {position && (
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
            <Button color="inherit" startIcon={<ChevronLeftRounded />} onClick={onPrev} disabled={!onPrev}>ก่อนหน้า</Button>
            <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ ...dataTextSx, textAlign: 'center' }}>{position}</Typography>
            <Button color="inherit" endIcon={<ChevronRightRounded />} onClick={onNext} disabled={!onNext}>ถัดไป</Button>
          </Stack>
        )}

        {error && <LoadError message={error} onRetry={txnId != null ? () => void load(txnId) : undefined} />}

        {loading ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={80} />
            <Skeleton variant="rounded" height={140} />
            <Skeleton variant="rounded" height={140} />
          </Stack>
        ) : detail && !error ? (
          <Stack spacing={3}>
            <Box>
              <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{detail.description}</Typography>
              <Typography variant="body2" color="text.secondary" sx={dataTextSx}>
                {formatDate(detail.txn_date)} · {detail.account_nickname} ({detail.bank_name})
              </Typography>
              <Money
                satang={detail.direction === 'debit' ? -detail.amount_satang : detail.amount_satang}
                tone={detail.is_internal_transfer ? 'neutral' : detail.direction === 'credit' ? 'income' : 'expense'}
                showSign
                sx={{ fontSize: '1.75rem', display: 'block', mt: 1 }}
              />
            </Box>

            <Divider />

            <Box component="section" aria-labelledby="classification-heading">
              <Typography component="h3" variant="h2" id="classification-heading" sx={{ ...SECTION_HEADING_SX, mb: 1.5 }}>จัดประเภทรายการ</Typography>
              <Stack spacing={1.5}>
                <TextField select label="ประเภทรายการ" value={classification} onChange={(e) => setClassification(e.target.value as Classification)} size="small">
                  {(Object.entries(CLASSIFICATION_LABEL) as [Classification, string][]).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </TextField>
                {/* แยกไว้หลายหมวดแล้วไม่แสดงช่องหมวดเดียว — เลือกหมวดเดียวจะทับการแยกยอดทิ้งเงียบ ๆ */}
                {detail.splits.length > 1 ? (
                  <Typography variant="body2" color="text.secondary">
                    แยกไว้ {detail.splits.length} หมวด ({detail.splits.map((s) => s.category_name).join(', ')}) แก้ได้ที่ "แยกยอดตามหมวด" ด้านล่าง
                  </Typography>
                ) : (
                  <TextField
                    select
                    label="หมวด"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    size="small"
                    helperText='ทั้งยอดเข้าหมวดเดียว ถ้ามีหลายหมวดใช้ "แยกยอดตามหมวด" ด้านล่าง'
                  >
                    <MenuItem value=""><em>ไม่ระบุหมวด</em></MenuItem>
                    {categoryOptions}
                  </TextField>
                )}
                <TextField label="โน้ต (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} size="small" multiline minRows={2} slotProps={{ htmlInput: { maxLength: 500 } }} />
                {classification === 'income' && detail.direction === 'credit' && (
                  <Alert
                    severity="info"
                    action={<Button size="small" onClick={() => setIncomeModalOpen(true)}>บันทึกเป็นรายได้เต็ม</Button>}
                  >
                    ถ้านี่คือเงินเดือนหรือรายได้ประจำ กดปุ่มนี้เพื่อบันทึกเป็น "รายได้เต็ม" ได้เลย
                    {TAX_PAGES_ENABLED && ' จะนับเป็น "เงินได้จากงานประจำ" ตอนประมาณการภาษี ส่วนการนับภาษีด้านล่างมีไว้สำหรับรายได้ธุรกิจอื่นเท่านั้น'}
                    {' '}รายได้ไม่ผูกกับธุรกรรมแล้ว กดซ้ำจะได้รายการซ้ำ
                  </Alert>
                )}
                {TAX_PAGES_ENABLED && (
                  <>
                    <TextField
                      select
                      label="ผู้เสียภาษี (Tax Entity)"
                      helperText={
                        detail.account_default_tax_entity_id != null
                          ? 'ไม่เลือก = ใช้ค่าเริ่มต้นจากบัญชีนี้'
                          : taxEntities.length === 1
                            ? `ไม่เลือกก็ได้ มีผู้เสียภาษีรายเดียว ระบบผูกให้เป็น "${taxEntities[0]!.display_name}" เอง`
                            : 'บัญชีนี้ยังไม่ได้ตั้งค่าเริ่มต้น เลือกเองต่อรายการ หรือไปตั้งค่าเริ่มต้นที่หน้าบัญชีของฉัน'
                      }
                      value={taxEntityOverride}
                      onChange={(e) => setTaxEntityOverride(e.target.value)}
                      size="small"
                    >
                      <MenuItem value=""><em>ใช้ค่าเริ่มต้นจากบัญชี</em></MenuItem>
                      {taxEntities.map((te) => <MenuItem key={te.id} value={te.id}>{te.display_name}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      label="การนับภาษี (Tax Treatment)"
                      helperText={
                        detail.direction === 'credit'
                          ? 'เงินเดือน/รายได้ประจำ ไม่ต้องตั้งตรงนี้ ใช้ปุ่ม "บันทึกเป็นรายได้เต็ม" ด้านบน เลือก "รายได้ธุรกิจ" เฉพาะรายได้ธุรกิจ/ฟรีแลนซ์'
                          : 'เลือก "ค่าใช้จ่ายหักภาษีได้" เฉพาะรายจ่ายที่หักภาษีได้จริง ระบบไม่เดาให้เพราะเงินออกจากบัญชีไม่ได้แปลว่าหักภาษีได้'
                      }
                      value={taxTreatment}
                      onChange={(e) => setTaxTreatment(e.target.value)}
                      size="small"
                    >
                      <MenuItem value=""><em>ยังไม่ระบุ</em></MenuItem>
                      {(Object.entries(TAX_TREATMENT_LABEL) as [TaxTreatment, string][]).map(([value, label]) => (
                        <MenuItem key={value} value={value}>{label}</MenuItem>
                      ))}
                    </TextField>
                    {isTaxClassification && taxTreatment === '' && (taxEntityOverride !== '' || detail.account_default_tax_entity_id != null) && (
                      <Alert severity="warning">
                        ตั้งผู้เสียภาษีไว้แล้ว แต่ยังไม่ได้เลือกการนับภาษี รายการนี้จะ<strong>ยังไม่ถูกนับ</strong>ในการประมาณการภาษี
                        {' '}(ไปโผล่ที่ตัวนับ "ยังไม่ระบุ Tax Treatment" ในหน้าภาษีแทน) ถ้าต้องการให้นับเป็น
                        {detail.direction === 'credit' ? 'รายได้ธุรกิจ ให้เลือก "รายได้ธุรกิจ" ด้านบน' : 'ค่าใช้จ่ายหักภาษีได้ ให้เลือก "ค่าใช้จ่ายหักภาษีได้" ด้านบน'}
                      </Alert>
                    )}
                  </>
                )}
                <Button variant="contained" onClick={() => void saveClassification()} disabled={savingClassification} aria-busy={savingClassification} sx={{ alignSelf: 'flex-start' }}>
                  {savingClassification ? 'กำลังบันทึก…' : 'บันทึกและตรวจแล้ว'}
                </Button>
              </Stack>
            </Box>

            <Divider />

            <Box component="section" aria-labelledby="splits-heading">
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography component="h3" variant="h2" id="splits-heading" sx={SECTION_HEADING_SX}>แยกยอดตามหมวด</Typography>
                <Button
                  size="small"
                  startIcon={<AddRounded />}
                  // แถวแรกได้ยอดเต็มและหมวดที่เลือกไว้ แถวถัดไปได้ยอดที่ยังเหลือ
                  onClick={() => setSplits((rows) => [...rows, {
                    key: crypto.randomUUID(),
                    category_id: rows.length === 0 ? categoryId : '',
                    amountText: remainingSatang > 0 ? satangToInput(remainingSatang) : '',
                    note: '',
                  }])}
                >
                  เพิ่มรายการ
                </Button>
              </Stack>

              {splits.length === 0 ? (
                <Typography variant="body2" color="text.secondary">ใช้เมื่อรายการเดียวมีหลายหมวด เช่นซื้อของที่มีทั้งอาหารและของใช้ กด "เพิ่มรายการ" แล้วแบ่งยอดให้ครบ</Typography>
              ) : (
                <Stack spacing={1.5}>
                  {splits.map((row, index) => {
                    const n = index + 1;
                    const categoryMissing = splitSubmitted && row.category_id === '';
                    const amountMessage = amountError(row, splitSubmitted);
                    return (
                      <Stack key={row.key} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                        <TextField
                          select
                          size="small"
                          label={`หมวด รายการที่ ${n}`}
                          value={row.category_id}
                          onChange={(e) => setSplits((rows) => rows.map((r, i) => (i === index ? { ...r, category_id: e.target.value } : r)))}
                          error={categoryMissing}
                          helperText={categoryMissing ? 'เลือกหมวด' : undefined}
                          sx={{ flex: 1, minWidth: 0 }}
                        >
                          <MenuItem value=""><em>เลือกหมวด</em></MenuItem>
                          {categoryOptions}
                        </TextField>
                        <TextField
                          size="small"
                          label="บาท"
                          value={row.amountText}
                          onChange={(e) => setSplits((rows) => rows.map((r, i) => (i === index ? { ...r, amountText: e.target.value } : r)))}
                          error={amountMessage !== ''}
                          helperText={amountMessage || undefined}
                          slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': `จำนวนเงิน รายการที่ ${n} (บาท)`, sx: dataTextSx } }}
                          sx={{ width: 110, flexShrink: 0 }}
                        />
                        <IconButton aria-label={`ลบรายการที่ ${n}`} onClick={() => setSplits((rows) => rows.filter((_, i) => i !== index))}>
                          <DeleteOutlineRounded />
                        </IconButton>
                      </Stack>
                    );
                  })}
                  <Typography
                    variant="body2"
                    aria-live="polite"
                    color={remainingSatang !== 0 && splitSubmitted ? 'error' : 'text.secondary'}
                    sx={dataTextSx}
                  >
                    {remainingSatang === 0
                      ? 'ยอดรวมครบพอดี'
                      : `${remainingSatang > 0 ? 'ยังไม่ได้แยก' : 'เกินยอดจริง'} ฿${formatBaht(Math.abs(remainingSatang))}`}
                  </Typography>
                </Stack>
              )}

              <Button
                variant="outlined"
                onClick={() => void saveSplits()}
                disabled={savingSplits}
                aria-busy={savingSplits}
                sx={{ mt: 1.5 }}
              >
                {savingSplits ? 'กำลังบันทึก…' : splits.length === 0 ? 'บันทึก (ล้างการแยกยอด)' : 'บันทึกการแยกยอด'}
              </Button>
            </Box>

            {detail.transfer_matches.length > 0 && (
              <>
                <Divider />
                <Box component="section" aria-labelledby="transfer-heading">
                  <Typography component="h3" variant="h2" id="transfer-heading" sx={{ ...SECTION_HEADING_SX, mb: 1.5 }}>คู่โอนภายในที่ระบบพบ</Typography>
                  <Stack spacing={1.5}>
                    {detail.transfer_matches.map((m) => (
                      <Box key={m.id} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: `${radii.xl}px` }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                          <SwapHorizRounded fontSize="small" sx={{ color: 'text.secondary' }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.counterpart_account_nickname}</Typography>
                          {m.status === 'confirmed' && <Chip size="small" icon={<CheckRounded />} label="ยืนยันแล้ว" color="success" variant="outlined" />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={dataTextSx}>
                          {formatDate(m.counterpart_txn_date)} · <Money satang={m.counterpart_amount_satang} />
                        </Typography>
                        {m.status === 'suggested' && (
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={actingMatchId === m.id}
                              aria-busy={actingMatchId === m.id}
                              onClick={() => void actOnMatch(m.id, 'confirm')}
                            >
                              ยืนยันว่าเป็นคู่โอน
                            </Button>
                            <Button
                              size="small"
                              color="inherit"
                              disabled={actingMatchId === m.id}
                              onClick={() => void actOnMatch(m.id, 'reject')}
                            >
                              ไม่ใช่
                            </Button>
                          </Stack>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </>
            )}

            {detail.statement_id && (detail.period_start || detail.period_end) && (
              <Alert severity="info" variant="outlined">
                มาจาก statement {[detail.period_start, detail.period_end].filter((d): d is string => d != null).map(formatDate).join(' – ')}
              </Alert>
            )}
          </Stack>
        ) : null}
      </Box>
      {/* render เฉพาะตอนเปิด + key ตาม txn — ไม่งั้น state ในฟอร์ม (ยอด/ชื่อ/วันที่) ค้างค่าของธุรกรรม
          ก่อนหน้าเมื่อสลับแถว เพราะ useState ตั้งค่าเริ่มต้นแค่ตอน mount ครั้งแรกเท่านั้น */}
      {detail && incomeModalOpen && (
        <IncomeQuickAddModal
          key={detail.id}
          txn={detail}
          month={detail.txn_date.slice(0, 7)}
          open
          onClose={() => setIncomeModalOpen(false)}
          onSaved={() => {
            onNotice({ message: 'บันทึกรายได้เต็มแล้ว', severity: 'success' });
            void load(detail.id);
            onSaved();
          }}
        />
      )}
    </Drawer>
  );
}
