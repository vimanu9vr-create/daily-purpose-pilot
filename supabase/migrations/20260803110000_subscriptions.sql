-- Entitlement. Written only by the server after a store receipt is verified —
-- a client that can grant itself premium isn't a paywall.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  store TEXT NOT NULL DEFAULT 'apple',
  -- Apple's originalTransactionId: stable identity across renewals.
  store_transaction_id TEXT,
  price_display TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active subscription per person, and one row per store transaction.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_active
  ON public.subscriptions(user_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_txn
  ON public.subscriptions(store_transaction_id) WHERE store_transaction_id IS NOT NULL;

-- SELECT only. No INSERT/UPDATE/DELETE grant for authenticated, by design.
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_read_own" ON public.subscriptions;
CREATE POLICY "subscriptions_read_own" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
