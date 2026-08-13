/**
 * Cover imagery for story cards.
 *
 * Hand-picked Unsplash photo IDs per theme, served from Unsplash's image CDN.
 * No API key, no rate limit on the CDN, and the Unsplash licence permits this
 * use. Picking by hash rather than at random keeps a given story's cover
 * stable across renders and reloads.
 */

export type ImageTheme =
  "wealth" | "love" | "career" | "calm" | "health" | "confidence" | "travel" | "home";

const PHOTOS: Record<ImageTheme, string[]> = {
  wealth: [
    "photo-1512453979798-5ea266f8880c",
    "photo-1519681393784-d120267933ba",
    "photo-1470071459604-3b5ec3a7fe05",
    "photo-1507525428034-b723cf961d3e",
  ],
  love: [
    "photo-1516589178581-6cd7833ae3b2",
    "photo-1518199266791-5375a83190b7",
    "photo-1522075469751-3a6694fb2f61",
    "photo-1494774157365-9e04c6720e47",
  ],
  career: [
    "photo-1497215728101-856f4ea42174",
    "photo-1522071820081-009f0129c71c",
    "photo-1454165804606-c3d57bc86b40",
    "photo-1521737604893-d14cc237f11d",
  ],
  calm: [
    "photo-1506126613408-eca07ce68773",
    "photo-1518241353330-0f7941c2d9b5",
    "photo-1499209974431-9dddcece7f88",
    "photo-1447752875215-b2761acb3c5d",
  ],
  health: [
    "photo-1571019613454-1cb2f99b2d8b",
    "photo-1517836357463-d25dfeac3438",
    "photo-1490645935967-10de6ba17061",
    "photo-1518611012118-696072aa579a",
  ],
  confidence: [
    "photo-1524504388940-b1c1722653e1",
    "photo-1531123897727-8f129e1688ce",
    "photo-1488426862026-3ee34a7d66df",
    "photo-1529626455594-4ff0802cfb7e",
  ],
  travel: [
    "photo-1507525428034-b723cf961d3e",
    "photo-1476514525535-07fb3b4ae5f1",
    "photo-1502920917128-1aa500764cbd",
    "photo-1520250497591-112f2f40a3f4",
  ],
  home: [
    "photo-1502672260266-1c1ef2d93688",
    "photo-1493809842364-78817add7ffb",
    "photo-1522708323590-d24dbb6b0267",
    "photo-1560448204-e02f11c3d0e2",
  ],
};

/** Maps our affirmation categories and free-text onto an image theme. */
export function themeFor(input: string | null | undefined): ImageTheme {
  const text = (input ?? "").toLowerCase();
  if (/wealth|money|abundance|rich|financ|business/.test(text)) return "wealth";
  if (/love|relationship|partner|romance|dating|marriage/.test(text)) return "love";
  if (/career|job|work|promotion|interview|business/.test(text)) return "career";
  if (/peace|calm|anxiet|stress|sleep|quiet|inner/.test(text)) return "calm";
  if (/health|fit|body|exercise|strong|weight/.test(text)) return "health";
  if (/confiden|self|worth|esteem|voice|bold/.test(text)) return "confidence";
  if (/travel|holiday|vacation|beach|abroad/.test(text)) return "travel";
  if (/home|house|apartment|space|move/.test(text)) return "home";
  return "confidence";
}

/** Stable hash so a story keeps the same cover forever. */
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Every photo in the set, used as an overflow pool.
 *
 * Four photos per theme meant a feed of twelve cards showed the same three
 * pictures repeatedly, and because themeFor() falls through to "confidence"
 * for most free text, the majority of cards drew from a single pool of four.
 * Spreading across the whole set when a theme runs out is the difference
 * between "curated" and "did this app only download four images".
 */
const ALL_PHOTOS: string[] = Object.values(PHOTOS).flat();

/**
 * A cover for a card.
 *
 * Two hashes rather than one. The first picks inside the matching theme; if
 * the theme's pool is small relative to how many cards are on screen, the
 * second spreads the overflow across every photo we have. A card keeps the
 * same cover forever either way, because both hashes are of the seed.
 */
export function coverImage(seed: string, theme?: ImageTheme, width = 800): string {
  const key = theme ?? themeFor(seed);
  const pool = PHOTOS[key];
  const n = hash(seed);

  // Two thirds stay on-theme; the rest reach into the wider set so a long
  // scroll doesn't become the same four pictures.
  const id = n % 3 === 2 ? ALL_PHOTOS[n % ALL_PHOTOS.length]! : pool[n % pool.length]!;

  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`;
}
