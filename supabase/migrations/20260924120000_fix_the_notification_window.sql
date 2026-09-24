-- The morning notification could only ever fire for a third of users.
--
-- Two pieces that were written weeks apart and never checked against each
-- other:
--
--   the cron runs   '0 * * * *'          -- once an hour, on the hour
--   the claim needs (now - notify_time) between 0 and 19 minutes
--
-- A user is claimed only if their notify time fell inside the twenty minutes
-- before a cron run. The cron only runs on the hour. So the only settings
-- that could ever produce a notification were the ones whose minute happened
-- to land in that window — and which minutes those are depends on the
-- timezone offset:
--
--   UTC        :00 and :41-:59      20 of 60 minutes
--   India      :11-:30              20 of 60 minutes   (UTC+5:30)
--   New York   :00 and :41-:59      20 of 60 minutes
--
-- Forty minutes in every hour were unreachable. Someone who set 7:00am in
-- India would never be notified, ever, and nothing anywhere would log an
-- error — the claim query simply returned no rows, which is exactly what it
-- returns when genuinely nobody is due. A silent, correct-looking no-op.
--
-- THE FIX IS THE CRON, NOT THE WINDOW.
--
-- Widening the window to a full hour would work, but it would also mean a
-- 7:00am notification could arrive at 7:59. Running every fifteen minutes
-- keeps the promise the setting makes: worst case is about fifteen minutes
-- late, and every minute of the hour is now reachable.
--
-- The window goes to 0..29 rather than staying at 0..19 so that two
-- consecutive runs overlap. If one run fails or is delayed, the next still
-- catches the user instead of skipping their day. That cannot double-send:
-- claim_due_morning_pushes sets last_notified_on inside the same statement
-- that selects, with FOR UPDATE SKIP LOCKED, so a second run sees them as
-- already notified today.

select cron.unschedule('morning-affirmations');

select cron.schedule(
  'morning-affirmations',
  '*/15 * * * *',
  $$select public.send_morning_affirmations();$$
);

create or replace function public.claim_due_morning_pushes(p_limit integer default 200)
returns table (profile_id uuid, profile_name text, sent_for date)
language sql
security definer
set search_path = public, pg_temp
as $fn$
  with claimed as (
    update public.profiles p
       set last_notified_on = public.local_now(p.timezone)::date
     where p.id in (
       select candidate.id
         from public.profiles candidate
        where candidate.notifications_enabled
          and candidate.last_notified_on is distinct from
              public.local_now(candidate.timezone)::date
          and ((extract(hour from public.local_now(candidate.timezone))::int * 60
              + extract(minute from public.local_now(candidate.timezone))::int)
             - (candidate.notify_hour * 60 + candidate.notify_minute))
              between 0 and 29
        order by candidate.id
        limit least(greatest(coalesce(p_limit, 200), 1), 1000)
        for update skip locked
     )
    returning p.id, p.display_name, p.last_notified_on
  )
  select id, display_name, last_notified_on from claimed;
$fn$;

-- Check afterwards:
--
--   select jobname, schedule, active from cron.job;
--   select status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 10;
--
-- And to see whether anyone is actually eligible, which is a separate
-- question from whether the cron works:
--
--   select id, notifications_enabled, notify_hour, notify_minute,
--          timezone, last_notified_on
--     from profiles;
--   select count(*) from push_subscriptions;
--
-- A profile with notifications_enabled = false, or zero push_subscriptions
-- rows, produces exactly the same silence as this bug did. All three have to
-- be true before a phone lights up.
