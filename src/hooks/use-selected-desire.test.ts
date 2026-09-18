import { describe, expect, it } from "vitest";

import { resolveDesireId } from "./use-selected-desire";

const desires = [{ id: "newest" }, { id: "middle" }, { id: "oldest" }];

describe("resolveDesireId", () => {
  it("honours the stored choice", () => {
    expect(resolveDesireId("middle", desires)).toBe("middle");
  });

  /**
   * The bug this whole hook exists for: the practice screen took desires[0]
   * regardless, so tapping any dream but the newest changed nothing.
   */
  it("does not fall back to the newest when a valid choice is stored", () => {
    expect(resolveDesireId("oldest", desires)).not.toBe("newest");
  });

  it("falls back to the newest when nothing is stored", () => {
    expect(resolveDesireId(null, desires)).toBe("newest");
  });

  /**
   * Deleting the selected dream must not leave the app pointing at nothing —
   * every screen reads this, so null would blank the feed, the anchor and the
   * practice all at once.
   */
  it("falls back when the stored dream has been deleted", () => {
    expect(resolveDesireId("gone", desires)).toBe("newest");
  });

  it("returns null only when there are no dreams at all", () => {
    expect(resolveDesireId("anything", [])).toBeNull();
    expect(resolveDesireId(null, undefined)).toBeNull();
  });
});
