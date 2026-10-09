-- Close a free-lifetime-access hole opened by 20261009120000_lifetime_grants.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS WRONG
-- ---------------------------------------------------------------------------
--
-- That migration locked down the pending_grants TABLE and then stopped:
--
--   revoke all on public.pending_grants from anon, authenticated;
--
-- which is correct and also irrelevant, because the entitlement is written by
-- a FUNCTION, and Postgres grants EXECUTE on every new function to PUBLIC by
-- default. apply_lifetime_grant is SECURITY DEFINER and lives in the `public`
-- schema, so PostgREST exposed it at:
--
--   POST /rest/v1/rpc/apply_lifetime_grant
--
-- Anyone holding the publishable key — which ships in the frontend bundle and
-- is meant to be public — could call it with their own user id and grant
-- themselves 'standard_lifetime' for nothing. Locking the table while leaving
-- the function open protected the filing cabinet and left the cheque book out.
--
-- No evidence it was used: pending_grants was created and this was applied in
-- the same session. The verification query at the bottom confirms the state.
--
-- ---------------------------------------------------------------------------
-- THE FIX
-- ---------------------------------------------------------------------------
--
-- REVOKE FROM PUBLIC is the one that matters. Revoking from anon and
-- authenticated alone would leave the default PUBLIC grant intact and change
-- nothing — the roles inherit it.

revoke all on function public.apply_lifetime_grant(uuid, text, text, text, text)
  from public, anon, authenticated;

revoke all on function public.redeem_pending_grants()
  from public, anon, authenticated;

-- redeem_pending_grants is a trigger function, so a direct RPC call would be
-- rejected by Postgres regardless ("trigger functions can only be called as
-- triggers"). Revoked anyway: relying on that error message is relying on an
-- implementation detail to enforce a security boundary.

-- ---------------------------------------------------------------------------
-- WHO STILL NEEDS TO CALL THESE
-- ---------------------------------------------------------------------------
--
-- Nobody, over the API. Both callers are internal:
--
--   * redeem_pending_grants runs as an AFTER INSERT trigger on auth.users, so
--     it is invoked by the system, not by a role through PostgREST.
--
--   * apply_lifetime_grant is called only from inside redeem_pending_grants,
--     which is SECURITY DEFINER — the inner call therefore executes as the
--     function owner, who retains EXECUTE. It does not route through the
--     caller's privileges.
--
--   * lemonsqueezy-webhook does NOT use either function. It writes to
--     pending_grants directly over PostgREST with the service role key, and
--     the signup trigger does the granting. Verified against
--     supabase/functions/lemonsqueezy-webhook/index.ts before revoking.
--
-- service_role is deliberately NOT granted back. Adding a grant it does not
-- currently need would be re-opening a smaller version of the same hole. If a
-- future admin script needs to call apply_lifetime_grant directly, grant it
-- then, explicitly, and write down why:
--
--   grant execute on function public.apply_lifetime_grant(uuid,text,text,text,text)
--     to service_role;

-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
--
-- Should return two rows, both with anon_can_execute and authenticated_can_execute
-- false. Run it after applying; if either is true, the revoke did not take.
--
--   select p.proname,
--          has_function_privilege('anon',          p.oid, 'execute') as anon_can_execute,
--          has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('apply_lifetime_grant', 'redeem_pending_grants');
