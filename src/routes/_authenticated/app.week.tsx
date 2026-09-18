import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { useCreateEntry } from "@/features/journal/use-journal";
import { REVIEW_QUESTIONS } from "@/features/insights/weekly-summary";
import { isReviewDay, useWeeklySummary } from "@/features/insights/use-weekly";

export const Route = createFileRoute("/_authenticated/app/week")({
  head: () => ({ meta: [{ title: "Your week — ManifestAI" }] }),
  component: Week,
});

/**
 * The weekly report, and the Sunday review.
 *
 * The numbers come first and the reflection second, in that order on purpose.
 * Leading with an interpretation before the person has seen the data is how a
 * summary becomes a horoscope — they read the sentence, feel something, and
 * never check whether it followed from anything.
 *
 * The four review questions save into the journal rather than into a separate
 * table. A weekly review is a journal entry with a fixed set of prompts, and
 * giving it its own storage would mean it never appears when someone searches
 * their own writing.
 */
function Week() {
  const navigate = useNavigate();
  const { data: summary, isPending } = useWeeklySummary();
  const createEntry = useCreateEntry();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  if (isPending || !summary) {
    return (
      <PageTransition>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </PageTransition>
    );
  }

  const stats = [
    { label: "Practices", value: summary.practices },
    { label: "Minutes", value: summary.minutes },
    { label: "Actions done", value: summary.actionsCompleted },
    { label: "Entries", value: summary.journalEntries },
  ];

  function saveReview() {
    const written = REVIEW_QUESTIONS.filter((question) => answers[question.id]?.trim())
      .map((question) => `${question.label}\n${answers[question.id]!.trim()}`)
      .join("\n\n");

    if (!written) return;

    createEntry.mutate(
      { content: written, prompt: "Weekly review", mood: null },
      { onSuccess: () => setSaved(true) },
    );
  }

  return (
    <PageTransition>
      <h1 className="font-display text-[28px] font-medium leading-none">Your week</h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[24px] border border-glass-border bg-card/50 px-5 py-4"
          >
            <p className="font-display text-3xl tabular-nums">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Reflection after the numbers, never before. */}
      <p className="mt-6 text-pretty text-[15px] leading-relaxed">{summary.reflection}</p>

      {summary.suggestion && (
        <div className="mt-4 rounded-[24px] surface-gradient p-[1px]">
          <div className="rounded-[23px] bg-card/85 p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Worth trying
            </p>
            <p className="mt-2 text-[15px] leading-relaxed">{summary.suggestion}</p>
          </div>
        </div>
      )}

      {/* The review. Offered on Sunday, available any day — someone who wants
          to reflect on a Tuesday shouldn't be told to come back. */}
      <section className="mt-10">
        <p className="eyebrow">{isReviewDay() ? "Sunday review" : "Review this week"}</p>

        {saved ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Saved to your journal. It&rsquo;ll be there next time you look back.
          </p>
        ) : (
          <>
            <div className="mt-4 space-y-4">
              {REVIEW_QUESTIONS.map((question) => (
                <div key={question.id}>
                  <label
                    htmlFor={question.id}
                    className="text-sm leading-relaxed text-muted-foreground"
                  >
                    {question.label}
                  </label>
                  <textarea
                    id={question.id}
                    rows={2}
                    value={answers[question.id] ?? ""}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                    className="mt-2 w-full resize-none rounded-2xl border border-glass-border bg-card/50 p-4 text-[15px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              ))}
            </div>

            <Button
              variant="hero"
              size="lg"
              className="mt-6 w-full rounded-full"
              onClick={saveReview}
              disabled={createEntry.isPending}
            >
              {createEntry.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save this review
            </Button>
          </>
        )}
      </section>

      <Button
        variant="ghost"
        className="mt-6 w-full rounded-full"
        onClick={() => navigate({ to: "/app" })}
      >
        Back to home
      </Button>
    </PageTransition>
  );
}
