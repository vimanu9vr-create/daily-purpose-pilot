/**
 * Turning Supabase auth errors into something a person can act on.
 *
 * Two of these matter more than the rest, because they are the ones a real
 * user hits on launch day and the raw text tells them nothing useful:
 *
 *   "email rate limit exceeded" — the project is on Supabase's built-in email
 *   service, which sends TWO messages per hour across the entire project. Not
 *   per user. The third person to sign up in an hour sees this, and the raw
 *   message makes it sound like they personally did something too many times.
 *
 *   "Email not confirmed" — they signed up during a window where the
 *   confirmation email could not be sent, so there is nothing in their inbox
 *   to click and no way to work that out from the message.
 *
 * Signing IN is not rate limited by email at all. Only signup confirmations
 * and password resets send mail, so once confirmation is off, a thousand
 * people can sign in without any of this firing.
 */

const FRIENDLY: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /email rate limit exceeded|over_email_send_rate_limit/i,
    "We can't send emails right now — too many in a short time. Your account is fine; try signing in, or come back in an hour.",
  ],
  [
    /email not confirmed/i,
    "This account hasn't been confirmed yet. Check your inbox and spam folder for the confirmation link.",
  ],
  [
    /invalid login credentials/i,
    "That email and password don't match. Check for a typo, or reset your password.",
  ],
  [
    /user already registered|already been registered/i,
    "There's already an account with this email. Sign in instead, or reset the password.",
  ],
  [
    /password should be at least/i,
    "That password is too short — six characters or more.",
  ],
  [
    /request rate limit reached|too many requests/i,
    "Too many attempts just now. Wait a minute and try again.",
  ],
  [
    /failed to fetch|network|offline/i,
    "Couldn't reach the server. Check your connection and try again.",
  ],
];

export function describeAuthError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  for (const [pattern, friendly] of FRIENDLY) {
    if (pattern.test(raw)) return friendly;
  }

  // Anything unrecognised keeps its original wording rather than being
  // flattened into "Something went wrong" — a specific message we didn't
  // anticipate is still more useful to the person than a generic one.
  return raw || "Something went wrong. Please try again.";
}
