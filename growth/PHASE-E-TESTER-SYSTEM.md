# Phase E — The tester system

Qualification, nine emails, the WhatsApp sequence, the 14-day plan, two feedback forms, and how to read what comes back.

**Language correction applied throughout.** Earlier drafts told testers to "open it on most days" and claimed a dropout "resets the clock for everyone". The first conflates your wish with Google's requirement; the second I couldn't support. Every message below separates two distinct asks — *stay in the testing programme for 14 days* and *use the app genuinely* — and never implies daily opening is required. Verify the exact opt-in requirement in your Play Console before sending anything.

---

## 1. Qualification — automated

Run this once, then re-run it whenever new applications arrive. It does the sorting so you only spend judgement on the edge cases.

```sql
-- Not eligible: no Android device.
update beta_applications
set status = 'rejected',
    notes  = coalesce(notes,'') || ' [auto] iOS only'
where status = 'new' and android = 'no';

-- Waitlist: real person, goal too thin to build a practice from.
update beta_applications
set status = 'waitlist',
    notes  = coalesce(notes,'') || ' [auto] vague goal — ask to sharpen'
where status = 'new'
  and android <> 'no'
  and (length(btrim(goal)) < 12 or goal !~ '\s');

-- Everything else qualifies.
update beta_applications
set status = 'qualified'
where status = 'new' and android <> 'no';
```

**Then invite in this order** — the ordering matters more than the filtering:

```sql
select name, play_email, goal, tried, source
from beta_applications
where status = 'qualified'
order by
  (tried = 'yes-stopped') desc,                                    -- exact target
  (goal ~* '(job|money|salary|business|₹|lakh|income|career)') desc, -- goals the app writes best for
  (source = 'whatsapp') desc,                                       -- people you know follow through
  created_at
limit 20;
```

Someone who ticked *"yes — and I stopped"* is your positioning made flesh. They're the reason the product exists, and they'll give you the sharpest feedback.

**Invite 20 to end up with 12.** Do not invite exactly 12. Expect roughly 20 → 16 opt in → 14 install → 12 still in at day 14. Keep 5 qualified people on the waitlist; you'll need them around day 3.

**The waitlist reply is a commitment test.** One message: *"What would that look like specifically — a date, a number, a place?"* Whoever answers gets promoted. Whoever doesn't was never going to fill in a day-14 form.

---

## 2. The nine emails

Send from your personal Gmail. Plain text. No template, no images, no logo — this is a beta run by a person and it should read that way. Deliverability is better too.

Placeholders: `{{name}}`, `{{goal}}`, `{{play_email}}`, `{{PLAY_URL}}`, `{{DAY1_FORM}}`, `{{DAY14_FORM}}`.

---

### Email 1 — Application received
**Timing:** same day
**Subject:** Got your ManifestAI application
**Preview:** What happens next, and when.

> Hi {{name}},
>
> Thanks for putting your name in. I read all of these myself — this one's written in advance, but a person is on the other end of it.
>
> I'm taking about twenty people. Within 48 hours you'll hear from me either way: an invitation, or an honest "not this round" with a place on the launch list.
>
> One thing that would help now — add this address to your contacts. The Google Play invitation is the one email that absolutely has to reach you, and it's the one most likely to be filtered.
>
> You said you're working toward: *{{goal}}*. That's what the app would build your practice around, so if it's changed, just reply.
>
> — Viggnesh

**CTA:** Add to contacts.

---

### Email 2 — Selected
**Timing:** within 48 hours
**Subject:** You're in — ManifestAI beta
**Preview:** Twenty people, two weeks, link in the next email.

> Hi {{name}},
>
> You're one of the twenty. Thank you.
>
> Before you start, some honesty: this is a real beta. Some of it is rough and something is probably broken. You being here is how I find out which parts. If you have a nice time and tell me it was lovely, I've learned nothing — tell me what annoyed you.
>
> Here's the whole ask, in three parts:
>
> **1.** Join the closed test through the Play link and install the app.
> **2.** Stay in the testing programme for the full 14 days — please don't leave it or uninstall before then. This costs you nothing on days you don't open the app.
> **3.** Use it genuinely, on the days it makes sense to you. I'm not counting days and I won't ask you to open it artificially — that would tell me nothing real. Then answer two short forms, one after your first session and one at the end.
>
> That's it. Everything's unlocked and free the whole time, and I won't ask you for a review.
>
> The next email has your link. It's the important one.
>
> — Viggnesh

**CTA:** Watch for the next email.

---

### Email 3 — Google Play opt-in instructions
**Timing:** immediately after Email 2
**Subject:** Your ManifestAI test link (2 taps)
**Preview:** Join the test first, then install — that order matters.

> Hi {{name}},
>
> Your link:
>
> **{{PLAY_URL}}**
>
> Two steps, in this order:
>
> **1. Open that link on your Android phone and tap "Become a tester."** This is the step that registers you. Installing without joining the test doesn't work.
>
> **2. On the same page, tap through to the Play Store and install.**
>
> It has to be the Google account **{{play_email}}** — that's the address on the tester list. If your phone is signed into Play with a different account, the link will look broken. It isn't; it's the wrong account. To check: Play Store → tap your profile picture → the address at the top is the one being used.
>
> If anything doesn't work, reply with a screenshot and I'll sort it today.
>
> When you're in: type one thing you want. Just one. Everything else gets built from it.
>
> — Viggnesh

**CTA:** Join the test, then install.

---

### Email 4 — Installation reminder
**Timing:** 48 hours after Email 3, only if they haven't joined or installed
**Subject:** Still there? Your ManifestAI link is waiting
**Preview:** No pressure — but tell me if something broke.

> Hi {{name}},
>
> Your tester spot is still open, and I noticed the invitation hasn't been taken up yet.
>
> Two possibilities, and both are fine:
>
> **Something went wrong.** The most common cause by far is being signed into Play with a different Google account than {{play_email}}. Reply with a screenshot of what you see and I'll fix it.
>
> **Life happened, or you've changed your mind.** Completely fine — just reply "not now" and I'll give the place to someone on the waitlist. No awkwardness, and you're welcome on the launch list.
>
> If you'd still like to: **{{PLAY_URL}}**
>
> — Viggnesh

**CTA:** Join the test, or tell me you're out.

*This email is doing real work. A tester who never opts in but never says so is worse than one who declines — they hold a place while you count them.*

---

### Email 5 — Day 1 onboarding
**Timing:** the evening after they install
**Subject:** First impressions? (this is the useful one)
**Preview:** Five questions, three minutes, blunt is better.

> Hi {{name}},
>
> You've had a first look. This is the most valuable feedback of the whole fortnight, because you'll never see it with fresh eyes again — by next week you'll have got used to whatever confused you today.
>
> Five questions, three minutes: **{{DAY1_FORM}}**
>
> The one I care most about: **what confused you?** Not what you liked. Everyone's kind about what they liked.
>
> If you haven't opened it properly yet, do that first — the form only makes sense afterwards.
>
> — Viggnesh

**CTA:** Day 1 form.

---

### Email 6 — Day 7 feedback
**Timing:** day 7
**Subject:** Halfway — has it got boring?
**Preview:** One week in. Four questions.

> Hi {{name}},
>
> Halfway. Thank you for still being here.
>
> By now you've seen it repeat itself a few times, which is exactly when the cracks show. Four questions: **{{DAY7_FORM}}**
>
> The one I need most: **has it started to feel repetitive?** Every app in this category dies of that around week two, and I would much rather hear it from you now than read it in a review later.
>
> If you've stopped opening it — please still answer. Why you stopped is more useful than anything a daily user could tell me.
>
> — Viggnesh

**CTA:** Day 7 form.

---

### Email 7 — Day 14 final feedback
**Timing:** day 14
**Subject:** Last one — the form that decides what gets built
**Preview:** Ten minutes, and please be harsh.

> Hi {{name}},
>
> Fourteen days. You made it, and I'm grateful.
>
> This is the one that matters: **{{DAY14_FORM}}** — about ten minutes.
>
> Two questions in there decide the whole business: *would you keep using it,* and *would you pay for it.* Answer those honestly rather than kindly. A "no" with a reason is worth more to me than a polite yes, and it costs you nothing to give me.
>
> Once you've sent it, you're free to leave the testing programme — instructions at the end of the form. Or keep the app; you're very welcome to.
>
> — Viggnesh

**CTA:** Day 14 form.

---

### Email 8 — Thank you
**Timing:** when their day-14 form arrives
**Subject:** Thank you — here's what you changed
**Preview:** Specifically what your feedback altered.

> Hi {{name}},
>
> That's the beta done. Thank you properly — twenty people gave me two weeks, and there's no version of this where that wasn't the whole difference.
>
> **What you changed:** {{one specific thing from their feedback}}. That came from you, and I've either fixed it or it's next.
>
> **Founding tester price.** When ManifestAI goes live you'll get the lowest price I do, permanently, whatever everyone else pays. No deadline, no pressure — I'll send the link on launch day.
>
> **You can leave the test now** if you'd like: Play Store → profile → Manage apps and device → ManifestAI → leave the testing programme.
>
> If you ever want to tell me something else about it, this address is mine.
>
> — Viggnesh

**CTA:** None. This is a thank-you, not a step.

---

### Email 9 — Public launch
**Timing:** launch day
**Subject:** ManifestAI is live — and you're the reason
**Preview:** Your founding price is inside.

> Hi {{name}},
>
> ManifestAI is public today.
>
> You tested it when it was rough. The version that went live is different because of what you and nineteen other people told me — {{the two or three biggest changes}}.
>
> Your founding tester price: **{{link}}**. Lowest I do, and it doesn't expire.
>
> Absolutely no pressure if it isn't for you. You already did the part that mattered, and it mattered more than buying it would.
>
> If you know someone who'd get something out of it, sending them the link is the single most useful thing you could do next — but only if you actually mean it.
>
> — Viggnesh

**CTA:** Claim founding price.

---

## 3. WhatsApp sequence

Short, lowercase, no formatting. Reply rates run several times email, and a tester who's gone quiet will answer WhatsApp when they won't open a form. **Only message people who gave you a number and expect to hear from you.**

**Application received**
> hey {{name}} — got your ManifestAI application, thank you. i'll come back within 48 hrs either way. the play invite comes by email so keep half an eye on spam 🙏

**Selected**
> you're in 🎉 sending the play link by email now. two taps — join the test first, then install. shout if anything looks broken and i'll fix it today

**Opt-in nudge — 24h after invite, if not joined**
> hey {{name}} — the invite hasn't been picked up yet. it needs to open on your android phone while signed in as {{play_email}}. want me to resend?

**Install reminder — 48h, joined but not installed**
> you're on the tester list ✅ just spotted the install hasn't happened. one tap from the same link whenever suits

**Day 1**
> how was the first go? the thing i'd most like to know — what confused you? (not what you liked, everyone's nice about that 😅)

**Day 3 — the drop-off point**
> hey — have you opened it again since day one? honestly either answer is useful. if it's a no, what got in the way? "forgot" is the most helpful thing you could tell me

**Day 7**
> halfway 🙌 quick one — has it started feeling repetitive? an honest answer helps more than a kind one

**Day 10 — protect the opt-in**
> hey — 4 days to go. one favour: please stay in the testing programme until day 14, even if you've stopped using the app. leaving early is the one thing that actually sets me back 🙏 no need to open it, just don't leave

**Day 14 / thank you**
> that's the two weeks done — thank you properly. last form's in your email, 10 mins. after that you're free to leave the test. you'll get the founding price at launch, no strings

**Day 3 and day 10 are the two that decide whether you reach twelve.** Everything else is courtesy; those two are operations.

---

## 4. The 14-day plan

Genuine use, not manufactured engagement. Contact on seven of fourteen days; silence on the rest is deliberate — over-messaging is how betas get muted.

| Day | What they do | What you send | What you're trying to learn |
|---|---|---|---|
| 1 | Install, onboard, first session | Email 5 + WhatsApp | First impressions, confusion points |
| 2 | Second session if they want | — | Does day 2 feel different from day 1? |
| 3 | Whatever they like | WhatsApp | **The drop-off.** Who's still here, and why not? |
| 4 | — | — | — |
| 5 | — | — | — |
| 6 | — | Nudge: "have you found the 21-day journeys?" | Is that feature discoverable at all? |
| 7 | — | Email 6 + WhatsApp + Day 7 form | **Repetition** — the thing that kills this category |
| 8 | — | Nudge: "try adding a second goal" | Does personalisation hold up across goals? |
| 9 | — | — | — |
| 10 | — | WhatsApp | **Protect the opt-in.** Non-negotiable. |
| 11 | — | — | Are vision board / journal used at all? |
| 12 | — | — | — |
| 13 | — | "final form tomorrow" | Prime them so day 14 isn't a surprise |
| 14 | Final form | Email 7 + WhatsApp | **Would you continue? Would you pay?** |

**Day 1 checklist** — send with Email 5, as a suggestion rather than a list of chores:

Explore the onboarding · type one goal · read the anchor line marked *say this one*, out loud once · skim your affirmations · do the five-minute practice all the way to the end including the action step · open the library and play one audio track · look at Vision and the 21-day journey · set your notification time to when you'd realistically do this.

---

## 5. The two feedback forms

Google Forms. Link both from the emails.

### Day 1 form — five questions, three minutes

1. **In one sentence, what was your first impression?** (short text)
2. **What confused you?** (long text — *required*, and make it required)
3. **What did you like?** (short text)
4. **Was anything there that felt unnecessary?** (short text)
5. **How easy was it to get started?** (1 = confusing, 5 = obvious)
6. **Would you open it again tomorrow?** (yes / no / not sure — plus why)

Question 2 is the entire point of this form. Everything else is warm-up.

### Day 14 form — the one that decides things

1. **Overall, how would you rate ManifestAI right now?** (1–10)
2. **Which single feature would you miss most if it disappeared?** (short text)
3. **What felt least useful?** (short text)
4. **What was most confusing?** (long text)
5. **Was anything broken?** (long text)
6. **Roughly how many of the 14 days did you open it?** (0–2 / 3–5 / 6–9 / 10–14)
7. **On the days you didn't, what got in the way?** (multi: forgot / too busy / lost interest / felt repetitive / something broken / other)
8. **Did it ever start feeling repetitive? From roughly which day?** (short text)
9. **Would you keep using it if it stayed free?** (yes / no / maybe — and why)
10. **Would you pay for it?** (yes / no / maybe)
11. **If yes — what feels fair per month?** (under ₹200 / ₹200–400 / ₹400–800 / over ₹800 / only yearly)
12. **If no or maybe — what would have to be true for it to be worth paying for?** (long text)
13. **How likely are you to recommend it to a friend?** (0–10)
14. **If you could change one thing, what would it be?** (long text)
15. **Anything else?** (long text)
16. **Can we email you at launch?** (yes / no)

**Question 12 is the most commercially valuable question in the entire beta.** Do not cut it, and do not make it optional for the people who said no — they're the ones with the answer.

---

## 6. Reading what comes back

Don't summarise it. Classify, score, decide.

**Categorise each distinct issue:** BUG · UX · FEATURE REQUEST · VALUE PROBLEM · RETENTION · PRICING · COPY · ONBOARDING

**Score 1–5 each:**
- **Impact** — how much it moves activation, retention or willingness to pay
- **Frequency** — how many of the twenty raised it unprompted
- **Severity** — cosmetic (1) through "I stopped using it" (5)
- **Effort** — inverted, so 5 means trivial to fix

**Priority = (Impact × Frequency × Severity) ÷ Effort**

| Verdict | Rule |
|---|---|
| **FIX NOW** | Any BUG at severity ≥ 4, or anything ≥ 40% of testers raised |
| **FIX BEFORE LAUNCH** | Top ten by priority, or anything blocking activation |
| **TEST LATER** | Feature requests from fewer than three people |
| **IGNORE** | A preference stated once, with no reasoning behind it |

**Three rules that outrank the scoring.**

**Weight behaviour over words.** A tester who says "I loved it" and opened it three times out of fourteen is telling you it failed. Question 6 is the honest answer; question 1 is the polite one. When they disagree, believe question 6.

**A request for something that already exists is a discoverability bug.** If three people ask for a feature you built, that's not a feature request — it's UX at high severity, and it means the thing is invisible.

**Silence is data.** Testers who never replied are not neutral. Log them as churned with reason "no response", and count them in your denominators. A beta where eight of twenty went quiet is telling you something louder than the twelve who answered.

Say NEXT for Phase F — the Meta ads.
