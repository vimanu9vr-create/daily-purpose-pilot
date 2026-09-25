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
      await sendFcm(fcmProjectId, fcmToken, token, title, body);
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
          data: { url: "/app/practice" },
          android: {
            priority: "high",
            notification: { channel_id: "daily-affirmation", sound: "default" },
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

