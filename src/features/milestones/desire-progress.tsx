import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { useActionHistory } from "@/features/actions/use-actions";
import { cn } from "@/lib/utils";

import { computeProgress } from "./progress";
import { MilestoneList } from "./milestone-list";
import { useAllMilestones, useSeedMilestones } from "./use-milestones";

type Desire = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
};

/**
 * "Your manifestations", with a percentage that means something.
 *
 * The number is derived from milestones ticked and actions completed — never
 * stored, never typed. The old `goals.progress` column was a free-text integer,
 * which meant a goal could sit at 62% having had nothing done to it since
 * March. A percentage that isn't computed from behaviour is decoration
 * pretending to be data, and people can tell.
 *
 * Nothing is shown at all until there's something to measure. A row of 0% bars
 * on the first morning is a worse first impression than no bars.
 */
export function DesireProgress({ desires }: { desires: Desire[] }) {
  const { data: milestones } = useAllMilestones();
  const { data: actions } = useActionHistory(90);
  const seed = useSeedMilestones();
  const [openId, setOpenId] = useState<string | null>(null);

  // Give every desire a starting plan, once. Idempotent inside the mutation,
  // so opening the app on two devices can't produce two sets of steps.
  useEffect(() => {
    if (!milestones) return;
    const have = new Set(milestones.map((milestone) => milestone.desire_id));
    for (const desire of desires) {
      if (have.has(desire.id)) continue;
      seed.mutate({
        desireId: desire.id,
        title: desire.title,
        category: desire.category,
        why: desire.description,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desires.length, milestones?.length]);

  if (!milestones || milestones.length === 0) return null;

  return (
    <section className="mt-8">
      <p className="eyebrow">Your manifestations</p>

      <div className="mt-3 space-y-1">
        {desires.map((desire) => {
          const mine = milestones.filter((m) => m.desire_id === desire.id);
          const myActions = (actions ?? []).filter((a) => a.desire_id === desire.id);

          const progress = computeProgress({
            milestonesTotal: mine.length,
            milestonesDone: mine.filter((m) => m.completed_at).length,
            actionsTotal: myActions.length,
            actionsDone: myActions.filter((a) => a.completed_at).length,
          });
          if (progress === null) return null;

          const open = openId === desire.id;

          return (
            <div key={desire.id} className="rounded-[24px] border border-glass-border bg-card/40">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : desire.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px]">{desire.title}</span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {progress}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full surface-gradient transition-[width] duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>

              {open && (
                <div className="border-t border-glass-border px-5 py-4">
                  <MilestoneList desireId={desire.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
