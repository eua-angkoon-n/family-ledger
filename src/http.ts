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
