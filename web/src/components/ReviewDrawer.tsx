import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
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
import { AMOUNT_FORMAT_HINT, formatBaht, formatDate, parseBahtToSatang } from '../format.js';
import { dataTextSx, radii } from '../theme.js';
import { ConfirmDialog, LoadError, visuallyHiddenSx, type Notice } from '../ui.js';
import IncomeQuickAddModal from './IncomeQuickAddModal.js';
import Money from './Money.js';
import { needsCategory, ReviewStatusLabel, UNCATEGORISED_LABEL } from './TransactionTable.js';

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  income: 'รายรับ',
  expense: 'รายจ่าย',
  internal_transfer: 'โอนภายใน',
  excluded: 'ไม่นับรวม',
};

// h3 ใต้ชื่อ drawer (h2) ขั้น Headline Small ของ DESIGN.md
const SECTION_HEADING_SX = { fontSize: '1rem', lineHeight: 1.5 } as const;

// คีย์ลัด "บันทึกแล้วไปถัดไป" — Ctrl+Enter และ ⌘+Enter ใช้ได้ทั้งคู่ คำใบ้บนจอแสดงตามเครื่อง
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const SAVE_NEXT_SHORTCUT = IS_MAC ? '⌘ + Enter' : 'Ctrl + Enter';

// category_id เป็น string เสมอ (ค่าว่าง = ยังไม่เลือก) — เลี่ยงปัญหา MUI Select ที่ value เป็น union
// number | '' แล้ว TS สืบ generic type ของ onChange event ไม่ได้ตรงกับที่ประกาศ แปลงเป็น number ตอน submit
type SplitRow = { key: string; category_id: string; amountText: string; note: string };

// ค่าในฟอร์มตอนโหลด/บันทึกล่าสุด — เทียบกับค่านี้แทน detail เพราะ classification ที่บันทึกกับ is_internal_transfer ต่างกันได้
type FormSnapshot = { classification: Classification; note: string; taxEntity: string; taxTreatment: string };
type SaveResult = Notice & { ok: boolean };
type PendingNav = { go: () => void; kind: 'close' | 'move' };
const NOT_READY: SaveResult = { ok: false, message: 'ยังโหลดรายการไม่เสร็จ', severity: 'error' };

// สตางค์ → ข้อความในช่องกรอก ด้วยเลขจำนวนเต็ม (ไม่หาร 100 แบบทศนิยม)
const satangToInput = (satang: number) => `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, '0')}`;

function splitsToRows(splits: TxnSplit[]): SplitRow[] {
  return splits.map((s) => ({ key: String(s.id), category_id: String(s.category_id), amountText: satangToInput(s.amount_satang), note: s.note ?? '' }));
}

// เทียบร่างกับที่บันทึกไว้โดยไม่สน key และยอดที่พิมพ์ต่างรูปแต่ค่าเท่ากัน ("100" = "100.00")
const splitsKey = (rows: SplitRow[]) => JSON.stringify(rows.map((s) => [s.category_id, parseBahtToSatang(s.amountText) ?? s.amountText, s.note]));

const singleCategoryOf = (splits: TxnSplit[]) => (splits.length === 1 ? String(splits[0]!.category_id) : '');

function amountError(row: SplitRow, submitted: boolean): string {
  if (row.amountText.trim() === '') return submitted ? 'กรอกยอด' : '';
  const satang = parseBahtToSatang(row.amountText);
  if (satang == null) return AMOUNT_FORMAT_HINT;
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
  /** undefined = ไม่มีแถวก่อนหน้า/ถัดไปแล้ว (หน้าข้ามหน้าให้เองเมื่อยังมีหน้าอื่น) */
  onPrev?: () => void;
  onNext?: () => void;
  /** "รายการที่ 53 จาก 120" (นับข้ามหน้า) — ไม่ส่งมา = เปิดจากลิงก์ ไม่อยู่ในรายการ ไม่มีแถบเลื่อนรายการ */
  position?: string;
  /** มีการแก้ไขที่ยังไม่บันทึกหรือไม่ — ปุ่ม Back ของเบราว์เซอร์ไม่ผ่านตัวกั้นของ drawer หน้าจึงต้องรู้ */
  onDirtyChange?: (dirty: boolean) => void;
  /** เพิ่มค่าเมื่อหน้าขอปิด (กด Back) — มีการแก้ไขค้างจะถามก่อนเหมือนกดปิดเอง */
  closeRequest?: number;
};

// Drawer เดียวทำสามงาน: จัดประเภท+หมวด, แยกยอดหลายหมวด, ยืนยัน/ปฏิเสธคู่โอนที่ระบบ suggest ไว้ —
// นี่คือจุดแรกที่ผู้ใช้เห็นและกดยืนยัน suggested transfer match จริง (ย้ายมาจาก 4A ตาม 4b-dashboard.md)
export default function ReviewDrawer({
  txnId, categories, taxEntities, onClose, onExited, onSaved, onNotice, onPrev, onNext, position, onDirtyChange, closeRequest,
}: ReviewDrawerProps) {
  const [detail, setDetail] = useState<TxnDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<FormSnapshot | null>(null);
  const [classification, setClassification] = useState<Classification>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [taxEntityOverride, setTaxEntityOverride] = useState('');
  const [taxTreatment, setTaxTreatment] = useState('');
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [savingClassification, setSavingClassification] = useState(false);
  const [savingNext, setSavingNext] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [splitSubmitted, setSplitSubmitted] = useState(false);
  const [savingSplits, setSavingSplits] = useState(false);
  const [actingMatchId, setActingMatchId] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState<{ id: number; message: string } | null>(null);
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);
  const [navError, setNavError] = useState('');
  const [savingNav, setSavingNav] = useState(false);
  const requestIdRef = useRef(0);
  // คำตอบของการบันทึกที่มาถึงหลังเลื่อนไปแถวอื่นแล้ว (ก่อนหน้า/ถัดไป/ปิด ระหว่างรอ) ต้องไม่เขียนทับฟอร์มของแถวใหม่
  const txnIdRef = useRef(txnId);
  txnIdRef.current = txnId;
  // ผลที่ต้องประกาศหลัง dialog/drawer ปิดสนิท — ระหว่างนั้นทุกอย่างข้างหลังเป็น aria-hidden
  const afterDialogNoticeRef = useRef<Notice | null>(null);
  const exitNoticeRef = useRef<Notice | null>(null);
  // id ของแถวที่กด "บันทึกแล้วไปถัดไป" — focus ย้ายเมื่อแถวอื่นโหลดเสร็จ (ข้ามหน้าต้องรอหน้าโหลดรายการก่อน)
  const focusAfterMoveFromRef = useRef<number | null>(null);
  const categoryFieldRef = useRef<HTMLDivElement>(null);
  const focusSplitAtRef = useRef<number | null>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const saveNextRef = useRef<HTMLButtonElement>(null);
  const addSplitRef = useRef<HTMLButtonElement>(null);
  const splitsBoxRef = useRef<HTMLElement>(null);

  // snackbar ของหน้าอยู่ใน #root ซึ่งเป็น aria-hidden ระหว่างที่ drawer เปิด — live region ใน drawer ให้ screen reader
  // ได้ยิน ส่วน snackbar ให้คนที่มองเห็น ประกาศจึงมีครั้งเดียว · id ใหม่ = node ใหม่ ข้อความเดิมซ้ำก็ยังประกาศ
  const notify = (n: Notice) => {
    setAnnouncement((a) => ({ id: (a?.id ?? 0) + 1, message: n.message }));
    onNotice({ message: n.message, severity: n.severity });
  };

  // กันคำขอที่มาไม่เรียงลำดับ (คลิกแถว A แล้ว B เร็ว ๆ ถ้า A ตอบช้ากว่าจะเขียนทับรายละเอียดของ B ที่กำลังเปิดอยู่)
  // background = โหลดรายการเดิมซ้ำ (หลังยืนยันคู่โอน/บันทึกรายได้) ไม่แทนเนื้อหาด้วย skeleton — ปุ่มที่ถือ focus ยังอยู่
  const load = async (id: number, background = false) => {
    const requestId = ++requestIdRef.current;
    if (!background) setLoading(true);
    setError('');
    try {
      const d = await req<TxnDetail>(`/api/transactions/${id}`);
      if (requestId !== requestIdRef.current) return;
      const snapshot: FormSnapshot = {
        classification: initialClassification(d),
        note: d.annotation_note ?? '',
        taxEntity: d.tax_entity_id == null ? '' : String(d.tax_entity_id),
        taxTreatment: d.tax_treatment ?? '',
      };
      // background ระหว่างมีการแก้ไขค้าง: ช่องที่แก้ไว้คงค่าของผู้ใช้ ช่องที่ไม่ได้แตะรับค่าใหม่จาก server — เทียบกับค่าที่
      // โหลดไว้ก่อนหน้า (saved/detail ตอนกด) ไม่งั้นยืนยันคู่โอน/บันทึกรายได้เต็มแล้วสิ่งที่แก้ค้างไว้หายเงียบ ๆ
      const prev = background && saved && detail?.id === d.id
        ? { saved, category: singleCategoryOf(detail.splits), splits: splitsKey(splitsToRows(detail.splits)) }
        : null;
      const keep = <T,>(baseline: T | undefined, next: T) => (current: T) => (prev && current !== baseline ? current : next);
      setDetail(d);
      setSaved(snapshot);
      setClassification(keep(prev?.saved.classification, snapshot.classification));
      setCategoryId(keep(prev?.category, singleCategoryOf(d.splits)));
      setNote(keep(prev?.saved.note, snapshot.note));
      setTaxEntityOverride(keep(prev?.saved.taxEntity, snapshot.taxEntity));
      setTaxTreatment(keep(prev?.saved.taxTreatment, snapshot.taxTreatment));
      setSplits((current) => (prev && splitsKey(current) !== prev.splits ? current : splitsToRows(d.splits)));
      if (!prev) {
        setSplitSubmitted(false);
        setIncomeModalOpen(false);
      }
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'โหลดรายละเอียดไม่สำเร็จ');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (txnId != null) {
      void load(txnId);
    } else {
      setAnnouncement(null);
      focusAfterMoveFromRef.current = null;
    }
  }, [txnId]);

  // การแก้ไขที่ยังไม่บันทึก — ระหว่างโหลด/ยังเป็นรายละเอียดของแถวก่อน (detail.id ≠ txnId) ไม่นับ ไม่งั้นถามซ้ำหลังเพิ่งทิ้ง
  const annotationDirty = saved != null && (
    classification !== saved.classification
    || note !== saved.note
    || (TAX_PAGES_ENABLED && (taxEntityOverride !== saved.taxEntity || taxTreatment !== saved.taxTreatment))
  );
  const categoryDirty = detail != null && detail.splits.length <= 1 && categoryId !== singleCategoryOf(detail.splits);
  const splitsDirty = detail != null && splitsKey(splits) !== splitsKey(splitsToRows(detail.splits));
  const dirty = !loading && detail != null && detail.id === txnId && (annotationDirty || categoryDirty || splitsDirty);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty]);

  // "บันทึกแล้วไปถัดไป": เนื้อหาถูกแทนด้วย skeleton ระหว่างโหลดแถวถัดไป — focus ช่องหมวดของแถวใหม่ (งานถัดไปของคิว)
  // แถวที่แยกหลายหมวดไม่มีช่องนั้น = ปุ่มเดิม · ยังเป็นแถวเดิมและไม่มีแถวถัดไปแล้ว (หมดรายการ) = ปุ่มบันทึก
  const hasNext = onNext != null;
  useEffect(() => {
    const fromId = focusAfterMoveFromRef.current;
    if (fromId == null || loading || detail == null || detail.id !== txnId) return;
    if (detail.id === fromId && hasNext) return;
    focusAfterMoveFromRef.current = null;
    const categorySelect = detail.id === fromId ? null : categoryFieldRef.current?.querySelector<HTMLElement>('[role="combobox"]');
    (categorySelect ?? saveNextRef.current ?? saveRef.current)?.focus();
  }, [loading, detail, txnId, hasNext]);

  // ลบแถวแยกยอด: focus ไปปุ่มลบของแถวที่เลื่อนขึ้นมาแทน หรือ "แบ่งยอดเพิ่ม" เมื่อไม่เหลือแถวถัดไป
  useEffect(() => {
    const index = focusSplitAtRef.current;
    if (index == null) return;
    focusSplitAtRef.current = null;
    const buttons = splitsBoxRef.current?.querySelectorAll<HTMLElement>('[data-split-delete]');
    (buttons?.[index] ?? addSplitRef.current)?.focus();
  }, [splits]);

  const putSplits = async (txn: TxnDetail, payload: { category_id: number; amount_satang: number; note: string | null }[]) => {
    const savedSplits = await put<{ id: number; category_id: number; amount_satang: number; note: string | null }[]>(
      `/api/transactions/${txn.id}/splits`,
      payload,
    );
    if (txnIdRef.current !== txn.id) return;
    // PUT คืนแถว txn_split ดิบ ไม่มีชื่อหมวด — หมวดที่เลิกใช้แล้วไม่อยู่ใน categories จึงใช้ชื่อเดิมจาก detail
    const withNames = savedSplits.map((s) => ({
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
  // withCategory = false: เพิ่งบันทึกการแยกยอดไป ช่องหมวดเดียวในตอนนี้เป็นค่าเก่าของ closure ห้ามส่งทับ
  // priorSaved = saveEdits บันทึกการแยกยอดไปก่อนแล้ว — onSaved ครั้งเดียวตอนจบไม่ว่าขั้นนี้สำเร็จหรือไม่
  const saveClassification = async (withCategory = true, priorSaved = false): Promise<SaveResult> => {
    if (!detail) return NOT_READY;
    setSavingClassification(true);
    let splitsSaved = priorSaved;
    try {
      if (withCategory && detail.splits.length <= 1 && categoryId !== singleCategoryOf(detail.splits)) {
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
      if (txnIdRef.current === detail.id) {
        setDetail((d) => (d ? {
          ...d, classification: updated.classification, review_status: 'reviewed',
          annotation_note: updated.note, tax_entity_id: updated.tax_entity_id, tax_treatment: updated.tax_treatment,
        } : d));
        setSaved({ classification, note, taxEntity: taxEntityOverride, taxTreatment });
      }
      onSaved();
      return { ok: true, message: 'บันทึกแล้ว และทำเครื่องหมายตรวจแล้ว', severity: 'success' };
    } catch (e) {
      // หมวดบันทึกไปแล้วแม้ขั้นถัดไปพัง — ตารางต้องเห็นหมวดใหม่
      if (splitsSaved) onSaved();
      return { ok: false, message: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', severity: 'error' };
    } finally {
      setSavingClassification(false);
    }
  };

  const splitTotalSatang = splits.reduce((sum, s) => sum + (parseBahtToSatang(s.amountText) ?? 0), 0);
  const remainingSatang = detail ? detail.amount_satang - splitTotalSatang : 0;
  const splitsRowsValid = splits.every((s) => s.category_id !== '' && amountError(s, true) === '');

  // ปุ่มบันทึกกดได้เสมอ — ตรวจตอนกด แล้วบอกที่ช่องที่ผิดและในข้อความผลว่าต้องแก้อะไร
  // reload = false: saveEdits เรียก onSaved เองครั้งเดียวหลังบันทึกครบทุกส่วน
  const saveSplits = async (reload = true): Promise<SaveResult> => {
    if (!detail) return NOT_READY;
    setSplitSubmitted(true);
    if (!splitsRowsValid) return { ok: false, message: 'กรอกหมวดและจำนวนเงินให้ครบทุกแถว', severity: 'error' };
    if (splits.length > 0 && remainingSatang !== 0) {
      return {
        ok: false,
        message: `ยอดแยกรวมต้องเท่ากับ ฿${formatBaht(detail.amount_satang)} (${remainingSatang > 0 ? 'ยังขาด' : 'เกิน'} ฿${formatBaht(Math.abs(remainingSatang))})`,
        severity: 'error',
      };
    }
    setSavingSplits(true);
    try {
      await putSplits(
        detail,
        splits.map((s) => ({ category_id: Number(s.category_id), amount_satang: parseBahtToSatang(s.amountText)!, note: s.note || null })),
      );
      if (reload) onSaved();
      const cleared = needsCategory(detail.classification) ? `ล้างหมวดแล้ว รายการนี้กลับเป็น${UNCATEGORISED_LABEL}` : 'ล้างหมวดแล้ว';
      return { ok: true, message: splits.length === 0 ? cleared : 'บันทึกการแยกยอดแล้ว', severity: 'success' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'บันทึกการแยกยอดไม่สำเร็จ', severity: 'error' };
    } finally {
      setSavingSplits(false);
    }
  };

  // ร่างแยกยอดบันทึกก่อน แล้วจึงประเภท/โน้ต — ไม่ส่งหมวดเดียวซ้ำ (จะทับการแยกยอดที่เพิ่งบันทึก) ส่วนที่
  // saveClassification อ่านจาก closure หลัง await (id, ประเภท, โน้ต, ภาษี) saveSplits ไม่ได้แตะ
  // หน้าโหลดรายการซ้ำ (onSaved) ครั้งเดียวต่อการบันทึก ไม่ใช่ครั้งละส่วน
  const saveEdits = async (annotation: boolean): Promise<SaveResult> => {
    if (!splitsDirty) return annotation ? saveClassification() : { ok: true, message: '', severity: 'success' };
    const result = await saveSplits(false);
    if (!result.ok) return result;
    if (annotation) return saveClassification(false, true);
    onSaved();
    return result;
  };
  // ปุ่ม "บันทึก" ใน dialog บันทึกเฉพาะส่วนที่แก้ — แก้แค่การแยกยอดไม่ทำเครื่องหมายตรวจแล้วให้
  const annotationWillSave = annotationDirty || (categoryDirty && !splitsDirty);

  const busySaving = savingClassification || savingSplits;
  const saveAndNext = async () => {
    // จับไว้ก่อน await — reload ของหน้ายังไม่กลับมา แถวถัดไปจึงยังเป็นแถวเดิม แม้แถวนี้จะหลุดจากคิวหลังบันทึก
    const go = onNext;
    if (!go || busySaving || !detail) return;
    const fromId = detail.id;
    setSavingNext(true);
    const result = await saveEdits(true);
    setSavingNext(false);
    notify(result);
    // ระหว่างรอผู้ใช้เลื่อน/ปิดไปเองแล้ว — ไม่พาไปต่ออีกทอด
    if (!result.ok || txnIdRef.current !== fromId) return;
    focusAfterMoveFromRef.current = fromId;
    go();
  };
  // Ctrl/⌘+Enter ที่ไหนก็ได้ในแผง = บันทึกแล้วไปถัดไป — capture ก่อนช่องหมวด (Select เปิดเมนูเมื่อเจอ Enter ทุกแบบ)
  // ยกเว้นในเมนูที่เปิดอยู่ ซึ่ง Enter คือเลือกรายการ · dialog/modal อยู่นอกกล่องนี้ จึงไม่ถูกดักไปด้วย
  const onShortcut = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || !onNext || loading || detail == null) return;
    if ((event.target as HTMLElement).closest('[role="listbox"], [role="menu"]')) return;
    event.preventDefault();
    event.stopPropagation();
    void saveAndNext();
  };

  // ทุกทางออก (ก่อนหน้า/ถัดไป, Esc, คลิกฉากหลัง, ปุ่มปิด, Back) ผ่านที่นี่ — มีการแก้ไขค้างถามก่อน
  const guard = (go: (() => void) | undefined, kind: PendingNav['kind']) => {
    if (!go) return;
    if (dirty) {
      setNavError('');
      setPendingNav({ go, kind });
    } else {
      go();
    }
  };
  useEffect(() => {
    if (closeRequest) guard(onClose, 'close');
  }, [closeRequest]);

  // บันทึกไม่สำเร็จ = dialog ค้างไว้พร้อมข้อความ (role alert ใน dialog ซึ่งเป็น modal บนสุด) ให้เลือกแก้/ทิ้ง/ลองใหม่
  const confirmSave = async () => {
    const nav = pendingNav;
    if (!nav) return;
    setSavingNav(true);
    const result = await saveEdits(annotationWillSave);
    setSavingNav(false);
    if (!result.ok) {
      setNavError(result.message);
      return;
    }
    const notice: Notice = { message: result.message, severity: result.severity };
    if (nav.kind === 'close') exitNoticeRef.current = notice;
    else afterDialogNoticeRef.current = notice;
    setPendingNav(null);
    nav.go();
  };
  const discardEdits = () => {
    const nav = pendingNav;
    setPendingNav(null);
    nav?.go();
  };

  const actOnMatch = async (matchId: number, action: 'confirm' | 'reject') => {
    if (!detail) return;
    setActingMatchId(matchId);
    try {
      await post(`/api/transfer-matches/${matchId}/${action}`, {});
      notify({ message: action === 'confirm' ? 'ยืนยันคู่โอนภายในแล้ว' : 'ปฏิเสธคู่โอนที่ระบบเสนอแล้ว', severity: 'success' });
      if (txnIdRef.current === detail.id) await load(detail.id, true);
      onSaved();
      // ปุ่มคู่นี้หายไปเมื่อสำเร็จ (ยืนยันแล้วเป็น chip, ปฏิเสธแล้วหายทั้งกล่อง) — focus ไปปุ่มบันทึกซึ่งเป็นขั้นถัดไป
      saveRef.current?.focus();
    } catch (e) {
      notify({ message: e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ', severity: 'error' });
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
      onClose={() => guard(onClose, 'close')}
      disableRestoreFocus
      slotProps={{
        paper: { 'aria-labelledby': 'review-drawer-heading' },
        transition: {
          onExited: () => {
            onExited?.();
            const notice = exitNoticeRef.current;
            exitNoticeRef.current = null;
            if (notice) onNotice(notice);
          },
        },
      }}
    >
      <Box sx={{ width: { xs: '100vw', sm: 440 }, p: 3, height: '100%', overflowY: 'auto' }} onKeyDownCapture={onShortcut}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: position ? 1 : 2 }}>
          <Typography variant="h2" id="review-drawer-heading" sx={{ fontSize: '1.25rem', pt: 0.75 }}>รายละเอียดธุรกรรม</Typography>
          <IconButton aria-label="ปิด" onClick={() => guard(onClose, 'close')}><CloseRounded /></IconButton>
        </Stack>
        {/* เลื่อนรายการโดยไม่ต้องปิด — focus อยู่ที่ปุ่มเดิม กด Enter ซ้ำได้ ตำแหน่งประกาศผ่าน live region */}
        {position && (
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
            <Button color="inherit" startIcon={<ChevronLeftRounded />} onClick={() => guard(onPrev, 'move')} aria-disabled={!onPrev} disableRipple={!onPrev}>
              ก่อนหน้า
            </Button>
            <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ ...dataTextSx, textAlign: 'center' }}>{position}</Typography>
            <Button color="inherit" endIcon={<ChevronRightRounded />} onClick={() => guard(onNext, 'move')} aria-disabled={!onNext} disableRipple={!onNext}>
              ถัดไป
            </Button>
          </Stack>
        )}
        {/* อยู่นอกส่วนที่ถูกแทนด้วย skeleton — live region ต้องอยู่ใน DOM ก่อนข้อความเปลี่ยนจึงประกาศแน่นอน */}
        <Box role="status" sx={visuallyHiddenSx}>
          {announcement && <span key={announcement.id}>{announcement.message}</span>}
        </Box>

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
                {formatDate(detail.txn_date)}{detail.txn_time ? ` ${detail.txn_time.slice(0, 5)}` : ''} · {detail.account_nickname}
                {/* ชื่อบัญชีมีชื่อธนาคารอยู่แล้ว (เช่น "KBank") ไม่ต่อ "(KBank)" ซ้ำ */}
                {detail.account_nickname.toLowerCase().includes(detail.bank_name.toLowerCase()) ? '' : ` (${detail.bank_name})`}
                {detail.channel ? ` · ${detail.channel}` : ''}
              </Typography>
              <Box sx={{ mt: 0.5 }}><ReviewStatusLabel status={detail.review_status} /></Box>
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
                  // หมวดว่างไม่บล็อกการบันทึก (ตรวจแล้วแต่ยังไม่จัดหมวดได้) แต่บอกก่อนกดว่ารายการจะยังค้างในคิวนั้น
                  <TextField
                    ref={categoryFieldRef}
                    select
                    label="หมวด"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    size="small"
                    helperText={categoryId !== ''
                      ? 'ทั้งยอดเข้าหมวดเดียว ถ้ามีหลายหมวดใช้ "แยกยอดตามหมวด" ด้านล่าง'
                      : needsCategory(classification)
                        ? `ยังไม่ได้เลือกหมวด — รายการนี้จะยังอยู่ในคิว ${UNCATEGORISED_LABEL}`
                        : `ไม่ต้องเลือกหมวด — ${classification === 'internal_transfer' ? 'โอนภายใน' : 'รายการที่ไม่นับรวม'}ไม่อยู่ในคิว ${UNCATEGORISED_LABEL}`}
                  >
                    <MenuItem value=""><em>{UNCATEGORISED_LABEL}</em></MenuItem>
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
                {/* กำลังบันทึก = aria-disabled ไม่ใช่ disabled — ปุ่มที่ถูกปิดระหว่างถือ focus ทำ focus หลุด */}
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    ref={saveRef}
                    variant="contained"
                    onClick={async () => { if (!busySaving) notify(await saveClassification()); }}
                    aria-disabled={busySaving}
                    aria-busy={savingClassification && !savingNext}
                  >
                    {savingClassification && !savingNext ? 'กำลังบันทึก…' : 'บันทึกและตรวจแล้ว'}
                  </Button>
                  {onNext && (
                    <Button
                      ref={saveNextRef}
                      variant="outlined"
                      endIcon={<ChevronRightRounded />}
                      onClick={() => void saveAndNext()}
                      aria-disabled={busySaving}
                      aria-busy={savingNext}
                      aria-keyshortcuts="Control+Enter Meta+Enter"
                    >
                      {savingNext ? 'กำลังบันทึก…' : 'บันทึกแล้วไปถัดไป'}
                    </Button>
                  )}
                  {/* คำใบ้คีย์ลัด — จอ xs (มือถือ) ส่วนใหญ่ไม่มีคีย์บอร์ด ไม่ต้องกินที่ */}
                  {onNext && (
                    <Typography variant="body2" color="text.secondary" sx={{ ...dataTextSx, alignSelf: 'center', display: { xs: 'none', sm: 'block' } }}>
                      {SAVE_NEXT_SHORTCUT}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Box>

            <Divider />

            <Box component="section" aria-labelledby="splits-heading" ref={splitsBoxRef}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography component="h3" variant="h2" id="splits-heading" sx={SECTION_HEADING_SX}>แยกยอดตามหมวด</Typography>
                <Button
                  ref={addSplitRef}
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
                  แบ่งยอดเพิ่ม
                </Button>
              </Stack>

              {splits.length === 0 ? (
                <Typography variant="body2" color="text.secondary">ใช้เมื่อรายการเดียวมีหลายหมวด เช่นซื้อของที่มีทั้งอาหารและของใช้ กด "แบ่งยอดเพิ่ม" แล้วแบ่งยอดให้ครบ</Typography>
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
                          label={`หมวดที่ ${n}`}
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
                          slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': `จำนวนเงิน หมวดที่ ${n} (บาท)`, sx: dataTextSx } }}
                          sx={{ width: 110, flexShrink: 0 }}
                        />
                        <IconButton
                          data-split-delete
                          aria-label={`ลบหมวดที่ ${n}`}
                          onClick={() => {
                            focusSplitAtRef.current = index;
                            setSplits((rows) => rows.filter((_, i) => i !== index));
                          }}
                        >
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

              {/* ไม่มีทั้งร่างและที่บันทึกไว้ = ไม่มีอะไรให้บันทึก · ลบร่างหมดแต่มีที่บันทึกไว้ = กดแล้วล้างหมวดของรายการ */}
              {(splits.length > 0 || detail.splits.length > 0) && (
                <Button
                  variant="outlined"
                  color={splits.length === 0 ? 'error' : 'primary'}
                  onClick={async () => {
                    if (savingSplits) return;
                    const clearing = splits.length === 0;
                    const result = await saveSplits();
                    notify(result);
                    // ปุ่มนี้หายไปหลังล้างสำเร็จ — focus ไป "แบ่งยอดเพิ่ม" ที่อยู่ตลอด
                    if (result.ok && clearing) addSplitRef.current?.focus();
                  }}
                  aria-disabled={savingSplits}
                  aria-busy={savingSplits}
                  sx={{ mt: 1.5 }}
                >
                  {savingSplits ? 'กำลังบันทึก…' : splits.length === 0 ? 'ล้างหมวดทั้งหมด' : 'บันทึกการแยกยอด'}
                </Button>
              )}
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
                            {/* กำลังทำ = aria-disabled ไม่ใช่ disabled — ปุ่มที่ถือ focus อยู่ไม่ทำ focus หลุดไป <body> */}
                            <Button
                              size="small"
                              variant="contained"
                              aria-disabled={actingMatchId != null}
                              aria-busy={actingMatchId === m.id}
                              onClick={() => { if (actingMatchId == null) void actOnMatch(m.id, 'confirm'); }}
                            >
                              ยืนยันว่าเป็นคู่โอน
                            </Button>
                            <Button
                              size="small"
                              color="inherit"
                              aria-disabled={actingMatchId != null}
                              onClick={() => { if (actingMatchId == null) void actOnMatch(m.id, 'reject'); }}
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
            notify({ message: 'บันทึกรายได้เต็มแล้ว', severity: 'success' });
            void load(detail.id, true);
            onSaved();
          }}
        />
      )}
      <ConfirmDialog
        open={pendingNav != null}
        title="มีการแก้ไขที่ยังไม่บันทึก"
        description={
          <>
            {annotationWillSave
              ? 'บันทึกก่อนไปต่อไหม การบันทึกจะทำเครื่องหมายรายการนี้ว่าตรวจแล้วด้วย ถ้าทิ้ง ค่าที่แก้ไว้จะกลับเป็นค่าเดิม'
              : 'บันทึกการแยกยอดก่อนไปต่อไหม ถ้าทิ้ง ค่าที่แก้ไว้จะกลับเป็นค่าเดิม'}
            {navError && <Alert severity="error" sx={{ mt: 2 }}>{navError}</Alert>}
          </>
        }
        confirmLabel="บันทึก"
        secondaryLabel="ทิ้งการแก้ไข"
        secondaryColor="error"
        onSecondary={discardEdits}
        busy={savingNav}
        onClose={() => setPendingNav(null)}
        onConfirm={() => void confirmSave()}
        onExited={() => {
          const notice = afterDialogNoticeRef.current;
          afterDialogNoticeRef.current = null;
          if (notice) notify(notice);
        }}
      />
    </Drawer>
  );
}
