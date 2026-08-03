import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { PLANS, PREMIUM_FEATURES, type PlanId } from "@/features/billing/plans";
import { purchaseStore } from "@/features/billing/store";
import { useSubscription } from "@/features/billing/use-subscription";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/upgrade")({
  head: () => ({ meta: [{ title: "ManifestAI Premium" }] }),
  component: Upgrade,
});

function Upgrade() {
  const navigate = useNavigate();
  const { isPremium } = useSubscription();
  const [selected, setSelected] = useState<PlanId>("yearly");
  const [busy, setBusy] = useState(false);

  async function buy() {
    setBusy(true);
    const result = await purchaseStore().purchase(selected);
    setBusy(false);

    if (result.status === "purchased") {
      toast.success("You're in. Everything's unlocked.");
      void navigate({ to: "/app" });
    } else if (result.status === "cancelled") {
      // Nothing to say — they chose to back out.
    } else {
      toast.error(result.message);
    }
  }

  async function restore() {
    const result = await purchaseStore().restore();
    if (result.status === "purchased") toast.success("Purchase restored.");
    else if (result.status !== "cancelled") toast.error(result.message);
  }

  return (
    <PageTransition>
      <button
        type="button"
        onClick={() => navigate({ to: "/app/profile" })}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-primary"
        aria-label="Back"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <header className="mt-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl surface-gradient shadow-glow">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </span>
        <h1 className="mt-5 font-display text-[32px] font-medium leading-tight">
          {isPremium ? "You have Premium" : "ManifestAI Premium"}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {isPremium
            ? "Everything is unlocked. Thank you for supporting this."
            : "The full practice, without limits."}
        </p>
      </header>

      <ul className="mt-8 space-y-2.5">
        {PREMIUM_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="h-3 w-3" />
            </span>
            <span className="leading-relaxed">{feature}</span>
          </li>
        ))}
      </ul>

      {!isPremium && (
        <>
          <div className="mt-8 space-y-2.5">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(plan.id)}
                aria-pressed={selected === plan.id}
                className={cn(
                  "flex w-full items-center gap-4 rounded-3xl border-2 p-4 text-left transition",
                  selected === plan.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-white/60",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
                    selected === plan.id ? "border-primary bg-primary" : "border-border",
                  )}
                >
                  {selected === plan.id && (
                    <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{plan.name}</span>
                    {plan.highlight && (
                      <span className="rounded-full bg-ember/15 px-2 py-0.5 text-[10px] font-semibold text-ember">
                        {plan.highlight}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{plan.blurb}</span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block font-display text-lg">{plan.priceDisplay}</span>
                  <span className="block text-[10px] text-muted-foreground">{plan.cadence}</span>
                </span>
              </button>
            ))}
          </div>

          <Button size="lg" className="mt-6 w-full rounded-full" onClick={buy} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Continue
          </Button>

          <button
            type="button"
            onClick={restore}
            className="mt-4 w-full text-center text-xs text-muted-foreground underline underline-offset-2"
          >
            Restore purchase
          </button>

          {/* Apple requires renewal terms be visible at the point of purchase. */}
          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
            Subscriptions renew automatically unless cancelled at least 24 hours before the period
            ends. Manage or cancel in your Apple account settings. Lifetime is a single payment with
            no renewal.
          </p>
        </>
      )}

      {isPremium && (
        <Button
          variant="glass"
          className="mt-8 w-full rounded-full"
          onClick={() => navigate({ to: "/app/profile" })}
        >
          Back to your profile
        </Button>
      )}
    </PageTransition>
  );
}
