/**
 * Seven and twenty-one day affirmation programmes.
 *
 * A programme is a sequence of days, each with a theme and a short set of
 * affirmations written from one dream. It is the reason to open the app
 * tomorrow as well as today.
 *
 * ## The arc matters more than the number of days
 *
 * Twenty-one identical days is not a programme, it's the same track twenty-one
 * times with a counter on it. So the days move through a shape:
 *
 *   Naming it        - say the thing plainly, without hedging.
 *   Deserving it     - the part people quietly get stuck on.
 *   Being the person - identity rather than outcome.
 *   Doing the work   - what that person actually does on a Tuesday.
 *   Meeting the doubt- it shows up; the arc includes it rather than pretending.
 *   Being seen       - other people noticing, which is its own fear.
 *   Continuing       - what this looks like once it's ordinary.
 *
 * Seven days is that arc once. Twenty-one days is the same arc three times at
 * increasing depth, which is how the good programmes are actually built - not
 * twenty-one unrelated themes, because by day nine nobody remembers what day
 * four was about.
 *
 * ## No failure state
 *
 * Days unlock in sequence, not by calendar date. If someone opens the app on
 * Thursday having last used it on Monday, they get day four - not "you missed
 * two days". A 21-day programme that can be failed by going on holiday is a
 * programme most people fail, and the app's whole position is that it doesn't
 * do that to people. The counter measures what they did, never what they
 * didn't.
 */

import { desirePhrase, GENERIC_DESIRE } from "@/features/moments/desire-phrase";

export type ProgrammeLength = 7 | 21;

export type ProgrammeDay = {
  dayNumber: number;
  /** Shown as the day's title. */
  theme: string;
  /** One line of context, so the day isn't just a label. */
  intention: string;
  /** The affirmations for this day. */
  lines: string[];
};

type Stage = {
  key: string;
  theme: string;
  intention: (goal: string) => string;
  lines: (goal: string) => string[];
};

/**
 * The seven stages.
 *
 * Written as identity rather than prophecy, the same line the affirmation
 * writer holds: total conviction about who the person is and what they do,
 * never a claim about what the world will hand them.
 */
const STAGES: Stage[] = [
  {
    key: "naming",
    theme: "Saying it plainly",
    intention: (goal) => `Today is just about naming ${goal} without softening it.`,
    lines: (goal) => [
      `I want ${goal}, and I say so without apologising for it.`,
      `I stopped pretending this was a small thing to me.`,
      `I can hold a want this size without needing it to be reasonable.`,
      `I say what I'm working toward out loud, in my own voice.`,
    ],
  },
  {
    key: "deserving",
    theme: "The part you skip",
    intention: () => `Wanting is easy. Believing you're allowed it is the part people skip.`,
    lines: (goal) => [
      `I don't have to earn the right to want ${goal}.`,
      `I take up the room I'm in.`,
      `I ask for things before I've proved I deserve them.`,
      `Nothing about my past disqualifies me from this.`,
    ],
  },
  {
    key: "identity",
    theme: "Who you're being",
    intention: (goal) => `Not what you have. What you do, on an ordinary day, with ${goal} normal.`,
    lines: (goal) => [
      `I am the kind of person for whom ${goal} is ordinary.`,
      `I move through my day like someone this is already true of.`,
      `I make decisions from where I'm going, not from where I've been.`,
      `I don't flinch at the parts that used to intimidate me.`,
    ],
  },
  {
    key: "work",
    theme: "What it actually takes",
    intention: () => `The unglamorous middle. This is the day that does the work.`,
    lines: () => [
      `I do the boring part, on the days nobody is watching.`,
      `I finish things I've started.`,
      `I put in the hour before I feel like it.`,
      `Small and repeated beats big and occasional, and I know that.`,
    ],
  },
  {
    key: "doubt",
    theme: "When it shows up",
    intention: () => `Doubt arrives on schedule. Today is about carrying on with it in the room.`,
    lines: () => [
      `The doubt shows up and I keep going anyway.`,
      `I don't wait to feel certain before I act.`,
      `A bad day is a day, not evidence.`,
      `I've continued through worse than this, and I remember doing it.`,
    ],
  },
  {
    key: "seen",
    theme: "Being noticed",
    intention: () => `Other people seeing it is its own kind of fear. Today it's fine.`,
    lines: () => [
      `I let people see what I'm building.`,
      `My name comes up in conversations I'm not in.`,
      `I take the compliment without explaining it away.`,
      `Being visible costs me nothing I need.`,
    ],
  },
  {
    key: "continuing",
    theme: "After it's ordinary",
    intention: (goal) => `What ${goal} looks like once it has stopped being remarkable.`,
    lines: (goal) => [
      `${capitalise(goal)} stopped being the thing I chase and became where I live.`,
      `I keep the habits that got me here.`,
      `I want the next thing without needing to escape this one.`,
      `I'm steady, and it's not an accident.`,
    ],
  },
];

/**
 * How the same stage is worded in later weeks.
 *
 * Twenty-one days repeats the arc three times, so without this you would meet
 * "Saying it plainly" on days 1, 8 and 15 in identical words. The stage is the
 * same; the demand goes up.
 */
const DEPTH_PREFIX: Record<number, string> = {
  0: "",
  1: "Again, and further:",
  2: "Last time, and for keeps:",
};

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The dream, shaped so it can sit inside a sentence. */
function goalPhrase(desireTitle: string): string {
  return desirePhrase(desireTitle) ?? GENERIC_DESIRE;
}

export function buildProgramme(desireTitle: string, length: ProgrammeLength): ProgrammeDay[] {
  const goal = goalPhrase(desireTitle);
  const days: ProgrammeDay[] = [];

  for (let index = 0; index < length; index += 1) {
    const stage = STAGES[index % STAGES.length]!;
    const round = Math.floor(index / STAGES.length);
    const prefix = DEPTH_PREFIX[round] ?? "";

    days.push({
      dayNumber: index + 1,
      theme: stage.theme,
      intention: [prefix, stage.intention(goal)].filter(Boolean).join(" "),
      lines: stage.lines(goal),
    });
  }

  return days;
}

/** The title a programme gets. */
export function programmeTitle(desireTitle: string, length: ProgrammeLength): string {
  return `${length} days — ${desireTitle.trim()}`;
}

/**
 * Progress through a programme.
 *
 * Counts days completed, never days missed. `current` is the next day to do,
 * which is simply one past however many are finished — so a gap in the
 * calendar has no effect on it at all.
 */
export function programmeProgress(
  completedDays: number,
  length: ProgrammeLength,
): { done: number; current: number; percent: number; isFinished: boolean } {
  const done = Math.max(0, Math.min(length, completedDays));
  return {
    done,
    current: Math.min(length, done + 1),
    percent: Math.round((done / length) * 100),
    isFinished: done >= length,
  };
}

/**
 * What to say about where they are.
 *
 * Deliberately never mentions a break, a miss, or a reset. Someone returning
 * after a fortnight is picking up, not failing.
 */
export function programmeMessage(done: number, length: ProgrammeLength): string {
  if (done === 0) return "Day one whenever you're ready.";
  if (done >= length) return `All ${length} days done.`;
  if (done === 1) return "One down.";
  return `${done} of ${length} done.`;
}
