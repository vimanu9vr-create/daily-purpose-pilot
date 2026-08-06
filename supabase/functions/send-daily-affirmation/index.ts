// Sends the morning affirmation push.
//
// Designed to be called every 15 minutes by pg_cron. It works out which users
// are currently at their chosen local time, and sends to each of their devices.
//
// Requires these secrets:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (a mailto: URL)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (provided automatically)
//
// Optional, for the native apps:
//   FCM_SERVICE_ACCOUNT — the whole Firebase service-account JSON, as one
//   string. Delivers to both Android and iOS native builds, because iOS goes
//   through Firebase too rather than us talking to APNs directly.
//
// Web and native are different transports. A native row is stored with
// endpoint "native:<token>" and has no p256dh/auth keys, so pushing it through
// web-push throws. Routing by platform is what makes phone notifications
// actually arrive rather than failing once and being counted as a failure.

import webpush from "https://esm.sh/web-push@3.6.7";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Profile = {
  id: string;
  display_name: string | null;
  timezone: string | null;
  notify_hour: number;
  notify_minute: number;
  notifications_enabled: boolean;
  last_notified_on: string | null;
};

type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_token: string | null;
  platform: string | null;
  failure_count: number;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@manifestai.app";

    const fcmAccount = Deno.env.get("FCM_SERVICE_ACCOUNT");
    const webPushReady = Boolean(publicKey && privateKey);

    // Only a hard failure if neither transport is configured. Once FCM is set
    // up the phones work even if web push never gets keys.
    if (!webPushReady && !fcmAccount) {
      return json(
        {
          error: "not_configured",
          message: "Set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY for web, or FCM_SERVICE_ACCOUNT for the phone apps.",
        },
        503,
      );
    }

    if (webPushReady) {
      webpush.setVapidDetails(subject, publicKey!, privateKey!);
    }

    // One OAuth token for the whole run, not one per device.
    const fcmToken = fcmAccount ? await fcmAccessToken(fcmAccount) : null;
    const fcmProjectId = fcmAccount ? (JSON.parse(fcmAccount).project_id as string) : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    const profilesRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id,display_name,timezone,notify_hour,notify_minute,notifications_enabled,last_notified_on&notifications_enabled=is.true`,
      { headers: admin },
    );
    if (!profilesRes.ok) throw new Error(await profilesRes.text());
    const profiles = (await profilesRes.json()) as Profile[];

    const now = new Date();
    const due = profiles.filter((p) => isDue(p, now));

    if (due.length === 0) {
      return json({ sent: 0, checked: profiles.length, message: "Nobody due right now." }, 200);
    }

    let sent = 0;
    let failed = 0;

    for (const profile of due) {
      // Pick an affirmation the user hasn't seen most recently.
      const affirmationsRes = await fetch(
        `${supabaseUrl}/rest/v1/affirmations?select=id,text&user_id=eq.${profile.id}&order=last_shown_at.asc.nullsfirst,created_at.asc&limit=1`,
        { headers: admin },
      );
      const affirmations = affirmationsRes.ok
        ? ((await affirmationsRes.json()) as { id: string; text: string }[])
        : [];
      const affirmation = affirmations[0];
      if (!affirmation) continue;

      const subsRes = await fetch(
        `${supabaseUrl}/rest/v1/push_subscriptions?select=*&user_id=eq.${profile.id}`,
        { headers: admin },
      );
      const subs = subsRes.ok ? ((await subsRes.json()) as Subscription[]) : [];
      if (subs.length === 0) continue;

      const firstName = profile.display_name?.trim().split(" ")[0];
      const title = firstName ? `Morning, ${firstName}` : "Your affirmation for today";
      const payload = JSON.stringify({
        title,
        body: affirmation.text,
        url: "/app/affirmations",
        tag: "daily-affirmation",
      });

      for (const sub of subs) {
        const isNativeSub =
          sub.endpoint.startsWith("native:") || sub.platform === "ios" || sub.platform === "android";

        try {
          if (isNativeSub) {
            const token = sub.device_token ?? sub.endpoint.replace(/^native:/, "");
            if (!fcmToken || !fcmProjectId) {
              // Not an error against this device — we simply can't reach it
              // yet. Leave failure_count alone so the row survives setup.
              continue;
            }
            await sendFcm(fcmProjectId, fcmToken, token, title, affirmation.text);
          } else {
            if (!webPushReady) continue;
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload,
            );
          }
          sent += 1;
          await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
            method: "PATCH",
            headers: { ...admin, Prefer: "return=minimal" },
            body: JSON.stringify({ last_success_at: new Date().toISOString(), failure_count: 0 }),
          });
        } catch (error) {
          failed += 1;
          const status = (error as { statusCode?: number }).statusCode;
          const detail = (error as { body?: string }).body ?? String(error);

          // Say WHY. The previous version incremented a counter and threw the
          // reason away, so two devices sat at failure_count 1 with nothing to
          // explain it — impossible to debug without guessing.
          console.error(
            `push failed sub=${sub.id} platform=${sub.platform ?? "web"} status=${status ?? "none"} detail=${String(detail).slice(0, 300)}`,
          );

          // 404/410: the browser threw the subscription away.
          // 403/400: the push service rejected our signature — almost always
          // because this subscription was created against a different VAPID
          // key than the one we're signing with now. Retrying can never fix
          // that; the device has to subscribe again. Dropping the row is what
          // makes the app self-heal rather than failing quietly every morning.
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
        }
      }

      // Mark both so tomorrow's pick rotates and today isn't sent twice.
      await fetch(`${supabaseUrl}/rest/v1/affirmations?id=eq.${affirmation.id}`, {
        method: "PATCH",
        headers: { ...admin, Prefer: "return=minimal" },
        body: JSON.stringify({ last_shown_at: new Date().toISOString() }),
      });
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${profile.id}`, {
        method: "PATCH",
        headers: { ...admin, Prefer: "return=minimal" },
        body: JSON.stringify({ last_notified_on: localDateFor(profile.timezone, now) }),
      });
    }

    console.log(`daily affirmation: sent=${sent} failed=${failed} due=${due.length}`);
    return json({ sent, failed, due: due.length }, 200);
  } catch (error) {
    console.error("send-daily-affirmation failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

/** The user's local wall-clock time in their timezone. */
function localParts(timezone: string | null, now: Date) {
  const tz = timezone || "UTC";
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
    return {
      date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`,
      hour: Number(parts["hour"]),
      minute: Number(parts["minute"]),
    };
  } catch {
    return {
      date: now.toISOString().slice(0, 10),
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
    };
  }
}

function localDateFor(timezone: string | null, now: Date) {
  return localParts(timezone, now).date;
}

/**
 * Due when we're inside a 20-minute window after their chosen time and they
 * haven't already been sent one today. The window absorbs cron jitter without
 * risking a second send.
 */
function isDue(profile: Profile, now: Date): boolean {
  const { date, hour, minute } = localParts(profile.timezone, now);
  if (profile.last_notified_on === date) return false;

  const nowMinutes = hour * 60 + minute;
  const targetMinutes = profile.notify_hour * 60 + profile.notify_minute;
  const delta = nowMinutes - targetMinutes;
  return delta >= 0 && delta < 20;
}

/**
 * Exchanges a Firebase service account for an OAuth access token.
 *
 * Google only accepts a signed JWT here, so we sign one with WebCrypto rather
 * than pulling in a JWT library.
 */
async function fcmAccessToken(serviceAccountJson: string): Promise<string | null> {
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

async function sendFcm(
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
          data: { url: "/app/affirmations" },
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

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function pemToBytes(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
