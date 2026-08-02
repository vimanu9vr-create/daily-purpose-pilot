import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { GOAL_CATEGORIES, useCreateGoal, type NewGoal } from "./use-goals";

const STEPS = [
  {
    key: "title",
    question: "What do you want?",
    hint: "One sentence. Be specific enough that you'd know when you got there.",
    placeholder: "A remote software job paying $120k",
  },
  {
    key: "why",
    question: "Why do you want it?",
    hint: "Your reason is what carries you through the weeks where nothing seems to move.",
    placeholder: "So I can work from anywhere and stop trading commute time for money.",
  },
  {
    key: "feeling",
    question: "How would achieving it feel?",
    hint: "Naming the feeling makes visualization concrete instead of vague.",
    placeholder: "Settled. Like I finally have room to breathe and plan.",
  },
  {
    key: "target_date",
    question: "By when?",
    hint: "A date turns a wish into a plan. You can always move it.",
    placeholder: "",
  },
  {
    key: "obstacles",
    question: "What's in the way?",
    hint: "Naming the obstacle early is how you plan around it instead of being surprised by it.",
    placeholder: "Fear of failing the interview. Not enough portfolio work.",
  },
] as const;

const EMPTY: NewGoal = {
  title: "",
  why: "",
  feeling: "",
  category: GOAL_CATEGORIES[0],
  target_date: null,
  obstacles: "",
};

export function GoalWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const createGoal = useCreateGoal();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<NewGoal>(EMPTY);

  const step = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;

  // Only the title is genuinely required — the rest is reflection, and forcing
  // it would just teach people to type filler.
  const canAdvance = step.key === "title" ? draft.title.trim().length > 0 : true;

  function reset() {
    setStepIndex(0);
    setDraft(EMPTY);
  }

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  }

  async function submit() {
    const goal = await createGoal.mutateAsync({ ...draft, title: draft.title.trim() });
    close(false);
    void navigate({ to: "/app/goals/$goalId", params: { goalId: goal.id } });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">New goal</DialogTitle>
          <DialogDescription>
            Five questions. About two minutes. This becomes the context your coach works from.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex gap-1.5" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i <= stepIndex ? "surface-gradient" : "bg-muted",
              )}
            />
          ))}
        </div>

        <div className="relative min-h-[220px] pt-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="space-y-4"
            >
              <div>
                <h3 className="font-display text-xl font-semibold">{step.question}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.hint}</p>
              </div>

              {step.key === "title" && (
                <Input
                  autoFocus
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder={step.placeholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canAdvance) setStepIndex(1);
                  }}
                />
              )}

              {(step.key === "why" || step.key === "feeling" || step.key === "obstacles") && (
                <Textarea
                  autoFocus
                  rows={4}
                  value={draft[step.key]}
                  onChange={(e) => setDraft({ ...draft, [step.key]: e.target.value })}
                  placeholder={step.placeholder}
                  className="resize-none"
                />
              )}

              {step.key === "target_date" && (
                <div className="space-y-4">
                  <Input
                    autoFocus
                    type="date"
                    value={draft.target_date ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, target_date: e.target.value || null })
                    }
                  />
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Category</p>
                    <div className="flex flex-wrap gap-2">
                      {GOAL_CATEGORIES.map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setDraft({ ...draft, category })}
                          className={cn(
                            "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                            draft.category === category
                              ? "border-transparent surface-gradient text-primary-foreground"
                              : "border-border text-muted-foreground hover:bg-accent/50",
                          )}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setStepIndex((i) => i - 1)}
            disabled={stepIndex === 0 || createGoal.isPending}
          >
            <ArrowLeft /> Back
          </Button>

          <span className="text-xs text-muted-foreground">
            {stepIndex + 1} of {STEPS.length}
          </span>

          {isLast ? (
            <Button variant="hero" onClick={submit} disabled={createGoal.isPending}>
              {createGoal.isPending ? <Loader2 className="animate-spin" /> : <Check />}
              Create goal
            </Button>
          ) : (
            <Button variant="hero" onClick={() => setStepIndex((i) => i + 1)} disabled={!canAdvance}>
              Continue <ArrowRight />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
