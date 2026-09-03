-- Slice 5: วางแผนรายเดือน — คนละขอบเขตกับ txn โดยเจตนา (ADR-0002 ข้อ 2–4)
-- ตารางในไฟล์นี้ไม่มีสิทธิ์สร้างหรือแก้ txn เชื่อมกันได้ทางเดียวคือ monthly_item_payment.txn_id
-- ที่เป็นการ "จับคู่ภายหลัง" ไม่ใช่ "เขียนทับ" — mark paid ห้ามสร้าง txn ปลอม (§3 ข้อ 5)
-- เงินทุกช่องยังเป็น BIGINT หน่วยสตางค์ ตามกติกาเดิม

create table monthly_plan (
  id               bigserial primary key,
  user_id          bigint not null references app_user(id) on delete cascade,
  month_start      date not null,
  status           text not null default 'open' check (status in ('open', 'closed')),
  -- ภาพสรุปตามแผน ณ วันปิดเดือน เก็บไว้เพื่อ audit เท่านั้น (§9.6) — หน้าจอทุกที่ต้องอ่านสถานะการจ่าย
  -- สดจาก monthly_item_payment เสมอ ถ้า render จากคอลัมน์นี้ตอนเดือนปิด statement ที่มาช้าแล้วจับคู่
  -- payment ได้ (ซึ่งอนุญาต) จะไม่ปรากฏบนจอเลย
  closed_snapshot  jsonb,
  created_at       timestamptz not null default now(),
  closed_at        timestamptz,
  unique (user_id, month_start),
  -- รอบบัญชีเป็นเดือนปฏิทินเต็มเดือน (§3 ข้อ 3) ให้ DB บังคับ ไม่ปล่อยให้ route ลืม
  constraint monthly_plan_month_start_is_first check (extract(day from month_start) = 1)
);

-- รายการประจำ (§9.2) การแก้กฎมีผลเฉพาะรายการในอนาคต — บังคับด้วยการที่ generation เป็น insert-only
-- (ดู monthly_plan_item_rule_uniq ด้านล่าง) ไม่ใช่ด้วย versioning ของกฎ
create table recurring_rule (
  id                  bigserial primary key,
  user_id             bigint not null references app_user(id) on delete cascade,
  name                text not null,
  kind                text not null check (kind in ('income', 'payroll_deduction', 'expense', 'reserve')),
  amount_mode         text not null default 'fixed' check (amount_mode in ('fixed', 'estimated')),
  amount_satang       bigint not null check (amount_satang >= 0), -- ยอดประมาณการเป็น 0 ได้
  frequency_unit      text not null check (frequency_unit in ('day', 'week', 'month', 'year')),
  frequency_interval  integer not null default 1 check (frequency_interval > 0),
  -- วันครบกำหนดในรอบ ใช้เฉพาะ frequency_unit เป็น month/year (day/week เดินจาก start_date)
  -- ตั้ง 29–31 ได้ เดือนที่ไม่มีวันนั้นให้ใช้วันสุดท้ายของเดือน — clamp ตอน generate ไม่เก็บค่าที่ clamp แล้ว
  anchor_day          integer check (anchor_day between 1 and 31),
  start_date          date not null,
  end_date            date,
  default_account_id  bigint references bank_account(id),
  category_id         bigint references category(id),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index recurring_rule_user_active_idx on recurring_rule (user_id) where is_active;

-- รายการในแผนของเดือนหนึ่ง มาจาก recurring_rule หรือเพิ่มเฉพาะเดือน (§9.3 recurring_rule_id เป็น null)
-- สถานะการจ่ายไม่เก็บที่นี่ — คำนวณจาก monthly_item_payment + due_date ทุกครั้ง (§7.2)
create table monthly_plan_item (
  id                     bigserial primary key,
  monthly_plan_id        bigint not null references monthly_plan(id) on delete cascade,
  recurring_rule_id      bigint references recurring_rule(id),
  installment_due_id     bigint, -- ยังไม่มีตาราง installment_due จนกว่าจะถึง Slice 6 — ห้ามใส่ FK ตอนนี้
  kind                   text not null check (kind in ('income', 'payroll_deduction', 'expense', 'reserve')),
  name                   text not null,
  category_id            bigint references category(id),
  planned_amount_satang  bigint not null check (planned_amount_satang >= 0),
  -- วันครบกำหนดที่ generation คำนวณไว้ **ผู้ใช้แก้ไม่ได้** เป็นคีย์กันสร้างซ้ำเท่านั้น
  -- ต้องแยกจาก due_date เพราะ §9.3 ให้ผู้ใช้เลื่อน due_date เฉพาะเดือนนี้ได้ ถ้าใช้คอลัมน์เดียวกัน
  -- เลื่อนแล้ว generate รอบหน้าจะไม่เห็นแถวเดิม แล้วสร้างซ้ำที่วันเดิมทันที (และย้อน skip ให้ด้วย)
  occurrence_date        date,
  due_date               date,
  explicit_status        text not null default 'active' check (explicit_status in ('active', 'skipped', 'cancelled')),
  note                   text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- แถวที่มาจากกฎต้องมี occurrence_date เสมอ ไม่งั้นหลุด unique index ไปสร้างซ้ำได้
  constraint monthly_plan_item_generated_has_occurrence
    check (recurring_rule_id is null or occurrence_date is not null)
);
create index monthly_plan_item_plan_idx on monthly_plan_item (monthly_plan_id);

-- idempotency ของการสร้างรายการประจำอยู่ที่ index นี้ ไม่ใช่ในโค้ด (§9.2) generate ใช้
-- insert ... on conflict do nothing เท่านั้น ห้าม update แถวเดิม ไม่งั้นการแก้ rule จะย้อนแก้เดือนที่ปิดแล้ว
-- (§16 ข้อ 16) และรายการที่ผู้ใช้ skip/cancel ต้องคงแถวไว้เพื่อกัน generate ซ้ำ จึงไม่มี DELETE endpoint
create unique index monthly_plan_item_rule_uniq
  on monthly_plan_item (monthly_plan_id, recurring_rule_id, occurrence_date)
  where recurring_rule_id is not null;

-- Payment Declaration (§9.5) ผู้ใช้ประกาศว่าจ่ายแล้วก่อน statement มาถึง จ่ายบางส่วนได้ด้วยการมีหลายแถว
create table monthly_item_payment (
  id                    bigserial primary key,
  monthly_plan_item_id  bigint not null references monthly_plan_item(id) on delete cascade,
  amount_satang         bigint not null check (amount_satang > 0),
  paid_date             date not null,
  bank_account_id       bigint not null references bank_account(id),
  -- ไม่ใส่ on delete เหมือน transfer_match ใน 005: ลบ txn ทิ้งโดยยังมี payment ผูกอยู่ต้องล้มไปเลย
  -- ไม่ใช่เงียบ ๆ ปล่อยให้เหลือ matched ที่ไม่มี txn
  txn_id                bigint references txn(id),
  status                text not null default 'declared'
                          check (status in ('declared', 'matched', 'needs_review', 'cancelled')),
  created_at            timestamptz not null default now(),
  verified_at           timestamptz,
  check (status <> 'matched' or txn_id is not null)
);
create index monthly_item_payment_item_idx on monthly_item_payment (monthly_plan_item_id);

-- §9.5 เกณฑ์ข้อ 5: txn หนึ่งรายการผูกกับ payment ที่ matched ได้ไม่เกินหนึ่งแถว — DB เป็นคนบังคับ
-- ไม่ใช่ application (precedent: transfer_match_debit_confirmed_uniq ใน 005) กันการนับยอดซ้ำ (§16 ข้อ 7)
create unique index monthly_item_payment_txn_matched_uniq
  on monthly_item_payment (txn_id) where status = 'matched';
