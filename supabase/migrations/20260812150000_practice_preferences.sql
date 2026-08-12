-- The three onboarding answers the practice flow needs.
--
-- practice_minutes decides the length of the guided session, practice_styles
-- decides which steps appear in it, and practice_time_of_day decides when it
-- is offered and when the reminder fires.
--
-- Defaults are the middle option in each case, so anyone who onboarded before
-- these existed gets a sensible five-minute morning session rather than an
-- empty one. Nothing existing is altered or dropped — these are three new
-- columns with defaults, so no current row changes meaning.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS practice_minutes INT NOT NULL DEFAULT 5;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS practice_styles TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS practice_time_of_day TEXT NOT NULL DEFAULT 'morning';

-- Guard rails, so a bad client can't write a value the UI then has to defend
-- against on every render.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_practice_minutes_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_practice_minutes_check CHECK (practice_minutes IN (2, 5, 10, 15));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_practice_time_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_practice_time_check
  CHECK (practice_time_of_day IN ('morning', 'afternoon', 'evening'));
