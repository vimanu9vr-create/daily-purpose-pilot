/**
 * The free affirmation a stranger gets before they have an account.
 *
 * ## Why this exists
 *
 * The app already gives every free user one personalised affirmation set. But
 * it sat behind `_authenticated`, so the order was: sign up, THEN find out
 * whether this is any good. For somebody who arrived from a reel eight seconds
 * ago that is the wrong way round — the account is the price, and they are
 * being asked to pay it before seeing the product.
 *
 * Reversing it means the affirmation does the selling. "Sign up to keep this"
 * is a far easier ask than "sign up to see if you'll like this", because by
 * then the thing is already theirs and signing up is how they avoid losing it.
 *
 * ## Why anonymous sign-in rather than an unauthenticated endpoint
 *
 * A public, keyless endpoint would need its own rate limiting, its own abuse
 * story, and a second code path through `ai-affirmations` that skips the
 * entitlement check — which is exactly the kind of parallel path that quietly
 * diverges and becomes a way to get paid features for free.
 *
 * Supabase anonymous sign-in avoids all of it. The person gets a real user row
 * and a real JWT, so the edge function, the entitlement read and `FREE_LIMITS`
 * all apply with no changes at all. The free-tier cap of one affirmation set
 * is already the rate limit.
 *
 * And the account is not thrown away afterwards: linking an email upgrades the
 * SAME user, so the affirmation they just watched being written is still there
 * when they sign in. Nothing to migrate, nothing to lose, no "where did it go".
 */

import { supabase } from "@/integrations/supabase/client";

export type TryResult = {
  affirmations: string[];
  /** The anonymous user that now owns them. Linking an email upgrades this. */
  userId: string;
};

/**
 * Create a throwaway identity and write one affirmation set against it.
 *
 * `desire` is the person's own words — "a house with a garden", "my own
 * studio". It is passed as the category so the writing is about the thing they
 * typed rather than a preset theme, which is the whole reason this converts.
 */
export async function tryOneAffirmation(desire: string): Promise<TryResult> {
  const wanted = desire.trim();
  if (!wanted) throw new Error("Tell it what you want first.");

  // Reuse an existing session when there is one. Somebody who refreshes the
  // page should not get a second free set, and more importantly should not get
  // a second account — the first one holds their affirmation.
  const existing = (await supabase.auth.getSession()).data.session;

  const session =
    existing ??
    (await (async () => {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.session) {
        throw new Error("Couldn't start a session. Check your connection and try again.");
      }
      return data.session;
    })());

  const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-affirmations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ category: wanted }),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as {
      message?: string;
      error?: string;
    } | null;

    /**
     * They have already used their one free set — almost always because they
     * came back a second time on the same device. Saying "you've used your
     * free one" to somebody who does not remember having an account is
     * confusing, so point at the thing that resolves it instead.
     */
    if (detail?.error === "free_limit" || response.status === 402) {
      throw new Error("You've had your free one. Create an account to carry on.");
    }

    throw new Error(detail?.message ?? "Couldn't write that one. Try again in a moment.");
  }

  const result = (await response.json()) as { affirmations?: string[] };

  return {
    affirmations: result.affirmations ?? [],
    userId: session.user.id,
  };
}

/**
 * Turn the anonymous account into a real one, keeping everything in it.
 *
 * `updateUser` rather than `signUp`: signing up would create a SECOND user and
 * silently orphan the affirmations written a minute ago, which is the exact
 * failure this whole flow exists to avoid. Updating attaches the credentials
 * to the identity that already owns them.
 */
export async function claimAnonymousAccount(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email, password });
  if (error) throw new Error(error.message);
}

/**
 * True when the signed-in user is a throwaway one, so the UI can keep offering
 * "save this" rather than treating them as a real member.
 *
 * Reads `is_anonymous` off the user, which Supabase sets on the JWT — not a
 * local flag, so it survives a refresh and cannot drift out of sync with what
 * the server believes.
 */
export async function isAnonymousSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user as { is_anonymous?: boolean } | undefined;
  return Boolean(user?.is_anonymous);
}
