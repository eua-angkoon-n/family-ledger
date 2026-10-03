import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Link, Paper, Stack, TextField, Typography,
} from '@mui/material';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import PrintRounded from '@mui/icons-material/PrintRounded';
import SearchOffRounded from '@mui/icons-material/SearchOffRounded';
import UnfoldLessRounded from '@mui/icons-material/UnfoldLessRounded';
import UnfoldMoreRounded from '@mui/icons-material/UnfoldMoreRounded';
import { TAX_PAGES_ENABLED } from '../features.js';
import { Emphasis } from '../guide/GuideTour.js';
import { GUIDES, helpSections, type HelpSection as Section } from '../guide/guides.js';
import { descriptionSx } from '../theme.js';
import { EmptyState, PageHeader, useHashTarget } from '../ui.js';

const SCHEME_ATTR = 'data-mui-color-scheme';
const bodySx = { mt: 0.5, maxWidth: '75ch', color: 'text.secondary', ...descriptionSx } as const;

/** ข้อ ๆ ที่คั่นด้วย " · " ใน guides.ts เป็นรายการ — ขั้นยาวอ่านไล่ทีละข้อได้ (ใน tour ยังเป็นย่อหน้าเดียว) */
function StepBody({ text }: { text: string }) {
  const items = text.split(' · ');
  if (items.length === 1) return <Typography sx={bodySx}><Emphasis text={text} /></Typography>;
  return (
    <Box component="ul" sx={{ ...bodySx, mb: 0, pl: 2.5, '& > li + li': { mt: 0.5 } }}>
      {items.map((item) => <li key={item}><Emphasis text={item} /></li>)}
    </Box>
  );
}

/**
 * หนึ่งหน้าของระบบ = หนึ่งส่วน id = path ไม่มี "/" (ลิงก์ `/help#planning`) · หัวข้อ h3 (heading ของ Accordion) ห่อปุ่มที่ชื่อ
 * = ชื่อหน้าเท่านั้น คำอธิบายหน้าเป็น aria-describedby — ไม่ใช่ชื่อปุ่มยาวทั้งประโยค
 */
function HelpSection({ section, expanded, onToggle, sectionRef }: {
  section: Section;
  expanded: boolean;
  onToggle: (open: boolean) => void;
  sectionRef?: RefObject<HTMLDivElement>;
}) {
  const { path, guide, steps } = section;
  const id = path.slice(1);
  return (
    <Accordion
      ref={sectionRef}
      id={id}
      expanded={expanded}
      onChange={(_, open) => onToggle(open)}
      disableGutters
      variant="outlined"
      sx={{ '&:before': { display: 'none' }, scrollMarginTop: 80 }}
    >
      {/* region ของ Accordion ได้ id = aria-controls และ aria-labelledby = id ของ summary เอง */}
      <AccordionSummary
        id={`${id}-summary`}
        aria-controls={`${id}-content`}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-purpose`}
        expandIcon={<ExpandMoreRounded />}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" id={`${id}-title`} sx={{ display: 'block', fontWeight: 600 }}>{guide.title}</Typography>
          <Typography component="span" id={`${id}-purpose`} color="text.secondary" sx={{ display: 'block', mt: 0.5, ...descriptionSx }}>
            {guide.purpose}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2.5}>
          {steps.map((step) => (
            <Box key={step.title} sx={{ breakInside: 'avoid' }}>
              <Typography component="h4" sx={{ fontWeight: 600 }}>{step.title}</Typography>
              <StepBody text={step.body} />
            </Box>
          ))}
          <Box sx={{ displayPrint: 'none' }}>
            <Button component={RouterLink} to={path} variant="outlined" size="small">ไปที่หน้า{guide.title}</Button>
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

/**
 * คู่มือรวมทุกหน้า — เนื้อหาชุดเดียวกับปุ่มคู่มือในแต่ละหน้า (`web/src/guide/guides.ts`)
 * ต่างกันแค่วิธีอ่าน: ที่นี่อ่านต่อเนื่อง ค้นหาได้ และพิมพ์ได้ ในหน้าจริงคือไฮไลต์ทีละขั้น
 *
 * พิมพ์ด้วย `window.print()` (ไม่เพิ่ม PDF library) — ทั้งปุ่มและ Ctrl+P: CSS `@media print` กางทุกส่วนที่แสดงอยู่
 * (กดพับไว้ก็พิมพ์ออก ส่วน state ไม่ถูกแตะ จึงไม่ต้องรอ React render ก่อนเบราว์เซอร์จับภาพ) และ beforeprint/afterprint
 * สลับเป็นสีธีมสว่างชั่วคราว ตัวอักษรของธีมมืดจึงไม่จางบนกระดาษขาว · ค้นหาค้างอยู่ = พิมพ์เฉพาะที่ค้นเจอ พร้อมบรรทัดบอก
 */
export default function Help({ isAdmin }: { isAdmin: boolean }) {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const term = query.trim();
  const groups = helpSections(isAdmin, query);
  const sections = groups.flatMap((g) => g.sections);
  const stepCount = sections.reduce((n, s) => n + s.steps.length, 0);

  // ลิงก์ /help#<path> — กางส่วนนั้น แล้ว useHashTarget เลื่อนมาและ focus ปุ่มหัวข้อ ครั้งเดียวต่อ navigation
  // (เรียกที่นี่ที่เดียว ไม่ใช่ในแต่ละส่วน: ค้นหาจนส่วนนั้นหายแล้วกลับมา จะไม่ถูกดึงจอ/focus กลับไปอีก)
  const hashPath = '/' + location.hash.slice(1);
  const hashRef = useRef<HTMLDivElement>(null);
  useHashTarget(location.hash, sections.some((s) => s.path === hashPath), hashRef, `${hashPath.slice(1)}-summary`);
  useEffect(() => {
    if (GUIDES[hashPath]) setOpen((prev) => new Set(prev).add(hashPath));
  }, [location.key]);

  useEffect(() => {
    const root = document.documentElement;
    let scheme: string | null = null;
    const before = () => {
      scheme = root.getAttribute(SCHEME_ATTR);
      root.setAttribute(SCHEME_ATTR, 'light');
    };
    const after = () => {
      if (scheme) root.setAttribute(SCHEME_ATTR, scheme);
      scheme = null;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      after();
    };
  }, []);

  // พิมพ์คำค้น = กางทุกส่วนที่ค้นเจอ (กดพับทีละส่วนได้ตามปกติ) ล้างคำค้นแล้วส่วนที่กางไว้คงอยู่
  const search = (value: string) => {
    setQuery(value);
    if (value.trim()) setOpen(new Set(helpSections(isAdmin, value).flatMap((g) => g.sections.map((s) => s.path))));
  };
  const clearSearch = () => {
    setQuery('');
    searchRef.current?.focus(); // ปุ่มที่กดหายไปพร้อมผลว่าง — focus กลับช่องค้นหา
  };
  const toggle = (path: string, next: boolean) => setOpen((prev) => {
    const set = new Set(prev);
    if (next) set.add(path);
    else set.delete(path);
    return set;
  });

  return (
    <Box
      sx={{
        '@media print': {
          // Collapse ของส่วนที่พับอยู่สูง 0 + visibility hidden (inline style ระหว่าง transition จึงต้อง !important)
          '& .MuiCollapse-root': { height: 'auto !important', visibility: 'visible !important' },
          '& .MuiAccordionSummary-expandIconWrapper': { display: 'none' },
        },
      }}
    >
      <PageHeader
        level={1}
        id="help-heading"
        title="คู่มือการใช้งาน"
        description="อธิบายการใช้งานทุกหน้า ตั้งแต่ตั้งค่าบัญชีธนาคารเป็นต้นไป · ในแต่ละหน้ายังมีปุ่มคู่มือ (?) ข้างชื่อหน้า กดแล้วจะไฮไลต์ทีละขั้นบนหน้าจอจริง"
        action={
          <Button variant="outlined" startIcon={<PrintRounded />} onClick={() => window.print()} sx={{ whiteSpace: 'nowrap', displayPrint: 'none' }}>
            พิมพ์คู่มือ
          </Button>
        }
      />

      <Box sx={{ mt: 3, displayPrint: 'none' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap sx={{ alignItems: { sm: 'center' }, flexWrap: 'wrap' }}>
          <TextField
            type="search"
            size="small"
            label="ค้นหาในคู่มือ"
            placeholder="เช่น ดึงอีเมล, รายการประจำ"
            value={query}
            onChange={(event) => search(event.target.value)}
            inputRef={searchRef}
            sx={{ flex: { sm: '1 1 18rem' }, maxWidth: { sm: 400 } }}
          />
          <Stack direction="row" spacing={1}>
            <Button color="inherit" startIcon={<UnfoldMoreRounded />} onClick={() => setOpen(new Set(sections.map((s) => s.path)))}>
              กางทั้งหมด
            </Button>
            <Button color="inherit" startIcon={<UnfoldLessRounded />} onClick={() => setOpen(new Set())}>
              พับทั้งหมด
            </Button>
          </Stack>
        </Stack>
        {/* mount ตลอด screen reader จึงประกาศทุกครั้งที่ผลเปลี่ยน */}
        <Typography role="status" variant="body2" color="text.secondary" sx={{ mt: term ? 1 : 0 }}>
          {!term ? '' : sections.length > 0 ? `พบ ${stepCount} ขั้นใน ${sections.length} หน้า` : `ไม่พบ “${term}” ในคู่มือ`}
        </Typography>
      </Box>
      {term && sections.length > 0 && (
        <Typography sx={{ display: 'none', displayPrint: 'block', mt: 2 }}>เฉพาะส่วนที่มีคำว่า “{term}”</Typography>
      )}

      {sections.length === 0 && (
        <EmptyState
          headingLevel={2}
          icon={<SearchOffRounded sx={{ fontSize: 40 }} />}
          title="ไม่พบในคู่มือ"
          description={`ไม่มีหน้าหรือขั้นไหนที่มีคำว่า “${term}” ลองคำที่สั้นลง หรือคำที่เห็นบนปุ่มในหน้านั้น`}
          action={<Button variant="outlined" onClick={clearSearch}>ล้างคำค้นหา</Button>}
        />
      )}

      {groups.map((group) => (
        <Box key={group.id} sx={{ mt: 4 }}>
          <Typography component="h2" variant="h2" sx={{ mb: 1.5 }}>{group.title}</Typography>
          {group.id === 'start' && !term && (
            <Paper variant="outlined" sx={{ mb: 2, p: { xs: 2, sm: 3 }, breakInside: 'avoid' }}>
              <Typography component="h3" sx={{ fontWeight: 600 }}>ใช้งานครั้งแรก {TAX_PAGES_ENABLED ? 4 : 3} ขั้น</Typography>
              <Stack component="ol" spacing={1} sx={{ mt: 1, mb: 0, pl: 3, ...descriptionSx, color: 'text.secondary' }}>
                <li>
                  ไปที่ <Link component={RouterLink} to="/accounts">บัญชีของฉัน</Link> เพิ่มบัญชีธนาคาร
                  พร้อมรหัสผ่านที่ใช้เปิดไฟล์ PDF ของ statement
                </li>
                <li>รอสักครู่ให้ระบบไล่อ่านอีเมลย้อนหลัง แล้วดูที่ <Link component={RouterLink} to="/dashboard">แดชบอร์ด</Link> ว่าข้อมูลเข้าครบถึงเดือนไหน</li>
                <li>ไปที่ <Link component={RouterLink} to="/transactions">ธุรกรรม</Link> จัดหมวดและยืนยันคู่โอน เพื่อให้รายงานตรงกับความจริง</li>
                {TAX_PAGES_ENABLED && (
                  <li>
                    ถ้าต้องใช้เรื่องภาษี ให้เก็บใบเสร็จไว้ที่ <Link component={RouterLink} to="/tax-documents">เอกสารภาษี</Link>
                    {' '}แล้วดูประมาณการที่หน้า <Link component={RouterLink} to="/tax">ภาษี</Link>
                  </li>
                )}
              </Stack>
            </Paper>
          )}
          {/* กล่องแยกต่อกลุ่ม — มุมโค้งบน/ล่างของ Accordion ใช้ first/last-of-type ในกลุ่มของตัวเอง */}
          <Box>
            {group.sections.map((section) => (
              <HelpSection
                key={section.path}
                section={section}
                expanded={open.has(section.path)}
                onToggle={(next) => toggle(section.path, next)}
                sectionRef={section.path === hashPath ? hashRef : undefined}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
