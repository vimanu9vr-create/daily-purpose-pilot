import { Check, Plus, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import {
  useAddMilestone,
  useDeleteMilestone,
  useMilestones,
  useToggleMilestone,
} from "./use-milestones";

/**
 * The steps for one desire.
 *
 * Everything here is editable, including the generated ones. A list the app
 * wrote and won't let you change is the app telling you how to live, which is
 * both annoying and usually wrong — it has five sentences of context and you
 * have all of it.
 *
 * Completed steps stay in place rather than moving to the bottom or vanishing.
 * Seeing what you've already done above what's left is most of the reason to
 * have a list at all.
 */
export function MilestoneList({ desireId }: { desireId: string }) {
  const { data: milestones, isPending } = useMilestones(desireId);
  const toggle = useToggleMilestone();
  const add = useAddMilestone();
  const remove = useDeleteMilestone();

  const [draft, setDraft] = useState("");

  if (isPending) return null;

  const rows = milestones ?? [];
  const done = rows.filter((row) => row.completed_at).length;

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Steps</p>
        {rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {done} of {rows.length}
          </p>
        )}
      </div>

      <ul className="mt-3 space-y-1">
        {rows.map((milestone) => {
          const complete = Boolean(milestone.completed_at);
          return (
            <li key={milestone.id} className="group flex items-start gap-3 py-1.5">
              <button
                type="button"
                onClick={() => toggle.mutate({ id: milestone.id, done: !complete })}
                aria-pressed={complete}
                aria-label={complete ? "Mark as not done" : "Mark as done"}
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  complete
                    ? "border-transparent surface-gradient text-primary-foreground"
                    : "border-muted-foreground/40 hover:border-primary",
                )}
              >
                {complete && <Check className="h-3 w-3" />}
              </button>

              <span
                className={cn(
                  "flex-1 text-[15px] leading-relaxed",
                  complete && "text-muted-foreground line-through decoration-1",
                )}
              >
                {milestone.title}
              </span>

              <button
                type="button"
                onClick={() => remove.mutate(milestone.id)}
                aria-label="Remove this step"
                className="mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground/0 transition-colors hover:text-muted-foreground group-hover:text-muted-foreground/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          add.mutate({ desireId, title: draft });
          setDraft("");
        }}
        className="mt-3 flex items-center gap-2"
      >
        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a step of your own"
          className="min-w-0 flex-1 bg-transparent py-1 text-[15px] placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </form>
    </section>
  );
}
