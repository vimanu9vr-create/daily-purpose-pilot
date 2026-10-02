-- The morning notification repeated itself, forever.
--
-- `buildNotification` prefers the next INCOMPLETE programme day:
--
--     body = day?.intention ?? affirmationText ?? fallback
--
-- and a day only becomes complete when somebody opens the app and finishes
-- the practice. So anyone who doesn't open the app gets
--
--     "Your day 1 practice is ready"
--
-- with the identical intention, every morning, indefinitely. The people it
-- repeats at hardest are exactly the people who aren't opening the app — the
-- ones the nudge exists for — and nothing teaches someone to swipe a
-- notification away faster than one they have already read.
--
-- The affirmation path was fine all along: 661 affirmations, rotated by
-- `last_shown_at`, stamped after each send. It was simply never reached,
-- because the programme day always won.
--
-- This column records WHICH day we last spoke about, so the sender can tell
-- "day 3 is new" from "day 3 again". Nullable: null means we have never sent
-- a programme day to this person, which is different from day 0.

alter table public.profiles
  add column if not exists last_notified_day integer;

comment on column public.profiles.last_notified_day is
  'The programme day_number the last morning notification spoke about, or null '
  'if the last one carried an affirmation instead. Lets the sender avoid '
  'repeating the same day verbatim when a programme has stalled.';

-- The claim has to hand this back, or the sender has nothing to compare
-- against. Same shape as before plus one column — `returns table` means the
-- signature changes, so drop first.
drop function if exists public.claim_due_morning_pushes(integer);

create function public.claim_due_morning_pushes(p_limit integer default 200)
returns table (
  profile_id uuid,
  profile_name text,
  sent_for date,
  last_day integer
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
    -- The OLD value, read before this statement's own update lands. That is
    -- what "which day did we last mention" means, and reading it afterwards
    -- would always compare a value against itself.
    returning p.id, p.display_name, p.last_notified_on, p.last_notified_day
  )
  select id, display_name, last_notified_on, last_notified_day from claimed;
$fn$;

revoke all on function public.claim_due_morning_pushes(integer) from public, anon, authenticated;

-- Check afterwards:
--
--   select id, last_notified_on, last_notified_day from profiles
--    where notifications_enabled;
--
-- After a morning where somebody was sent day 3, last_notified_day is 3. The
-- next morning, if they still haven't finished day 3, the sender sees 3 == 3
-- and sends an affirmation instead — and sets last_notified_day to null, so
-- the morning after that the day is new again and worth repeating once.
