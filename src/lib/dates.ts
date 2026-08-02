/** Local-timezone date helpers. Never use toISOString() for calendar dates —
 * it shifts the day for anyone west of UTC. */

export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** The last `n` calendar days, oldest first, as ISO date strings. */
export function lastNDays(n: number, from: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => toISODate(addDays(from, i - (n - 1))));
}

/**
 * Consecutive-day streak ending today (or yesterday, so a day isn't "lost"
 * until it's fully over). Expects a set of ISO date strings.
 */
export function currentStreak(dates: Set<string>, from: Date = new Date()): number {
  let cursor = from;
  if (!dates.has(toISODate(cursor))) {
    cursor = addDays(cursor, -1);
    if (!dates.has(toISODate(cursor))) return 0;
  }
  let streak = 0;
  while (dates.has(toISODate(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Parse a `YYYY-MM-DD` string into a local-midnight Date. */
export function parseISODate(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDayLabel(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { weekday: "narrow" });
}

export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function monthKey(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = parseISODate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
