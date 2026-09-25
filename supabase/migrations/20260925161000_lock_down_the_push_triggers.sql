-- Anybody could fire the push jobs.
--
-- `send_morning_affirmations()` and `send_evening_gratitude()` are SECURITY
-- DEFINER, which means they run with the owner's rights — and because they
-- live in `public`, PostgREST exposes them at
--
--     POST /rest/v1/rpc/send_morning_affirmations
--     POST /rest/v1/rpc/send_evening_gratitude
--
-- with EXECUTE granted to `anon` by default. Anyone with the publishable key,
-- which ships inside the app by design, could call either one in a loop from
-- a laptop.
--
-- What that costs: each call posts to an edge function that reads the vault,
-- mints an FCM token and walks every due profile. It cannot send someone two
-- notifications in a day — last_notified_on is stamped inside the claiming
-- statement — but it can burn function invocations, FCM quota and database
-- work at whatever rate the attacker likes. A free-tier project is not hard
-- to exhaust.
--
-- I revoked EXECUTE on claim_due_evening_gratitude when I wrote it and did
-- not think to do the same for the wrapper that calls it. The morning one has
-- been open since August.
--
-- pg_cron calls these as the postgres superuser, which is unaffected by these
-- revokes, so the scheduled runs keep working exactly as they do now.

revoke all on function public.send_morning_affirmations() from public, anon, authenticated;
revoke all on function public.send_evening_gratitude() from public, anon, authenticated;

-- Belt and braces for the claim functions too. The evening one was already
-- revoked at creation; the morning one never was.
revoke all on function public.claim_due_morning_pushes(integer) from public, anon, authenticated;
revoke all on function public.claim_due_evening_gratitude(integer) from public, anon, authenticated;

-- `local_now` had a role-mutable search_path. It is called from inside both
-- claim functions, which are SECURITY DEFINER — so a caller who could set
-- their own search_path could, in principle, have it resolve a different
-- `now()` or a different timezone table than intended. Pinning it removes
-- the question.
-- Body kept EXACTLY as it was. The only change is the search_path line.
--
-- My first draft of this rewrote it as `language sql` with a one-line select,
-- which silently dropped the exception handler. That handler is the reason a
-- profile carrying a junk timezone string falls back to UTC instead of
-- throwing — and it is called from inside the claim functions, so a throw
-- would abort the whole run and nobody would get a notification that day
-- because of one bad row. Caught by reading the original before replacing it.
create or replace function public.local_now(tz text)
returns timestamp
language plpgsql
stable
set search_path = public, pg_catalog, pg_temp
as $fn$
begin
  return now() at time zone coalesce(nullif(btrim(tz), ''), 'UTC');
exception when others then
  return now() at time zone 'UTC';
end;
$fn$;

-- Verify afterwards:
--
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'execute') as anon_can_call,
--          has_function_privilege('authenticated', p.oid, 'execute') as user_can_call
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('send_morning_affirmations', 'send_evening_gratitude',
--                        'claim_due_morning_pushes', 'claim_due_evening_gratitude');
--
-- All four should read false, false. The cron jobs run as postgres and are
-- not affected.
--
-- Still outstanding and NOT fixed here, deliberately:
--
--   pg_net is installed in the `public` schema. Moving an extension is the
--   kind of change that breaks callers silently, and every scheduled push
--   depends on net.http_post. Worth doing, not worth doing days before a
--   production submission.
--
--   Leaked password protection is off. That is a dashboard toggle —
--   Authentication → Policies → enable "Check against HaveIBeenPwned" — and
--   it costs nothing to turn on.
