// RevenueCat → entitlement.
//
// This is the only thing that writes the `subscriptions` table. The client
// can't: it has SELECT and nothing else. A jailbroken device can lie to the
// SDK on-device, but it cannot forge a server-to-server call carrying our
// shared secret — so entitlement is decided here or not at all.
//
// A subscription is a stream of events, not one purchase. Renewals,
// cancellations, refunds, billing failures and grace periods all arrive here,
// and each has to be handled or someone keeps premium after they stop paying.
//
// Required secret: REVENUECAT_WEBHOOK_SECRET (set the same value as the
// Authorization header in RevenueCat's webhook settings).

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Store product identifier → the plan we record.
 *
 * These must match `src/features/billing/plans.ts` exactly. The plan string
 * written here is what `narrate-story` later reads to decide whether somebody
 * may commission narration, so a wrong entry here is not a display bug — it is
 * either giving the expensive tier away or withholding a paid one.
 *
 * The three bare names at the bottom are the plans sold before the Standard /
 * Voice split. They included narration, so they keep it.
 */
const PLAN_BY_PRODUCT: Record<string, string> = {
  "com.manifestai.standard.monthly": "standard_monthly",
  "com.manifestai.standard.yearly": "standard_yearly",
  "com.manifestai.standard.lifetime": "standard_lifetime",
  "com.manifestai.voice.monthly": "voice_monthly",
  "com.manifestai.voice.yearly": "voice_yearly",

  // Sold before the split.
  "com.manifestai.premium.monthly": "monthly",
  "com.manifestai.premium.yearly": "yearly",
  "com.manifestai.premium.lifetime": "lifetime",
};

/**
 * What to record when the product isn't in that map.
 *
 * It used to be "monthly" — which, after the split, is the LEGACY id and maps
 * to the voice tier. So a typo in App Store Connect, or a product created and
 * not added here, would have handed the $14.99 plan to somebody paying $4.99,
 * silently, for as long as it took anyone to notice.
 *
 * Standard is the safe direction to be wrong in. The person has paid and gets
 * the base paid tier immediately, nobody is handed narration by accident, and
 * the error is logged loudly enough to find. Refusing outright was the other
 * option and it is worse: it takes money and grants nothing.
 */
const FALLBACK_PLAN = "standard_monthly";

/** Events that mean "this person should have premium right now". */
const GRANTING = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "PRODUCT_CHANGE",
]);

/** Events that end access immediately. */
const REVOKING = new Set(["EXPIRATION", "REFUND", "SUBSCRIPTION_PAUSED"]);

type RevenueCatEvent = {
  type: string;
  app_user_id: string;
  original_app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  cancel_reason?: string | null;
  price?: number;
  currency?: string;
  store?: string;
  period_type?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    if (!secret) {
      console.error("REVENUECAT_WEBHOOK_SECRET is not set");
      return json({ error: "not_configured" }, 503);
    }

    // RevenueCat sends whatever we put in its Authorization header field.
    const provided = req.headers.get("Authorization") ?? "";
    if (provided !== secret && provided !== `Bearer ${secret}`) {
      console.warn("rejected webhook with bad secret");
      return json({ error: "unauthorized" }, 401);
    }

    const body = (await req.json()) as { event?: RevenueCatEvent };
    const event = body.event;
    if (!event?.type || !event.app_user_id) return json({ error: "bad_request" }, 400);

    // We configure RevenueCat with our own user id, so this is a Supabase uuid.
    const userId = event.app_user_id;
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      // Anonymous RevenueCat id — the user hadn't been identified yet. Nothing
      // to grant, and not an error worth retrying.
      console.log(`ignoring event for anonymous id ${userId}`);
      return json({ ok: true, ignored: "anonymous" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    if (REVOKING.has(event.type)) {
      await fetch(`${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&status=eq.active`, {
        method: "PATCH",
        headers: { ...admin, Prefer: "return=minimal" },
        body: JSON.stringify({
          status: event.type === "REFUND" ? "refunded" : "expired",
          updated_at: new Date().toISOString(),
        }),
      });
      console.log(`revoked ${userId} (${event.type})`);
      return json({ ok: true }, 200);
    }

    if (GRANTING.has(event.type)) {
      const known = PLAN_BY_PRODUCT[event.product_id ?? ""];
      if (!known) {
        console.error(
          `UNMAPPED PRODUCT "${event.product_id}" for ${userId} — granting ${FALLBACK_PLAN}. ` +
            `Add it to PLAN_BY_PRODUCT and to src/features/billing/plans.ts.`,
        );
      }
      const plan = known ?? FALLBACK_PLAN;
      const periodEnd = event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null;

      // One active row per user is enforced by a partial unique index, so
      // close any existing one before opening the new one.
      await fetch(`${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&status=eq.active`, {
        method: "PATCH",
        headers: { ...admin, Prefer: "return=minimal" },
        body: JSON.stringify({ status: "superseded", updated_at: new Date().toISOString() }),
      });

      const insert = await fetch(`${supabaseUrl}/rest/v1/subscriptions`, {
        method: "POST",
        headers: { ...admin, Prefer: "return=minimal" },
        body: JSON.stringify({
          user_id: userId,
          plan,
          status: "active",
          store: event.store?.toLowerCase() ?? "apple",
          store_transaction_id: `${event.original_app_user_id ?? userId}:${event.product_id ?? plan}`,
          price_display: event.price && event.currency ? `${event.currency} ${event.price}` : null,
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!insert.ok) {
        console.error("subscription insert failed", await insert.text().catch(() => ""));
        // Non-2xx makes RevenueCat retry, which is what we want.
        return json({ error: "write_failed" }, 500);
      }

      console.log(`granted ${plan} to ${userId} (${event.type})`);
      return json({ ok: true }, 200);
    }

    if (event.type === "CANCELLATION") {
      // Cancellation is not revocation — they keep access until the period
      // ends. Flag it so the profile screen can say "Ends" rather than "Renews".
      await fetch(`${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&status=eq.active`, {
        method: "PATCH",
        headers: { ...admin, Prefer: "return=minimal" },
        body: JSON.stringify({ cancel_at_period_end: true, updated_at: new Date().toISOString() }),
      });
      console.log(`${userId} cancelled, access continues to period end`);
      return json({ ok: true }, 200);
    }

    // BILLING_ISSUE, TRANSFER, TEST and anything new: acknowledge so
    // RevenueCat stops retrying, but change nothing.
    console.log(`unhandled event type ${event.type}`);
    return json({ ok: true, unhandled: event.type }, 200);
  } catch (error) {
    console.error("revenuecat-webhook failed", error);
    return json({ error: "internal_error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
