import { describe, expect, it } from "vitest";

import {
  buildNotification,
  firstPerUser,
  groupByUser,
  inList,
  inParallel,
  nextIncompleteDay,
  shouldRotateAffirmation,
} from "./fanout.ts";

/**
 * These cover the rewrite of the morning send from a serial per-user loop to a
 * batched, bounded-concurrency fan-out.
 *
 * The bug being guarded against is not a crash. It is the quiet kind: the old
 * version worked perfectly at twelve users and would have stopped finishing
 * somewhere in the low thousands, serving the same people every morning and
 * never reaching the ones sorted last. Nothing would have alerted; the run
 * would return 200 having done part of the job.
 *
 * So the tests below are about the properties that make the batched version
 * equivalent to the per-user version it replaced, plus the concurrency
 * guarantees that are easy to write and easy to get wrong.
 */

describe("inList", () => {
  it("quotes every value", () => {
    expect(inList(["a", "b"])).toBe('in.("a","b")');
  });

  /**
   * PostgREST splits the list on commas. An unquoted value containing one
   * becomes two values and the query silently matches the wrong rows — no
   * error, just wrong data.
   */
  it("survives a value containing a comma", () => {
    expect(inList(["one,two"])).toBe('in.("one,two")');
  });

  it("produces a URL segment small enough for a full batch", () => {
    const uuids = Array.from(
      { length: 200 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    // Proxies commonly cap a URL at 8 KB. A full batch has to fit with room
    // for the rest of the query string.
    expect(inList(uuids).length).toBeLessThan(8_000);
  });
});

describe("firstPerUser", () => {
  /**
   * The batched query replaces a per-user query that ended in `limit=1`. The
   * equivalence holds only if the caller orders by user and then by the same
   * key the old query used — this pins down the "take the first" half.
   */
  it("keeps the first row for each user and discards the rest", () => {
    const rows = [
      { user_id: "a", id: "a-newest" },
      { user_id: "a", id: "a-older" },
      { user_id: "b", id: "b-newest" },
    ];

    const byUser = firstPerUser(rows);

    expect(byUser.get("a")?.id).toBe("a-newest");
    expect(byUser.get("b")?.id).toBe("b-newest");
    expect(byUser.size).toBe(2);
  });

  it("returns an empty map for no rows", () => {
    expect(firstPerUser([]).size).toBe(0);
  });

  /** A user with no row at all must be absent, not present-and-undefined. */
  it("omits users it never saw", () => {
    expect(firstPerUser([{ user_id: "a" }]).has("b")).toBe(false);
  });
});

describe("groupByUser", () => {
  it("collects every device belonging to a user", () => {
    const byUser = groupByUser([
      { user_id: "a", id: "phone" },
      { user_id: "b", id: "laptop" },
      { user_id: "a", id: "tablet" },
    ]);

    expect(byUser.get("a")?.map((row) => row.id)).toEqual(["phone", "tablet"]);
    expect(byUser.get("b")?.map((row) => row.id)).toEqual(["laptop"]);
  });
});

describe("nextIncompleteDay", () => {
  /**
   * "Day 6" means the sixth day someone has DONE. If this ever starts counting
   * calendar days, the notification turns into a message about falling behind,
   * which is the opposite of what it is for.
   */
  it("picks the lowest-numbered day that isn't finished", () => {
    const day = nextIncompleteDay([
      { day_number: 3, intention: "third", completed_at: null },
      { day_number: 1, intention: "first", completed_at: "2026-09-01T00:00:00Z" },
      { day_number: 2, intention: "second", completed_at: null },
    ]);

    expect(day?.day_number).toBe(2);
  });

  it("is undefined when every day is done", () => {
    expect(
      nextIncompleteDay([
        { day_number: 1, intention: "done", completed_at: "2026-09-01T00:00:00Z" },
      ]),
    ).toBeUndefined();
  });

  it("is undefined when there is no programme", () => {
    expect(nextIncompleteDay(undefined)).toBeUndefined();
  });

  /** Must not mutate the array it was handed — it is shared with the caller. */
  it("does not reorder its input", () => {
    const days = [
      { day_number: 3, intention: "third", completed_at: null },
      { day_number: 2, intention: "second", completed_at: null },
    ];
    nextIncompleteDay(days);
    expect(days.map((d) => d.day_number)).toEqual([3, 2]);
  });
});

describe("buildNotification", () => {
  it("leads with the day number when there is a programme", () => {
    const notification = buildNotification(
      "Sam Okafor",
      {
        day_number: 6,
        intention: "Write the email you have been avoiding.",
        completed_at: null,
      },
      "I am calm",
    );

    expect(notification?.title).toBe("Your day 6 practice is ready");
    // The programme's own words, not the affirmation — the day is the point.
    expect(notification?.body).toBe("Write the email you have been avoiding.");
  });

  it("uses the first name only when there is no day to name", () => {
    const notification = buildNotification("Sam Okafor", undefined, "I am calm");
    expect(notification?.title).toBe("Sam, your 5 minutes are ready");
    expect(notification?.body).toBe("I am calm");
  });

  it("falls back to a nameless title when the profile has no name", () => {
    const notification = buildNotification(null, undefined, "I am calm");
    expect(notification?.title).toBe("Your practice is ready — 5 minutes");
  });

  it("treats a blank name as no name", () => {
    const notification = buildNotification("   ", undefined, "I am calm");
    expect(notification?.title).toBe("Your practice is ready — 5 minutes");
  });

  /**
   * The regression this replaced: skipping on a missing affirmation alone
   * would have silenced somebody in the middle of a programme.
   */
  it("still sends when there is a day but no affirmation", () => {
    const notification = buildNotification(
      "Sam",
      {
        day_number: 2,
        intention: "Say it out loud once.",
        completed_at: null,
      },
      undefined,
    );

    expect(notification).not.toBeNull();
    expect(notification?.body).toBe("Say it out loud once.");
  });

  it("sends nothing when there is neither", () => {
    expect(buildNotification("Sam", undefined, undefined)).toBeNull();
  });

  /** Android truncates around 40 characters; the meaning must survive that. */
  it("keeps the day number inside the first 40 characters", () => {
    const notification = buildNotification(
      "Bartholomew",
      {
        day_number: 21,
        intention: "x",
        completed_at: null,
      },
      undefined,
    );

    expect(notification!.title.slice(0, 40)).toContain("21");
  });

  it("always points the payload at the practice", () => {
    const notification = buildNotification("Sam", undefined, "I am calm");
    const payload = JSON.parse(notification!.payload) as { url: string; tag: string };

    // The affirmations list is somewhere to browse; the practice is somewhere
    // to finish, and finishing is the only behaviour the product is built on.
    expect(payload.url).toBe("/app/practice");
    expect(payload.tag).toBe("daily-practice");
  });
});

describe("shouldRotateAffirmation", () => {
  it("rotates when the affirmation was the thing sent", () => {
    expect(shouldRotateAffirmation(undefined, true)).toBe(true);
  });

  /**
   * Burning the affirmation on a day the programme supplied the words would
   * cycle somebody through their whole list without them reading one.
   */
  it("does not rotate when the programme supplied the words", () => {
    expect(
      shouldRotateAffirmation({ day_number: 1, intention: "x", completed_at: null }, true),
    ).toBe(false);
  });

  it("does not rotate when there was no affirmation", () => {
    expect(shouldRotateAffirmation(undefined, false)).toBe(false);
  });
});

describe("inParallel", () => {
  it("visits every item exactly once", async () => {
    const items = Array.from({ length: 97 }, (_, i) => i);
    const seen: number[] = [];

    await inParallel(items, 10, async (item) => {
      seen.push(item);
    });

    expect(seen).toHaveLength(97);
    expect(new Set(seen).size).toBe(97);
  });

  /**
   * The whole point of the rewrite. Without a ceiling, a batch of two hundred
   * users with several devices each opens a thousand sockets at once and gets
   * throttled by the push services — which is a slower way to fail than being
   * serial.
   */
  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;

    await inParallel(
      Array.from({ length: 200 }, (_, i) => i),
      25,
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
      },
    );

    expect(peak).toBeLessThanOrEqual(25);
    // And it genuinely used the width it was given, rather than accidentally
    // running one at a time.
    expect(peak).toBeGreaterThan(1);
  });

  /**
   * A work-stealing pool, not fixed chunks. With chunking, one slow item
   * stalls its whole chunk; here the other runners carry on past it.
   */
  it("lets fast workers continue past a slow one", async () => {
    const order: number[] = [];

    await inParallel([0, 1, 2, 3], 2, async (item) => {
      await new Promise((resolve) => setTimeout(resolve, item === 0 ? 40 : 1));
      order.push(item);
    });

    // Item 0 is the slowest and started first, so it must not finish first.
    expect(order[0]).not.toBe(0);
    expect(order).toHaveLength(4);
  });

  /**
   * One dead push service must not end the morning for everybody else. The
   * original awaited each send inside a try/catch for exactly this reason and
   * the property has to survive the rewrite.
   */
  it("keeps going after a worker throws, and reports it", async () => {
    const done: number[] = [];
    const errors: unknown[] = [];

    await inParallel(
      [0, 1, 2],
      2,
      async (item) => {
        if (item === 1) throw new Error("push service is down");
        done.push(item);
      },
      (error) => errors.push(error),
    );

    expect(done.sort()).toEqual([0, 2]);
    expect(errors).toHaveLength(1);
  });

  it("does nothing, and does not hang, on an empty list", async () => {
    let called = false;
    await inParallel([], 25, async () => {
      called = true;
    });
    expect(called).toBe(false);
  });

  /** A limit of zero would otherwise spawn no runners and silently drop work. */
  it("still processes everything when given a nonsensical limit", async () => {
    const seen: number[] = [];
    await inParallel([1, 2, 3], 0, async (item) => {
      seen.push(item);
    });
    expect(seen).toHaveLength(3);
  });
});
