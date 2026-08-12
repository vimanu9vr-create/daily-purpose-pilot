/**
 * Searching your own writing.
 *
 * Done on the device rather than with Postgres full-text search, and that's a
 * deliberate trade rather than laziness. Journal entries are the most private
 * thing this app holds; keeping the query on the device means the words
 * someone is looking for never leave it, and never appear in a server log. A
 * person searching their journal for "the miscarriage" or "quitting" should
 * not have that string travel anywhere.
 *
 * The cost is that it only searches what's loaded. At a few thousand entries
 * that's still fine — the whole set is already in memory for the list — and if
 * it ever isn't, the honest fix is pagination, not shipping the query to a
 * server.
 *
 * Matching is forgiving on purpose: case-insensitive, accent-insensitive, and
 * every word must appear somewhere but not adjacently. People remember the
 * gist of what they wrote, not the phrasing.
 */

export type Searchable = {
  content: string;
  prompt: string | null;
  tags?: string[] | null;
  entry_date: string;
};

/** Lowercase, strip accents, collapse whitespace. */
function normalise(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

export function matchesQuery(entry: Searchable, rawQuery: string): boolean {
  const query = normalise(rawQuery);
  if (!query) return true;

  const haystack = normalise(
    [entry.content, entry.prompt ?? "", (entry.tags ?? []).join(" ")].join(" "),
  );

  // Every term must appear, in any order. "money worry" finds an entry about
  // worrying over money without needing the words to be next to each other.
  return query.split(" ").every((term) => haystack.includes(term));
}

export function searchEntries<T extends Searchable>(entries: T[], query: string): T[] {
  if (!query.trim()) return entries;
  return entries.filter((entry) => matchesQuery(entry, query));
}

/**
 * A short excerpt around the first match, for the results list.
 *
 * Showing the first 80 characters of an entry is useless when the word you
 * searched for is in paragraph four — you get a list of entries that all look
 * identical and have to open each one.
 */
export function excerptAround(content: string, rawQuery: string, radius = 60): string {
  const query = normalise(rawQuery).split(" ")[0];
  if (!query) return content.slice(0, radius * 2);

  const index = normalise(content).indexOf(query);
  if (index === -1) return content.slice(0, radius * 2);

  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + query.length + radius);

  return `${start > 0 ? "…" : ""}${content.slice(start, end).trim()}${end < content.length ? "…" : ""}`;
}

/** Tags in use, most frequent first, for the filter row. */
export function collectTags(entries: Searchable[]): string[] {
  const tally = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags ?? []) {
      tally.set(tag, (tally.get(tag) ?? 0) + 1);
    }
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}
