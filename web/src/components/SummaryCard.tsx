import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Box, ButtonBase, IconButton, Paper, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { dataTextSx, radii } from '../theme.js';

type SummaryCardProps = {
  title: string;
  icon?: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  /** การ์ดที่เป็นทางไปหน้าอื่น — path ของ router (เป็นลิงก์จริง กดกลาง/เปิดแท็บใหม่ได้) หรือ `#id` ในหน้าเดียวกัน */
  to?: string;
  /** action ที่ไม่ใช่การนำทาง (หน้าภาษียังใช้อยู่) — นำทางให้ใช้ `to` */
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  /** ข้อมูลยังไม่มา: คงหัวการ์ดไว้ แทนตัวเลขด้วย skeleton — เปลี่ยนเดือนแล้ว layout ไม่กระโดด */
  loading?: boolean;
  // การ์ดแถวละ 5 ใบ (หน้าวางแผน) — padding/ตัวเลขเล็กลง และ caption ย้ายไปอยู่ใน tooltip ของปุ่ม ⓘ
  // ไม่งั้นคำอธิบายยาว ๆ ดันการ์ดใบนั้นสูงกว่าเพื่อนทั้งแถว
  dense?: boolean;
  /** dense แต่ caption สั้นและต้องเห็นทันที (เช่น "ณ วันที่") — แสดงเป็นบรรทัดแทนปุ่ม ⓘ */
  captionInline?: boolean;
};

// แถวการ์ดสรุป: ≥ md อยู่บรรทัดเดียวเสมอ (การ์ดหดแทนการตกบรรทัดเหลือใบเดียว) / มือถือ 2 คอลัมน์
// และใบสุดท้ายที่เหลือเศษกินเต็มแถว — minmax(0, 1fr) ไม่ใช่ 1fr เฉย ๆ เพราะ 1fr มี min เป็น auto
// ยอดเงินยาว ๆ จะดันคอลัมน์จนล้นจอ 320px · แถว 5 ใบขึ้นไปใช้ dense ไม่งั้นที่ 900px การ์ดแคบเกินตัวเลข
// count ต้องตรงกับจำนวนการ์ดที่ render จริง — การ์ดเป็นได้ทั้ง div/a/button จึงนับจาก count ไม่ใช่ nth-of-type
export function summaryRowSx(count: number) {
  return {
    display: 'grid',
    gap: { xs: 1.5, md: 2 },
    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${count}, minmax(0, 1fr))` },
    '& > :last-child': { gridColumn: { xs: count % 2 === 1 ? 'span 2' : 'auto', md: 'auto' } },
  };
}

// แต่ละการ์ดกิน 3 แถวของ grid แม่ (หัว / ตัวเลข / คำอธิบาย) แบบ subgrid ทั้งตัวการ์ดและกล่องข้างใน — ตัวเลขทุกใบ
// ในแถวเดียวกันจึงอยู่บรรทัดเดียวกันเสมอ แม้หัวบางใบตัดหลายบรรทัด (dense ที่ 900px หัวกว้าง ~70px) หรือบางใบไม่มีคำอธิบาย
// นอก summaryRowSx subgrid ไม่มีผล การ์ดเรียงสามบรรทัดตามปกติ
const cardGridSx = { display: 'grid', gridRow: 'span 3', gridTemplateRows: 'subgrid', minWidth: 0 } as const;

// การ์ดสรุปตัวเดียว ไม่ซ้อน Paper ใน Paper (Don't ของ DESIGN.md) — value ผ่าน dataTextSx เสมอ
// (ตัวเลข/เงินตาม Financial Clarity Rule) ต่างจาก title/caption ที่เป็นคำอธิบาย
export default function SummaryCard({ title, icon, value, caption, to, onClick, disabled, disabledReason, loading = false, dense = false, captionInline = false }: SummaryCardProps) {
  const interactive = !disabled && !loading && (to != null || onClick != null);
  // ไม่ใส่ปุ่ม ⓘ ในการ์ดที่กดได้ทั้งใบ (button ซ้อน button ผิด HTML) — ใช้ caption เป็นบรรทัดตามเดิม
  const captionAsTip = dense && !captionInline && caption != null && !disabled && !loading && !interactive;
  const content = (
    // rowGap ของ subgrid ทับ gap ของแถวการ์ด (12/16px) ระยะหัว → ตัวเลข → คำอธิบายจึงเป็น 6px เท่าเดิม
    <Box sx={{ ...cardGridSx, rowGap: 0.75, alignItems: 'start', p: dense ? 2 : { xs: 2, sm: 3 }, textAlign: 'left' }}>
      {/* useFlexGap: Stack แบบ margin (ค่าเริ่มต้น) รีเซ็ต margin ของลูกทุกตัวด้วย selector ที่ชนะ sx
          margin ติดลบของปุ่ม ⓘ ด้านล่างจึงหายเงียบ ๆ แล้วปุ่ม 40px ดันการ์ดที่มี caption ให้ตัวเลขต่ำกว่าใบอื่น */}
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', color: 'text.secondary' }}>
        {icon}
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
        {captionAsTip && (
          // enterTouchDelay 0: บนมือถือแตะครั้งเดียวต้องเห็นคำอธิบาย ไม่ใช่ต้องกดค้าง
          // margin ติดลบให้ปุ่ม 40px (พื้นที่กดยังครบ) ไม่ดันแถวหัวการ์ดให้สูงขึ้น
          <Tooltip title={caption} enterTouchDelay={0} leaveTouchDelay={4000}>
            <IconButton size="small" aria-label={typeof caption === 'string' ? caption : title} sx={{ my: -1.25, ml: -0.5 }}>
              <InfoOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {/* ลูกศรบอกว่าการ์ดนี้พาไปดูรายการต่อได้ — แยกการ์ดกดได้/กดไม่ได้โดยไม่ต้อง hover */}
        {interactive && <ChevronRightRounded fontSize="small" aria-hidden sx={{ ml: 'auto', flexShrink: 0 }} />}
      </Stack>
      <Box
        sx={{
          ...dataTextSx,
          lineHeight: 1.3,
          overflowWrap: 'anywhere',
          // ขั้น Data Display ของ DESIGN.md — ไม่ dense ก็อยู่ 2 คอลัมน์บนมือถือ / 4 ใบที่ 900px 1.75rem ล้นการ์ดถ้าไม่ย่อลง
          // dense ที่ md 1.125rem (การ์ด 5 ใบที่ 900px เหลือที่ให้ตัวเลขราว 125px) ที่ lg 1.5rem (ราว 185px)
          fontSize: dense ? { xs: '1.25rem', md: '1.125rem', lg: '1.5rem' } : { xs: '1.25rem', sm: '1.5rem', lg: '1.75rem' },
        }}
      >
        {loading ? <Skeleton width="60%" /> : disabled ? '—' : value}
      </Box>
      {!loading && ((caption != null && !captionAsTip) || (disabled && disabledReason)) && (
        <Typography variant="body2" color="text.secondary">
          {disabled ? disabledReason : caption}
        </Typography>
      )}
    </Box>
  );

  if (disabled) {
    // เส้นประแทน opacity ทั้งใบ — opacity ลด contrast ของ text.secondary ที่ผ่าน WCAG AA อยู่แล้วให้ต่ำกว่าเกณฑ์
    return (
      <Paper variant="outlined" sx={{ ...cardGridSx, borderStyle: 'dashed' }}>
        {content}
      </Paper>
    );
  }

  if (interactive) {
    // ButtonBase เป็นตัวการ์ดเอง (ไม่ใช่ Paper) เพื่อให้เป็น <a> ได้ — จึงต้องใส่หน้าตา outlined Paper คืนเอง
    // hover ไม่เปลี่ยนพื้น (พื้น accent ของธีมมืดทำตัวเลขเหลือ 1.04:1) แต่ยกการ์ดขึ้น: เลื่อน -2px แล้วยืดเงา hard offset
    // จาก 3px เป็น 5px เงาจึงอยู่ที่เดิม สีเงาของ Bubblegum = divider ทั้งสองโหมด — ตัวอักษรคง contrast ตอนปกติ
    const sx: SxProps<Theme> = {
      ...cardGridSx,
      // ButtonBase จัดลูกไว้กลาง (inline-flex) — ต้อง stretch ไม่งั้นกล่องข้างในไม่กินเต็ม 3 แถว
      alignItems: 'stretch',
      justifyContent: 'stretch',
      width: '100%',
      border: 1,
      borderColor: 'divider',
      borderRadius: `${radii.xl}px`,
      bgcolor: 'background.paper',
      boxShadow: (theme) => theme.vars.shadows[1],
      transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      // focus ring มาจาก theme.focusVisible ของ ButtonBase ซึ่งตั้ง box-shadow ของมันเองทับเงาการ์ด — คืน hard offset
      // ไว้ก่อน &:hover เพื่อให้ตอน hover พร้อม focus เงา 5px ยังชนะ
      '&.Mui-focusVisible': { boxShadow: (theme) => theme.vars.shadows[1] },
      '&:hover': {
        transform: 'translate(-2px, -2px)',
        boxShadow: (theme) => `5px 5px 0 0 ${theme.vars.palette.divider}`,
      },
      '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
    };
    if (to != null && to.startsWith('#')) return <ButtonBase href={to} sx={sx}>{content}</ButtonBase>;
    if (to != null) return <ButtonBase component={Link} to={to} sx={sx}>{content}</ButtonBase>;
    return <ButtonBase onClick={onClick} sx={sx}>{content}</ButtonBase>;
  }

  return <Paper variant="outlined" sx={cardGridSx}>{content}</Paper>;
}
