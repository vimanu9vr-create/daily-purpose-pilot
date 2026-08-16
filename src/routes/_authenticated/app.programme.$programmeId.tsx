import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, Loader2, Lock, Play } from "lucide-react";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { programmeMessage, programmeProgress } from "@/features/programmes/programme-plan";
import type { ProgrammeLength } from "@/features/programmes/programme-plan";
import {
  useCompleteDay,
  useProgrammeDays,
  useProgrammeTrack,
  useProgrammes,
  type ProgrammeDayRow,
} from "@/features/programmes/use-programmes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/programme/$programmeId")({
  head: () => ({ meta: [{ title: "Programme — ManifestAI" }] }),
  component: ProgrammeDetail,
});

function ProgrammeDetail() {
  const { programmeId } = Route.useParams();
  const navigate = useNavigate();

  const { data: programmes } = useProgrammes();
  const { data: days, isPending } = useProgrammeDays(programmeId);
  const completeDay = useCompleteDay();
  const makeTrack = useProgrammeTrack();

  const programme = (programmes ?? []).find((p) => p.id === programmeId);

  if (isPending || !programme) {
    return (
      <PageTransition>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </PageTransition>
    );
  }

  const length = programme.length_days as ProgrammeLength;
  const done = (days ?? []).filter((day) => day.completed_at).length;
  const progress = programmeProgress(done, length);

  /**
   * Which days can be opened.
   *
   * Everything finished, plus the next one. Not "everything up to today's
   * date" — that would mean a week away from the app leaves five days
   * permanently skipped, and the whole point is that this can't be failed.
   */
  function isOpen(day: ProgrammeDayRow): boolean {
    return Boolean(day.completed_at) || day.day_number === progress.current;
  }

  function openDay(day: ProgrammeDayRow) {
    if (day.moment_id) {
      navigate({ to: "/app/story/$storyId", params: { storyId: day.moment_id } });
      return;
    }
    makeTrack.mutate(
      { day, programme: programme! },
      {
        onSuccess: (momentId) =>
          navigate({ to: "/app/story/$storyId", params: { storyId: momentId } }),
      },
    );
  }

  return (
    <PageTransition>
      <button
        type="button"
        onClick={() => navigate({ to: "/app/programmes" })}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Programmes
      </button>

      <h1 className="font-display text-[26px] font-medium leading-tight">{programme.title}</h1>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">{programmeMessage(done, length)}</p>

      <div className="mt-8 space-y-3">
        {(days ?? []).map((day) => {
          const open = isOpen(day);
          const isNext = day.day_number === progress.current && !day.completed_at;

          return (
            <div
              key={day.id}
              className={cn(
                "rounded-[24px] border p-5 transition",
                isNext ? "border-primary/40 bg-primary/5" : "border-glass-border bg-card/40",
                !open && "opacity-55",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Day {day.day_number}
                  </p>
                  <p className="mt-1 font-display text-[19px] leading-snug">{day.theme}</p>
                </div>
                {day.completed_at ? (
                  <Check className="mt-1 h-5 w-5 shrink-0 text-primary" />
                ) : !open ? (
                  <Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : null}
              </div>

              {open && (
                <>
                  <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                    {day.intention}
                  </p>

                  <ul className="mt-4 space-y-2">
                    {day.lines.map((line, index) => (
                      <li key={index} className="font-display text-[15px] italic leading-snug">
                        {line}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      variant="hero"
                      className="rounded-full"
                      disabled={makeTrack.isPending}
                      onClick={() => openDay(day)}
                    >
                      {makeTrack.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 fill-current" />
                      )}
                      Listen
                    </Button>

                    {!day.completed_at && (
                      <Button
                        variant="glass"
                        className="rounded-full"
                        disabled={completeDay.isPending}
                        onClick={() => completeDay.mutate({ day, programme })}
                      >
                        <Check className="h-4 w-4" />
                        Mark done
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {progress.isFinished && (
        <p className="mt-8 text-center text-[14px] leading-relaxed text-muted-foreground">
          That&rsquo;s all {length} days. The affirmations stay in your library.
        </p>
      )}
    </PageTransition>
  );
}
