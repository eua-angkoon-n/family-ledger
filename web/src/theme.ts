import { createTheme } from '@mui/material/styles';

export const colors = {
  background: '#0e101f',
  surface: '#1a1e30',
  border: '#32364d',
  text: '#e9ebf2',
  muted: '#9498a5',
  accent: '#70adfb',
  income: '#52cd86',
  expense: '#f3625d',
} as const;

export const fontFamilies = {
  copy: '"SOV BokThang", "Noto Sans Thai", system-ui, sans-serif',
  data: 'system-ui, "Noto Sans Thai", sans-serif',
} as const;

export const brandCopySx = {
  fontFamily: fontFamilies.copy,
  fontWeight: 400,
} as const;

export const dataTextSx = {
  fontFamily: fontFamilies.data,
  fontVariantNumeric: 'tabular-nums',
} as const;

export const descriptionSx = {
  ...brandCopySx,
  fontSize: '1rem',
  lineHeight: 1.6,
  letterSpacing: '0.01em',
  textWrap: 'pretty',
} as const;

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: colors.background, paper: colors.surface },
    divider: colors.border,
    text: { primary: colors.text, secondary: colors.muted },
    primary: { main: colors.accent, contrastText: colors.background },
    success: { main: colors.income },
    error: { main: colors.expense },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: fontFamilies.data,
    h1: { ...brandCopySx, fontSize: '1.75rem', lineHeight: 1.3, textWrap: 'balance' },
    h2: { ...brandCopySx, fontSize: '1.25rem', lineHeight: 1.4, textWrap: 'balance' },
    button: { fontWeight: 650, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { minWidth: 320 },
        '#root': { minHeight: '100vh' },
        code: {
          color: colors.muted,
          fontSize: '0.85em',
          ...dataTextSx,
          overflowWrap: 'anywhere',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 40 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background,
          ...dataTextSx,
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: colors.border,
          verticalAlign: 'top',
          ...dataTextSx,
        },
        head: { color: colors.muted, fontWeight: 650, whiteSpace: 'nowrap' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundImage: 'none', border: `1px solid ${colors.border}` },
      },
    },
  },
});

export default theme;
