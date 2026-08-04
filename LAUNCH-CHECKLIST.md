# ManifestAI — what's left before the App Store

Last updated 4 August 2026.

Nothing here is guesswork about the code — it's checked against the live
database and the repo. Items are ordered by what unblocks the most.

---

## Where things actually stand

| Signal | Count | Reading |
|---|---|---|
| Accounts | 1 | Just you |
| Stories written on-device | 12 | Working |
| Stories written by AI | 0 | **Untested since deploy** |
| AI affirmations | 0 | **Untested since deploy** |
| Coach replies | 0 | **Untested since deploy** |
| Studio (Sarah) narration generated | 0 | Blocked — no API key |
| Stories ever played to the end | 0 | Nobody has listened yet |
| Push subscriptions | 0 | Blocked — no VAPID secrets |
| Paid subscriptions | 0 | Blocked — no StoreKit |

The core loop works: sign up → onboard → add a desire → get stories. Everything
beyond that is either untested or blocked on a key.

---

## 1. Start today, because it's just waiting

**Apple Developer Program** — $99/year at developer.apple.com/programs.
Identity verification can take several days, and *nothing else on the iOS path
can be finished without it*. Sign in with Apple, StoreKit, push certificates
and the build itself all depend on this account existing.

Start it before anything else, then carry on with the rest while it processes.

---

## 2. Test what was just deployed (30 minutes, free)

All six edge functions went live on 4 August but none have been exercised. Do
these in order and note what breaks:

- [ ] **Home → Refresh now.** Then check: did new stories arrive? They should
      now be written by AI rather than the on-device composer.
- [ ] **Coach → send a message.** A reply should stream back. Right now the
      database holds one message you sent on 2 August and no reply, because
      the function wasn't deployed then.
- [ ] **Affirmations → "Write these from my own desires."**
- [ ] **You → Delete account.** Use a throwaway account, not your main one.
      **Apple's reviewer will press this button**, so it must work.

Tell me the results and I'll query the database to confirm rather than trust
the UI.

---

## 3. Two secrets, two features

Both go in Supabase → Edge Functions → Secrets.

**Studio voice (Sarah)**
- `ELEVENLABS_API_KEY` — from elevenlabs.io. Free tier ≈10k characters/month,
  roughly ten stories. ~$5/month for 30k.
- Until it's set, `narrate-story` returns a clean "not configured" and the
  player falls back to browser speech. That's intended, not a crash.

**Morning notifications**
- `VAPID_PUBLIC_KEY` = `BNTFiLSkoB-wqfwm43rQ-vnwb8ejI_d3Xjn86hx2dZyeAKQkP8wb0KYUjqRSmHWIaJ8ysb6KNEd7mTeg-YWp22c`
- `VAPID_PRIVATE_KEY` = `EN-DB4jYe_HeD3NnmEk54oMuJQ3HX9ogRFgbBPNJ3YU`
- `VAPID_SUBJECT` = `mailto:vimanu9.vr@gmail.com`
- Then a `pg_cron` job every 15 minutes to call `send-daily-affirmation`.
  I can set that up once the secrets exist.

---

## 4. The iOS build (needs your Mac + the Apple account)

The Capacitor project is committed and both builds pass. To run it:

```
cd ~/Claude/Projects/"Manifest anything Ai"
npm install
npm run ios:sync
npm run ios:open
```

Then in Xcode: set the signing team, enable the **Push Notifications** and
**Background Modes → Audio** capabilities, and run.

Still to build after that:
- [ ] **StoreKit.** The paywall works but purchases report unavailable.
      Needs products created in App Store Connect, then the native purchase
      path filled in — there's exactly one file to change,
      `src/features/billing/store.ts`, class `AppleStore`.
- [ ] **Receipt verification edge function.** A purchase must be verified
      server-side before the `subscriptions` row is written. The table is
      deliberately read-only to clients, so this is required, not optional.
- [ ] **Sign in with Apple provider** configured in Supabase. The button
      exists and has never been tested.

---

## 5. App Store listing (free, needs nothing from anyone)

- [ ] Screenshots — 6.7" and 6.5" iPhone, at least 3 each
- [ ] Description, subtitle, keywords, support URL
- [ ] Age rating questionnaire
- [ ] Privacy nutrition labels — must match `/privacy`, which is accurate
- [ ] Category: Health & Fitness (where Stella sits)

I can draft all the text whenever you want it.

---

## 6. The one nobody can do for you

**Use it for a week.** Twenty-two stories exist and not one has been played to
the end. Nobody has lived a morning with this app.

Apple rejects incomplete apps under Guideline 2.1, and reviewers do tap things.
But more importantly, a week of real use will surface things worth fixing that
no amount of code review finds — and fixing them before a review cycle is far
cheaper than after.

---

## Suggested order

1. Apply for the Apple Developer Program — today, it's just waiting
2. Test the six deployed functions — 30 minutes, free
3. Add the ElevenLabs and VAPID secrets — the voice is the product
4. Use the app daily for a week
5. Build in Xcode once the developer account clears
6. StoreKit and receipt verification
7. Listing assets, then submit

Realistically two to four weeks, and most of it is waiting rather than working.
