-- Affirmations: where it came from, and when it was last surfaced (so the
-- daily pick rotates instead of repeating).
ALTER TABLE public.affirmations ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'library';
ALTER TABLE public.affirmations ADD COLUMN IF NOT EXISTS last_shown_at TIMESTAMPTZ;

-- Moments: the daily visualization narrative. Present tense, second person,
-- written from the user's own stated desire.
CREATE TABLE IF NOT EXISTS public.moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  moment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  listened_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'composed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.moments TO authenticated;
GRANT ALL ON public.moments TO service_role;
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moments_own" ON public.moments;
CREATE POLICY "moments_own" ON public.moments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_moments_user_date ON public.moments(user_id, moment_date DESC);
