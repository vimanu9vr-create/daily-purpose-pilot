-- The morning push nags people who already practised, and never stops for
-- people who left.
--
-- ---------------------------------------------------------------------------
-- TWO FAULTS, ONE EXPRESSION
-- ---------------------------------------------------------------------------
--
-- 1. NO SUPPRESSION. `claim_due_morning_pushes` selects on the time window and
--    `last_notified_on`, and nothing else. Someone who practises at 06:30
--    still gets the 07:00 push telling them their five minutes are ready.
--    Being told to do a thing you have just done is the fastest way to lose
--    notification permission, and it lands hardest on the best users — the
--    early risers holding streaks.
--
-- 2. NO TAPER. `days_away` is computed and used to pick the wording, but
--    nothing caps it. Somebody ninety days gone keeps receiving a push every
--    morning forever. That is not re-engagement; it is the thing people
--    uninstall over, and a wall of ignored notifications is also how an app
--    quietly loses standing with FCM.
--
-- Both collapse into one number — whole days since the person last practised —
-- so this adds `days_idle` and one CASE rather than two separate guards.
--
--     idle <= 0   practised today        → send nothing
--     idle 1-7    recently active        → daily, as now
--     idle 8-45   drifting               → once a week
--     idle > 45   gone                   → stop, and leave the door open
--
-- Someone who has never practised counts from the day they signed up, so a new
-- account gets a week of daily nudges and then tapers like everybody else
-- instead of being nagged forever about a practice they never began.

-- ---------------------------------------------------------------------------
-- WHICH "TODAY"
-- ---------------------------------------------------------------------------
--
-- practice_sessions.for_date is written by the client as the user's LOCAL
-- date — see localDateKey() in src/features/actions/use-actions.ts, which
-- builds it from getFullYear/getMonth/getDate. The column's UTC default only
-- applies to rows the client did not set.
--
-- So the comparison here is local-to-local, via local_now(timezone). Using
-- current_date would be wrong by a day for anyone far enough from UTC, and
-- wrong in the dangerous direction: it would suppress a real notification, or
-- fire one at somebody who had just finished.
--
-- (Note for later: the streak maths further down the claim function still
-- compares these local dates against current_date. Same latent off-by-one,
-- pre-existing, and not fixed here because it changes wording rather than
-- whether anything is sent.)

create or replace function public.days_idle(
  p_user uuid,
  p_timezone text,
  p_joined date
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.local_now(p_timezone)::date
       - coalesce(
           (select max(ps.for_date)
              from public.practice_sessions ps
             where ps.user_id = p_user),
           p_joined
         );
$$;

revoke all on function public.days_idle(uuid, text, date) from public, anon, authenticated;

-- max(for_date) per user runs once per candidate per morning. Cheap now,
-- linear in sessions later; this keeps it an index-only lookup.
create index if not exists practice_sessions_user_date_idx
  on public.practice_sessions (user_id, for_date desc);

drop function if exists public.claim_due_morning_pushes(integer);

create function public.claim_due_morning_pushes(p_limit integer default 200)
returns table (
  profile_id uuid,
  profile_name text,
  sent_for date,
  last_day integer,
  streak integer,
  days_away integer,
  desire text
)
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
          -- Suppression and taper, in one decision.
          and case
                when public.days_idle(candidate.id, candidate.timezone,
                                      candidate.created_at::date) <= 0
                  -- Already practised today. Nothing to prompt.
                  then false
                when public.days_idle(candidate.id, candidate.timezone,
                                      candidate.created_at::date) <= 7
                  -- Active, or newly joined. Daily, as before.
                  then true
                when public.days_idle(candidate.id, candidate.timezone,
                                      candidate.created_at::date) <= 45
                  -- Drifting. Once a week, on a weekday derived from the user
                  -- id rather than a fixed one — otherwise every lapsed user
                  -- in the system wakes up on the same morning, which is both
                  -- a thundering herd and a visible pattern to the recipient.
                  -- The double modulo keeps it in 0..6 even when hashtext
                  -- returns a negative.
                  then extract(dow from public.local_now(candidate.timezone))::int
                       = ((hashtext(candidate.id::text) % 7) + 7) % 7
                -- Gone. Stop. Their account, data and streak history are all
                -- still there whenever they come back on their own.
                else false
              end
        order by candidate.id
        limit least(greatest(coalesce(p_limit, 200), 1), 1000)
        for update skip locked
     )
    returning p.id, p.display_name, p.last_notified_on, p.last_notified_day
  ),
  practice_days as (
    select distinct user_id, for_date
      from public.practice_sessions
     where user_id in (select id from claimed)
  ),
  runs as (
    select user_id,
           for_date,
           for_date - (row_number() over (partition by user_id order by for_date))::int as grp
      from practice_days
  ),
  current_run as (
    select user_id, count(*)::int as len, max(for_date) as last_day
      from runs
     group by user_id, grp
  ),
  streaks as (
    select user_id,
           max(case when last_day >= current_date - 1 then len else 0 end) as streak,
           (current_date - max(last_day))::int as days_away
      from current_run
     group by user_id
  ),
  wants as (
    select distinct on (user_id) user_id, title
      from public.desires
     where user_id in (select id from claimed) and is_active
     order by user_id, created_at desc
  )
  select c.id,
         c.display_name,
         c.last_notified_on,
         c.last_notified_day,
         s.streak,
         s.days_away,
         w.title
    from claimed c
    left join streaks s on s.user_id = c.id
    left join wants   w on w.user_id = c.id;
$fn$;

revoke all on function public.claim_due_morning_pushes(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- CHECK IT, WITHOUT SENDING ANYTHING
-- ---------------------------------------------------------------------------
--
-- What every notified user would be classified as right now:
--
--   select p.id,
--          public.days_idle(p.id, p.timezone, p.created_at::date) as idle,
--          case
--            when public.days_idle(p.id, p.timezone, p.created_at::date) <= 0 then 'practised today — silent'
--            when public.days_idle(p.id, p.timezone, p.created_at::date) <= 7  then 'daily'
--            when public.days_idle(p.id, p.timezone, p.created_at::date) <= 45 then 'weekly'
--            else 'stopped'
--          end as cadence
--     from public.profiles p
--    where p.notifications_enabled
--    order by idle;
--
-- The row that proves fault 1 is fixed: anyone with idle = 0 must read
-- "practised today — silent". Before this migration they were sent a push
-- telling them to do the practice they had just finished.
