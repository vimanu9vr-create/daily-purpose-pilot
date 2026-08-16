-- Stop `rls_auto_enable` being callable through the public API.
--
-- WHAT THIS FUNCTION ACTUALLY IS, because the advisor makes it sound worse
-- than it is: it's a safety net, not a hole. It's an event trigger that runs
-- after any CREATE TABLE in `public` and turns on row-level security for the
-- new table. It is the reason the `programmes` tables came out with RLS
-- already enabled. We want to keep it.
--
-- The warning is still correct on its own terms. Supabase exposes every
-- function in `public` at /rest/v1/rpc/<name>, so both `anon` and
-- `authenticated` can call this one, and it runs as SECURITY DEFINER — with
-- the privileges of its owner rather than the caller's.
--
-- In practice a direct call can't do anything: the body's first act is
-- `pg_event_trigger_ddl_commands()`, which errors outside a DDL event trigger,
-- so the loop never runs. And the only thing it could do is switch RLS ON,
-- which fails safe.
--
-- Revoking anyway, for two reasons. A SECURITY DEFINER function reachable by
-- unauthenticated callers is worth zero regardless of how harmless today's
-- body is — the next person to edit it may not realise who can reach it. And
-- leaving a known warning in the advisor list trains you to ignore the list,
-- which is how the one that matters gets missed.
--
-- Event triggers fire as part of DDL execution rather than through the API, so
-- removing EXECUTE from these roles does not affect the auto-RLS behaviour.

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
