import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { getAuthSession } from "@/lib/auth-session";
import { motion } from "framer-motion";
import {
  ArrowRight,
  AudioLines,
  Check,
  Headphones,
  MessageCircleHeart,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";

import { AuroraBackground } from "@/components/aurora-background";
import { PageTransition, Reveal } from "@/components/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  FREE_LIMITS,
  NARRATION_ALLOWANCE,
  STANDARD_FEATURES,
  VOICE_FEATURES,
  planById,
} from "@/features/billing/plans";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Signing in with Google or Apple returns you to the site root, and this
    // page had no idea you were signed in — so you landed back on "Start free /
    // Log in" having just logged in. Anyone with a session belongs in the app.
    if (typeof window === "undefined") return;
    const session = await getAuthSession();
    if (session) throw redirect({ to: "/app" });
  },
  head: () => ({
    meta: [
      { title: "ManifestAI — Guided manifestation, in a voice you'll want to hear" },
      {
        name: "description",
        content:
          "Tell it what you want. Get manifestation stories written for that desire, narrated in a real human voice, plus affirmations, sleep sessions, meditations and healing frequencies.",
      },
      {
        property: "og:title",
        content: "ManifestAI — Guided manifestation, in a voice you'll want to hear",
      },
      {
        property: "og:description",
        content:
          "Manifestation stories written for your desire and narrated in a real human voice, plus sleep sessions, meditations and healing frequencies.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Sparkles,
    title: "Stories written for your desire",
    body: "Type what you actually want — in your own words — and get short manifestation stories written for that, not a library of generic ones.",
  },
  {
    icon: Headphones,
    title: "A real human voice",
    body: "Studio narration, not your phone's robot reader. It's the difference between listening to a session and enduring one.",
  },
  {
    icon: Sun,
    title: "Affirmations in your own words",
    body: "Built from the desires you wrote and the way you phrased them, so they sound like you rather than a poster.",
  },
  {
    icon: Moon,
    title: "Sleep, meditations, frequencies",
    body: "Full-length sessions that run for the time they promise, over a continuous bed of sound. An 18-minute track is 18 minutes.",
  },
  {
    icon: MessageCircleHeart,
    title: "A coach that remembers",
    body: "It already knows what you're working towards, so you never start a conversation by explaining yourself again.",
  },
];

/**
 * Pricing is read from the billing module rather than written out again here.
 *
 * The old landing page had its own hardcoded tiers — $12 a month and a $149
 * lifetime — while the actual paywall charged $8.99 and $129.99. Anyone who
 * signed up saw a different price to the one that sold them. Deriving it means
 * that can't happen twice.
 */
const standardYearly = planById("standard_yearly");
const voiceYearly = planById("voice_yearly");

/**
 * Three columns, one per tier, each showing its yearly price.
 *
 * It used to render every plan as its own column, which meant five near
 * identical cards listing the same four perks — so the page answered "how often
 * do I pay" and never answered "what do I get". The choice that actually
 * matters is whether you want the voice, and that's the one the page now makes.
 */
const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    blurb: "Enough to see whether this is for you.",
    perks: [
      `${FREE_LIMITS.storiesPerRefresh} stories per refresh`,
      `${FREE_LIMITS.coachMessagesPerDay} coach messages a day`,
      "The whole library to read",
      `One narrated sleep track, so you can hear the voice`,
    ],
    cta: "Start free",
    featured: false,
    badge: null as string | null,
  },
  {
    name: "Standard",
    price: standardYearly?.priceDisplay ?? "$29.99",
    period: standardYearly?.cadence ?? "per year",
    blurb: "Everything written, with no limits. You do the reading.",
    perks: [...STANDARD_FEATURES].slice(0, 4),
    cta: "Get Standard",
    featured: false,
    badge: standardYearly?.highlight ?? null,
  },
  {
    name: "Voice",
    price: voiceYearly?.priceDisplay ?? "$99.99",
    period: voiceYearly?.cadence ?? "per year",
    blurb: "Everything in Standard, read aloud in a real human voice.",
    perks: [...VOICE_FEATURES],
    cta: "Get Voice",
    featured: true,
    badge: voiceYearly?.highlight ?? null,
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
              {/* Was `hidden sm:inline-flex` — so on a phone, which is where
                  almost everyone arrives, there was no way to log in at all.
                  An existing user had to guess the /auth URL. */}
              <Button asChild variant="glass">
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
                Written for your desire. Narrated in a real voice.
              </motion.span>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="mt-7 text-balance text-5xl font-semibold leading-[1.05] md:text-7xl"
              >
                Say what you want. <span className="text-gradient">Hear it back.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground"
              >
                Type the thing you actually want — a calmer mind, your own apartment, being deeply
                loved — and ManifestAI writes short manifestation stories for it, narrated in a real
                human voice. Plus affirmations in your own words, sleep sessions, meditations and
                healing frequencies.
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
                        Manifesting
                      </p>
                      <h3 className="mt-1 text-2xl font-semibold">A calmer mind</h3>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/15 px-3 py-1 text-xs font-medium text-ember">
                      <AudioLines className="h-3.5 w-3.5" />
                      Sarah
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {[
                      {
                        label: "For you today",
                        value: "The Quiet Morning",
                        sub: "Story · 4 min",
                      },
                      { label: "Tonight", value: "Falling Softly", sub: "Sleep · 18 min" },
                      { label: "Frequency", value: "528 Hz", sub: "Healing · 30 min" },
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
                        Your affirmation
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                        "I am allowed to move slowly. The quiet I'm looking for is already somewhere
                        in this day, and I know how to find it."
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
                Everything is written for what you asked for.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Most manifestation apps hand you the same library as everyone else. This one starts
                from the sentence you typed and builds outward from it.
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
                    <h3 className="text-xl font-semibold">Start tonight</h3>
                    <p className="mt-3 text-sm leading-relaxed opacity-90">
                      Write one desire and your first stories are ready before you finish typing.
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

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                      {tier.badge && (
                        <span className="mb-4 w-fit rounded-full bg-ember/15 px-3 py-1 text-xs font-medium text-ember">
                          {tier.badge}
                        </span>
                      )}
                      <h3 className="text-lg font-semibold">{tier.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{tier.blurb}</p>
                      <div className="mt-6 flex items-baseline gap-2">
                        <span className="font-display text-4xl font-semibold">{tier.price}</span>
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
                  ManifestAI is a personal development tool for reflection and visualisation. It is
                  not therapy, medical advice, or a guarantee of results.
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
              © {new Date().getFullYear()} ManifestAI. Say what you want. Hear it back.
            </div>
          </footer>
        </div>
      </div>
    </PageTransition>
  );
}
