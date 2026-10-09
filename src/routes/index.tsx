import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { getAuthSession } from "@/lib/auth-session";
import { motion } from "framer-motion";
import {
  ArrowRight,
  AudioLines,
  CalendarCheck,
  Check,
  Flame,
  Headphones,
  Images,
  MessageCircleHeart,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";

import { AuroraBackground } from "@/components/aurora-background";
import { PageTransition, Reveal } from "@/components/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { FREE_LIMITS, STANDARD_FEATURES, VOICE_FEATURES, planById } from "@/features/billing/plans";

/**
 * The Play Store listing, which is live and public.
 *
 * It was absent from this page entirely, which cost twice: Android visitors
 * had no way to install the thing they were reading about, and the page threw
 * away its only externally verifiable trust signal. Every app competitor
 * reviewed — ThinkUp, I Am, Day One, Gratitude, Calm, The Pattern — leads with
 * store badges, because "this exists in a store that vetted it" is a claim you
 * cannot make about yourself in prose.
 */
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.manifestai888.app";

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
      // Title and description led with narration, which is the top paid tier.
      // The search result was therefore advertising the thing a new free
      // account does not get. Both now lead with the daily practice.
      { title: "ManifestAI — Say it once, then five minutes a day" },
      {
        name: "description",
        content:
          "Write the thing you actually want in one sentence. ManifestAI builds the stories, affirmations and a five-minute daily practice from it — and every day ends with one small thing to do. Free to start.",
      },
      {
        property: "og:title",
        content: "ManifestAI — Say it once, then five minutes a day",
      },
      {
        property: "og:description",
        content:
          "One sentence in, and the stories, affirmations and daily practice are written from it. Every day ends with something to do. Free to start, no card.",
      },
    ],
  }),
  component: Landing,
});

/**
 * Feature list, reordered so the DAILY PRACTICE comes first.
 *
 * It used to lead with stories and studio narration. Both are real, but
 * narration is the top paid tier, so the first thing a stranger read about was
 * the thing they were least likely to get — and the five-minute practice at
 * /app/practice, which is the actual retention loop and is free, went
 * unmentioned on the whole page.
 *
 * Every competitor reviewed sells a daily ritual rather than a content
 * library: Calm's dailies, Mindvalley's 20-minute lessons, To Be Magnetic's
 * "20-30 minutes a few times a week", Gratitude's daily entry. The product
 * already has one. The page simply never said so.
 *
 * Every entry below is checked against a real screen in
 * src/routes/_authenticated — nothing here is aspirational.
 */
const features = [
  {
    icon: CalendarCheck,
    title: "A five-minute practice, daily",
    body: "Breathe, read your intention, then one small thing to do today. It ends with an action, which is the part a library of audio can't do.",
  },
  {
    icon: Sparkles,
    title: "Stories written for your desire",
    body: "Type what you actually want — in your own words — and get short manifestation stories written for that, not a library of generic ones.",
  },
  {
    icon: Sun,
    title: "Affirmations in your own words",
    body: "Built from the desires you wrote and the way you phrased them, so they sound like you rather than a poster.",
  },
  {
    icon: Images,
    title: "Vision board, journal, gratitude",
    body: "Your scripted lines and images in the place you actually look, plus a journal and gratitude log that keep what you wrote.",
  },
  {
    icon: Flame,
    title: "Streaks and a weekly view",
    body: "An honest count of the days you turned up — not a target you're failing. Day 30 starts from something instead of a blank page.",
  },
  {
    icon: Headphones,
    title: "A real human voice",
    body: "Studio narration on the Voice plan, not your phone's robot reader. Everything written works read, if you'd rather not pay for it.",
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
 * Three steps, because the page never explained what actually happens.
 *
 * A visitor's real question before signing up is "what am I going to be asked
 * to do", and every competitor answers it explicitly — To Be Magnetic has a
 * numbered "Start Your Transformation in 3 Steps", Calm has "where should I
 * get started". This page jumped from headline straight to a feature grid.
 */
const steps = [
  {
    n: "01",
    title: "Say what you actually want",
    body: "One sentence, in your own words. Not the polished version — the real one. Everything else is built from it.",
  },
  {
    n: "02",
    title: "Read what it writes back",
    body: "An ordinary afternoon in a life where it's already true, affirmations phrased the way you phrase things, and one line to carry around today.",
  },
  {
    n: "03",
    title: "Do the five minutes",
    body: "Breathe, read, act. The practice ends with one small thing to do before bed, and the streak counts the days you turned up.",
  },
];

/**
 * FAQ — the single biggest gap on the old page, which had no objection
 * handling of any kind.
 *
 * Every competitor reviewed carries one, and the serious ones answer the
 * uncomfortable questions rather than the flattering ones: Calm publishes its
 * cancellation steps, To Be Magnetic publishes a cancellation fee and a
 * final-sale policy. Answering "how do I cancel" on the page that asks for the
 * signup is a trust signal precisely because most pages won't.
 *
 * Rendered with native <details>, so it works with JS disabled, is keyboard
 * operable and exposes the right semantics to a screen reader without pulling
 * in an accordion component.
 */
const faqs = [
  {
    q: "What do I actually get for free?",
    a: `One personalised affirmation set, written from your own words — the real thing, not a sample — plus the whole library to read and one narrated sleep track so you can hear the voice. No card, and nothing expires. After that the paid plans unlock unlimited writing.`,
  },
  {
    q: "Is this a subscription?",
    a: "The Standard and Voice plans are subscriptions, billed weekly, monthly or yearly — you choose, and you can cancel any time. There is also a one-payment Lifetime option if you'd rather never see a renewal.",
  },
  {
    q: "How much time does it take?",
    a: "Five minutes for the daily practice. Reading a story is two or three. Sleep sessions run as long as they say they do. Nothing here needs a free morning.",
  },
  {
    q: "Do I need to believe in manifestation?",
    a: "No. The app says plainly on its own pages that thinking about something does not make it arrive. What writing in detail does is change what you notice and how quickly you act — that's the mechanism, and it's the one everything here is built on.",
  },
  {
    q: "Is it on Android and iPhone?",
    a: "Android: it's on Google Play. iPhone: there's no App Store build yet, so open the site in Safari, tap Share, then Add to Home Screen — it runs full screen from then on. Nothing is missing on iPhone; it just installs differently.",
  },
  {
    q: "How do I cancel, and can I get a refund?",
    a: "Cancel from Settings inside the app at any time; you keep access until the period you've paid for ends. Refunds are handled by whichever store took the payment — Lemon Squeezy on the web, Google Play on Android. If something has gone wrong, email and a person will answer.",
  },
  {
    q: "What happens to what I write?",
    a: "Your desires, journal entries and gratitude logs are yours. They're used to write your own stories and affirmations and nothing else. The privacy policy is linked at the foot of this page and is worth the two minutes.",
  },
  {
    q: "Is this therapy?",
    a: "No, and it doesn't pretend to be. It's a tool for reflection and visualisation. If you're struggling with your mental health, please talk to someone qualified — this is not a substitute for that.",
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
const standardWeekly = planById("standard_weekly");
const voiceWeekly = planById("voice_weekly");
const standardMonthly = planById("standard_monthly");
const voiceMonthly = planById("voice_monthly");
const standardYearly = planById("standard_yearly");
const voiceYearly = planById("voice_yearly");
/**
 * Lifetime was missing from this page entirely, while /stack/ sold the very
 * same Lemon Squeezy product. Somebody who wanted to pay once and never see a
 * renewal had no way to learn it existed from the pricing section.
 */
const standardLifetime = planById("standard_lifetime");

/**
 * Three columns, one per tier, each showing its SMALLEST price.
 *
 * This used to show the yearly figure, so the first number a stranger saw was
 * $149.99. On a page whose job is to get somebody to press "Start free", that
 * is the wrong number in the wrong place — it asks for a year-long decision
 * from someone who has not yet read a single sentence the app wrote for them.
 *
 * The yearly price still exists and is still the better deal; it just belongs
 * on the upgrade screen, where the person reading it already knows what they
 * would be buying.
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
      // Says exactly what the server enforces. The previous version promised
      // "3 stories per refresh" and "5 coach messages a day", neither of which
      // was enforced anywhere — and a promise the product does not keep is
      // worse than a smaller promise it does.
      `${FREE_LIMITS.affirmationSets} personalised affirmation set, written for your own words`,
      "The whole library to read",
      "One narrated sleep track, so you can hear the voice",
    ],
    cta: "Start free",
    featured: false,
    badge: null as string | null,
    footnote: null as string | null,
  },
  {
    name: "Standard",
    price: standardWeekly?.priceDisplay ?? "$2.49",
    period: standardWeekly?.cadence ?? "per week",
    blurb: "Everything written, with no limits. You do the reading.",
    perks: [...STANDARD_FEATURES].slice(0, 4),
    // Was "Get Standard", which promises a checkout. The button goes to
    // signup, because you need an account before anything can be billed to
    // it. A label that describes the wrong next screen is a small lie that
    // gets found out one click later.
    cta: "Start with Standard",
    featured: false,
    badge: null,
    // Monthly first, then yearly. The weekly headline reads as nothing —
    // which is why it leads — but somebody deciding needs the number they
    // would actually be charged on a card statement, and for most people that
    // is the monthly one. Leaving it out made the page look like it was
    // hiding something.
    footnote: `or ${standardMonthly?.priceDisplay ?? "$5.99"} a month · ${standardYearly?.priceDisplay ?? "$45.99"} a year`,
  },
  {
    name: "Voice",
    price: voiceWeekly?.priceDisplay ?? "$6.99",
    period: voiceWeekly?.cadence ?? "per week",
    blurb: "Everything in Standard, read aloud in a real human voice.",
    perks: [...VOICE_FEATURES],
    cta: "Start with Voice",
    featured: true,
    badge: null,
    footnote: `or ${voiceMonthly?.priceDisplay ?? "$19.99"} a month · ${voiceYearly?.priceDisplay ?? "$179.99"} a year`,
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
              <a href="#how" className="transition-colors hover:text-foreground">
                How it works
              </a>
              <a href="#pricing" className="transition-colors hover:text-foreground">
                Pricing
              </a>
              <a href="#faq" className="transition-colors hover:text-foreground">
                FAQ
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
                Five minutes a day, written for the thing you actually want
              </motion.span>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="mt-7 text-balance text-5xl font-semibold leading-[1.05] md:text-7xl"
              >
                {/*
                  Headline alternatives considered, kept for A/B testing:
                    A. "Say what you want. Hear it back."  ← the old one. Sells
                       studio narration, which is the top paid tier, to someone
                       who is about to click a free signup button. The promise
                       and the product a new account receives did not match.
                    B. "Say it once. Then five minutes a day."  ← chosen.
                       Names the free thing (writing your sentence), names the
                       daily commitment honestly, and matches the practice that
                       actually retains people.
                    C. "Manifestation that ends with something to do."
                       Strongest differentiator against every competitor
                       reviewed, but leads with a negative framing of the
                       category and assumes the reader already dislikes it.
                */}
                Say it once. <span className="text-gradient">Then five minutes a day.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground"
              >
                Type the thing you actually want — a calmer mind, your own apartment, being deeply
                loved. ManifestAI writes the stories, the affirmations and the daily practice from
                that one sentence, and every day it ends with one small thing to do. Not a library
                everyone else is reading.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
              >
                {/*
                  CTA alternatives, kept for testing:
                    A. "Start Free"            ← the old one. Says the price, not the outcome.
                    B. "Write your first line" ← chosen. Names the actual next
                       action, which is what the free tier delivers: one
                       personalised set written from your own sentence.
                    C. "See what it writes for you" — curiosity-led, but vaguer
                       about what the click costs.
                */}
                <Button asChild variant="hero" size="xl">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Write your first line <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="glass" size="xl">
                  <a href="#how">See how it works</a>
                </Button>
              </motion.div>

              <p className="mt-5 text-xs text-muted-foreground">
                Free to start, no card. ManifestAI supports your effort — it doesn't promise
                outcomes, and it says so inside the app too.
              </p>

              {/* The listing is live, so this is a verifiable claim rather than a badge. */}
              <a
                href={PLAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-full glass-panel px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Sparkles className="h-3.5 w-3.5 text-ember" />
                Also on Google Play for Android
              </a>
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

          {/*
            Problem, then solution. The page used to go hero → feature grid,
            which asks a stranger to care about features before anything has
            named why they're here. Every competitor reviewed does the
            agitation first — To Be Magnetic's "most self-help is complete
            fluff", Calm's three "we're here to help you feel better" cards.

            Deliberately NOT written to frighten anyone. It describes a
            frustration with a method, not a defect in the reader.
          */}
          <section className="mx-auto max-w-6xl px-6 py-24">
            <Reveal className="mx-auto max-w-3xl text-center">
              <h2 className="text-4xl font-semibold md:text-5xl">
                You didn&rsquo;t stop because you stopped{" "}
                <em className="not-italic text-gradient">wanting it</em>.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                You wrote the affirmations. You said them to a mirror and felt faintly silly.
                Somewhere around day four you stopped, and quietly concluded that either it
                doesn&rsquo;t work or something is wrong with you.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Neither. Day 8 looks identical to Day 30 — a blank page asking you to start from
                nothing, on a Tuesday, when you&rsquo;re tired. That&rsquo;s a design problem, not a
                discipline one, and it&rsquo;s the specific thing this app was built to fix.
              </p>
            </Reveal>
          </section>

          {/* How it works — three steps */}
          <section id="how" className="mx-auto max-w-6xl px-6 pb-24">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-4xl font-semibold md:text-5xl">How it works</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Three things, and the first one takes a minute.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {steps.map((step, i) => (
                <Reveal key={step.n} delay={i * 0.08}>
                  <article className="h-full rounded-3xl glass-panel p-7">
                    <span className="font-display text-3xl font-semibold text-gradient">
                      {step.n}
                    </span>
                    <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
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
                Start free for as long as you like. Upgrade when the practice sticks. Every paid
                plan cancels from Settings in two taps.
              </p>
            </Reveal>

            <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                      {tier.footnote && (
                        <p className="mt-1.5 text-xs text-muted-foreground">{tier.footnote}</p>
                      )}
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

            <Reveal delay={0.24}>
              <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
                Would rather never see a renewal?{" "}
                <span className="text-foreground">
                  Lifetime is {standardLifetime?.priceDisplay ?? "$79.99"},{" "}
                  {standardLifetime?.cadence ?? "one payment"}
                </span>{" "}
                — everything in Standard, permanently, including whatever gets added later. It sits
                on the upgrade screen once you have an account.
              </p>
            </Reveal>
          </section>

          {/*
            Trust, built only from things that are actually true.
            No testimonials: there are none yet, and inventing them is both
            illegal in most places and obvious to the people you're trying to
            persuade. What's left is transparency, which is a weaker signal but
            a real one — and competitors with 100k reviews can't claim it as
            distinctively as a small product can.
          */}
          <section className="mx-auto max-w-6xl px-6 pb-24">
            <Reveal className="mx-auto max-w-4xl">
              <div className="rounded-3xl glass-panel p-8 md:p-12">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl surface-gradient shadow-glow">
                  <ShieldCheck className="h-5 w-5 text-primary-foreground" />
                </span>
                <h2 className="mt-5 text-3xl font-semibold md:text-4xl">
                  What this won&rsquo;t tell you
                </h2>
                <div className="mt-6 grid gap-5 text-sm leading-relaxed text-muted-foreground md:grid-cols-2">
                  <p>
                    It will not tell you that thinking about something makes it happen. There is no
                    evidence for that, and you have probably suspected as much — which is why it has
                    never quite worked. What describing a life in detail does is change what you
                    notice and lower the cost of acting. That is the honest mechanism and the one
                    the whole app is built on.
                  </p>
                  <p>
                    There are no testimonials on this page because there are none worth printing
                    yet. When real ones exist they&rsquo;ll go here with a first name and a city,
                    and not before. In the meantime: the app is on Google Play, the privacy policy
                    and terms are linked below, and{" "}
                    <a
                      href="mailto:vimanu9.vr@gmail.com"
                      className="text-foreground underline underline-offset-4"
                    >
                      a person reads this address
                    </a>
                    .
                  </p>
                </div>
              </div>
            </Reveal>
          </section>

          {/* FAQ */}
          <section id="faq" className="mx-auto max-w-6xl px-6 pb-24">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-4xl font-semibold md:text-5xl">Before you decide</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                The questions worth answering honestly, including the awkward ones.
              </p>
            </Reveal>

            {/*
              Native <details> rather than an accordion component: it works
              with JavaScript disabled, is keyboard operable for free, and
              already announces expanded/collapsed state to a screen reader.
            */}
            <div className="mx-auto mt-12 grid max-w-3xl gap-3">
              {faqs.map((faq, i) => (
                <Reveal key={faq.q} delay={i * 0.04}>
                  <details className="group rounded-2xl glass-panel px-6 py-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-base font-medium marker:hidden">
                      {faq.q}
                      <span className="shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <section className="mx-auto max-w-6xl px-6 pb-28">
            <Reveal className="mx-auto max-w-3xl text-center">
              <h2 className="text-4xl font-semibold md:text-5xl">
                Write the sentence <span className="text-gradient">tonight</span>.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
                It takes a minute, it costs nothing, and by the end of it something will be written
                for the thing you actually want rather than for everybody.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild variant="hero" size="xl">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Write your first line <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="glass" size="xl">
                  <a href={PLAY_URL} target="_blank" rel="noopener noreferrer">
                    Get it on Google Play
                  </a>
                </Button>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Free to start, no card. Cancel a paid plan any time from Settings.
              </p>
            </Reveal>
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
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
                <a href="#features" className="hover:text-foreground">
                  Features
                </a>
                <a href="#pricing" className="hover:text-foreground">
                  Pricing
                </a>
                <a href="#faq" className="hover:text-foreground">
                  FAQ
                </a>
                <a
                  href={PLAY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  Android
                </a>
                <Link to="/auth" className="hover:text-foreground">
                  Log in
                </Link>
                {/*
                  Both pages existed and nothing linked to them. Google Play
                  requires a reachable privacy policy for a listing, and a
                  pricing page that takes money with no terms in sight is the
                  thing a cautious buyer closes the tab over. The refund
                  position lives inside Terms rather than on its own page —
                  §Cancelling — because Lemon Squeezy is merchant of record and
                  theirs is the policy that actually governs a refund.
                */}
                <Link to="/privacy" className="hover:text-foreground">
                  Privacy
                </Link>
                <Link to="/terms" className="hover:text-foreground">
                  Terms
                </Link>
              </div>
            </div>
            <div className="border-t border-glass-border py-5 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} ManifestAI · A tool for reflection and visualisation, not
              therapy or medical advice.
            </div>
          </footer>
        </div>
      </div>
    </PageTransition>
  );
}
