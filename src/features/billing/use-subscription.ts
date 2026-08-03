import { useQuery } from "@tanstack/react-query";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import { FREE_LIMITS, type PlanId } from "./plans";

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

  return {
    ...query,
    subscription,
    isPremium,
    plan,
    limits: isPremium ? null : FREE_LIMITS,
  };
}

/** Convenience for gating a single feature. */
export function usePremiumGate() {
  const { isPremium, isPending } = useSubscription();
  return { isPremium, isLoading: isPending };
}
