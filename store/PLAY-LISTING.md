# Google Play — everything the listing needs

Written to be copied field by field. Where a limit exists it's noted, and every
piece of text here is already inside it.

The fourteen-day clock only starts once twelve testers have **opted in**, not
when you upload. That's the reason to do this before anything else on the list.

---

## The parts only you can do

1. **Pay the $25.** One-off, at [play.google.com/console/signup](https://play.google.com/console/signup). Identity verification can take a day or two, so this is genuinely the first step.
2. **Create the signing key.** Instructions below. Back it up somewhere you won't lose it — if it's gone you cannot ever update the app under this package name.
3. **Find twelve testers.** Real Google accounts. They have to accept the invite and install; twelve installs that never opted in do not count.

Everything else below is ready to paste.

---

## Store listing

**App name** (30 characters max — this is 10)

```
ManifestAI
```

**Short description** (80 max — this is 74)

```
Manifestation stories written for your dream, in a real human voice.
```

**Full description** (4000 max — this is about 1,700)

```
Tell ManifestAI what you actually want — in your own words — and it writes short
manifestation stories about it, narrated in a real human voice.

Not a library everyone else is listening to. Every story is written from the
sentence you typed.

WHAT YOU GET

Stories written for your dream
Type "I want to buy a Defender" and you get stories set in a life where that's
already true — an ordinary Tuesday, months in, when it has stopped being new.
Written fresh, never picked off a shelf.

A real human voice
Studio narration, not your phone's robot reader. It's the difference between
listening to a session and enduring one.

Affirmations in your own words
Six written from each dream, with one marked as the line to carry around all
day — the short, physical one you can say out loud without wincing.

Sleep, meditations and healing frequencies
Full-length sessions that run for the time they promise. An 18-minute track is
18 minutes.

A coach that already knows
It has read your goals, so you never start by explaining yourself again.

WHAT THIS APP WILL NOT DO

It will not tell you that thinking about something makes it happen. There's no
evidence for that, and pretending otherwise would be selling you something.

What it does is give you two minutes inside the life you want, in a voice worth
hearing, and one small thing to do about it. Visualisation helps you notice and
take chances to act. That's the honest mechanism, and it's the one this app is
built on.

PRICING

Free to use for as long as you like.

Standard unlocks everything written — unlimited stories, affirmations, coaching
and the whole library to read.

Voice adds the narrated human voice on top: stories, sleep sessions and
meditations read aloud rather than read by you.

ManifestAI is a personal development tool for reflection and visualisation. It
is not therapy, medical advice, or a guarantee of results.
```

---

## Categorisation

| Field | Value |
| --- | --- |
| App or game | App |
| Category | Health & Fitness |
| Tags | Meditation, Self-improvement, Sleep |
| Contact email | vimanu9.vr@gmail.com |
| Website | https://daily-purpose-pilot.vimanu9-vr.workers.dev |
| Privacy policy | https://daily-purpose-pilot.vimanu9-vr.workers.dev/privacy |

---

## Graphics

| Asset | Size | Where it is |
| --- | --- | --- |
| App icon | 512×512 | `public/icons/icon-512.png` |
| Feature graphic | 1024×500 | `store/feature-graphic-1024x500.png` |
| Phone screenshots | min 2, up to 8 | **You need to take these** |

For screenshots, the four worth capturing, in this order — the first two are
what people actually judge:

1. Home, with a dream selected and its story cards showing
2. A story open in the player, mid-sentence, with the photograph behind it
3. The affirmations row with the anchor line at the top
4. The library, showing sleep and meditation

Take them on a real phone, or in Chrome DevTools at Pixel 7 size. Play wants
16:9 or 9:16, minimum 320px on the short side.

---

## Data safety form

Answer these honestly — Play cross-checks against what the app actually does,
and a wrong answer here is a rejection.

**Does your app collect or share user data?** Yes.

| Data type | Collected | Shared | Why | Optional? |
| --- | --- | --- | --- | --- |
| Name | Yes | No | App functionality (greeting you by name) | Yes |
| Email address | Yes | No | Account management | No |
| App activity (your dreams, affirmations, journal) | Yes | No | App functionality | No |
| Crash logs | Yes | No | Diagnostics | No |

**Is data encrypted in transit?** Yes.
**Can users request deletion?** Yes — Settings → Delete account, in the app.

Say **no** to advertising, analytics-sharing with third parties, location, and
financial info. None of that is true of this app, and claiming it would be as
wrong as omitting something.

---

## Content rating questionnaire

Category: **Reference, News, or Educational**. Answer no to every violence,
sexuality, drugs, gambling and profanity question — they're all no here.

One question needs care: the app **does** reference wellbeing and mental
health topics. Say yes. It'll land at PEGI 3 / Everyone, which is right.

---

## Building the AAB

The package is already configured: `com.manifestai.app`, versionCode 1,
versionName 1.0, minSdk 24, targetSdk 36.

**Create the signing key once.** Keep the file and the passwords safe — losing
them means never being able to update this app again.

```bash
cd ~/Claude/Projects/"Manifest anything Ai"
keytool -genkey -v -keystore manifestai-release.keystore \
  -alias manifestai -keyalg RSA -keysize 2048 -validity 10000
```

Then tell Gradle about it, in `android/keystore.properties` (this file must
never be committed — check it's in `.gitignore` first):

```
storeFile=../manifestai-release.keystore
storePassword=YOUR_PASSWORD
keyAlias=manifestai
keyPassword=YOUR_PASSWORD
```

The Gradle side is already wired — `android/app/build.gradle` reads that file
and signs the release build with it. If the file is missing the build still
works, it just produces an unsigned bundle, which Play rejects on upload with
an unhelpful error. So if the upload fails, check this file exists first.

**Build it:**

```bash
npm run build:native     # NOT `npm run build` — Capacitor reads dist-native/client
npx cap sync android     # copy it into the Android project
cd android && ./gradlew bundleRelease
```

The file to upload lands at
`android/app/build/outputs/bundle/release/app-release.aab`.

---

## Closed testing

1. Play Console → **Testing → Closed testing → Create track**
2. Upload the AAB
3. Add your twelve testers by email, or make a Google Group and add that
4. Send them the opt-in link and **check they actually accept and install** —
   this is the step that starts the clock, not the upload
5. Fourteen continuous days later, **Promote to production** unlocks

Tell testers what you want to know. "Let me know if it breaks" gets nothing;
"open a story, listen to the whole thing, tell me if the voice sounds wrong"
gets you something.

---

## Before you upload — things that are currently untrue in the listing

The description above sells four things that don't work yet. Fix or remove
each before this goes to real testers.

- **Sleep and meditation sessions.** Thirty library tracks have no audio at
  all, including all seven sleep and meditation ones. Run the narration at
  `/app/voice-lab`.
- **The subscription.** No payment path exists on any platform. Either wire
  Google Play Billing through RevenueCat before uploading, or cut the pricing
  paragraph and ship it free for the test.

  When you do wire it, five products need creating — the ids are in
  `src/features/billing/plans.ts` and they must match character for character
  or the plan won't appear on the device:

  | Product id | Type | Price |
  | --- | --- | --- |
  | `com.manifestai.standard.monthly` | Subscription | $4.99 / month |
  | `com.manifestai.standard.yearly` | Subscription | $29.99 / year |
  | `com.manifestai.standard.lifetime` | One-time | $99.99 |
  | `com.manifestai.voice.monthly` | Subscription | $14.99 / month |
  | `com.manifestai.voice.yearly` | Subscription | $119.99 / year |

  In RevenueCat, the two Voice products carry the `premium` entitlement and the
  three Standard ones do not — but the app doesn't trust that anyway. The
  webhook writes the plan id onto the `subscriptions` row and `narrate-story`
  reads it there, so entitlement configuration is a convenience, not the gate.
- **The coach.** Three replies ever. Have a conversation with it first.
- **Notifications.** Never fired once. Either fix or don't mention them.
