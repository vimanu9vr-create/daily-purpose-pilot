-- Every RLS policy re-ran auth.uid() for every row it examined.
--
-- `auth.uid()` reads a JWT claim out of a GUC. Postgres treats it as volatile,
-- so inside a policy predicate it is called once PER ROW rather than once per
-- query. Wrapping it in a scalar subquery — `(select auth.uid())` — makes the
-- planner evaluate it a single time as an InitPlan and compare that constant
-- against every row.
--
-- The semantics are identical. The difference is one function call versus one
-- per row, which does not matter at 783 rows and matters a great deal at a
-- million. `moments` is already the biggest table here and grows with every
-- story anybody generates.
--
-- ## Why this was deferred once, and why it is safe now
--
-- These are the policies that keep one person's journal out of another
-- person's hands. A policy rewritten wrongly is a data leak rather than a slow
-- query, so rewriting 25 of them from a linter summary would have been
-- reckless. Having now read every definition out of `pg_policies`, they turn
-- out to be uniform: every one is `auth.uid() = user_id`, except `profiles`
-- which keys on `id` because its primary key IS the user id. There is no
-- bespoke logic anywhere to preserve.
--
-- Each policy below is dropped and recreated with the SAME command, the SAME
-- roles and the SAME predicate, changed in exactly one way.
--
-- ## One genuine fix along the way
--
-- `programmes` and `programme_days` granted their policies to `public` rather
-- than `authenticated`. That is not a leak — `auth.uid()` is null for an
-- anonymous caller, `null = user_id` evaluates to null, and null is not true,
-- so no rows come back — but it leans on a subtlety of three-valued logic to
-- stay safe when every other table states the intent outright. They now say
-- `authenticated`, like the rest.

-- ---------------------------------------------------------------------------
-- The uniform ones: ALL commands, authenticated, keyed on user_id.
-- ---------------------------------------------------------------------------
--
-- Driven from an explicit list rather than from a catalogue query, so this
-- file says exactly which policies it touched and a reviewer can check the
-- list against pg_policies rather than trusting a loop to have matched the
-- right things.

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('actions',            'actions_own'),
      ('affirmations',       'affirmations_own'),
      ('ai_chats',           'ai_chats_own'),
      ('ai_messages',        'ai_messages_own'),
      ('daily_checkins',     'daily_checkins_own'),
      ('desires',            'desires_own'),
      ('goal_steps',         'goal_steps_own'),
      ('goals',              'goals_own'),
      ('habit_logs',         'habit_logs_own'),
      ('habits',             'habits_own'),
      ('journals',           'journals_own'),
      ('milestones',         'milestones_own'),
      ('moments',            'moments_own'),
      ('practice_sessions',  'practice_own'),
      ('programme_days',     'own programme days'),
      ('programmes',         'own programmes'),
      ('push_subscriptions', 'push_subscriptions_own'),
      ('vision_boards',      'vision_boards_own'),
      ('vision_items',       'vision_items_own')
    ) as t(table_name, policy_name)
  loop
    execute format('drop policy if exists %I on public.%I', target.policy_name, target.table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      target.policy_name, target.table_name
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Read-only tables. No `with check`, because nothing may write them.
-- ---------------------------------------------------------------------------
--
-- `subscriptions` is written only by the payment webhooks under the service
-- role, which bypasses RLS entirely. A client that could write this table
-- could grant itself a plan, so the absence of an insert policy here is the
-- paywall. Same reasoning for `narration_spend`: it is the ledger that decides
-- whether somebody has used their narration allowance.

drop policy if exists subscriptions_read_own on public.subscriptions;
create policy subscriptions_read_own on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists narration_spend_own_read on public.narration_spend;
create policy narration_spend_own_read on public.narration_spend
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- profiles: four separate policies, keyed on `id`, not `user_id`.
-- ---------------------------------------------------------------------------
--
-- The primary key IS the auth user id — `profiles_id_fkey` points at
-- auth.users — so `auth.uid() = id` is the correct predicate here and copying
-- `user_id` from the tables above would silently match nothing.
--
-- Split by command rather than one ALL policy because insert has only a check
-- and select and delete have only a using clause; collapsing them would change
-- what each command is permitted to do.

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = id);

-- `beta_applications` is deliberately untouched. Its one policy lets anon
-- INSERT with `check (true)` — a public application form — and contains no
-- auth.uid() call to optimise. It also has no select policy, so nobody can
-- read back what anyone else submitted.

-- Check afterwards:
--
--   select tablename, policyname, qual from pg_policies
--    where schemaname = 'public' and qual like '%auth.uid()%'
--      and qual not like '%( SELECT auth.uid()%';
--
-- That should return zero rows. Then re-run the performance advisor: the
-- auth_rls_initplan count should go from 25 to 0.
--
-- And prove the policies still do their job, as the only check that actually
-- matters — signed in as one user:
--
--   select count(*) from journals;   -- only your own
--   select count(*) from moments;    -- only your own
