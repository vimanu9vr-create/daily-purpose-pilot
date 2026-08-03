-- Desires: what the user wants, several at a time and editable.
CREATE TABLE IF NOT EXISTS public.desires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.desires TO authenticated;
GRANT ALL ON public.desires TO service_role;
ALTER TABLE public.desires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desires_own" ON public.desires;
CREATE POLICY "desires_own" ON public.desires FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_desires_user ON public.desires(user_id);

-- Moments become stories: the card and player need a hook line, cover image
-- and a duration to show.
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS desire_id UUID
  REFERENCES public.desires(id) ON DELETE CASCADE;
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS hook TEXT;
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS duration_seconds INT NOT NULL DEFAULT 180;
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'story';
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_moments_user_kind ON public.moments(user_id, kind, created_at DESC);
