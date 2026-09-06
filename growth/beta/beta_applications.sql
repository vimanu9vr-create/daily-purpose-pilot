-- Beta applications table for the landing page at growth/beta/index.html
--
-- Run this once in the Supabase SQL Editor.
--
-- The page posts here with the PUBLISHABLE key, which is public by design —
-- it ships inside the HTML where anyone can read it. Row-level security is
-- what actually protects this table, so read that policy carefully rather
-- than trusting the key.
--
-- The rule is: anonymous visitors may INSERT and nothing else. They cannot
-- select, update or delete. So a stranger can apply, and a stranger cannot
-- read anybody else's application — which matters, because these rows contain
-- email addresses and personal goals.

create table if not exists public.beta_applications (
  id uuid primary key default gen_random_uuid(),

  name        text not null check (length(btrim(name)) between 1 and 120),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  play_email  text not null check (play_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  android     text not null check (android in ('yes','no','both')),
  goal        text not null check (length(btrim(goal)) between 3 and 300),
  tried       text,
  launch_list boolean not null default true,

  -- Attribution, so you can tell which ad or Reel actually produced testers
  -- rather than which one produced clicks.
  source      text,
  campaign    text,
  ad          text,

  -- Everything below is yours to fill in as the beta runs. Kept on the same
  -- row rather than in a second table because twenty testers do not need a
  -- schema, they need one place to look.
  status          text not null default 'new'
                  check (status in ('new','qualified','waitlist','rejected','invited','opted_in','installed','active','dropped','completed')),
  invited_at      timestamptz,
  opted_in_at     timestamptz,
  installed_at    timestamptz,
  day1_feedback   boolean not null default false,
  day14_feedback  boolean not null default false,
  still_opted_in  boolean,
  notes           text,

  created_at  timestamptz not null default now()
);

-- One application per person. A duplicate submission updates nothing and
-- errors loudly rather than quietly creating a second row you later invite
-- twice.
create unique index if not exists beta_applications_email_key
  on public.beta_applications (lower(email));

create index if not exists beta_applications_status_idx
  on public.beta_applications (status, created_at desc);

alter table public.beta_applications enable row level security;

-- Anonymous visitors: insert only.
drop policy if exists "anyone may apply" on public.beta_applications;
create policy "anyone may apply"
  on public.beta_applications
  for insert
  to anon, authenticated
  with check (true);

-- No select/update/delete policy exists for anon, so none is permitted.
-- You read this table from the Supabase dashboard, which uses the service
-- role and bypasses RLS.

grant insert on public.beta_applications to anon, authenticated;

-- A view for the daily working list, so you are not scrolling raw columns.
create or replace view public.beta_pipeline as
select
  created_at::date as applied_on,
  name, email, play_email, android, goal, status, source, campaign,
  case
    when android = 'no' then 'iPhone — launch list only'
    when length(btrim(goal)) < 12 then 'Thin goal — check before inviting'
    else 'Looks qualified'
  end as first_read
from public.beta_applications
order by created_at desc;
