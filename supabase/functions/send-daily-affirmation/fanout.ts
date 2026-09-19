/**
 * The parts of the morning send that are just logic.
 *
 * ## Why this file exists
 *
 * Everything in `index.ts` is welded to Deno: `Deno.serve` at the top level,
 * `Deno.env`, a remote `https://esm.sh` import. None of that can be imported
 * from the Vitest suite, so for as long as the batching, grouping and
 * concurrency lived in that file they could not be tested at all — which is
 * precisely how the original grew a serial loop over an unbounded fetch
 * without anybody noticing.
 *
 * These functions are pure, have no imports, and touch no globals. Supabase
 * deploys a function directory as one bundle, so this ships with `index.ts`
 * exactly as if it were still inside it.
 *
 * The rule to keep: anything that decides *what* to send belongs here and gets
 * a test. Anything that performs I/O stays in `index.ts`.
 */

export type ProgrammeDay = {
  day_number: number;
  intention: string;
  completed_at: string | null;
};

export type Notification = {
  title: string;
  body: string;
  payload: string;
};

/**
 * PostgREST's `in.(...)` filter value.
 *
 * The quoting is not cosmetic. PostgREST splits this list on commas, so any
 * unquoted value containing one silently becomes two values. Uuids never
 * contain commas today, but this helper is one copy-paste away from being used
 * on a text column, and the failure mode there is a query that returns the
 * wrong rows rather than an error.
 */
export function inList(ids: string[]): string {
  return `in.(${ids.map((id) => `"${id}"`).join(",")})`;
}

/**
 * Keeps the first row seen for each user.
 *
 * The batched queries replace a per-user query that ended in `limit=1`. The
 * equivalent over a whole batch is to order by user and then by the same key,
 * and take the first row per user — which is what this does. It depends on the
 * caller having ordered the rows correctly; the tests below pin that contract
 * down so a later change to the `order=` string has something to fail against.
 */
export function firstPerUser<T extends { user_id: string }>(rows: T[]): Map<string, T> {
  const byUser = new Map<string, T>();
  for (const row of rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, row);
  }
  return byUser;
}

/** Groups every row under its user, preserving order. */
export function groupByUser<T extends { user_id: string }>(rows: T[]): Map<string, T[]> {
  const byUser = new Map<string, T[]>();
  for (const row of rows) {
    const existing = byUser.get(row.user_id);
    if (existing) existing.push(row);
    else byUser.set(row.user_id, [row]);
  }
  return byUser;
}

/**
 * The next day of a programme that has not been completed.
 *
 * "Day 6" means the sixth day someone has DONE, not the sixth day since they
 * started. That distinction is deliberate upstream and must survive here: a
 * notification that counts calendar days is a notification that tells people
 * they have fallen behind.
 */
export function nextIncompleteDay(days: ProgrammeDay[] | undefined): ProgrammeDay | undefined {
  return (days ?? [])
    .filter((day) => !day.completed_at)
    .sort((a, b) => a.day_number - b.day_number)[0];
}

/**
 * Builds the notification for one person.
 *
 * Titles are truncated around 40 characters on Android, so the number and the
 * commitment go first and the name is dropped when there is a day to name.
 * "Day 6" is more motivating than being greeted by software.
 *
 * Returns null when there is nothing to say at all. An earlier version skipped
 * on a missing affirmation alone, which would have silenced somebody
 * mid-programme.
 */
export function buildNotification(
  displayName: string | null,
  day: ProgrammeDay | undefined,
  affirmationText: string | undefined,
): Notification | null {
  if (!day && !affirmationText) return null;

  const firstName = displayName?.trim().split(" ")[0];

  const title = day
    ? `Your day ${day.day_number} practice is ready`
    : firstName
      ? `${firstName}, your 5 minutes are ready`
      : "Your practice is ready — 5 minutes";

  const body = day?.intention ?? affirmationText ?? "Five minutes, five steps.";

  return {
    title,
    body,
    payload: JSON.stringify({
      title,
      body,
      // Always the practice. The affirmations list is somewhere to browse; the
      // practice is somewhere to finish, and finishing is what we need.
      url: "/app/practice",
      tag: "daily-practice",
    }),
  };
}

/**
 * True when the affirmation should be marked as shown.
 *
 * Only if it was the thing actually sent. Burning it on a day the programme
 * supplied the words would silently cycle somebody through their affirmations
 * without them ever having read one.
 */
export function shouldRotateAffirmation(
  day: ProgrammeDay | undefined,
  hasAffirmation: boolean,
): boolean {
  return hasAffirmation && !day;
}

/**
 * Runs `worker` over `items` with at most `limit` in flight.
 *
 * Deliberately not `Promise.all(items.map(worker))`: that opens one socket per
 * item, which on a large batch means thousands at once and ends in throttling
 * from the push services rather than in speed. Deliberately not a sequential
 * `for` loop either — that is what the original did, and it spent essentially
 * the whole run waiting on network latency.
 *
 * Each runner pulls the next index as it finishes, so one slow push delays
 * only itself rather than a whole fixed-size chunk.
 *
 * A throwing worker is logged and stepped over. One dead push service must not
 * end the morning for everybody else.
 */
export async function inParallel<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  onError: (error: unknown) => void = () => {},
): Promise<void> {
  if (items.length === 0) return;

  const width = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  const runners = Array.from({ length: width }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]!;
      try {
        await worker(item);
      } catch (error) {
        onError(error);
      }
    }
  });

  await Promise.all(runners);
}
