import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  Flame,
  LineChart,
  Sparkles,
  Sun,
  MessageCircleHeart,
} from "lucide-react";

import { AuroraBackground } from "@/components/aurora-background";
import { PageTransition, Reveal } from "@/components/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ManifestAI — Turn your intentions into daily actions" },
      {
        name: "description",
        content:
          "Daily AI coaching, guided journaling, personal affirmations and habit tracking in one calm practice. Build the routines behind the goals that matter.",
      },
      { property: "og:title", content: "ManifestAI — Turn your intentions into daily actions" },
      {
        property: "og:description",
        content:
          "Daily AI coaching, guided journaling, personal affirmations and habit tracking in one calm practice.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: MessageCircleHeart,
    title: "Daily AI coach",
    body: "A conversation each morning that turns a vague intention into the one action you can actually take today.",
  },
  {
    icon: Sun,
    title: "Personal affirmations",
    body: "Self-affirmation you write with help — grounded in your own values and goals, not generic mantras.",
  },
  {
    icon: BookOpen,
    title: "Guided journaling",
    body: "Evidence-informed prompts for reflection, gratitude and mood tracking that take three minutes.",
  },
  {
    icon: Flame,
    title: "Habit streaks",
    body: "Small, weekly-target habits with gentle streaks. Consistency over intensity, missed days included.",
  },
  {
    icon: LineChart,
    title: "Progress you can see",
    body: "Goal milestones, check-in trends and energy over time — so change is visible before it feels obvious.",
  },
];

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    blurb: "Start the daily practice.",
    perks: ["3 active goals", "Daily check-in & journal", "5 habits", "Limited AI coaching"],
    cta: "Start Free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "per month",
    blurb: "The full coaching loop.",
    perks: [
      "Unlimited goals & habits",
      "Unlimited AI coach sessions",
      "Personalized affirmations",
      "Progress insights & exports",
    ],
    cta: "Start Free trial",
    featured: true,
  },
  {
    name: "Lifetime",
    price: "$149",
    period: "one time",
    blurb: "Pay once, keep going.",
    perks: ["Everything in Pro", "All future features", "Priority support", "No renewals"],
    cta: "Get Lifetime",
    featured: false,
  },
];

function Landing() {
  return (
    <PageTransition>
      <div className="relative min-h-screen overflow-hidden bg-background">
        <AuroraBackground />

        <div className="relative">
          <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl surface-gradient shadow-glow">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight">ManifestAI</span>
            </Link>
            <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
              <a href="#features" className="transition-colors hover:text-foreground">
                Features
              </a>
              <a href="#pricing" className="transition-colors hover:text-foreground">
                Pricing
              </a>
            </nav>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button asChild variant="glass" className="hidden sm:inline-flex">
                <Link to="/auth">Log in</Link>
              </Button>
              <Button asChild variant="hero">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Start Free
                </Link>
              </Button>
            </div>
          </header>

          {/* Hero */}
          <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full glass-panel px-4 py-1.5 text-xs font-medium text-muted-foreground"
              >
                <Sparkles className="h-3.5 w-3.5 text-ember" />
                Habit science + positive psychology, guided by AI
              </motion.span>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="mt-7 text-balance text-5xl font-semibold leading-[1.05] md:text-7xl"
              >
                Become the person who{" "}
                <span className="text-gradient">achieves your goals.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground"
              >
                ManifestAI turns your intentions into daily actions — with an AI coach, affirmations
                grounded in your own values, guided journaling and habit tracking that keeps you
                moving on ordinary days.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
              >
                <Button asChild variant="hero" size="xl">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Start Free <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="glass" size="xl">
                  <a href="#features">See how it works</a>
                </Button>
              </motion.div>

              <p className="mt-5 text-xs text-muted-foreground">
                No credit card required. ManifestAI supports your effort — it doesn't promise
                outcomes.
              </p>
            </div>

            {/* Product preview */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto mt-20 max-w-4xl"
            >
              <div className="absolute inset-x-10 -top-6 h-32 rounded-full bg-violet/25 blur-3xl" />
              <div className="relative rounded-3xl glass-panel p-3 shadow-lift">
                <div className="rounded-2xl border border-glass-border bg-card/60 p-6 md:p-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Today
                      </p>
                      <h3 className="mt-1 text-2xl font-semibold">Good morning, Maya</h3>
                    </div>
                    <span className="rounded-full bg-ember/15 px-3 py-1 text-xs font-medium text-ember">
                      12-day streak
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {[
                      { label: "Focus", value: "Draft chapter 3", sub: "Goal · Finish the book" },
                      { label: "Habits", value: "3 of 4 done", sub: "Move · Read · Meditate" },
                      { label: "Energy", value: "4 / 5", sub: "Up from last week" },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="rounded-2xl border border-glass-border bg-background/40 p-4"
                      >
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                        <p className="mt-2 font-display text-base font-semibold">{card.value}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl surface-gradient p-[1px]">
                    <div className="rounded-2xl bg-card/85 p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Coach
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                        "You've written four mornings in a row. What's the smallest version of
                        today's session that would still count as a win?"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* Features */}
          <section id="features" className="mx-auto max-w-6xl px-6 py-24">
            <Reveal className="max-w-2xl">
              <h2 className="text-4xl font-semibold md:text-5xl">
                One calm practice, five moving parts.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Built on what actually drives behaviour change: clear intentions, small repeatable
                actions, honest reflection and visible progress.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => (
                <Reveal key={feature.title} delay={i * 0.06}>
                  <article className="group h-full rounded-3xl glass-panel p-7 transition-transform duration-500 hover:-translate-y-1">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl surface-gradient shadow-glow">
                      <feature.icon className="h-5 w-5 text-primary-foreground" />
                    </span>
                    <h3 className="mt-5 text-xl font-semibold">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {feature.body}
                    </p>
                  </article>
                </Reveal>
              ))}
              <Reveal delay={0.3}>
                <article className="flex h-full flex-col justify-between rounded-3xl surface-gradient p-7 text-primary-foreground shadow-lift">
                  <div>
                    <h3 className="text-xl font-semibold">Start tomorrow morning</h3>
                    <p className="mt-3 text-sm leading-relaxed opacity-90">
                      Set one goal tonight and get your first coaching check-in at sunrise.
                    </p>
                  </div>
                  <Button asChild variant="glass" className="mt-6 w-fit">
                    <Link to="/auth" search={{ mode: "signup" }}>
                      Start Free <ArrowRight />
                    </Link>
                  </Button>
                </article>
              </Reveal>
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-4xl font-semibold md:text-5xl">Simple, honest pricing</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Start free for as long as you like. Upgrade when the practice sticks.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {tiers.map((tier, i) => (
                <Reveal key={tier.name} delay={i * 0.08}>
                  <div
                    className={
                      tier.featured
                        ? "relative h-full rounded-3xl surface-gradient p-[1.5px] shadow-lift"
                        : "h-full"
                    }
                  >
                    <div
                      className={
                        tier.featured
                          ? "flex h-full flex-col rounded-3xl bg-card/90 p-8 backdrop-blur-xl"
                          : "flex h-full flex-col rounded-3xl glass-panel p-8"
                      }
                    >
                      {tier.featured && (
                        <span className="mb-4 w-fit rounded-full bg-ember/15 px-3 py-1 text-xs font-medium text-ember">
                          Most popular
                        </span>
                      )}
                      <h3 className="text-lg font-semibold">{tier.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{tier.blurb}</p>
                      <div className="mt-6 flex items-baseline gap-2">
                        <span className="font-display text-5xl font-semibold">{tier.price}</span>
                        <span className="text-sm text-muted-foreground">{tier.period}</span>
                      </div>
                      <ul className="mt-7 space-y-3 text-sm">
                        {tier.perks.map((perk) => (
                          <li key={perk} className="flex items-start gap-3">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span className="text-muted-foreground">{perk}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        asChild
                        variant={tier.featured ? "hero" : "glass"}
                        size="lg"
                        className="mt-8 w-full"
                      >
                        <Link to="/auth" search={{ mode: "signup" }}>
                          {tier.cta}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-glass-border">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg surface-gradient">
                    <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                  </span>
                  <span className="font-display font-semibold">ManifestAI</span>
                </div>
                <p className="mt-3 max-w-md text-xs leading-relaxed text-muted-foreground">
                  ManifestAI is a personal development tool built on habit formation and positive
                  psychology research. It is not therapy, medical advice, or a guarantee of results.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
                <a href="#features" className="hover:text-foreground">
                  Features
                </a>
                <a href="#pricing" className="hover:text-foreground">
                  Pricing
                </a>
                <Link to="/auth" className="hover:text-foreground">
                  Log in
                </Link>
              </div>
            </div>
            <div className="border-t border-glass-border py-5 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} ManifestAI. Turn your intentions into daily actions.
            </div>
          </footer>
        </div>
      </div>
    </PageTransition>
  );
}
