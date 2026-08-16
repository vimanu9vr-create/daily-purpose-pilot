/**
 * Repeating numbers, and what people take them to mean.
 *
 * How this is framed matters more than the content, so it's worth stating.
 *
 * There is no evidence that seeing 11:11 predicts anything, and this app does
 * not say it does. What is true, and what makes this worth building, is that
 * noticing a repeated number is a prompt — a moment where someone stops and
 * asks what they're doing. That is genuinely useful, and it's the honest
 * version of a feature every manifestation app has.
 *
 * So each entry has a traditional meaning, presented as what the tradition
 * says, and a question that turns it into something to actually think about.
 * The wording never says "this means X will happen". It says "people read this
 * as X — here's what to do with that".
 *
 * ## Why the questions name your dream
 *
 * The first version asked generic questions: "What have you been thinking
 * about most this week?" Reported back as "angel numbers doesn't seem to be
 * true, it's just random words" — and that was a fair reading. A question that
 * would fit anybody fits nobody. It reads as filler because it is filler.
 *
 * The fix isn't to claim more. It's to ask about something real. Each number
 * now has a second question written around the thing the person actually typed
 * in, so 999 asks what they're finished with *in the way of that*, rather than
 * what they're finished with in general. Same number, same tradition, same
 * refusal to predict anything — but a question they can only answer about
 * their own life.
 *
 * If that framing seems overly careful for an app about manifestation: the
 * people most drawn to this are often the least well served by being told a
 * number decides their life. Giving them a reflection instead costs nothing
 * and is the difference between a tool and a trick.
 */

import { desirePhrase, GENERIC_DESIRE } from "@/features/moments/desire-phrase";

export type AngelNumber = {
  number: string;
  /** The traditional reading, attributed rather than asserted. */
  meaning: string;
  /** What to do with having noticed it, when we know nothing about them. */
  prompt: string;
  /** The same question, asked about the thing they're working toward. */
  personal: (goal: string) => string;
  theme: "beginnings" | "alignment" | "trust" | "change" | "abundance" | "release";
};

export const ANGEL_NUMBERS: AngelNumber[] = [
  {
    number: "111",
    meaning: "Traditionally read as a doorway — a moment when what you focus on takes shape.",
    prompt: "What have you been thinking about most this week? Is it what you'd choose?",
    personal: (goal) =>
      `You said you're working toward ${goal}. Is that where your attention actually went this week, or did something else take it?`,
    theme: "beginnings",
  },
  {
    number: "222",
    meaning: "Read as balance, and as a sign to keep going with something already begun.",
    prompt: "What are you close to abandoning that's actually working?",
    personal: (goal) =>
      `Which part of ${goal} are you closest to giving up on? Look at it again — quiet progress is the hardest kind to see.`,
    theme: "alignment",
  },
  {
    number: "333",
    meaning: "Associated with support — the sense of not doing it alone.",
    prompt: "Who could you tell about this? Saying it out loud changes it.",
    personal: (goal) =>
      `Who in your life doesn't yet know you're working toward ${goal}? Telling one person makes it harder to quietly drop.`,
    theme: "trust",
  },
  {
    number: "444",
    meaning: "Read as foundations, and as steadiness in a stretch that feels unsteady.",
    prompt: "What's the least glamorous thing you could do today that would actually hold?",
    personal: (goal) =>
      `What's the dullest, most repeatable thing you could do toward ${goal} today? That's usually the one that holds.`,
    theme: "alignment",
  },
  {
    number: "555",
    meaning: "Traditionally the number of change arriving.",
    prompt: "What are you resisting that you already know is coming?",
    personal: (goal) =>
      `What would have to change in your week for ${goal} to be realistic? You probably already know, and have been avoiding it.`,
    theme: "change",
  },
  {
    number: "777",
    meaning: "Read as a sign you're on your own path rather than someone else's.",
    prompt: "Where in your life are you following a plan you never actually chose?",
    personal: (goal) =>
      `Is ${goal} yours, or someone else's idea of what you should want? Worth checking honestly, once.`,
    theme: "trust",
  },
  {
    number: "888",
    meaning: "Associated with abundance and with returns on effort already spent.",
    prompt:
      "What have you been putting work into that hasn't paid off yet? Give it one more month.",
    personal: (goal) =>
      `What have you already put into ${goal} that hasn't shown a return yet? Returns lag effort — that's not the same as it not working.`,
    theme: "abundance",
  },
  {
    number: "999",
    meaning: "Read as completion — an ending that makes room.",
    prompt: "What are you finished with, that you haven't admitted you're finished with?",
    personal: (goal) =>
      `What's standing between you and ${goal} that you're finished with, but haven't said so yet?`,
    theme: "release",
  },
  {
    number: "1111",
    meaning: "The most widely noticed of all. Read as a moment of alignment.",
    prompt: "If this were a nudge, what would it be nudging you toward? Answer quickly.",
    personal: (goal) =>
      `First thing that comes to mind: what's the one move toward ${goal} you keep not making? Don't think about it.`,
    theme: "beginnings",
  },
  {
    number: "1212",
    meaning: "Read as a step forward, and as a sign to move before feeling ready.",
    prompt: "What would you do this week if you weren't waiting to feel prepared?",
    personal: (goal) =>
      `What would you do about ${goal} this week if you'd stopped waiting to feel ready for it?`,
    theme: "change",
  },
];

/**
 * The question to show.
 *
 * Falls back to the general version when there's no dream yet — someone on
 * their first day has nothing for it to be about, and a question with a hole
 * where their goal should be is worse than a generic one.
 */
export function reflectionFor(entry: AngelNumber, desireTitle?: string | null): string {
  const trimmed = desireTitle?.trim();
  if (!trimmed) return entry.prompt;

  const goal = desirePhrase(trimmed);
  // desirePhrase returns null when it can't shape the text into a sentence.
  // Using the raw title anyway is how "working toward my aim is to earn
  // 20000cr" happened, so take the generic question instead.
  if (!goal || goal === GENERIC_DESIRE) return entry.prompt;

  return entry.personal(goal);
}

/** The number for a given day, stable so it doesn't shuffle on re-render. */
export function numberForToday(date = new Date()): AngelNumber {
  const dayNumber = Math.floor(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000,
  );
  return ANGEL_NUMBERS[Math.abs(dayNumber) % ANGEL_NUMBERS.length]!;
}

export function numberByValue(value: string): AngelNumber | undefined {
  return ANGEL_NUMBERS.find((entry) => entry.number === value);
}
