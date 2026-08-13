/**
 * What the library writes next.
 *
 * A rotating set of themes rather than a fixed catalogue. Each week the app
 * asks for a few of these, so the library grows instead of being ten items
 * somebody typed once. The competitor's library looks endless because theirs
 * does the same thing — the difference between a product and a demo is often
 * just whether the content keeps arriving.
 *
 * Written as situations rather than topics. "Abundance" produces a generic
 * script; "the Sunday night before a week you're dreading" produces something
 * a person recognises, and recognition is what makes them press play.
 */

export type NewTrackTheme = {
  kind: "meditation" | "sleep" | "visualization";
  theme: string;
  minutes: number;
  category: string;
};

export const NEW_TRACK_THEMES: NewTrackTheme[] = [
  // Sleep — the biggest category in every app of this kind, because it's the
  // one people reach for when they can't do anything else.
  {
    kind: "sleep",
    theme: "The Sunday night before a week you're dreading",
    minutes: 15,
    category: "calm",
  },
  {
    kind: "sleep",
    theme: "Putting down a conversation that went badly",
    minutes: 12,
    category: "calm",
  },
  {
    kind: "sleep",
    theme: "When your mind keeps solving problems at 2am",
    minutes: 18,
    category: "calm",
  },
  {
    kind: "sleep",
    theme: "The night before something that matters",
    minutes: 15,
    category: "calm",
  },
  {
    kind: "sleep",
    theme: "Letting the day be finished, even unfinished",
    minutes: 12,
    category: "calm",
  },

  // Meditation
  {
    kind: "meditation",
    theme: "Ten minutes before you open your laptop",
    minutes: 10,
    category: "career",
  },
  {
    kind: "meditation",
    theme: "When comparison has been loud this week",
    minutes: 10,
    category: "confidence",
  },
  {
    kind: "meditation",
    theme: "Steadiness when money feels tight",
    minutes: 12,
    category: "wealth",
  },
  {
    kind: "meditation",
    theme: "Being in your body after a long day of thinking",
    minutes: 10,
    category: "health",
  },
  {
    kind: "meditation",
    theme: "The middle of a project, where it stops being exciting",
    minutes: 12,
    category: "career",
  },
  {
    kind: "meditation",
    theme: "Forgiving yourself for the version of you who didn't know",
    minutes: 15,
    category: "self-love",
  },
  {
    kind: "meditation",
    theme: "When you've been waiting for something to be decided",
    minutes: 10,
    category: "calm",
  },

  // Visualisation — the manifestation core, written as rehearsal.
  {
    kind: "visualization",
    theme: "An ordinary Tuesday, a year from now",
    minutes: 10,
    category: "growth",
  },
  {
    kind: "visualization",
    theme: "Walking into the room already belonging there",
    minutes: 8,
    category: "confidence",
  },
  {
    kind: "visualization",
    theme: "The first month after the money stopped being frightening",
    minutes: 12,
    category: "wealth",
  },
  {
    kind: "visualization",
    theme: "Being loved in a way that doesn't need managing",
    minutes: 10,
    category: "love",
  },
  {
    kind: "visualization",
    theme: "The morning you move into your own place",
    minutes: 10,
    category: "home",
  },
  {
    kind: "visualization",
    theme: "Doing the work you'd do for free, and being paid",
    minutes: 12,
    category: "career",
  },
];

/**
 * Picks this week's themes.
 *
 * Seeded by the week number so everyone gets the same ones — which matters
 * because narration is shared by title, so aligning users means the first
 * listener pays and everybody else is instant.
 */
export function themesForWeek(count = 3, date = new Date()): NewTrackTheme[] {
  const week = Math.floor(date.getTime() / (7 * 86_400_000));
  return Array.from({ length: count }, (_, index) => {
    const at = Math.abs(week * count + index) % NEW_TRACK_THEMES.length;
    return NEW_TRACK_THEMES[at]!;
  });
}
