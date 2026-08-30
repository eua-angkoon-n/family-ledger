-- Slice 1: ผู้ใช้ / กล่องอีเมล / ธนาคาร / บัญชีธนาคาร
-- Slice 2-3 ใช้ statement + txn (สร้างไว้เลยเพราะ shape ล็อกแล้วในแผน)
-- เงินทุกช่องเป็น BIGINT หน่วยสตางค์ แปลงเป็นบาทตอนแสดงผลเท่านั้น

create table app_user (
  id            bigserial primary key,
  google_sub    text        not null unique,
  email         text        not null unique,
  display_name  text        not null default '',
  is_admin      boolean     not null default false,
  status        text        not null default 'pending'
                            check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);

create table email_account (
  id                 bigserial primary key,
  user_id            bigint      not null references app_user(id) on delete cascade,
  email              text        not null,
  -- AES-256-GCM ดู src/crypto.ts — ห้ามเก็บ plaintext
  refresh_token_enc  text        not null,
  history_id         text,               -- cursor ของ Gmail history.list
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  unique (user_id, email)
);

create table bank (
  id                          bigserial primary key,
  name                        text    not null,
  -- ผู้ส่ง = ธนาคาร ไม่ใช่กล่องของผู้ใช้ เทียบแบบ case-insensitive
  sender_email                text    not null,
  -- ใช้ตรวจ DKIM header.i ต้องลงท้ายด้วยโดเมนนี้
  sender_domain               text    not null,
  subject_monthly             text    not null,
  subject_ondemand            text    not null,
  attachment_filename_pattern text    not null default '\.pdf$',
  parser_key                  text    not null,
  is_active                   boolean not null default true,
  created_at                  timestamptz not null default now()
);
create unique index bank_name_uniq on bank (lower(name));

create table bank_account (
  id                bigserial primary key,
  user_id           bigint  not null references app_user(id) on delete cascade,
  bank_id           bigint  not null references bank(id),
  email_account_id  bigint  not null references email_account(id),
  nickname          text    not null,
  account_number    text    not null,
  -- statement ปิดบังเลขบัญชีแบบ xxx-x-x6231-x คือ**ปิดหลักท้ายด้วย** จับคู่แบบ suffix ไม่ได้
  -- ต้องเทียบตามตำแหน่ง ดู src/account-match.ts (เก็บเฉพาะตัวเลขไว้ให้เทียบง่าย)
  account_digits    text    not null generated always as
                            (regexp_replace(account_number, '\D', '', 'g')) stored,
  pdf_password_enc  text    not null,
  promptpay_id      text,
  created_at        timestamptz not null default now(),
  unique (user_id, bank_id, account_number)
);

create table statement (
  id                      bigserial primary key,
  bank_account_id         bigint  not null references bank_account(id) on delete cascade,
  gmail_message_id        text    not null,
  gmail_attachment_id     text,
  period_start            date    not null,
  period_end              date    not null,
  opening_balance_satang  bigint,
  closing_balance_satang  bigint,
  raw_pdf_path            text,
  status                  text    not null default 'pending'
                                  check (status in ('pending', 'parsed', 'checksum_failed', 'parse_failed')),
  -- "parsed แต่ rows_inserted = 0" เป็นเรื่องปกติเมื่อ statement ทับช่วงกัน ไม่ใช่ parser พัง
  rows_inserted           integer not null default 0,
  rows_deduped            integer not null default 0,
  error_detail            jsonb,
  created_at              timestamptz not null default now(),
  unique (bank_account_id, period_start, period_end)
);
create unique index statement_gmail_uniq on statement (bank_account_id, gmail_message_id);

create table txn (
  id                      bigserial primary key,
  statement_id            bigint  not null references statement(id) on delete cascade,
  bank_account_id         bigint  not null references bank_account(id) on delete cascade,
  -- วันที่ในบรรทัดของ statement ไม่ใช่วันที่อีเมลมาถึง มิฉะนั้นปีภาษีเพี้ยนทั้งชุด
  txn_date                date    not null,
  description             text    not null default '',
  channel                 text,
  counterparty            text,
  amount_satang           bigint  not null check (amount_satang > 0),
  direction               text    not null check (direction in ('credit', 'debit')),
  running_balance_satang  bigint  not null,
  is_internal_transfer    boolean not null default false,
  created_at              timestamptz not null default now(),
  -- กันซ้ำระดับบรรทัด แถวเป็นของ statement ที่ import ก่อน
  unique (bank_account_id, txn_date, amount_satang, running_balance_satang)
);
create index txn_account_date_idx on txn (bank_account_id, txn_date);
