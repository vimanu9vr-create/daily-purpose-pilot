npx supabase functions deploy push-config --project-ref pkxkksamenqcvsaulceq --use-api
git add -A && git commit -m "Serve the VAPID public key from one source; confirm notification time saves" && git push# ManifestAI — Phase 1: Beta Tester Acquisition System

6 September 2026. Objective: **20–25 applicants → 15–20 genuine testers → 12+ continuously opted in for 14 days → production access.**

Assets built alongside this document:
- `growth/beta/index.html` — the landing page
- `growth/beta/thanks.html` — the thank-you page
- `growth/beta/beta_applications.sql` — the lead database, with row-level security

---

## 1. Positioning

### The analysis

| Question | Answer |
|---|---|
| **Core problem** | People know what they want and still don't do anything about it daily. They quit around day four, and they blame themselves rather than the tool. |
| **Core desire** | To stop feeling like life is happening to them — and, underneath that, to become someone who follows through. |
| **Main transformation** | From "I have a vision board and no idea what today looks like" → "I know the one thing I'm saying and the one thing I'm doing today." |
| **Strongest feature** | The anchor line — one affirmation, chosen for you, labelled *say this one*. Instant, personal, unique in the category. |
| **Strongest differentiator** | The practice ends with **a specific action**. Nobody else in this category attempts the link from visualisation to behaviour. |
| **Weakest feature** | The 21-day journeys are barely surfaced, and the daily action is only as good as the AI writing it. Both are fixable, neither is proven yet. |
| **Biggest marketing opportunity** | The category's own reviews. Every competitor is hammered for weekly paywalls, repetitive content and dark-pattern onboarding. Being visibly honest is a differentiator that costs nothing. |
| **Biggest reason to install** | "It writes it for *my* goal" — demonstrated in fifteen seconds of screen recording. |
| **Biggest reason NOT to install** | "I already have an affirmations app and I stopped using it." Category fatigue, not skepticism. |
| **Biggest reason to pay** | The voice, and the sense that the thing is theirs. |
| **Biggest reason NOT to pay** | Free competitors are good enough for the shallow version of this, and $19.99/mo is a lot next to $35.99/year for "I am". |

### The decisions

**Positioning statement**
> ManifestAI is the manifestation app that tells you what to do today. Every other app in this category gives you something to read; ManifestAI takes the specific thing you want and turns it into a five-minute practice you can finish — one line to say, one short session, one small action.

**Tagline**
> **Manifest your goal. Practice it every day.**

Kept from your hypothesis, because it's already right: it names the goal *and* the practice, and "practice" is the whole differentiator. The alternatives you offered are weaker — "Turn what you want into a daily practice" is abstract, and "Your dream needs more than an affirmation" argues with the customer before it's earned the right to.

**Value proposition**
> Most manifestation apps hand you a quote and leave the hard part to you. ManifestAI takes one goal you actually care about and writes your affirmations, your visualisations and your daily practice from it — five minutes, ending with one thing small enough to actually do today.

**Elevator pitch (30 seconds)**
> Everyone who tries manifesting quits around day four. Not because they stopped wanting it — because nothing told them what to do on Wednesday. ManifestAI takes the sentence you type — "leave my job by June", "a calmer mind" — and turns it into a five-minute daily practice written for that goal: one line to say, a short guided session, one small action. It's the difference between an app that inspires you and an app you actually finish. Android beta now, twenty testers.

**Claims discipline.** Never say the app causes outcomes. The defensible mechanism, which the app's own store copy already states well: visualisation helps you notice and act on opportunities, and consistency is what compounds. Frequencies are marketed as audio for focus and sleep — never as having a physical or health effect.

---

## 2. Target audience

Ten segments, scored 1–5 (higher is better). "Reach" means how cheaply and precisely you can get in front of them *right now*, with a small budget and no audience of your own.

| # | Segment | Pain | Desire | Try | Pay | Reach | Low comp. | Retain | **Total** |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Lapsed manifesters, F 24–34, Android, India metro/tier-2** | 5 | 5 | 5 | 3 | 5 | 3 | 4 | **30** |
| 2 | Lapsed manifesters, F 25–34, US/UK | 5 | 5 | 4 | 5 | 2 | 2 | 4 | 27 |
| 3 | Job-switchers / career-stuck, 25–35 | 5 | 5 | 4 | 4 | 3 | 3 | 3 | 27 |
| 4 | Habit & self-improvement readers (Atomic Habits crowd) | 4 | 4 | 4 | 5 | 3 | 2 | 5 | 27 |
| 5 | Students & exam aspirants, 18–24, India | 4 | 5 | 5 | 1 | 5 | 4 | 3 | 27 |
| 6 | Early-stage founders / solopreneurs | 4 | 4 | 3 | 5 | 3 | 4 | 4 | 27 |
| 7 | Breakup / self-worth rebuilders | 5 | 5 | 5 | 2 | 4 | 3 | 2 | 26 |
| 8 | Anxiety & overthinking, seeking calm | 5 | 4 | 4 | 4 | 2 | 1 | 4 | 24 |
| 9 | Spiritual / LOA community (369, angel numbers) | 3 | 5 | 5 | 2 | 4 | 2 | 2 | 23 |
| 10 | Corporate wellness / HR buyers | 2 | 2 | 1 | 5 | 1 | 4 | 4 | 19 |

### Primary audience for the beta

**Women 24–34 in India who have tried manifesting and stopped, on Android, with a specific goal in money, career, self-worth or calm.**

Why this one, specifically for *beta recruitment* — which is a different problem from customer acquisition:

1. **Android is not optional here.** Google Play closed testing is Android-only. Roughly 95% of Indian smartphones are Android, versus about half in the US. Segments 2 and 4 skew iPhone, which makes them structurally worse for this phase even though segment 2 is your best *paying* audience later.
2. **You are in IST.** Testers in your timezone can be onboarded, chased and unblocked the same day. Across a 14-day clock where one dropout resets progress, same-day response is worth more than it sounds.
3. **Meta CPMs in India run a fraction of US/UK.** With a small budget you can buy enough reach to find 25 applicants; the same money in the US buys a few hundred impressions and no testers.
4. **Segment 5 scores nearly as high but can't pay.** Fine for filling a tester list, wrong for learning anything about pricing. Your beta should be made of people who *could* become customers, or the feedback tells you nothing commercial.
5. **The pain is strongest here.** She has already spent money on this category and already quit. That's the exact wound your positioning speaks to.

**What this means concretely:** ads targeted to India, English-language, women 24–34, interests around manifestation / law of attraction / journalling / self-improvement, Android placement only.

**Note for Phase 2, not now:** segment 2 (US/UK) is your revenue audience. Beta in India, monetise internationally. Don't let the beta audience quietly become the whole ICP.

---

## 3. Acquisition strategy

Four channels, in the order you should spend effort on them. You need **25 applicants**, not 25,000 — this is a small, finite hunt, and the first channel usually finishes it.

| Channel | Expected applicants | Cost | Effort | Notes |
|---|---|---|---|---|
| **Direct outreach (personal network)** | 10–15 | ₹0 | 2 hours | Highest quality, fastest. Do this first, today. |
| **Meta/Instagram ads** | 10–20 | ₹4,000–6,000 total | 3 hours setup | Predictable, and it doubles as a real test of your hooks before launch. |
| **Organic Reels** | 3–8 | ₹0 | Ongoing | Slow to start, but every asset is reusable at launch. |
| **Communities** | 3–10 | ₹0 | 2 hours | r/androidapps, r/alphaandbetausers, r/lawofattraction, Discord/Telegram beta groups. Read each group's rules before posting. |

**Do not use tester-swap or paid tester services.** Since 2026 Google checks that testers genuinely used the app, and a roomful of developers installing to be installed back gives you nothing but a clock. Your own notes already say the unknown thing is whether the writing lands — swap testers can't answer that.

**Recruit 25, expect 18 to accept, expect 14 to stay opted in.** Attrition is normal; plan for it rather than being surprised at day 9.

---

## 4–7. Landing page, form, thank-you page, database

Built. Three files in `growth/beta/`.

**To deploy:**

1. Run `beta_applications.sql` in the Supabase SQL Editor. This creates the table with insert-only row-level security — anonymous visitors can apply, nobody can read anyone else's application.
2. Host `index.html` and `thanks.html` anywhere static: Cloudflare Pages, Netlify drop, or a `/beta` route on your existing Worker. No build step, no dependencies.
3. Add your Meta Pixel and GA4 snippet before `</head>` on both pages. The code already fires `form_start`, `beta_application_submitted` and `Lead` — the events exist, they just need the pixels loaded.
4. Test one submission end to end, then check the row landed in `beta_pipeline`.

**Why Supabase rather than Google Forms:** you already have it, it costs nothing, the data is queryable, and the page stays on-brand. Google Forms converts worse — a branded page that matches the ad is a meaningful conversion difference at this scale, and the form *is* the ad's landing experience.

The publishable key in the page is public by design; it ships inside your app bundle already. The RLS policy is what protects the table. Never put a `service_role` or `sb_secret_` key in that file.

### The database

The SQL file creates every column you listed, using types rather than free text where it matters (`status` is a constrained enum, dates are timestamps). Two things worth knowing:

- **`beta_pipeline` view** gives you the daily working list with a `first_read` column that pre-flags iPhone applicants and suspiciously thin goals.
- **Unique index on lowercased email** prevents the duplicate-invite problem before it happens.

If you'd rather work in Google Sheets, export the view — but keep Supabase as the source of truth, because the form writes there.

**Useful queries:**

```sql
-- Today's new applications
select * from beta_pipeline where status = 'new';

-- Funnel, at a glance
select status, count(*) from beta_applications group by status order by count(*) desc;

-- Are we at 12 yet?
select count(*) from beta_applications where status in ('opted_in','installed','active');

-- Which ad actually produced testers, not just leads
select campaign, ad,
       count(*) as leads,
       count(*) filter (where status = 'qualified') as qualified,
       count(*) filter (where status in ('opted_in','installed','active')) as testers
from beta_applications group by campaign, ad order by testers desc;
```

---

## 8. Qualification rules

Run these in order. First match wins.

**NOT QUALIFIED**
- `android = 'no'` → iPhone. Reply kindly, add to launch list. (Unless `android = 'both'`, which qualifies.)
- Goal is blank, gibberish, or under ~12 characters ("money", "asdf"). Not a rejection of short goals — a rejection of no thought.
- Email and Google Play email are both obviously disposable domains.
- Applicant explicitly asks what they get paid. Wrong motivation; they'll drop at day 4.

**QUALIFIED** — all of:
- Android (or both)
- Both emails valid, Play email is a Google-capable address
- Goal is a real, specific sentence
- Agreement checkbox ticked
- Applied through a channel you can identify

**WAITLIST**
- Qualified but you already have 20 invited. Keep 5 warm — you will need them around day 3.
- Goal is real but vague ("be happy"). One reply asking them to sharpen it; if they answer, promote to qualified. The reply itself is a commitment test.

**Priority within qualified** — invite in this order:
1. Goal in money / career / self-worth (your strongest segment, and the goals the AI writes best for)
2. Answered "yes — and I stopped" to the *tried before* question (your exact positioning)
3. Came from direct outreach (highest follow-through)
4. Everyone else

**Invite 20 to get 12.** Do not invite exactly 12.

---

## 9. Email sequence

Send from a real personal address, not `noreply@`. Plain text, no template, no images — it's a beta run by a person, and it should read that way. Deliverability is better too.

---

### Email 1 — Application received
**Send:** immediately on submit (automate)
**Subject:** Got your ManifestAI application
**Preview:** Here's what happens next, and when.

> Hi {{name}},
>
> Thanks for putting your name in. I read every one of these myself, so this isn't an autoresponder pretending — it's just written in advance.
>
> Here's what happens next. I'm taking twenty people for this round. Within 48 hours you'll hear from me either way: if you're in, you'll get a Google Play link and short instructions; if this round's full, I'll tell you plainly and offer you a place on the launch list.
>
> One thing that would help: add this address to your contacts. The Play invite is the one email that absolutely has to reach you, and it's the one most likely to get filtered.
>
> You said you're working toward: *{{goal}}*. That's the goal the app will build your practice around, so if it's changed, just reply and tell me.
>
> — Viggnesh, ManifestAI

**CTA:** Add to contacts. (Deliberately tiny — the real CTA is "don't lose the next email".)

---

### Email 2 — You're selected
**Send:** within 48 hours of applying
**Subject:** You're in — ManifestAI beta
**Preview:** 20 people, 14 days, and your Play link is below.

> Hi {{name}},
>
> You're one of the twenty. Thank you for saying yes to this.
>
> Quick honesty before you start: this is a real beta. Some things are rough, one or two are probably broken, and the whole point of you being here is to find them. If you have a nice time and tell me it was lovely, I've learned nothing. Tell me what annoyed you.
>
> What I'm asking, in full:
>
> — Accept the Play invite and install (two taps, link in the next email)
> — Open it on most days for the next 14 days, five minutes
> — Stay opted in for the full two weeks, even on days you don't open it
> — Answer two short forms: one after your first session, one at the end
>
> That's it. Everything's unlocked and free the whole time, and I'm not going to ask you for a review.
>
> Next email has the link. It's the important one.
>
> — Viggnesh

**CTA:** Watch for the next email.

---

### Email 3 — Google Play instructions
**Send:** immediately after Email 2
**Subject:** Your ManifestAI test link (2 taps)
**Preview:** Accept first, then install — that order matters.

> Hi {{name}},
>
> Here's your link:
>
> **{{PLAY_OPT_IN_URL}}**
>
> Two things, in this order:
>
> **1. Open that link on your Android phone and tap "Become a tester."** This is the step that actually registers you. Installing without accepting doesn't count — for you or for me.
>
> **2. Then tap the Play Store link on that same page and install.**
>
> Important: it has to be the Google account **{{play_email}}** — that's the address on the tester list. If you're signed into Play with a different account, the link will look broken. It isn't; it's just the wrong account.
>
> If it doesn't work, reply with a screenshot and I'll sort it out today.
>
> Once you're in: type in one thing you want. Just one. The app builds everything else from it.
>
> — Viggnesh

**CTA:** Accept the invite, then install.

---

### Email 4 — Day 1 onboarding
**Send:** the evening of the day they install
**Subject:** First impressions? (this is the useful one)
**Preview:** Five questions, three minutes, and I'd rather you were blunt.

> Hi {{name}},
>
> You've had a first look. This is the most valuable feedback of the whole fortnight, because you'll never see it with fresh eyes again — by next week you'll have got used to the things that confused you today.
>
> Five questions, three minutes: **{{DAY1_FORM_URL}}**
>
> The one I care most about: **what confused you?** Not what you liked. Everyone's polite about what they liked.
>
> — Viggnesh

**CTA:** Day 1 form.

---

### Email 5 — Day 3 check-in
**Send:** day 3, morning
**Subject:** Day 3 — did you open it again?
**Preview:** Genuinely fine either way. I just need to know which.

> Hi {{name}},
>
> Day three is where almost everyone quits things like this. So I'm asking directly rather than waiting to find out from the numbers.
>
> Have you opened it since the first day?
>
> Just reply with **yes** or **no**. If no, tell me what got in the way — forgot, boring, broken, busy. "Forgot" is the most useful answer you can give me, because that's a thing I can fix.
>
> — Viggnesh

**CTA:** Reply yes or no. (One word. Reply rate matters more than form quality here.)

---

### Email 6 — Day 7 feedback
**Send:** day 7
**Subject:** Halfway — what's annoying you?
**Preview:** One week in. Four questions.

> Hi {{name}},
>
> Halfway. Thank you for still being here.
>
> By now you've seen the thing repeat itself a few times, which is exactly when the cracks show. Four questions: **{{DAY7_FORM_URL}}**
>
> The one I need: **has it started to feel repetitive?** Every app in this category dies of that around week two and I'd rather hear it from you than from a review.
>
> — Viggnesh

**CTA:** Day 7 form.

---

### Email 7 — Day 10 reminder
**Send:** day 10
**Subject:** Quick one — still opted in?
**Preview:** Four days left on the clock.

> Hi {{name}},
>
> Short one. Four days to go.
>
> Google requires testers to stay opted in for the full fourteen days, and if people drop off early the clock resets for everyone in the group. So: **please don't leave the test or uninstall until the 14 days are up**, even if you've stopped opening it.
>
> If you've gone off it completely, that's genuinely fine and useful information — just reply and tell me why. Staying opted in while telling me it didn't work for you is the most helpful thing you can do.
>
> — Viggnesh

**CTA:** Stay opted in; reply if dropping.

---

### Email 8 — Day 14 final feedback
**Send:** day 14
**Subject:** Last one — the form that decides what gets built
**Preview:** Ten minutes, and I mean it about being harsh.

> Hi {{name}},
>
> Fourteen days. You made it, and I'm grateful.
>
> This is the one that matters: **{{DAY14_FORM_URL}}** — about ten minutes.
>
> Two questions in there decide the whole business: *would you keep using it,* and *would you pay for it.* Please answer those honestly rather than kindly. A "no" with a reason is worth more to me than a yes, and it costs you nothing to give.
>
> You can leave the test after you submit this. Instructions are at the end of the form.
>
> — Viggnesh

**CTA:** Day 14 form.

---

### Email 9 — Thank you
**Send:** when they submit the day 14 form
**Subject:** Thank you — and here's what changes
**Preview:** What you said, and what I'm doing about it.

> Hi {{name}},
>
> That's the beta done. Thank you — twenty people gave me two weeks and there's no version of this where that wasn't the difference.
>
> Three things:
>
> **What you changed.** {{one specific thing this tester's feedback altered}}. That came from you.
>
> **Founding tester price.** When ManifestAI goes live you'll get our lowest price, permanently, whatever we charge everyone else. No deadline on it — I'll email you the link.
>
> **You can leave the test now.** Play Store → your profile → Manage apps → ManifestAI → leave the testing programme. Or keep it; you're welcome to.
>
> If you ever want to tell me something else about it, this address goes to me.
>
> — Viggnesh

**CTA:** None. This one is a thank-you, not a step.

---

### Email 10 — Launch announcement
**Send:** launch day
**Subject:** ManifestAI is live — and you're the reason
**Preview:** Your founding price is inside.

> Hi {{name}},
>
> ManifestAI is public today.
>
> You tested it when it was rough. The version that just went live is different because of what you and nineteen other people told me — {{the two or three biggest changes}}.
>
> Your founding tester price: **{{link}}**. Lowest price we do, and it doesn't expire.
>
> No pressure at all if it's not for you. You already did the part that mattered.
>
> If you know someone who'd like it, sending them the link is the single most useful thing you could do next — but only if you actually mean it.
>
> — Viggnesh

**CTA:** Claim founding price.

---

## 10. WhatsApp sequence

Short, lowercase, no formatting. WhatsApp is where the clock actually gets protected — reply rates beat email roughly threefold, and a tester who's gone quiet answers a WhatsApp when they won't answer a form. **Only message people who gave you a number and expect it.**

**Application received**
> hey {{name}} — got your ManifestAI application, thank you. i'll come back within 48 hrs either way. one thing: the play invite comes by email, so keep an eye on spam 🙏

**Selected**
> you're in 🎉 sending the play link by email now. two taps: accept the invite first, then install. shout if it doesn't work and i'll fix it today

**Play opt-in nudge (24h after invite, if not opted in)**
> hey {{name}} — noticed the invite hasn't been accepted yet. the link needs to open on your android phone, signed into {{play_email}}. want me to resend it?

**Installation reminder (48h, if opted in but not installed)**
> you're on the tester list — just spotted the install hasn't happened yet. one tap from the same link. no rush, but the 14 days start counting from when the group's full 🙂

**Day 1**
> how was the first go? one thing i'd love to know — what confused you? (not what you liked, everyone's nice about that 😅)

**Day 7**
> halfway! quick one — has it started feeling repetitive yet? honest answer helps more than a kind one

**Day 10**
> hey — 4 days left. big favour: please don't leave the test or uninstall till day 14, even if you've stopped using it. if people drop early the clock resets for everyone 🙏

**Day 14 / thank you**
> that's the 14 days done — thank you properly. last form is in your email, 10 mins. after that you're free to leave the test. you'll get the founding price when we launch, no strings

---

## 11. Meta / Instagram ads

**Objective: Leads (website), optimising for the conversion event on the thank-you page.** Not traffic, not engagement, not reach. If the pixel can't fire `Lead`, fix that before spending anything — optimising for landing page views buys you clicks from people who never apply.

### Campaign structure

```
Campaign: ManifestAI — Beta Recruitment (Sales/Leads objective)
  Budget: ₹500/day CBO, 7 days → ~₹3,500 total
  Ad Set 1 — Broad India        (60% of spend)
  Ad Set 2 — Manifestation interests (40% of spend)
      5 ads in each, identical creative set
```

### Ad Set 1 — Broad
- **Location:** India. Add Tier-1 cities only if broad underdelivers.
- **Age:** 24–34 · **Gender:** Women
- **Detailed targeting:** none. Meta's algorithm finds converters better than interest stacks at this budget.
- **Placements:** Advantage+ placements, then **exclude Audience Network**. Android device targeting only — you cannot test on iOS, so an iPhone click is wasted money.
- **Optimisation:** Conversions → `Lead`

### Ad Set 2 — Interest
- Same geo/age/gender/placements
- **Interests:** Law of attraction, Manifestation, Affirmations, Personal development, Journaling, Meditation, Mindfulness, *The Secret*
- Useful mainly as a read on whether the category label or the problem statement pulls harder.

### Budget and pacing
Start ₹500/day. Do not touch it for 72 hours — editing resets learning. Expected: CPM ₹80–200, CTR 1–2.5%, landing conversion 15–30%, **cost per qualified applicant ₹150–400**. Twenty-five applicants ≈ ₹4,000–8,000. If you're above ₹600/applicant after 100 clicks, the problem is the landing page, not the ads.

### Creative testing
All five ads in both ad sets from day one. Kill any ad below 1% CTR after 2,000 impressions. After 72 hours, put the budget behind the top two and write three new variants of the *winning angle* — not new angles.

**Policy note:** Meta restricts ads implying knowledge of personal attributes. "Struggling with anxiety?" can get rejected; "Most people quit around day four" is a statement about people in general and is fine. Avoid before/after framing and any outcome promise. Verify current policy at the Meta Ads Help Centre before launching — it changes.

---

## 12. Five ad creatives

---

### Ad 1 — "Day four" (the flagship)

- **Hook:** Most people quit manifesting on day four.
- **Primary text:**
> Most people quit manifesting on day four.
>
> Not because they stopped wanting it. Because Wednesday came and there was nothing specific to actually do.
>
> We built ManifestAI to fix that one thing. You type what you want — "a new job by March", "a calmer mind" — and it writes you a five-minute daily practice for that goal. One line to say. One small thing to do. That's it.
>
> We're looking for 20 Android testers to use it for 14 days and tell us the truth. Free, no card, and we won't ask you for a review.
- **Headline:** 20 beta testers wanted
- **Description:** Android · free · 14 days
- **CTA button:** Sign up
- **Creative:** Static. Cream background, serif text: "Day 1. Day 2. Day 3. Day 4." with days 1–3 in burgundy and day 4 greyed and struck through. Small line beneath: *where most people stop.*
- **Audience:** Both ad sets
- **Why it should work:** It names a specific, falsifiable experience the audience has personally had, and it blames the tool rather than the person. Self-blame relief is the strongest emotional lever available in this category.

---

### Ad 2 — "Not your fault"

- **Hook:** You're not undisciplined. You were given the wrong tool.
- **Primary text:**
> You're not undisciplined. You were given the wrong tool.
>
> Every manifestation app gives you a nice sentence and leaves the hard part — actually doing it tomorrow, and the day after — entirely to you. Then you quit, and you decide the problem is you.
>
> Consistency isn't a personality trait. It's a design problem.
>
> ManifestAI turns one goal into a five-minute practice you can actually finish. We need 20 Android testers for 14 days. Free, and we want the harsh feedback more than the kind kind.
- **Headline:** Be one of 20 testers
- **Description:** 5 minutes a day · Android
- **CTA:** Sign up
- **Creative:** Full-bleed soft-focus photo — a journal closed on a table, morning light. Text overlay in serif: "You're not undisciplined."
- **Audience:** Broad
- **Why it should work:** Direct emotional reframe. Highest expected comment volume, which is free distribution — but watch for debate in comments and reply warmly rather than defensively.

---

### Ad 3 — "Show the product"

- **Hook:** I typed one goal into this app and it wrote me a 21-day practice.
- **Primary text:**
> This is what happens when you type one sentence into ManifestAI.
>
> Not a library of affirmations everyone else is reading — a line, a short visualisation and one small action, all written for the specific thing you said you wanted.
>
> It's in Android beta and we need 20 people to break it for two weeks. Everything unlocked, free, no card.
- **Headline:** Type a goal, get a practice
- **Description:** Android beta · 20 places
- **CTA:** Sign up
- **Creative:** 15-second screen recording. Type a real goal, show the anchor line appear, show the 5-minute session, show the completion screen. No music, no captions beyond what's on screen.
- **Audience:** Interest ad set
- **Why it should work:** Demonstration beats claim, and your product genuinely looks good. Expect lower CTR and much higher applicant quality — judge it on cost per *qualified* applicant, not CTR.

---

### Ad 4 — "The honest one"

- **Hook:** It won't make your wishes come true. Here's what it actually does.
- **Primary text:**
> It won't make your wishes come true. There's no evidence for that and we're not going to pretend otherwise.
>
> What ManifestAI does is give you two minutes inside the life you want, and one small thing to do about it today. Visualisation helps you notice and take chances to act. That's the honest mechanism, and it's the one the whole app is built on.
>
> If that's the kind of thing you want, we need 20 Android testers for 14 days. Free. No review required — we're not allowed to ask, and we wouldn't.
- **Headline:** An honest manifestation app
- **Description:** Beta testers wanted
- **CTA:** Sign up
- **Creative:** Plain cream card, burgundy serif text, no image. Looks like a note, not an ad.
- **Audience:** Broad
- **Why it should work:** The category is saturated with outcome promises, and a chunk of the audience is quietly embarrassed by that. This ad is the only one that will reach the skeptical-but-curious segment — the highest willingness-to-pay group in the market.

---

### Ad 5 — "Vision board"

- **Hook:** Your vision board isn't the problem.
- **Primary text:**
> Your vision board isn't the problem.
>
> You spent two hours on it. It's beautiful. It's still on the wall. And nothing followed it, because a vision board is a destination and nobody gave you the route.
>
> The route is small, daily and slightly boring: one line to say, five minutes, one thing to do. That's the whole of ManifestAI.
>
> 20 Android testers wanted, 14 days, free.
- **Headline:** The part after the vision board
- **Description:** 5 min a day · Android beta
- **CTA:** Sign up
- **Creative:** Photo of a pinboard collage, slightly dusty, shot from an angle. Overlay: "beautiful. and then what?"
- **Audience:** Interest ad set
- **Why it should work:** Attacks a specific artefact the audience owns. High recognition, and it positions you as the next step rather than the competitor.

---

## 13. Ten Reel / TikTok scripts

All shootable faceless: phone on a desk, hands, screen recordings, text over slow b-roll. 15–30 seconds each.

---

**1. The four-day drop-off**
- **HOOK (0–2s):** "Most people quit manifesting on day four. Here's exactly why."
- **PROBLEM:** You wrote the goal, made the board, saved the Reels. Then Wednesday came and there was nothing to *do*.
- **SOLUTION:** Decide the exact five minutes before you need the motivation. Same time, same steps, every day.
- **PRODUCT:** 2s screen recording — goal in, practice out.
- **CTA:** "Save this and try it for four days."

**2. Say this one**
- **HOOK:** "One line. That's the whole app."
- **PROBLEM:** Every affirmation app gives you a list and makes you choose. So you scroll, feel nothing, and close it.
- **SOLUTION:** One line, chosen for you, for the goal you typed. Say it out loud once.
- **PRODUCT:** The anchor card on screen, read aloud.
- **CTA:** "What's yours? Tell me your goal and I'll write you one."

**3. Generic vs yours**
- **HOOK:** "Left: what every app gives you. Right: what yours should say."
- **PRODUCT:** Split screen — "I am abundant" vs "I book the window seat for July and close the tab."
- **CTA:** "Yours takes 30 seconds."

**4. It's not your fault**
- **HOOK:** "You're not undisciplined. You were given the wrong tool."
- **INSIGHT:** If a habit needs willpower every single day, it was designed badly. Consistency is a design problem, not a personality trait.
- **CTA:** "If you've quit three times, this one's for you."

**5. Specific beats big**
- **HOOK:** "'I want to be rich' is why it isn't working."
- **INSIGHT:** Your brain can't rehearse an abstraction. It can rehearse walking into the office on your last day.
- **SOLUTION:** Rewrite it until it has a date, a number, or a room in it.
- **CTA:** "Rewrite yours in the comments and I'll tell you if it's specific enough."

**6. The five minutes**
- **HOOK:** "Five minutes. Here's the entire thing."
- **PRODUCT:** Walk all the steps on screen, ~6 seconds each: breathe, your line, picture it, one action.
- **CTA:** "Beta's open — link in bio."

**7. The Tuesday**
- **HOOK:** "Stop picturing the day you get it."
- **INSIGHT:** Everyone daydreams the moment it happens. Nobody pictures an ordinary Tuesday eight months later when it's stopped being new — and that's the version that actually changes how you behave.
- **PRODUCT:** A story card on screen.
- **CTA:** "Try it tonight."

**8. Notes app confession**
- **HOOK:** Text card: "things I've bought to fix my life" — journal ✓, vision board ✓, affirmation app ✓, course ✓
- **PROBLEM:** All of them gave me inspiration. None of them told me what today looked like.
- **CTA:** "Comment 'PRACTICE' and I'll send you the 5 steps."

**9. Honest pricing**
- **HOOK:** "We're not doing weekly subscriptions. Here's why that matters."
- **PROBLEM:** This whole category monetises on people forgetting to cancel.
- **SOLUTION:** State your actual prices on screen. Show the cancel path.
- **CTA:** "Beta's free anyway. 20 places."

**10. Day 21**
- **HOOK:** "This is what day 21 of anything looks like." (slow b-roll, quiet VO)
- **INSIGHT:** Nothing dramatic happens. You just became someone who does it.
- **CTA:** None. Pure brand.

**Production rules:** 2 posts a day for 14 days. No "link in bio" on the pure-attract posts — it suppresses reach and you have nothing to convert yet. Kill any hook that fails to beat 1.5× your median 3-second retention across two attempts.

---

## 14. Tracking

### Events to instrument

| Stage | Event | Where |
|---|---|---|
| Impression / reach / CTR / CPC | — | Meta Ads Manager |
| Landing page view | `PageView` | Pixel + GA4 |
| Form start | `form_start` | Already in the page |
| Application submitted | `beta_application_submitted` + `Lead` | Already in the page |
| Qualified | manual | `status` column |
| Play opt-in | manual | `opted_in_at` |
| Install | Play Console | `installed_at` |
| Day 1 / 7 / 14 feedback | form response | boolean columns |
| Still opted in at day 14 | Play Console | `still_opted_in` |

### Formulas

```
Landing page conversion   = applications ÷ landing page views
Lead qualification rate   = qualified ÷ applications
Opt-in rate               = opted in ÷ invited
Install rate              = installed ÷ opted in
Activation rate           = completed ≥1 practice ÷ installed
Tester retention (14d)    = still opted in at day 14 ÷ installed
Feedback completion       = day-14 forms ÷ installed
Cost per lead             = ad spend ÷ applications
Cost per qualified lead   = ad spend ÷ qualified
Cost per tester           = ad spend ÷ testers opted in
Cost per RETAINED tester  = ad spend ÷ testers still opted in at day 14   ← the only one that matters
```

**Targets:** landing conversion 15–30% · qualification 60–80% · opt-in 70%+ · install 90%+ of opt-ins · 14-day retention 70%+ · cost per retained tester under ₹500.

---

## 15. Decision rules

Diagnose in funnel order. Fix the earliest broken stage first — everything downstream is noise until you do.

| Symptom | Diagnosis | Action |
|---|---|---|
| CTR < 1% | Hook is weak | New creative. Don't touch targeting. |
| CTR > 2%, landing conversion < 10% | Ad wrote a cheque the page didn't cash | Match the page headline to the winning ad's hook, exactly |
| Landing conversion < 5% | Form friction or trust gap | Cut fields; move FAQ above the form |
| Form starts high, submissions low | A specific field is scaring people | Almost always the Google Play email — strengthen the hint copy |
| Applications high, qualified < 50% | Targeting is pulling the wrong people | Add "Android only" to ad copy; tighten interests |
| Qualified high, opt-ins < 60% | Instructions unclear or invite filtered | Rewrite Email 3; send WhatsApp nudge at 24h |
| Opt-ins high, installs < 80% | Wrong Google account, or Play confusion | Personal WhatsApp with a screenshot walkthrough |
| Installs high, activation < 50% | Onboarding problem — a real product finding | Watch someone use it. Don't guess. |
| Activation high, day-7 usage low | Content goes stale, or notifications aren't firing | Check the notification chain end to end |
| Testers drop before day 14 | Not enough contact | Day-10 WhatsApp is non-negotiable |
| Everything fine, feedback thin | Forms too long or too polite | Shorten; ask "what confused you" not "what did you think" |

---

## 16. Tester onboarding — Day 1 checklist

Send as a short email or in-app note. Explore, don't march through it.

1. **Onboarding** — answer the questions honestly; the app builds from them
2. **Type one goal** — one, not five. The specific thing you actually want.
3. **Read your anchor line** — the one marked *say this one*. Out loud, once.
4. **Skim your affirmations** — do they sound like something you'd say?
5. **Do the 5-minute practice** — all the way to the end, including the action step
6. **Open the library** — play one sleep or meditation track
7. **Look at Vision and the 21-day journey** — don't start one, just look
8. **Set your notification time** — to whenever you'd realistically do this

**The five Day-1 questions:**
1. What was your first impression, in one sentence?
2. What confused you?
3. What did you like?
4. What felt unnecessary?
5. Would you open it again tomorrow? (yes / no / not sure — and why)

---

## 17. The 14-day plan

Genuine use, not manufactured engagement. Contact on 7 of 14 days; silence the rest.

| Day | Tester action | Your message | Feedback objective |
|---|---|---|---|
| 1 | Install, onboard, first practice | Email 4 + Day 1 form | First impressions, confusion points |
| 2 | Second practice | — | Does day 2 feel different from day 1? |
| 3 | Use or don't | Email 5 + WhatsApp | **The drop-off point.** Who's still here, and why not? |
| 4 | Try the audio library | — | Does the voice land? |
| 5 | Free use | — | — |
| 6 | Start a 21-day journey | Short nudge: "have you found the journeys?" | Is the feature discoverable at all? |
| 7 | Free use | Email 6 + Day 7 form | **Repetition check** — the category killer |
| 8 | Try a second goal | Nudge: "add a second dream, see what changes" | Does personalisation hold up across goals? |
| 9 | Free use | — | — |
| 10 | Free use | Email 7 + WhatsApp | **Protect the opt-in.** Non-negotiable contact. |
| 11 | Vision board / journal | — | Are the side features used at all? |
| 12 | Free use | — | — |
| 13 | Free use | Heads-up: "final form tomorrow" | Prime them so day 14 isn't a surprise |
| 14 | Final form | Email 8 + WhatsApp | **Would you continue? Would you pay?** |

**On day 3 and day 10, chase by WhatsApp as well as email.** Those two days decide whether you reach 12 continuously opted-in testers.

---

## 18. Day 14 feedback form

Google Forms. Keep the order — easy questions first, commercial questions in the middle while they're still engaged, open-ended last.

1. **Overall, how would you rate ManifestAI right now?** (1–10)
2. **What's the single feature you'd miss most if it disappeared?** (short text)
3. **What felt least useful?** (short text)
4. **Was there anything confusing or broken?** (long text)
5. **Roughly how many of the 14 days did you open it?** (0–2 / 3–5 / 6–9 / 10–14)
6. **On the days you didn't, what got in the way?** (multi-select: forgot / too busy / lost interest / felt repetitive / something was broken / other)
7. **Would you keep using it if it stayed free?** (yes / no / maybe — plus why)
8. **Would you pay for it?** (yes / no / maybe)
9. **If yes — what feels fair per month?** (under ₹200 / ₹200–400 / ₹400–800 / over ₹800 / I'd only pay yearly)
10. **If no or maybe — what would have to be true for it to be worth paying for?** (long text)
11. **How likely are you to recommend it to a friend?** (0–10)
12. **If you could change one thing, what would it be?** (long text)
13. **Did the app ever feel repetitive? If so, from roughly which day?** (short text)
14. **Anything else?** (long text)
15. **Can we email you at launch?** (yes / no)

Question 10 is the most commercially valuable question in the whole beta. Don't cut it.

---

## 19. Feedback analysis framework

Don't summarise. Classify, score, and decide.

**Categorise every distinct issue as one of:** BUG · UX · FEATURE REQUEST · VALUE PROBLEM · RETENTION · PRICING · COPY · ONBOARDING

**Score each 1–5:**
- **Impact** — how much it moves activation, retention or willingness to pay
- **Frequency** — how many of the 20 raised it unprompted
- **Severity** — from cosmetic to "I stopped using it"
- **Effort** — inverted, so 5 = trivial to fix

**Priority = (Impact × Frequency × Severity) ÷ Effort**

**Then classify:**

| Verdict | Rule |
|---|---|
| **FIX NOW** | Any BUG with severity ≥ 4, or anything raised by ≥ 40% of testers |
| **FIX BEFORE LAUNCH** | Priority in the top 10, or anything blocking activation |
| **TEST LATER** | Feature requests from fewer than 3 testers |
| **IGNORE** | Preference stated once with no reasoning behind it |

**Two rules that matter more than the scoring.**

Weight what people *did* over what they *said*. A tester who says "I loved it" and opened it three times out of fourteen is telling you it failed. The usage number is the honest answer; the survey is the polite one.

Discount requests for features that already exist. If three testers ask for something you built, that's not a feature request — it's a discoverability bug, and it belongs in UX at high severity.

---

## What to do first

1. Run `beta_applications.sql` in Supabase.
2. Deploy the two HTML files, add the Pixel and GA4, submit one test application.
3. **Today: message 15 people you actually know.** Personal outreach usually finishes this whole phase before the ads spend a rupee.
4. Set up the Meta campaign at ₹500/day with all five ads.
5. Shoot the first 6 Reels in one sitting.
6. Watch one number: **cost per retained tester at day 14.** Everything else is diagnostic.

Say NEXT when the beta is running and I'll build Phase 2.
