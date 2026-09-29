// A test notification that actually goes through the real path.
//
// ## Why this exists
//
// The "Send a test" button called `registration.showNotification()` — which
// draws a notification locally, on the device, from the service worker. No
// server, no VAPID, no FCM, no subscription lookup. It proves the permission
// is granted and that the phone can display something, and nothing at all
// about whether a push can reach it.
//
// So for weeks the button said everything was fine while the thing it claimed
// to test had never once worked. Three separate faults hid behind it.
//
// This does the opposite: it uses exactly the same claim → look up
// subscriptions → deliverOne path the scheduled jobs use, against the caller's
// own account, on demand. If this arrives, the morning and evening jobs will
// arrive. If it doesn't, the response says which of the five steps failed
// rather than leaving somebody to guess for three days.
//
// verify_jwt stays TRUE here: this is called by a signed-in user from the app,
// so the platform gate is exactly right and the user's own JWT identifies whom
// to send to.

import webpush from "https://esm.sh/web-push@3.6.7";

import { adminHeaders, deliverOne, fcmAccessToken, type Subscription } from "../_shared/push.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Each step, so a failure names itself instead of being "didn't work". */
type Step =
  | "not_signed_in"
  | "no_delivery_channel"
  | "no_subscriptions"
  | "all_failed"
  | "sent";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = adminHeaders();

    // Who is asking. The gateway has already validated this JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: admin["apikey"] ?? "" },
    });
    if (!userResponse.ok) return json({ step: "not_signed_in" as Step }, 401);
    const user = (await userResponse.json()) as { id?: string };
    if (!user.id) return json({ step: "not_signed_in" as Step }, 401);

    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:vimanu9.vr@gmail.com";
    const fcmAccount = Deno.env.get("FCM_SERVICE_ACCOUNT");

    const webPushReady = Boolean(publicKey && privateKey);
    if (!webPushReady && !fcmAccount) {
      return json(
        { step: "no_delivery_channel" as Step, detail: "neither VAPID nor FCM_SERVICE_ACCOUNT set" },
        503,
      );
    }
    if (webPushReady) webpush.setVapidDetails(subject, publicKey!, privateKey!);

    const fcmToken = fcmAccount ? await fcmAccessToken(fcmAccount) : null;
    const fcmProjectId = fcmAccount ? (JSON.parse(fcmAccount).project_id as string) : null;

    const subsResponse = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${user.id}` +
        `&select=id,user_id,endpoint,p256dh,auth,device_token,platform,failure_count`,
      { headers: admin },
    );
    const subs = ((await subsResponse.json()) as Subscription[]) ?? [];

    if (subs.length === 0) {
      // The single most common real cause: the device was never registered, or
      // its row was deleted after a VAPID key change. Say so plainly.
      return json(
        {
          step: "no_subscriptions" as Step,
          detail: "no push_subscriptions row for this account — turn notifications off and on again",
        },
        200,
      );
    }

    const title = "ManifestAI test";
    const body = "If you can see this, the real notification path works.";
    const payload = JSON.stringify({ title, body, url: "/app", tag: "push-test" });

    const results: Array<{ platform: string; ok: boolean; detail?: string }> = [];
    for (const sub of subs) {
      const result = await deliverOne(
        { sub, title, body, payload },
        { supabaseUrl, admin, webPushReady, fcmToken, fcmProjectId },
      );
      results.push({
        platform: sub.platform ?? "web",
        ok: result.ok,
        ...(result.diagnostic ? { detail: `${result.diagnostic.status} ${result.diagnostic.detail}` } : {}),
      });
    }

    const sent = results.filter((r) => r.ok).length;
    console.log(`test push for ${user.id.slice(0, 8)}: ${sent}/${subs.length} sent`, results);

    return json(
      {
        step: (sent > 0 ? "sent" : "all_failed") as Step,
        subscriptions: subs.length,
        sent,
        results,
      },
      200,
    );
  } catch (error) {
    console.error("send-test-push failed", error);
    return json({ step: "all_failed" as Step, detail: String(error) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
