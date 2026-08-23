/**
 * Builds a starting board from what someone already told us they want.
 *
 * The blank-canvas problem is the reason most vision board features go
 * unused: "create a board" followed by an empty grid is a request for work,
 * and people who wanted to do the work would already have a Pinterest. So a
 * new board arrives with imagery and a few lines already in it, and the person
 * edits rather than starts.
 *
 * The imagery reuses the same curated Unsplash photo set as the story covers.
 * That's deliberate — no image-generation API, no per-image cost, no waiting,
 * and the board looks like the rest of the app rather than like a different
 * product bolted on.
 */

import { coverImage, themeFor, type ImageTheme } from "@/features/stories/imagery";
import { desirePhraseOr } from "@/features/moments/desire-phrase";

export type BoardSeed = {
  title: string;
  category?: string | null;
  desires?: string[];
  /** The dream's own affirmations, already written. Used before anything canned. */
  affirmations?: string[];
};

const LINES_BY_CATEGORY: Record<string, string[]> = {
  wealth: [
    "Money is something I understand, not something that happens to me",
    "I make decisions with the numbers in front of me",
    "Enough is a number I've actually chosen",
  ],
  career: [
    "I do work that uses the best of me",
    "I'm allowed to want more than this",
    "I ask for things before I feel ready",
  ],
  love: [
    "I'm easy to be close to",
    "I say the true thing early",
    "I let people in before it's tidy",
  ],
  travel: [
    "I go, rather than plan to go",
    "The world is more reachable than it feels",
    "I say yes to the trip",
  ],
  home: [
    "My space looks like someone lives here on purpose",
    "I'm building something that's mine",
    "Home is a feeling I can construct",
  ],
  calm: [
    "I can be unhurried and still be moving",
    "Rest isn't something I earn",
    "I notice what's already good",
  ],
};

const UNIVERSAL_LINES = [
  "I keep going on days that don't feel special",
  "Small and repeated beats big and rare",
  "I'm becoming the person this asks for",
];

export type SuggestedItem = { kind: "image"; imageUrl: string } | { kind: "text"; body: string };

/**
 * Six items — four photos and two lines, interleaved.
 *
 * Six because a board of three looks unfinished and a board of twelve looks
 * like homework. Photos outnumber words because a wall of sentences is a
 * notes app, not a vision board.
 */
export function suggestBoardItems(seed: BoardSeed): SuggestedItem[] {
  const category = seed.category?.trim().toLowerCase() ?? "";
  const theme: ImageTheme = (
    ["wealth", "love", "career", "calm", "health", "confidence", "travel", "home"] as ImageTheme[]
  ).includes(category as ImageTheme)
    ? (category as ImageTheme)
    : themeFor(seed.title);

  const lines = LINES_BY_CATEGORY[category] ?? UNIVERSAL_LINES;

  /**
   * Their own affirmations first — the real ones, written for this dream.
   *
   * Two templates used to compete here and both lost. The canned lines put
   * "Money is something I understand" onto a board about a Defender. And the
   * supposedly-personal fallback was itself a slot — "I am becoming the person
   * for whom ${dream} is ordinary" — which produced "the person for whom i am
   * earning $10k weekly is ordinary" the moment somebody typed a sentence
   * instead of a noun. The same slot bug as the stories and the programmes.
   *
   * The app already writes six real affirmations per dream and marks one as
   * the anchor. Those are the words that belong on a board. The canned lines
   * survive only for a board made before any exist — the one case where
   * something generic genuinely beats an empty grid.
   */
  const fromAffirmations = (seed.affirmations ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2);

  const chosenLines = [...fromAffirmations, ...lines].slice(0, 2);

  return [
    { kind: "image", imageUrl: coverImage(`${seed.title}-1`, theme) },
    { kind: "text", body: chosenLines[0]! },
    { kind: "image", imageUrl: coverImage(`${seed.title}-2`, theme) },
    { kind: "image", imageUrl: coverImage(`${seed.title}-3`, theme) },
    { kind: "text", body: chosenLines[1] ?? UNIVERSAL_LINES[0]! },
    { kind: "image", imageUrl: coverImage(`${seed.title}-4`, theme) },
  ];
}
