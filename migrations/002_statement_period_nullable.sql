-- Slice 2 ยังไม่มี parser จึงไม่รู้ช่วงเวลาของ statement ตอนเขียนแถวแรก (status='pending'/'parse_failed')
-- statement_gmail_uniq (bank_account_id, gmail_message_id) กันซ้ำได้อยู่แล้วโดยไม่ต้องพึ่ง period
-- parser ใน Slice 3 จะ update สองคอลัมน์นี้คืนตอน parse สำเร็จ
alter table statement alter column period_start drop not null;
alter table statement alter column period_end drop not null;
