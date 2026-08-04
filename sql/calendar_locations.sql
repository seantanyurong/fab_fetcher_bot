-- Optional per-date venue for the /calendar feature (e.g. different game
-- shops on different days). One row per (chat, date).
create table if not exists calendar_locations (
  chat_id    bigint not null,
  date       date   not null,
  location   text   not null,
  updated_at timestamptz not null default now(),
  primary key (chat_id, date)
);

-- No policies defined on purpose: only the server-side client (using the
-- service role key, which bypasses RLS) should ever read or write this
-- table. anon/authenticated keys get denied by default.
alter table calendar_locations enable row level security;
