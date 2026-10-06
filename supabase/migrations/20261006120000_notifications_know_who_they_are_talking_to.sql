-- The morning notification knows the day number and nothing else about you.
--
-- `voice.ts` can already change its wording for someone mid-streak versus
-- someone who has been away a week — the lines are written and the branch
-- exists. It just never fires, because `claim_due_morning_pushes` returns a
-- name and a day and the sender has no way to tell those two people apart.
--
-- So everybody gets the on-track copy, including the person who last opened
-- the app eleven days ago. That is the wrong message for them twice over: it
-- assumes a streak they have broken, and it spends the one notification they
-- might still read on a line written for somebody else.
--
-- This adds the three signals the copy actually branches on. All three are
-- derived at claim time rather than stored, so nothing can drift out of date
-- and no new column needs maintaining.

drop function if exists public.claim_due_morning_pushes(integer);

create function public.claim_due_morning_pushes(p_limit integer default 200)
returns table (
  profile_id uuid,
  profile_name text,
  sent_for date,
  last_day integer,
  -- Consecutive days ending today or yesterday. Null when they have never
  -- practised, which reads differently from zero: zero is a streak that broke,
  -- null is someone who has not started.
  streak integer,
  -- Whole days since the last practice session. Null when there has never
  -- been one. The copy switches to the returning set at three.
  days_away integer,
  -- Their own words, for the line that names what they are still owed.
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
        order by candidate.id
        limit least(greatest(coalesce(p_limit, 200), 1), 1000)
        for update skip locked
     )
    -- The OLD last_notified_day, read before this statement's own update
    -- lands. Reading it afterwards would compare a value against itself.
    returning p.id, p.display_name, p.last_notified_on, p.last_notified_day
  ),
  -- One row per person per day they practised. `distinct` matters: somebody
  -- who opens the app twice on a Tuesday has practised one day, not two, and
  -- without this the streak inflates for exactly the most engaged users.
  practice_days as (
    select distinct user_id, for_date
      from public.practice_sessions
     where user_id in (select id from claimed)
  ),
  -- Classic gaps-and-islands: subtracting a dense rank from the date leaves a
  -- constant for any run of consecutive days, so grouping on it finds the runs.
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
           -- Only count the run if it reaches yesterday. A five-day streak
           -- that ended in March is not a streak, and congratulating someone
           -- on it is worse than saying nothing.
           max(case when last_day >= current_date - 1 then len else 0 end) as streak,
           (current_date - max(last_day))::int as days_away
      from current_run
     group by user_id
  ),
  -- Their most recent active desire, for the "still yours" line.
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

-- Check afterwards, without claiming anybody:
--
--   select user_id, count(distinct for_date) from practice_sessions group by 1;
--
-- Somebody who practised Monday, Tuesday and Wednesday should come back with
-- streak 3 and days_away 0 on Thursday morning; the same person on the
-- following Monday should be streak 0, days_away 5 — and get the returning
-- copy rather than a line congratulating them on a streak they lost.
