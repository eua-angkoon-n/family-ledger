import type { ReactNode } from 'react';
import { Box, ButtonBase, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { dataTextSx } from '../theme.js';

type SummaryCardProps = {
  title: string;
  icon?: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  // การ์ดแถวละ 5 ใบ (หน้าวางแผน) — padding/ตัวเลขเล็กลง และ caption ย้ายไปอยู่ใน tooltip ของปุ่ม ⓘ
  // ไม่งั้นคำอธิบายยาว ๆ ดันการ์ดใบนั้นสูงกว่าเพื่อนทั้งแถว
  dense?: boolean;
};

// การ์ดสรุปตัวเดียว ไม่ซ้อน Paper ใน Paper (Don't ของ DESIGN.md) — value ผ่าน dataTextSx เสมอ
// (ตัวเลข/เงินตาม Financial Clarity Rule) ต่างจาก title/caption ที่เป็นคำอธิบาย
export default function SummaryCard({ title, icon, value, caption, onClick, disabled, disabledReason, dense = false }: SummaryCardProps) {
  // ไม่ใส่ปุ่ม ⓘ ในการ์ดที่กดได้ทั้งใบ (button ซ้อน button ผิด HTML) — ใช้ caption เป็นบรรทัดตามเดิม
  const captionAsTip = dense && caption != null && !disabled && !onClick;
  // dense: ตัวเลขชิดล่างการ์ด (mt auto) — หัวการ์ดที่ตัดเป็น 2 บรรทัดจะไม่ดันตัวเลขให้ต่ำกว่าใบอื่นในแถวเดียวกัน
  // ต้องใช้ useFlexGap ด้วย เหตุผลเดียวกับแถวหัวการ์ด (Stack แบบ margin ลบ mt ของลูกทิ้ง) และการ์ดต้องสูงเต็มช่อง grid
  const content = (
    <Stack spacing={0.75} useFlexGap={dense} sx={{ p: dense ? 2 : 3, textAlign: 'left', height: '100%' }}>
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
      </Stack>
      <Box
        sx={{
          ...dataTextSx,
          lineHeight: 1.3,
          ...(dense
            ? { fontSize: { xs: '1.25rem', md: '1.125rem', lg: '1.25rem' }, overflowWrap: 'anywhere', mt: 'auto' }
            : { fontSize: '1.75rem' }),
        }}
      >
        {disabled ? '—' : value}
      </Box>
      {((caption != null && !captionAsTip) || (disabled && disabledReason)) && (
        <Typography variant="body2" color="text.secondary">
          {disabled ? disabledReason : caption}
        </Typography>
      )}
    </Stack>
  );

  // ใบ dense สูงเต็มช่อง grid ให้ height 100% ของ Stack ข้างในมีความหมาย (ตัวเลขชิดล่างได้จริง)
  const fill = dense ? { height: '100%' } : {};

  if (disabled) {
    // เส้นประแทน opacity ทั้งใบ — opacity ลด contrast ของ text.secondary ที่ผ่าน WCAG AA อยู่แล้วให้ต่ำกว่าเกณฑ์
    return (
      <Paper variant="outlined" sx={{ borderStyle: 'dashed', minWidth: 0, ...fill }}>
        {content}
      </Paper>
    );
  }

  if (onClick) {
    return (
      <ButtonBase
        component={Paper}
        variant="outlined"
        onClick={onClick}
        sx={{
          display: 'block',
          width: '100%',
          minWidth: 0,
          ...fill,
          borderRadius: '10px',
          // ButtonBase รีเซ็ตพื้นเป็น transparent ทับพื้นของ Paper — การ์ดที่กดได้ต้องใส่ paper คืนเอง
          bgcolor: 'background.paper',
          transition: 'background-color 200ms',
          '&:hover': { bgcolor: 'action.hover' },
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}
      >
        {content}
      </ButtonBase>
    );
  }

  return <Paper variant="outlined" sx={{ minWidth: 0, ...fill }}>{content}</Paper>;
}
