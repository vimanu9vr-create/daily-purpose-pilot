// Writes the daily "moment" — a short present-tense scene built from the
// user's own goal. The client falls back to an on-device composer if this
// isn't deployed, so the feature degrades rather than breaks.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

/**
 * ## Why this was rewritten: "the stories don't feel real"
 *
 * They didn't, and the prompt was the reason. Four Defender stories in a row
 * were the same story — sit somewhere quiet, hold a warm mug, work out your
 * monthly savings target. Across all 359 AI stories: 334 ended with a homework
 * instruction, 83 were about budgeting, 80 involved a warm mug.
 *
 * Three lines I wrote did that.
 *
 * "End with one small concrete action they could take today" — 334 of 359.
 * A story that finishes by assigning you a task is not a story, and it forced
 * every single one to land in the same place.
 *
 * "Describe the user DOING the work" plus "never describe the outcome" — I was
 * so wary of promising things that I banned the only content a manifestation
 * story has. If you cannot write about having it, the model's only remaining
 * move is planning to get it, and planning to get a car is arithmetic. Hence
 * eighty-three spreadsheets.
 *
 * "The place is where they are; the thing they want is what they're thinking
 * about" — this put the dream permanently at arm's length. The person is never
 * in it. They are always in a kitchen, thinking about it.
 *
 * ## And the fourth report: "stories are negative"
 *
 * Right, and it was this prompt again. Reading the endings: "tomorrow the
 * nearside indicator relay needs changing", "the squeak in the dashboard
 * speaker that needs fixing before the weekend", "nobody needs to see it
 * parked out here in the drizzle". Every story closed on a defect.
 *
 * My first fix was to cap the imperfection at one and pin it to the middle.
 * Still wrong, and it took one question to see why: why does a new car have
 * problems? It doesn't. I had imported a fiction-writing habit — specificity
 * through flaw — into an app whose whole purpose is imagining the life you
 * actually want. Nobody manifests a rattle.
 *
 * So imperfection is gone entirely, and "nothing is wrong with it" is a rule
 * rather than a matter of degree. Believability is the assigned sense's job.
 *
 * ## The distinction I had collapsed
 *
 * Describing an imagined future is not the same as promising one.
 *
 *   "You're driving it on a wet road at six in the morning"  — imagination.
 *     That is what the exercise IS, and everyone reading knows it.
 *   "It's on its way to you"                                 — a claim about
 *     the world, and the thing that makes these apps dishonest.
 *
 * The old prompt banned both. So the honesty rule now targets causal claims
 * only, and the scene is allowed to be set in a life where it's already true.
 *
 * ## And why it's set LATER rather than on the day
 *
 * "The day you finally get the keys" is a daydream everyone has already had by
 * themselves, and it's the version that feels like a lie. "A wet Tuesday eight
 * months in, when you've stopped noticing it" is stranger, more specific, and
 * far more affecting — it asks you to imagine being the person rather than
 * imagine the prize.
 *
 * ## The regression my own fix caused, one hour later
 *
 * Told the stories were off-topic, I added "unmistakably present by the second
 * sentence, IN THEIR OWN WORDS" and kept an older rule, "use their exact words
 * for it". Both were aimed at a noun. "Defender car" is a noun; you can drop it
 * into a sentence and it reads.
 *
 * "I am earning $10k per week" is not a noun. It is a first-person sentence
 * about a wish, and these stories are second-person descriptions of a life.
 * Instructed to reproduce it exactly, the model did:
 *
 *   "Now that I am earning $10k per week, your Tuesdays do not have an urgency."
 *   "Ever since your manifestation app taking off and going viral everywhere,
 *    Tuesdays have become a sanctuary of calm."
 *
 * Of the twenty-four stories written by that version, TEN contained "I" or "my"
 * inside a second-person story and SEVEN opened a sentence with "Because…" or
 * "Now that…". I had fixed off-topic and shipped ungrammatical.
 *
 * Two lessons, and the second is the one that keeps recurring.
 *
 * A desire title has a GRAMMATICAL SHAPE, not just content. Some are nouns,
 * some are sentences, some are fragments. Any rule that says "use their words"
 * has to say WHICH words — the nouns and the numbers — or it is an instruction
 * to paste one grammar into another.
 *
 * And: "mention this by sentence two" is a requirement a model can satisfy
 * cheaply by bolting on a clause. Requirements get met in the laziest way that
 * technically complies.
 *
 * ## Banning the cheap construction just moves it
 *
 * I banned "Because…", "Now that…", "Ever since…". The causal clauses went to
 * zero. In the next batch four stories of twelve did this instead:
 *
 *   "The summary confirms what is now completely ordinary: I am making $10k a week."
 *   "the weekly payout line is sitting right there, clear as day: I am making $10k a week."
 *
 * Same tic, moved to a colon. A fifth put it in dialogue, which my own rule had
 * explicitly permitted by saying "no first person OUTSIDE quoted speech".
 *
 * Whack-a-mole, and I was the mole. The lesson is that banning a CONSTRUCTION
 * never works, because the requirement that produces it is still there and
 * there is always another construction. "State this early" will always be
 * satisfied by whatever cheap device has not yet been forbidden.
 *
 * So the requirement itself is gone. There is no longer any instruction to
 * state the subject. There is an instruction to make it INFERABLE from
 * physical detail, plus a test — delete every abstract statement from the
 * draft and see whether the remaining details still give it away.
 *
 * The stories that were already working needed none of this. "Three thick
 * bricks of banded fifties sit on the hall table." "The weekly payout line is
 * sitting right there." "Your defender car rests at the edge of the overlook."
 * Those tell you what the dream is without a word of announcement, and they
 * were being written before any of my rules were added.
 */
const SYSTEM_PROMPT = `You write a short visualization for a manifestation app. It is listened to with eyes closed. Its job is to let someone spend two minutes inside a life where the thing they want is already true.

THE STORY IS ABOUT THE THING THEY WANT. This overrides everything else in this prompt.

- A reader must be able to tell what this story is about FROM THE CONCRETE DETAILS ALONE, without it ever being stated. A figure somewhere it can be read. An object being used. A consequence visible in the room.
- THE SENTENCE THEY TYPED MUST NEVER APPEAR IN THE STORY. Not as narration, not spoken aloud, not printed on a screen, not after a colon, not in quotation marks, nowhere. Take their NOUNS AND NUMBERS instead and write your own sentences around those.
- NEVER write "I", "I'm", "I am" or "my". Anywhere, including inside quotation marks. The story is "you", the whole way through.
- DO NOT ANNOUNCE IT AND THEN DESCRIBE IT. Every device for stating the thing and moving on is banned: a causal clause ("Because…", "Now that…", "Ever since…", "Thanks to…"), an appositive after a colon ("…what has become your life: …"), and a line of dialogue that says it out loud. If you find yourself reaching for one of these, you have not found the scene yet — go and find it.
- The test for whether you have found it: delete every abstract statement from your draft. If the remaining physical details still make the subject obvious, it works. If they don't, the details are wrong and no amount of stating it will fix them.
- The scene has to be one that only makes sense BECAUSE they have it. It should be materially responsible for what is happening.
- THE TEST, and apply it before you answer: if you could swap in a completely different desire and the story would still work unchanged, you have written the wrong story. Start again.
- If what they want is an amount of money, a state, or an achievement rather than an object, it still has to be physically visible — what it pays for, what it removed, what it changed about the room, the day, or the decision. A figure appearing somewhere it can be read is in the scene. A person feeling calm near a window is not.

THE SCENE IS SET AFTER THEY HAVE IT — and not on the day they got it. Later. Months later, once it has become ordinary. The day-you-get-it version is a daydream they have already had on their own; the months-later version is the one that does something.

Form:
- Second person, present tense. 4 to 6 short paragraphs, 150-220 words.
- Sensory detail SPECIFIC TO THIS THING, not to nice things in general. Never "your car", never "your new place". Work out what this particular thing is actually like to live with and use that.
- Use their own NOUN for the thing. If they wrote "defender car", the story says defender, not "the vehicle" and not "your car". A noun, never their whole sentence — see the rule above.
- Quiet and ordinary throughout. No triumph, no music swelling, nobody applauding.
- PUT PEOPLE IN IT. Not crowds — one or two specific people, doing something small and ordinary nearby: someone in the next room, a friend across a table, a stranger who has no idea. A life is other people, and a scene with nobody in it reads as a showroom. If they have named anybody, that person is who it is.

NOTHING IS WRONG WITH IT. A rule, not a preference:
- No faults. Nothing broken, worn out, sticking, rattling, leaking, needing fixing, needing paying for, or needing doing at the weekend. Not at the end, not in the middle, nowhere.
- The thing is in good condition and behaving. If it would be new, it is new.
- Believability is the job of the specific sensory detail you have been given, NOT of a defect. A precise description of how something sounds convinces far better than a list of what is wrong with it, and it doesn't turn somebody's imagined life into a chore.

HOW IT ENDS — this matters as much as how it starts:
- The last paragraph lands on the ease of it being yours: the quiet of it, the ordinariness, the fact that this is simply your life now.
- Do not end on an instruction. Not a task, not a problem — a settled image.
- Contentment, not victory.

NEVER — each of these produced hundreds of identical stories:
- Never mention saving, budgeting, monthly targets, down payments, affording it, spreadsheets, or planning how to get it. The scene is set after they have it, so this is not part of it.
- Never end with an instruction or a task. No "today, do X". End inside the scene.
- Never use these: a warm mug, hands wrapped around a cup, a deep breath, "steady", "deliberate", "grounding", "unglamorous", "not waiting for luck", "quiet grit".

THE FIRST LINE — it is the card preview, so it is the part that looks repeated:
- Do NOT begin with "You're…", "You've…", "You sit…", "You wake…" or "It's…". Those are the default openings and they make every story read as one voice saying one thing, however different the scenes are.
- Do not open by describing the weather or the light. "It's raining and the light is soft" is the single most common way these start and it says nothing.
- Do not open on food, cooking, coffee or a kitchen unless what they want IS food, cooking, coffee or a kitchen.
- Open on something happening, something concrete, or something absent. An object. A sound. A negation. Mid-action. A fragment.
- DO NOT NAME A DAY OF THE WEEK, in the body or the title. You are given a time of day to anchor the scene in, which does the same job.

The one honesty rule: never claim the world will deliver it. No "it's on its way", no "the universe is arranging this", no timelines, no guarantees, no "this is already yours" as a promise about reality. Describing an imagined scene is fine — that is the whole exercise. Predicting events is not.

Return ONLY JSON: {"title": "...", "body": "..."} where body uses \\n\\n between paragraphs. Title is 2-5 words and contains no colon. No markdown fence.`;

/**
 * Which moment of already having it each story is set in.
 *
 * ## Why this replaced a list of places
 *
 * The old list was sixteen places to sit quietly — a kitchen at night, a park
 * bench, a stairwell, a train. It fixed the original complaint ("you sit at
 * your desk for everything") by rotating the furniture, and it was still the
 * wrong axis. Every story remained a person somewhere calm, thinking about a
 * thing they don't have. Change the room and you get the same story in a
 * different room, which is precisely what the Defender feed looked like:
 * kitchen table, cafe, window seat, a walk — and four identical budgeting
 * sessions inside them.
 *
 * So the assigned variable is no longer WHERE they are. It's WHICH MOMENT of
 * a life that already contains this thing they're inside. That single change
 * makes the stories differ in substance rather than in scenery.
 *
 * Assigned rather than discouraged, for the same reason as before: forty
 * stories are written in parallel, so none of them can see the others, and an
 * instruction to "be different from what you've written" has nothing to read.
 * A constraint beats an instruction.
 *
 * ## And why half of them had to be rewritten again
 *
 * I wrote this list while thinking about a Defender, and it showed. "A small
 * everyday use of it", "coming back to it after a few days away", "using it for
 * something boring and practical", "an unhurried afternoon with it" — every one
 * assumes a physical object you can pick up and go somewhere in.
 *
 * Handed "I am earning $10k per week", there is no "it" to come back to. The
 * model resolved the contradiction the only way it could, by inventing an
 * object, and a money dream produced a story about sitting in a warm car.
 *
 * "Bad weather, and this making the difference" was worse: pure scenery, no
 * connection to any desire at all. Given a weekly income it produced "The Aroma
 * of Bad Weather" — rain gear, a coffee grinder, toasted oats, and not one
 * mention of the money. That is the exact story that got reported.
 *
 * So every entry now refers to "this" as the FACT of having it rather than as
 * an object, and each one has to make sense for all three shapes a desire
 * comes in: a thing, a state, and an amount.
 */
const MOMENTS = [
  "an ordinary morning, long after this stopped being new",
  "a day when nothing in particular is happening and this is simply true",
  "someone who knew you before noticing, and you not making much of it",
  "a small ordinary consequence of this you would never have thought to picture",
  "a decision that used to be difficult, made in about four seconds",
  "arriving somewhere, in no hurry to move",
  "the quiet hour of a day this made possible",
  "an unhurried free afternoon this paid for, nothing that has to be done",
  "an early start that would once have been miserable",
  "the first hour back after a few days away",
  "night, and nowhere you have to be",
  "realising you haven't thought about wanting this in weeks",
  "something boring and practical, handled without a second thought",
  "sharing what this makes possible with someone, without ceremony",
  "a moment where the old version of you would have flinched",
  "the end of a long day, and it is still true",
];

/**
 * Pick a moment. Deterministic, so the same request always gets the same one.
 *
 * Both inputs matter. Variant alone would give every desire the same sequence,
 * so a user with four desires would see the same moment four times in one
 * feed. Subject alone would give one desire one moment forever. Combined, the
 * feed varies across both axes.
 */
function sceneFor(variant: number | undefined, subjectTitle: string): string {
  let hash = 0;
  for (const char of subjectTitle) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const index = Math.abs(hash) + (typeof variant === "number" ? Math.abs(variant) : 0);
  return MOMENTS[index % MOMENTS.length]!;
}

/**
 * Which sense each story is built out of.
 *
 * ## Why this had to be assigned too
 *
 * The prompt used to name three concrete Defender details as an illustration
 * of what "specific" means: the weight of the door, diesel clatter at idle,
 * mud dried along the sills. Across the first twelve stories written with it,
 * nine mentioned diesel clatter, nine had a heavy door and eight had mud on
 * the sills.
 *
 * An example in a prompt is not an illustration. It is an instruction, and it
 * is the strongest one in the file. I replaced "warm mug" with "diesel
 * clatter" and called it a fix — the same failure one level up, and I would
 * have kept making it, because the examples were the part that felt most
 * obviously helpful.
 *
 * So the examples are gone and the variation is structural instead. Each story
 * is handed one sense to build from, the same way it is handed a moment. Two
 * stories about the same object now differ because one is about how it sounds
 * and the other about how cold it is, rather than because a model was asked
 * nicely to be different from stories it cannot see.
 */
const REGISTERS = [
  "sound — what you hear, and what you stop hearing",
  "weight and resistance — what takes effort to move, push, lift or hold",
  "smell — including the unglamorous ones",
  "temperature — cold hands, slow heat, the moment it turns",
  "texture under the hands — worn, gritty, smooth, sticky",
  "light — where it falls and what it misses, without describing the weather",
  "space and scale — height, width, what fits and what doesn't",
  "the small sounds and movements of other people nearby",
];

function registerFor(variant: number | undefined, subjectTitle: string): string {
  let hash = 0;
  for (const char of subjectTitle) hash = (hash * 17 + char.charCodeAt(0)) | 0;
  const index = Math.abs(hash) + (typeof variant === "number" ? Math.abs(variant) : 0);
  return REGISTERS[index % REGISTERS.length]!;
}

/**
 * When in the day the scene happens.
 *
 * ## Why this exists at all: banning a word does not remove the need for it
 *
 * Thirteen of twenty-nine stories named Tuesday. Zero named Wednesday,
 * Thursday, Saturday or Sunday. I removed the word "weekday" that was priming
 * it and added a rule — DO NOT NAME A DAY OF THE WEEK — and the next batch
 * still named one in three of six.
 *
 * That is the fourth ban I have written today and the fourth to be worked
 * around, and the pattern is finally clear: a scene needs to be anchored in
 * time, "an ordinary Tuesday" is the single most available way to do that in
 * English, and forbidding it leaves the need in place with nothing to meet it.
 * A ban tells the model what not to reach for. It does not put anything else
 * within reach.
 *
 * So the day is replaced rather than forbidden. The same trick that fixed
 * diesel clatter (assigned REGISTERS) and fixed every story being the same
 * scene (assigned MOMENTS): hand it a constraint instead of a prohibition.
 * Eight times of day, assigned deterministically, so the anchor is already
 * there and specific before the model goes looking for one.
 *
 * The ban stays as a backstop, but it is no longer doing the work.
 */
const TIMES = [
  "first light, before anything has started",
  "mid-morning",
  "the middle of the afternoon",
  "late afternoon, with the light going",
  "early evening",
  "after dark, with the day finished",
  "the small hours, everyone else asleep",
  "the hour either side of noon",
];

function timeFor(variant: number | undefined, subjectTitle: string): string {
  let hash = 0;
  for (const char of subjectTitle) hash = (hash * 13 + char.charCodeAt(0)) | 0;
  const index = Math.abs(hash) + (typeof variant === "number" ? Math.abs(variant) : 0);
  return TIMES[index % TIMES.length]!;
}

/**
 * Which AI provider to call.
 *
 * GEMINI FIRST, and that ordering is the point.
 *
 * Every text feature in this app — stories, affirmations, the daily action,
 * milestones — was sharing one OpenAI account. When its balance ran out, all
 * four stopped at once and each silently fell back to a local template. The
 * app didn't look broken; it looked bland, in four different places, which is
 * far harder to diagnose and exactly what happened.
 *
 * Google exposes Gemini through an OpenAI-compatible endpoint, so switching is
 * a URL and a model name — the request and response shapes are identical. It
 * has a free tier that comfortably covers this app's text volume, which means
 * the writing keeps working whether or not there is money in the account.
 *
 * OpenAI stays as the second choice for anyone who prefers it, and the Lovable
 * gateway as the third, so nothing that worked before stops working.
 */
function resolveProvider(): { url: string; apiKey: string; model: string } | null {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (geminiKey) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: geminiKey,
      // 2.5-flash 404s for accounts that never used it. See MODEL_LADDER.
      model: Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash",
    };
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: openaiKey,
      model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini",
    };
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) return { url: GATEWAY_URL, apiKey: lovableKey, model: MODEL };

  return null;
}

/**
 * Ask, and keep asking sensibly when the provider says no.
 *
 * ## Why this asks "could another model help?" rather than listing error codes
 *
 * I have now written this function three times, and each time I handled
 * exactly the failure I had just seen in the logs and called it fixed. First
 * 429 only — and the real error turned out to be 404. Then 429 and 404 — and
 * the real error turned out to be 503. Each version looked complete, and each
 * left the app on templates for a reason I hadn't thought of yet.
 *
 * So the rule is inverted. Instead of enumerating what to survive, it asks
 * whether a different model could possibly help — and the answer is yes for
 * everything except a request that is wrong in itself. That way the next
 * unfamiliar status code is already handled.
 *
 * The failures seen so far, and why each lands where it does:
 *
 * PER MINUTE — 429 with "Please retry in 15.4s". A queue, not a wall. The
 * provider is telling you exactly when it will serve you, so wait and re-ask
 * the SAME model; giving up throws away a request that was available.
 *
 * PER DAY — 429 with "You exceeded your current quota" and no retry time,
 * because there isn't one: gone until midnight Pacific. Waiting is useless, so
 * move on. Requests-per-day is metered per model, so the next rung is a fresh
 * allowance.
 *
 * MODEL GONE — 404. Retired, renamed, or closed to new accounts. Move on.
 *
 * OVERLOADED — 503, "experiencing high demand". Transient and specific to that
 * model, so another one will usually answer immediately. Move on.
 */
/**
 * Fallbacks, in order, each with its own daily allowance.
 *
 * ## Why none of these are 2.5
 *
 * gemini-2.5-flash returns 404 on this account: "This model is no longer
 * available to new users. Please update your code to use models/gemini-3.6-flash."
 * Not deprecated-and-still-serving — closed to accounts that hadn't already
 * used it. So every text call in the app was 404ing, which is why the writing
 * stayed on templates even after the quota reset. I'd fixed the quota and the
 * real error underneath it was a different number entirely.
 *
 * gemini-3.6-flash is the model Google's own error message names. The rest are
 * current stable lites, each metered separately.
 */
const MODEL_LADDER = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

/**
 * Is this worth trying a different model for?
 *
 * Yes for everything except a request that is wrong in itself. 400, 401 and
 * 403 mean a malformed prompt or a bad key, which fail identically on every
 * model in the ladder — walking the whole list would be four identical
 * failures and four times the wait.
 */
function anotherModelMightHelp(status: number): boolean {
  if (status < 400) return false;
  return status !== 400 && status !== 401 && status !== 403;
}

async function askWithRetry(
  send: (model: string) => Promise<Response>,
  model: string,
  maxWaitMs = 20_000,
): Promise<Response> {
  const start = MODEL_LADDER.indexOf(model);
  const ladder = start === -1 ? [model, ...MODEL_LADDER] : MODEL_LADDER.slice(start);

  let last: Response | null = null;

  for (const candidate of ladder) {
    let response = await send(candidate);
    if (!anotherModelMightHelp(response.status)) return response;

    const body = await response
      .clone()
      .text()
      .catch(() => "");

    // Anything that isn't a per-minute limit: another model is the fix, and
    // waiting on this one is not.
    if (response.status !== 429) {
      console.warn(`${candidate}: ${response.status}, dropping to the next model`);
      last = response;
      continue;
    }

    const suggested = /retry in ([\d.]+)s/i.exec(body)?.[1];

    if (suggested) {
      // Per-minute. Waiting is the whole fix — the same model will serve it.
      const waitMs = Math.ceil(Number(suggested) * 1000) + 500;
      if (waitMs <= maxWaitMs) {
        console.warn(`${candidate}: per-minute limit, waiting ${waitMs}ms as instructed`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        response = await send(candidate);
        if (response.status !== 429) return response;
      }
    } else {
      // Per-day. Waiting is pointless; the allowance is gone until midnight.
      console.warn(`${candidate}: daily quota exhausted, dropping to the next model`);
    }

    last = response;
  }

  return last!;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const provider = resolveProvider();
    const apiKey = provider?.apiKey;
    if (!apiKey) return json({ error: "not_configured" }, 503);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) return json({ error: "unauthorized" }, 401);

    const { goalId, desireId, variant, tweak, previous } = (await req.json().catch(() => ({}))) as {
      goalId?: string;
      desireId?: string;
      variant?: number;
      /**
       * A change the reader asked for in their own words: "make it my sister",
       * "less about the office", "put my dog in it".
       *
       * Stella's reviewers ask for exactly this and report that it doesn't
       * work — "when I try to modify the story, it doesn't change" — which
       * makes it the clearest open ground in the category. A story you can
       * correct is the difference between a generator and something that
       * belongs to you.
       */
      tweak?: string;
      /** The story being changed, so the rewrite keeps what was already right. */
      previous?: string;
    };

    // Two callers, two different tables.
    //
    // Home sends `desireId` — the thing the user typed into the box. That was
    // being ignored entirely: the function only read `goalId`, so an unmatched
    // request fell through to "the newest active goal" and wrote *that* story
    // against whatever desire the loop happened to be on. Every card came out
    // about the same old goal. Two stories in the database titled "Feeling
    // Super Rich" are filed under "Being deeply loved" and "My own apartment".
    // Nothing about it was custom.
    let subject: {
      title: string;
      why?: string | null;
      feeling?: string | null;
      obstacles?: string | null;
      progress?: number | null;
    } | null = null;

    if (desireId) {
      const desiresRes = await fetch(
        `${supabaseUrl}/rest/v1/desires?select=title,description&id=eq.${encodeURIComponent(desireId)}&limit=1`,
        { headers: { Authorization: authHeader, apikey: anonKey } },
      );
      const desires = desiresRes.ok ? await desiresRes.json() : [];
      const desire = Array.isArray(desires) ? desires[0] : null;
      if (desire) subject = { title: desire.title, why: desire.description };
    }

    if (!subject) {
      const filter = goalId ? `id=eq.${encodeURIComponent(goalId)}` : "status=eq.active";
      const goalsRes = await fetch(
        `${supabaseUrl}/rest/v1/goals?select=title,why,feeling,obstacles,category,progress&${filter}&order=created_at.desc&limit=1`,
        { headers: { Authorization: authHeader, apikey: anonKey } },
      );
      const goals = goalsRes.ok ? await goalsRes.json() : [];
      const goal = Array.isArray(goals) ? goals[0] : null;
      if (goal) subject = goal;
    }

    // If a specific desire was asked for and doesn't exist, don't quietly
    // substitute something else — that's the bug this replaces.
    if (!subject) {
      return json({ error: "no_subject", message: "Nothing to write about yet." }, 400);
    }

    /**
     * WHO THIS IS FOR. The app collects this at onboarding and then threw it away.
     *
     * Stella's best reviews are not about the writing being good — they are
     * about it being about THEM. "I've listened to 3-4 stories and have been
     * balling my eyes out, it feels so real." The one complaint in that same
     * review is that the app mispronounces a specific person's name, which
     * means the stories contain the names of people in their life.
     *
     * This app asks for a name, a desired feeling, the obstacle in the way and
     * a preferred tone during onboarding, stores all four on `profiles`, and
     * then wrote every story from a bare desire title. Nothing that made it
     * theirs ever reached the page. That is not a missing feature; it is a
     * missing line of code between two tables that already exist.
     *
     * Fetched as the user, so RLS keeps it to their own row.
     */
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=display_name,desired_feeling,obstacles,tone&limit=1`,
      { headers: { Authorization: authHeader, apikey: anonKey } },
    );
    const profiles = profileRes.ok ? await profileRes.json() : [];
    const profile = (Array.isArray(profiles) ? profiles[0] : null) as {
      display_name?: string | null;
      desired_feeling?: string | null;
      obstacles?: string | null;
      tone?: string | null;
    } | null;

    const firstName = profile?.display_name?.trim().split(/\s+/)[0] ?? "";

    /**
     * Ordering and force, both deliberate. See §CONTEXT-WEIGHT in NOTES.
     *
     * The subject is stated first, framed as the requirement, and repeated at
     * the end. The moment and the sense are explicitly demoted to modifiers of
     * it. This is not decoration: the previous version listed the desire as a
     * bare label and gave the sense the only imperative in the whole block —
     * "LEAD WITH THIS SENSE, and do not lean on any other" — which made the
     * scenery the strongest instruction present and the dream the weakest.
     *
     * A model given "$10k per week", "bad weather" and "smell, do not lean on
     * any other" wrote a story about rain gear, a coffee grinder and toasted
     * oats, and never mentioned the money once. It obeyed perfectly. I had
     * simply told it the wrong thing was important.
     */
    const subjectBlock = [
      `WRITE ABOUT THIS, and nothing else: ${subject.title}`,
      subject.why ? `WHY IT MATTERS TO THEM: ${subject.why}` : "",
      subject.feeling ? `HOW THEY WANT IT TO FEEL: ${subject.feeling}` : "",
      subject.obstacles ? `WHAT'S IN THE WAY: ${subject.obstacles}` : "",
      subject.progress != null ? `MILESTONE PROGRESS: ${subject.progress}%` : "",
    ].filter(Boolean);

    const aboutThem = [
      firstName ? `THEIR NAME: ${firstName} — you may use it, sparingly. Once is plenty.` : "",
      profile?.desired_feeling
        ? `THE FEELING THEY ARE AFTER: ${profile.desired_feeling}. The last paragraph should land there.`
        : "",
      profile?.obstacles
        ? `WHAT HAS BEEN IN THEIR WAY: ${profile.obstacles}. Do not mention it, argue with it, or solve it. Use it to know what its ABSENCE looks like in the scene — that absence is the point.`
        : "",
      profile?.tone ? `TONE THEY ASKED FOR: ${profile.tone}` : "",
    ].filter(Boolean);

    /**
     * A rewrite is a different job from a first draft, so it gets its own block
     * and it goes LAST — the thing nearest the end of a prompt is the thing a
     * model weights most, and this one has to beat every assigned angle above
     * it. Somebody who has typed a correction has been clearer about what they
     * want than any rotation of mine.
     */
    const rewriteBlock =
      tweak && previous
        ? [
            "THIS IS A REWRITE, NOT A NEW STORY. Keep everything that already worked and change only what they asked for.",
            `WHAT THEY ASKED FOR, in their words: ${tweak}`,
            "If their request conflicts with any assigned angle above, THEIR REQUEST WINS. Ignore the angle.",
            "",
            "THE STORY AS IT STANDS:",
            previous.slice(0, 2400),
          ].join("\n")
        : null;

    const context = [
      subjectBlock.join("\n"),
      ...(aboutThem.length > 0 ? [aboutThem.join("\n")] : []),
      [
        "The three lines below choose the ANGLE on the subject above. They are not the subject. If any of them pulls the story away from it, ignore that line and keep the subject.",
        `WHICH MOMENT OF ALREADY HAVING IT: ${sceneFor(variant, subject.title)}`,
        `WHICH SENSE TO NOTICE IT THROUGH: ${registerFor(variant, subject.title)}`,
        `WHEN IN THE DAY THIS HAPPENS: ${timeFor(variant, subject.title)} — this is the time anchor, so there is no need to name a day of the week.`,
      ].join("\n"),
      [
        `Before you answer, check both of these.`,
        `1. Is what they want unmistakably present in the first paragraph, SHOWN as part of the scene?`,
        `2. Does the text contain "I", "I'm", "my", or the phrase "${subject.title}" copied out anywhere at all — including in quotation marks, in speech, on a screen, or after a colon? If so, rewrite it. You are describing their life back to them as "you", using your own sentences.`,
      ].join("\n"),
      ...(rewriteBlock ? [rewriteBlock] : []),
    ].join("\n\n");

    const upstream = await askWithRetry(
      (model) =>
        fetch(provider!.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            // Higher temperature: repetition across days is the #1 complaint about apps like this.
            temperature: 1.0,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: context },
            ],
          }),
        }),
      provider!.model,
    );

    /**
     * Log why, not just that.
     *
     * Every chat call in the app returned 429 for a whole day and none of them
     * said anything about it, because this line returned before logging. A 429
     * from OpenAI is either "too many requests" or "no credit", and those need
     * completely different responses — one is our burst, the other is the
     * account. Not knowing which cost a day of guessing at symptoms.
     */
    if (upstream.status === 429) {
      const reason = await upstream.text().catch(() => "");
      console.error("rate limited by provider", reason.slice(0, 400));
      return json({ error: "rate_limited", detail: reason.slice(0, 200) }, 429);
    }
    if (upstream.status === 402) return json({ error: "credits_exhausted" }, 402);
    if (!upstream.ok) {
      console.error("gateway error", upstream.status, await upstream.text().catch(() => ""));
      return json({ error: "upstream_error" }, 502);
    }

    const payload = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = (payload.choices?.[0]?.message?.content ?? "").trim();
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned) as { title?: string; body?: string };
      if (parsed.body?.trim()) {
        return json({ title: parsed.title ?? "Today's moment", body: parsed.body }, 200);
      }
    } catch {
      // Model returned prose instead of JSON — usable as-is.
      if (cleaned.length > 80) return json({ title: "Today's moment", body: cleaned }, 200);
    }

    return json({ error: "empty" }, 502);
  } catch (error) {
    console.error("ai-moment failed", error);
    return json({ error: "internal_error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
