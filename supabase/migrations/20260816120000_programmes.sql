-- Seven and twenty-one day affirmation programmes.
--
-- A programme is a sequence of days built from one dream. Two tables rather
-- than one because the days are what get read, written and ticked constantly,
-- while the programme itself is written once and barely touched.
--
-- NO DUE DATES ANYWHERE IN THIS SCHEMA. That is deliberate and load-bearing.
-- There is no `due_on`, no `expected_date`, no `missed` flag, because days
-- unlock in sequence rather than by calendar. Someone who opens the app on
-- Thursday having last used it on Monday gets day four, not "you missed two
-- days". If the column existed, somebody would eventually render it, and the
-- app would start telling people they had failed at something. The absence is
-- the feature.

CREATE TABLE IF NOT EXISTS public.programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  -- The dream this was built from. Nullable and ON DELETE SET NULL: deleting a
  -- dream must not delete the fourteen days of work someone did toward it.
  desire_id UUID REFERENCES public.desires (id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  length_days INT NOT NULL CHECK (length_days IN (7, 21)),

  started_on DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.programme_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES public.programmes (id) ON DELETE CASCADE,

  -- Denormalised from the parent so row-level security can be checked without
  -- a join on every read.
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  day_number INT NOT NULL CHECK (day_number >= 1),
  theme TEXT NOT NULL,
  intention TEXT NOT NULL,
  lines TEXT[] NOT NULL,

  -- The playable track for this day, created the first time it's opened.
  -- Nullable because most days are never reached, and generating audio for a
  -- day nobody opens is the cost mistake we already made once with covers.
  moment_id UUID REFERENCES public.moments (id) ON DELETE SET NULL,

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Two devices starting the same programme must not produce two day threes.
  UNIQUE (programme_id, day_number)
);

CREATE INDEX IF NOT EXISTS programmes_by_user
  ON public.programmes (user_id, created_at DESC);

-- Partial, because "which programme am I in the middle of" is the only
-- question Home ever asks and finished ones are dead weight in that answer.
CREATE INDEX IF NOT EXISTS programmes_active
  ON public.programmes (user_id, created_at DESC)
  WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS programme_days_by_programme
  ON public.programme_days (programme_id, day_number);

ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own programmes" ON public.programmes;
CREATE POLICY "own programmes" ON public.programmes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own programme days" ON public.programme_days;
CREATE POLICY "own programme days" ON public.programme_days
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
