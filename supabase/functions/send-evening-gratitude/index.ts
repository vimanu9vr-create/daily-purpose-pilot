// Evening gratitude → push.
//
// Deliberately much simpler than send-daily-affirmation. That function has to
// resolve a programme day, rotate an affirmation, batch three queries per user
// and hand over to a fresh invocation before the wall clock runs out. This one
// sends the same short prompt to everyone who asked for it, so none of that
// applies and none of it is copied.
//
// It also gives /app/gratitude the entry point it has never had. That screen
// is reachable from nowhere in the app — no tab, no link, no button — which is
// why `journals` holds two entries across twelve accounts. The notification is
// the door.
//
// Required secrets: the same ones the morning job uses. FCM_SERVICE_ACCOUNT
// for Android and iOS, VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
// for browsers.

import webpush from "https://esm.sh/web-push@3.6.7";

import {
  deliverOne,
  fcmAccessToken,
  type Delivery,
  type Subscription,
} from "../_shared/push.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Matches the morning job. Above this, a run risks the wall clock. */
const BATCH_SIZE = 200;
const PUSH_CONCURRENCY = 25;

type DueProfile = { profile_id: string; profile_name: string | null; sent_for: string };

/**
 * The copy.
 *
 * Three lines, not a blank box — the gratitude screen asks for three things
 * for the same reason the notification does: "what are you grateful for?" is
 * hard on a bad day and "what are three things?" is answerable, and the bad
 * day is the one that matters.
 *
 * No exclamation marks and no "Don't forget!". This arrives at night, and a
 * nudge that sounds like a task is a nudge people switch off.
 */
type Notification = { title: string; body: string; payload: string };

function buildNotification(displayName: string | null): Notification {
  const firstName = displayName?.trim().split(" ")[0];

  const title = firstName ? `${firstName}, three things` : "Three things";
  const body = "What went right today? Two minutes before you sleep.";

  return {
    title,
    body,
    payload: JSON.stringify({
      title,
      body,
      url: "/app/gratitude",
      tag: "evening-gratitude",
    }),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:vimanu9.vr@gmail.com";
    const fcmAccount = Deno.env.get("FCM_SERVICE_ACCOUNT");

    const webPushReady = Boolean(publicKey && privateKey);
    if (!webPushReady && !fcmAccount) {
      // Say so rather than claiming a successful run that sent nothing. The
      // morning job went unnoticed for weeks because failure looked identical
      // to success from outside.
      console.error("no delivery channel configured: neither VAPID nor FCM_SERVICE_ACCOUNT");
      return json({ error: "not_configured" }, 503);
    }
    if (webPushReady) webpush.setVapidDetails(subject, publicKey!, privateKey!);

    const fcmToken = fcmAccount ? await fcmAccessToken(fcmAccount) : null;
    const fcmProjectId = fcmAccount ? (JSON.parse(fcmAccount).project_id as string) : null;

    // Claim in the database. Due-ness is computed there, and the row is
    // stamped inside the same statement that selects it, so two overlapping
    // runs cannot both send to the same person.
    const claimed = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_due_evening_gratitude`, {
      method: "POST",
      headers: admin,
      body: JSON.stringify({ p_limit: BATCH_SIZE }),
    });
    if (!claimed.ok) {
      console.error("claim failed", await claimed.text().catch(() => ""));
      return json({ error: "claim_failed" }, 500);
    }
    const due = (await claimed.json()) as DueProfile[];
    if (due.length === 0) return json({ ok: true, sent: 0 }, 200);

    const ids = due.map((d) => d.profile_id);
    const subsResponse = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?user_id=in.(${ids.join(",")})` +
        `&select=id,user_id,endpoint,p256dh,auth,device_token,platform,failure_count`,
      { headers: admin },
    );
    const subs = ((await subsResponse.json()) as Subscription[]) ?? [];

    const byUser = new Map<string, Subscription[]>();
    for (const sub of subs) {
      const list = byUser.get(sub.user_id) ?? [];
      list.push(sub);
      byUser.set(sub.user_id, list);
    }

    const deliveries: Delivery[] = [];
    for (const profile of due) {
      const note = buildNotification(profile.profile_name);
      for (const sub of byUser.get(profile.profile_id) ?? []) {
        deliveries.push({ sub, ...note });
      }
    }

    // A work-stealing pool rather than sequential sends. Twenty-five at a time
    // keeps a thousand devices inside one invocation.
    let sent = 0;
    let failed = 0;
    let cursor = 0;
    const context = { supabaseUrl, admin, webPushReady, fcmToken, fcmProjectId };

    await Promise.all(
      Array.from({ length: Math.min(PUSH_CONCURRENCY, deliveries.length) }, async () => {
        while (cursor < deliveries.length) {
          const item = deliveries[cursor++]!;
          const result = await deliverOne(item, context);
          if (result.ok) sent++;
          else {
            failed++;
            if (result.diagnostic) console.warn("delivery failed", result.diagnostic);
          }
        }
      }),
    );

    console.log(`evening gratitude: ${due.length} due, ${sent} sent, ${failed} failed`);
    return json({ ok: true, due: due.length, sent, failed }, 200);
  } catch (error) {
    console.error("send-evening-gratitude failed", error);
    return json({ error: "internal_error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
