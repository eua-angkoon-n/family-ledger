import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Collapse,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  type Theme,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import PlaylistRemoveRounded from '@mui/icons-material/PlaylistRemoveRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import FilterListRounded from '@mui/icons-material/FilterListRounded';
import MarkEmailReadRounded from '@mui/icons-material/MarkEmailReadRounded';
import ReceiptRounded from '@mui/icons-material/ReceiptRounded';
import {
  del, req,
  type EmailAccount, type TaxDocument, type TaxDocumentListResponse, type TaxDocumentStatus, type TaxDocumentType, type TaxEntity,
} from '../api.js';
import GmailAttachmentPicker from '../components/GmailAttachmentPicker.js';
import Money from '../components/Money.js';
import TaxDocumentDrawer from '../components/TaxDocumentDrawer.js';
import { taxYearBE, taxYearOptions } from '../components/TaxDocumentMetadataFields.js';
import TaxDocumentStatusChip, { TAX_DOC_STATUS_LABEL } from '../components/TaxDocumentStatusChip.js';
import TaxDocumentUploadModal from '../components/TaxDocumentUploadModal.js';
import { TAX_GMAIL_IMPORT_ENABLED } from '../features.js';
import { DOCUMENT_TYPE_LABEL } from '../taxDocumentLabels.js';
import { dataTextSx } from '../theme.js';
import {
  BELOW_MD, ConfirmDialog, EmptyState, FeedbackSnackbar, LoadError, MD_UP, PageHeader, RowIconButton, TableSkeleton,
  visuallyHiddenSx, type Notice,
} from '../ui.js';

const LIMIT = 50;
const PAGINATION_ARIA: Record<string, string> = { first: 'หน้าแรก', last: 'หน้าสุดท้าย', next: 'หน้าถัดไป', previous: 'หน้าก่อนหน้า' };
const CLEAR_FILTERS = { tax_entity_id: null, tax_year: null, status: null, document_type: null, q: null };
// ชื่อผู้ออกกินที่ที่เหลือแล้วตัดที่ 2 บรรทัด (ชื่อเต็มใน title) — ตารางไม่มี minWidth จึงไม่ล้นกล่องที่ 320px
const NAME_CLAMP_SX = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere' } as const;
const todoSx = (todo: boolean) => ({ color: todo ? 'text.primary' : 'text.secondary', fontWeight: todo ? 600 : 400 });

// ค่าใน URL มาจากลิงก์ได้ (หน้าภาษี, bookmark) — ค่าที่ server จะตอบ 400 ไม่ส่ง ถือว่าไม่ได้กรอง
const validYear = (v: string) => (/^\d{4}$/.test(v) && Number(v) >= 2000 && Number(v) <= 2200 ? v : '');
const validStatus = (v: string) => (Object.hasOwn(TAX_DOC_STATUS_LABEL, v) ? v : '');
const validType = (v: string) => (Object.hasOwn(DOCUMENT_TYPE_LABEL, v) ? v : '');

export default function TaxDocuments() {
  const [searchParams, setSearchParams] = useSearchParams();
  // < sm: เหลือค้นหา + ปีบนแถบ ที่เหลือพับใน "ตัวกรองเพิ่มเติม" (แบบหน้าธุรกรรม) — ตารางขึ้นสูงขึ้น ~120px
  const narrow = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'), { noSsr: true });
  const [taxEntities, setTaxEntities] = useState<TaxEntity[] | null>(null);
  const [entitiesError, setEntitiesError] = useState('');
  const [mailboxes, setMailboxes] = useState<EmailAccount[]>([]);
  const [mailboxesError, setMailboxesError] = useState('');
  const [data, setData] = useState<TaxDocumentListResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [gmailPickerOpen, setGmailPickerOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  // เอกสารที่ถามค้างไว้จน dialog ปิดสนิท — ไม่งั้นชื่อในคำถามว่างระหว่าง fade ออก
  const [archiving, setArchiving] = useState<TaxDocument | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  // หลังเอาออกจากรายการสำเร็จ: ประกาศผลและย้าย focus เมื่อ dialog ปิดสนิท (แถวหายไปพร้อมปุ่มต้นทาง)
  const afterArchiveRef = useRef<{ index: number; notice: Notice } | null>(null);
  const requestIdRef = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);

  const taxEntityId = /^\d+$/.test(searchParams.get('tax_entity_id') ?? '') ? searchParams.get('tax_entity_id')! : '';
  const taxYear = validYear(searchParams.get('tax_year') ?? '');
  const status = validStatus(searchParams.get('status') ?? '');
  const documentType = validType(searchParams.get('document_type') ?? '');
  const q = searchParams.get('q') ?? '';
  const pageRaw = Number(searchParams.get('page') ?? '1');
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  // ช่องค้นหายิงตอน Enter/ออกจากช่อง ไม่ใช่ทุกตัวอักษร — ร่างตามค่าใน URL เสมอ (ล้างตัวกรอง/Back แล้วช่องตรงกับผล)
  const [qDraft, setQDraft] = useState(q);
  useEffect(() => setQDraft(q), [q]);
  // เปิดลิงก์ที่มีตัวกรองในแผงอยู่แล้ว (หน้าภาษีส่ง ?status=draft) = กางให้เห็นเลย — ผู้เสียภาษีรู้ว่าเป็นตัวกรองจริงไหม
  // หลังโหลดรายชื่อ (effect ด้านล่าง)
  const [moreOpen, setMoreOpen] = useState(() => Boolean(status || documentType));

  // ตัวกรอง = replace (ไม่เพิ่ม history ทุกครั้งที่เลือก) · หน้า = push (Back ย้อนได้)
  const setFilter = (patch: Record<string, string | null>, replace = true) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (!('page' in patch)) next.delete('page');
      return next;
    }, { replace });
  };
  const commitSearch = () => {
    if (qDraft.trim() !== q) setFilter({ q: qDraft.trim() });
  };

  const loadEntities = () => {
    setEntitiesError('');
    req<TaxEntity[]>('/api/tax-entities')
      .then(setTaxEntities)
      .catch(() => setEntitiesError('โหลดรายชื่อผู้เสียภาษีไม่สำเร็จ'));
  };
  const loadMailboxes = () => {
    setMailboxesError('');
    req<EmailAccount[]>('/api/email-accounts')
      .then(setMailboxes)
      .catch(() => setMailboxesError('โหลดรายชื่อกล่องอีเมลไม่สำเร็จ'));
  };
  useEffect(() => {
    loadEntities();
    if (TAX_GMAIL_IMPORT_ENABLED) loadMailboxes();
  }, []);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (taxEntityId) p.set('tax_entity_id', taxEntityId);
    if (taxYear) p.set('tax_year', taxYear);
    if (status) p.set('status', status);
    if (documentType) p.set('document_type', documentType);
    if (q) p.set('q', q);
    p.set('limit', String(LIMIT));
    p.set('offset', String((page - 1) * LIMIT));
    return p.toString();
  }, [taxEntityId, taxYear, status, documentType, q, page]);

  // คงแถวเดิมไว้ระหว่างโหลด (aria-busy + แถบบาง) — skeleton เฉพาะตอนยังไม่มีอะไรให้ดู
  // background = โหลดซ้ำหลังอัปโหลด/แก้/เอาออกจากรายการ: พังแล้วคงแถวเดิมใต้ LoadError (The Section Failure Rule)
  // ตัวกรอง/หน้าเปลี่ยนแล้วพัง = แถวเดิมเป็นของเงื่อนไขก่อน ไม่ค้างไว้
  const load = async (background: boolean) => {
    const requestId = ++requestIdRef.current;
    setBusy(true);
    setError('');
    try {
      const result = await req<TaxDocumentListResponse>(`/api/tax-documents?${queryString}`);
      if (requestId !== requestIdRef.current) return;
      setData(result);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'โหลดรายการเอกสารภาษีไม่สำเร็จ');
      if (!background) setData(null);
    } finally {
      if (requestId === requestIdRef.current) setBusy(false);
    }
  };
  useEffect(() => { void load(false); }, [queryString]);
  const reload = () => void load(true);

  // หน้าเกินช่วง (ลิงก์เก่า, เอาแถวสุดท้ายของหน้าสุดท้ายออก) — ไปหน้าสุดท้ายที่มีแถว แทนการค้างที่ "ไม่พบ"
  const pastEnd = data != null && data.rows.length === 0 && page > 1;
  useEffect(() => {
    if (pastEnd && data) setFilter({ page: data.total_count > 0 ? String(Math.ceil(data.total_count / LIMIT)) : null });
  }, [data]);

  const rows = data?.rows ?? [];
  const totalCount = data?.total_count ?? 0;
  const entities = taxEntities ?? [];
  const activeEntities = entities.filter((e) => e.is_active);
  // ผู้เสียภาษีรายเดียว = ชื่อซ้ำกันทุกแถว ไม่ต้องมีคอลัมน์/บรรทัดรอง (แบบกล่องอีเมลของหน้าบัญชีของฉัน)
  const showEntity = entities.length > 1;
  // แท็บย่อย/ลิงก์จากหน้าประมาณการพา tax_entity_id มาเสมอ — บ้านที่มีผู้เสียภาษีรายเดียวและลิงก์ชี้รายนั้น ผลเท่ากับไม่กรอง
  // จึงไม่นับเป็นตัวกรอง (ไม่กางแผง ไม่ขึ้น "ไม่พบเอกสารที่ตรงตัวกรอง") · ระหว่างโหลดรายชื่อยังไม่นับ (ปุ่มล้างตัวกรองไม่โผล่แล้วหายทุกครั้ง
  // ที่สลับแท็บ) · รายชื่อโหลดไม่ได้ = นับไว้ก่อน ผู้ใช้ยังเห็นและล้างได้
  const entityFiltered = taxEntityId !== '' && (taxEntities == null
    ? entitiesError !== ''
    : !(entities.length === 1 && String(entities[0]!.id) === taxEntityId));
  useEffect(() => { if (taxEntities && entityFiltered) setMoreOpen(true); }, [taxEntities]);
  // ตัวกรองผู้เสียภาษี: ซ่อนเมื่อมีรายเดียว · ระหว่างโหลดรายชื่อยังแสดง (ไม่โผล่ทีหลังแล้วดันช่องอื่น) · ลิงก์ที่กรองไว้แล้วต้องเห็นและเอาออกได้
  const showEntityFilter = taxEntities == null || showEntity || entityFiltered;
  const taxEntityName = (id: number) => entities.find((e) => e.id === id)?.display_name ?? '';
  const defaultTaxEntityId = taxEntityId || (activeEntities.length === 1 ? String(activeEntities[0]!.id) : '');
  const entitiesLoad = entitiesError ? { error: entitiesError, onRetry: loadEntities } : undefined;

  const hasFilter = Boolean(entityFiltered || taxYear || status || documentType || q);
  const emptyTitle = hasFilter ? 'ไม่พบเอกสารที่ตรงตัวกรอง' : 'ยังไม่มีเอกสารภาษี';
  const clearFilters = () => {
    setFilter(CLEAR_FILTERS);
    searchRef.current?.focus(); // ปุ่มที่กดหายไปพร้อมตัวกรอง — focus ไปช่องค้นหาที่อยู่ตลอด
  };
  const clearButton = <Button color="inherit" onClick={clearFilters}>ล้างตัวกรอง</Button>;
  const openUpload = () => setUploadOpen(true);

  const openArchive = (doc: TaxDocument) => {
    setArchiving(doc);
    setArchiveError('');
    setArchiveOpen(true);
  };
  const confirmArchive = async () => {
    if (!archiving || archiveBusy) return;
    setArchiveBusy(true);
    try {
      await del(`/api/tax-documents/${archiving.id}`);
      const index = rows.findIndex((r) => r.id === archiving.id);
      // เอาแถวออกทันที แล้วโหลดซ้ำเบื้องหลัง — focus ย้ายไปแถวที่เลื่อนขึ้นมาแทนได้ตอน dialog ปิดสนิท
      setData((d) => (d ? { ...d, rows: d.rows.filter((r) => r.id !== archiving.id), total_count: Math.max(0, d.total_count - 1) } : d));
      afterArchiveRef.current = { index, notice: { message: `เอาเอกสารของ “${archiving.issuer_name}” ออกจากรายการแล้ว`, severity: 'success' } };
      setArchiveOpen(false);
      reload();
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : 'เอาออกจากรายการไม่สำเร็จ');
    } finally {
      setArchiveBusy(false);
    }
  };

  const filterSx = { flex: '1 1 160px', maxWidth: { sm: 220 } };
  const panelCount = [entityFiltered, status, documentType].filter(Boolean).length;

  const entityFilter = showEntityFilter && (
    <TextField select size="small" label="ผู้เสียภาษี" value={taxEntityId} onChange={(e) => setFilter({ tax_entity_id: e.target.value })} sx={filterSx}>
      <MenuItem value="">ทั้งหมด</MenuItem>
      {entities.map((e) => <MenuItem key={e.id} value={String(e.id)}>{e.display_name}</MenuItem>)}
      {/* ลิงก์ชี้ผู้เสียภาษีที่ไม่อยู่ในรายชื่อ (ยังโหลดไม่เสร็จ/โหลดไม่ได้) — ยังเห็นและเอาออกได้ */}
      {taxEntityId && !entities.some((e) => String(e.id) === taxEntityId) && <MenuItem value={taxEntityId}>ผู้เสียภาษีรหัส {taxEntityId}</MenuItem>}
    </TextField>
  );
  const yearFilter = (
    // < sm ฐานแคบลงให้ปีกับปุ่ม "ตัวกรอง (n)" อยู่แถวเดียวกันที่ 320px
    <TextField select size="small" label="ปีภาษี" value={taxYear} onChange={(e) => setFilter({ tax_year: e.target.value })} sx={narrow ? { flex: '1 1 120px' } : filterSx}>
      <MenuItem value="">ทุกปี</MenuItem>
      {taxYearOptions(taxYear).map((y) => <MenuItem key={y} value={String(y)} sx={dataTextSx}>{taxYearBE(y)}</MenuItem>)}
    </TextField>
  );
  const statusFilter = (
    <TextField select size="small" label="สถานะ" value={status} onChange={(e) => setFilter({ status: e.target.value })} sx={filterSx}>
      <MenuItem value="">ทั้งหมด</MenuItem>
      {(Object.entries(TAX_DOC_STATUS_LABEL) as [TaxDocumentStatus, string][]).map(([value, label]) => (
        <MenuItem key={value} value={value}>{label}</MenuItem>
      ))}
    </TextField>
  );
  const typeFilter = (
    <TextField select size="small" label="ประเภทเอกสาร" value={documentType} onChange={(e) => setFilter({ document_type: e.target.value })} sx={{ flex: '1 1 200px', maxWidth: { sm: 280 } }}>
      <MenuItem value="">ทั้งหมด</MenuItem>
      {(Object.entries(DOCUMENT_TYPE_LABEL) as [TaxDocumentType, string][]).map(([value, label]) => (
        <MenuItem key={value} value={value}>{label}</MenuItem>
      ))}
    </TextField>
  );
  const searchFilter = (
    <TextField
      size="small"
      label="ค้นหา (ผู้ออก/เลขที่เอกสาร)"
      value={qDraft}
      inputRef={searchRef}
      onChange={(e) => setQDraft(e.target.value)}
      onBlur={commitSearch}
      onKeyDown={(e) => { if (e.key === 'Enter') commitSearch(); }}
      sx={{ flex: '2 1 220px' }}
    />
  );

  return (
    <Box>
      <PageHeader
        level={1}
        id="tax-documents-heading"
        title="เอกสารภาษี"
        description="เก็บและเชื่อมใบกำกับภาษี ใบเสร็จ และหนังสือรับรองต่าง ๆ เข้ากับธุรกรรมจริง ไฟล์ถูกเข้ารหัสก่อนบันทึกเสมอ"
        action={
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }} data-tour="taxdoc-actions">
            {TAX_GMAIL_IMPORT_ENABLED && (
              <Button variant="outlined" startIcon={<MarkEmailReadRounded />} onClick={() => setGmailPickerOpen(true)} sx={{ whiteSpace: 'nowrap' }}>เลือกจาก Gmail</Button>
            )}
            <Button ref={uploadButtonRef} variant="contained" startIcon={<AddRounded />} onClick={openUpload} sx={{ whiteSpace: 'nowrap' }}>อัปโหลด</Button>
          </Stack>
        }
      />

      {entitiesError && <LoadError message={entitiesError} onRetry={loadEntities} />}
      {TAX_GMAIL_IMPORT_ENABLED && mailboxesError && <LoadError message={mailboxesError} onRetry={loadMailboxes} />}

      <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {narrow ? (
          <>
            {searchFilter}
            {yearFilter}
            {/* ตัวกรองในแผงค้างใน URL ได้แม้แผงพับ — จำนวนบนปุ่ม (สี primary) บอกว่ามีอยู่ */}
            <Button
              startIcon={<FilterListRounded />}
              onClick={() => setMoreOpen((v) => !v)}
              color={panelCount > 0 ? 'primary' : 'inherit'}
              aria-expanded={moreOpen}
              aria-controls="taxdoc-more-filters"
            >
              ตัวกรอง{panelCount > 0 ? ` (${panelCount})` : ''}
            </Button>
          </>
        ) : (
          <>
            {entityFilter}
            {yearFilter}
            {statusFilter}
            {typeFilter}
            {searchFilter}
          </>
        )}
        {hasFilter && clearButton}
      </Stack>
      {narrow && (
        <Collapse in={moreOpen} id="taxdoc-more-filters">
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', pt: 1.5 }}>
            {entityFilter}
            {statusFilter}
            {typeFilter}
          </Stack>
        </Collapse>
      )}

      {/* ผลการกรองสำหรับ screen reader — อยู่นอกส่วนที่สลับเป็น skeleton */}
      <Box role="status" sx={visuallyHiddenSx}>
        {busy || error ? '' : rows.length === 0 ? emptyTitle : `${totalCount} เอกสาร`}
      </Box>
      {error && <LoadError message={error} onRetry={() => void load(data != null)} />}

      {(data == null && !error) || pastEnd ? (
        <TableSkeleton rows={6} />
      ) : data == null ? null : rows.length === 0 ? (
        <EmptyState
          headingLevel={2}
          icon={<ReceiptRounded sx={{ fontSize: 40 }} />}
          title={emptyTitle}
          description={hasFilter
            ? 'ลองเปลี่ยนปีภาษีหรือสถานะ หรือล้างตัวกรองที่ตั้งไว้'
            : TAX_GMAIL_IMPORT_ENABLED
              ? 'อัปโหลดเอกสารด้วยมือ หรือเลือกไฟล์แนบจาก Gmail เพื่อเริ่มเก็บหลักฐานลดหย่อนภาษี'
              : 'อัปโหลดใบเสร็จ ใบกำกับภาษี หรือหนังสือรับรองเป็นไฟล์ PDF หรือรูป เพื่อเริ่มเก็บหลักฐานลดหย่อนภาษี'}
          action={hasFilter ? clearButton : <Button variant="contained" startIcon={<AddRounded />} onClick={openUpload}>อัปโหลดเอกสารแรก</Button>}
        />
      ) : (
        <>
          {/* < md เหลือ ผู้ออก · ยอดรวม · จัดการ — ประเภท/ปี/ผู้เสียภาษี/สถานะพับเป็นบรรทัดรอง (Tables ใน DESIGN.md)
              ไม่มี minWidth ตารางจึงไม่ล้นกล่องทุกขนาดจอ — ไม่ใส่ tabIndex (กล่องที่ไม่มีอะไรให้เลื่อนไม่ควรเป็นจุดแวะของ Tab) */}
          <TableContainer
            component={Paper}
            variant="outlined"
            role="region"
            aria-label="ตารางเอกสารภาษี"
            aria-busy={busy}
            data-tour="taxdoc-table"
            sx={{ mt: 3, position: 'relative' }}
          >
            {busy && <LinearProgress aria-label="กำลังโหลดเอกสาร" sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 }} />}
            <Table size="small" aria-label="เอกสารภาษี">
              <TableHead>
                <TableRow>
                  <TableCell>ผู้ออกเอกสาร</TableCell>
                  <TableCell sx={MD_UP}>ประเภท</TableCell>
                  {showEntity && <TableCell sx={MD_UP}>ผู้เสียภาษี</TableCell>}
                  <TableCell sx={MD_UP}>ปีภาษี</TableCell>
                  <TableCell align="right">ยอดรวม</TableCell>
                  <TableCell sx={MD_UP}>สถานะ</TableCell>
                  <TableCell align="right">จัดการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((doc) => (
                  // คลิกแถว = ทางลัดของเมาส์ (ลากเลือกข้อความแล้วปล่อยไม่นับ) — ปุ่ม "ดูรายละเอียด" คือทางหลักของคีย์บอร์ด
                  <TableRow
                    key={doc.id}
                    hover
                    onClick={() => { if (!window.getSelection()?.toString()) setSelectedDocId(doc.id); }}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ width: '100%', maxWidth: 0, pr: { xs: 1, md: 2 } }}>
                      <Box title={doc.issuer_name} sx={NAME_CLAMP_SX}>{doc.issuer_name}</Box>
                      {/* < md: "ใบเสร็จรับเงิน · ปี 2569 · <ผู้เสียภาษี> · ยังไม่ตรวจ" แทนคอลัมน์ที่ซ่อน */}
                      <Typography variant="body2" component="div" color="text.secondary" sx={{ ...BELOW_MD, mt: 0.25, overflowWrap: 'anywhere' }}>
                        {[
                          DOCUMENT_TYPE_LABEL[doc.document_type],
                          <>ปี <Box component="span" sx={dataTextSx}>{taxYearBE(doc.tax_year)}</Box></>,
                          showEntity && taxEntityName(doc.tax_entity_id),
                          <Box component="span" sx={todoSx(doc.status === 'draft')}>{TAX_DOC_STATUS_LABEL[doc.status]}</Box>,
                        ].filter(Boolean).map((part, i) => (
                          <Fragment key={i}>
                            {i > 0 && <Box component="span" aria-hidden>{' · '}</Box>}
                            {part}
                          </Fragment>
                        ))}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ ...MD_UP, whiteSpace: 'nowrap' }}>{DOCUMENT_TYPE_LABEL[doc.document_type]}</TableCell>
                    {showEntity && <TableCell sx={MD_UP}>{taxEntityName(doc.tax_entity_id)}</TableCell>}
                    <TableCell sx={{ ...MD_UP, ...dataTextSx }}>{taxYearBE(doc.tax_year)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', px: { xs: 1, md: 2 } }}><Money satang={doc.total_satang} /></TableCell>
                    <TableCell sx={{ ...MD_UP, whiteSpace: 'nowrap' }}><TaxDocumentStatusChip status={doc.status} /></TableCell>
                    <TableCell align="right" sx={{ py: 0.5, px: { xs: 0.5, md: 1 } }} onClick={(e) => e.stopPropagation()}>
                      {/* < md ปุ่มเรียงแนวตั้ง — ที่ 320px ชื่อผู้ออกเหลือที่ ~115px แทน ~70px
                          เปิดก่อนเอาออก (ลำดับตา/Tab/นิ้วโป้ง) — ปุ่มสีแดงไม่ใช่สิ่งแรกที่เจอ */}
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.5} sx={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                        <RowIconButton data-taxdoc-open label={`ดูรายละเอียด ${doc.issuer_name}`} tooltip="ดูรายละเอียด" onClick={() => setSelectedDocId(doc.id)}>
                          <ChevronRightRounded />
                        </RowIconButton>
                        {/* ไม่มี endpoint เอากลับ ย้อนจากหน้าจอไม่ได้ จึงเป็นสี error · ไม่ใช้คำ "เก็บเข้าคลัง" (ของหน้าบัญชีของฉัน) เพราะสื่อว่ามีที่ให้เอากลับได้ */}
                        <RowIconButton label={`เอาออกจากรายการ ${doc.issuer_name}`} tooltip="เอาออกจากรายการ" color="error" onClick={() => openArchive(doc)}>
                          <PlaylistRemoveRounded fontSize="small" />
                        </RowIconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalCount}
            page={page - 1}
            onPageChange={(_, newPage) => setFilter({ page: String(newPage + 1) }, false)}
            rowsPerPage={LIMIT}
            rowsPerPageOptions={[LIMIT]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count} เอกสาร`}
            getItemAriaLabel={(type) => PAGINATION_ARIA[type] ?? type}
            sx={dataTextSx}
          />
        </>
      )}

      <TaxDocumentUploadModal
        open={uploadOpen}
        taxEntities={entities}
        entitiesLoad={entitiesLoad}
        defaultTaxEntityId={defaultTaxEntityId}
        onClose={() => setUploadOpen(false)}
        onSaved={reload}
        onNotice={setNotice}
      />
      {TAX_GMAIL_IMPORT_ENABLED && (
        <GmailAttachmentPicker
          open={gmailPickerOpen}
          mailboxes={mailboxes}
          taxEntities={entities}
          onClose={() => setGmailPickerOpen(false)}
          onSaved={reload}
          onNotice={setNotice}
        />
      )}
      <TaxDocumentDrawer
        docId={selectedDocId}
        taxEntities={entities}
        entitiesLoad={entitiesLoad}
        onClose={() => setSelectedDocId(null)}
        onSaved={reload}
        onNotice={setNotice}
      />
      <ConfirmDialog
        open={archiveOpen}
        title="เอาเอกสารภาษีออกจากรายการ"
        description={
          <>
            เอาเอกสารของ “{archiving?.issuer_name ?? ''}” ออกจากรายการหรือไม่? ไฟล์ยังเก็บไว้แบบเข้ารหัส แต่ตอนนี้ยังเอากลับมาจากหน้าจอไม่ได้
            {archiveError && <LoadError message={archiveError} />}
          </>
        }
        confirmLabel="เอาออกจากรายการ"
        confirmColor="error"
        busy={archiveBusy}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => void confirmArchive()}
        onExited={() => {
          const after = afterArchiveRef.current;
          afterArchiveRef.current = null;
          if (!after) return;
          setNotice(after.notice);
          const buttons = document.querySelectorAll<HTMLElement>('[data-taxdoc-open]');
          (buttons[Math.min(after.index, buttons.length - 1)] ?? uploadButtonRef.current)?.focus();
        }}
      />
      <FeedbackSnackbar notice={notice} onClose={() => setNotice(null)} />
    </Box>
  );
}
