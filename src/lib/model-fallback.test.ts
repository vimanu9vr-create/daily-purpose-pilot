import { describe, expect, it } from "vitest";

/**
 * The retry policy, tested where tests can actually run.
 *
 * The rule itself lives in four edge functions, which are Deno and not covered
 * by this suite. That's exactly why it was wrong three times in a row without
 * anything catching it: I'd handle the failure I had just seen in the logs,
 * deploy, and find out days later that the next one wasn't covered either.
 *
 * First version caught 429 only, and the live error was 404. Second caught 429
 * and 404, and the live error was 503. So the rule stopped enumerating status
 * codes and started asking a question instead — could a different model help?
 * — which is true of everything except a request that is wrong in itself.
 *
 * Kept byte-identical to the copy in the functions. If they drift, this test is
 * worthless, so it is written to be trivially diffable rather than clever.
 */
function anotherModelMightHelp(status: number): boolean {
  if (status < 400) return false;
  return status !== 400 && status !== 401 && status !== 403;
}

describe("anotherModelMightHelp", () => {
  it("stops on success", () => {
    for (const status of [200, 201, 204]) {
      expect(anotherModelMightHelp(status)).toBe(false);
    }
  });

  it("moves on for every failure that actually happened", () => {
    // 429 rate limited, 404 model closed to new accounts, 503 overloaded.
    // Each of these was live, in that order, and each caught me out.
    expect(anotherModelMightHelp(429)).toBe(true);
    expect(anotherModelMightHelp(404)).toBe(true);
    expect(anotherModelMightHelp(503)).toBe(true);
  });

  it("moves on for failures that have not happened yet", () => {
    // The whole point. A status nobody has seen should already be handled.
    for (const status of [408, 409, 425, 500, 502, 504, 529]) {
      expect(anotherModelMightHelp(status)).toBe(true);
    }
  });

  it("gives up on a request that is wrong in itself", () => {
    // Bad prompt or bad key fails identically on every model, so walking the
    // ladder would be four identical failures and four times the wait.
    for (const status of [400, 401, 403]) {
      expect(anotherModelMightHelp(status)).toBe(false);
    }
  });
});
