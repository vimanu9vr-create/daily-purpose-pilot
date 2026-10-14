/**
 * Meta Pixel — the browser half of conversion tracking.
 *
 * ## What this can and cannot see
 *
 * It can see intent: somebody arrived, somebody clicked the checkout button.
 * It CANNOT see the purchase, and that is not a bug to be fixed here.
 *
 * Checkout happens on Lemon Squeezy's domain. The buyer leaves this site, pays
 * somewhere else, and no script of ours ever runs on the page where the money
 * moved. Any `Purchase` event fired from the browser would therefore be a
 * guess — fired on click, before payment, counting everyone who opened the
 * checkout and changed their mind.
 *
 * That guess is worse than no event at all. Meta optimises toward whatever you
 * tell it a conversion is, so a Purchase event that really means "clicked a
 * button" trains the algorithm to find button-clickers. The ad spend goes to
 * people who browse.
 *
 * So `Purchase` is sent server-side from `lemonsqueezy-webhook`, where an
 * HMAC-verified `order_created` proves money actually changed hands. The
 * webhook is already idempotent, which matters more than it looks: duplicate
 * purchase events corrupt optimisation, and payment providers retry.
 *
 * ## Why it fails silently
 *
 * Every function here is a no-op when the pixel ID is absent, when the script
 * was blocked, or when there is no `window`. Analytics must never be able to
 * break a page — a tracker that throws during checkout costs real money, and
 * the thing it was measuring is the thing it broke.
 */

/**
 * Set at build time via `VITE_META_PIXEL_ID`. Public by design — it is visible
 * in the page source of every site running a pixel — so it belongs in env
 * rather than in secrets, and the app works without it.
 */
const PIXEL_ID = import.meta.env["VITE_META_PIXEL_ID"] as string | undefined;

type Fbq = ((...args: unknown[]) => void) & {
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: unknown;
  callMethod?: (...args: unknown[]) => void;
};

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof candidate === "function" ? candidate : null;
}

/** True when tracking is configured. Useful for not rendering a consent row. */
export function pixelConfigured(): boolean {
  return Boolean(PIXEL_ID);
}

let started = false;

/**
 * Load the pixel and fire the initial PageView.
 *
 * Idempotent: calling it twice is a no-op rather than two PageViews. Worth
 * guarding because a client-side router remounts layouts, and a double
 * PageView on arrival quietly halves your reported conversion rate.
 */
export function initPixel(): void {
  if (started || !PIXEL_ID || typeof window === "undefined") return;
  started = true;

  const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };

  if (!w.fbq) {
    const shim: Fbq = function (...args: unknown[]) {
      if (shim.callMethod) shim.callMethod(...args);
      else shim.queue?.push(args);
    } as Fbq;
    shim.queue = [];
    shim.loaded = true;
    shim.version = "2.0";
    shim.push = shim;
    w.fbq = shim;
    w._fbq ??= shim;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    // If this never loads — ad blocker, offline, Meta down — the shim simply
    // accumulates events in `queue` and nothing throws.
    document.head.appendChild(script);
  }

  w.fbq?.("init", PIXEL_ID);
  w.fbq?.("track", "PageView");
}

/**
 * Somebody opened a checkout. The strongest signal available client-side, and
 * the right event to optimise on until enough real purchases exist for Meta to
 * learn from them — it needs roughly fifty conversions before it can.
 *
 * `value` and `currency` are sent so Meta can weight a $79 intent above a
 * $2.49 one. Without them every plan looks identical and the algorithm
 * optimises for whichever is easiest to click, which is the cheapest.
 */
export function trackInitiateCheckout(plan: string, value: number, currency = "USD"): void {
  fbq()?.("track", "InitiateCheckout", { content_name: plan, value, currency });
}

/** Signed up, not yet paid. Mid-funnel, for diagnosing where people stop. */
export function trackSignUp(): void {
  fbq()?.("track", "CompleteRegistration");
}

/**
 * Deliberately absent: `trackPurchase`.
 *
 * There is no honest way to fire it from here — see the header. If you find
 * yourself wanting it, the event you actually want is InitiateCheckout, and
 * the Purchase you are looking for is sent by the webhook.
 */
