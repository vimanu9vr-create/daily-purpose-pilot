-- The morning notification has never fired successfully. Not once.
--
-- The cron job's Authorization header was the literal string
-- 'Bearer PASTE_SERVICE_ROLE_KEY_HERE' — a placeholder nobody replaced. It ran
-- every fifteen minutes and was rejected 401 every single time: 96 rejections
-- in the last twenty-four hours alone. Nothing anywhere said so, because a
-- cron job has nobody to tell.
--
-- BEFORE RUNNING THIS, store the key once in Vault (find it with Cmd+K →
-- "Vault" in the Dashboard), named exactly:
--
--     service_role_key
--
-- The value comes from Settings → API Keys. EITHER key type works — see the
-- note on headers below. Put it in Vault rather than in this file: anything
-- pasted into a migration is in git forever, and anything pasted into cron.job
-- is readable by whoever can read that table and ends up in every backup.
--
-- Three changes here:
--
-- 1. The key is read from Vault at call time, so it never appears in the job
--    definition, this file, or a database dump.
--
-- 2. Hourly rather than every fifteen minutes. The function already decides
--    who is due from each person's chosen time, so three of every four calls
--    were doing nothing.
--
-- 3. The key is sent on BOTH `Authorization` and `apikey`, because Supabase
--    now has two kinds of key and they travel differently.
--
--    The legacy `service_role` key is a JWT — it starts `eyJ` — and belongs on
--    `Authorization: Bearer`. The newer secret keys start `sb_secret_` and are
--    not JWTs at all; Supabase's own documentation says they go on `apikey`,
--    and that anything trying to verify one as a JWT will fail.
--
--    Sending both is not belt-and-braces for its own sake. It means this job
--    does not silently break on the day the legacy keys are switched off — they
--    are deprecated at the end of 2026 — and it means whoever sets this up
--    cannot pick the wrong one. A cron job has nobody to tell when it starts
--    failing, which is the entire reason this file exists, so the failure mode
--    is worth designing out rather than documenting.

create or replace function public.send_morning_affirmations()
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

  -- Say so, rather than posting an empty Bearer and collecting silent 401s.
  -- The whole reason this went unnoticed for so long is that failure looked
  -- exactly like success from outside the database.
  if service_key is null then
    raise warning 'send_morning_affirmations: no service_role_key in vault; skipping';
    return;
  end if;

  perform net.http_post(
    url     := 'https://pkxkksamenqcvsaulceq.supabase.co/functions/v1/send-daily-affirmation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- Legacy JWT service_role keys are read from here.
      'Authorization', 'Bearer ' || service_key,
      -- New sb_secret_ keys are read from here. Whichever kind is in Vault,
      -- one of these two is the one that counts and the other is ignored.
      'apikey', service_key
    ),
    body    := '{}'::jsonb
  );
end;
$$;

-- Replace the old job.
--
-- This line used to read `select cron.unschedule(1)`, on the belief that the
-- original job had no name and so could only be removed by id. It does have a
-- name — `daily-affirmation` — and hardcoding the id was fragile twice over: it
-- breaks if the id is ever different, and `cron.unschedule` RAISES when it
-- finds nothing rather than returning quietly. In a migration that means the
-- whole transaction aborts and none of the work above gets applied, which
-- looks exactly like the file having done nothing at all.
--
-- So: remove whatever is currently pointed at this job, by name, whatever it
-- is called, and don't fail when there is nothing to remove. Re-running this
-- file is then safe, which matters because the first attempt at it wasn't.
do $$
declare
  job record;
begin
  for job in
    select jobname
    from cron.job
    where jobname in ('daily-affirmation', 'morning-affirmations')
       or command ilike '%send_morning_affirmations%'
       or command ilike '%send-daily-affirmation%'
  loop
    perform cron.unschedule(job.jobname);
    raise notice 'unscheduled %', job.jobname;
  end loop;
end;
$$;

select cron.schedule(
  'morning-affirmations',
  '0 * * * *',
  $$select public.send_morning_affirmations();$$
);

-- Check it afterwards:
--
--   select jobid, jobname, schedule, active from cron.job;
--   select status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 5;
--
-- A run that finds no secret logs a warning and returns; it does not post.
--
-- ---------------------------------------------------------------------------
-- THIS ALONE WILL NOT MAKE A NOTIFICATION APPEAR.
-- ---------------------------------------------------------------------------
--
-- The chain is broken in three independent places, and all three have to be
-- true before anybody's phone lights up. Fixing one and testing would show
-- nothing, conclude nothing, and cost another round of "it's still not
-- working" — so all three are written down here.
--
--   1. THE CRON  — what this file fixes. 401 on every run.
--
--   2. THE SWITCH — `profiles.notifications_enabled` is false for the only
--      profile that exists. The function selects people who are due; nobody
--      is eligible. Turn it on in the app: Profile → Notifications → Turn on.
--      That is also what registers the device, so it does 2 and 3 together.
--
--   3. THE DEVICE — `push_subscriptions` has zero rows. Even with a working
--      cron and the switch on, there is nowhere to send. A browser only
--      registers on a real permission grant, which has never been given.
--
-- Verify all three at once:
--
--   select
--     (select count(*) from cron.job where active) as jobs,
--     (select count(*) from profiles where notifications_enabled) as switched_on,
--     (select count(*) from push_subscriptions) as devices;
--
-- All three greater than zero, or the morning stays quiet.
