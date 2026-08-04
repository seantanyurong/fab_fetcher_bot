-- Attendance responses for the /calendar feature.
-- One row per (chat, date, user); upserted whenever someone taps a status button.
create table if not exists calendar_responses (
  chat_id    bigint not null,
  date       date   not null,
  user_id    bigint not null,
  user_name  text   not null,
  status     text   not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (chat_id, date, user_id)
);

create index if not exists calendar_responses_chat_date_idx
  on calendar_responses (chat_id, date);

-- No policies defined on purpose: only the server-side client (using the
-- service role key, which bypasses RLS) should ever read or write this
-- table. anon/authenticated keys get denied by default.
alter table calendar_responses enable row level security;
