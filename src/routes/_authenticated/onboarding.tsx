import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { AuroraBackground } from "@/components/aurora-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AFFIRMATION_CATEGORIES } from "@/features/affirmations/affirmation-library";
import type { OnboardingAnswers } from "@/features/onboarding/personalize";
import { useCompleteOnboarding } from "@/features/onboarding/use-profile";
import {
  PRACTICE_LENGTHS,
  PRACTICE_STYLES,
  PRACTICE_TIMES,
} from "@/features/practice/practice-plan";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — ManifestAI" }] }),
  component: Onboarding,
});

const TONES = [
  { id: "warm", label: "Warm", hint: "Gentle and encouraging" },
  { id: "direct", label: "Direct", hint: "Plain, no softening" },
  { id: "calm", label: "Calm", hint: "Steady and unhurried" },
] as const;

/**
 * Nine questions now, not six.
 *
 * The three added ones — style, length, time — exist because the daily
 * practice is assembled from them. Without them everyone gets the same
 * five-minute session with all seven steps, which is exactly the generic
 * experience the app is meant to avoid.
 *
 * They sit after the personal questions on purpose. Asking "how long do you
 * have?" before someone has told you what they want makes the app feel like a
 * settings screen; asking it afterwards makes it feel like it's being fitted
 * to them.
 */
const STEPS = [
  "name",
  "focus",
  "desire",
  "feeling",
  "obstacle",
  "tone",
  "style",
  "length",
  "time",
] as const;

function Onboarding() {
  const navigate = useNavigate();
  const complete = useCompleteOnboarding();

  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    displayName: "",
    focusAreas: [],
    desires: "",
    obstacles: "",
    desiredFeeling: "",
    tone: "warm",
    practiceMinutes: 5,
    practiceStyles: [],
    practiceTimeOfDay: "morning",
  });

  const step = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;

  // Only name and the desire are load-bearing. Everything else can be skipped —
  // forcing reflection just teaches people to type filler.
  const canAdvance =
    step === "name"
      ? answers.displayName.trim().length > 0
      : step === "focus"
        ? answers.focusAreas.length > 0
        : step === "desire"
          ? answers.desires.trim().length > 0
          : true;

  function toggleStyle(id: string) {
    setAnswers((a) => ({
      ...a,
      practiceStyles: a.practiceStyles.includes(id)
        ? a.practiceStyles.filter((x) => x !== id)
        : [...a.practiceStyles, id],
    }));
  }

  function toggleFocus(id: string) {
    setAnswers((a) => ({
      ...a,
      focusAreas: a.focusAreas.includes(id)
        ? a.focusAreas.filter((x) => x !== id)
        : [...a.focusAreas, id],
    }));
  }

  async function finish() {
    await complete.mutateAsync(answers);
    void navigate({ to: "/app" });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-12">
      <AuroraBackground />

      <div className="relative w-full max-w-lg">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl surface-gradient shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="font-display text-lg font-semibold">ManifestAI</span>
        </div>

        <div
          className="mb-8 flex gap-1.5"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
        >
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i <= stepIndex ? "surface-gradient" : "bg-muted",
              )}
            />
          ))}
        </div>

        <div className="relative min-h-[300px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="space-y-5"
            >
              {step === "name" && (
                <>
                  <Heading
                    title="First — what should I call you?"
                    hint="Your affirmations will use your name, so it's worth getting right."
                  />
                  <Input
                    autoFocus
                    value={answers.displayName}
                    onChange={(e) => setAnswers({ ...answers, displayName: e.target.value })}
                    placeholder="Your first name"
                    onKeyDown={(e) => e.key === "Enter" && canAdvance && setStepIndex(1)}
                  />
                </>
              )}

              {step === "focus" && (
                <>
                  <Heading
                    title="What matters most right now?"
                    hint="Pick as many as apply. This decides which affirmations you see."
                  />
                  <div className="flex flex-wrap gap-2">
                    {AFFIRMATION_CATEGORIES.map((category) => {
                      const selected = answers.focusAreas.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => toggleFocus(category.id)}
                          aria-pressed={selected}
                          className={cn(
                            "rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors",
                            selected
                              ? "border-transparent surface-gradient text-primary-foreground shadow-glow"
                              : "border-border text-muted-foreground hover:bg-accent/50",
                          )}
                        >
                          <span className="mr-1.5">{category.emoji}</span>
                          {category.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {step === "desire" && (
                <>
                  <Heading
                    title="What do you want?"
                    hint="One thing. Specific enough that you'd know when you had it."
                  />
                  <Textarea
                    autoFocus
                    rows={3}
                    value={answers.desires}
                    onChange={(e) => setAnswers({ ...answers, desires: e.target.value })}
                    placeholder="A remote job that pays well and leaves me time to write"
                    className="resize-none"
                  />
                </>
              )}

              {step === "feeling" && (
                <>
                  <Heading
                    title="How do you want it to feel?"
                    hint="Naming the feeling makes the daily visualization concrete instead of vague."
                  />
                  <Textarea
                    autoFocus
                    rows={3}
                    value={answers.desiredFeeling}
                    onChange={(e) => setAnswers({ ...answers, desiredFeeling: e.target.value })}
                    placeholder="Settled. Like I finally have room to breathe."
                    className="resize-none"
                  />
                </>
              )}

              {step === "obstacle" && (
                <>
                  <Heading
                    title="What tends to get in the way?"
                    hint="Naming it now means your affirmations can speak to it directly."
                  />
                  <Textarea
                    autoFocus
                    rows={3}
                    value={answers.obstacles}
                    onChange={(e) => setAnswers({ ...answers, obstacles: e.target.value })}
                    placeholder="I lose momentum after about two weeks."
                    className="resize-none"
                  />
                </>
              )}

              {step === "tone" && (
                <>
                  <Heading
                    title="How should it speak to you?"
                    hint="Some people want encouragement. Some want it straight."
                  />
                  <div className="grid gap-2">
                    {TONES.map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => setAnswers({ ...answers, tone: tone.id })}
                        aria-pressed={answers.tone === tone.id}
                        className={cn(
                          "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
                          answers.tone === tone.id
                            ? "border-transparent surface-gradient text-primary-foreground"
                            : "border-border hover:bg-accent/50",
                        )}
                      >
                        <span>
                          <span className="block text-sm font-medium">{tone.label}</span>
                          <span
                            className={cn(
                              "block text-xs",
                              answers.tone === tone.id
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground",
                            )}
                          >
                            {tone.hint}
                          </span>
                        </span>
                        {answers.tone === tone.id && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === "style" && (
                <>
                  <Heading
                    title="How do you like to practise?"
                    hint="Pick as many as you like. This decides what your daily session is made of."
                  />
                  <div className="flex flex-wrap gap-2">
                    {PRACTICE_STYLES.map((style) => {
                      const selected = answers.practiceStyles.includes(style.id);
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => toggleStyle(style.id)}
                          aria-pressed={selected}
                          className={cn(
                            "rounded-full border px-4 py-2 text-sm transition-colors",
                            selected
                              ? "border-transparent surface-gradient text-primary-foreground"
                              : "border-border hover:bg-accent/50",
                          )}
                        >
                          {style.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Skip this and you&rsquo;ll get a bit of everything.
                  </p>
                </>
              )}

              {step === "length" && (
                <>
                  <Heading
                    title="How long do you have each day?"
                    hint="Be honest rather than ambitious. A practice you actually do beats one you plan."
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {PRACTICE_LENGTHS.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => setAnswers({ ...answers, practiceMinutes: minutes })}
                        aria-pressed={answers.practiceMinutes === minutes}
                        className={cn(
                          "rounded-2xl border px-4 py-4 text-center transition-colors",
                          answers.practiceMinutes === minutes
                            ? "border-transparent surface-gradient text-primary-foreground"
                            : "border-border hover:bg-accent/50",
                        )}
                      >
                        <span className="block font-display text-xl">{minutes}</span>
                        <span className="block text-xs opacity-80">
                          {minutes === 15 ? "minutes or more" : "minutes"}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === "time" && (
                <>
                  <Heading
                    title="When would you like it?"
                    hint="Your reminder follows this, so it arrives when you're actually free."
                  />
                  <div className="grid gap-2">
                    {PRACTICE_TIMES.map((time) => (
                      <button
                        key={time.id}
                        type="button"
                        onClick={() => setAnswers({ ...answers, practiceTimeOfDay: time.id })}
                        aria-pressed={answers.practiceTimeOfDay === time.id}
                        className={cn(
                          "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
                          answers.practiceTimeOfDay === time.id
                            ? "border-transparent surface-gradient text-primary-foreground"
                            : "border-border hover:bg-accent/50",
                        )}
                      >
                        <span className="text-sm font-medium">{time.label}</span>
                        {answers.practiceTimeOfDay === time.id && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setStepIndex((i) => i - 1)}
            disabled={stepIndex === 0 || complete.isPending}
          >
            <ArrowLeft /> Back
          </Button>

          <span className="text-xs text-muted-foreground">
            {stepIndex + 1} of {STEPS.length}
          </span>

          {isLast ? (
            <Button variant="hero" onClick={finish} disabled={complete.isPending}>
              {complete.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Create my affirmations
            </Button>
          ) : (
            <Button
              variant="hero"
              onClick={() => setStepIndex((i) => i + 1)}
              disabled={!canAdvance}
            >
              Continue <ArrowRight />
            </Button>
          )}
        </div>

        {!isLast && !canAdvance && step !== "name" && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {step === "focus" ? "Pick at least one." : "This one shapes everything else."}
          </p>
        )}
      </div>
    </div>
  );
}

function Heading({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold leading-snug md:text-3xl">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}
