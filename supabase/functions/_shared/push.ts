/**
 * Push delivery, shared by every function that sends a notification.
 *
 * Extracted from send-daily-affirmation, which had all of this inline. The
 * evening gratitude job needs exactly the same machinery — FCM service-account
 * JWT signing, web-push for browsers, the failure bookkeeping that retires a
 * dead subscription — and a second copy of RS256 signing code is a guarantee
 * that the two drift and only one of them gets the next fix.
 *
 * Moved verbatim. No behaviour changed in the extraction; the only edits are
 * `export` keywords and the imports it needs to stand alone.
 */

import webpush from "https://esm.sh/web-push@3.6.7";

export type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_token: string | null;
  platform: string | null;
  failure_count: number;
};

/** One notification, resolved and ready to send. */
export type Delivery = {
  sub: Subscription;
  title: string;
  body: string;
  payload: string;
};

export type DeliveryResult = {
  ok: boolean;
  diagnostic?: { sub: string; status: number | string; detail: string };
};

export type PushContext = {
  supabaseUrl: string;
  admin: Record<string, string>;
  webPushReady: boolean;
  fcmToken: string | null;
  fcmProjectId: string | null;
};

export async function deliverOne(
  { sub, title, body, payload }: Delivery,
  context: {
    supabaseUrl: string;
    admin: Record<string, string>;
    webPushReady: boolean;
    fcmToken: string | null;
    fcmProjectId: string | null;
  },
): Promise<DeliveryResult> {
  const { supabaseUrl, admin, webPushReady, fcmToken, fcmProjectId } = context;

  const isNativeSub =
    sub.endpoint.startsWith("native:") || sub.platform === "ios" || sub.platform === "android";

  try {
    if (isNativeSub) {
      const token = sub.device_token ?? sub.endpoint.replace(/^native:/, "");
      if (!fcmToken || !fcmProjectId) {
        // Not an error against this device — we simply can't reach it yet.
        // Leave failure_count alone so the row survives setup.
        return { ok: false };
      }
      // The tap target travels with the notification. `payload` is the web
      // push body and already carries it; parse it out rather than adding a
      // second source of truth that can disagree with the first.
      let url = "/app/practice";
      try {
        const parsed = JSON.parse(payload) as { url?: string };
        if (parsed.url) url = parsed.url;
      } catch {
        // Malformed payload shouldn't stop the notification going out.
      }
      await sendFcm(fcmProjectId, fcmToken, token, title, body, url);
    } else {
      if (!webPushReady) return { ok: false };
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
    }

    await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
      method: "PATCH",
      headers: { ...admin, Prefer: "return=minimal" },
      body: JSON.stringify({ last_success_at: new Date().toISOString(), failure_count: 0 }),
    });

    return { ok: true };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    const detail = (error as { body?: string }).body ?? String(error);

    // Say WHY. An earlier version incremented a counter and threw the reason
    // away, so two devices sat at failure_count 1 with nothing to explain it —
    // impossible to debug without guessing.
    console.error(
      `push failed sub=${sub.id} platform=${sub.platform ?? "web"} status=${status ?? "none"} detail=${String(detail).slice(0, 300)}`,
    );

    // 404/410: the browser threw the subscription away.
    // 403/400: the push service rejected our signature — almost always because
    // this subscription was created against a different VAPID key than the one
    // we're signing with now. Retrying can never fix that; the device has to
    // subscribe again. Dropping the row is what makes the app self-heal rather
    // than failing quietly every morning.
    if (status === 404 || status === 410 || status === 403 || status === 400) {
      await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
        method: "DELETE",
        headers: { ...admin, Prefer: "return=minimal" },
      });
    } else {
      await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
        method: "PATCH",
        headers: { ...admin, Prefer: "return=minimal" },
        body: JSON.stringify({ failure_count: sub.failure_count + 1 }),
      });
    }

    return {
      ok: false,
      diagnostic: {
        sub: sub.id.slice(0, 8),
        status: status ?? "none",
        detail: String(detail).slice(0, 200),
      },
    };
  }
}

export async function fcmAccessToken(serviceAccountJson: string): Promise<string | null> {
  try {
    const account = JSON.parse(serviceAccountJson) as {
      client_email: string;
      private_key: string;
    };

    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const encode = (obj: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(obj)));
    const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode(claim)}`;

    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToBytes(account.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    );

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${base64Url(new Uint8Array(signature))}`,
      }),
    });

    if (!response.ok) {
      console.error("FCM token exchange failed", await response.text());
      return null;
    }
    return ((await response.json()) as { access_token: string }).access_token;
  } catch (error) {
    console.error("FCM service account is not usable", error);
    return null;
  }
}

export async function sendFcm(
  projectId: string,
  accessToken: string,
  deviceToken: string,
  title: string,
  body: string,
  /** Where tapping it should land. Was hardcoded; see below. */
  url = "/app/practice",
): Promise<void> {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body },
          // WAS hardcoded to "/app/practice", so the evening gratitude
          // notification opened the practice screen. The web-push payload
          // already carried the right url; this path discarded it.
          data: { url },
          android: {
            priority: "high",
            // NO channel_id — and this is why nothing has ever arrived.
            //
            // It used to say channel_id: "daily-affirmation", a channel the
            // app has never created: there is no createChannel call anywhere
            // in the codebase and no default_notification_channel_id in the
            // manifest. On Android 8+ a notification posted to a channel that
            // does not exist is SILENTLY DISCARDED by the system. FCM accepts
            // the message and returns success, the function logs "1 sent, 0
            // failed", and the phone shows nothing.
            //
            // That is why no push has ever landed on either job, before or
            // after the cron window was fixed — two separate faults with one
            // identical symptom, which is why fixing the first changed
            // nothing visible.
            //
            // Omitting it uses the app's default channel, declared in
            // AndroidManifest.xml. The app also creates a named channel at
            // startup now, but the manifest default is what keeps this
            // working on a device where the app hasn't been opened since.
            sound: "default",
          },
          apns: {
            payload: { aps: { sound: "default", "content-available": 1 } },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    // Mirror web push's gone-codes so a dead token gets cleaned up the same way.
    const gone = /UNREGISTERED|INVALID_ARGUMENT/.test(text);
    const error = new Error(text) as Error & { statusCode?: number };
    error.statusCode = gone ? 410 : response.status;
    throw error;
  }
}

export function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function pemToBytes(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}


/**
 * Credentials for talking to our own PostgREST.
 *
 * ## Why this is not just `Bearer <service role key>`
 *
 * Both notification jobs started failing every run with
 *
 *     PGRST303 — "JWT issued at future"
 *
 * PostgREST validates the `iat` claim on a JWT it is handed in the
 * Authorization header, and rejects one issued ahead of its own clock. The
 * job then logs "claim failed" and returns cleanly, so the cron looks healthy
 * from outside and no notification is ever sent. Three days of silence with
 * nothing reporting an error.
 *
 * Two things make that survivable:
 *
 * 1. PREFER A NON-JWT KEY. Supabase's newer `sb_secret_…` keys are opaque
 *    strings, not JWTs, so there is no `iat` to be wrong about and this class
 *    of failure cannot happen. If one is present, it is used.
 *
 * 2. ONLY SEND A BEARER TOKEN WHEN THE KEY IS ACTUALLY A JWT. Putting an
 *    opaque key in the Authorization header invites PostgREST to parse it as
 *    one and fail differently. `apikey` alone is what authenticates a
 *    non-JWT key.
 *
 * Never logs the key itself — only which variable it came from and whether it
 * is JWT-shaped, which is all that is needed to diagnose this and all that is
 * safe to write down.
 */
export function adminHeaders(): Record<string, string> {
  const secret = Deno.env.get("SUPABASE_SECRET_KEY");
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const key = secret ?? legacy ?? "";

  if (!key) {
    console.error("no service credential: neither SUPABASE_SECRET_KEY nor SUPABASE_SERVICE_ROLE_KEY");
    return { "Content-Type": "application/json" };
  }

  // A JWT is three dot-separated base64url segments. Anything else — including
  // sb_secret_… — is opaque and must not go in the Authorization header.
  const looksLikeJwt = key.split(".").length === 3 && key.startsWith("ey");

  console.log(
    `db credential: source=${secret ? "SUPABASE_SECRET_KEY" : "SUPABASE_SERVICE_ROLE_KEY"} ` +
      `shape=${looksLikeJwt ? "jwt" : "opaque"}`,
  );

  return {
    apikey: key,
    ...(looksLikeJwt ? { Authorization: `Bearer ${key}` } : {}),
    "Content-Type": "application/json",
  };
}

/** Turn a PostgREST failure into something that names the actual cause. */
export function explainPostgrest(status: number, bodyText: string): string {
  if (bodyText.includes("PGRST303")) {
    return (
      `${status} PGRST303 "JWT issued at future" — PostgREST rejected the service ` +
      `credential because its issued-at time is ahead of the database clock. This is a ` +
      `credential problem, not a code one: rotate/reissue the service key in Settings → ` +
      `API Keys, or set SUPABASE_SECRET_KEY to an sb_secret_ key, which has no iat to be ` +
      `wrong about. Body: ${bodyText.slice(0, 200)}`
    );
  }
  return `${status} ${bodyText.slice(0, 300)}`;
}
