import { Check, RefreshCw } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { useShuffleAction, useToggleAction, type Action } from "./use-actions";

/**
 * Today's action, as it appears on Home.
 *
 * The design decision worth stating: this sits ABOVE the stories, not below
 * them. Everything else in the app is pleasant and passive, and pleasant
 * passive things are what people stop opening after a fortnight. Putting the
 * one thing that asks something of you at the bottom of the page would be a
 * quiet way of admitting we don't mean it.
 *
 * Completion is a single tap and is instantly reversible. Nothing celebrates
 * too loudly — a checkmark and a line through it. Overclaiming here would be
 * the same mistake as the app promising outcomes.
 */
export function TodaysAction({
  action,
  desireTitle,
  category,
}: {
  action: Action;
  desireTitle: string;
  category: string | null;
}) {
  const toggle = useToggleAction();
  const shuffle = useShuffleAction();
  const [attempt, setAttempt] = useState(1);

  const done = Boolean(action.completed_at);

  return (
    <article
      className={cn(
        "rounded-[28px] border border-glass-border bg-card/70 p-5 transition-colors",
        done && "bg-card/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Today&rsquo;s action
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{desireTitle}</p>
        </div>

        {!done && (
          <button
            type="button"
            aria-label="Suggest a different action"
            onClick={() => {
              shuffle.mutate({
                id: action.id,
                title: desireTitle,
                category,
                attempt,
              });
              setAttempt((n) => n + 1);
            }}
            className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <RefreshCw className={cn("h-4 w-4", shuffle.isPending && "animate-spin")} />
          </button>
        )}
      </div>

      <p
        className={cn(
          "mt-3 text-pretty text-[15px] leading-relaxed",
          done && "text-muted-foreground line-through decoration-1",
        )}
      >
        {action.body}
      </p>

      <button
        type="button"
        onClick={() => toggle.mutate({ id: action.id, done: !done })}
        disabled={toggle.isPending}
        className={cn(
          "mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
          done
            ? "bg-transparent text-muted-foreground hover:text-foreground"
            : "surface-gradient text-primary-foreground shadow-glow",
        )}
      >
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-full border",
            done ? "border-muted-foreground" : "border-primary-foreground/60",
          )}
        >
          {done && <Check className="h-3 w-3" />}
        </span>
        {done ? "Done today" : "Mark as done"}
      </button>
    </article>
  );
}

/** Shown when there are no desires yet, so the slot never sits empty. */
export function ActionEmptyState() {
  return (
    <article className="rounded-[28px] border border-dashed border-glass-border p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Today&rsquo;s action
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Add what you want and one real step toward it appears here each morning. Reading about it is
        the easy half.
      </p>
    </article>
  );
}
