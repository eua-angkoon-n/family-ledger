// ปิดหน้าภาษีชั่วคราว (1.2.3) — เปลี่ยนเป็น true เพื่อเปิดคืน
// โค้ด, API, ข้อมูล และช่องกรอก Tax Treatment/Tax Entity ในหน้าอื่นยังอยู่ครบ แค่ไม่มีเมนู/route/คู่มือ
export const TAX_PAGES_ENABLED: boolean = false;

const TAX_PATHS: readonly string[] = ['/tax-documents', '/tax'];

export const isPageEnabled = (path: string): boolean => TAX_PAGES_ENABLED || !TAX_PATHS.includes(path);
