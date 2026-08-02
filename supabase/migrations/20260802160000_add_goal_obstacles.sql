-- Obstacles captured in the goal wizard (step 5)
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS obstacles TEXT;

-- Dashboard reads check-ins by user + day
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON public.daily_checkins(user_id, date);
