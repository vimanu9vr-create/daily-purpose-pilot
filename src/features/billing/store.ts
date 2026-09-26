/**
 * Purchase layer.
 *
 * Everything the app does with money goes through this interface, so the
 * screens never know whether they're talking to StoreKit, Google Play or
 * nothing at all. Today only the web stub exists; adding Capacitor swaps the
 * implementation without touching a single component.
 *
 * Apple's rules shape this: INSIDE an iOS app, digital subscriptions must go
 * through in-app purchase and the app may not link out to an external
 * checkout.
 *
 * That rule governs apps distributed through an app store. It does not reach
 * a website opened in Safari or Chrome, and for a long time this file applied
 * it to both — so the web refused to sell anything and every iPhone user was
 * told to go and get an app that doesn't exist. `pickStore` now draws the
 * line where it actually falls: Capacitor gets the platform's billing, a
 * browser gets Lemon Squeezy.
 */

import { LemonStore } from "./lemon";
import { PLANS, matchesProduct, type PlanId } from "./plans";

export type PurchaseResult =
  | { status: "purchased" }
  | { status: "cancelled" }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

export type StoreProduct = {
  planId: PlanId;
  productId: string;
  /** Localised by the store. Falls back to our display string on web. */
  priceDisplay: string;
};

export interface PurchaseStore {
  readonly isNative: boolean;
  listProducts(): Promise<StoreProduct[]>;
  purchase(planId: PlanId): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
  /** Deep link to where the platform lets people cancel. */
  manageUrl(): string | null;
}

/**
 * Web/PWA. Purchases aren't possible here — and per Apple's rules we must not
 * point iOS users at an external checkout — so this reports unavailable rather
 * than pretending.
 */
class WebStore implements PurchaseStore {
  readonly isNative = false;

  async listProducts(): Promise<StoreProduct[]> {
    return PLANS.map((plan) => ({
      planId: plan.id,
      productId: plan.productId ?? plan.id,
      priceDisplay: plan.priceDisplay,
    }));
  }

  async purchase(): Promise<PurchaseResult> {
    return {
      status: "unavailable",
      message: "Subscriptions are available in the ManifestAI app on your phone.",
    };
  }

  async restore(): Promise<PurchaseResult> {
    return {
      status: "unavailable",
      message: "Purchases are restored from the device you bought them on.",
    };
  }

  manageUrl(): string | null {
    return null;
  }
}

/** RevenueCat entitlement name, configured in their dashboard. */
export const PREMIUM_ENTITLEMENT = "premium";

/**
 * The store on a real device, via RevenueCat. Apple OR Google.
 *
 * RevenueCat sits between the app and the store: it validates receipts, tracks
 * renewals, cancellations, refunds and billing-grace periods, and posts each
 * change to our webhook. That webhook is what writes the `subscriptions` row.
 *
 * The rule that matters: the client never grants its own entitlement. Even
 * here, after a successful purchase, we refresh from our own database rather
 * than trusting what the SDK just told us — a jailbroken device can lie to the
 * SDK, but it can't forge a server-to-server webhook.
 *
 * ## This was called AppleStore and read only the iOS key
 *
 * Which would have been found on the day of the Play launch, by somebody
 * tapping Subscribe and being told the app "isn't switched on yet". RevenueCat
 * issues a SEPARATE key per platform — `appl_…` for the App Store, `goog_…`
 * for Play — and configuring with the wrong one fails outright.
 *
 * Google Play is the first launch target, so the Android key is the one that
 * actually has to work. Same for `manageUrl`: pointing an Android user at
 * apps.apple.com to cancel is the complaint that fills Stella's one-star
 * reviews, and it would have been ours too.
 */
class NativeStore implements PurchaseStore {
  readonly isNative = true;
  private configured = false;

  /** RevenueCat is configured once, with our user id as its app user id. */
  private async ensureConfigured(userId?: string): Promise<void> {
    if (this.configured) return;

    const apiKey = (
      platform() === "android"
        ? import.meta.env["VITE_REVENUECAT_ANDROID_KEY"]
        : import.meta.env["VITE_REVENUECAT_IOS_KEY"]
    ) as string | undefined;
    if (!apiKey) throw new Error("not_configured");

    const { Purchases, LOG_LEVEL } = await import("@revenuecat/purchases-capacitor");
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({
      apiKey,
      // Tying RevenueCat's identity to our own means a purchase follows the
      // account, not the device — so restoring on a new phone works.
      ...(userId ? { appUserID: userId } : {}),
    });
    this.configured = true;
  }

  async listProducts(): Promise<StoreProduct[]> {
    await this.ensureConfigured();
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];

    return packages.flatMap((pkg) => {
      const plan = PLANS.find((p) => matchesProduct(pkg.product.identifier, p.productId));
      if (!plan) return [];
      return [
        {
          planId: plan.id,
          productId: pkg.product.identifier,
          // Apple's localised price for this storefront — never our hardcoded one.
          priceDisplay: pkg.product.priceString,
        },
      ];
    });
  }

  async purchase(planId: PlanId): Promise<PurchaseResult> {
    try {
      await this.ensureConfigured();
      const { Purchases } = await import("@revenuecat/purchases-capacitor");

      const plan = PLANS.find((p) => p.id === planId);
      if (!plan?.productId) return { status: "error", message: "That plan isn't available." };

      const offerings = await Purchases.getOfferings();
      const target = offerings.current?.availablePackages.find((pkg) =>
        matchesProduct(pkg.product.identifier, plan.productId),
      );
      if (!target) {
        return { status: "unavailable", message: "That plan isn't available on this device yet." };
      }

      const { customerInfo } = await Purchases.purchasePackage({ aPackage: target });
      const active = Boolean(customerInfo.entitlements.active[PREMIUM_ENTITLEMENT]);
      if (!active) {
        return { status: "error", message: "The purchase didn't complete. You weren't charged." };
      }
      return { status: "purchased" };
    } catch (error) {
      const err = error as { code?: string; message?: string; userCancelled?: boolean };
      if (err.userCancelled || err.code === "1") return { status: "cancelled" };
      if (err.message === "not_configured") {
        return { status: "unavailable", message: "Purchases aren't switched on yet." };
      }
      return {
        status: "error",
        message: err.message ?? "Something went wrong. You weren't charged.",
      };
    }
  }

  async restore(): Promise<PurchaseResult> {
    try {
      await this.ensureConfigured();
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      const { customerInfo } = await Purchases.restorePurchases();
      const active = Boolean(customerInfo.entitlements.active[PREMIUM_ENTITLEMENT]);
      return active
        ? { status: "purchased" }
        : { status: "unavailable", message: "No previous purchase found on this Apple ID." };
    } catch (error) {
      const err = error as { message?: string };
      if (err.message === "not_configured") {
        return { status: "unavailable", message: "Purchases aren't switched on yet." };
      }
      return { status: "error", message: err.message ?? "Couldn't restore that." };
    }
  }

  manageUrl(): string {
    // Each store cancels in its own place, and sending somebody to the wrong
    // one reads as deliberately hiding the exit.
    return platform() === "android"
      ? "https://play.google.com/store/account/subscriptions"
      : "https://apps.apple.com/account/subscriptions";
  }
}

/** "ios" | "android" | "web", straight from Capacitor. */
function platform(): string {
  if (typeof window === "undefined") return "web";
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() ?? "web";
}

let instance: PurchaseStore | null = null;
let webUserId: string | null = null;
let webEmail: string | undefined;

/**
 * Which store this device gets — the whole compliance boundary, in one line.
 *
 * Under Capacitor (the Android app, and iOS if it ever ships) it's RevenueCat
 * and the platform's own billing, because both stores require in-app purchase
 * for digital subscriptions inside an installed app.
 *
 * In a browser it's Lemon Squeezy. Keeping this decision in a single place is
 * deliberate: the moment the same question gets asked in two files, one of
 * them eventually answers it differently.
 */
export function purchaseStore(): PurchaseStore {
  if (instance) return instance;

  const isCapacitor =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor);

  instance = isCapacitor ? new NativeStore() : new LemonStore(webUserId, webEmail);
  return instance;
}

/**
 * Tell the web store who is signed in.
 *
 * The id rides along as Lemon Squeezy checkout custom data and comes back on
 * every webhook, which is how a payment is matched to an account. Matching on
 * email would be wrong — people pay with a different address than they signed
 * up with more often than you'd expect, and that person would pay and get
 * nothing.
 *
 * Until this is called the web store has no id and refuses to open a
 * checkout, rather than taking money it cannot attribute.
 */
export function identifyWebBuyer(userId: string | null, email?: string): void {
  if (userId === webUserId && email === webEmail) return;
  webUserId = userId;
  webEmail = email;
  // Drop the cached instance so the next call picks up the new identity.
  if (instance && !instance.isNative) instance = null;
}

/** Kept for tests and for the "not available here" copy. Not selected any more. */
export { WebStore };
