-- The morning notification has never fired successfully. Not once.
--
-- The cron job's Authorization header was the literal string
-- 'Bearer PASTE_SERVICE_ROLE_KEY_HERE' — a placeholder nobody replaced. It ran
-- every fifteen minutes and was rejected 401 every single time: 96 rejections
-- in the last twenty-four hours alone. Nothing anywhere said so, because a
-- cron job has nobody to tell.
--
-- BEFORE RUNNING THIS, store the key once (Dashboard → Project Settings →
-- Vault → New secret), named exactly:
--
--     service_role_key
--
-- The value is your service role key, from Project Settings → API. Put it in
-- Vault rather than in this file: anything pasted into a migration is in git
-- forever, and anything pasted into cron.job is readable by whoever can read
-- that table and ends up in every backup.
--
-- Two changes here:
--
-- 1. The key is read from Vault at call time, so it never appears in the job
--    definition, this file, or a database dump.
--
-- 2. Hourly rather than every fifteen minutes. The function already decides
--    who is due from each person's chosen time, so three of every four calls
--    were doing nothing.

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
      'Authorization', 'Bearer ' || service_key
    ),
    body    := '{}'::jsonb
  );
end;
$$;

-- Replace the old job. Unschedule by name is safer than by id, but the
-- original was created without one, so it has to go by id 1.
select cron.unschedule(1);

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
