import { alpha, createTheme, type Shadows } from '@mui/material/styles';

// ธีมทั้งชุด (สี ฟอนต์ รัศมีมุม เงา) มาจาก tweakcn "Bubblegum" (https://tweakcn.com/r/themes/bubblegum.json)
// ค่า oklch ในไฟล์ต้นทางแปลงเป็น hex (sRGB, gamut-mapped) เพราะ MUI palette อ่าน oklch() ไม่ได้
// ยกเว้น (1) income/expense/warning ซึ่งไม่มีในธีม — เลือกเองให้ผ่าน AA และ (2) สีตัวอักษร/ขอบช่องกรอก/focus ring
// ที่ปรับให้ผ่าน AA ตามที่ผู้ใช้อนุมัติ 2026-10-02 (รายการด้านล่าง) — พื้น การ์ด เงา เส้นขอบตกแต่ง และสีกราฟยังตรงธีม

// token ที่ MUI palette ไม่มีช่องให้ — ใช้ผ่าน theme.vars.palette.brand.* (ได้ CSS var ตามธีมที่ใช้อยู่)
// ห้ามส่งค่าใน brand ผ่าน theme.alpha(): มันแปลงเป็น var(--…Channel) ซึ่ง MUI สร้างให้แค่ช่องมาตรฐาน
type BrandPalette = {
  popover: string;
  muted: string;
  accent: string;
  accentForeground: string;
  sidebar: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  input: string;
  /** พื้นช่องกรอก: สว่างโปร่งใส, มืด input/30 แบบ shadcn */
  inputBg: string;
  ring: string;
  /** รายจ่าย — แยกจาก error.main (= destructive ของธีม ใช้กับ error/ปุ่มลบ/alert) */
  expense: string;
  /** ฉากหรี่ของ GuideTour (เท่ากับ overlay ของ shadcn: black/50) */
  scrim: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
};

declare module '@mui/material/styles' {
  // ให้ TS รู้ว่า theme.vars มีเสมอ (เปิด cssVariables ด้านล่าง)
  interface CssThemeVariables {
    enabled: true;
  }
  interface Palette {
    brand: BrandPalette;
  }
  interface PaletteOptions {
    brand?: BrandPalette;
  }
}

/*
 * ปรับให้ผ่าน WCAG AA ตามที่ผู้ใช้อนุมัติ 2026-10-02 (ค่าเดิมของ Bubblegum → ค่าใหม่, ratio บน background / card / popover)
 * รายการเดียวกับ DESIGN.md หัวข้อ "Contrast"
 *
 * light
 *   primary (ตัวอักษร/ลิงก์ + พื้นปุ่มหลัก) #d04f99 → #b43481 ... 4.67/4.85/5.61, ขาวบนปุ่ม 3.99 → 5.61
 *   muted-foreground #7a7a7a → #676767 ................... 4.70/4.88/5.65
 *   destructive #f96f70 → #bd373f ........................ 4.62/4.80/5.56, ขาวบนปุ่มลบ 2.79 → 5.56
 *   ring #e670ab → #d15d98 (ต้อง ≥ 3:1) .................. 3.05/3.16/3.66
 *   input (ขอบช่องกรอก) #e4e4e4 → #868686 (ต้อง ≥ 3:1) ... 3.03/3.15/3.65
 * dark
 *   accent-foreground (ตัวอักษรตอน hover บน accent #c67b96) #f3e3ea → #12242e ... 2.54 → 5.06
 *   destructive #e35ea4 → #e66aaa ........................ 5.30/4.67/4.67, destructive-foreground #12242e บนปุ่ม 4.85 → 5.30
 *   input (ขอบช่องกรอก) #20333d → #5d7c90 (ต้อง ≥ 3:1) ... 3.61/3.17/3.17 — พื้นช่องกรอก (inputBg) ยังเป็น #20333d/30 ตามธีม
 *
 * ที่ยังไม่ผ่าน (ผู้ใช้ให้คงสีกราฟตามธีม): ธีมสว่าง chart-1..4 บน card 1.10–2.49 (chart-3 #fbe2a7 = 1.10 แทบมองไม่เห็น;
 * chart-5 #d7488e ผ่าน 3.48), ธีมมืด chart-5 #24272b 1.07 (มองไม่เห็น), chart-4 #175c6c 1.86 — ทุกอนุกรมจึงต้องมี label
 *
 * warning ไม่มีในธีม — เลือกให้ผ่าน AA เป็นตัวอักษรทั้งสองโหมด (alert เตือนและตัวนับปัญหาที่ > 0)
 *   สว่าง #9a4d00: 5.08/5.27/6.10 บน background/card/popover, ขาวบนพื้นนี้ 6.11
 *   มืด #ffa726 (= ค่าเริ่มต้นของ MUI ตั้งไว้ชัด ๆ): 8.18/7.20/7.20, ดำ 87% บนพื้นนี้ 9.16
 */
export const tokens = {
  light: {
    background: '#f6e6ee',
    foreground: '#5b5b5b',
    card: '#fdedc9',
    popover: '#ffffff',
    primary: '#b43481',
    primaryForeground: '#ffffff',
    secondary: '#8acfd1',
    secondaryForeground: '#333333',
    muted: '#b2e1eb',
    mutedForeground: '#676767',
    accent: '#fbe2a7',
    accentForeground: '#333333',
    destructive: '#bd373f',
    destructiveForeground: '#ffffff',
    border: '#d04f99',
    input: '#868686',
    inputBg: 'transparent',
    ring: '#d15d98',
    sidebar: '#f8d8ea',
    sidebarAccent: '#f9a8d4',
    sidebarAccentForeground: '#333333',
    income: '#047743',
    expense: '#c13234',
    warning: '#9a4d00',
    warningForeground: '#ffffff',
    shadowSm: '3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 1px 2px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)',
    shadowMd: '3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 2px 4px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)',
    shadowLg: '3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 4px 6px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)',
    /** chart-1..5 ของธีม — กราฟที่มีอนุกรมมากกว่า 5 วนสีซ้ำ ทุกอนุกรมยังต้องมี label (Semantic Color Rule) */
    categoryPalette: ['#e670ab', '#84d2e2', '#fbe2a7', '#f3a0ca', '#d7488e'],
  },
  dark: {
    background: '#12242e',
    foreground: '#f3e3ea',
    card: '#1c2e38',
    popover: '#1c2e38',
    primary: '#fbe2a7',
    primaryForeground: '#12242e',
    secondary: '#e4a2b1',
    secondaryForeground: '#12242e',
    muted: '#24272b',
    mutedForeground: '#e4a2b1',
    accent: '#c67b96',
    accentForeground: '#12242e',
    destructive: '#e66aaa',
    destructiveForeground: '#12242e',
    border: '#324859',
    input: '#5d7c90',
    // พื้นช่องกรอกยังเป็น input เดิมของธีม (#20333d) ที่ 30% — ปรับเฉพาะเส้นขอบ
    inputBg: alpha('#20333d', 0.3),
    ring: '#50afb6',
    sidebar: '#101f28',
    sidebarAccent: '#f9a8d4',
    sidebarAccentForeground: '#1f2937',
    income: '#52cd86',
    expense: '#f5674e',
    warning: '#ffa726',
    warningForeground: 'rgba(0, 0, 0, 0.87)',
    shadowSm: '3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 1px 2px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)',
    shadowMd: '3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 2px 4px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)',
    shadowLg: '3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 4px 6px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)',
    categoryPalette: ['#50afb6', '#e4a2b1', '#c67b96', '#175c6c', '#24272b'],
  },
} as const;

type Tokens = (typeof tokens)[keyof typeof tokens];

function paletteFor(t: Tokens) {
  return {
    background: { default: t.background, paper: t.card },
    divider: t.border,
    text: { primary: t.foreground, secondary: t.mutedForeground },
    primary: { main: t.primary, contrastText: t.primaryForeground },
    secondary: { main: t.secondary, contrastText: t.secondaryForeground },
    error: { main: t.destructive, contrastText: t.destructiveForeground },
    success: { main: t.income },
    warning: { main: t.warning, contrastText: t.warningForeground },
    // StudentLoan.tsx ใช้ info เป็นสถานะกลาง ๆ — map ไปที่ muted-foreground แล้วให้ไอคอน + ข้อความสื่อความหมาย
    info: { main: t.mutedForeground },
    action: {
      hover: t.accent,
      selected: t.sidebarAccent,
      disabled: alpha(t.foreground, 0.42),
      disabledBackground: alpha(t.foreground, 0.1),
    },
    brand: {
      popover: t.popover,
      muted: t.muted,
      accent: t.accent,
      accentForeground: t.accentForeground,
      sidebar: t.sidebar,
      sidebarAccent: t.sidebarAccent,
      sidebarAccentForeground: t.sidebarAccentForeground,
      input: t.input,
      inputBg: t.inputBg,
      ring: t.ring,
      expense: t.expense,
      scrim: 'rgba(0, 0, 0, 0.5)',
      shadowSm: t.shadowSm,
      shadowMd: t.shadowMd,
      shadowLg: t.shadowLg,
    },
  };
}

// รัศมีมุมตามสเกลของ shadcn: r = --radius 0.4rem = 6.4px
export const radii = { sm: 2.4, md: 4.4, lg: 6.4, xl: 10.4 } as const;

export const fontFamilies = {
  sans: 'Poppins, "Noto Sans Thai", system-ui, sans-serif',
  mono: '"Fira Code", ui-monospace, monospace',
  // มีไว้เป็น token เท่านั้น (shadcn ไม่ได้ใช้ serif เป็นค่าเริ่มต้น)
  serif: 'Lora, "Noto Serif Thai", serif',
} as const;

// ชื่อเดิมคงไว้ให้หน้าต่าง ๆ ไม่ต้องแก้ — ตอนนี้ทั้งหมดเป็น Poppins
export const brandCopySx = {
  fontFamily: fontFamilies.sans,
  fontWeight: 400,
} as const;

// Poppins ไม่มี OpenType feature `tnum` และตัวเลขปกติกว้างไม่เท่ากัน — tabular-nums คงไว้แต่ไม่มีผลกับ Poppins
export const dataTextSx = {
  fontFamily: fontFamilies.sans,
  fontVariantNumeric: 'tabular-nums',
} as const;

export const descriptionSx = {
  ...brandCopySx,
  fontSize: '1rem',
  lineHeight: 1.6,
  letterSpacing: 0,
  textWrap: 'pretty',
} as const;

// เงาแบบ hard offset ของ Bubblegum ต้องเปลี่ยนตามธีม แต่ MUI เก็บ shadows ไว้ระดับ root ไม่แยกตาม color scheme
// จึงให้ shadows ชี้ไปที่ CSS var ของ palette.brand (นิยามแยกตามธีมบน <html> เดียวกัน) — elevation 1–3 = sm,
// 4–11 = md (menu/popover = 8), 12–24 = lg (drawer 16, dialog 24)
const SHADOW = (size: 'Sm' | 'Md' | 'Lg') => `var(--mui-palette-brand-shadow${size})`;
const shadows = Array.from({ length: 25 }, (_, i) => (i === 0 ? 'none' : SHADOW(i <= 3 ? 'Sm' : i <= 11 ? 'Md' : 'Lg')));

// cssVariables: ทุกสีเป็น CSS var สลับธีมด้วย attribute data-mui-color-scheme บน <html> (สคริปต์ใน index.html
// ตั้งไว้ก่อน paint แรก) ผลคือ theme.palette / useTheme() คืนค่าธีม light เสมอ — styleOverrides จึงต้องอ่าน
// theme.vars.palette.* และโค้ดที่ต้องการค่าสีจริง (กราฟ) ต้องเลือกจาก tokens ด้วย useColorScheme()
const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  colorSchemes: {
    light: { palette: paletteFor(tokens.light) },
    dark: {
      palette: {
        ...paletteFor(tokens.dark),
        // snackbar แบบ filled ของธีมมืด MUI ใช้พื้น *.dark (= main เข้มลง 30%) ตัวอักษรขาว: success 3.94, info 4.08,
        // warning 3.83 ไม่ผ่าน 4.5 — ใช้พื้น main + ตัวอักษรดำ 87% แทน (8.88 / 8.60 / 9.16) error เดิมผ่านอยู่แล้ว (5.58)
        // ตั้งที่ Alert ไม่ใช่ *.dark = main เพราะปุ่ม contained สี warning (ConfirmDialog) ใช้ *.dark เป็นพื้นตอน hover
        Alert: {
          successFilledBg: tokens.dark.income,
          successFilledColor: 'rgba(0, 0, 0, 0.87)',
          infoFilledBg: tokens.dark.mutedForeground,
          infoFilledColor: 'rgba(0, 0, 0, 0.87)',
          warningFilledBg: tokens.dark.warning,
          warningFilledColor: 'rgba(0, 0, 0, 0.87)',
        },
      },
    },
  },
  // focus ring ชุดเดียวของทุก control ที่เป็น ButtonBase (ปุ่ม, icon button, tab, chip, รายการเมนู/drawer, การ์ดสรุป)
  // MUI ใส่ให้ที่ .Mui-focusVisible เอง — 2px สี ring ห่าง 2px; tab/รายการเมนู/drawer MUI หด ring เข้าด้านใน (กัน
  // scroller/list ตัด) ring จึงอยู่บนพื้นของรายการเอง ซึ่งสี ring ไม่ผ่าน (ดู MuiTab/MuiListItemButton/MuiMenuItem ด้านล่าง)
  focusVisible: { outlineColor: 'var(--mui-palette-brand-ring)' },
  // transition ของ MUI (Fade/Grow/Slide/Collapse, ripple, indicator ของ tabs) เป็น 0 เมื่อผู้ใช้ตั้ง reduced motion
  motion: { reducedMotion: 'system' },
  shape: { borderRadius: radii.lg },
  shadows: shadows as Shadows,
  transitions: {
    duration: {
      shortest: 150,
      shorter: 180,
      short: 200,
      standard: 200,
      complex: 200,
      enteringScreen: 200,
      leavingScreen: 180,
    },
    easing: { easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  },
  typography: {
    fontFamily: fontFamilies.sans,
    // โหลดจาก Google Fonts แค่ 400 กับ 600 (web/index.html) — 500/700 ที่ MUI ใช้เอง (Tooltip, AlertTitle, DialogTitle,
    // <strong>) จึงชี้มาที่ 600 ไม่งั้นเบราว์เซอร์ตกไปใช้ 400 หรือสังเคราะห์ตัวหนาเอง
    fontWeightMedium: 600,
    fontWeightBold: 600,
    h1: { ...brandCopySx, fontWeight: 600, fontSize: '1.75rem', lineHeight: 1.3, letterSpacing: 0, textWrap: 'balance' },
    h2: { ...brandCopySx, fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4, letterSpacing: 0, textWrap: 'balance' },
    subtitle1: { letterSpacing: 0 },
    subtitle2: { letterSpacing: 0 },
    body1: { lineHeight: 1.5, letterSpacing: 0 },
    body2: { lineHeight: 1.5, letterSpacing: 0 },
    caption: { letterSpacing: 0 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      // body สี/พื้นมาจาก CssBaseline (background.default/text.primary) ตามธีมอยู่แล้ว
      styleOverrides: (theme) => ({
        body: {
          minWidth: 320,
          letterSpacing: 0,
          WebkitFontSmoothing: 'antialiased',
        },
        '#root': { minHeight: '100vh' },
        // สำรองให้ element ที่ไม่ใช่ ButtonBase (ลิงก์ในข้อความ ฯลฯ) — control ของ MUI ใช้ theme.focusVisible ด้านบน
        ':focus-visible': { outline: `2px solid ${theme.vars.palette.brand.ring}`, outlineOffset: 2 },
        'strong, b': { fontWeight: 600 },
        '::selection': {
          backgroundColor: theme.vars.palette.brand.sidebarAccent,
          color: theme.vars.palette.brand.sidebarAccentForeground,
        },
        code: {
          color: theme.vars.palette.text.secondary,
          fontFamily: fontFamilies.mono,
          fontSize: '0.85em',
          overflowWrap: 'anywhere',
        },
      }),
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 40,
          paddingInline: 16,
          borderRadius: radii.md,
          transition: 'background-color 180ms cubic-bezier(0.16, 1, 0.3, 1), border-color 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { minWidth: 40, minHeight: 40 } },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        // การ์ด: ขอบ border ของธีม (outlined ของ MUI ใช้ divider อยู่แล้ว) + เงา sm + มุม xl
        outlined: ({ theme }) => ({ borderRadius: radii.xl, boxShadow: theme.vars.shadows[1] }),
      },
    },
    MuiAppBar: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiDrawer: {
      styleOverrides: { paper: ({ theme }) => ({ backgroundColor: theme.vars.palette.brand.sidebar }) },
    },
    MuiPopover: {
      // Menu ใช้ PopoverPaper ด้วย จึงได้ค่าเดียวกัน; เงา md มาจาก elevation 8
      styleOverrides: {
        paper: ({ theme }) => ({
          backgroundColor: theme.vars.palette.brand.popover,
          border: `1px solid ${theme.vars.palette.divider}`,
          borderRadius: radii.md,
        }),
      },
    },
    MuiTabs: {
      styleOverrides: { indicator: { height: 2, borderRadius: 2 } },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 48,
          minWidth: 72,
          paddingInline: 16,
          textTransform: 'none',
          '&:hover': { backgroundColor: theme.vars.palette.brand.accent, color: theme.vars.palette.brand.accentForeground },
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: theme.vars.palette.brand.sidebarAccent,
            color: theme.vars.palette.brand.sidebarAccentForeground,
          },
          // ring ด้านใน (MUI หดเข้า 6px) อยู่บนพื้นของ tab เอง: ring ของธีมบน sidebar-accent ที่เลือกเหลือ 2.02 (สว่าง) /
          // 1.42 (มืด) — ใช้สีตัวอักษรของ tab ในสถานะนั้นแทน ซึ่งผ่าน 4.5 กับพื้นของมันทุกสถานะอยู่แล้ว (ปกติ 4.71/7.67,
          // hover 9.95/5.07, เลือก 6.97/8.09 สว่าง/มืด) ใช้กับรายการใน drawer/เมนูด้วยเหตุผลเดียวกัน (sidebar 5.17/13.60)
          '&.Mui-focusVisible': { outlineColor: 'currentColor' },
        }),
      },
    },
    // hover = accent, selected = sidebar-accent ของธีม — MUI ทาพื้น selected ของ ListItemButton/MenuItem/TableRow/
    // ToggleButton ด้วย alpha(primary/text) ไม่ใช่ action.selected จึงต้องตั้งเอง
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&.Mui-focusVisible': { outlineColor: 'currentColor' },
          '&:hover': { color: theme.vars.palette.brand.accentForeground },
          '&.Mui-selected, &.Mui-selected:hover, &.Mui-selected.Mui-focusVisible': {
            backgroundColor: theme.vars.palette.brand.sidebarAccent,
            color: theme.vars.palette.brand.sidebarAccentForeground,
          },
        }),
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&.Mui-focusVisible': { outlineColor: 'currentColor' },
          '&:hover': { color: theme.vars.palette.brand.accentForeground },
          '&.Mui-selected, &.Mui-selected:hover, &.Mui-selected.Mui-focusVisible': {
            backgroundColor: theme.vars.palette.brand.sidebarAccent,
            color: theme.vars.palette.brand.sidebarAccentForeground,
          },
        }),
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&:hover': { backgroundColor: theme.vars.palette.brand.accent, color: theme.vars.palette.brand.accentForeground },
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: theme.vars.palette.brand.sidebarAccent,
            color: theme.vars.palette.brand.sidebarAccentForeground,
          },
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.vars.palette.brand.inputBg,
          borderRadius: radii.md,
          ...dataTextSx,
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
          // focus ring ของธีม — ไม่ทับสีขอบตอน error
          '&.Mui-focused:not(.Mui-error) .MuiOutlinedInput-notchedOutline': { borderColor: theme.vars.palette.brand.ring },
        }),
        // hover/error/disabled ของ MUI มี specificity สูงกว่า จึงยังเปลี่ยนสีขอบได้ตามปกติ
        notchedOutline: ({ theme }) => ({ borderColor: theme.vars.palette.brand.input }),
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginInline: 0 } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderColor: theme.vars.palette.divider,
          verticalAlign: 'top',
          padding: '14px 16px',
          ...dataTextSx,
        }),
        head: ({ theme }) => ({ color: theme.vars.palette.text.secondary, fontWeight: 600, whiteSpace: 'nowrap' }),
      },
    },
    MuiTableRow: {
      // hover ใช้ action.hover (= accent) ของ MUI อยู่แล้ว
      styleOverrides: {
        root: ({ theme }) => ({
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: theme.vars.palette.brand.sidebarAccent,
            '& > .MuiTableCell-root': { color: theme.vars.palette.brand.sidebarAccentForeground },
          },
        }),
      },
    },
    MuiAlert: {
      styleOverrides: { root: { alignItems: 'center' }, message: { lineHeight: 1.5 } },
    },
    MuiChip: {
      // มุม md ตาม Badge ของ shadcn (rounded-md)
      styleOverrides: { root: { fontWeight: 600, borderRadius: radii.md }, sizeSmall: { minHeight: 28 } },
    },
    MuiDialog: {
      styleOverrides: {
        // เงา lg มาจาก elevation 24
        paper: ({ theme }) => ({
          backgroundImage: 'none',
          backgroundColor: theme.vars.palette.brand.popover,
          border: `1px solid ${theme.vars.palette.divider}`,
          borderRadius: radii.lg,
          maxHeight: 'calc(100% - 32px)',
        }),
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { padding: '20px 24px' } },
    },
    MuiDialogContent: {
      styleOverrides: { root: { padding: 24 } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '16px 24px 20px' } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme }) => ({
          backgroundColor: theme.vars.palette.brand.popover,
          color: theme.vars.palette.text.primary,
          border: `1px solid ${theme.vars.palette.divider}`,
          borderRadius: radii.md,
          fontSize: '0.875rem',
          // คำอธิบาย ไม่ใช่ป้าย — MUI ใช้ fontWeightMedium (ตอนนี้ = 600)
          fontWeight: 400,
        }),
      },
    },
    MuiSkeleton: {
      styleOverrides: { root: ({ theme }) => ({ backgroundColor: theme.vars.palette.brand.muted }) },
    },
  },
});

export default theme;
