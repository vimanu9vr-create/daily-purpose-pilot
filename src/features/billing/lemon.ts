/**
 * Lemon Squeezy checkout, for the web.
 *
 * ## Why this exists
 *
 * Until now `WebStore.purchase()` returned "Subscriptions are available in the
 * ManifestAI app on your phone." Someone on the website who wanted to pay was
 * told to go and get an app — which, on an iPhone, does not exist. Every
 * iPhone user in the UK, US and Australia was a dead end.
 *
 * ## Apple's rule, and where it actually applies
 *
 * Inside an iOS app, digital subscriptions must go through In-App Purchase and
 * the app may not link out to an external checkout. That rule governs apps
 * distributed through the App Store. It does not govern a website opened in
 * Safari, which is what this code runs in — `pickStore()` hands the native
 * store to anything running under Capacitor, so this class is only ever
 * reached in a browser.
 *
 * That distinction is the whole reason this is safe to ship, and it is why
 * the check lives in `pickStore()` rather than here.
 *
 * ## Why Lemon Squeezy rather than a card processor
 *
 * They are merchant of record. VAT in the UK and EU, GST in India and
 * Australia, US sales tax — all theirs to collect and remit. Chargebacks and
 * fraud are theirs too. The alternative was a gateway where every one of
 * those becomes a thing Viggnesh personally files.
 *
 * ## Entitlement still comes from the server
 *
 * This opens a checkout and nothing else. It does not grant anything. The
 * `subscriptions` row is written by the `lemonsqueezy-webhook` function from
 * a server-to-server call, exactly as the RevenueCat path does — the client
 * never grants its own access, because a browser console can call anything
 * this file exposes.
 */

import { PLANS, type PlanId } from "./plans";
import type { PurchaseResult, PurchaseStore, StoreProduct } from "./store";

/**
 * Lemon Squeezy identifiers, one entry per plan.
 *
 * TWO ids per plan, because Lemon Squeezy uses two and they are not
 * interchangeable:
 *
 *   checkout — the UUID in the PRODUCT's share link. This is what
 *              /checkout/buy/{id} accepts. A numeric id there 404s, which is
 *              exactly how this shipped the first time.
 *
 *   variantId — the NUMBER shown in the dashboard. This is what the webhook
 *               payload reports as `variant_id`, so it is what
 *               `variant-mapping.ts` keys on — and it is also what `?enabled=`
 *               narrows the checkout down to.
 *
 * ## Why three UUIDs cover seven plans
 *
 * Lemon Squeezy issues one share link per PRODUCT, not per variant. Standard
 * is a single product with three billing periods inside it, so all three
 * standard_* plans share a UUID; same for the three voice_* plans. Opening
 * that UUID bare shows all three periods as radio buttons with the starred one
 * preselected.
 *
 * `?enabled={variantId}` restricts the checkout to the one period the person
 * actually tapped. Without it somebody who chose Yearly on our pricing screen
 * would land on a checkout defaulted to Monthly — a silent downsell, and the
 * kind of mismatch that produces a refund request rather than a complaint.
 *
 * If Lemon Squeezy ever ignores the parameter the failure is soft: the person
 * sees all three periods and picks again. That is why this is safe to rely on.
 *
 * A plan with no entry simply doesn't appear on the web — a button that opens
 * a broken checkout is worse than a plan that isn't offered yet.
 */
export type LemonVariant = { checkout: string; variantId: string };

/**
 * Written out in full rather than through three named constants, because the
 * parity test reads this file as TEXT — Deno can't import it. A constant here
 * would leave the test matching nothing and passing vacuously, which is the
 * precise way the first version of this shipped broken.
 *
 * The three repeated UUIDs are, in order: Standard (weekly/monthly/yearly),
 * Lifetime, and Voice (weekly/monthly/yearly).
 */
export const LEMON_VARIANTS: Partial<Record<PlanId, LemonVariant>> = {
  standard_weekly: { checkout: "5becb7dc-90f6-47a2-a78b-3f44e8babbd7", variantId: "2196114" },
  standard_monthly: { checkout: "5becb7dc-90f6-47a2-a78b-3f44e8babbd7", variantId: "2196086" },
  standard_yearly: { checkout: "5becb7dc-90f6-47a2-a78b-3f44e8babbd7", variantId: "2196105" },
  standard_lifetime: { checkout: "a863247f-1055-4d6e-936c-b2d222b80aac", variantId: "2196136" },
  voice_weekly: { checkout: "e1ed8020-e14e-4d2e-b71c-69d676ca965d", variantId: "2196126" },
  voice_monthly: { checkout: "e1ed8020-e14e-4d2e-b71c-69d676ca965d", variantId: "2196122" },
  voice_yearly: { checkout: "e1ed8020-e14e-4d2e-b71c-69d676ca965d", variantId: "2196124" },
};

/** The store subdomain, from product/SETUP.md. */
const STORE = "manifestai";

/**
 * Builds the checkout URL for a plan.
 *
 * `checkout[custom][user_id]` is the important part: Lemon Squeezy echoes
 * custom data back on every webhook for the order, which is how the webhook
 * knows whose `subscriptions` row to write. Without it a payment arrives with
 * an email address and no way to match it to an account — and matching on
 * email is wrong, because someone can pay with a different address than they
 * signed up with.
 */
export function checkoutUrl(variant: LemonVariant, userId: string, email?: string): string {
  const url = new URL(`https://${STORE}.lemonsqueezy.com/checkout/buy/${variant.checkout}`);
  // Narrows a three-period product to the one period they chose on our pricing
  // screen. Someone who picked Yearly must not land on a Monthly checkout.
  url.searchParams.set("enabled", variant.variantId);
  url.searchParams.set("embed", "1");
  url.searchParams.set("media", "0");
  url.searchParams.set("checkout[custom][user_id]", userId);
  if (email) url.searchParams.set("checkout[email]", email);
  return url.toString();
}

type LemonJs = { Url?: { Open?: (u: string) => void }; Setup?: (o: unknown) => void };

let lemonJsPromise: Promise<LemonJs | null> | null = null;

/**
 * Load lemon.js once, on the first checkout.
 *
 * Resolves to null rather than rejecting if the script is blocked — an ad
 * blocker or a flaky network should drop us to a plain navigation, not throw
 * an error at somebody who is trying to give us money.
 */
function loadLemonJs(): Promise<LemonJs | null> {
  if (lemonJsPromise) return lemonJsPromise;

  lemonJsPromise = new Promise<LemonJs | null>((resolve) => {
    if (typeof document === "undefined") return resolve(null);

    const existing = (window as unknown as { LemonSqueezy?: LemonJs }).LemonSqueezy;
    if (existing) return resolve(existing);

    const script = document.createElement("script");
    script.src = "https://app.lemonsqueezy.com/js/lemon.js";
    script.defer = true;
    script.onload = () => {
      const lemon = (window as unknown as { LemonSqueezy?: LemonJs }).LemonSqueezy ?? null;
      lemon?.Setup?.({ eventHandler: () => {} });
      resolve(lemon);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);

    // Don't leave someone staring at a button forever if the script hangs.
    setTimeout(() => resolve((window as unknown as { LemonSqueezy?: LemonJs }).LemonSqueezy ?? null), 4000);
  });

  return lemonJsPromise;
}

export class LemonStore implements PurchaseStore {
  readonly isNative = false;

  constructor(private readonly userId: string | null, private readonly email?: string) {}

  async listProducts(): Promise<StoreProduct[]> {
    // Only plans with a variant configured. Prices are ours rather than the
    // store's because Lemon Squeezy has no client-side catalogue to read —
    // which is fine, they're the same numbers we set there.
    return PLANS.filter((plan) => LEMON_VARIANTS[plan.id]).map((plan) => ({
      planId: plan.id,
      productId: LEMON_VARIANTS[plan.id]!.variantId,
      priceDisplay: plan.priceDisplay,
    }));
  }

  async purchase(planId: PlanId): Promise<PurchaseResult> {
    const variant = LEMON_VARIANTS[planId];
    if (!variant) {
      return {
        status: "unavailable",
        message: "That plan isn't available on the web yet.",
      };
    }
    if (!this.userId) {
      // Without an id the webhook cannot attribute the payment, so the person
      // would pay and get nothing. Refusing is the only honest option.
      return {
        status: "unavailable",
        message: "Please sign in before subscribing.",
      };
    }

    const url = checkoutUrl(variant, this.userId, this.email);

    // Lemon.js renders the checkout as an overlay on our own page. Every
    // context switch loses people, and the moment between deciding and paying
    // is the worst one to introduce a second website.
    //
    // Loaded on demand rather than in the app shell: it's a third-party
    // script, and putting it on every page load would cost every visitor
    // something for a thing almost none of them will use.
    const lemon = await loadLemonJs();
    if (lemon?.Url?.Open) {
      lemon.Url.Open(url);
    } else {
      // Script blocked or offline. A plain navigation still completes the
      // purchase — degrading to a full page beats a dead button.
      window.location.href = url;
    }

    // Not "purchased". The overlay is open; the person has not paid yet, and
    // the entitlement will arrive by webhook. Claiming success here is how
    // you end up granting access to someone who closed the window.
    return { status: "cancelled" };
  }

  async restore(): Promise<PurchaseResult> {
    return {
      status: "unavailable",
      message: "Web subscriptions restore automatically when you sign in.",
    };
  }

  manageUrl(): string | null {
    // Lemon Squeezy's own customer portal, where someone can cancel or update
    // a card. Sending people to an email support address to cancel is the
    // complaint that fills competitors' one-star reviews.
    return "https://app.lemonsqueezy.com/my-orders";
  }
}
