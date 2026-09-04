-- KBank ส่ง statement หลักและคู่มือ channel_bankuse.pdf มาด้วยกัน จึงต้องใช้ชื่อไฟล์ที่เจาะจง
insert into bank (
  name, sender_email, sender_domain, subject_monthly, subject_ondemand,
  attachment_filename_pattern, parser_key, is_active
)
select
  'KBank',
  'K-ElectronicDocument@kasikornbank.com',
  'kasikornbank.com',
  '^E-statement for saving account no\. [Xx\d-]+ \[\d+\]$',
  '^E-statement for saving account no\. [Xx\d-]+ \[\d+\]$',
  '^STM_SA\d{4}_\d{2}[A-Z]{3}\d{2}_\d{2}[A-Z]{3}\d{2}\.pdf$',
  'kbank',
  true
where not exists (select 1 from bank where lower(name) = 'kbank');
