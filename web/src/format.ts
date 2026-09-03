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

export function formatDateTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
