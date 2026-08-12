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
 * If that framing seems overly careful for an app about manifestation: the
 * people most drawn to this are often the least well served by being told a
 * number decides their life. Giving them a reflection instead costs nothing
 * and is the difference between a tool and a trick.
 */

export type AngelNumber = {
  number: string;
  /** The traditional reading, attributed rather than asserted. */
  meaning: string;
  /** What to do with having noticed it. This is the part that earns its place. */
  prompt: string;
  theme: "beginnings" | "alignment" | "trust" | "change" | "abundance" | "release";
};

export const ANGEL_NUMBERS: AngelNumber[] = [
  {
    number: "111",
    meaning: "Traditionally read as a doorway — a moment when what you focus on takes shape.",
    prompt: "What have you been thinking about most this week? Is it what you'd choose?",
    theme: "beginnings",
  },
  {
    number: "222",
    meaning: "Read as balance, and as a sign to keep going with something already begun.",
    prompt: "What are you close to abandoning that's actually working?",
    theme: "alignment",
  },
  {
    number: "333",
    meaning: "Associated with support — the sense of not doing it alone.",
    prompt: "Who could you tell about this? Saying it out loud changes it.",
    theme: "trust",
  },
  {
    number: "444",
    meaning: "Read as foundations, and as steadiness in a stretch that feels unsteady.",
    prompt: "What's the least glamorous thing you could do today that would actually hold?",
    theme: "alignment",
  },
  {
    number: "555",
    meaning: "Traditionally the number of change arriving.",
    prompt: "What are you resisting that you already know is coming?",
    theme: "change",
  },
  {
    number: "777",
    meaning: "Read as a sign you're on your own path rather than someone else's.",
    prompt: "Where in your life are you following a plan you never actually chose?",
    theme: "trust",
  },
  {
    number: "888",
    meaning: "Associated with abundance and with returns on effort already spent.",
    prompt:
      "What have you been putting work into that hasn't paid off yet? Give it one more month.",
    theme: "abundance",
  },
  {
    number: "999",
    meaning: "Read as completion — an ending that makes room.",
    prompt: "What are you finished with, that you haven't admitted you're finished with?",
    theme: "release",
  },
  {
    number: "1111",
    meaning: "The most widely noticed of all. Read as a moment of alignment.",
    prompt: "If this were a nudge, what would it be nudging you toward? Answer quickly.",
    theme: "beginnings",
  },
  {
    number: "1212",
    meaning: "Read as a step forward, and as a sign to move before feeling ready.",
    prompt: "What would you do this week if you weren't waiting to feel prepared?",
    theme: "change",
  },
];

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
