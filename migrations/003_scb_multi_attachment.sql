-- SCB ส่ง statement ย้อนหลังหลาย PDF ใน Gmail message เดียว
drop index if exists statement_gmail_uniq;
alter table statement alter column gmail_attachment_id set not null;
create unique index statement_gmail_attachment_uniq
  on statement (bank_account_id, gmail_message_id, gmail_attachment_id);

-- ไฟล์รายเดือนและไฟล์ย้อนหลังของเดือนเดียวกันมี period เท่ากัน แต่ต้องเก็บทั้งสอง artifact
-- รายการธุรกรรมซ้ำกันถูกกันที่ txn unique key และนับใน rows_deduped
alter table statement drop constraint if exists statement_bank_account_id_period_start_period_end_key;

insert into bank (
  name, sender_email, sender_domain, subject_monthly, subject_ondemand,
  attachment_filename_pattern, parser_key, is_active
)
select
  'SCB',
  'scbeasynet@scb.co.th',
  'scb.co.th',
  '^SCB E PASSBOOK: e-Statement$',
  '^Sending deposit account statement with annotations from SCB Easy Application system$',
  '^(?:X{4}\d{6}|AcctSt_[A-Za-z]{3}\d{2})\.pdf$',
  'scb',
  true
where not exists (select 1 from bank where lower(name) = 'scb');
