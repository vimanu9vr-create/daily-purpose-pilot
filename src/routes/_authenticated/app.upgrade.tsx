import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Check, ChevronLeft, Loader2, Mic, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import {
  STANDARD_FEATURES,
  STANDARD_PLANS,
  VOICE_FEATURES,
  VOICE_PLANS,
  type PlanId,
  type PlanTier,
} from "@/features/billing/plans";
import { purchaseStore } from "@/features/billing/store";
import { useSubscription } from "@/features/billing/use-subscription";
import { cn } from "@/lib/utils";

/**
 * The paywall.
 *
 * Two tiers rather than one, because narration is the only part of this app
 * with a real per-listen bill and folding it into a single price means readers
 * subsidise listeners. See `plans.ts` for the arithmetic.
 *
 * The screen opens on Voice, and `?tier=` lets the player deep-link somebody
 * straight to it from the moment they pressed play and found it locked — which
 * is the moment they most want it, and the worst possible moment to make them
 * hunt through a pricing page.
 */
/** The tiers you can actually buy. "free" isn't one of them. */
type PaidTier = Exclude<PlanTier, "free">;

export const Route = createFileRoute("/_authenticated/app/upgrade")({
  head: () => ({ meta: [{ title: "ManifestAI plans" }] }),
  validateSearch: (search: Record<string, unknown>): { tier?: PaidTier } => {
    // The key is omitted rather than set to undefined, so the URL stays clean
    // and the type doesn't need to admit a value that means "absent".
    const tier = search["tier"];
    return tier === "standard" || tier === "voice" ? { tier } : {};
  },
  component: Upgrade,
});

function Upgrade() {
  const navigate = useNavigate();
  const { tier: openTo } = useSearch({ from: "/_authenticated/app/upgrade" });
  const { tier: currentTier, hasVoice } = useSubscription();

  const [tier, setTier] = useState<PaidTier>(openTo ?? "voice");
  const [selected, setSelected] = useState<PlanId>(
    (openTo ?? "voice") === "standard" ? "standard_yearly" : "voice_yearly",
  );
  const [busy, setBusy] = useState(false);

  const plans = tier === "voice" ? VOICE_PLANS : STANDARD_PLANS;
  const features = tier === "voice" ? VOICE_FEATURES : STANDARD_FEATURES;

  function chooseTier(next: PaidTier) {
    setTier(next);
    setSelected(next === "voice" ? "voice_yearly" : "standard_yearly");
  }

  async function buy() {
    setBusy(true);
    const result = await purchaseStore().purchase(selected);
    setBusy(false);

    if (result.status === "purchased") {
      toast.success(tier === "voice" ? "You're in. The voice is yours." : "You're in.");
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

  /**
   * A Standard subscriber is a paying customer, not a free user, and the screen
   * has to say so. Telling somebody who pays you every month that they should
   * "upgrade to premium" reads as though you've forgotten them.
   */
  const heading = hasVoice
    ? "You have Voice"
    : currentTier === "standard"
      ? "Add the voice"
      : "Choose your plan";

  const subheading = hasVoice
    ? "Everything is unlocked, narration included. Thank you for supporting this."
    : currentTier === "standard"
      ? "You already have everything written. This adds the narrated voice on top."
      : "Everything written, or everything written and read aloud.";

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
          {tier === "voice" ? (
            <Mic className="h-6 w-6 text-primary-foreground" />
          ) : (
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          )}
        </span>
        <h1 className="mt-5 font-display text-[32px] font-medium leading-tight">{heading}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {subheading}
        </p>
      </header>

      {!hasVoice && (
        <>
          {/* Tier switch. Standard first, so the cheaper honest option is the
              one somebody reads before the one that costs more. */}
          <div
            role="tablist"
            aria-label="Plan tier"
            className="mt-7 flex rounded-full bg-white/60 p-1"
          >
            {(["standard", "voice"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={tier === option}
                onClick={() => chooseTier(option)}
                className={cn(
                  "flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition",
                  tier === option
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {option === "standard" ? "Standard" : "Voice"}
              </button>
            ))}
          </div>

          <ul className="mt-6 space-y-2.5">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-3 w-3" />
                </span>
                <span className="leading-relaxed">{feature}</span>
              </li>
            ))}
          </ul>

          {/* Said out loud rather than hidden, because somebody who picks
              Standard and then discovers the voice is missing feels tricked,
              and that costs more than the sale was worth. */}
          <p className="mt-4 rounded-2xl bg-white/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            {tier === "standard"
              ? "Standard does not include the narrated voice. Every story, affirmation and session is there to read — you just read it yourself."
              : "Voice includes up to three narrations a day. A studio voice costs real money per listen, and that cap is what keeps this plan honestly priced rather than quietly rationed."}
          </p>

          <div className="mt-6 space-y-2.5">
            {plans.map((plan) => (
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

          {/* Voice has no lifetime, and the reason is worth giving. Silence
              here reads as an oversight; the explanation reads as a business
              that knows what its own costs are. */}
          {tier === "voice" && (
            <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
              There's no lifetime Voice plan. The voice costs money every month it's used, and one
              payment can't cover a bill that keeps arriving.
            </p>
          )}

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
            ends. Manage or cancel in your account settings. Lifetime is a single payment with no
            renewal.
          </p>
        </>
      )}

      {hasVoice && (
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
