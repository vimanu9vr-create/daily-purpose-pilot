/**
 * Composes a daily "moment" — a short second-person, present-tense scene built
 * from what the user actually wrote about their goal.
 *
 * This runs entirely on the device, so the feature works with no AI key, no
 * per-request cost, and offline. When the `ai-moment` edge function is
 * deployed it produces something better; this is the floor, not the ceiling.
 *
 * A deliberate line: these are written as rehearsal and focus exercises. They
 * describe you *doing the work* and how that feels — never a scene in which
 * the outcome arrives on its own.
 */

import { desirePhrase, GENERIC_DESIRE } from "./desire-phrase";

export type MomentSeed = {
  title: string;
  why?: string | null;
  feeling?: string | null;
  category?: string | null;
  obstacles?: string | null;
};

type Template = {
  key: string;
  title: string;
  build: (seed: MomentSeed) => string[];
};

function feelingPhrase(seed: MomentSeed): string {
  const f = seed.feeling?.trim();
  if (!f) return "steady, and more like yourself than you expected";
  // Trim trailing punctuation so it slots into a sentence.
  return f.replace(/[.!?]+$/, "").toLowerCase();
}

function whyPhrase(seed: MomentSeed): string | null {
  const w = seed.why?.trim();
  if (!w) return null;
  return w.replace(/[.!?]+$/, "");
}

/**
 * The desire, shaped to sit inside a sentence.
 *
 * Templates used `seed.title.toLowerCase()` directly, which is fine for "a
 * calmer mind" and produces nonsense for "my aim is to earn 20000cr".
 */
function goal(seed: MomentSeed): string {
  return desirePhrase(seed.title) ?? GENERIC_DESIRE;
}

const TEMPLATES: Template[] = [
  {
    key: "morning",
    title: "The morning of",
    build: (seed) => {
      const why = whyPhrase(seed);
      return [
        `It's an ordinary morning, months from now. You wake before the alarm, and for a second you can't place why the day feels different.`,
        `Then you remember: ${goal(seed)} isn't something you're chasing anymore. It's just where you live now.`,
        `You notice how normal it feels. Not dramatic. Not cinematic. Just ${feelingPhrase(seed)} — the way real things feel once you've been inside them a while.`,
        why
          ? `And underneath it, quietly, the reason you started: ${why.toLowerCase()}. That part turned out to be true.`
          : `The version of you who started this had no idea it would feel this unremarkable. That's how you know it worked.`,
        `Sit with that for a moment. Then come back and do today's small piece of it.`,
      ];
    },
  },
  {
    key: "witness",
    title: "Someone notices",
    build: (seed) => [
      `Picture someone who knew you before — before you started working toward ${goal(seed)}.`,
      `They're watching you now, in the middle of an ordinary Tuesday. Not a highlight. Just you, doing the thing you do.`,
      `What they notice isn't the result. It's the ease. The way you don't hesitate at the part that used to stop you.`,
      `They ask how you did it, and you find you don't have a dramatic answer. You just kept showing up on days that didn't feel special.`,
      `You feel ${feelingPhrase(seed)}. Hold that, and then go add one more ordinary day to the pile.`,
    ],
  },
  {
    key: "obstacle",
    title: "The thing that used to stop you",
    build: (seed) => {
      const obstacle = seed.obstacles?.trim().replace(/[.!?]+$/, "");
      return [
        obstacle
          ? `You wrote down what was in the way: ${obstacle.toLowerCase()}. Picture the moment you meet it again.`
          : `Picture the moment the doubt shows up again — the familiar one, the one that has stopped you before.`,
        `It arrives the way it always has. Same weight, same timing, same argument.`,
        `And this time you notice it, and you keep moving anyway. Not because it disappeared. Because you stopped waiting for it to.`,
        `That's the whole shift. Not the absence of the obstacle — the presence of you, continuing.`,
        `You feel ${feelingPhrase(seed)}. Now do the next small thing, with the doubt still in the room.`,
      ];
    },
  },
  {
    key: "evening",
    title: "The evening you look back",
    build: (seed) => {
      const why = whyPhrase(seed);
      return [
        `It's evening, a long way from here. The room is quiet. You're not working on anything.`,
        `You think back to right now — this week, this stretch where ${goal(seed)} was still ahead of you and progress was hard to see.`,
        `From where you're sitting, you can see what you couldn't see then: it was already working. It just hadn't shown up yet.`,
        why
          ? `You remember why it mattered — ${why.toLowerCase()} — and you're glad you didn't put it down.`
          : `You're glad you didn't put it down.`,
        `Feel that gratitude backwards, toward the version of you reading this. Then give them one more good day.`,
      ];
    },
  },
  {
    key: "identity",
    title: "Who you're being",
    build: (seed) => [
      // Worded so it works whether the goal is a thing ("a calmer mind") or an
      // action ("earning 20000cr"). "who already has earning 20000cr" doesn't.
      `Forget the outcome for a minute. Picture the person for whom ${goal(seed)} is already ordinary.`,
      `Not what they have — what they do. How they start their morning. What they say yes to. What they've stopped negotiating with themselves about.`,
      `You know more about this person than you think. You've been watching them from a distance for a while.`,
      `Here's the useful part: you don't have to become them first. You can borrow one of their habits today and be them for an hour.`,
      `Pick the smallest one. Do that. Feeling ${feelingPhrase(seed)} follows the action, not the other way round.`,
    ],
  },
  {
    key: "walk",
    title: "The walk home",
    build: (seed) => [
      `You're walking home. It's cold enough to notice. Nothing important has happened today.`,
      `But something has shifted, and you only register it now: you're no longer bracing. The thing you were afraid of — ${goal(seed)} being out of reach — stopped being the background hum of your life.`,
      `It happened so gradually you missed the moment it changed.`,
      `That's what progress actually looks like from the inside. Boring, incremental, and only visible in the rear-view.`,
      `You feel ${feelingPhrase(seed)}. Keep walking. Keep going.`,
    ],
  },
];

/** Deterministic per day, so today's moment doesn't reshuffle on re-render. */
export function composeMoment(seed: MomentSeed, date = new Date()) {
  const dayNumber = Math.floor(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000,
  );
  const template = TEMPLATES[dayNumber % TEMPLATES.length]!;
  return {
    key: template.key,
    title: template.title,
    body: template.build(seed).join("\n\n"),
  };
}

export function momentTemplateCount() {
  return TEMPLATES.length;
}

/** Used when the user asks for a different one on the same day. */
export function composeMomentAt(seed: MomentSeed, offset: number) {
  const template = TEMPLATES[Math.abs(offset) % TEMPLATES.length]!;
  return {
    key: template.key,
    title: template.title,
    body: template.build(seed).join("\n\n"),
  };
}
