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

  // If they've written desires, use their own words first — a line someone
  // typed themselves lands harder than one we wrote for them.
  const fromDesires = (seed.desires ?? [])
    .slice(0, 2)
    .map((desire) => `I am becoming the person for whom ${desirePhraseOr(desire)} is ordinary`);

  const chosenLines = [...fromDesires, ...lines].slice(0, 2);

  return [
    { kind: "image", imageUrl: coverImage(`${seed.title}-1`, theme) },
    { kind: "text", body: chosenLines[0]! },
    { kind: "image", imageUrl: coverImage(`${seed.title}-2`, theme) },
    { kind: "image", imageUrl: coverImage(`${seed.title}-3`, theme) },
    { kind: "text", body: chosenLines[1] ?? UNIVERSAL_LINES[0]! },
    { kind: "image", imageUrl: coverImage(`${seed.title}-4`, theme) },
  ];
}
