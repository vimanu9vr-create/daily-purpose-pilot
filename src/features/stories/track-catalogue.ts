/**
 * Sleep tracks, meditations and frequency sessions.
 *
 * Unlike stories, these aren't written from the user's desires — they're the
 * same for everyone, so they live as a fixed catalogue rather than being
 * generated. Seeded into `moments` on first visit so the player, favourites
 * and narration caching all work identically to stories.
 */

import type { ImageTheme } from "./imagery";

export type TrackKind = "sleep" | "meditation" | "frequency";

export type CatalogueTrack = {
  slug: string;
  kind: TrackKind;
  title: string;
  hook: string;
  theme: ImageTheme;
  minutes: number;
  body: string;
};

export const KIND_LABELS: Record<string, string> = {
  story: "Trending now",
  affirmation: "Affirmations",
  sleep: "Sleep tracks",
  meditation: "Meditations",
  frequency: "Frequencies",
};

export const KIND_ORDER = ["story", "affirmation", "sleep", "meditation", "frequency"];

export const TRACKS: CatalogueTrack[] = [
  // ---------- Sleep ----------
  {
    slug: "sleep-safe-to-love",
    kind: "sleep",
    title: "You are safe to love again",
    hook: "You are safe to love again",
    theme: "love",
    minutes: 15,
    body: `Let your shoulders drop. There is nothing left to solve tonight.

Notice the weight of you against the bed. The parts that are holding — your jaw, your hands, somewhere behind your eyes. Let each one be heavier than it was a moment ago.

You have spent a long time being careful. Bracing before anything happened. That was reasonable, once.

Tonight you can set it down. Not forever. Just until morning.

You are allowed to want closeness without preparing for its loss. You are allowed to be soft in a body that has learned to be armoured.

Breathe in for four. Hold for two. Out for six.

Nothing is required of you between now and the morning. Let the day finish without you.`,
  },
  {
    slug: "sleep-put-the-day-down",
    kind: "sleep",
    title: "Put the day down",
    hook: "Put the day down",
    theme: "calm",
    minutes: 12,
    body: `Wherever you are, let your body get heavier.

Think of the day as something you have been carrying. Not dramatically. Just holding, the way you hold a bag you have stopped noticing.

Set it down beside the bed. It will be there tomorrow if you need it.

The conversation you keep replaying — set that down too. You have already thought every thought available to you about it tonight.

Your only job now is to breathe slightly slower than you were.

In through the nose. Out, longer.

Nothing is unfinished in a way that morning can't hold.`,
  },
  {
    slug: "sleep-tomorrow-is-not-here",
    kind: "sleep",
    title: "Tomorrow is not here yet",
    hook: "Tomorrow is not here yet",
    theme: "home",
    minutes: 18,
    body: `Tomorrow is not here yet. You cannot do anything about it from this bed.

Let that be a relief rather than a worry.

Feel where your body meets the mattress. Follow that line from your heels, up through your legs, your back, your shoulders.

Anywhere it feels tight, let the out-breath go there first.

The list in your head is real. It is also not urgent at this hour. It has never once been solved at this hour.

You are allowed to stop being useful now.

Slower. Softer. Down.`,
  },

  // ---------- Meditation ----------
  {
    slug: "meditation-morning-clarity",
    kind: "meditation",
    title: "Morning clarity",
    hook: "Begin before the day begins",
    theme: "calm",
    minutes: 8,
    body: `Sit however you are. There is no correct posture for this.

Take one breath that is deliberately deeper than the last.

Before the day asks anything of you, notice that you are here first. Underneath the roles and the messages waiting, there is just you, awake.

Bring to mind one thing you want to move today. Only one. Hold it lightly.

Now let it go and return to the breath. Attention wanders — that is what attention does. Coming back is the practice, not staying.

Three more breaths, and then begin.`,
  },
  {
    slug: "meditation-steady-under-pressure",
    kind: "meditation",
    title: "Steady under pressure",
    hook: "Steady, with the pressure still there",
    theme: "confidence",
    minutes: 10,
    body: `Something is pressing on you. Don't push it away — notice where you feel it in your body.

Chest? Throat? Stomach? Just locate it.

Breathe into that place. Not to fix it. To keep it company.

Pressure is not proof that something is wrong. Often it is proof that something matters.

You do not have to feel calm to act well. Calm is nice. It is not required.

Ask yourself: what is the next single thing? Not the whole mountain. The next step only.

Take three breaths, and then go do that one thing.`,
  },
  {
    slug: "meditation-releasing-comparison",
    kind: "meditation",
    title: "Releasing comparison",
    hook: "Their timeline is not yours",
    theme: "wealth",
    minutes: 9,
    body: `Bring to mind the person you keep measuring yourself against.

Notice this without judging yourself for it. Comparison is automatic. It is not a character flaw.

Now notice what you actually know about them. Their results, not their days. Their outcome, not the years underneath it.

You are comparing your inside to their outside. That comparison was never fair, in either direction.

Breathe out, and let the scoreboard go.

What you have is your own timeline, and today's piece of it.

That is enough to work with.`,
  },

  // ---------- Frequency ----------
  {
    slug: "frequency-528",
    kind: "frequency",
    title: "Renewal 528 Hz",
    hook: "Renewal · 528 Hz",
    theme: "health",
    minutes: 5,
    body: `Settle in. Let the tone do most of the work.

Breathe with it. In as it rises, out as it steadies.

There is nothing to achieve here. You are just sitting with a sound for a few minutes.

Let your thoughts pass without following them.`,
  },
  {
    slug: "frequency-639",
    kind: "frequency",
    title: "Connection 639 Hz",
    hook: "Connection · 639 Hz",
    theme: "love",
    minutes: 4,
    body: `Let your breath slow to meet the tone.

Bring to mind someone you want more ease with. Hold them lightly, without rehearsing anything you want to say.

Just sit beside the thought of them for a few minutes.

Then let it go, and stay with the sound.`,
  },
  {
    slug: "frequency-888",
    kind: "frequency",
    title: "Abundance 888 Hz",
    hook: "Abundance · 888 Hz",
    theme: "wealth",
    minutes: 4,
    body: `Sit and let the tone settle around you.

Notice any tightness that shows up when you think about money. Don't argue with it. Just notice.

Breathe out, longer than you breathed in.

Nothing has to be decided while you sit here.`,
  },
  {
    slug: "frequency-963",
    kind: "frequency",
    title: "Become confident 963 Hz",
    hook: "Become confident · 963 Hz",
    theme: "confidence",
    minutes: 4,
    body: `Let the tone hold the room.

Sit up slightly straighter than you were. Not rigid — just present.

Breathe, and let the version of you who isn't bracing take up the space.

Stay here for a few minutes.`,
  },
];

/** A gentle note about what frequency tracks are, shown once in the Library. */
export const FREQUENCY_DISCLAIMER =
  "Frequency tracks are calm listening sessions. The specific hertz numbers are a tradition in this space rather than a medical claim.";
