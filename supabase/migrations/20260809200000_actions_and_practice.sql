-- Today's action, and a record of practice sessions.
--
-- This is the part that makes the app about behaviour rather than about
-- thinking. A desire on its own is a wish; a desire plus "review last week's
-- spending and find one thing to cut" is a plan. It is also the honest
-- position: we never claim visualising causes an outcome, we claim it helps
-- you show up, and then we ask you to show up.
--
-- Progress is deliberately derived from completed actions rather than typed in
-- by hand. A percentage nobody earned is the kind of number that makes an app
-- feel fake.

CREATE TABLE IF NOT EXISTS public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  desire_id UUID REFERENCES public.desires(id) ON DELETE CASCADE,
  -- What to actually do. One sentence, doable today.
  body TEXT NOT NULL,
  -- The day it was offered for, in the user's own timezone. Lets us show one
  -- action a day per desire without regenerating on every render.
  for_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  completed_at TIMESTAMPTZ,
  -- "ai" when the coach wrote it, "template" when it came from the local
  -- fallback, "user" when the person wrote their own.
  source TEXT NOT NULL DEFAULT 'template',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One action per desire per day. Without this, two devices opening the app at
-- the same moment produce two different actions for the same morning.
CREATE UNIQUE INDEX IF NOT EXISTS actions_one_per_desire_per_day
  ON public.actions (user_id, desire_id, for_date);

CREATE INDEX IF NOT EXISTS actions_by_user_date
  ON public.actions (user_id, for_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.actions TO authenticated;
GRANT ALL ON public.actions TO service_role;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "actions_own" ON public.actions;
CREATE POLICY "actions_own" ON public.actions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Milestones: a desire broken into steps you can tick off.
CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  desire_id UUID NOT NULL REFERENCES public.desires(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestones_by_desire
  ON public.milestones (desire_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "milestones_own" ON public.milestones;
CREATE POLICY "milestones_own" ON public.milestones FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- A completed practice session. One row per finished run through the guided
-- flow, which is what the streak, the weekly report and the achievements are
-- all counted from.
CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  desire_id UUID REFERENCES public.desires(id) ON DELETE SET NULL,
  -- Which steps they actually finished, so a three-minute practice and a
  -- fifteen-minute one aren't counted as the same thing.
  steps_completed TEXT[] NOT NULL DEFAULT '{}',
  seconds INT NOT NULL DEFAULT 0,
  for_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS practice_by_user_date
  ON public.practice_sessions (user_id, for_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_sessions TO authenticated;
GRANT ALL ON public.practice_sessions TO service_role;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "practice_own" ON public.practice_sessions;
CREATE POLICY "practice_own" ON public.practice_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
