// Lemon Squeezy → entitlement.
//
// The web half of what revenuecat-webhook does for the app stores. Same rule:
// this is the only thing that writes `subscriptions` for a web purchase. The
// client can't — it has SELECT and nothing else — and the browser that opened
// the checkout is not trusted to report the outcome.
//
// Required secret: LEMONSQUEEZY_WEBHOOK_SECRET, the signing secret from
// Lemon Squeezy → Settings → Webhooks.
//
// IMPORTANT: this function must have verify_jwt = false in config.toml.
// Lemon Squeezy signs with HMAC in X-Signature; it does not send a Supabase
// JWT. With the gateway check on, every event is rejected with 401 BEFORE the
// function runs, nothing appears in the logs because nothing started, and the
// only trace is a failure in Lemon Squeezy's own delivery log that nobody
// thinks to open. That exact mistake cost the RevenueCat webhook weeks.

import { FALLBACK_PLAN, planForVariant } from "./variant-mapping.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Events that mean "this person should have access right now". */
const GRANTING = new Set([
  "subscription_created",
  "subscription_resumed",
  "subscription_unpaused",
  "subscription_payment_success",
  "order_created",
]);

/** Events that end access immediately. */
const REVOKING = new Set([
  "subscription_expired",
  "subscription_paused",
  "order_refunded",
  "subscription_payment_refunded",
]);

type LemonEvent = {
  meta?: {
    event_name?: string;
    custom_data?: { user_id?: string };
  };
  data?: {
    attributes?: {
      variant_id?: number | string;
      first_order_item?: { variant_id?: number | string };
      status?: string;
      ends_at?: string | null;
      renews_at?: string | null;
      user_email?: string;
      total_formatted?: string;
      cancelled?: boolean;
    };
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const secret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET");
    if (!secret) {
      console.error("LEMONSQUEEZY_WEBHOOK_SECRET is not set");
      return json({ error: "not_configured" }, 503);
    }

    // Read the body as text ONCE. The signature is over the exact bytes sent,
    // so re-serialising parsed JSON would change whitespace and key order and
    // never match.
    const raw = await req.text();
    const signature = req.headers.get("X-Signature") ?? "";
    if (!(await validSignature(raw, signature, secret))) {
      console.warn("rejected webhook with bad signature");
      return json({ error: "unauthorized" }, 401);
    }

    const event = JSON.parse(raw) as LemonEvent;
    const name = event.meta?.event_name;
    const userId = event.meta?.custom_data?.user_id;
    if (!name) return json({ error: "bad_request" }, 400);

    // No user id means the checkout was opened without one — which our own
    // code refuses to do. Acknowledge so Lemon Squeezy stops retrying, but
    // make the noise loud, because it means somebody paid and we cannot say
    // who.
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
      console.error(`NO USER ID on ${name} — payment cannot be attributed`);
      return json({ ok: true, ignored: "no_user_id" }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    const attrs = event.data?.attributes ?? {};

    if (REVOKING.has(name)) {
      await fetch(`${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&status=eq.active`, {
        method: "PATCH",
        headers: { ...admin, Prefer: "return=minimal" },
        body: JSON.stringify({
          status: name.includes("refund") ? "refunded" : "expired",
          updated_at: new Date().toISOString(),
        }),
      });
      console.log(`revoked ${userId} (${name})`);
      return json({ ok: true }, 200);
    }

    if (GRANTING.has(name)) {
      // A subscription event carries variant_id directly; a one-off order
      // carries it on the first line item.
      const variantId = attrs.variant_id ?? attrs.first_order_item?.variant_id;
      const known = planForVariant(variantId);
      if (!known) {
        console.error(
          `UNMAPPED VARIANT "${variantId}" for ${userId} — granting ${FALLBACK_PLAN}. ` +
            `Add it to variant-mapping.ts and to src/features/billing/lemon.ts.`,
        );
      }
      const plan = known ?? FALLBACK_PLAN;
      const periodEnd = attrs.renews_at ?? attrs.ends_at ?? null;

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
          store: "lemonsqueezy",
          store_transaction_id: `ls:${variantId ?? plan}:${userId}`,
          price_display: attrs.total_formatted ?? null,
          current_period_end: periodEnd,
          cancel_at_period_end: Boolean(attrs.cancelled),
          updated_at: new Date().toISOString(),
        }),
      });

      if (!insert.ok) {
        console.error("subscription insert failed", await insert.text().catch(() => ""));
        // Non-2xx makes Lemon Squeezy retry, which is what we want.
        return json({ error: "write_failed" }, 500);
      }

      console.log(`granted ${plan} to ${userId} (${name})`);
      return json({ ok: true }, 200);
    }

    if (name === "subscription_cancelled") {
      // Cancellation is not revocation — they keep access to the end of the
      // period they paid for. Flag it so the profile screen says "Ends"
      // rather than "Renews".
      await fetch(`${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&status=eq.active`, {
        method: "PATCH",
        headers: { ...admin, Prefer: "return=minimal" },
        body: JSON.stringify({
          cancel_at_period_end: true,
          current_period_end: attrs.ends_at ?? null,
          updated_at: new Date().toISOString(),
        }),
      });
      console.log(`${userId} cancelled, access continues to period end`);
      return json({ ok: true }, 200);
    }

    console.log(`unhandled event ${name}`);
    return json({ ok: true, unhandled: name }, 200);
  } catch (error) {
    console.error("lemonsqueezy-webhook failed", error);
    return json({ error: "internal_error" }, 500);
  }
});

/**
 * HMAC-SHA256 over the raw body, compared in constant time.
 *
 * `crypto.subtle.verify` is the constant-time comparison — doing it with ===
 * on hex strings leaks timing information about how many leading characters
 * matched, which is enough to forge a signature given enough attempts.
 */
async function validSignature(raw: string, signature: string, secret: string): Promise<boolean> {
  if (!signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const bytes = signature.match(/.{1,2}/g)?.map((b) => parseInt(b, 16));
    if (!bytes || bytes.length !== 32) return false;
    return await crypto.subtle.verify(
      "HMAC",
      key,
      new Uint8Array(bytes),
      new TextEncoder().encode(raw),
    );
  } catch (error) {
    console.error("signature check threw", error);
    return false;
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
