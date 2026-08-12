import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/page-transition";
import { useTodaysActions, useToggleAction } from "@/features/actions/use-actions";
import { useDailyAffirmation } from "@/features/affirmations/use-affirmations";
import { desirePhraseOr } from "@/features/moments/desire-phrase";
import { useCreateEntry } from "@/features/journal/use-journal";
import { useProfile } from "@/features/onboarding/use-profile";
import { useDesires } from "@/features/stories/use-stories";
import { ambientPad, unlockAudioSession } from "@/lib/ambient-audio";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

import { BreathingCircle } from "@/features/practice/breathing-circle";
import { usePracticePlan, useRecordPractice } from "@/features/practice/use-practice";
import type { StepId } from "@/features/practice/practice-plan";

export const Route = createFileRoute("/_authenticated/app/practice")({
  head: () => ({ meta: [{ title: "Practice — ManifestAI" }] }),
  component: Practice,
});

/**
 * The daily practice.
 *
 * Structurally this is a wizard, but it deliberately doesn't feel like one:
 * no progress percentage, no "step 3 of 7", no back button competing for
 * attention. A form makes you aware you're filling something in, which is the
 * opposite of what a settling exercise wants. There's a thin bar at the top
 * and that's it.
 *
 * Each step advances on its own timer *or* when the person taps — whichever
 * comes first. Timed-only would trap someone who's ready to move on; tap-only
 * would let them rush a two-minute visualisation in nine seconds and feel like
 * they'd done it. Having both means the pacing is a suggestion.
 *
 * Nothing is saved until the end, except the journal entry and the action tick,
 * which are the two things a person would be annoyed to lose.
 */
function Practice() {
  const navigate = useNavigate();
  const plan = usePracticePlan();
  const { data: profile } = useProfile();
  const { data: desires } = useDesires();
  const { data: actions } = useTodaysActions();
  const dailyAffirmation = useDailyAffirmation();
  const record = useRecordPractice();
  const toggleAction = useToggleAction();
  const createEntry = useCreateEntry();

  const [index, setIndex] = useState(0);
  const [journalText, setJournalText] = useState("");
  const [gratitude, setGratitude] = useState(["", "", ""]);
  const startedAt = useRef(Date.now());

  const step = plan.steps[index];
  const isLast = index === plan.steps.length - 1;

  // The desire this session is about. The first active one, which is also the
  // one the home feed leads with, so the two agree.
  const desire = desires?.[0] ?? null;
  const action = actions?.find((a) => a.desire_id === desire?.id) ?? actions?.[0] ?? null;
  const affirmation = dailyAffirmation?.text ?? null;

  const intention = useMemo(() => {
    if (!desire) return "I'm allowed to want what I want, and to work toward it.";
    const phrase = desirePhraseOr(desire.title);
    return `I am becoming the kind of person for whom ${phrase} is ordinary.`;
  }, [desire]);

  // A quiet pad under the whole session. Started on the first user gesture, on
  // purpose — creating the audio context any later produces silence on iOS.
  useEffect(() => {
    unlockAudioSession();
    ambientPad().start(0.1);
    return () => ambientPad().stop();
  }, []);

  // Auto-advance. Cleared and rebuilt per step so tapping ahead doesn't leave
  // an old timer running that skips the next one early.
  //
  // Never on the last step. The final screen is the action — the one thing
  // being asked of the person — and having it finish itself while they're
  // deciding whether to commit would be the app answering its own question.
  // It also fired `finish()` from a timer, meaning a session could end and
  // navigate away while someone was mid-tap.
  useEffect(() => {
    if (!step || isLast) return;
    const id = window.setTimeout(() => advance(), step.seconds * 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isLast]);

  function advance() {
    haptic();
    if (!isLast) {
      setIndex((n) => n + 1);
      return;
    }
    finish();
  }

  function finish() {
    // Save the writing before anything else — losing what someone typed is the
    // one failure here that would actually matter to them.
    const written = journalText.trim();
    const thanks = gratitude.filter((line) => line.trim()).join("\n");
    if (written || thanks) {
      createEntry.mutate({
        content: [written, thanks].filter(Boolean).join("\n\n"),
        prompt: "Daily practice",
        mood: null,
      });
    }

    record.mutate(
      {
        steps: plan.steps.map((s) => s.id),
        seconds: (Date.now() - startedAt.current) / 1000,
        desireId: desire?.id ?? null,
      },
      { onSettled: () => navigate({ to: "/app/practice/done" }) },
    );
  }

  if (!step) {
    return (
      <PageTransition>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="relative min-h-[80vh]">
        {/* Progress, and a way out. Both deliberately faint. */}
        <div className="flex items-center gap-3">
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full surface-gradient"
              initial={false}
              animate={{ width: `${((index + 1) / plan.steps.length) * 100}%` }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/app" })}
            aria-label="Leave the practice"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12"
          >
            <p className="eyebrow text-center">{step.label}</p>

            {step.id === "breathe" && (
              <div className="mt-10">
                <BreathingCircle seconds={step.seconds} />
              </div>
            )}

            {step.id === "intention" && (
              <p className="mx-auto mt-10 max-w-md text-balance text-center font-display text-[26px] italic leading-[1.35]">
                {intention}
              </p>
            )}

            {step.id === "affirmation" && (
              <p className="mx-auto mt-10 max-w-md text-balance text-center font-display text-[24px] italic leading-[1.4]">
                {affirmation ??
                  "I can do the next small thing, even when I can't do the whole thing."}
              </p>
            )}

            {step.id === "visualize" && (
              <div className="mx-auto mt-10 max-w-md space-y-5 text-center text-[15px] leading-relaxed text-muted-foreground">
                <p>Let your eyes close, if that's comfortable.</p>
                <p>
                  Picture an ordinary moment — months from now — where{" "}
                  {desire ? desirePhraseOr(desire.title) : "this"} is simply part of your life.
                </p>
                <p>Not the celebration. A Tuesday.</p>
                <p>What do you notice first?</p>
              </div>
            )}

            {step.id === "journal" && (
              <div className="mt-8">
                <p className="text-center text-sm text-muted-foreground">
                  Write as though it's already becoming true.
                </p>
                <textarea
                  value={journalText}
                  onChange={(e) => setJournalText(e.target.value)}
                  rows={7}
                  autoFocus
                  placeholder="Today I noticed…"
                  className="mt-4 w-full resize-none rounded-3xl border border-glass-border bg-card/50 p-5 text-[15px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            )}

            {step.id === "gratitude" && (
              <div className="mt-8">
                <p className="text-center text-sm text-muted-foreground">
                  Three things. Small ones count.
                </p>
                <div className="mt-4 space-y-3">
                  {gratitude.map((value, i) => (
                    <input
                      key={i}
                      value={value}
                      onChange={(e) =>
                        setGratitude((rows) => rows.map((r, j) => (j === i ? e.target.value : r)))
                      }
                      placeholder={`${i + 1}.`}
                      className="w-full rounded-full border border-glass-border bg-card/50 px-5 py-3 text-[15px] focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  ))}
                </div>
              </div>
            )}

            {step.id === "action" && (
              <div className="mt-8">
                <p className="text-center text-sm text-muted-foreground">
                  One thing you can actually do today.
                </p>
                <div className="mt-5 rounded-[28px] border border-glass-border bg-card/70 p-6">
                  <p className="text-pretty text-[16px] leading-relaxed">
                    {action?.body ??
                      "Write down the very next physical step toward this. Not the plan — the step."}
                  </p>
                  {action && (
                    <button
                      type="button"
                      onClick={() => toggleAction.mutate({ id: action.id, done: true })}
                      disabled={Boolean(action.completed_at)}
                      className={cn(
                        "mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        action.completed_at
                          ? "text-muted-foreground"
                          : "surface-gradient text-primary-foreground shadow-glow",
                      )}
                    >
                      <Check className="h-4 w-4" />
                      {action.completed_at ? "Already done" : "I'll do this today"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-12 flex flex-col items-center gap-3">
          <Button
            variant="hero"
            size="lg"
            className="w-full max-w-sm rounded-full"
            onClick={advance}
            disabled={record.isPending}
          >
            {record.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {isLast ? "Finish" : "Continue"} <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
          {!isLast && (
            <p className="text-xs text-muted-foreground">
              {profile?.practice_minutes ?? 5} minute practice
            </p>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
