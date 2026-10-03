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
    /** The subscription or order id at Lemon Squeezy. Stable for its lifetime. */
    id?: string;
    attributes?: {
      updated_at?: string;
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
    const admin = adminHeaders();

    const attrs = event.data?.attributes ?? {};

    // Idempotency, before anything is written.
    //
    // Lemon Squeezy retries on any non-2xx and on a timeout, so the same event
    // arrives more than once as a matter of course. Without this, a retry
    // supersedes the row just written and inserts a second one — and
    // `useSubscription` reads with `.maybeSingle()`, which ERRORS on two rows,
    // so the paywall would fail open to free for somebody who had just paid.
    //
    // There is no per-delivery id in the payload, so the key is composed from
    // the three things that identify a logical event: what happened, which
    // object it happened to, and when that object last changed. A retry of the
    // same delivery reproduces all three; a genuine later change does not.
    const eventKey = `${name}:${event.data?.id ?? "unknown"}:${attrs.updated_at ?? ""}`;
    const claim = await fetch(`${supabaseUrl}/rest/v1/webhook_events`, {
      method: "POST",
      headers: { ...admin, Prefer: "return=minimal" },
      body: JSON.stringify({
        provider: "lemonsqueezy",
        event_id: eventKey,
        event_name: name,
        user_id: userId,
        outcome: "processing",
      }),
    });

    if (claim.status === 409) {
      // The unique index rejected it: we have seen this delivery. Acknowledge
      // so the store stops retrying, and change nothing.
      console.log(`duplicate delivery ignored: ${eventKey}`);
      return json({ ok: true, ignored: "duplicate" }, 200);
    }
    if (!claim.ok) {
      // Could not record it, so cannot promise to process it only once.
      // Refuse: a retry is cheap, a double-grant is not.
      console.error("could not claim webhook event", claim.status, await claim.text().catch(() => ""));
      return json({ error: "claim_failed" }, 500);
    }

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
          // The provider's own id for the subscription or order. This used to
          // be `ls:{variant}:{user}`, which is the same string for every
          // renewal of the same plan by the same person — it identified a
          // plan-and-person rather than a payment, so it could never be used
          // to recognise anything. The real id can be pasted straight into the
          // Lemon Squeezy dashboard when somebody writes in about a charge.
          store_transaction_id: event.data?.id ?? null,
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

/**
 * PostgREST credentials that work with either key format.
 *
 * This project has moved to the new opaque secret keys (`sb_secret_…`), and
 * an opaque key sent as `Authorization: Bearer` is parsed as a JWT, fails
 * `iat` validation, and comes back PGRST303. That is not a hypothetical: it
 * is one of the three faults that kept every push notification silent for
 * days, and it presents the same way here — the payment succeeds, Lemon
 * Squeezy is told we failed, and the subscriber has no row.
 *
 * So: send the key as `apikey` always, and add the Bearer header only when
 * the value actually looks like a JWT. Same logic as `_shared/push.ts`,
 * copied rather than imported so this function deploys as a self-contained
 * bundle.
 */
function adminHeaders(): Record<string, string> {
  const secret = Deno.env.get("SUPABASE_SECRET_KEY");
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const key = secret ?? legacy ?? "";
  const looksLikeJwt = key.split(".").length === 3 && key.startsWith("ey");
  return {
    apikey: key,
    ...(looksLikeJwt ? { Authorization: `Bearer ${key}` } : {}),
    "Content-Type": "application/json",
  };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
