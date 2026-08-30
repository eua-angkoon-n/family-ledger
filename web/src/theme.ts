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
    fontFamily: 'system-ui, "Noto Sans Thai", sans-serif',
    h1: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.3 },
    h2: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.4 },
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
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: colors.border, verticalAlign: 'top' },
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
