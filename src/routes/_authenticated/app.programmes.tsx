import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { useDesires } from "@/features/stories/use-stories";
import { coverImage, themeFor } from "@/features/stories/imagery";
import { DreamCover } from "@/features/stories/dream-cover";
import { programmeProgress, type ProgrammeLength } from "@/features/programmes/programme-plan";
import {
  useProgrammeDays,
  useProgrammes,
  useDeleteProgramme,
  useStartProgramme,
  type Programme,
} from "@/features/programmes/use-programmes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/programmes")({
  head: () => ({ meta: [{ title: "Programmes — ManifestAI" }] }),
  component: Programmes,
});

const LENGTHS: { days: ProgrammeLength; label: string; blurb: string }[] = [
  { days: 7, label: "7 days", blurb: "One pass through the whole arc." },
  { days: 21, label: "21 days", blurb: "The same arc three times, deeper each week." },
];

function Programmes() {
  const navigate = useNavigate();
  const { data: desires, isPending } = useDesires();
  const { data: programmes } = useProgrammes();
  const start = useStartProgramme();

  const [desireId, setDesireId] = useState<string | null>(null);
  const [length, setLength] = useState<ProgrammeLength>(7);

  const active = (programmes ?? []).filter((p) => !p.completed_at);
  const finished = (programmes ?? []).filter((p) => p.completed_at);
  const chosen = (desires ?? []).find((d) => d.id === desireId) ?? desires?.[0];

  if (isPending) {
    return (
      <PageTransition>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <h1 className="font-display text-[28px] font-medium leading-none">Programmes</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        A run of days on one thing you want. Each day has its own affirmations and its own track.
      </p>

      {active.length > 0 && (
        <section className="mt-8">
          <p className="eyebrow">In progress</p>
          <div className="mt-3 space-y-3">
            {active.map((programme) => (
              <ProgrammeRow key={programme.id} programme={programme} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <p className="eyebrow">Start one</p>

        {(desires ?? []).length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Add something you want first — a programme is built from your own words.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {(desires ?? []).map((desire) => (
                <button
                  key={desire.id}
                  type="button"
                  onClick={() => setDesireId(desire.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-[13px] transition",
                    chosen?.id === desire.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-glass-border bg-card/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {desire.title}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {LENGTHS.map((option) => (
                <button
                  key={option.days}
                  type="button"
                  onClick={() => setLength(option.days)}
                  className={cn(
                    "rounded-[24px] border p-5 text-left transition",
                    length === option.days
                      ? "border-primary bg-primary/5"
                      : "border-glass-border bg-card/50 hover:bg-card/70",
                  )}
                >
                  <p className="font-display text-xl">{option.label}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {option.blurb}
                  </p>
                </button>
              ))}
            </div>

            <Button
              variant="hero"
              size="lg"
              className="mt-6 w-full rounded-full"
              disabled={!chosen || start.isPending}
              onClick={() => {
                if (!chosen) return;
                start.mutate(
                  { desireId: chosen.id, desireTitle: chosen.title, length },
                  {
                    onSuccess: (programme) =>
                      navigate({
                        to: "/app/programme/$programmeId",
                        params: { programmeId: programme.id },
                      }),
                  },
                );
              }}
            >
              {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Start {length} days
            </Button>

            {/* Said once, here, rather than as a nag on every day screen. */}
            <p className="mt-3 text-center text-[12px] leading-relaxed text-muted-foreground">
              Days unlock in order, not by date. Come back whenever — nothing expires.
            </p>
          </>
        )}
      </section>

      {finished.length > 0 && (
        <section className="mt-10">
          <p className="eyebrow">Finished</p>
          <div className="mt-3 space-y-3">
            {finished.map((programme) => (
              <ProgrammeRow key={programme.id} programme={programme} />
            ))}
          </div>
        </section>
      )}
    </PageTransition>
  );
}

function ProgrammeRow({ programme }: { programme: Programme }) {
  const { data: days } = useProgrammeDays(programme.id);
  const done = (days ?? []).filter((day) => day.completed_at).length;
  const progress = programmeProgress(done, programme.length_days as ProgrammeLength);
  const remove = useDeleteProgramme();

  return (
    <div className="relative">
      {/*
        Abandoning a programme was impossible — no button, no hook. One could
        only ever be started, so three written by the old templated version were
        going to sit here indefinitely with no way to clear them.

        It sits outside the Link rather than inside it: a delete control nested
        in a navigation target is a mis-tap waiting to happen on a phone.
      */}
      <button
        type="button"
        onClick={() => {
          if (progress.current > 1 && !window.confirm(`Abandon “${programme.title}”?`)) return;
          remove.mutate(programme.id);
        }}
        disabled={remove.isPending}
        aria-label={`Abandon ${programme.title}`}
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-muted-foreground transition hover:text-destructive disabled:opacity-40"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <Link
        to="/app/programme/$programmeId"
        params={{ programmeId: programme.id }}
        className="flex items-center gap-4 rounded-[24px] border border-glass-border bg-card/50 p-3 pr-11 transition hover:bg-card/70"
      >
        <DreamCover
          fallbackSrc={coverImage(programme.id, themeFor(programme.title))}
          desireId={programme.desire_id}
          index={0}
          className="h-16 w-16 shrink-0 rounded-[18px] object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[17px]">{programme.title}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {progress.isFinished
              ? `All ${programme.length_days} days done`
              : `Day ${progress.current} of ${programme.length_days}`}
          </p>
        </div>
        {progress.isFinished && <Check className="h-5 w-5 shrink-0 text-primary" />}
      </Link>
    </div>
  );
}
