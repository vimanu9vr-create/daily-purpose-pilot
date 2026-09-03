import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/native";

/**
 * A single, shared view of "am I signed in?".
 *
 * This exists because of a bug that made the app ask people to sign in two or
 * three times in a row. Two things were going wrong in the route guard:
 *
 * 1. It called `supabase.auth.getUser()`, which is a network request to
 *    /auth/v1/user on *every* navigation into an authenticated route. On a
 *    phone — patchy signal, a cold launch, a backgrounded tab waking up —
 *    that request fails. The guard couldn't tell "the network dropped" apart
 *    from "you are not signed in", so it bounced people to the sign-in screen
 *    while they were, in fact, still signed in.
 *
 * 2. It raced the client's own start-up. Supabase reads the stored session
 *    from localStorage asynchronously, and our client is built lazily on first
 *    use — so the guard's first call could be the very thing constructing the
 *    client, and it would read `null` before storage had been consulted. Right
 *    after signing in, the redirect to /app fired before the session was
 *    written, so the guard threw the user straight back to /auth.
 *
 * The fix is to subscribe to `onAuthStateChange` once, treat the first event
 * as "storage has been read", and hold the session in memory. Reads become
 * synchronous and free, and a dropped connection can no longer be mistaken for
 * a sign-out.
 *
 * A genuine sign-out still works: an expired or revoked refresh token makes
 * Supabase emit SIGNED_OUT, which clears the cache here and lets the guard
 * redirect for the right reason.
 */

let session: Session | null = null;
let ready: Promise<void> | null = null;

/**
 * Belt and braces: if the auth listener never fires, don't hang the app.
 *
 * Two numbers, because the two waits are not the same thing.
 *
 * Normally we are waiting only for localStorage to be read, which is
 * instantaneous, and a short ceiling stops a broken listener showing a blank
 * screen.
 *
 * Coming back from Google we are waiting on a network round trip that
 * exchanges the code for a session. Four seconds was a guess and it was wrong:
 * on mobile data that exchange regularly takes longer, and when it did the gate
 * gave up and sent somebody who was midway through signing in back to the
 * sign-in screen. Production logs caught one person doing exactly that five
 * times in five minutes — five successful logins on the server, five bounces on
 * the device, no error anywhere.
 *
 * Waiting longer costs a spinner. Giving up early costs the person.
 */
const READY_TIMEOUT_MS = 4000;
const OAUTH_READY_TIMEOUT_MS = 25_000;

function begin(): Promise<void> {
  if (ready) return ready;

  if (typeof window === "undefined") {
    ready = Promise.resolve();
    return ready;
  }

  // Coming back from Google or Apple, the URL carries a code that Supabase
  // still has to exchange for a session. INITIAL_SESSION fires *before* that
  // exchange finishes and reports null — so releasing the gate on it would
  // redirect a user who is halfway through signing in back to the sign-in
  // screen. When a code is present, hold out for a real session instead.
  const url = window.location.href;
  const awaitingOAuth = /[?&]code=/.test(url) || /[#&]access_token=/.test(url);

  ready = new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    // Fires INITIAL_SESSION once storage has been read, then on every change.
    supabase.auth.onAuthStateChange((_event, next) => {
      session = next;
      if (awaitingOAuth && !next) return;
      done();
    });

    // If the listener somehow never fires, fall back to a direct read rather
    // than leaving the guard waiting forever on a blank screen.
    //
    // getSession() is asked twice a second apart when a code is in the URL. The
    // exchange may simply not have landed at the first attempt, and a second
    // look costs nothing next to throwing away a sign-in that was about to
    // succeed.
    window.setTimeout(
      () => {
        if (settled) return;
        const read = () => supabase.auth.getSession().then(({ data }) => data.session);

        void read()
          .then(async (found) => {
            if (found) return found;
            if (!awaitingOAuth) return null;
            await new Promise((r) => window.setTimeout(r, 1000));
            return read();
          })
          .then((found) => {
            session = found;
          })
          .catch(() => {
            // Leave `session` as-is rather than asserting a sign-out we can't
            // prove — a failed read is a network problem, not a logged-out user.
          })
          .finally(done);
      },
      awaitingOAuth ? OAUTH_READY_TIMEOUT_MS : READY_TIMEOUT_MS,
    );
  });

  return ready;
}

/**
 * Keep the token alive across the app being backgrounded.
 *
 * Supabase refreshes the access token on a timer. Android freezes that timer
 * the moment the app leaves the foreground, so an app left overnight wakes up
 * holding a token that expired hours ago, and the first request fails in a way
 * that looks exactly like being signed out.
 *
 * Stopping the loop on pause and restarting it on resume is the pattern
 * Supabase documents for Capacitor: on resume it refreshes immediately rather
 * than waiting for the next tick.
 *
 * Web browsers manage this themselves, so this only runs natively. Failure to
 * load the plugin is ignored — a missing app-state listener is a worse token
 * lifetime, not a broken app.
 */
async function watchAppState(): Promise<void> {
  if (!isNative()) return;
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    });
  } catch {
    // Plugin unavailable. The timer still runs while the app is open.
  }
}

/** Start listening as early as possible, so the gate is usually already open. */
export function primeAuthSession(): void {
  void begin();
  void watchAppState();
}

/**
 * The current session, waiting for start-up to finish the first time only.
 * After that it resolves instantly from memory.
 */
export async function getAuthSession(): Promise<Session | null> {
  await begin();
  return session;
}

/** Synchronous peek, for code that already knows start-up has happened. */
export function peekAuthSession(): Session | null {
  return session;
}

/**
 * Writes a session we already hold into the cache.
 *
 * Sign-in returns the session directly, but the SIGNED_IN event that would
 * normally populate this cache arrives a tick later. Navigating to /app in
 * between meant the route guard read `null` and sent the user straight back to
 * the sign-in screen — the first of the repeated prompts. Calling this before
 * navigating closes that gap.
 */
export function setAuthSession(next: Session | null): void {
  session = next;
  if (!ready) ready = Promise.resolve();
}

/**
 * The access token for calling edge functions.
 *
 * Goes to Supabase only when the cached token is close to expiring, so the
 * common case costs nothing.
 */
export async function getAccessToken(): Promise<string | undefined> {
  await begin();

  const expiresAt = session?.expires_at;
  const expiringSoon = expiresAt ? expiresAt * 1000 - Date.now() < 60_000 : true;

  if (session && !expiringSoon) return session.access_token;

  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) session = data.session;
    return data.session?.access_token;
  } catch {
    // Offline. The cached token may still be valid — better to try it than to
    // send nothing at all.
    return session?.access_token;
  }
}
