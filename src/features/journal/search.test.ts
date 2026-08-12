import { describe, expect, it } from "vitest";

import { collectTags, excerptAround, matchesQuery, searchEntries } from "./search";

const entry = (content: string, extra: Partial<Parameters<typeof matchesQuery>[0]> = {}) => ({
  content,
  prompt: null,
  tags: [],
  entry_date: "2026-08-12",
  ...extra,
});

describe("matchesQuery", () => {
  it("matches regardless of case", () => {
    expect(matchesQuery(entry("I felt Steady today"), "steady")).toBe(true);
  });

  it("ignores accents, because nobody types them when searching", () => {
    expect(matchesQuery(entry("a quiet café morning"), "cafe")).toBe(true);
  });

  it("requires every term but not adjacency", () => {
    const written = entry("I have been worrying about money again");
    expect(matchesQuery(written, "money worrying")).toBe(true);
    expect(matchesQuery(written, "worrying money")).toBe(true);
    expect(matchesQuery(written, "money sleep")).toBe(false);
  });

  it("matches on a word stem, since people remember the root not the form", () => {
    // "worry" finds "worrying"; "run" finds "running".
    expect(matchesQuery(entry("I have been worrying about money"), "worry")).toBe(true);
    expect(matchesQuery(entry("went running this morning"), "run")).toBe(true);
  });

  it("searches the prompt and tags too", () => {
    expect(matchesQuery(entry("nothing here", { prompt: "Weekly review" }), "weekly")).toBe(true);
    expect(matchesQuery(entry("nothing here", { tags: ["career"] }), "career")).toBe(true);
  });

  it("returns everything for an empty query", () => {
    expect(matchesQuery(entry("anything"), "   ")).toBe(true);
  });
});

describe("searchEntries", () => {
  it("filters without mutating the input", () => {
    const entries = [entry("about money"), entry("about sleep")];
    const results = searchEntries(entries, "money");
    expect(results).toHaveLength(1);
    expect(entries).toHaveLength(2);
  });
});

describe("excerptAround", () => {
  it("shows the text around the match, not the start of the entry", () => {
    const long = `${"a".repeat(300)} the important word ${"b".repeat(300)}`;
    const excerpt = excerptAround(long, "important");
    expect(excerpt).toContain("important");
    expect(excerpt.length).toBeLessThan(200);
  });

  it("falls back to the opening when there's no match", () => {
    expect(excerptAround("short entry", "absent")).toContain("short");
  });
});

describe("collectTags", () => {
  it("orders by how often each tag is used", () => {
    const entries = [
      entry("a", { tags: ["money", "work"] }),
      entry("b", { tags: ["money"] }),
      entry("c", { tags: ["work", "money"] }),
    ];
    expect(collectTags(entries)[0]).toBe("money");
  });

  it("handles entries with no tags", () => {
    expect(collectTags([entry("a")])).toEqual([]);
  });
});
