/**
 * Curated affirmations, grouped the way people actually think about their lives.
 *
 * These are written as present-tense identity statements, which is the standard
 * form in the research on self-affirmation — the point is to rehearse the values
 * and self-image you want to act from, not to assert that a wish will come true.
 * Nothing here promises an outcome.
 */

export type AffirmationCategory = {
  id: string;
  label: string;
  blurb: string;
  emoji: string;
  affirmations: string[];
};

export const AFFIRMATION_CATEGORIES: AffirmationCategory[] = [
  {
    id: "self-love",
    label: "Self-love",
    emoji: "🤍",
    blurb: "Speaking to yourself the way you'd speak to someone you love.",
    affirmations: [
      "I am allowed to take up space.",
      "I treat myself with the patience I extend to everyone else.",
      "My worth was never up for negotiation.",
      "I am not behind. I am on my own timeline.",
      "I forgive myself for what I did not yet know.",
      "I am learning to be gentle with the parts of me that are still healing.",
      "I do not have to earn rest.",
      "I like who I am becoming.",
      "My body carries me through every day. I speak to it kindly.",
      "I am enough before I achieve anything else today.",
      "I release the need to be understood by everyone.",
      "I choose myself without apology.",
      "I am worthy of the things I want, exactly as I am.",
      "My feelings are information, not weakness.",
      "I am proud of how far I have come, even if no one saw it.",
    ],
  },
  {
    id: "confidence",
    label: "Confidence",
    emoji: "✨",
    blurb: "Standing in what you're capable of, especially before you feel ready.",
    affirmations: [
      "I trust myself to figure things out.",
      "I have handled hard things before. I can handle this.",
      "I speak clearly about what I want.",
      "I belong in the rooms I walk into.",
      "I do not shrink to make others comfortable.",
      "My voice is worth hearing.",
      "I act before I feel ready, because readiness follows action.",
      "I am allowed to want more.",
      "I make decisions and I stand behind them.",
      "I would rather try and learn than wait and wonder.",
      "Nervousness and excitement feel the same. I choose to call this excitement.",
      "I am becoming someone who follows through.",
      "I take up my full height.",
      "Being a beginner is not the same as being incapable.",
    ],
  },
  {
    id: "career",
    label: "Career",
    emoji: "🎯",
    blurb: "The identity behind the work — showing up, asking, building.",
    affirmations: [
      "I do work I am proud to put my name on.",
      "I ask for what I am worth.",
      "I am building skills that compound.",
      "Every version of me that came before made this possible.",
      "I bring value to the work I do.",
      "I focus on the one thing that moves this forward.",
      "Rejection redirects me. It does not define me.",
      "I am willing to be bad at something new.",
      "My work has a shape and a direction.",
      "I choose depth over busyness.",
      "I finish what I start.",
      "I am the kind of person who follows up.",
    ],
  },
  {
    id: "abundance",
    label: "Abundance",
    emoji: "🌱",
    blurb: "A steady, unanxious relationship with money and enough-ness.",
    affirmations: [
      "I make clear-headed decisions about money.",
      "I am becoming someone who handles money with care.",
      "There is enough for me and enough for others.",
      "I look at my finances without flinching.",
      "I spend in line with what I actually value.",
      "My income is something I can influence.",
      "I do not measure my worth in numbers.",
      "I am building something that lasts longer than this month.",
      "I can be grateful for what I have and still want more.",
      "Small consistent choices compound in my favour.",
    ],
  },
  {
    id: "peace",
    label: "Inner peace",
    emoji: "🌊",
    blurb: "For the loud days. Coming back to the present, without forcing calm.",
    affirmations: [
      "I can be anxious and still be safe.",
      "This feeling is moving through me. It is not staying.",
      "I do not have to solve everything today.",
      "I am allowed to put this down for now.",
      "My breath is here. I can return to it any time.",
      "I release what was never mine to carry.",
      "Not every thought deserves my attention.",
      "I choose the next small thing instead of the whole mountain.",
      "Slowing down is not falling behind.",
      "I am here, in this moment, and this moment is manageable.",
      "I let go of the conversation I keep replaying.",
      "Peace is something I practise, not something I wait for.",
    ],
  },
  {
    id: "relationships",
    label: "Relationships",
    emoji: "💛",
    blurb: "Boundaries, warmth, and being known.",
    affirmations: [
      "I give the kind of love I want to receive.",
      "I say no without a paragraph of explanation.",
      "I let people show me who they are.",
      "I am worth being chosen clearly.",
      "I can love someone and still hold a boundary.",
      "I attract people by being fully myself, not less of myself.",
      "I do not chase what does not want to stay.",
      "I let myself be known.",
      "I am learning to receive as easily as I give.",
      "The right people find my honesty easy to be around.",
    ],
  },
  {
    id: "health",
    label: "Health",
    emoji: "🌿",
    blurb: "Care rather than punishment. Movement, rest, and food without guilt.",
    affirmations: [
      "I move my body because it feels good, not as punishment.",
      "I rest before I am running on empty.",
      "I feed myself with care.",
      "Consistency serves me better than intensity.",
      "I listen to what my body is telling me.",
      "A missed day is a missed day, not a failure.",
      "I am building strength slowly and honestly.",
      "Sleep is not time I am losing.",
      "I take care of the version of me that exists next year.",
    ],
  },
  {
    id: "growth",
    label: "Growth",
    emoji: "🌤",
    blurb: "For the middle of the process, where most of the work happens.",
    affirmations: [
      "I am allowed to change my mind.",
      "Progress is rarely visible from inside it.",
      "I am willing to be uncomfortable for something that matters.",
      "I learn faster than I criticise myself.",
      "The gap between where I am and where I want to be is not a verdict.",
      "I do the boring part, because the boring part is the work.",
      "I am not the same person I was a year ago.",
      "Starting again is not starting over.",
      "I let go of who I thought I had to be.",
      "Today counts, even if it was small.",
    ],
  },
];

export function categoryById(id: string): AffirmationCategory | undefined {
  return AFFIRMATION_CATEGORIES.find((c) => c.id === id);
}

export function allAffirmations(): { text: string; category: string }[] {
  return AFFIRMATION_CATEGORIES.flatMap((c) =>
    c.affirmations.map((text) => ({ text, category: c.id })),
  );
}

/**
 * Deterministic daily pick — the same affirmation all day, a different one
 * tomorrow. Seeded by the day number so it doesn't jump on re-render.
 */
export function affirmationOfTheDay(pool: { text: string; category: string }[], date = new Date()) {
  if (pool.length === 0) return undefined;
  const dayNumber = Math.floor(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000,
  );
  return pool[dayNumber % pool.length];
}
