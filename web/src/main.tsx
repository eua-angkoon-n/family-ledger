import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import theme from './theme.js';
import './styles.css';

// หลัง deploy ชื่อไฟล์ chunk ของหน้า lazy เปลี่ยน — แท็บที่เปิดค้างจากเวอร์ชันก่อนโหลด chunk เก่าไม่ได้ (404)
// แล้วค้างที่ skeleton: โหลดหน้าใหม่ครั้งเดียวให้ได้ index.html ชุดใหม่
window.addEventListener('vite:preloadError', () => window.location.reload());

// โหมดที่เลือกเก็บใน localStorage ('mui-mode') ต่อเครื่องโดย MUI เอง — สคริปต์ใน index.html อ่านค่าเดียวกันก่อน paint แรก
// noSsr: SPA ไม่มี server render — ให้ useColorScheme() คืน mode ได้ตั้งแต่ render แรก (เหตุผลเดียวกับ useMediaQuery ใน App.tsx)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme} defaultMode="system" noSsr disableTransitionOnChange>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
