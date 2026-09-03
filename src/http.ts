export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type Body = Record<string, unknown>;

export function str(body: Body, field: string, max = 200): string {
  const v = body[field];
  if (typeof v !== 'string' || v.trim() === '') throw new HttpError(400, `ต้องกรอก ${field}`);
  if (v.length > max) throw new HttpError(400, `${field} ยาวเกิน ${max} ตัวอักษร`);
  return v.trim();
}

export function optionalStr(body: Body, field: string, max = 200): string | null {
  const v = body[field];
  if (v == null || v === '') return null;
  return str(body, field, max);
}

export function regex(body: Body, field: string): string {
  const v = str(body, field, 500);
  try {
    new RegExp(v);
  } catch {
    throw new HttpError(400, `${field} ไม่ใช่ regex ที่ใช้ได้`);
  }
  return v;
}

export function id(body: Body, field: string): number {
  const n = Number(body[field]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `ต้องเลือก ${field}`);
  return n;
}

// req.params.id ที่ไม่ใช่ตัวเลข (เช่น /transactions/abc) ต้องได้ 400 ไม่ใช่ 500 —
// Number('abc') เป็น NaN แล้ว pg ส่ง "NaN" เป็น bigint param ทำให้ Postgres โยน 22P02 ที่ error handler กลางไม่รู้จัก
export function pathId(req: { params: Record<string, string> }, field = 'id'): number {
  const n = Number(req.params[field]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${field} ไม่ถูกต้อง`);
  return n;
}

// ยอดเงินใน body — CONTEXT.md ห้าม parseFloat(x)*100 ฝั่ง web แปลงเป็นสตางค์มาแล้ว (parseBahtToSatang)
// ที่นี่จึงรับแต่จำนวนเต็มสตางค์ ปฏิเสธทุกอย่างที่ไม่ใช่
export function satang(body: Body, field: string): number {
  const n = body[field];
  // ต้องมีเพดานด้วย: Number.isInteger(1e300) เป็น true แล้ว pg ส่ง "1e+300" เป็น bigint
  // ทำให้ Postgres โยน 22P02 ที่ error handler กลางไม่รู้จัก กลายเป็น 500 แทน 400
  if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > Number.MAX_SAFE_INTEGER) {
    throw new HttpError(400, `${field} ต้องเป็นจำนวนเงินที่ถูกต้อง`);
  }
  return n as number;
}

// รูปแบบถูกยังไม่พอ ต้องเป็นวันที่ที่มีจริงด้วย — '2026-02-31' ผ่าน regex แต่ Postgres โยน 22008
// (date/time field value out of range) ที่ error handler กลางไม่รู้จัก กลายเป็น 500 แทน 400
// round-trip ผ่าน Date UTC จับทั้งวันเกินเดือน เดือนเกิน 12 และ 29 ก.พ. ในปีที่ไม่ใช่อธิกสุรทิน
// (regex เขียนซ้ำกับ DATE_RE ใน report-query.ts โดยเจตนา — import กลับมาจะเป็น circular กับ http.ts)
export function isoDate(body: Body, field: string): string {
  const v = body[field];
  const bad = `${field} ต้องเป็นวันที่จริงในรูปแบบ YYYY-MM-DD`;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HttpError(400, bad);
  const parsed = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== v) throw new HttpError(400, bad);
  return v;
}

/** enum ใน body — แทน pattern `if (!(KINDS as readonly string[]).includes(...))` ที่ซ้ำอยู่หลาย route */
export function enumStr<T extends string>(body: Body, field: string, values: readonly T[]): T {
  const v = body[field];
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) {
    throw new HttpError(400, `${field} ต้องเป็นหนึ่งใน ${values.join(', ')}`);
  }
  return v as T;
}
