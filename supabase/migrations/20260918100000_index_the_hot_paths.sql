-- Index every column the app actually filters on.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS THE SINGLE HIGHEST-VALUE MIGRATION IN THE REPO
-- ---------------------------------------------------------------------------
--
-- Before this file, the whole database had THREE explicit indexes:
--
--   idx_affirmations_desire, idx_narration_spend_user_day, habits_desire_id_idx
--
-- Postgres creates an index for a primary key and for a unique constraint. It
-- does NOT create one for a foreign key. That is the trap here, because every
-- table in this schema hangs off `user_id`, and every RLS policy on every one
-- of those tables is a variation of:
--
--     using (auth.uid() = user_id)
--
-- RLS is not a filter applied after the rows arrive. It is welded onto the
-- query. So "read my affirmations" is really "scan affirmations, keep the rows
-- where user_id = me" — and with no index on user_id that is a sequential scan
-- of the entire table, for every request, by every user.
--
-- At 661 rows that is free. At a million users and tens of millions of
-- affirmations it is the end of the application: every screen in the app does
-- at least one of these reads, so the cost is not one slow page, it is all of
-- them at once, and it degrades super-linearly because the scans compete for
-- the same buffer cache.
--
-- This is also the cheapest possible moment to fix it. `create index` takes a
-- lock that is invisible on a table of 661 rows and brutal on a table of ten
-- million, so the version of this migration that runs in a second today is the
-- version that would need CONCURRENTLY, a maintenance window and a nervous
-- afternoon in two years.
--
-- ---------------------------------------------------------------------------
-- HOW THE COLUMNS WERE CHOSEN
-- ---------------------------------------------------------------------------
--
-- Not "index everything" — every index is paid for on every write and in
-- storage. Three rules were applied:
--
--   1. Every `user_id`, because RLS forces that predicate onto every query.
--   2. Every foreign key that is read from the child side (`desire_id`,
--      `board_id`, `programme_id`, `habit_id`, `chat_id`), because those are
--      the "show me the things belonging to this thing" reads, and because an
--      unindexed FK also makes DELETE on the parent scan the child.
--   3. A second column appended where the app reliably sorts or filters by it
--      straight after — a date, a position, a timestamp. A composite
--      (user_id, for_date) serves a lookup on user_id alone just as well as a
--      single-column index would, so this costs nothing extra and turns a
--      sort into an index read.
--
-- Partial indexes (`where ...`) are used where the queried subset is a small
-- fraction of the table: unfinished programmes, live narration rows, profiles
-- with notifications on. A partial index is smaller, stays in memory, and
-- skips maintenance on rows outside its predicate.
--
-- `if not exists` throughout, so this is safe to re-run and safe against
-- anything already created by hand in the dashboard.
-- ---------------------------------------------------------------------------

-- Profiles: the morning push job scans this hourly. Only the notification
-- subset is ever scanned, so the index only covers that subset.
create index if not exists profiles_notify_due_idx
  on public.profiles (notify_hour, notify_minute)
  where notifications_enabled;

-- Goals and their steps.
create index if not exists goals_user_idx
  on public.goals (user_id, created_at desc);
create index if not exists goal_steps_user_idx
  on public.goal_steps (user_id);
create index if not exists goal_steps_goal_idx
  on public.goal_steps (goal_id, order_index);

-- Habits. `habits_desire_id_idx` already exists from the habit-tracker
-- migration; the user_id one never did, which is the one RLS needs.
create index if not exists habits_user_idx
  on public.habits (user_id)
  where active;
-- `date` and `position` are quoted throughout this file. Both are keywords —
-- `date` is a type name and `position` is a function — and unquoted in an
-- index column list the parser can take them as such rather than as columns.
create index if not exists habit_logs_user_date_idx
  on public.habit_logs (user_id, "date" desc);
create index if not exists habit_logs_habit_date_idx
  on public.habit_logs (habit_id, "date" desc);

-- Journals. Always read newest-first for one person.
create index if not exists journals_user_date_idx
  on public.journals (user_id, entry_date desc);

-- Affirmations. 661 rows today and the biggest table in the schema; it grows
-- with every generation. The second index is specifically for the morning
-- push, which asks for the least-recently-shown line for one user.
create index if not exists affirmations_user_idx
  on public.affirmations (user_id, created_at desc);
create index if not exists affirmations_user_last_shown_idx
  on public.affirmations (user_id, last_shown_at nulls first);
create index if not exists affirmations_user_anchor_idx
  on public.affirmations (user_id, desire_id)
  where is_anchor;
create index if not exists affirmations_goal_idx
  on public.affirmations (goal_id)
  where goal_id is not null;

create index if not exists daily_checkins_user_date_idx
  on public.daily_checkins (user_id, "date" desc);

-- Coach conversations. Messages are read per chat, oldest first.
create index if not exists ai_chats_user_idx
  on public.ai_chats (user_id, created_at desc);
create index if not exists ai_messages_chat_idx
  on public.ai_messages (chat_id, created_at);
create index if not exists ai_messages_user_idx
  on public.ai_messages (user_id);

-- Moments: stories and tracks. Second biggest table, and the one with an
-- expiry sweep, which needs its own index or the sweep scans everything.
create index if not exists moments_user_idx
  on public.moments (user_id, created_at desc);
create index if not exists moments_desire_idx
  on public.moments (desire_id)
  where desire_id is not null;
create index if not exists moments_goal_idx
  on public.moments (goal_id)
  where goal_id is not null;
create index if not exists moments_expires_idx
  on public.moments (expires_at)
  where expires_at is not null;

-- Push subscriptions. Read once per user per morning by the cron job.
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

create index if not exists desires_user_idx
  on public.desires (user_id, created_at desc);

-- Entitlement check. Runs on the paid path, so a slow one costs money twice.
create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id, status);

-- Today's action, per desire.
create index if not exists actions_user_date_idx
  on public.actions (user_id, for_date desc);
create index if not exists actions_desire_idx
  on public.actions (desire_id, for_date desc)
  where desire_id is not null;

create index if not exists milestones_user_idx
  on public.milestones (user_id);
create index if not exists milestones_desire_idx
  on public.milestones (desire_id, "position");

create index if not exists practice_sessions_user_date_idx
  on public.practice_sessions (user_id, for_date desc);
create index if not exists practice_sessions_desire_idx
  on public.practice_sessions (desire_id, for_date desc)
  where desire_id is not null;

create index if not exists vision_boards_user_idx
  on public.vision_boards (user_id, created_at desc);
create index if not exists vision_items_board_idx
  on public.vision_items (board_id, "position");
create index if not exists vision_items_user_idx
  on public.vision_items (user_id);

-- Programmes. The push job asks for the one unfinished programme per user,
-- which is exactly what the partial index below answers.
create index if not exists programmes_user_open_idx
  on public.programmes (user_id, created_at desc)
  where completed_at is null;
create index if not exists programmes_desire_idx
  on public.programmes (desire_id)
  where desire_id is not null;
create index if not exists programme_days_programme_idx
  on public.programme_days (programme_id, day_number);
create index if not exists programme_days_user_idx
  on public.programme_days (user_id);

-- Narration spend. The daily and monthly caps are computed from this table on
-- every narration request, so it is in the hot path of the one feature that
-- actually costs cash per call.
create index if not exists narration_spend_user_created_idx
  on public.narration_spend (user_id, created_at desc);
create index if not exists narration_spend_moment_idx
  on public.narration_spend (moment_id)
  where moment_id is not null;

-- Beta applications are read by email in the admin flow.
create index if not exists beta_applications_email_idx
  on public.beta_applications (lower(email));
create index if not exists beta_applications_status_idx
  on public.beta_applications (status, created_at desc);

-- Make the new indexes visible to the planner immediately rather than at the
-- next autovacuum. Without this the first queries after deploy may still pick
-- a sequential scan from stale statistics.
analyze public.profiles;
analyze public.affirmations;
analyze public.moments;
analyze public.desires;
analyze public.actions;
analyze public.milestones;
