// Sends the morning push: the day's practice, or an affirmation if there is no
// programme running.
//
// Called hourly by pg_cron. Postgres decides who is currently at their chosen
// local time (see `claim_due_morning_pushes`); this function turns that list
// into notifications.
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
//
// ===========================================================================
// HOW THIS SCALES, AND WHERE IT STOPS
// ===========================================================================
//
// The previous version did this:
//
//   1. fetch EVERY profile with notifications enabled — no limit
//   2. filter them in JavaScript to find the due ones
//   3. for each due user, in strict sequence:
//        one request for their programme
//        one request for their affirmation
//        one request for their subscriptions
//        one push per device, awaited one at a time
//        one request to stamp the affirmation
//        one request to stamp the profile
//
// That is an unbounded read plus six-ish round trips per user, all serial,
// inside a function with a hard wall clock. The arithmetic is unforgiving: at
// roughly 120 ms per round trip it manages about two users a second. A
// thousand due users needs eight minutes and the function is killed long
// before that — and because the loop is ordered, the same people get served
// every morning and the people sorted last never do. It fails silently and
// unfairly, which is the worst way for a notification system to fail.
//
// Three changes, in order of how much they matter:
//
//   1. THE DUE CALCULATION MOVED INTO POSTGRES. The unbounded fetch is gone.
//      The database returns only the rows that are actually due, already
//      claimed so no other run can take them. This is the change that removes
//      the dependency on total user count.
//
//   2. THE PER-USER QUERIES ARE BATCHED. Three requests per user became three
//      requests per BATCH of two hundred, using `user_id=in.(...)`, then
//      grouped in memory. 600 round trips become 3.
//
//   3. THE PUSHES RUN CONCURRENTLY, with a fixed ceiling. Notifications are
//      independent network calls; waiting for each one before starting the
//      next wasted essentially all of the wall clock. The ceiling matters as
//      much as the concurrency — unbounded `Promise.all` over a large batch
//      would open thousands of sockets at once and get us rate-limited by the
//      push services, which is a slower way to fail.
//
// Together those take a run from ~2 users/second to ~200. What remains is a
// fixed budget per invocation, so when the budget runs out the function hands
// the rest to a fresh invocation of itself (see `chainNextRun`) rather than
// trying to finish everything in one. Each link claims its own rows, so the
// links can overlap safely.
//
// The honest ceiling: this comfortably handles tens of thousands of users due
// in the same window. Beyond that the chain gets long enough that its tail
// falls outside the twenty-minute window, and the right answer becomes a real
// queue (pgmq) with independent consumers rather than a self-chaining
// function. That is a different piece of work and it is not needed yet.
// ===========================================================================

import webpush from "https://esm.sh/web-push@3.6.7";

import {
  buildNotification,
  firstPerUser,
  groupByUser,
  inList,
  inParallel,
  nextIncompleteDay,
  shouldRotateAffirmation,
} from "./fanout.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * How many users one invocation claims at a time.
 *
 * Bounded by PostgREST's `in.(...)` filter, which goes into the query string:
 * 200 uuids is about 8 KB of URL, comfortably inside every proxy's limit,
 * while 2,000 would not be.
 */
const BATCH_SIZE = 200;

/**
 * Pushes in flight at once.
 *
 * High enough that the run is bounded by throughput rather than latency, low
 * enough that we look like a well-behaved client to FCM and to the browser
 * push services, which throttle aggressively and whose throttling is invisible
 * until it isn't.
 */
const PUSH_CONCURRENCY = 25;

/**
 * When to stop claiming new work and hand over to the next invocation.
 *
 * Supabase gives an edge function 150 seconds of wall clock. Stopping at 100
 * leaves room for the batch already in progress to finish and for the handover
 * request itself, so we exit cleanly instead of being killed mid-send with
 * rows already marked as notified.
 */
const DEADLINE_MS = 100_000;

/**
 * Ceiling on how many times a run may hand over to a successor.
 *
 * A bug that made the database always return a full batch would otherwise
 * produce an infinite chain of invocations, which is a bill rather than an
 * outage. At 200 users per link this still allows 20,000 users per triggered
 * run, and pg_cron fires again within the hour regardless.
 */
const MAX_CHAIN_DEPTH = 100;

type DueProfile = {
  profile_id: string;
  profile_name: string | null;
  sent_for: string;
};

type ProgrammeWithDays = {
  id: string;
  user_id: string;
  title: string;
  length_days: number;
  programme_days: {
    day_number: number;
    intention: string;
    completed_at: string | null;
  }[];
};

type Affirmation = {
  id: string;
  user_id: string;
  text: string;
  last_shown_at: string | null;
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

/** One notification, resolved and ready to send. */
type Delivery = {
  sub: Subscription;
  title: string;
  body: string;
  payload: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const startedAt = Date.now();

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
          message:
            "Set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY for web, or FCM_SERVICE_ACCOUNT for the phone apps.",
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

    const chainDepth = await readChainDepth(req);

    let sent = 0;
    let failed = 0;
    let claimed = 0;
    let batches = 0;
    let handedOver = false;

    // Returned in the response. A bare "failed: 3" tells you nothing about
    // why, and the reason is the only thing that matters here.
    const diagnostics: { sub: string; status: number | string; detail: string }[] = [];

    while (true) {
      if (Date.now() - startedAt > DEADLINE_MS) {
        // Out of budget with work possibly left. Hand the rest to a fresh
        // invocation rather than being killed part-way through a batch.
        handedOver = await chainNextRun(supabaseUrl, serviceKey, chainDepth);
        break;
      }

      const due = await claimDueProfiles(supabaseUrl, admin, BATCH_SIZE);
      if (due.length === 0) break;

      claimed += due.length;
      batches += 1;

      const userIds = due.map((profile) => profile.profile_id);

      // Three requests for the whole batch, where the old code made three per
      // user. `Promise.all` is safe here — it is exactly three sockets.
      const [programmesByUser, affirmationByUser, subsByUser] = await Promise.all([
        fetchProgrammes(supabaseUrl, admin, userIds),
        fetchAffirmations(supabaseUrl, admin, userIds),
        fetchSubscriptions(supabaseUrl, admin, userIds),
      ]);

      const deliveries: Delivery[] = [];
      const affirmationsToStamp: string[] = [];

      for (const profile of due) {
        const subs = subsByUser.get(profile.profile_id);
        if (!subs?.length) continue;

        // What the notification is FOR is the practice, not the affirmation.
        // The wording rules live in `fanout.ts` so they can be tested; see the
        // comment on `buildNotification` for why they are what they are.
        const programme = programmesByUser.get(profile.profile_id);
        const nextDay = nextIncompleteDay(programme?.programme_days);
        const affirmation = affirmationByUser.get(profile.profile_id);

        const notification = buildNotification(profile.profile_name, nextDay, affirmation?.text);
        if (!notification) continue;

        for (const sub of subs) {
          deliveries.push({
            sub,
            title: notification.title,
            body: notification.body,
            payload: notification.payload,
          });
        }

        if (affirmation && shouldRotateAffirmation(nextDay, true)) {
          affirmationsToStamp.push(affirmation.id);
        }
      }

      await inParallel(
        deliveries,
        PUSH_CONCURRENCY,
        async (delivery) => {
          const result = await deliverOne(delivery, {
            supabaseUrl,
            admin,
            webPushReady,
            fcmToken,
            fcmProjectId,
          });
          if (result.ok) {
            sent += 1;
          } else if (result.diagnostic) {
            failed += 1;
            diagnostics.push(result.diagnostic);
          }
        },
        (error) => console.error("delivery worker threw", error),
      );

      // One request for the whole batch rather than one per user.
      await stampAffirmations(supabaseUrl, admin, affirmationsToStamp);

      // A short batch means the database had nothing left to give us, so
      // there is no point asking again this run.
      if (due.length < BATCH_SIZE) break;
    }

    console.log(
      `daily affirmation: sent=${sent} failed=${failed} claimed=${claimed} ` +
        `batches=${batches} depth=${chainDepth} handedOver=${handedOver} ` +
        `ms=${Date.now() - startedAt}`,
    );

    return json(
      {
        sent,
        failed,
        claimed,
        batches,
        chainDepth,
        handedOver,
        ms: Date.now() - startedAt,
        // Kept small. A run that fails ten thousand pushes should not try to
        // return ten thousand explanations.
        diagnostics: diagnostics.slice(0, 20),
      },
      200,
    );
  } catch (error) {
    console.error("send-daily-affirmation failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

// ---------------------------------------------------------------------------
// Claiming and batch reads
// ---------------------------------------------------------------------------

/**
 * Asks Postgres for the next slice of due users, already marked as notified.
 *
 * The marking is the important half. Anything returned here will not be
 * returned to any other caller today, which is what makes it safe for several
 * invocations of this function to be in flight at the same time.
 */
async function claimDueProfiles(
  supabaseUrl: string,
  admin: Record<string, string>,
  limit: number,
): Promise<DueProfile[]> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_due_morning_pushes`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({ p_limit: limit }),
  });

  if (!response.ok) {
    // Loud on purpose. If the claim fails nobody is notified at all, and the
    // most likely cause is that the migration adding this function has not
    // been applied to the project.
    throw new Error(`claim_due_morning_pushes failed: ${await response.text()}`);
  }

  return (await response.json()) as DueProfile[];
}

/**
 * The one unfinished programme per user, with its days embedded.
 *
 * Ordering by user then created_at descending and keeping the first row seen
 * per user gives "the newest open programme for each", which is what the old
 * per-user query asked for with `order=created_at.desc&limit=1`.
 */
async function fetchProgrammes(
  supabaseUrl: string,
  admin: Record<string, string>,
  userIds: string[],
): Promise<Map<string, ProgrammeWithDays>> {
  const url =
    `${supabaseUrl}/rest/v1/programmes` +
    `?select=id,user_id,title,length_days,programme_days(day_number,intention,completed_at)` +
    `&user_id=${inList(userIds)}&completed_at=is.null&order=user_id.asc,created_at.desc`;

  const response = await fetch(url, { headers: admin });
  if (!response.ok) {
    console.error("programme batch failed", await response.text());
    return new Map();
  }

  return firstPerUser((await response.json()) as ProgrammeWithDays[]);
}

/**
 * The least-recently-shown affirmation for each user.
 *
 * Same "first row per user" approach. `last_shown_at.asc.nullsfirst` puts the
 * never-shown ones at the front, so a new user hears their own new lines
 * before anything repeats.
 */
async function fetchAffirmations(
  supabaseUrl: string,
  admin: Record<string, string>,
  userIds: string[],
): Promise<Map<string, Affirmation>> {
  const url =
    `${supabaseUrl}/rest/v1/affirmations` +
    `?select=id,user_id,text,last_shown_at&user_id=${inList(userIds)}` +
    `&order=user_id.asc,last_shown_at.asc.nullsfirst,created_at.asc`;

  const response = await fetch(url, { headers: admin });
  if (!response.ok) {
    console.error("affirmation batch failed", await response.text());
    return new Map();
  }

  return firstPerUser((await response.json()) as Affirmation[]);
}

/** Every device belonging to each user in the batch. */
async function fetchSubscriptions(
  supabaseUrl: string,
  admin: Record<string, string>,
  userIds: string[],
): Promise<Map<string, Subscription[]>> {
  const url =
    `${supabaseUrl}/rest/v1/push_subscriptions` +
    `?select=id,user_id,endpoint,p256dh,auth,device_token,platform,failure_count` +
    `&user_id=${inList(userIds)}`;

  const response = await fetch(url, { headers: admin });
  if (!response.ok) {
    console.error("subscription batch failed", await response.text());
    return new Map();
  }

  return groupByUser((await response.json()) as Subscription[]);
}

/** Rotates every affirmation used in this batch, in one request. */
async function stampAffirmations(
  supabaseUrl: string,
  admin: Record<string, string>,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;

  const response = await fetch(`${supabaseUrl}/rest/v1/affirmations?id=${inList(ids)}`, {
    method: "PATCH",
    headers: { ...admin, Prefer: "return=minimal" },
    body: JSON.stringify({ last_shown_at: new Date().toISOString() }),
  });

  // Not fatal. The cost of failing here is that somebody hears the same line
  // twice, which is not worth losing the rest of the run over.
  if (!response.ok) console.error("affirmation stamp failed", await response.text());
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

type DeliveryResult = {
  ok: boolean;
  diagnostic?: { sub: string; status: number | string; detail: string };
};

async function deliverOne(
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

// ---------------------------------------------------------------------------
// Concurrency and handover
// ---------------------------------------------------------------------------

/** How many times this run has already been handed over. */
async function readChainDepth(req: Request): Promise<number> {
  try {
    const body = (await req.json()) as { chainDepth?: unknown };
    const depth = Number(body?.chainDepth ?? 0);
    return Number.isFinite(depth) && depth > 0 ? Math.floor(depth) : 0;
  } catch {
    // pg_cron posts no body at all, which is the normal case.
    return 0;
  }
}

/**
 * Starts a successor invocation to pick up whatever is left.
 *
 * Fire-and-forget on purpose: awaiting the successor would keep this function
 * alive for the successor's whole run and defeat the point. The request is
 * dispatched and this run exits; the successor claims its own rows.
 */
async function chainNextRun(
  supabaseUrl: string,
  serviceKey: string,
  depth: number,
): Promise<boolean> {
  if (depth >= MAX_CHAIN_DEPTH) {
    console.warn(`chain depth ${depth} reached; stopping. The rest wait for the next cron run.`);
    return false;
  }

  try {
    // No await on the response — we only need the request to leave.
    void fetch(`${supabaseUrl}/functions/v1/send-daily-affirmation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chainDepth: depth + 1 }),
    }).catch((error) => console.error("handover request failed", error));

    return true;
  } catch (error) {
    console.error("could not hand over", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// FCM
// ---------------------------------------------------------------------------

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
