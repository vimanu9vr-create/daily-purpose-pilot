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

/**
 * StoreKit, via Capacitor. Left as the single place to fill in once the
 * native shell exists — the rest of the app already calls through here.
 *
 * The important rule for whoever implements it: a successful purchase must be
 * sent to an edge function that verifies the receipt with Apple and writes the
 * subscriptions row. Never let the client grant its own entitlement.
 */
class AppleStore implements PurchaseStore {
  readonly isNative = true;

  async listProducts(): Promise<StoreProduct[]> {
    throw new Error("StoreKit not wired yet");
  }

  async purchase(): Promise<PurchaseResult> {
    return { status: "unavailable", message: "In-app purchase isn't set up yet." };
  }

  async restore(): Promise<PurchaseResult> {
    return { status: "unavailable", message: "In-app purchase isn't set up yet." };
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
