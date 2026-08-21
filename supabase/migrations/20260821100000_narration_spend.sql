-- A record of every narration we pay for, so a daily cap can exist.
--
-- Until now nothing counted. One person opening the app on a slow afternoon
-- could consume an entire month's ElevenLabs allowance without anything
-- noticing, and the first sign was every user losing their voice at once —
-- which is exactly what happened.
--
-- Deliberately a ledger rather than a counter on `profiles`. A counter tells
-- you a number; a ledger tells you which tracks, how long they were and when,
-- which is what answers "why did this cost so much" a month later. We have
-- just spent a week unable to answer that.
create table if not exists public.narration_spend (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  moment_id uuid references public.moments(id) on delete set null,
  characters integer not null,
  -- False when we served a file that already existed. Cached hits are recorded
  -- too: the hit rate is how you tell a caching problem from a usage problem.
  billed boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_narration_spend_user_day
  on public.narration_spend(user_id, created_at desc);

alter table public.narration_spend enable row level security;

-- Readable by the person it belongs to, so the app can show "2 of 2 today"
-- without a round trip through an edge function. Only the service role writes.
create policy "narration_spend_own_read" on public.narration_spend
  for select to authenticated using (auth.uid() = user_id);

grant select on public.narration_spend to authenticated;
grant all on public.narration_spend to service_role;
