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
  build: (seed: MomentSeed, scene: Scene) => string[];
};

/**
 * A place, and the sentence that puts you in it.
 *
 * Six templates were producing 315 stories, so the feed read the same six
 * scenes over and over — "it shows you sit at your desk for everything, every
 * track". Writing thirty more templates would have delayed the problem rather
 * than fixed it, because the repetition is structural: a fixed list of whole
 * stories repeats as soon as you generate more stories than you have entries.
 *
 * Splitting the scene from the argument fixes the ratio. The template supplies
 * the shape — what the piece is doing — and the scene supplies where you are.
 * Six shapes and fourteen places give eighty-four openings from roughly the
 * same amount of writing, and adding one more of either multiplies rather than
 * adds.
 */
type Scene = {
  /** Establishes the place. Always the first line the user reads. */
  open: string;
  /** A physical detail to return to, so the place doesn't vanish after line one. */
  detail: string;
};

const SCENES: Scene[] = [
  {
    open: "It's late, and the kitchen is the only light on in the flat.",
    detail: "the hum of the fridge, loud now that everything else is quiet",
  },
  {
    open: "You're on a bus, halfway to somewhere ordinary.",
    detail: "the window cold against your temple",
  },
  {
    open: "You've stopped on a bench you had no plans to sit on.",
    detail: "someone's dog, somewhere behind you, delighted about nothing",
  },
  {
    open: "You're walking back, and it's cold enough to notice.",
    detail: "your hands pushed into your sleeves",
  },
  {
    open: "You're in the doorway with your keys still in your hand.",
    detail: "the bag you haven't put down yet",
  },
  {
    open: "You've sat down on the stairs on the way up, for no reason.",
    detail: "the carpet under your palm",
  },
  {
    open: "You're awake before the alarm, and the room is still blue.",
    detail: "the weight of the duvet, the fact that nothing is required of you yet",
  },
  {
    open: "You're in a queue that isn't moving, somewhere beige and fluorescent.",
    detail: "the man ahead of you shifting his weight",
  },
  {
    open: "You're on the step outside, in the first warm evening of the year.",
    detail: "the wall still holding the day's heat",
  },
  {
    open: "You're still in the driver's seat with the engine off, not going in yet.",
    detail: "the ticking as it cools",
  },
  {
    open: "It's Sunday and the day has no shape to it.",
    detail: "a mug you keep meaning to finish",
  },
  {
    open: "You're in the corridor outside a room you're about to walk into.",
    detail: "the sound of the door, and the voices behind it",
  },
  {
    open: "It's grey out, and rain has started on the window.",
    detail: "one drop overtaking another down the glass",
  },
  {
    open: "You're in a cafe where nobody knows you.",
    detail: "the machine going somewhere behind you",
  },
];

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
    build: (seed, scene) => {
      const why = whyPhrase(seed);
      return [
        `${scene.open} This is months from now, though it doesn't announce itself. For a second you can't place why it feels different.`,
        `Then you remember: ${goal(seed)} isn't something you're chasing anymore. It's just where you live now.`,
        `You notice how normal it feels. Not dramatic. Not cinematic — ${scene.detail}, and you, ${feelingPhrase(seed)}. The way real things feel once you've been inside them a while.`,
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
    build: (seed, scene) => [
      `${scene.open} Now picture someone who knew you before — before you started working toward ${goal(seed)}.`,
      `They're watching you here, in the middle of nothing in particular. Not a highlight. ${capitalise(scene.detail)}, and you.`,
      `What they notice isn't the result. It's the ease. The way you don't hesitate at the part that used to stop you.`,
      `They ask how you did it, and you find you don't have a dramatic answer. You just kept showing up on days that didn't feel special.`,
      `You feel ${feelingPhrase(seed)}. Hold that, and then go add one more ordinary day to the pile.`,
    ],
  },
  {
    key: "obstacle",
    title: "The thing that used to stop you",
    build: (seed, scene) => {
      const obstacle = seed.obstacles?.trim().replace(/[.!?]+$/, "");
      return [
        obstacle
          ? `${scene.open} You wrote down what was in the way: ${obstacle.toLowerCase()}. Picture meeting it again, right here.`
          : `${scene.open} And the doubt shows up — the familiar one, the one that has stopped you before.`,
        `It arrives the way it always has. Same weight, same timing, same argument.`,
        `And this time you notice it, and you keep moving anyway. Not because it disappeared. Because you stopped waiting for it to.`,
        `That's the whole shift. Not the absence of the obstacle — the presence of you, continuing. ${capitalise(scene.detail)}. Nothing has changed in the room.`,
        `You feel ${feelingPhrase(seed)}. Now do the next small thing, with the doubt still in the room.`,
      ];
    },
  },
  {
    key: "evening",
    title: "The evening you look back",
    build: (seed, scene) => {
      const why = whyPhrase(seed);
      return [
        `${scene.open} This is a long way from here, and you're not working on anything.`,
        `You think back to right now — this week, this stretch where ${goal(seed)} was still ahead of you and progress was hard to see.`,
        `From where you're sitting, you can see what you couldn't see then: it was already working. It just hadn't shown up yet.`,
        why
          ? `You remember why it mattered — ${why.toLowerCase()} — and you're glad you didn't put it down.`
          : `You're glad you didn't put it down.`,
        `What you feel, sitting here, is ${feelingPhrase(seed)}.`,
        `Feel that gratitude backwards, toward the version of you reading this. Then give them one more good day.`,
      ];
    },
  },
  {
    key: "identity",
    title: "Who you're being",
    build: (seed, scene) => [
      // Worded so it works whether the goal is a thing ("a calmer mind") or an
      // action ("earning 20000cr"). "who already has earning 20000cr" doesn't.
      `${scene.open} Forget the outcome for a minute, and put someone here for whom ${goal(seed)} is already ordinary.`,
      `Not anywhere impressive — here. ${capitalise(scene.detail)}.`,
      `Not what they have — what they do. How they start their morning. What they say yes to. What they've stopped negotiating with themselves about.`,
      `You know more about this person than you think. You've been watching them from a distance for a while.`,
      `Here's the useful part: you don't have to become them first. You can borrow one of their habits today and be them for an hour.`,
      `Pick the smallest one. Do that. Feeling ${feelingPhrase(seed)} follows the action, not the other way round.`,
    ],
  },
  {
    key: "walk",
    title: "The walk home",
    build: (seed, scene) => [
      `${scene.open} Nothing important has happened today.`,
      `But something has shifted, and you only register it now: you're no longer bracing. The thing you were afraid of — ${goal(seed)} being out of reach — stopped being the background hum of your life.`,
      `It happened so gradually you missed the moment it changed. ${capitalise(scene.detail)} — and none of it feels like an occasion.`,
      `That's what progress actually looks like from the inside. Boring, incremental, and only visible in the rear-view.`,
      `You feel ${feelingPhrase(seed)}. Keep walking. Keep going.`,
    ],
  },
];

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Which place this one happens in.
 *
 * Mixes the desire with the offset. Offset alone would hand every desire the
 * same sequence of places, so someone with four desires would read the kitchen
 * scene four times in a single feed — the exact repetition this is meant to
 * remove, one level up.
 */
function sceneFor(seed: MomentSeed, offset: number): Scene {
  let hash = 0;
  for (const char of seed.title) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return SCENES[(Math.abs(hash) + Math.abs(offset)) % SCENES.length]!;
}

/** Deterministic per day, so today's moment doesn't reshuffle on re-render. */
export function composeMoment(seed: MomentSeed, date = new Date()) {
  const dayNumber = Math.floor(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000,
  );
  return composeMomentAt(seed, dayNumber);
}

export function momentTemplateCount() {
  return TEMPLATES.length;
}

/**
 * Used when the user asks for a different one, and for every story in the feed.
 *
 * Template and scene advance at different rates — six shapes against fourteen
 * places — so consecutive offsets don't march through both lists in lockstep.
 * They realign only after eighty-four, by which point nobody is scrolling.
 */
export function composeMomentAt(seed: MomentSeed, offset: number) {
  const template = TEMPLATES[Math.abs(offset) % TEMPLATES.length]!;
  const scene = sceneFor(seed, offset);
  return {
    key: template.key,
    title: template.title,
    body: template.build(seed, scene).join("\n\n"),
  };
}
