# Where the gap actually is

Written 7 August 2026 from Stella's public reviews (642 written reviews averaging 3.3,
against a 4.7 store rating — that gap is the whole opportunity) and from what this
codebase already does.

## You are already ahead on three of their five biggest complaints

Worth knowing before building anything, because it changes what's urgent.

**Price.** Their most-mentioned complaint, 42 times. Users report $30–40 a month billed
weekly. You are at $8.99 monthly, $49.99 yearly. That is roughly a quarter of their
price, and it is already in the code.

**Cancelling.** A recurring one-star theme: people can't find the subscription in their
Apple account to cancel it. Your profile screen already links straight to
`apps.apple.com/account/subscriptions`. That's `store.ts`, `manageUrl()`. Already done,
and worth saying out loud in the store listing.

**The paywall ambush.** Several one-star reviews describe answering a long questionnaire
and only then being told it costs $40 a month. Your onboarding is six short steps and
opens into a genuinely usable free tier. No wall. Keep it that way — it is a real
differentiator and it costs nothing to preserve.

So the honest position is that the *product decisions* are already right. The gap is
execution.

## What actually needs building

### 1. Reliability, and being able to see failures

Their second-biggest complaint, 27 mentions, is glitches — and the specifics are
uncomfortably familiar: "playback is buggy, and the refresh countdown doesn't work and
my daily moment only worked on day 1", "it takes so long to load and sometimes when it's
loading, it'll stop and start, which is super annoying for getting into a really deep
visualization state." One user lost their account and all saved manifestations in an
update.

This is where the competition is genuinely beatable, and it is also where this app has
been weakest. This week alone: stale edge function deploys hid for three days, a push
subscription bug survived four rounds of testing, and an 18-minute sleep track contained
forty seconds of audio. Every one of those was found because a human hit it and said so.

That does not scale. The first thing to build is error reporting — Sentry on the
frontend, structured logging in the edge functions — so failures surface without a user
having to complain. Second is a small set of tests around the things that have actually
broken: does a clean install build, does a push subscription match the current VAPID key,
do declared track durations match their scripts.

Unglamorous, and the highest-value work available.

### 2. Speed — stop making people wait for a model

"It takes so long to load" is the review that should worry you most, because the same
thing happens here. First play of a story blocks on ElevenLabs for several seconds.

The ten catalogue tracks are identical for every user. They should be narrated once,
stored, and served from a CDN — not regenerated per person. That removes the wait
entirely for the most-played content and cuts the largest cost line at the same time.

Personal stories still need per-user audio, but they can be generated ahead of being
opened rather than on tap.

### 3. Offline

Stella advertises offline access. This app has none — `sw.js` deliberately caches
nothing. For an app people use in bed, on planes, and on bad hotel wifi, that's a real
gap rather than a nice-to-have. Once narration audio is a stored file rather than a live
call, caching it for offline play is a small step.

### 4. The scripts are still too short

An 18-minute sleep session currently holds about forty seconds of speech over seventeen
minutes of ambience. It is honest now — the session really does last its stated time —
but it is thin. Proper 8-to-15 minute scripts for all ten catalogue tracks is writing
work rather than engineering, and it is what makes the paid tier feel worth paying for.

### 5. Say less, and say why

Data privacy appears 18 times in their complaints, mostly about how much personal
information is collected before anything is given back. Your six onboarding steps are
already modest. Worth an explicit line at the start saying what each answer is used for
and that it never leaves your account — cheap to add, and directly targets a stated
reason people distrust the category.

## What not to do

Don't add features. Stella's problem is not a missing feature; it's that the features
they have don't work reliably. Matching them feature-for-feature and then being equally
buggy wins nothing.

Don't rewrite in another framework yet. Nothing in that complaint list is caused by
React or by Capacitor.

Don't cut the price further. A quarter of their price is already a strong position, and
going lower makes the ElevenLabs bill dangerous.

## Order

Error reporting first, because everything after it is guesswork without it. Then
pre-generated catalogue audio, which fixes the loading complaint and the cost problem
together. Then offline. Then the scripts. Then submit.

Realistically two to three weeks of focused work, most of it not visible in the
interface — which is exactly why the incumbent hasn't done it.

## The thing that isn't on this list

Twenty-two stories exist in your database and none has been played to the end. Their
reviews include "Felt so deeply I cried" and "some of my small manifestations have
already happened." People are getting a real emotional payoff from this category.

Whether yours delivers that is not something I can determine by reading code, and it
matters more than any item above.
