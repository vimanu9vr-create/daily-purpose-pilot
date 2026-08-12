/**
 * Today's action — one concrete thing to do, written from the desire.
 *
 * This is the line the whole product sits on. Everything else in the app is
 * rehearsal: stories, affirmations, visualisation. Rehearsal is useful and
 * it's also where competitors stop, which is why their reviews are full of
 * people saying it felt nice and nothing changed.
 *
 * So the honest claim is narrow and defensible: we don't say that picturing a
 * thing causes it. We say picturing it makes you more likely to act, and then
 * we hand you the action. If someone does the action every day for a month,
 * something real has happened regardless of what they believe about the rest.
 *
 * Three rules the actions have to obey, or they're worse than nothing:
 *
 *   Doable today. "Start a business" is not an action, it's the desire again.
 *   Small enough to do badly on a bad day. Fifteen minutes, not two hours.
 *   Never a promise. No action here implies an outcome is guaranteed.
 *
 * This local version runs on device with no AI and no cost. The edge function
 * writes better ones when it's reachable — this is the floor, not the ceiling,
 * and the floor has to be good because it's what people see offline and on
 * the free tier.
 */

export type ActionSeed = {
  title: string;
  category?: string | null;
  why?: string | null;
};

/**
 * Actions per category.
 *
 * Written as verbs, in second person, sized for a weekday evening. They rotate
 * by day so the same person doesn't get the same instruction twice in a row.
 */
const BY_CATEGORY: Record<string, string[]> = {
  wealth: [
    "Open your banking app and read every transaction from the last seven days. Don't judge them — just look.",
    "Find one subscription you'd forgotten you pay for. Decide whether to keep it.",
    "Write down what you earned and what you spent last month. Two numbers, nothing else.",
    "Move a small amount — whatever is genuinely spare — into a separate account you don't touch.",
    "Name one thing you buy on autopilot. Skip it once today.",
    "Spend fifteen minutes reading about one way people in your field earn more.",
  ],
  career: [
    "Update one section of your CV. Just one — the most out-of-date part.",
    "Message one person who does the job you want and ask them a single specific question.",
    "Write down the three things you'd want in your next role, in order.",
    "Spend fifteen minutes on the skill that keeps appearing in job listings you like.",
    "Find one job posting that excites you. Don't apply. Just note what it asks for.",
    "Ask someone you worked with recently what you're good at. Write down what they say.",
  ],
  business: [
    "Write down, in one sentence, who your customer is and what they're stuck on.",
    "Talk to one person who has the problem you want to solve. Ask, don't pitch.",
    "Spend twenty minutes on the smallest version of your idea that someone could actually use.",
    "List the three things stopping you from launching. Cross off the ones that aren't real.",
    "Write the first sentence of how you'd describe this to a stranger.",
    "Do the boring administrative thing you've been putting off for a week.",
  ],
  health: [
    "Move for fifteen minutes. Walking counts. It doesn't have to be good.",
    "Drink water first thing, before coffee, before your phone.",
    "Go to bed thirty minutes earlier than yesterday. Set the alarm to remind you.",
    "Cook one meal today instead of ordering it.",
    "Stretch for five minutes at the point in the day you usually get stiff.",
    "Notice one thing your body did well today and say so.",
  ],
  relationships: [
    "Send a message to someone you've been meaning to contact. Two lines is enough.",
    "Ask someone how they actually are, and stay quiet long enough for a real answer.",
    "Tell one person something you appreciate about them, specifically.",
    "Put your phone in another room for the next conversation you have.",
    "Make a plan with someone — an actual date, not 'we should catch up'.",
    "Apologise for the small thing you've been carrying around.",
  ],
  learning: [
    "Read for twenty minutes on the thing you keep saying you'll learn.",
    "Do one practice exercise. Badly is fine.",
    "Write down what you understood today in your own words, without looking.",
    "Find one person who's good at this and watch how they do it for fifteen minutes.",
    "Pick the one concept you keep skipping over. Sit with it until it makes sense.",
    "Teach what you learned this week to someone, or to a blank page.",
  ],
  creativity: [
    "Make something small and bad for fifteen minutes. Finishing isn't the point.",
    "Write down three ideas without deciding whether any are good.",
    "Return to the piece you abandoned and do one more pass.",
    "Study something you love and work out what it's actually doing.",
    "Show one person the thing you haven't shown anyone.",
    "Set a timer for ten minutes and start before you feel ready.",
  ],
  wellbeing: [
    "Sit still for five minutes with nothing to do. No phone.",
    "Write down what's actually worrying you. All of it, unedited.",
    "Say no to one thing today that you'd normally agree to.",
    "Go outside for ten minutes without your phone.",
    "Name the feeling you've been avoiding. You don't have to fix it.",
    "Do one thing today purely because you want to.",
  ],
};

/**
 * When we don't recognise the category. Deliberately generic in structure but
 * specific in size — a vague action is the same as no action.
 */
const UNIVERSAL = [
  "Spend fifteen minutes on this. Set a timer so it has an end.",
  "Write down the very next physical step. Not the plan — the next step.",
  "Do the smallest part of this that you could finish today.",
  "Name what's actually in the way. Write it down in one sentence.",
  "Tell one person what you're working toward.",
  "Spend ten minutes on the part you've been avoiding.",
];

function poolFor(seed: ActionSeed): string[] {
  const key = seed.category?.trim().toLowerCase() ?? "";
  return BY_CATEGORY[key] ?? UNIVERSAL;
}

/** Day number, so everyone's action changes at midnight and not on re-render. */
function dayNumber(date: Date): number {
  return Math.floor(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000,
  );
}

/**
 * Today's action for a desire.
 *
 * Deterministic per desire per day: two devices opening the app at the same
 * moment produce the same sentence, and it doesn't shuffle if you navigate
 * away and come back.
 */
export function composeAction(seed: ActionSeed, date = new Date(), offset = 0): string {
  const pool = poolFor(seed);
  // Mixing the title in means two desires in the same category on the same day
  // don't get identical instructions.
  const titleSeed = [...seed.title].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const index = Math.abs(dayNumber(date) + titleSeed + offset) % pool.length;
  return pool[index]!;
}

/** How many alternatives exist, for the "give me a different one" button. */
export function actionVariantCount(seed: ActionSeed): number {
  return poolFor(seed).length;
}
