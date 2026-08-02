-- Onboarding answers live on the profile. Everything personalised — affirmations,
-- moments, the morning notification — reads from these columns.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS focus_areas TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS desires TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS obstacles TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS desired_feeling TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tone TEXT NOT NULL DEFAULT 'warm';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_hour INT NOT NULL DEFAULT 7;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_minute INT NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Guards against double-sending when the cron runs more than once in an hour.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_notified_on DATE;

-- One row per device/browser the user has granted notification permission on.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  failure_count INT NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);
