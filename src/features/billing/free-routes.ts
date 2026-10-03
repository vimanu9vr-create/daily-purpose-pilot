/**
 * Where a free account may go before it has paid.
 *
 * ## Why an allowlist rather than a blocklist
 *
 * A blocklist is wrong by default: every screen added later is free until
 * somebody remembers to lock it, and nobody remembers. An allowlist is locked
 * by default and has to be opened deliberately, which is the direction a
 * paywall should fail in.
 *
 * ## Why these five, specifically
 *
 * The free experience is: sign up, onboard, get ONE personalised affirmation
 * set written from your own words, read it, decide. Every route below exists
 * to serve that, and nothing else does.
 *
 *   /app            the dashboard, which is where the one set is shown and
 *                   where the paywall sits underneath it
 *   /app/affirmations   where the set is generated and read
 *   /app/library    reading what already exists. Free on purpose — this is
 *                   the difference between a paywall and a locked door, and
 *                   the reason somebody can tell what they would be buying
 *   /app/upgrade    the paywall itself. Blocking the route that takes money
 *                   would be an unusually expensive bug
 *   /app/profile    their account, their plan state, and the only route to
 *                   signing out. Trapping somebody who wants to leave is both
 *                   hostile and the kind of thing app stores remove you for
 *
 * Everything else — coach, goals, habits, journal, vision boards, progress,
 * programmes, practice, voice lab — is the product being sold.
 */
export const FREE_ROUTES = [
  "/app",
  "/app/affirmations",
  "/app/library",
  "/app/upgrade",
  "/app/profile",
] as const;

/**
 * Is this path reachable without a subscription?
 *
 * Exact matches only, with one deliberate exception: `/app` itself. A prefix
 * match would make `/app/coach` free because it starts with `/app`, which is
 * the entire paywall undone by a `startsWith`.
 *
 * Trailing slashes are normalised because the router will happily produce
 * both, and a paywall that depends on punctuation is not a paywall.
 */
export function isFreeRoute(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/app";
  return (FREE_ROUTES as readonly string[]).includes(path);
}
