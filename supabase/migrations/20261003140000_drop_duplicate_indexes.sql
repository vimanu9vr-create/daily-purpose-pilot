-- Nine pairs of identical indexes, and one foreign key with none.
--
-- Both come from the same history: tables were indexed once when they were
-- created and again in `20260918100000_index_the_hot_paths`, under a different
-- naming convention. Postgres does not complain about a duplicate index, so
-- nothing ever surfaced it — Supabase's own linter did.
--
-- A duplicate index is not free. Every insert, update and delete maintains
-- both copies, both occupy memory in the buffer cache, and the planner has to
-- consider both. On the write-heavy tables here — `actions` at 362 rows and
-- `milestones` at 275, each written on every practice session — it is a
-- straight doubling of index maintenance for no benefit at all.
--
-- Dropping the newer name in each pair, so the names in the original table
-- migrations stay the ones that exist. `if exists` throughout: this must be
-- safe to run against a database where some were already removed by hand.

drop index if exists public.actions_user_date_idx;
drop index if exists public.milestones_desire_idx;
drop index if exists public.narration_spend_user_created_idx;
drop index if exists public.practice_sessions_user_date_idx;
drop index if exists public.programme_days_programme_idx;
drop index if exists public.programmes_user_open_idx;
drop index if exists public.push_subscriptions_user_idx;
drop index if exists public.vision_boards_user_idx;
drop index if exists public.vision_items_board_idx;

-- The one missing index, rather than one too many.
--
-- `programme_days.moment_id` is a foreign key with no covering index. Postgres
-- does not create one automatically, and without it every delete of a `moments`
-- row has to sequentially scan `programme_days` to check the constraint.
-- `moments` is the largest table in the database at 783 rows and the one that
-- expires and is deleted most often, so this is the scan that runs most.
create index if not exists programme_days_moment_idx
  on public.programme_days (moment_id);

-- NOT fixed here, deliberately: the linter also reports 25 RLS policies that
-- call auth.uid() per row instead of once per query. The fix is mechanical —
-- wrap the call in (select ...) — but it means rewriting all 25 policies, and
-- a policy rewritten wrongly is a data leak rather than a slow query. These
-- are the policies that keep one person's journal out of another person's
-- hands. It is a scale problem, not a correctness one, and at twelve users it
-- costs nothing measurable; it should be done deliberately, one table at a
-- time, reading each existing policy first.
--
-- Check afterwards:
--
--   select indexrelid::regclass, idx_scan from pg_stat_user_indexes
--    where relname = 'actions';
