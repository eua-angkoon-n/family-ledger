-- กล่องอีเมลที่ Google ตอบ invalid_grant ตอนขอ access token (ผู้ใช้ถอนสิทธิ์ / refresh token หมดอายุ)
-- null = ใช้งานได้ · มีค่า = ต้องให้ผู้ใช้เชื่อม Gmail ใหม่ worker ข้ามกล่องนี้จนกว่าจะเชื่อมใหม่สำเร็จ
-- (src/auth.ts ล้างค่าเป็น null ตอน upsert refresh token ใหม่) ปัญหาชั่วคราวเช่น 5xx ไม่ตั้งค่านี้
alter table email_account add column reauth_required_at timestamptz;
