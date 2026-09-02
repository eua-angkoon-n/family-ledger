import { alpha, createTheme } from '@mui/material/styles';

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
  copy: '"iannnnn-DOG", "Noto Sans Thai", system-ui, sans-serif',
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
    success: { main: colors.income, contrastText: colors.background },
    error: { main: colors.expense, contrastText: colors.background },
    info: { main: colors.muted, contrastText: colors.background },
    action: {
      hover: alpha(colors.accent, 0.08),
      selected: alpha(colors.accent, 0.14),
      disabled: alpha(colors.text, 0.42),
      disabledBackground: alpha(colors.text, 0.10),
    },
  },
  shape: { borderRadius: 10 },
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
    fontFamily: fontFamilies.data,
    h1: { ...brandCopySx, fontSize: '1.75rem', lineHeight: 1.3, letterSpacing: 0, textWrap: 'balance' },
    h2: { ...brandCopySx, fontSize: '1.25rem', lineHeight: 1.4, letterSpacing: 0, textWrap: 'balance' },
    body1: { lineHeight: 1.5 },
    body2: { lineHeight: 1.5 },
    button: { fontWeight: 650, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minWidth: 320,
          backgroundColor: colors.background,
          color: colors.text,
          WebkitFontSmoothing: 'antialiased',
        },
        '#root': { minHeight: '100vh' },
        ':focus-visible': { outline: `2px solid ${colors.accent}`, outlineOffset: 2 },
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
      styleOverrides: {
        root: {
          minHeight: 40,
          paddingInline: 16,
          transition: 'background-color 180ms cubic-bezier(0.16, 1, 0.3, 1), border-color 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          '&:focus-visible': { outline: `2px solid ${colors.accent}`, outlineOffset: 2 },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 40,
          minHeight: 40,
          '&:focus-visible': { outline: `2px solid ${colors.accent}`, outlineOffset: 2 },
        },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiAppBar: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiTabs: {
      styleOverrides: { indicator: { height: 2, borderRadius: 2 } },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 48,
          minWidth: 72,
          paddingInline: 16,
          textTransform: 'none',
          '&:focus-visible': { outline: `2px solid ${colors.accent}`, outlineOffset: -2 },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background,
          ...dataTextSx,
          transition: 'background-color 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': { backgroundColor: colors.surface },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { color: colors.muted } },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginInline: 0 } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: colors.border,
          verticalAlign: 'top',
          padding: '14px 16px',
          ...dataTextSx,
        },
        head: { color: colors.muted, fontWeight: 650, whiteSpace: 'nowrap' },
      },
    },
    MuiTableRow: {
      styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: alpha(colors.accent, 0.05) } } },
    },
    MuiAlert: {
      styleOverrides: { root: { alignItems: 'center' }, message: { lineHeight: 1.5 } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 650 }, sizeSmall: { minHeight: 28 } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundImage: 'none', border: `1px solid ${colors.border}`, maxHeight: 'calc(100% - 32px)' },
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
      styleOverrides: { tooltip: { backgroundColor: colors.surface, color: colors.text, fontSize: '0.875rem' } },
    },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: alpha(colors.muted, 0.14) } },
    },
  },
});

export default theme;
