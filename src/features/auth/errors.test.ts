import { describe, expect, it } from "vitest";

import { describeAuthError } from "./errors";

/**
 * These two strings are the ones that decide whether launch day looks like a
 * broken app or a busy one, so they are pinned.
 */
describe("describeAuthError", () => {
  it("explains the project-wide email cap without blaming the user", () => {
    const message = describeAuthError(new Error("email rate limit exceeded"));
    expect(message).toMatch(/can't send emails right now/i);
    // The account really does exist when this fires — saying otherwise sends
    // someone off to sign up again and hit the same wall.
    expect(message).toMatch(/your account is fine/i);
    expect(message).not.toMatch(/rate limit/i);
  });

  it("handles the Supabase error code spelling too", () => {
    expect(describeAuthError(new Error("over_email_send_rate_limit"))).toMatch(
      /can't send emails right now/i,
    );
  });

  it("tells an unconfirmed user where to look", () => {
    expect(describeAuthError(new Error("Email not confirmed"))).toMatch(/spam folder/i);
  });

  it("does not flatten an unrecognised message into 'something went wrong'", () => {
    // A specific message we didn't anticipate still beats a generic one.
    expect(describeAuthError(new Error("Signups not allowed for this instance"))).toBe(
      "Signups not allowed for this instance",
    );
  });

  it("copes with a non-Error being thrown", () => {
    expect(describeAuthError("invalid login credentials")).toMatch(/don't match/i);
    expect(describeAuthError(undefined)).toMatch(/something went wrong/i);
    expect(describeAuthError({})).toMatch(/something went wrong/i);
  });
});
