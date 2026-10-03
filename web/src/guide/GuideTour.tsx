import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Paper, Stack, Typography, useMediaQuery } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { descriptionSx } from '../theme.js';
import type { Guide } from './guides.js';

const CARD_WIDTH = 360;
const GAP = 12;
/** ต้องอยู่เหนือ AppBar/Fab แต่ต่ำกว่า Dialog(1300) และ Snackbar(1400) ของ MUI */
const Z = 1200;

/** `**คำ**` ใน guides.ts = ตัวหนา — ใช้ทั้งการ์ดนี้และหน้า /help (`pages/Help.tsx`) */
export function Emphasis({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}</>;
}

/**
 * Tour ไฮไลต์ทีละขั้น เขียนด้วย MUI ล้วน ไม่เพิ่ม dependency
 *
 * ไฮไลต์ทำด้วย `box-shadow` spread ใหญ่จนคลุมทั้งจอ (เป็นวิธีเดียวที่ได้ "รูโหว่" ในฉากมืด
 * โดยไม่ต้องวาด 4 กล่องล้อมรอบ) ตัวกล่องนี้ `pointerEvents: none` ส่วนการบล็อกคลิกอยู่ที่ชั้นล่าง
 * แยกกัน — tour เป็นการอ่าน ไม่ใช่การให้กดของจริงตามไปด้วย
 *
 * ขั้นที่หา element ไม่เจอจะถูกกรองออกตอนเปิด (บางส่วนของหน้าขึ้นเฉพาะเมื่อมีข้อมูล)
 * selector ที่เพี้ยนไปในอนาคตจึงทำให้ขั้นนั้นหายไปเงียบ ๆ ไม่ใช่ทำให้ tour พัง
 */
export function GuideTour({ guide, onClose }: { guide: Guide; onClose: () => void }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const isNarrow = useMediaQuery('(max-width: 599px)');
  // กรองครั้งเดียวตอนเปิด — ไม่คำนวณใหม่ระหว่างเดิน ไม่งั้นจำนวนขั้นเปลี่ยนกลางทางแล้ว index เพี้ยน
  const [steps] = useState(() =>
    guide.steps.filter((s) => !s.selector || document.querySelector(s.selector) != null),
  );
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardHeight, setCardHeight] = useState(200);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[index];

  const measure = useCallback(() => {
    const el = step?.selector ? document.querySelector(step.selector) : null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  // เลื่อนหา element ก่อนวัด แล้ววัดซ้ำหลัง smooth scroll จบ (ไม่มี event ที่รองรับทุกเบราว์เซอร์)
  useEffect(() => {
    const el = step?.selector ? document.querySelector(step.selector) : null;
    el?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    measure();
    const timer = window.setTimeout(measure, 400);
    return () => window.clearTimeout(timer);
  }, [step, measure, reduceMotion]);

  useEffect(() => {
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight;
    if (h && h !== cardHeight) setCardHeight(h);
  }, [index, rect, cardHeight]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1 < steps.length ? i + 1 : i));
  }, [steps.length]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const isLast = index === steps.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') isLast ? onClose() : next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, onClose, isLast]);

  if (!step) return null;

  // มือถือ: ตรึงการ์ดไว้ล่างจอเสมอ คำนวณตำแหน่งตามกล่องบนจอแคบแล้วมักบังตัวที่ไฮไลต์เอง
  const cardPosition = isNarrow
    ? { left: GAP, right: GAP, bottom: GAP }
    : rect == null
      ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
      : {
          top: window.innerHeight - rect.bottom > cardHeight + GAP * 2
            ? rect.bottom + GAP
            : Math.max(GAP, rect.top - cardHeight - GAP),
          left: Math.min(
            Math.max(GAP, rect.left),
            Math.max(GAP, window.innerWidth - CARD_WIDTH - GAP),
          ),
        };

  return (
    <>
      {/* ชั้นบล็อกคลิก — คลิกที่ไหนก็ปิด tour (ทางออกที่เดาได้เสมอ) */}
      <Box
        onClick={onClose}
        sx={{ position: 'fixed', inset: 0, zIndex: Z, bgcolor: rect ? 'transparent' : 'brand.scrim' }}
      />
      {rect && (
        <Box
          aria-hidden
          sx={(theme) => ({
            position: 'fixed',
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: '10px',
            outline: `2px solid ${theme.vars.palette.brand.ring}`,
            // ฉากหรี่ตามธีม (brand.scrim ใน theme.ts) — ชุดเดียวกับชั้นบล็อกคลิกด้านบนตอนไม่มีไฮไลต์
            boxShadow: `0 0 0 9999px ${theme.vars.palette.brand.scrim}`,
            pointerEvents: 'none',
            zIndex: Z + 1,
            // ตั้งใจไม่ใส่ transition: ตำแหน่งถูกเซ็ตใหม่ทุก scroll event ถ้าใส่ transition กรอบไฮไลต์
            // จะวิ่งตามหลังหน้าจอตอนเลื่อน (และเป็นการ animate ค่าที่ทำให้ layout คำนวณใหม่)
            // ความรู้สึกว่ามีการเคลื่อนไหวมาจาก smooth scroll ตอนเปลี่ยนขั้นอยู่แล้ว
          })}
        />
      )}
      <Paper
        ref={cardRef}
        variant="outlined"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-step-title"
        elevation={8}
        sx={{
          position: 'fixed',
          ...cardPosition,
          width: isNarrow ? 'auto' : CARD_WIDTH,
          maxWidth: `calc(100vw - ${GAP * 2}px)`,
          p: 2.5,
          zIndex: Z + 2,
          boxShadow: 8,
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                {guide.title} · ขั้นที่ {index + 1} จาก {steps.length}
              </Typography>
              <Typography component="h2" variant="h2" id="guide-step-title" sx={{ mt: 0.5 }}>
                {step.title}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onClose} aria-label="ปิดคู่มือ"><CloseRounded /></IconButton>
          </Stack>

          <Typography color="text.secondary" sx={descriptionSx}><Emphasis text={step.body} /></Typography>

          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', pt: 0.5 }}>
            {index > 0 && <Button color="inherit" onClick={back}>ย้อนกลับ</Button>}
            <Button variant="contained" onClick={isLast ? onClose : next} autoFocus>
              {isLast ? 'จบคู่มือ' : 'ต่อไป'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </>
  );
}
