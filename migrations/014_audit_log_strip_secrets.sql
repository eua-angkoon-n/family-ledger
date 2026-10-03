-- แถว audit_log ที่อาจเขียนก่อนแก้บั๊ก Slice 8 (bank_account.archive ใช้ `select *`) เก็บ ciphertext ของความลับ
-- (pdf_password_enc) ไว้ใน before_data/after_data และ GET /api/audit-log เคยส่งออกไปดิบ ๆ — แอดมินโหมด
-- scope=all จึงได้ ciphertext ของทุกคน ลบทุก key ระดับบนที่ลงท้าย `_enc` (ไม่ใช่แค่ชื่อที่รู้จัก)
-- route ตัดซ้ำอีกชั้นตอนอ่าน (รวม payload ซ้อน/array) — ที่นี่ล้างเฉพาะระดับบนซึ่งเป็นรูปของบั๊กนั้น
-- payload ที่ไม่ใช่ object (txn.split เป็น array) ข้าม: jsonb_object_keys ใช้กับ array ไม่ได้
-- รันซ้ำได้ผลเท่าเดิม (where แค่กรองแถวที่ข้อความมี key `_enc` ไม่ให้เขียนทับทั้งตาราง) ไม่แตะคอลัมน์อื่น
update audit_log set
  before_data = case when jsonb_typeof(before_data) = 'object'
    then before_data - array(select k from jsonb_object_keys(before_data) k where k ~ '_enc$')
    else before_data end,
  after_data = case when jsonb_typeof(after_data) = 'object'
    then after_data - array(select k from jsonb_object_keys(after_data) k where k ~ '_enc$')
    else after_data end
where before_data::text ~ '_enc": ' or after_data::text ~ '_enc": ';
