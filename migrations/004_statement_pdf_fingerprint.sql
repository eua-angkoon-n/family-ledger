-- Gmail attachmentId เปลี่ยนได้ระหว่าง messages.get จึงใช้ hash ของไฟล์ต้นฉบับเป็น identity ที่คงที่
alter table statement add column pdf_sha256 text;
drop index if exists statement_gmail_attachment_uniq;
create unique index statement_pdf_sha256_uniq
  on statement (bank_account_id, pdf_sha256)
  where pdf_sha256 is not null;
