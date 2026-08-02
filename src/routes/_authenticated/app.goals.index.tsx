import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Plus, Target } from "lucide-react";
import { useState } from "react";

import { AppPage, EmptyState } from "@/components/app/app-page";
import { ProgressRing } from "@/components/app/progress-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalWizard } from "@/features/goals/goal-wizard";
import { useGoals } from "@/features/goals/use-goals";
import { daysUntil, formatLongDate } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/app/goals/")({
  head: () => ({ meta: [{ title: "Goals — ManifestAI" }] }),
  component: GoalsIndex,
});

function deadlineLabel(targetDate: string | null) {
  const days = daysUntil(targetDate);
  if (days === null) return null;
  if (days < 0) return `${Math.abs(days)} days past target`;
  if (days === 0) return "Target is today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function GoalsIndex() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const { data: goals, isPending, error } = useGoals();

  return (
    <AppPage
      title="Goals"
      description="Define what you're working toward, why it matters, and the steps that get you there."
    >
      <div className="mb-6 flex justify-end">
        <Button variant="hero" onClick={() => setWizardOpen(true)}>
          <Plus /> New goal
        </Button>
      </div>

      {isPending && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-3xl glass-panel p-6 text-sm text-destructive">
          Couldn't load your goals. {error.message}
        </div>
      )}

      {goals && goals.length === 0 && (
        <EmptyState
          icon={Target}
          title="No goals yet"
          body="Start with one goal you'd be proud to make progress on this quarter. You'll break it into steps and connect supporting habits."
          hint="Five short questions, about two minutes."
        />
      )}

      {goals && goals.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((goal) => {
            const steps = [...goal.goal_steps].sort((a, b) => a.order_index - b.order_index);
            const nextStep = steps.find((s) => !s.completed);
            const deadline = deadlineLabel(goal.target_date);

            return (
              <Link
                key={goal.id}
                to="/app/goals/$goalId"
                params={{ goalId: goal.id }}
                className="group rounded-3xl glass-panel p-5 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold leading-snug">
                      {goal.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {goal.category && (
                        <Badge variant="secondary" className="rounded-lg">
                          {goal.category}
                        </Badge>
                      )}
                      {goal.status === "achieved" && (
                        <Badge className="rounded-lg surface-gradient text-primary-foreground">
                          Achieved
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ProgressRing value={goal.progress} size={58} />
                </div>

                {goal.target_date && (
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatLongDate(goal.target_date)}
                    {deadline && <span className="text-muted-foreground/70">· {deadline}</span>}
                  </p>
                )}

                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {nextStep ? (
                    <>
                      <span className="font-medium text-foreground">Next:</span> {nextStep.title}
                    </>
                  ) : steps.length === 0 ? (
                    "No milestones yet — open to break this into steps."
                  ) : (
                    "Every milestone is done."
                  )}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      <GoalWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </AppPage>
  );
}
