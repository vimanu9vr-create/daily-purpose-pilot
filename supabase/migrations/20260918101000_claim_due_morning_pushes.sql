-- Work out who is due for the morning push, in the database, and claim them.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS WRONG
-- ---------------------------------------------------------------------------
--
-- `send-daily-affirmation` decided who was due in TypeScript. To do that it
-- had to fetch every profile with notifications enabled — no limit, no
-- pagination — pull all of them over HTTP into a Deno function, and filter
-- them in memory:
--
--     GET /rest/v1/profiles?...&notifications_enabled=is.true
--     const due = profiles.filter((p) => isDue(p, now));
--
-- At twelve profiles that is invisible. At a million it is a million rows
-- serialised to JSON and streamed into a function with a fixed memory budget
-- and a hard wall clock, once an hour, to find the few thousand rows that
-- mattered. It would not merely be slow; it would fail to finish, and the
-- users who happened to sort late would silently never be notified.
--
-- The filter belongs where the data is. Postgres knows every IANA timezone,
-- so "is it 07:00 where this person lives" is a predicate, not an export.
--
-- ---------------------------------------------------------------------------
-- WHY IT CLAIMS RATHER THAN SELECTS
-- ---------------------------------------------------------------------------
--
-- The old function read the due list, sent the pushes, and only then wrote
-- `last_notified_on` — one PATCH per user, at the end of a long loop. Two runs
-- overlapping (a slow run still going when the next hour fires, or the
-- self-chaining the rewritten function now does) would both see the same
-- people as due and both send. Being notified twice is worse than being
-- notified late; it is the thing that makes people turn notifications off.
--
-- So this function marks and returns in a single statement. `for update skip
-- locked` means concurrent callers step over rows another caller has already
-- taken, which is what lets the edge function safely run several invocations
-- at once and have them partition the work between themselves with no
-- coordination.
--
-- The trade-off, stated plainly: a user is marked as notified before the push
-- is attempted, so a push that fails is not retried until tomorrow. That is
-- deliberate. The alternative — mark after sending — reintroduces the
-- double-send, and a missed morning is a smaller harm than two buzzes.
--
-- ---------------------------------------------------------------------------
-- THE REMAINING CEILING, HONESTLY
-- ---------------------------------------------------------------------------
--
-- This still walks the profiles that have notifications enabled once per run,
-- because the due-ness of a row depends on its own timezone and cannot be
-- looked up from an index directly. The partial index in the previous
-- migration keeps that walk to the enabled subset only, which is fine into the
-- low millions on a hourly job.
--
-- Past that, the fix is to stop computing it at read time: store a
-- `next_notify_at timestamptz` on the profile, maintained by a trigger when
-- the time or timezone changes and rolled forward when a push is sent, and
-- index it. Then the query becomes a range scan over a b-tree and the cost
-- stops depending on how many users exist at all. That is a bigger change
-- than is justified today and it is written down here so it is a decision
-- rather than an oversight.
-- ---------------------------------------------------------------------------

-- The user's own wall clock. An unrecognised timezone string must not take
-- down the entire morning send for everybody, so it degrades to UTC rather
-- than raising.
create or replace function public.local_now(tz text)
returns timestamp
language plpgsql
stable
as $$
begin
  return now() at time zone coalesce(nullif(btrim(tz), ''), 'UTC');
exception when others then
  return now() at time zone 'UTC';
end;
$$;

comment on function public.local_now(text) is
  'Current wall-clock time in the given IANA timezone, falling back to UTC for null, blank or unrecognised values.';

/**
 * Claims up to p_limit profiles that are due a morning push right now.
 *
 * Due means: notifications are on, their local time is inside a twenty-minute
 * window starting at their chosen time, and they have not already been sent
 * one on their own local date. The window absorbs cron jitter; the
 * last_notified_on check is what makes it idempotent within the window.
 *
 * Returns the profiles it has just marked. Anything it returns WILL NOT be
 * returned again today, to this caller or any other.
 */
-- Written as `language sql`, not plpgsql, for two specific reasons.
--
-- First, PL/pgSQL's `return query` takes a SELECT. `return query update ...
-- returning ...` is not valid and fails at CREATE time — the data-modifying
-- statement has to be wrapped in a CTE and selected from, which is what this
-- does, and at that point plpgsql adds nothing.
--
-- Second, the output columns are deliberately NOT named `id` / `display_name`.
-- Under `returns table` those names become variables in plpgsql, and a
-- variable sharing a name with a column in the same statement is how you get
-- an "ambiguous reference" error at call time rather than at deploy time. The
-- names here cannot collide with anything in `profiles`.
create or replace function public.claim_due_morning_pushes(p_limit integer default 200)
returns table (profile_id uuid, profile_name text, sent_for date)
language sql
security definer
set search_path = public, pg_temp
as $$
  with claimed as (
    update public.profiles p
       set last_notified_on = public.local_now(p.timezone)::date
     where p.id in (
       select candidate.id
         from public.profiles candidate
        where candidate.notifications_enabled
          and candidate.last_notified_on
                is distinct from public.local_now(candidate.timezone)::date
          and (
                (extract(hour   from public.local_now(candidate.timezone))::int * 60
               + extract(minute from public.local_now(candidate.timezone))::int)
              - (candidate.notify_hour * 60 + candidate.notify_minute)
              ) between 0 and 19
        order by candidate.id
        -- Clamped rather than trusted. A caller passing a huge limit would
        -- recreate the original problem of loading an unbounded set into one
        -- function invocation, which is the whole thing this replaces.
        limit least(greatest(coalesce(p_limit, 200), 1), 1000)
        for update skip locked
     )
    returning p.id, p.display_name, p.last_notified_on
  )
  select id, display_name, last_notified_on from claimed;
$$;

comment on function public.claim_due_morning_pushes(integer) is
  'Atomically marks and returns the profiles due a morning push. Safe to call concurrently; callers partition the work via SKIP LOCKED. A returned row will not be returned again on the same local date.';

-- Only the service role runs this. It is SECURITY DEFINER and it writes to
-- every profile row, so it must not be reachable from a browser session.
revoke all on function public.claim_due_morning_pushes(integer) from public;
revoke all on function public.claim_due_morning_pushes(integer) from anon;
revoke all on function public.claim_due_morning_pushes(integer) from authenticated;
grant execute on function public.claim_due_morning_pushes(integer) to service_role;

revoke all on function public.local_now(text) from public;
revoke all on function public.local_now(text) from anon;
grant execute on function public.local_now(text) to authenticated;
grant execute on function public.local_now(text) to service_role;
