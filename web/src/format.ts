// วันที่จาก API เป็น 'YYYY-MM-DD' ดิบเสมอ (src/db.ts มี DATE type parser กันแปลงเป็น UTC ผิดวัน) —
// ตีความเป็นเที่ยงคืน UTC แล้วอ่านกลับด้วย timeZone UTC เพื่อไม่ให้เบราว์เซอร์เลื่อนวันอีกที
export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// 'YYYY-MM' → "ส.ค. 2569" / year '2-digit' → "ส.ค. 69" / 'none' → "ส.ค." (แกนกราฟที่บอกปีไว้ที่อื่นแล้ว)
// style 'long' → "สิงหาคม 2569" — UTC เหตุผลเดียวกับ formatDate
export function formatMonth(month: string, year: 'numeric' | '2-digit' | 'none' = 'numeric', style: 'short' | 'long' = 'short'): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('th-TH', { month: style, year: year === 'none' ? undefined : year, timeZone: 'UTC' });
}

// จำนวนวันจาก 'YYYY-MM-DD' ถึงวันนี้ (ตามปฏิทินของเครื่อง) — นับเป็นวันเต็ม ไม่สนเวลา
export function daysSince(isoDate: string, now = new Date()): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - Date.parse(`${isoDate}T00:00:00Z`)) / 86400000);
}

// 'YYYY-MM-DD' → "31 ส.ค." สำหรับแกนกราฟที่แคบ (tooltip ยังใช้ formatDate เต็ม)
export function formatDayMonth(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function formatBaht(satang: number): string {
  return (satang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// CONTEXT.md: ห้าม parseFloat(x) * 100 — ตัด , ออกแล้วแยกที่ . ประกอบเป็นจำนวนเต็มสตางค์แทน กัน floating
// point คลาดเคลื่อน (เช่น 1234.5 * 100 อาจได้ 123449.999999... ใน JS) คืน null เมื่อ parse ไม่ได้
export function parseBahtToSatang(input: string): number | null {
  const cleaned = input.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [intPart, fracPart = ''] = cleaned.split('.');
  const satangFraction = (fracPart + '00').slice(0, 2);
  return Number(intPart) * 100 + Number(satangFraction);
}

/** ข้อความ error ของช่องยอดเงินที่ parseBahtToSatang อ่านไม่ได้ — บอกรูปแบบที่ถูก ไม่ใช่แค่ "ผิด" */
export const AMOUNT_FORMAT_HINT = 'ใส่ตัวเลข เช่น 1,500.50';

export function formatDateTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
