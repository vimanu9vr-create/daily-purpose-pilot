import { useQuery, useQueryClient } from "@tanstack/react-query";

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

/**
 * Wait for the purchase to actually arrive, then refresh.
 *
 * A purchase is not one thing happening. StoreKit tells the app it succeeded,
 * and separately RevenueCat posts a webhook to us, and only that webhook writes
 * the `subscriptions` row. The app is deliberately not allowed to grant its own
 * entitlement — a jailbroken device can lie to the SDK but cannot forge a
 * server-to-server call — so the row is the only thing that counts.
 *
 * Which means the two land out of order. The SDK returns in a second; the
 * webhook takes a few more. Navigating straight to Home on "purchased" showed
 * the person the free tier, having just paid, with nothing to do but wonder
 * whether it had worked and possibly buy it again.
 *
 * So this polls the row until it appears, and gives up after roughly twenty
 * seconds — at which point the honest message is "we've got your payment, it's
 * taking a moment", not silence.
 */
export function useAwaitEntitlement() {
  const queryClient = useQueryClient();

  return async function waitForPlan(timeoutMs = 20_000): Promise<boolean> {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan")
        .eq("status", "active")
        .maybeSingle();

      if (data?.plan) {
        await queryClient.invalidateQueries({ queryKey: billingKeys.mine });
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // Refresh anyway: if it landed a moment after we stopped looking, the next
    // screen should still be right.
    await queryClient.invalidateQueries({ queryKey: billingKeys.mine });
    return false;
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
