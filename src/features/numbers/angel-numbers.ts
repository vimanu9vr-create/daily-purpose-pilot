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
import { supabase } from "@/integrations/supabase/client";

export type AngelNumber = {
  number: string;
  /** What the digit itself stands for, before it is repeated. */
  digit: string;
  /** The traditional reading, attributed rather than asserted. */
  meaning: string;
  /** The question to ask when we know nothing about the person yet. */
  prompt: string;
  theme: "beginnings" | "alignment" | "trust" | "change" | "abundance" | "release";
};

export const ANGEL_NUMBERS: AngelNumber[] = [
  {
    number: "111",
    digit:
      "One is the number of beginnings and of the self — the first mark, the thing that starts.",
    meaning:
      "Repeated ones are read as a doorway: a point where whatever you are dwelling on begins to take shape. In the tradition this is the number most associated with manifestation itself, which is why it is also the one most often reported.",
    prompt: "What have you been thinking about most this week? Is it what you'd choose?",
    theme: "beginnings",
  },
  {
    number: "222",
    digit: "Two is partnership, balance and patience — one thing set against another.",
    meaning:
      "Repeated twos are read as a sign that something is already in motion but not yet visible, and that the correct response is to keep going rather than to start again. Traditionally a number of trust rather than action.",
    prompt: "What are you close to abandoning that's actually working?",
    theme: "alignment",
  },
  {
    number: "333",
    digit:
      "Three is expression and creativity — the number of making something and saying it out loud.",
    meaning:
      "In the angel-number tradition, three is associated with the ascended masters and read as support: the sense of not doing this alone. Practically it points at communication, and at things that change when spoken.",
    prompt: "Who could you tell about this? Saying it out loud changes it.",
    theme: "trust",
  },
  {
    number: "444",
    digit: "Four is structure — four walls, four directions, the number of things that hold.",
    meaning:
      "Repeated fours are read as foundations and as protection, and usually arrive in a stretch that feels unsteady. The traditional reading is not that things are about to improve, but that what you have built is sounder than it feels.",
    prompt: "What's the least glamorous thing you could do today that would actually hold?",
    theme: "alignment",
  },
  {
    number: "555",
    digit: "Five is the number of the senses, of freedom, and of movement.",
    meaning:
      "Repeated fives are read as change arriving — and specifically change that is already underway rather than change you must cause. The tradition treats it as upheaval, not as good news; whether it is good news depends on what you were holding onto.",
    prompt: "What are you resisting that you already know is coming?",
    theme: "change",
  },
  {
    number: "666",
    digit: "Six is home, harmony and the material world — the number of domestic things.",
    meaning:
      "The most misread number in the set. Its association with evil comes from one line in the Book of Revelation and has nothing to do with numerology, where repeated sixes are read as a nudge to rebalance: too much attention on money, appearance or the state of the house, and not enough on anything else.",
    prompt: "What have you been over-managing lately, and what has it cost the rest of your life?",
    theme: "alignment",
  },
  {
    number: "777",
    digit: "Seven is the mystic's number — inner knowledge, and the one that resists explanation.",
    meaning:
      "Repeated sevens are read as being on your own path rather than someone else's, and as a kind of luck that is earned rather than given. Traditionally associated with knowing something before you can justify it.",
    prompt: "Where in your life are you following a plan you never actually chose?",
    theme: "trust",
  },
  {
    number: "888",
    digit:
      "Eight is the infinity symbol stood upright — cycles, return, and what comes back around.",
    meaning:
      "Repeated eights are read as abundance, and specifically as returns on effort already spent rather than windfalls. The shape is the point: what you put in comes back, on a delay.",
    prompt: "What have you been putting work into that hasn't paid off yet?",
    theme: "abundance",
  },
  {
    number: "999",
    digit: "Nine is the last digit — nothing follows it without starting over.",
    meaning:
      "Repeated nines are read as completion: an ending that makes room, rather than a loss. The tradition is unusually blunt here — it is taken as a sign that something is finished whether or not you have admitted it.",
    prompt: "What are you finished with, that you haven't admitted you're finished with?",
    theme: "release",
  },
  {
    number: "000",
    digit: "Zero is the circle — no beginning, no end, and no content of its own.",
    meaning:
      "Read as a blank page and as potential before it has taken a shape. In the tradition zero amplifies whatever it sits beside, so on its own it is taken to mean a genuine open moment: nothing decided yet.",
    prompt: "If nothing were already decided, what would you actually pick?",
    theme: "beginnings",
  },
  {
    number: "1111",
    digit: "Four ones — the beginning number, repeated to its fullest.",
    meaning:
      "The most widely noticed sequence of all, largely because clocks make it easy to see. Read as a gateway and a moment of alignment, and traditionally treated as the point at which attention matters most, because whatever is in your mind is taken to be what is taking shape.",
    prompt: "If this were a nudge, what would it be nudging you toward? Answer quickly.",
    theme: "beginnings",
  },
  {
    number: "1212",
    digit: "One and two alternating — starting, then balancing, then starting again.",
    meaning:
      "Read as a step forward, and specifically as permission to move before you feel ready. The alternation is the meaning: it describes progress that isn't smooth.",
    prompt: "What would you do this week if you weren't waiting to feel prepared?",
    theme: "change",
  },
];

/**
 * The reflection to show, written for this person by the model.
 *
 * ## Why the meaning is fixed and the question is not
 *
 * These are two different kinds of content and they were being treated the
 * same, which is what made the feature feel fake.
 *
 * What 111 MEANS is a fact about a tradition. One is the number of beginnings;
 * repeated, it is read as a doorway. Generating that per person would not make
 * it more personal, it would make it invented — and inventing numerology at
 * someone is worse than reporting it, not better.
 *
 * What you should DO with having noticed it is the part that has to be about
 * you, and it used to be a fixed sentence with your dream slotted into a gap.
 * Reported as "angel numbers doesn't seem to be true, it's just random words",
 * which was fair: a sentence built to fit anybody fits nobody, and a template
 * reads as one however well it is written.
 *
 * So the meaning stays fixed and true, and the question is written.
 * `prompt` remains as the honest thing to show someone on their first day,
 * when there is no dream for it to be about yet.
 */
export async function reflectionFor(
  entry: AngelNumber,
  desireTitle?: string | null,
): Promise<string> {
  const trimmed = desireTitle?.trim();
  if (!trimmed) return entry.prompt;

  const goal = desirePhrase(trimmed);
  // desirePhrase returns null when it can't shape the text into a sentence.
  // Using the raw title anyway is how "working toward my aim is to earn
  // 20000cr" happened, so take the general question instead.
  if (!goal || goal === GENERIC_DESIRE) return entry.prompt;

  try {
    const { data, error } = await supabase.functions.invoke("reflect-on-number", {
      body: {
        number: entry.number,
        meaning: entry.meaning,
        theme: entry.theme,
        goal,
      },
    });
    if (error) throw error;

    const question = (data as { question?: string } | null)?.question?.trim();
    if (question) return question;
  } catch {
    // Fall through. The general question is honest — it just isn't personal.
  }

  return entry.prompt;
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
