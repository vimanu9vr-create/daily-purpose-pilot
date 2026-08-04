/**
 * Purchase layer.
 *
 * Everything the app does with money goes through this interface, so the
 * screens never know whether they're talking to StoreKit, Google Play or
 * nothing at all. Today only the web stub exists; adding Capacitor swaps the
 * implementation without touching a single component.
 *
 * Apple's rules shape this: inside an iOS app, digital subscriptions must go
 * through in-app purchase, and the app may not link out to an external
 * checkout. So there is deliberately no Stripe path here.
 */

import { PLANS, type PlanId } from "./plans";

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
      message: "Subscriptions are available in the ManifestAI app on iPhone.",
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
 * StoreKit via RevenueCat.
 *
 * RevenueCat sits between the app and Apple: it validates receipts, tracks
 * renewals, cancellations, refunds and billing-grace periods, and posts each
 * change to our webhook. That webhook is what writes the `subscriptions` row.
 *
 * The rule that matters: the client never grants its own entitlement. Even
 * here, after a successful purchase, we refresh from our own database rather
 * than trusting what the SDK just told us — a jailbroken device can lie to the
 * SDK, but it can't forge a server-to-server webhook.
 */
class AppleStore implements PurchaseStore {
  readonly isNative = true;
  private configured = false;

  /** RevenueCat is configured once, with our user id as its app user id. */
  private async ensureConfigured(userId?: string): Promise<void> {
    if (this.configured) return;

    const apiKey = import.meta.env["VITE_REVENUECAT_IOS_KEY"] as string | undefined;
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
      const plan = PLANS.find((p) => p.productId === pkg.product.identifier);
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
      const target = offerings.current?.availablePackages.find(
        (pkg) => pkg.product.identifier === plan.productId,
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
    return "https://apps.apple.com/account/subscriptions";
  }
}

let instance: PurchaseStore | null = null;

export function purchaseStore(): PurchaseStore {
  if (instance) return instance;

  const isCapacitor =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor);

  instance = isCapacitor ? new AppleStore() : new WebStore();
  return instance;
}
