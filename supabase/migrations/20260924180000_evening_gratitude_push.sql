-- An evening gratitude notification, alongside the morning practice one.
--
-- This also fixes something the row counts exposed: `journals` has 2 entries
-- across 12 accounts, and the reason is that the gratitude screen — which is
-- where gratitude is actually written, as a journal entry under a fixed
-- prompt — is reachable from nowhere in the app. No link, no tab, no button.
-- A nightly notification that deep-links straight to it is the entry point it
-- never had.
--
-- Deliberately a SEPARATE function and cron job rather than a mode flag on
-- the morning one. The morning path does programme lookups, affirmation
-- rotation, batching and chained invocations for fan-out, and it only started
-- working this morning. Threading a second behaviour through it days before a
-- production submission is how you end up with neither working.

alter table public.profiles
  add column if not exists evening_enabled boolean not null default false,
  add column if not exists evening_hour integer not null default 21,
  add column if not exists evening_minute integer not null default 0,
  add column if not exists last_evening_on date;

alter table public.profiles
  drop constraint if exists profiles_evening_hour_check,
  drop constraint if exists profiles_evening_minute_check;

alter table public.profiles
  add constraint profiles_evening_hour_check
    check (evening_hour between 0 and 23),
  add constraint profiles_evening_minute_check
    check (evening_minute between 0 and 59);

-- Mirrors the morning index. Without it the claim query below seq-scans
-- profiles every fifteen minutes forever.
create index if not exists profiles_evening_due_idx
  on public.profiles (evening_hour, evening_minute)
  where evening_enabled;

-- The same claim shape as the morning one, and for the same reasons: the
-- due-ness is computed in Postgres rather than by loading every profile into
-- a function, and the row is marked as notified inside the same statement
-- that selects it, under FOR UPDATE SKIP LOCKED, so two overlapping runs
-- cannot both send.
--
-- Window is 0..29 against a 15-minute cron, which is what the morning job was
-- corrected to this morning. A 20-minute window against an hourly cron made
-- two thirds of possible times unreachable; the same mistake is not repeated
-- here.
create or replace function public.claim_due_evening_gratitude(p_limit integer default 200)
returns table (profile_id uuid, profile_name text, sent_for date)
language sql
security definer
set search_path = public, pg_temp
as $fn$
  with claimed as (
    update public.profiles p
       set last_evening_on = public.local_now(p.timezone)::date
     where p.id in (
       select candidate.id
         from public.profiles candidate
        where candidate.evening_enabled
          and candidate.last_evening_on is distinct from
              public.local_now(candidate.timezone)::date
          and ((extract(hour from public.local_now(candidate.timezone))::int * 60
              + extract(minute from public.local_now(candidate.timezone))::int)
             - (candidate.evening_hour * 60 + candidate.evening_minute))
              between 0 and 29
        order by candidate.id
        limit least(greatest(coalesce(p_limit, 200), 1), 1000)
        for update skip locked
     )
    returning p.id, p.display_name, p.last_evening_on
  )
  select id, display_name, last_evening_on from claimed;
$fn$;

revoke all on function public.claim_due_evening_gratitude(integer) from public, anon, authenticated;

create or replace function public.send_evening_gratitude()
returns void
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  service_key text;
begin
  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  if service_key is null then
    raise warning 'send_evening_gratitude: no service_role_key in vault; skipping';
    return;
  end if;

  perform net.http_post(
    url     := 'https://pkxkksamenqcvsaulceq.supabase.co/functions/v1/send-evening-gratitude',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key,
      'apikey', service_key
    ),
    body    := '{}'::jsonb
  );
end;
$$;

do $$
declare job record;
begin
  for job in select jobname from cron.job where jobname = 'evening-gratitude' loop
    perform cron.unschedule(job.jobname);
  end loop;
end;
$$;

select cron.schedule(
  'evening-gratitude',
  '*/15 * * * *',
  $$select public.send_evening_gratitude();$$
);

-- Check afterwards:
--
--   select jobname, schedule, active from cron.job;
--   select id, evening_enabled, evening_hour, evening_minute, last_evening_on
--     from profiles;
--
-- Nobody receives this until they turn it on: evening_enabled defaults to
-- false, so existing users are not opted into a new nightly push without
-- being asked. That is deliberate — a notification someone didn't agree to is
-- the fastest way to lose the notification permission entirely.
