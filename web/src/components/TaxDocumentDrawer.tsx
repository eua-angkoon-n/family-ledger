import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import {
  patch, put, req, type TaxDocument, type TaxDocumentDetail, type TaxDocumentStatus, type TaxEntity, type TxnListResponse,
} from '../api.js';
import MonthPicker, { currentMonth, validMonth } from './MonthPicker.js';
import { formatBaht, formatDate, formatDateTime, parseBahtToSatang } from '../format.js';
import { dataDisplaySx, dataTextSx, radii } from '../theme.js';
import { DOCUMENT_TYPE_LABEL } from '../taxDocumentLabels.js';
import { amountFieldHelp, ConfirmDialog, LoadError, visuallyHiddenSx, type Notice } from '../ui.js';
import Money from './Money.js';
import {
  EMPTY_TAX_DOC_META_FORM, firstMetaErrorId, metaFieldId, TaxDocumentMetadataFields, taxDocumentMetaErrors, taxDocumentMetaKey, taxDocumentMetaPayload,
  taxDocumentToForm, taxYearBE,
} from './TaxDocumentMetadataFields.js';
import TaxDocumentStatusChip, { TAX_DOC_STATUS_LABEL } from './TaxDocumentStatusChip.js';

type LinkRow = { txn_id: number; linked_amount_satang: number; txn_date: string; description: string };
type SaveResult = Notice & { ok: boolean };
// what = ส่วนที่ยังไม่บันทึก จับไว้ตอนถาม — ข้อความใน dialog ไม่เปลี่ยนระหว่าง fade ออก
type Pending = { kind: 'close' | 'cancelEdit'; go: () => void; what: string };

// ปุ่มสถานะของแต่ละสถานะ: ไปข้างหน้า (contained) แล้วถอยกลับ (ปุ่มข้อความ) — PATCH status อย่างเดียว
// server: ยังไม่ตรวจ → ตรวจแล้ว ตั้ง verified_at = now(), ถอยเป็นยังไม่ตรวจล้าง verified_at, ยื่นแล้ว ↔ ตรวจแล้ว คงเวลาที่ตรวจไว้
const STATUS_MOVES: Record<TaxDocumentStatus, { forward?: TaxDocumentStatus; back: TaxDocumentStatus[] }> = {
  draft: { forward: 'verified', back: [] },
  verified: { forward: 'submitted', back: ['draft'] },
  submitted: { back: ['verified', 'draft'] },
};
const NOT_READY: SaveResult = { ok: false, message: 'ยังโหลดเอกสารไม่เสร็จ', severity: 'error' };

const detailToLinkRows = (detail: TaxDocumentDetail): LinkRow[] =>
  detail.links.map((l) => ({ txn_id: l.txn_id, linked_amount_satang: l.linked_amount_satang, txn_date: l.txn_date, description: l.description }));
// เทียบการเชื่อมโดยไม่สนลำดับ
const linksKey = (rows: LinkRow[]) => rows.map((l) => `${l.txn_id}:${l.linked_amount_satang}`).sort().join(',');

type Props = {
  docId: number | null;
  taxEntities: TaxEntity[];
  entitiesLoad?: { error: string; onRetry: () => void };
  onClose: () => void;
  onSaved: () => void;
  onNotice: (notice: Notice) => void;
};

// โครงเดียวกับ ReviewDrawer.tsx — รับ id ไม่ใช่ object, fetch เอง, section คั่นด้วย Divider
// สองส่วนที่แก้ได้ (ข้อมูลเอกสาร, การเชื่อมธุรกรรม) — ทุกทางออก (X, Esc, ฉากหลัง, ยกเลิกการแก้ไข) ผ่าน guard ถามก่อนทิ้ง (The Unsaved Edit Rule)
export default function TaxDocumentDrawer({ docId, taxEntities, entitiesLoad, onClose, onSaved, onNotice }: Props) {
  const idPrefix = useId();
  const [detail, setDetail] = useState<TaxDocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editInitial, setEditInitial] = useState(EMPTY_TAX_DOC_META_FORM);
  const [editForm, setEditForm] = useState(EMPTY_TAX_DOC_META_FORM);
  const [editAttempted, setEditAttempted] = useState(false);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  // สถานะที่กำลังตั้ง — ปุ่มนั้นขึ้น "กำลังบันทึก…" ปุ่มสถานะอื่นกดไม่ได้จนกว่าจะเสร็จ
  const [statusBusy, setStatusBusy] = useState<TaxDocumentStatus | null>(null);
  const [savedLinks, setSavedLinks] = useState<LinkRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [savingLinks, setSavingLinks] = useState(false);
  const [searchMonth, setSearchMonth] = useState(currentMonth());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAmount, setSearchAmount] = useState('');
  const [searchResults, setSearchResults] = useState<TxnListResponse['rows']>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [announcement, setAnnouncement] = useState<{ id: number; message: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingError, setPendingError] = useState('');
  const [savingPending, setSavingPending] = useState(false);
  const requestIdRef = useRef(0);
  // คำตอบที่มาถึงหลังปิด/เปิดเอกสารอื่นแล้วต้องไม่เขียนทับ
  const docIdRef = useRef(docId);
  docIdRef.current = docId;
  const exitNoticeRef = useRef<Notice | null>(null);
  const afterDialogRef = useRef<(() => void) | null>(null);
  // focus ที่ต้องย้ายหลัง render ถัดไป (ปุ่มที่ถือ focus หายไปพร้อมสถานะใหม่)
  const focusAfterRenderRef = useRef<(() => void) | null>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const statusHeadingRef = useRef<HTMLHeadingElement>(null);
  const linksHeadingRef = useRef<HTMLHeadingElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = focusAfterRenderRef.current;
    focusAfterRenderRef.current = null;
    focus?.();
  });

  // snackbar ของหน้าอยู่ใน #root ซึ่งเป็น aria-hidden ระหว่างที่ drawer เปิด — live region ใน drawer ให้ screen reader ได้ยิน
  const announce = (message: string) => setAnnouncement((a) => ({ id: (a?.id ?? 0) + 1, message }));
  const notify = (n: Notice) => {
    announce(n.message);
    onNotice({ message: n.message, severity: n.severity });
  };

  const load = async (id: number) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const d = await req<TaxDocumentDetail>(`/api/tax-documents/${id}`);
      if (requestId !== requestIdRef.current) return;
      const rows = detailToLinkRows(d);
      setDetail(d);
      setSavedLinks(rows);
      setLinks(rows);
      setEditing(false);
      // ยอดที่จ่ายมักตรงกับยอดรวมของเอกสารเป๊ะ และจ่ายในเดือนที่ออกเอกสาร — ตั้งช่องค้นหาให้กดค้นหาได้ทันที
      setSearchAmount(formatBaht(d.total_satang));
      setSearchMonth(validMonth(d.issue_date?.slice(0, 7), currentMonth()) ?? currentMonth());
      setSearchQuery('');
      setSearchResults([]);
      setSearched(false);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'โหลดรายละเอียดไม่สำเร็จ');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (docId != null) void load(docId);
    else setAnnouncement(null);
  }, [docId]);

  const linksDirty = linksKey(links) !== linksKey(savedLinks);
  const editDirty = editing && taxDocumentMetaKey(editForm) !== taxDocumentMetaKey(editInitial);
  const dirty = !loading && detail != null && (linksDirty || editDirty);

  const taxEntityName = taxEntities.find((e) => e.id === detail?.tax_entity_id)?.display_name ?? '';

  const startEdit = () => {
    if (!detail) return;
    const form = taxDocumentToForm(detail);
    setEditInitial(form);
    setEditForm(form);
    setEditAttempted(false);
    setEditError('');
    setEditing(true);
    // ปุ่ม "แก้ไขข้อมูล" หายไปเมื่อฟอร์มขึ้น — focus ช่องแรกของฟอร์ม
    focusAfterRenderRef.current = () => document.getElementById(metaFieldId(idPrefix, 'tax_entity_id'))?.focus();
  };
  const leaveEdit = () => {
    setEditing(false);
    focusAfterRenderRef.current = () => editButtonRef.current?.focus();
  };

  // ไม่ส่ง status — PATCH คงสถานะเดิม (ตรวจแล้วยังเป็นตรวจแล้ว) และไม่ส่ง recipient_tax_id ที่ฟอร์มไม่มี (key หาย = คงค่าเดิม)
  const saveEdit = async (): Promise<SaveResult & { focusId?: string }> => {
    if (!detail) return NOT_READY;
    setEditAttempted(true);
    const focusId = firstMetaErrorId(idPrefix, taxDocumentMetaErrors(editForm));
    if (focusId) return { ok: false, message: 'ข้อมูลเอกสารยังไม่ครบหรือไม่ถูกต้อง แก้ช่องที่มีข้อความเตือนก่อนบันทึก', severity: 'error', focusId };
    setSavingEdit(true);
    try {
      const updated = await patch<TaxDocument>(`/api/tax-documents/${detail.id}`, taxDocumentMetaPayload(editForm));
      if (docIdRef.current === detail.id) {
        // คำตอบไม่มี links — คงของเดิม
        setDetail((d) => (d ? { ...d, ...updated } : d));
        setEditing(false);
      }
      onSaved();
      return { ok: true, message: 'บันทึกข้อมูลเอกสารแล้ว', severity: 'success' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'บันทึกข้อมูลเอกสารไม่สำเร็จ', severity: 'error' };
    } finally {
      setSavingEdit(false);
    }
  };

  const saveLinks = async (): Promise<SaveResult> => {
    if (!detail) return NOT_READY;
    setSavingLinks(true);
    try {
      await put(`/api/tax-documents/${detail.id}/links`, links.map((l) => ({ txn_id: l.txn_id, linked_amount_satang: l.linked_amount_satang })));
      if (docIdRef.current === detail.id) setSavedLinks(links);
      onSaved();
      return { ok: true, message: links.length === 0 ? 'เอาการเชื่อมธุรกรรมออกหมดแล้ว' : `บันทึกการเชื่อม ${links.length} ธุรกรรมแล้ว`, severity: 'success' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'บันทึกการเชื่อมไม่สำเร็จ', severity: 'error' };
    } finally {
      setSavingLinks(false);
    }
  };

  // ไปข้างหน้าหรือถอยกลับ — ไม่มี dialog (ถอยแล้วกดกลับได้ทันที) แต่ประกาศผลทุกครั้ง · ห้ามระหว่างมีการแก้ไขข้อมูลค้าง
  // (ตรวจแล้ว = ข้อมูลตรงกับไฟล์ ถ้าข้อมูลบนจอยังไม่ได้บันทึก สถานะจะรับรองค่าเก่า)
  const setStatus = async (next: TaxDocumentStatus) => {
    if (!detail || statusBusy || editDirty) return;
    const forward = STATUS_MOVES[detail.status].forward === next;
    setStatusBusy(next);
    try {
      const updated = await patch<TaxDocument>(`/api/tax-documents/${detail.id}`, { status: next });
      if (docIdRef.current === detail.id) {
        setDetail((d) => (d ? { ...d, status: updated.status, verified_at: updated.verified_at } : d));
        // ปุ่มชุดใหม่แทนชุดเดิม (ปุ่มที่กดหายไป) — focus หัวข้อส่วนนี้ ผลประกาศผ่าน live region
        focusAfterRenderRef.current = () => statusHeadingRef.current?.focus();
      }
      notify({
        message: forward ? `ทำเครื่องหมายว่า${TAX_DOC_STATUS_LABEL[next]}` : `สถานะกลับเป็น “${TAX_DOC_STATUS_LABEL[next]}”`,
        severity: 'success',
      });
      onSaved();
    } catch (e) {
      notify({ message: e instanceof Error ? e.message : 'ตั้งสถานะไม่สำเร็จ', severity: 'error' });
    } finally {
      setStatusBusy(null);
    }
  };

  // ทุกทางออกผ่านที่นี่ — ปิด drawer นับทั้งสองส่วน, ยกเลิกการแก้ไขนับแค่ข้อมูลเอกสาร
  const guard = (kind: Pending['kind'], go: () => void) => {
    const relevant = kind === 'close' ? dirty : editDirty;
    if (!relevant) return go();
    const what = [editDirty && 'ข้อมูลเอกสาร', kind === 'close' && linksDirty && 'การเชื่อมธุรกรรม'].filter(Boolean).join(' และ');
    setPendingError('');
    setPending({ kind, go, what });
    setPendingOpen(true);
  };
  const requestClose = () => guard('close', onClose);

  // บันทึกจาก dialog: ข้อมูลเอกสารก่อน แล้วจึงการเชื่อม (เฉพาะตอนปิด) — ไม่สำเร็จ dialog ค้างพร้อมข้อความ
  const confirmSave = async () => {
    const nav = pending;
    if (!nav || !pendingOpen || savingPending) return;
    setSavingPending(true);
    const results: SaveResult[] = [];
    if (editDirty) results.push(await saveEdit());
    if (nav.kind === 'close' && linksDirty && results.every((r) => r.ok)) results.push(await saveLinks());
    setSavingPending(false);
    const failed = results.find((r) => !r.ok);
    if (failed) {
      setPendingError(failed.message);
      return;
    }
    const notice: Notice = { message: results.map((r) => r.message).join(' · '), severity: 'success' };
    if (nav.kind === 'close') {
      exitNoticeRef.current = notice;
    } else {
      afterDialogRef.current = () => {
        notify(notice);
        editButtonRef.current?.focus();
      };
    }
    setPendingOpen(false);
    if (nav.kind === 'close') nav.go();
  };
  const discard = () => {
    const nav = pending;
    if (!nav) return;
    setPendingOpen(false);
    if (nav.kind === 'close') {
      nav.go();
    } else {
      setEditing(false);
      afterDialogRef.current = () => editButtonRef.current?.focus();
    }
  };

  const submitEdit = async () => {
    if (savingEdit) return;
    setEditError('');
    const result = await saveEdit();
    if (result.ok) {
      notify(result);
      focusAfterRenderRef.current = () => editButtonRef.current?.focus();
    } else if (result.focusId) {
      const id = result.focusId;
      requestAnimationFrame(() => document.getElementById(id)?.focus());
    } else {
      setEditError(result.message);
    }
  };

  const searchAmountSatang = searchAmount.trim() ? parseBahtToSatang(searchAmount) : null;
  const runSearch = async () => {
    if (searching) return;
    if (searchAmount.trim() !== '' && searchAmountSatang == null) {
      amountInputRef.current?.focus();
      return;
    }
    setSearching(true);
    try {
      const q = new URLSearchParams({ month: searchMonth, limit: '25' });
      if (searchQuery.trim()) q.set('q', searchQuery.trim());
      // ยอดที่จ่ายตรงกับยอดธุรกรรมเป๊ะเสมอ (สตางค์ต่อสตางค์) ค้นด้วยยอดแม่นกว่าค้นด้วยคำอธิบายที่ statement มักส่งมาว่าง/กำกวม
      if (searchAmountSatang != null) {
        q.set('min_satang', String(searchAmountSatang));
        q.set('max_satang', String(searchAmountSatang));
      }
      const result = await req<TxnListResponse>(`/api/transactions?${q}`);
      setSearchResults(result.rows);
      setSearched(true);
      announce(result.rows.length === 0 ? 'ไม่พบธุรกรรม' : `พบ ${result.rows.length} ธุรกรรม`);
    } catch (e) {
      notify({ message: e instanceof Error ? e.message : 'ค้นหาธุรกรรมไม่สำเร็จ', severity: 'error' });
    } finally {
      setSearching(false);
    }
  };

  const addLink = (row: TxnListResponse['rows'][number]) => {
    if (links.some((l) => l.txn_id === row.id)) return;
    setLinks((rows) => [...rows, { txn_id: row.id, linked_amount_satang: row.amount_satang, txn_date: row.txn_date, description: row.description }]);
    announce(`เพิ่ม ${row.description || 'ธุรกรรม'} ${formatDate(row.txn_date)} แล้ว ยังไม่บันทึก กด "บันทึกการเชื่อม" เพื่อบันทึก`);
  };
  const removeLink = (index: number) => {
    const removed = links[index];
    setLinks((rows) => rows.filter((_, i) => i !== index));
    if (removed) announce(`เอา ${removed.description || 'ธุรกรรม'} ออกแล้ว ยังไม่บันทึก`);
    // ปุ่มที่กดหายไปพร้อมแถว — focus ปุ่มเอาออกของแถวที่เลื่อนขึ้นมา หรือช่องยอดของการค้นหาเมื่อไม่เหลือแถวถัดไป
    focusAfterRenderRef.current = () => {
      const buttons = document.querySelectorAll<HTMLElement>('[data-link-remove]');
      (buttons[index] ?? buttons[index - 1] ?? amountInputRef.current)?.focus();
    };
  };

  const statusButtons = detail
    ? [
        ...(STATUS_MOVES[detail.status].forward ? [{ next: STATUS_MOVES[detail.status].forward!, forward: true }] : []),
        ...STATUS_MOVES[detail.status].back.map((next) => ({ next, forward: false })),
      ]
    : [];
  const verifiedAt = detail?.verified_at && <>ตรวจเมื่อ <Box component="span" sx={dataTextSx}>{formatDateTime(detail.verified_at)}</Box></>;
  const statusHint = detail?.status === 'draft'
    ? 'เทียบข้อมูลด้านบนกับไฟล์ต้นฉบับ ถ้าตรงกันแล้วกด “ทำเครื่องหมายว่าตรวจแล้ว”'
    : detail?.status === 'verified'
      ? <>{verifiedAt}{verifiedAt && ' · '}ถ้ายื่นแบบภาษีที่ใช้เอกสารนี้แล้ว กด “ทำเครื่องหมายว่ายื่นแล้ว”</>
      : verifiedAt;
  // ถอยกลับเป็นยังไม่ตรวจ = server ล้าง verified_at (ถอยจากยื่นแล้วเป็นตรวจแล้วคงเวลาเดิม) — บอกก่อนกด
  const willClearVerifiedAt = detail?.verified_at != null && STATUS_MOVES[detail.status].back.includes('draft');

  // ข้อมูลเอกสารที่ไม่บังคับ แสดงเฉพาะที่กรอกไว้
  const details = detail ? ([
    ['ผู้เสียภาษี', taxEntityName || '—'],
    ['ประเภท', DOCUMENT_TYPE_LABEL[detail.document_type]],
    ['ปีภาษี', <Box component="span" sx={dataTextSx}>{taxYearBE(detail.tax_year)}</Box>],
    detail.document_no && ['เลขที่เอกสาร', <Box component="span" sx={dataTextSx}>{detail.document_no}</Box>],
    detail.issue_date && ['วันที่ออก', <Box component="span" sx={dataTextSx}>{formatDate(detail.issue_date)}</Box>],
    detail.issuer_tax_id && ['เลขผู้เสียภาษีของผู้ออก', <Box component="span" sx={dataTextSx}>{detail.issuer_tax_id}</Box>],
    detail.subtotal_satang != null && ['ยอดก่อนภาษี', <Money satang={detail.subtotal_satang} />],
    detail.vat_satang != null && ['ภาษีมูลค่าเพิ่ม', <Money satang={detail.vat_satang} />],
    detail.withholding_satang != null && ['ภาษีหัก ณ ที่จ่าย', <Money satang={detail.withholding_satang} />],
    ['ไฟล์', <Box component="span" sx={{ ...dataTextSx, overflowWrap: 'anywhere' }}>{detail.original_filename}</Box>],
  ].filter(Boolean) as [string, ReactNode][]) : [];

  return (
    <Drawer
      anchor="right"
      open={docId != null}
      onClose={requestClose}
      slotProps={{
        paper: { 'aria-labelledby': 'tax-doc-drawer-heading' },
        transition: {
          onExited: () => {
            const notice = exitNoticeRef.current;
            exitNoticeRef.current = null;
            if (notice) onNotice(notice);
          },
        },
      }}
    >
      <Box sx={{ width: { xs: '100vw', sm: 460 }, p: 3, height: '100%', overflowY: 'auto' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          {/* ชื่อผู้ออกคือสิ่งที่ผู้ใช้มองหา — คำนำหน้าที่ซ่อนไว้ทำให้ชื่อ dialog (aria-labelledby) ยังบอกว่าเป็นเอกสารภาษี */}
          <Typography variant="h2" id="tax-doc-drawer-heading" sx={{ pt: 0.75, minWidth: 0, overflowWrap: 'anywhere' }}>
            {detail && !loading && !error
              ? <><Box component="span" sx={visuallyHiddenSx}>เอกสารภาษี: </Box>{detail.issuer_name}</>
              : 'รายละเอียดเอกสารภาษี'}
          </Typography>
          <IconButton aria-label="ปิด" onClick={requestClose}><CloseRounded /></IconButton>
        </Stack>
        {/* อยู่นอกส่วนที่ถูกแทนด้วย skeleton — live region ต้องอยู่ใน DOM ก่อนข้อความเปลี่ยนจึงประกาศแน่นอน */}
        <Box role="status" sx={visuallyHiddenSx}>
          {announcement && <span key={announcement.id}>{announcement.message}</span>}
        </Box>

        {error && <LoadError message={error} onRetry={docId != null ? () => void load(docId) : undefined} />}

        {loading ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={100} />
            <Skeleton variant="rounded" height={140} />
          </Stack>
        ) : detail && !error ? (
          <Stack spacing={3}>
            <Box>
              <TaxDocumentStatusChip status={detail.status} />
              <Money satang={detail.total_satang} sx={{ ...dataDisplaySx, display: 'block', mt: 1 }} />
              {/* เปิดดู = ไฟล์เดิมแบบ inline ในแท็บใหม่ (เทียบกับข้อมูลได้โดยไม่ต้องเก็บไฟล์ลงเครื่อง) — server บันทึกประวัติเหมือนดาวน์โหลด */}
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.5 }}>
                <Button
                  component="a"
                  href={`/api/tax-documents/${detail.id}/file?inline=1`}
                  target="_blank"
                  rel="noopener"
                  variant="outlined"
                  startIcon={<OpenInNewRounded />}
                >
                  เปิดดู<Box component="span" sx={visuallyHiddenSx}> (แท็บใหม่)</Box>
                </Button>
                <Button component="a" href={`/api/tax-documents/${detail.id}/file`} download variant="outlined" startIcon={<DownloadRounded />}>
                  ดาวน์โหลดไฟล์ต้นฉบับ
                </Button>
              </Stack>
            </Box>

            <Divider />

            <Box component="section" aria-labelledby="tax-doc-info-heading">
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="h3" id="tax-doc-info-heading">ข้อมูลเอกสาร</Typography>
                {!editing && (
                  <Button ref={editButtonRef} size="small" startIcon={<EditRounded />} onClick={startEdit}>แก้ไขข้อมูล</Button>
                )}
              </Stack>
              {editing ? (
                // noValidate: ตรวจเอง error ไทยใต้ช่อง (Inputs ใน DESIGN.md)
                <Box
                  component="form"
                  noValidate
                  aria-labelledby="tax-doc-info-heading"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitEdit();
                  }}
                >
                  <Stack spacing={2}>
                    {editError && <Alert severity="error">{editError}</Alert>}
                    <TaxDocumentMetadataFields
                      form={editForm}
                      setForm={setEditForm}
                      taxEntities={taxEntities}
                      idPrefix={idPrefix}
                      attempted={editAttempted}
                      entitiesLoad={entitiesLoad}
                    />
                    {detail.status !== 'draft' && (
                      <Typography variant="body2" color="text.secondary">
                        บันทึกแล้วสถานะยังเป็น “{TAX_DOC_STATUS_LABEL[detail.status]}” ตามเดิม
                      </Typography>
                    )}
                    {/* กำลังบันทึก = aria-disabled ไม่ใช่ disabled — ปุ่มที่ถือ focus ไม่ทำ focus หลุด */}
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Button type="submit" variant="contained" aria-disabled={savingEdit} aria-busy={savingEdit}>
                        {savingEdit ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}
                      </Button>
                      <Button color="inherit" onClick={() => { if (!savingEdit) guard('cancelEdit', leaveEdit); }} aria-disabled={savingEdit}>
                        ยกเลิก
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              ) : (
                <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'minmax(7rem, auto) 1fr', columnGap: 2, rowGap: 0.75 }}>
                  {details.map(([label, value]) => (
                    <Box key={label} sx={{ display: 'contents' }}>
                      <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
                      <Typography component="dd" variant="body2" sx={{ m: 0, minWidth: 0 }}>{value}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <Divider />

            <Box component="section" aria-labelledby="tax-doc-status-heading">
              <Typography ref={statusHeadingRef} tabIndex={-1} variant="h3" id="tax-doc-status-heading" sx={{ mb: 1.5 }}>
                สถานะเอกสาร
              </Typography>
              {/* สถานะปัจจุบันอยู่ที่ chip บนหัวลิ้นชักแล้ว — ส่วนนี้บอกเวลาที่ตรวจและสิ่งที่ทำต่อได้ ไม่ซ้ำป้าย */}
              {statusHint && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{statusHint}</Typography>}
              {/* แก้ข้อมูลค้าง = aria-disabled + เหตุผล ไม่ซ่อนปุ่ม (ยังอยู่ในลำดับ tab และอ่านเหตุผลได้) */}
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {statusButtons.map(({ next, forward }) => (
                  <Button
                    key={next}
                    variant={forward ? 'contained' : 'text'}
                    color={forward ? 'primary' : 'inherit'}
                    onClick={() => void setStatus(next)}
                    aria-disabled={statusBusy != null || editDirty}
                    aria-busy={statusBusy === next}
                    aria-describedby={[editDirty && 'tax-doc-status-blocked', next === 'draft' && willClearVerifiedAt && 'tax-doc-status-clear'].filter(Boolean).join(' ') || undefined}
                  >
                    {statusBusy === next ? 'กำลังบันทึก…' : forward ? `ทำเครื่องหมายว่า${TAX_DOC_STATUS_LABEL[next]}` : `กลับเป็น${TAX_DOC_STATUS_LABEL[next]}`}
                  </Button>
                ))}
              </Stack>
              {willClearVerifiedAt && (
                <Typography id="tax-doc-status-clear" variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  กลับเป็นยังไม่ตรวจ เวลาที่ตรวจไว้จะถูกล้าง
                </Typography>
              )}
              {editDirty && (
                <Typography id="tax-doc-status-blocked" variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  บันทึกการแก้ไขข้อมูลเอกสารก่อน แล้วจึงเปลี่ยนสถานะ
                </Typography>
              )}
            </Box>

            <Divider />

            <Box component="section" aria-labelledby="tax-doc-links-heading">
              <Typography ref={linksHeadingRef} tabIndex={-1} variant="h3" id="tax-doc-links-heading" sx={{ mb: links.length > 0 ? 0.5 : 1.5 }}>
                เชื่อมกับธุรกรรม
              </Typography>
              {/* ยอดของรายการบนจอ (รวมที่ยังไม่บันทึก) เทียบยอดรวมของเอกสาร */}
              {links.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  เชื่อมแล้ว <Money satang={links.reduce((sum, l) => sum + l.linked_amount_satang, 0)} /> จาก <Money satang={detail.total_satang} />
                </Typography>
              )}

              {links.length === 0 ? (
                <Typography variant="body2" color="text.secondary">ยังไม่ได้เชื่อมกับธุรกรรมใด ค้นหาด้านล่างแล้วกดที่รายการเพื่อเพิ่ม</Typography>
              ) : (
                <Stack spacing={1}>
                  {links.map((l, index) => (
                    <Stack key={l.txn_id} direction="row" spacing={1} sx={{ alignItems: 'center', p: 1, border: 1, borderColor: 'divider', borderRadius: `${radii.xl}px` }}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap title={l.description}>{l.description || '(ไม่มีคำอธิบายรายการ)'}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={dataTextSx}>{formatDate(l.txn_date)}</Typography>
                      </Box>
                      <Money satang={l.linked_amount_satang} sx={{ whiteSpace: 'nowrap' }} />
                      <IconButton
                        data-link-remove
                        aria-label={`เอา ${l.description || 'ธุรกรรม'} ${formatDate(l.txn_date)} ออกจากการเชื่อม`}
                        onClick={() => removeLink(index)}
                      >
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              )}

              {linksDirty && (
                <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mt: 1.5 }}>
                  <Button
                    variant="contained"
                    onClick={async () => {
                      if (savingLinks) return;
                      const result = await saveLinks();
                      notify(result);
                      // ปุ่มนี้หายไปเมื่อบันทึกแล้ว — focus หัวข้อส่วนนี้
                      if (result.ok) focusAfterRenderRef.current = () => linksHeadingRef.current?.focus();
                    }}
                    aria-disabled={savingLinks}
                    aria-busy={savingLinks}
                  >
                    {savingLinks ? 'กำลังบันทึก…' : 'บันทึกการเชื่อม'}
                  </Button>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>ยังไม่ได้บันทึก</Typography>
                </Stack>
              )}

              <Typography component="h4" variant="body2" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>ค้นหาธุรกรรมเพื่อเชื่อม</Typography>
              {/* เดือนแถวเดียว แล้วยอด/ชื่อ/ปุ่ม — ลิ้นชัก 460px เรียงสี่อย่างในแถวเดียวแล้วช่องบีบเหลือไม่กี่ px */}
              <MonthPicker value={searchMonth} onChange={setSearchMonth} />
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  mt: 1,
                  alignItems: 'start',
                  gridTemplateColumns: { xs: '1fr', sm: '9rem minmax(0, 1fr) auto' },
                }}
              >
                <TextField
                  size="small"
                  label="ยอดเงิน (บาท)"
                  value={searchAmount}
                  inputRef={amountInputRef}
                  onChange={(e) => setSearchAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void runSearch(); }}
                  {...amountFieldHelp(searchAmount)}
                  slotProps={{ htmlInput: { inputMode: 'decimal', sx: dataTextSx } }}
                />
                <TextField
                  size="small"
                  label="ชื่อรายการ"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void runSearch(); }}
                />
                <Button variant="outlined" startIcon={<SearchRounded />} onClick={() => void runSearch()} aria-disabled={searching} aria-busy={searching} sx={{ whiteSpace: 'nowrap' }}>
                  ค้นหา
                </Button>
              </Box>
              {searchResults.length > 0 ? (
                <List
                  dense
                  aria-label="ผลการค้นหาธุรกรรม"
                  sx={{ mt: 1.5, border: 1, borderColor: 'divider', borderRadius: `${radii.xl}px`, maxHeight: 280, overflowY: 'auto' }}
                >
                  {searchResults.map((row) => {
                    const added = links.some((l) => l.txn_id === row.id);
                    const account = row.account_nickname.toLowerCase().includes(row.bank_name.toLowerCase())
                      ? row.account_nickname
                      : `${row.account_nickname} (${row.bank_name})`;
                    const tone = row.classification === 'internal_transfer' ? 'neutral' : row.direction === 'credit' ? 'income' : 'expense';
                    return (
                      // เพิ่มแล้ว = aria-disabled ไม่ใช่ disabled — รายการที่ถือ focus อยู่ไม่ทำ focus หลุด
                      <ListItemButton key={row.id} aria-disabled={added} onClick={added ? undefined : () => addLink(row)} sx={{ gap: 1 }}>
                        <ListItemText
                          primary={row.description || '(ไม่มีคำอธิบายรายการ)'}
                          secondary={
                            <>
                              {formatDate(row.txn_date)} · {account} ·{' '}
                              <Money satang={row.direction === 'debit' ? -row.amount_satang : row.amount_satang} tone={tone} showSign />
                            </>
                          }
                          slotProps={{ primary: { sx: { overflowWrap: 'anywhere' } }, secondary: { sx: dataTextSx } }}
                        />
                        {added ? (
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: 'text.secondary', flexShrink: 0 }}>
                            <CheckRounded fontSize="small" aria-hidden />
                            <Typography variant="body2" component="span">เพิ่มแล้ว</Typography>
                          </Stack>
                        ) : (
                          <AddRounded fontSize="small" aria-hidden sx={{ color: 'primary.main', flexShrink: 0 }} />
                        )}
                      </ListItemButton>
                    );
                  })}
                </List>
              ) : searched && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  ไม่พบธุรกรรมในเดือนและยอดนี้ ลองเปลี่ยนเดือน ล้างช่องยอด หรือค้นด้วยชื่อรายการแทน
                </Typography>
              )}
            </Box>
          </Stack>
        ) : null}
      </Box>
      <ConfirmDialog
        open={pendingOpen}
        title="มีการแก้ไขที่ยังไม่บันทึก"
        description={
          <>
            {pending?.what}ยังไม่ได้บันทึก บันทึกก่อน{pending?.kind === 'cancelEdit' ? 'ออกจากการแก้ไข' : 'ปิด'}ไหม ถ้าทิ้ง ค่าที่แก้ไว้จะกลับเป็นค่าเดิม
            {pendingError && <Alert severity="error" sx={{ mt: 2 }}>{pendingError}</Alert>}
          </>
        }
        confirmLabel="บันทึก"
        secondaryLabel="ทิ้งการแก้ไข"
        secondaryColor="error"
        cancelLabel="แก้ต่อ"
        onSecondary={discard}
        busy={savingPending}
        onClose={() => setPendingOpen(false)}
        onConfirm={() => void confirmSave()}
        onExited={() => {
          const after = afterDialogRef.current;
          afterDialogRef.current = null;
          after?.();
        }}
      />
    </Drawer>
  );
}
