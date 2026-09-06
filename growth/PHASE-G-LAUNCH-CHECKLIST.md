# Phase G — Beta campaign launch checklist

Statuses below reflect what I can verify from this session. Anything marked **VERIFY** means I can't see it from here and you need to check.

---

## Gate 1 — Critical. Do not spend a rupee until every one of these is READY.

| # | Item | Status | Why it's a gate |
|---|---|---|---|
| 1.1 | Meta Pixel installed with your real ID (4 places across both files) | **NOT READY** | Without it Meta optimises for clicks, not applications. You'd buy traffic and learn nothing. |
| 1.2 | GA4 installed with your real ID (4 places) | **NOT READY** | No funnel diagnosis. You'd know the campaign failed but not where. |
| 1.3 | Custom conversion `Beta Application (Android)` created and selected in the ad set | **NOT READY** | Optimising on raw `Lead` pays Meta to find iPhone users. |
| 1.4 | Domain verified in Meta Business Settings | **NOT READY** | Meta restricts optimisation on unverified domains. |
| 1.5 | `beta_hardening.sql` run | **VERIFY** | Fixes the wrong unique index, the view leak and the missing rate limit. |
| 1.6 | Anon **cannot** read the applications table — both checks in Phase C §2 pass | **VERIFY** | If this fails, every applicant's email and personal goal is publicly readable. This is the one that stops everything. |
| 1.7 | New landing page and thank-you page actually deployed | **NOT READY** | The live URL is still serving the Phase A version — the one with broken tracking and the incorrect 14-day wording. |
| 1.8 | Full funnel tested on a real Android phone on mobile data | **VERIFY** | Every tester arrives that way. |
| 1.9 | `Lead` fires exactly once — refreshing the thank-you page does not re-fire | **VERIFY** | Test 9 in Phase C. Skipped most often, costs the most. |
| 1.10 | Play closed test track live, and you can generate an opt-in URL | **VERIFY** | Uploaded as of our earlier session, but confirm the opt-in link works before inviting anyone. |

**If 1.6 fails, take the page offline immediately.** Everything else can be imperfect; that one is other people's personal data.

---

## Gate 2 — Product. Fix before testers arrive, not before ads run.

These won't block the campaign, but each one will show up in your day-14 feedback as a complaint, and you'd rather not spend two weeks learning something you already know.

| # | Item | Status | Consequence if skipped |
|---|---|---|---|
| 2.1 | **Notifications actually fire** | **NOT READY** | The chain is fixed except the last link: Cloudflare's build variable is overriding `VITE_VAPID_PUBLIC_KEY`, so the live app still hands out the old key and every subscription fails with a 403. Your retention loop is the core thesis of the product, and testers will report "it never reminded me." |
| 2.2 | In-app notification time picker saves | **NOT READY** | All eleven profiles are still on the 07:00 default — nobody has ever successfully changed it. A tester who sets 9pm and gets nothing will report the app as broken. |
| 2.3 | One profile has timezone `UTC` rather than a real zone | **VERIFY** | If that's a real person they'd get a 7am notification at 12:30pm. Check how timezone gets set at signup. |
| 2.4 | Dream list deduplicated on the test account | Cosmetic | Not tester-facing, but it makes your own demos look untidy. |
| 2.5 | Story variety confirmed after the settings-axis fix | **VERIFY** | One new story landed off-desk, which is a sample of one. Regenerate for a fresh goal and read six. |

**2.1 is the one I'd fix first.** Not because it's hard — it's a build variable — but because "it didn't remind me" is a complaint that masquerades as a product-value problem. You'd spend the beta wondering whether the practice is compelling enough, when the actual answer is that nobody was ever prompted to return.

---

## Gate 3 — Operations. Ready before the first invitation goes out.

| # | Item | Status |
|---|---|---|
| 3.1 | Nine emails saved as Gmail templates | NOT READY |
| 3.2 | Day 1 feedback form built in Google Forms, link live | NOT READY |
| 3.3 | Day 7 form built | NOT READY |
| 3.4 | Day 14 form built | NOT READY |
| 3.5 | Gmail filter labelling beta replies | NOT READY |
| 3.6 | WhatsApp sequence saved somewhere you can copy from | NOT READY |
| 3.7 | Google Play opt-in URL to hand, tested on a second Android device | VERIFY |
| 3.8 | You've decided who sends and answers everything (it's you) | READY |

---

## Implementation order

Do it in this sequence. Each step is a prerequisite for the next.

**Today — 2 hours**
1. Run `beta_hardening.sql`
2. Run both security checks (Phase C §2). Do not continue until they pass.
3. Create the Meta Pixel, copy the ID
4. Create the GA4 property, copy the ID
5. Replace all eight placeholder IDs across the two files
6. Make a 1200×630 `og.png`
7. Deploy all three files, purge cache
8. Verify domain in Meta Business Settings

**Today — 30 minutes**
9. Run the console tracking check (Phase D §4). All six green.
10. Submit a real application from your phone on mobile data
11. Refresh the thank-you page and confirm `Lead` does **not** fire again
12. Submit the same Play email again — expect "you've already applied"
13. Confirm the row in `select * from beta_pipeline;`

**Tomorrow — 3 hours**
14. Fix the Cloudflare build variable and get notifications firing (Gate 2.1)
15. Build the three Google Forms
16. Save the nine emails as Gmail templates
17. Create the custom conversion in Meta

**Then, and only then**
18. Send 15 personal messages. This alone may finish the phase.
19. Post in three communities
20. Launch the ad campaign at ₹500/day if you still need applicants

---

## The go/no-go gate

Before you press publish on the campaign, answer these five. Any "no" means stop.

1. Does the Pixel Helper show `Lead` firing exactly once after a real submission, and not on refresh? — **must be yes**
2. Does the anon key return a permission error when reading the applications table? — **must be yes**
3. Is the deployed page the new one? Check the hero reads *"We need 20 Android testers"*, not *"Manifest your goal"*. — **must be yes**
4. Can you generate a working Play opt-in link and open it on a second Android device? — **must be yes**
5. Is the custom conversion selected in the ad set, rather than plain `Lead`? — **must be yes**

---

## Day 0 runbook

**Morning.** Turn the campaign on. Send fifteen personal messages. Post in the three communities. Then leave the ads alone — resist the urge to check them hourly; nothing meaningful happens on day one and every edit resets learning.

**Evening.** Run `select * from beta_funnel;`. Note the numbers in your daily log. Reply to every application the same day, even the rejections — especially the rejections.

**Days 1–3.** Change nothing in the campaign. Qualify applications daily, invite in the priority order from Phase E, and send Email 4 to anyone who hasn't opted in within 48 hours.

**Day 3.** First real decision point. Kill weak ads, look at cost per qualified applicant, and count how far from twelve you are.

---

## What "done" looks like

You've finished this phase when:

- **12 or more testers are opted in and staying opted in**, continuously, for 14 days
- You've collected day-1 and day-14 feedback from most of them
- You know your cost per retained tester
- You have a ranked list of what to fix before launch

The first of those is the only one Google cares about. The other three are what make the fortnight worth more than a compliance exercise.

---

## After this

Phase 1 is complete: positioning, audience, landing page, form, database, qualification, emails, WhatsApp, ads, creatives, tracking, tester system, feedback, analysis.

Say **NEXT** once the beta is running and I'll build Phase 2 — the public launch system: Play Store listing and ASO, screenshots, pricing, launch campaign, content calendar, and the plan for the first ten paying customers.

Two things I'd want from you before Phase 2, because they change the answers: your day-14 feedback, and the answers to "would you pay" and "what would make it worth paying for". Pricing decided without those is guesswork.
