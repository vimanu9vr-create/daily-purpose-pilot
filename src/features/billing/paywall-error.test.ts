import { describe, expect, it } from "vitest";

import { PaywallError, readPaywallRefusal, withPaywall } from "./paywall-error";

/** What supabase-js actually rejects with: a generic message plus a Response. */
function functionsHttpError(status: number, body: unknown) {
  const error = new Error("Edge Function returned a non-2xx status code");
  (error as unknown as { context: Response }).context = new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  return error;
}

describe("readPaywallRefusal", () => {
  it("reads the message and the expired flag out of a 402", async () => {
    const refusal = await readPaywallRefusal(
      functionsHttpError(402, { message: "Renew to carry on.", expired: true }),
    );
    expect(refusal).toEqual({ expired: true, message: "Renew to carry on." });
  });

  /**
   * The distinction the whole file exists for. Reporting a dropped connection
   * as "please subscribe" is wrong, and insulting to somebody who already has.
   */
  it("ignores anything that is not a 402", async () => {
    expect(await readPaywallRefusal(functionsHttpError(500, { error: "boom" }))).toBeNull();
    expect(await readPaywallRefusal(functionsHttpError(401, {}))).toBeNull();
    expect(await readPaywallRefusal(new Error("Failed to fetch"))).toBeNull();
    expect(await readPaywallRefusal(null)).toBeNull();
  });

  it("still reports a paywall when the body is unreadable", async () => {
    const error = new Error("non-2xx");
    (error as unknown as { context: Response }).context = new Response("<html>502</html>", {
      status: 402,
    });
    const refusal = await readPaywallRefusal(error);
    // Losing the specific wording beats losing the fact that they must subscribe.
    expect(refusal?.message).toContain("Choose a plan");
  });

  it("leaves the body readable for the caller", async () => {
    // clone() inside, so a caller that logs the response still can.
    const error = functionsHttpError(402, { message: "x", expired: false });
    await readPaywallRefusal(error);
    const context = (error as unknown as { context: Response }).context;
    await expect(context.json()).resolves.toEqual({ message: "x", expired: false });
  });
});

describe("withPaywall", () => {
  it("passes a successful result straight through", async () => {
    await expect(withPaywall(async () => "ok")).resolves.toBe("ok");
  });

  it("converts a 402 into a PaywallError the UI can branch on", async () => {
    const run = () => Promise.reject(functionsHttpError(402, { message: "Pay up", expired: false }));
    await expect(withPaywall(run)).rejects.toBeInstanceOf(PaywallError);
    await expect(withPaywall(run)).rejects.toThrow("Pay up");
  });

  it("rethrows everything else untouched", async () => {
    const boom = new Error("network down");
    await expect(withPaywall(() => Promise.reject(boom))).rejects.toBe(boom);
  });
});
