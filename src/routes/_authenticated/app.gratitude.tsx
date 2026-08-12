import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Mic, MicOff } from "lucide-react";
import { useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import {
  GRATITUDE_PROMPT,
  useCreateEntry,
  useJournalEntries,
} from "@/features/journal/use-journal";
import { useDictation } from "@/hooks/use-dictation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/gratitude")({
  head: () => ({ meta: [{ title: "Gratitude — ManifestAI" }] }),
  component: Gratitude,
});

/**
 * Gratitude, as its own thing.
 *
 * Three lines rather than a free-text box, because a blank page asks "what are
 * you grateful for?" and three numbered lines ask "what are three things?" —
 * and the second question is much easier to answer on a bad day, which is the
 * day it matters.
 *
 * Stored as a journal entry with a fixed prompt rather than in its own table,
 * so it turns up when someone searches their own writing later. The moment
 * you'd most want to find "I was grateful for that phone call" is months
 * afterwards, and a separate table would hide it.
 */
function Gratitude() {
  const { data: entries } = useJournalEntries();
  const createEntry = useCreateEntry();

  const [lines, setLines] = useState(["", "", ""]);
  const [focused, setFocused] = useState(0);

  const dictation = useDictation((text) => {
    setLines((current) =>
      current.map((line, index) => (index === focused ? `${line} ${text}`.trim() : line)),
    );
  });

  const past = (entries ?? []).filter((entry) => entry.prompt === GRATITUDE_PROMPT);
  const filled = lines.filter((line) => line.trim());

  function save() {
    if (filled.length === 0) return;
    createEntry.mutate(
      {
        content: filled.map((line, index) => `${index + 1}. ${line.trim()}`).join("\n"),
        prompt: GRATITUDE_PROMPT,
        mood: null,
        tags: ["gratitude"],
      },
      { onSuccess: () => setLines(["", "", ""]) },
    );
  }

  return (
    <PageTransition>
      <h1 className="font-display text-[28px] font-medium leading-none">Gratitude</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Three things. Small ones count — most of them are small.
      </p>

      <div className="mt-6 space-y-3">
        {lines.map((line, index) => (
          <div key={index} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-sm tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <input
              value={line}
              onFocus={() => setFocused(index)}
              onChange={(event) =>
                setLines((current) =>
                  current.map((row, i) => (i === index ? event.target.value : row)),
                )
              }
              placeholder={index === 0 ? "Something that went right" : ""}
              className="min-w-0 flex-1 rounded-full border border-glass-border bg-card/50 px-5 py-3 text-[15px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        ))}
      </div>

      {dictation.listening && dictation.interim && (
        <p className="mt-3 pl-7 text-sm italic text-muted-foreground">{dictation.interim}</p>
      )}

      <div className="mt-6 flex gap-3">
        {/* Hidden entirely where the browser has no speech engine. A dictation
            button that silently does nothing is worse than none at all. */}
        {dictation.supported && (
          <Button
            variant="glass"
            className={cn("rounded-full", dictation.listening && "ring-1 ring-primary/50")}
            onClick={dictation.toggle}
            aria-pressed={dictation.listening}
          >
            {dictation.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {dictation.listening ? "Stop" : "Speak"}
          </Button>
        )}

        <Button
          variant="hero"
          className="flex-1 rounded-full"
          onClick={save}
          disabled={filled.length === 0 || createEntry.isPending}
        >
          {createEntry.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      </div>

      {past.length > 0 && (
        <section className="mt-12">
          <p className="eyebrow">Your gratitude journey</p>
          <div className="mt-4 space-y-3">
            {past.slice(0, 20).map((entry) => (
              <article
                key={entry.id}
                className="rounded-[22px] border border-glass-border bg-card/40 p-4"
              >
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {new Date(entry.entry_date).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">
                  {entry.content}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </PageTransition>
  );
}
