// Sends the morning affirmation push.
//
// Designed to be called every 15 minutes by pg_cron. It works out which users
// are currently at their chosen local time, and sends to each of their devices.
//
// Requires these secrets:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (a mailto: URL)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (provided automatically)

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
  failure_count: number;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@manifestai.app";

    if (!publicKey || !privateKey) {
      return json({ error: "not_configured", message: "VAPID keys are not set." }, 503);
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

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
      const payload = JSON.stringify({
        title: firstName ? `Morning, ${firstName}` : "Your affirmation for today",
        body: affirmation.text,
        url: "/app/affirmations",
        tag: "daily-affirmation",
      });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
          sent += 1;
          await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
            method: "PATCH",
            headers: { ...admin, Prefer: "return=minimal" },
            body: JSON.stringify({ last_success_at: new Date().toISOString(), failure_count: 0 }),
          });
        } catch (error) {
          failed += 1;
          const status = (error as { statusCode?: number }).statusCode;
          // 404/410 mean the browser threw the subscription away — stop trying.
          if (status === 404 || status === 410) {
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

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
