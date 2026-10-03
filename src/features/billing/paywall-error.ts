/**
 * Turns an edge function's 402 into something a person can act on.
 *
 * ## Why this is needed at all
 *
 * `supabase.functions.invoke` rejects on any non-2xx with a `FunctionsHttpError`
 * whose message is the constant string "Edge Function returned a non-2xx status
 * code". The response body — which is where our message, and the difference
 * between "never paid" and "your plan ended", actually live — is reachable only
 * through `error.context`, an undocumented `Response` hanging off the error.
 *
 * So without this, the moment the paywall starts refusing anything, every
 * refusal reaches the user as a generic failure. The person who is one tap from
 * paying us is told the app is broken instead of being told what to do, and the
 * most valuable error message in the product is the one nobody sees.
 *
 * ## Why not just read `error.message`
 *
 * Because it is a constant. It is the same string for a 402, a 500 and a
 * timeout. Distinguishing them requires the status code, which means reading
 * the Response.
 */

export type PaywallRefusal = {
  /** True when they had a subscription and it lapsed, rather than never paying. */
  expired: boolean;
  /** Copy written for this case by the function that refused. */
  message: string;
};

/** Thrown in place of the opaque FunctionsHttpError, so callers can branch on it. */
export class PaywallError extends Error {
  readonly expired: boolean;

  constructor({ expired, message }: PaywallRefusal) {
    super(message);
    this.name = "PaywallError";
    this.expired = expired;
  }
}

type MaybeHttpError = { context?: unknown };

/**
 * Reads a 402 out of whatever `functions.invoke` rejected with.
 *
 * Returns null for anything that is not a paywall refusal, so the caller can
 * rethrow untouched — a network failure must not be reported as "please
 * subscribe", which would be both wrong and insulting to somebody who already
 * has.
 *
 * Async because the body can only be read by awaiting the Response. Callers
 * that cannot await should treat a null return as "not a paywall".
 */
export async function readPaywallRefusal(error: unknown): Promise<PaywallRefusal | null> {
  const context = (error as MaybeHttpError | null)?.context;
  if (!(context instanceof Response)) return null;
  if (context.status !== 402) return null;

  try {
    // clone() because a Response body can only be read once, and the caller
    // may well want to read it too when logging.
    const body = (await context.clone().json()) as { message?: string; expired?: boolean } | null;
    return {
      expired: Boolean(body?.expired),
      message:
        body?.message?.trim() ||
        // The function should always send copy. If it somehow didn't, say
        // something true rather than nothing.
        "This is part of the full ManifestAI experience. Choose a plan to carry on.",
    };
  } catch {
    // A 402 with an unreadable body is still a 402. Losing the specific
    // wording is much better than losing the fact that they need to subscribe.
    return {
      expired: false,
      message: "This is part of the full ManifestAI experience. Choose a plan to carry on.",
    };
  }
}

/**
 * For the `{ data, error }` shape, which is what `functions.invoke` returns.
 *
 * It does NOT throw on a non-2xx — it resolves with the error in the tuple —
 * so a try/catch around the call catches nothing and the paywall would pass
 * silently through as a generic failure. Call this with the returned `error`
 * before doing anything else with it.
 */
export async function rethrowIfPaywalled(error: unknown): Promise<void> {
  if (!error) return;
  const refusal = await readPaywallRefusal(error);
  if (refusal) throw new PaywallError(refusal);
}

/**
 * Wraps a call that genuinely throws, such as a raw `fetch`.
 *
 * A 402 arrives as a `PaywallError` and everything else is rethrown untouched.
 *
 * Used at the call sites rather than inside a global fetch wrapper, because
 * only the call site knows whether a refusal should open the paywall or be
 * shown inline.
 */
export async function withPaywall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const refusal = await readPaywallRefusal(error);
    if (refusal) throw new PaywallError(refusal);
    throw error;
  }
}
