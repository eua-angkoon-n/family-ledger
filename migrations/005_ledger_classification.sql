-- Slice 4A: จัดหมวดธุรกรรม + จับคู่เงินโอนภายใน + เตรียมช่องสำหรับผู้ใช้ธุรกิจ
-- เงินทุกช่องยังเป็น BIGINT หน่วยสตางค์ ตามกติกาเดิม

create table category (
  id          bigserial primary key,
  user_id     bigint references app_user(id) on delete cascade, -- null = หมวดระบบ ใช้ร่วมกันทุกคน
  name        text not null,
  kind        text not null check (kind in ('income', 'expense')),
  parent_id   bigint references category(id), -- เผื่อหมวดย่อยตามแผน ยังไม่ใช้ตอนนี้
  is_system   boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into category (name, kind, is_system) values
  ('เงินเดือน', 'income', true),
  ('รายได้ธุรกิจ', 'income', true),
  ('ดอกเบี้ย/เงินปันผล', 'income', true),
  ('รายได้อื่น', 'income', true),
  ('อาหาร', 'expense', true),
  ('เดินทาง', 'expense', true),
  ('ที่อยู่อาศัย', 'expense', true),
  ('สาธารณูปโภค', 'expense', true),
  ('สุขภาพ', 'expense', true),
  ('ช้อปปิ้ง', 'expense', true),
  ('ผ่อนชำระ', 'expense', true),
  ('ภาษี/ค่าธรรมเนียม', 'expense', true),
  ('อื่น ๆ', 'expense', true);

-- ผลจำแนกต่อธุรกรรม แยกจาก txn เพราะแก้ไขได้ทีหลังโดยผู้ใช้ (ไม่ใช่ผลจาก parser)
create table txn_annotation (
  id              bigserial primary key,
  txn_id          bigint not null references txn(id) on delete cascade unique,
  tax_entity_id   bigint, -- ยังไม่มีตาราง tax_entity จนกว่าจะถึง Slice 7 — ห้ามใส่ FK ตอนนี้
  classification  text not null check (classification in ('income', 'expense', 'internal_transfer', 'excluded')),
  review_status   text not null default 'unreviewed' check (review_status in ('unreviewed', 'reviewed')),
  note            text,
  reviewed_at     timestamptz,
  updated_at      timestamptz not null default now()
);

-- แตกยอดธุรกรรมเดียวเป็นหลายหมวด (เช่น ใบเสร็จรวมของกินกับของใช้)
create table txn_split (
  id             bigserial primary key,
  txn_id         bigint not null references txn(id) on delete cascade,
  category_id    bigint not null references category(id),
  amount_satang  bigint not null check (amount_satang > 0),
  note           text
);
create index txn_split_txn_id_idx on txn_split (txn_id);

-- คู่โอนเงินภายใน (เช่น โอนจากบัญชีออมทรัพย์ไปบัญชีเงินเดือน) — เก็บไว้ไม่ให้ถูกนับเป็นรายรับ/รายจ่ายซ้ำ
create table transfer_match (
  id             bigserial primary key,
  user_id        bigint not null references app_user(id) on delete cascade,
  debit_txn_id   bigint not null references txn(id),
  credit_txn_id  bigint not null references txn(id),
  status         text not null default 'suggested' check (status in ('suggested', 'confirmed', 'rejected')),
  confidence     numeric,
  matched_by     text not null check (matched_by in ('system', 'user')),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- DB เป็นคนบังคับว่า 1 txn คู่กับ confirmed match ได้ไม่เกิน 1 คู่ ไม่ใช่ application
create unique index transfer_match_debit_confirmed_uniq
  on transfer_match (debit_txn_id) where status = 'confirmed';
create unique index transfer_match_credit_confirmed_uniq
  on transfer_match (credit_txn_id) where status = 'confirmed';

alter table txn add column txn_time time;

alter table bank_account add column account_purpose text not null default 'personal'
  check (account_purpose in ('personal', 'business'));
alter table bank_account add column archived_at timestamptz;

-- archive แล้วต้องเพิ่มบัญชีเลขเดิมซ้ำได้ — เปลี่ยน unique เดิมเป็น partial ที่ไม่นับบัญชี archived
alter table bank_account drop constraint bank_account_user_id_bank_id_account_number_key;
create unique index bank_account_active_uniq
  on bank_account (user_id, bank_id, account_number) where archived_at is null;
