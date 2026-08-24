import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Volume2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/voice-lab")({
  head: () => ({ meta: [{ title: "Maintenance — ManifestAI" }] }),
  component: Maintenance,
});

/**
 * A page for jobs that cost money, run rarely, and want a person watching.
 *
 * ## What this replaced
 *
 * It was the voice lab — seven versions of the same passage side by side, to
 * settle which voice and pace the app should use. That question is settled
 * (Sarah, slow, wide gaps), and its own comment said it should be deleted once
 * it was. A page that exists to answer a question nobody is asking any more is
 * code that will rot quietly.
 *
 * ## Why the library needs a button at all
 *
 * Thirty of the thirty-five library tracks had no audio. Sleep was 0 of 3,
 * meditation 0 of 4 — both named on the landing page and sold in the paid
 * tier. Tapping "Falling Softly, 18 min" gave you silence, and had done since
 * the day they were seeded.
 *
 * Narrating costs real money per character, so this is deliberately not
 * automatic. Three tracks per press, with the characters shown before and
 * after, so the spend is a decision somebody makes rather than something that
 * happens overnight. Warming everything on a cron is how an API bill arrives
 * without anyone choosing it, which has already happened to this project once.
 *
 * Not linked from anywhere. It stays at /app/voice-lab because that route
 * already exists and nothing points at it.
 */

type Row = { kind: string; title: string; chars: number };

type BatchResult = {
  narrated: number;
  charsSpent: number;
  remaining: number;
  results: { title: string; kind: string; chars: number; ok: boolean; error?: string }[];
};

function Maintenance() {
  const [silent, setSilent] = useState<Row[] | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: readError } = await supabase
      .from("moments")
      .select("kind,title,body")
      .eq("source", "catalogue")
      .is("audio_url", null)
      .order("kind");

    if (readError) {
      setError(readError.message);
      return;
    }
    setSilent(
      (data ?? []).map((row) => ({
        kind: row.kind ?? "track",
        title: row.title,
        chars: (row.body ?? "").length,
      })),
    );
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function warm(kinds: string[]) {
    setRunning(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("prewarm-catalogue", {
        body: { kinds, batch: 3 },
      });
      if (fnError) throw fnError;

      const result = data as BatchResult;
      setLog((current) => [
        ...result.results.map(
          (r) =>
            `${r.ok ? "✓" : "✗"} ${r.kind} · ${r.title} · ${r.chars} chars${
              r.error ? ` — ${r.error}` : ""
            }`,
        ),
        `— ${result.narrated} narrated, ${result.charsSpent} characters, ${result.remaining} left`,
        ...current,
      ]);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That batch didn't run.");
    } finally {
      setRunning(false);
    }
  }

  // Grouped so sleep and meditation are visible as their own number rather
  // than buried in a total dominated by the affirmation tracks.
  const byKind = (silent ?? []).reduce<Record<string, { count: number; chars: number }>>(
    (acc, row) => {
      const entry = acc[row.kind] ?? { count: 0, chars: 0 };
      entry.count += 1;
      entry.chars += row.chars;
      acc[row.kind] = entry;
      return acc;
    },
    {},
  );

  const spoken = ["sleep", "meditation", "frequency"];
  const spokenLeft = spoken.reduce((n, k) => n + (byKind[k]?.count ?? 0), 0);

  return (
    <PageTransition>
      <h1 className="font-display text-[28px] font-medium leading-none">Library narration</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        A track with no audio is silent when someone opens it. Narrating costs money per character,
        so this runs three at a time and tells you what it spent.
      </p>

      {silent === null ? (
        <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking&hellip;
        </div>
      ) : silent.length === 0 ? (
        <p className="mt-8 rounded-[24px] border border-glass-border bg-card/40 p-5 text-sm">
          Every library track has audio.
        </p>
      ) : (
        <div className="mt-6 space-y-2">
          {Object.entries(byKind).map(([kind, { count, chars }]) => (
            <div
              key={kind}
              className="flex items-center justify-between rounded-[20px] border border-glass-border bg-card/40 px-5 py-3.5"
            >
              <span className="font-display text-[15px] capitalize">{kind}</span>
              <span className="text-[13px] tabular-nums text-muted-foreground">
                {count} silent &middot; {chars.toLocaleString()} chars
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          variant="glass"
          className="rounded-full"
          disabled={running || spokenLeft === 0}
          onClick={() => void warm(spoken)}
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
          Narrate 3 sleep &amp; meditation tracks
        </Button>

        {/*
          Affirmation tracks used to be withheld, and the note said they cost
          about nine times over for the same words. True while PASSES was 3 and
          the whole set was written into each script three times; not true now
          that it is one pass with the repeats coming from the player. The
          reason to withhold them went with it.

          Still a separate button, so the cheap shared tracks and the per-user
          ones are never spent in the same click.
        */}
        <Button
          variant="glass"
          className="rounded-full"
          disabled={running || (byKind["affirmation"]?.count ?? 0) === 0}
          onClick={() => void warm(["affirmation"])}
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
          Narrate 3 affirmation tracks
        </Button>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
        Sleep, meditation and frequency tracks are shared by title — narrated once, then served to
        everyone who ever opens them. Affirmation tracks are built from your own affirmations, so
        each person&rsquo;s are their own. Do the shared ones first.
      </p>

      {error && <p className="mt-4 text-[13px] text-destructive">{error}</p>}

      {log.length > 0 && (
        <pre className="mt-6 overflow-x-auto rounded-[20px] border border-glass-border bg-card/40 p-4 text-[12px] leading-relaxed text-muted-foreground">
          {log.join("\n")}
        </pre>
      )}
    </PageTransition>
  );
}
