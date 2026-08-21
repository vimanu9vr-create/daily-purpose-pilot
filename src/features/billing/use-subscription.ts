import { useQuery } from "@tanstack/react-query";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import { FREE_LIMITS, NARRATION_ALLOWANCE, type PlanId, type PlanTier, tierOf } from "./plans";

export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];

export const billingKeys = { mine: ["subscription"] as const };

/**
 * The user's entitlement.
 *
 * Read-only by design: the table is writable only by the service role, after
 * a store receipt has been verified server-side. A client that could grant
 * itself premium isn't a paywall.
 */
export function useSubscription() {
  const userId = useUserId();

  const query = useQuery({
    queryKey: billingKeys.mine,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const subscription = query.data ?? null;

  // Treat an expired period as free even if the row still says active — the
  // store webhook may not have landed yet.
  const notExpired =
    !subscription?.current_period_end ||
    new Date(subscription.current_period_end).getTime() > Date.now();

  const isPremium = Boolean(subscription) && notExpired;
  const plan: PlanId = isPremium ? ((subscription?.plan as PlanId) ?? "monthly") : "free";

  /**
   * The tier is derived from the stored plan id, never stored separately.
   *
   * One source of truth: if a row said `tier: 'voice'` but `plan:
   * 'standard_yearly'`, there'd be no way to know which was right. Deriving it
   * means the thing the store actually sold is always what decides.
   */
  const tier: PlanTier = isPremium ? tierOf(plan) : "free";
  const hasVoice = tier === "voice";

  return {
    ...query,
    subscription,
    isPremium,
    plan,
    tier,
    hasVoice,
    narrationAllowance: NARRATION_ALLOWANCE[tier],
    limits: isPremium ? null : FREE_LIMITS,
  };
}

/** Convenience for gating a single feature. */
export function usePremiumGate() {
  const { isPremium, isPending } = useSubscription();
  return { isPremium, isLoading: isPending };
}

/**
 * Gate for studio narration specifically.
 *
 * Separate from `usePremiumGate` because a Standard subscriber is a paying
 * customer who does not have this one thing — a screen that tests only
 * "premium" would either give it to them free or treat them as if they'd never
 * paid, and both are wrong.
 */
export function useVoiceGate() {
  const { hasVoice, tier, isPending } = useSubscription();
  return { hasVoice, tier, isLoading: isPending };
}
