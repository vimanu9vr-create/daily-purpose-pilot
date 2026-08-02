import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { ProgressRing } from "@/components/app/progress-ring";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddStep,
  useDeleteGoal,
  useDeleteStep,
  useGoal,
  useGoalSteps,
  useReorderSteps,
  useToggleStep,
  type GoalStep,
} from "@/features/goals/use-goals";
import { formatLongDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/goals/$goalId")({
  head: () => ({ meta: [{ title: "Goal — ManifestAI" }] }),
  component: GoalDetail,
});

function GoalDetail() {
  const { goalId } = Route.useParams();
  const navigate = useNavigate();

  const { data: goal, isPending, error } = useGoal(goalId);
  const { data: steps } = useGoalSteps(goalId);
  const addStep = useAddStep(goalId);
  const toggleStep = useToggleStep(goalId);
  const deleteStep = useDeleteStep(goalId);
  const reorderSteps = useReorderSteps(goalId);
  const deleteGoal = useDeleteGoal();

  const [newStep, setNewStep] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function handleAddStep() {
    const title = newStep.trim();
    if (!title) return;
    addStep.mutate({ title, orderIndex: steps?.length ?? 0 });
    setNewStep("");
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || !steps || dragIndex === targetIndex) return;
    const next = [...steps];
    const [moved] = next.splice(dragIndex, 1);
    if (moved) next.splice(targetIndex, 0, moved);
    reorderSteps.mutate(next as GoalStep[]);
    setDragIndex(null);
  }

  if (isPending) {
    return (
      <PageTransition>
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <Skeleton className="h-8 w-40 rounded-xl" />
          <Skeleton className="h-36 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </PageTransition>
    );
  }

  if (error || !goal) {
    return (
      <PageTransition>
        <div className="mx-auto w-full max-w-3xl rounded-3xl glass-panel p-8 text-center">
          <p className="text-sm text-muted-foreground">
            We couldn't find that goal. It may have been deleted.
          </p>
          <Button variant="glass" className="mt-4" asChild>
            <Link to="/app/goals">Back to goals</Link>
          </Button>
        </div>
      </PageTransition>
    );
  }

  const done = steps?.filter((s) => s.completed).length ?? 0;
  const total = steps?.length ?? 0;

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-3xl">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" asChild>
          <Link to="/app/goals">
            <ArrowLeft /> All goals
          </Link>
        </Button>

        <header className="rounded-3xl glass-panel p-6">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold leading-tight md:text-3xl">
                {goal.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {goal.category && (
                  <Badge variant="secondary" className="rounded-lg">
                    {goal.category}
                  </Badge>
                )}
                {goal.target_date && (
                  <Badge variant="outline" className="rounded-lg font-normal">
                    Target {formatLongDate(goal.target_date)}
                  </Badge>
                )}
              </div>
            </div>
            <ProgressRing
              value={goal.progress}
              size={76}
              stroke={6}
              sublabel={total > 0 ? `${done}/${total}` : undefined}
            />
          </div>

          {(goal.why || goal.feeling) && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {goal.why && (
                <div className="rounded-2xl bg-accent/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Why this matters
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{goal.why}</p>
                </div>
              )}
              {goal.feeling && (
                <div className="rounded-2xl bg-accent/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    How it will feel
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{goal.feeling}</p>
                </div>
              )}
            </div>
          )}

          {goal.obstacles && (
            <div className="mt-4 rounded-2xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Known obstacles
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{goal.obstacles}</p>
            </div>
          )}
        </header>

        <section className="mt-6 rounded-3xl glass-panel p-6">
          <h2 className="font-display text-lg font-semibold">Milestones</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Break the goal into steps you could start this week. Progress updates automatically.
          </p>

          <ul className="mt-5 space-y-1.5">
            {steps?.map((step, index) => (
              <li
                key={step.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
                  dragIndex === index ? "bg-accent/60" : "hover:bg-accent/40",
                )}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing" />
                <Checkbox
                  checked={step.completed}
                  onCheckedChange={(checked) =>
                    toggleStep.mutate({ stepId: step.id, completed: checked === true })
                  }
                  aria-label={step.title}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 text-sm transition-colors",
                    step.completed && "text-muted-foreground line-through",
                  )}
                >
                  {step.title}
                </span>
                <button
                  type="button"
                  onClick={() => deleteStep.mutate(step.id)}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={`Delete step: ${step.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          {total === 0 && (
            <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No milestones yet. What's the smallest first step?
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <Input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddStep()}
              placeholder="Add a milestone…"
            />
            <Button onClick={handleAddStep} disabled={!newStep.trim() || addStep.isPending}>
              {addStep.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            </Button>
          </div>
        </section>

        <div className="mt-6 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (!confirm("Delete this goal and all its milestones?")) return;
              deleteGoal.mutate(goalId, {
                onSuccess: () => void navigate({ to: "/app/goals" }),
              });
            }}
          >
            <Trash2 /> Delete goal
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
