import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Button, Collapse, IconButton, Paper, Stack, Tooltip, Typography, useMediaQuery, type Theme } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import ExpandLessRounded from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import PaidRounded from '@mui/icons-material/PaidRounded';
import SkipNextRounded from '@mui/icons-material/SkipNextRounded';
import type { PlanItem } from '../api.js';
import { sumPlanTotals } from '../planSelection.js';
import Money from './Money.js';

type Props = {
  /** แถวที่เลือกทั้งหมด รวมแถวที่ตัวกรองซ่อนอยู่ — ยอดรวมต้องตรงกับสิ่งที่ปุ่มจะแตะ ไม่ใช่แค่ที่เห็น */
  items: PlanItem[];
  hiddenCount: number;
  payCount: number;
  skipCount: number;
  deleteCount: number;
  /** เดือนปิดแล้ว หรือกำลังทำงานอยู่ */
  disabled: boolean;
  /** กำลังทำงานแบบกลุ่มของแถบนี้เอง */
  busy: boolean;
  onPay: () => void;
  onSkip: () => void;
  onDelete: () => void;
  onClear: () => void;
};

// ยกแถบให้พ้น VersionBadge มุมล่างขวา (bottom 6/10 สูง ~21px) — จอ < ~1300px แถบกว้างจนถึงมุมนั้น
// ถ้าวางต่ำกว่านี้จะบังเลขเวอร์ชัน (Floating Selection Bar Rule ของ DESIGN.md)
const BAR_BOTTOM = { xs: 32, sm: 36 };
const GAP_ABOVE_BAR = 16;

// แถบลอยเหนือเนื้อหา = Floating Offset (elevation 8) ของ DESIGN.md และยังมี
// เส้นขอบ z-index เท่า appBar: อยู่ใต้ snackbar — ใช้ร่วมกันระหว่างหน้าวางแผนและหน้าธุรกรรม (Floating Selection Bar Rule)
export function FloatingSelectionBar({ label, children }: { label: string; children: ReactNode }) {
  // ความสูงจริงของแถบ (ตัดขึ้น 2–3 แถวที่ 900–1200px และสูงขึ้นตอนกางบนมือถือ) — ตัวเว้นที่ท้ายหน้า
  // ต้องสูงตาม ไม่งั้นแถวสุดท้ายของตารางเลื่อนขึ้นมาพ้นแถบไม่ได้
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  useEffect(() => {
    const node = barRef.current;
    if (node == null) return;
    const observer = new ResizeObserver(() => setBarHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* ตัวเว้นท้ายหน้าเท่าแถบ + ระยะจากขอบล่าง + ช่องไฟ — แถวสุดท้ายเลื่อนขึ้นมาพ้นแถบได้เสมอ */}
      <Box
        aria-hidden
        sx={{
          height: {
            xs: barHeight + BAR_BOTTOM.xs + GAP_ABOVE_BAR,
            sm: barHeight + BAR_BOTTOM.sm + GAP_ABOVE_BAR,
          },
        }}
      />
      <Paper
        ref={barRef}
        elevation={8}
        role="region"
        aria-label={label}
        sx={{
          position: 'fixed',
          bottom: BAR_BOTTOM,
          left: '50%',
          transform: 'translateX(-50%)',
          // กว้างเท่าเนื้อหาใน Container lg (1200 − gutter 24 × 2) ให้ขอบแถบตรงกับขอบตาราง
          width: (theme) => `min(100% - 32px, ${theme.breakpoints.values.lg}px - ${theme.spacing(6)})`,
          zIndex: (theme) => theme.zIndex.appBar,
          border: 1,
          borderColor: 'divider',
          p: 2,
        }}
      >
        {children}
      </Paper>
    </>
  );
}

export default function PlanSelectionBar(props: Props) {
  const { items, hiddenCount, payCount, skipCount, deleteCount, disabled, busy, onPay, onSkip, onDelete, onClear } = props;
  const desktop = useMediaQuery((theme: Theme) => theme.breakpoints.up('md'), { noSsr: true });
  const [expanded, setExpanded] = useState(false);

  const totals = sumPlanTotals(items);
  const available = <Money satang={totals.available} tone={totals.available < 0 ? 'expense' : 'income'} />;

  const figures = (
    <Box
      component="dl"
      sx={{ m: 0, display: 'grid', columnGap: 3, rowGap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, auto)' } }}
    >
      {(
        [
          ['รายได้', <Money satang={totals.income} tone="income" />],
          ['รายการหัก', <Money satang={totals.deduction} />],
          ['ค่าใช้จ่าย', <Money satang={totals.expense} tone="expense" />],
          ['เงินกันไว้', <Money satang={totals.reserve} />],
          ['เงินเหลือใช้', available],
        ] as const
      ).map(([label, value]) => (
        <Box key={label} sx={{ minWidth: 0 }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Box component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
            {value}
          </Box>
        </Box>
      ))}
    </Box>
  );

  // มือถือ: ไม่มีไอคอน ป้ายสั้นลง ปุ่มยืดเต็มแถว ให้ 3 ปุ่มพอดีแถวเดียวที่จอ 320px (ยาวเกินค่อยตัดลงแถวใหม่)
  const compact = !desktop;
  const actionSx = compact ? { flex: '1 1 auto', px: 1, whiteSpace: 'nowrap' } : { whiteSpace: 'nowrap' };
  const actions = (
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
      <Button
        variant="contained"
        startIcon={compact ? undefined : <PaidRounded />}
        disabled={disabled || payCount === 0}
        onClick={onPay}
        sx={actionSx}
      >
        {compact ? 'จ่าย' : 'จ่ายแล้ว'} ({payCount})
      </Button>
      <Button
        variant="outlined"
        color="inherit"
        startIcon={compact ? undefined : <SkipNextRounded />}
        disabled={disabled || skipCount === 0}
        onClick={onSkip}
        sx={actionSx}
      >
        ข้าม ({skipCount})
      </Button>
      <Button
        variant="outlined"
        color="error"
        startIcon={compact ? undefined : <DeleteOutlineRounded />}
        disabled={disabled || deleteCount === 0}
        onClick={onDelete}
        sx={actionSx}
      >
        ลบ ({deleteCount})
      </Button>
      {!compact && (
        <Button color="inherit" disabled={busy} onClick={onClear} sx={actionSx}>
          ล้างที่เลือก
        </Button>
      )}
    </Stack>
  );

  const hidden = hiddenCount > 0 && (
    <Typography variant="body2" color="text.secondary">
      ({hiddenCount} รายการถูกซ่อนโดยตัวกรอง)
    </Typography>
  );
  const busyText = busy ? ' · กำลังดำเนินการ…' : '';

  return (
    <FloatingSelectionBar label="รายการที่เลือก">
      {desktop ? (
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography role="status" sx={{ fontWeight: 600 }}>
              เลือก {items.length} รายการ{busyText}
            </Typography>
            {hidden}
          </Box>
          {figures}
          {actions}
        </Stack>
      ) : (
        // พับได้เฉพาะยอดรวม 5 ช่อง — ปุ่มจัดการต้องเห็นตลอดแม้แถบพับอยู่
        <>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography role="status" sx={{ fontWeight: 600 }}>
                เลือก {items.length} · เหลือ {available}
                {busyText}
              </Typography>
              {hidden}
            </Box>
            {/* span: Tooltip ของ MUI ฟัง event จากปุ่มที่ disabled ไม่ได้ (ท่าเดียวกับปุ่มออกจากระบบใน App.tsx) */}
            <Tooltip title="ล้างที่เลือก">
              <span>
                <IconButton aria-label="ล้างที่เลือก" disabled={busy} onClick={onClear}>
                  <CloseRounded />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton
              aria-label="ยอดรวมของรายการที่เลือก"
              aria-expanded={expanded}
              aria-controls="plan-selection-details"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ExpandMoreRounded /> : <ExpandLessRounded />}
            </IconButton>
          </Stack>
          {/* ระยะห่างเป็น padding ข้างใน Collapse ไม่ใช่ spacing ของ Stack — ตอนพับจะได้ไม่เหลือช่องว่างค้าง */}
          <Collapse in={expanded}>
            <Box id="plan-selection-details" sx={{ pt: 1.5 }}>
              {figures}
            </Box>
          </Collapse>
          <Box sx={{ pt: 1.5 }}>{actions}</Box>
        </>
      )}
    </FloatingSelectionBar>
  );
}
