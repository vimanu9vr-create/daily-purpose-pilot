/**
 * Composes a "moment" on the device — a short second-person, present-tense
 * scene set in a life where what the person wants is already true.
 *
 * This runs entirely on the device, so the feature works with no AI key, no
 * per-request cost, and offline. When `ai-moment` answers it produces something
 * better; this is the floor, not the ceiling.
 *
 * ## Why this was rewritten
 *
 * Reported as: "it shows you're on the bus, you're walking back, you're in the
 * corridor outside, you're on the step outside." Every one of those is an
 * opening line from this file.
 *
 * I had just rewritten the AI prompt to fix exactly this — stories that put you
 * somewhere quiet to think ABOUT a thing you don't have, and then ended by
 * handing you a task. I fixed the version that runs on the server and left its
 * twin on the device untouched, so the same flaw kept shipping from the other
 * half of the system. That is the same mistake I have now made several times:
 * fixing the instance in front of me rather than the pattern.
 *
 * ## What changed
 *
 * THE SCENE IS SET AFTER THEY HAVE IT. Not the day they got it — later, when it
 * has become ordinary. "The day you finally get it" is a daydream everyone has
 * already had alone, and it is the version that feels like a lie. An ordinary
 * Tuesday months in is stranger, more specific, and asks you to imagine being
 * the person rather than imagine the prize.
 *
 * NOTHING ENDS WITH HOMEWORK. Every template used to close on an instruction —
 * "then come back and do today's small piece of it", "keep walking, keep
 * going". Across the stories this produced, 334 of 359 ended that way. A piece
 * you listen to with your eyes shut should not finish by giving you a job.
 *
 * The honesty line is unchanged in spirit but narrower in target. Describing an
 * imagined scene is the whole exercise and is fine. Claiming the world will
 * deliver it — "it's on its way", "the universe is arranging this" — is not,
 * and appears nowhere here.
 *
 * ## What it deliberately does not attempt
 *
 * It cannot know that a Land Rover Defender has a heavy door or that a flat has
 * a boiler that needs bleeding. Only the AI version has that. So this leans on
 * what a template genuinely can do — the shape of ordinariness, the person's
 * own words for the thing, and a real detail of the room rather than of the
 * prize. It never invents specifics about an object it hasn't been told about.
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
 * Six whole-story templates produced 315 stories, so the feed read the same six
 * scenes over and over. Writing thirty more templates would have delayed that
 * rather than fixed it: a fixed list of whole stories repeats as soon as you
 * generate more stories than you have entries.
 *
 * Splitting the scene from the shape fixes the ratio instead. Six shapes and
 * fourteen places give eighty-four openings from roughly the same amount of
 * writing, and adding one more of either multiplies rather than adds.
 *
 * These are all domestic and unremarkable on purpose. The scene's job here is
 * no longer "somewhere to sit and think about your goal" — it is the ordinary
 * furniture of a life in which the thing is already true.
 *
 * ## They also had to stop starting the same way
 *
 * Reported as: "it's still showing you're on cold glass, you're outside, like
 * that, everything." Every one of the previous fourteen opened with "It's…",
 * "You're…", "You've…" or "Someone's…" — so however different the places were,
 * the first line had one shape and the feed read as one voice saying one thing.
 * The first line is also the card preview, which is why it is the part that
 * looks repeated even when the story underneath isn't.
 *
 * So these vary by grammar, not just by furniture: some open on an object, some
 * on a sound, some on a negation, some mid-action, one on a sentence fragment.
 * Only one still begins with "You". A test asserts the spread, because the
 * previous test asserted the opposite — it required every opening to match
 * /^(you're|you've|it's…)/ and was therefore enforcing the monotony.
 */
type Scene = {
  /** Establishes the place. Always the first line the user reads. */
  open: string;
  /** A physical detail to return to, so the place doesn't vanish after line one. */
  detail: string;
};

const SCENES: Scene[] = [
  {
    open: "The kettle has boiled twice and you still haven't made the tea.",
    detail: "the hum of the fridge, loud now that everything else is quiet",
  },
  {
    open: "Rain, hard, on a window somebody left open upstairs.",
    detail: "one drop overtaking another down the glass",
  },
  {
    open: "Nobody has needed anything from you for about two hours.",
    detail: "the light moving slowly across the floor",
  },
  {
    open: "The washing machine finishes, and nobody moves to deal with it.",
    detail: "a cupboard door that never quite shuts",
  },
  {
    open: "Keys still in your hand, bag on the floor where you dropped it.",
    detail: "the coat you haven't hung up",
  },
  {
    open: "Sunday, and the day has no shape to it at all.",
    detail: "the radiator ticking as it warms",
  },
  {
    open: "Halfway through the washing up, thinking about nothing.",
    detail: "the water going cold around your wrists",
  },
  {
    open: "Somebody asks you a question, and you take your time about it.",
    detail: "them waiting, unhurried, not minding",
  },
  {
    open: "First warm evening of the year, and the back door is propped open.",
    detail: "the wall still holding the day's heat",
  },
  {
    open: "Back after a few days away. The flat smells shut up.",
    detail: "the post you haven't picked up yet",
  },
  {
    open: "A car goes past outside, then a long gap, then another.",
    detail: "the room lit only from the hallway",
  },
  {
    open: "Too early to be awake, and the room is still blue.",
    detail: "the weight of the duvet, nothing required of you yet",
  },
  {
    open: "You sat down on the stairs on the way up and stayed there.",
    detail: "the carpet under your palm",
  },
  {
    open: "Eating standing up again, plate balanced on the counter.",
    detail: "the crumbs you will find tomorrow",
  },
];

function feelingPhrase(seed: MomentSeed): string {
  const f = seed.feeling?.trim();
  if (!f) return "more like yourself than you expected";
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

/**
 * The six shapes.
 *
 * Every one is set after the thing is true, and none of them ends by asking
 * for anything. They differ by which face of ordinariness they turn toward:
 * the unremarkableness itself, being seen, the small friction of ownership,
 * having stopped wanting it, the boring use of it, and looking back.
 */
const TEMPLATES: Template[] = [
  {
    key: "ordinary",
    title: "An ordinary morning",
    build: (seed, scene) => {
      const why = whyPhrase(seed);
      return [
        `${scene.open} This is a long way from now, though nothing about it announces that.`,
        // Deliberately doesn't name the old state. "X is not something you're
        // chasing any more" was the first draft, and it drags the wanting back
        // into a scene whose whole job is that the wanting is over.
        `${capitalise(goal(seed))} is simply the ordinary condition of your life, and has been for long enough that you've stopped marking it.`,
        `You notice how little ceremony there is to it. ${capitalise(scene.detail)}, and you, ${feelingPhrase(seed)}. This is what real things feel like once you've been inside them a while.`,
        why
          ? `Underneath it, quietly, the reason you wanted it: ${why.toLowerCase()}. That part turned out to be true as well.`
          : `The version of you who wanted this had no idea it would feel this unremarkable.`,
      ];
    },
  },
  {
    key: "witness",
    title: "Someone notices",
    build: (seed, scene) => [
      `${scene.open} Someone who knew you before is here — before any of this, back when ${goal(seed)} was still a sentence you said carefully.`,
      `They're watching you in the middle of nothing in particular. Not a highlight. ${capitalise(scene.detail)}, and you.`,
      `What they notice isn't what you have. It's the ease. The way you don't brace at the part that used to stop you.`,
      `They ask how it happened, and you find you don't have a dramatic answer, because it didn't happen dramatically. You feel ${feelingPhrase(seed)}, and slightly amused at being asked.`,
    ],
  },
  {
    key: "upkeep",
    title: "The unglamorous part",
    /**
     * Has to hold a Defender and a calmer mind equally.
     *
     * The first draft was "the small dull problem that comes with X. It'll take
     * a phone call, or twenty minutes, or a Saturday" — which is fine for a car
     * and meaningless for a state of mind. Two things fixed it: "asks of you",
     * which is grammatical after a possessive, a bare noun and a gerund alike;
     * and cutting the concrete remedies, which were only ever concrete for
     * objects.
     *
     * Also not "because X is yours now" — the phrase already reads as "your
     * defender car", and "your defender car is yours" is the kind of small
     * wrongness that breaks the spell faster than a dull sentence does.
     */
    build: (seed, scene) => [
      `${scene.open} And there's the upkeep — the small, dull thing that ${goal(seed)} asks of you, which nobody pictures while they still want it.`,
      `It isn't interesting and it isn't a reward. It's the part that keeps it true, and it comes round again whether you feel like it or not.`,
      // The feeling they wrote down has to appear somewhere in every shape.
      // A test catches this, and it caught it here — the first version of this
      // template dropped it, which is the exact bug that test was written for.
      `That's how you know it's real. The daydream never included this, and the actual thing always does. ${capitalise(scene.detail)}, and you, ${feelingPhrase(seed)}.`,
      `You'll see to it. It doesn't take up much room in your head, which is its own kind of luxury.`,
    ],
  },
  {
    key: "forgotten",
    title: "You stopped noticing",
    build: (seed, scene) => {
      const obstacle = seed.obstacles?.trim().replace(/[.!?]+$/, "");
      return [
        `${scene.open} It occurs to you that you haven't thought about wanting ${goal(seed)} in weeks.`,
        `Not because you gave it up. Because it stopped being a thing you want and became a thing you have, and the wanting quietly closed behind you.`,
        obstacle
          ? `The old obstacle — ${obstacle.toLowerCase()} — is still around somewhere. It just doesn't get a vote any more.`
          : `The doubt that used to run underneath all of this is still around somewhere. It just doesn't get a vote any more.`,
        `${capitalise(scene.detail)}. You feel ${feelingPhrase(seed)}, and you go back to what you were doing.`,
      ];
    },
  },
  {
    key: "practical",
    title: "Using it for nothing special",
    build: (seed, scene) => [
      `${scene.open} You're using ${goal(seed)} for something completely boring.`,
      `Not the thing you pictured. Something practical and slightly beneath it, the way people actually use what they have.`,
      `There's no occasion to it. ${capitalise(scene.detail)}. Nobody is watching, nothing is being marked.`,
      `And it works. It just does what it does, and you feel ${feelingPhrase(seed)} in the flat, uneventful way you feel about things that are simply part of your life.`,
    ],
  },
  {
    key: "looking-back",
    title: "The evening you look back",
    build: (seed, scene) => {
      const why = whyPhrase(seed);
      return [
        `${scene.open} You're not working on anything, and you haven't been for a while.`,
        `You think back to the stretch where ${goal(seed)} was still ahead of you and nothing seemed to be moving.`,
        `From here you can see what you couldn't see then. It was already underway. It just hadn't surfaced yet, and there was no way to tell from the inside.`,
        why
          ? `You remember why it mattered — ${why.toLowerCase()} — and you're glad you didn't put it down.`
          : `You're glad you didn't put it down.`,
        `${capitalise(scene.detail)}. What you feel, sitting here, is ${feelingPhrase(seed)}.`,
      ];
    },
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
