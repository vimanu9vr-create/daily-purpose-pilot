# Phase D — Tracking

The event map and UTM convention are in Phase C. This is the setup: how to get real IDs into the pages, how to configure the one thing Meta needs in order to optimise, and how to read the numbers once they arrive.

Meta renames things in Events Manager fairly often. The concepts below are stable; if a menu label doesn't match, look for the nearest equivalent rather than assuming it's gone.

---

## 1. Meta Pixel — 15 minutes

**Create it.** Meta Events Manager → Connect data sources → Web → Meta Pixel. Name it `ManifestAI`. Copy the pixel ID — a 15-or-16-digit number.

**Install it.** Replace `YOUR_PIXEL_ID` in both files. Four places total:

- `index.html` — in the `fbq('init', …)` call and in the `<noscript>` image URL
- `thanks.html` — in the `fbq('init', …)` call

**Verify it.** Install the Meta Pixel Helper Chrome extension, open your page, click the icon. You want `PageView` on the landing page and `PageView` + `Lead` on the thank-you page after a real submission — and **`Lead` exactly once**. Refresh the thank-you page; `Lead` must not fire again.

**Verify your domain.** Business Settings → Brand Safety → Domains. Add `manifest-beta.vimanu9-vr.workers.dev` and verify with the meta-tag method. Without this, Meta restricts what it will optimise for on your own domain. It takes five minutes and it is not optional.

---

## 2. The custom conversion — the step people skip

A pixel that fires `Lead` is not the same as a campaign that optimises for qualified applications. You have to tell Meta which event is the goal, and you should tell it to count only the applications that can actually become testers.

Events Manager → **Custom Conversions** → Create.

| Field | Value |
|---|---|
| Data source | Your pixel |
| Event | `Lead` |
| Rule | `content_category` **does not equal** `no` |
| Name | `Beta Application (Android)` |
| Category | Lead |
| Value | 200 (INR — a rough guess at what a tester is worth to you) |

The rule is the important part. The thank-you page passes `content_category` as the applicant's Android answer, so this conversion counts Android and dual-device applicants and excludes iPhone ones. Without it you'd be paying Meta to find you people who cannot install your app, and Meta would get very good at finding them.

Then set your ad set to optimise for **`Beta Application (Android)`**, not for `Lead` and definitely not for Landing Page Views.

**A caveat worth knowing:** custom conversions need a handful of events before Meta trusts them. At twenty-five applications total you may never leave the learning phase. That's expected at this scale — the conversion still gives you honest reporting even when it can't fully drive delivery, and honest reporting is most of why you're doing this.

---

## 3. GA4 — 10 minutes

**Create it.** analytics.google.com → Admin → Create property → `ManifestAI` → Web data stream for your beta URL. Copy the Measurement ID, format `G-XXXXXXXXXX`.

**Install it.** Replace `G-XXXXXXXXXX` in both files. Two places each — the script `src` and the `gtag('config', …)` call.

**Mark the key events.** Admin → Events → mark as key event:
- `generate_lead`
- `beta_application_submitted`

**Verify.** Admin → DebugView, then load your page with `?debug_mode=true` and walk the form. You should see `page_view`, `cta_click`, `form_start`, `beta_application_submitted`, then `generate_lead` on the thank-you page.

---

## 4. Verify everything in one go

Paste this into the browser console on the landing page. It doesn't submit anything — it just reports what's actually wired.

```js
(() => {
  const out = {
    pixel_loaded: typeof fbq === "function",
    pixel_id_replaced: !document.documentElement.innerHTML.includes("YOUR_PIXEL_ID"),
    ga4_loaded: typeof gtag === "function",
    ga4_id_replaced: !document.documentElement.innerHTML.includes("G-XXXXXXXXXX"),
    supabase_configured: typeof SUPABASE_URL === "string" && SUPABASE_URL.includes("supabase.co"),
    utm_seen: Object.fromEntries(new URLSearchParams(location.search)),
    form_present: !!document.getElementById("beta-form")
  };
  console.table(out);
  const bad = Object.entries(out).filter(([k, v]) => v === false).map(([k]) => k);
  console.log(bad.length ? "❌ NOT READY: " + bad.join(", ") : "✅ All tracking wired");
  return out;
})();
```

Green on all six before you spend anything.

---

## 5. The numbers, and what each one is for

### Definitions

```
Landing page conversion  = applications ÷ landing page views
Android rate             = android_eligible ÷ applications
Qualification rate       = qualified ÷ applications
Opt-in rate              = opted_in ÷ invited
Install rate             = installed ÷ opted_in
14-day retention         = still_opted_in ÷ installed
Feedback completion      = day14_forms ÷ installed
Cost per lead            = spend ÷ applications
Cost per qualified lead  = spend ÷ qualified
Cost per tester          = spend ÷ opted_in
Cost per RETAINED tester = spend ÷ still_opted_in_at_14
```

### Targets

| Metric | Target | Below this, act |
|---|---|---|
| CTR | 1–2.5% | < 1% → new creative |
| Landing conversion | 15–30% | < 10% → page problem |
| Android rate | > 80% | < 70% → targeting problem |
| Qualification rate | 60–80% | < 50% → wrong audience |
| Opt-in rate | > 70% | < 60% → instructions problem |
| Install rate | > 90% of opt-ins | < 80% → wrong Google account |
| 14-day retention | > 70% | < 60% → not enough contact |
| Cost per retained tester | under ₹500 | over ₹800 → stop and rethink |

**Only one of these decides whether you succeed: cost per retained tester.** Every other number exists to tell you *where* it's going wrong. A campaign with a brilliant CTR and no retained testers has failed completely.

### The one query to run each morning

```sql
select * from beta_funnel;
```

One row, every stage. Compare it to yesterday's and you'll see which stage moved.

---

## 6. Reading the funnel — diagnosis by symptom

Fix the earliest broken stage. Everything downstream is noise until you do.

| What you see | What it means | What to do |
|---|---|---|
| Impressions high, CTR < 1% | Hook doesn't land | New creative. Don't touch targeting — it isn't the targeting. |
| CTR > 2%, conversion < 10% | The ad promised something the page didn't deliver | Make the page headline match the winning ad's hook word for word |
| `form_start` high, `submitted` low | A specific field is scaring people off | Almost always the Google Play email. Check with a session recording if you have one. |
| Applications high, Android rate < 70% | Meta is finding you iPhone users | Add "Android only" to the ad copy itself, and check device targeting |
| Qualified high, opt-ins < 60% | Invite unclear, or landing in spam | Rewrite Email 3, add the WhatsApp nudge at 24h |
| Opt-ins high, installs low | Wrong Google account | Personal WhatsApp with a screenshot walkthrough |
| Installs high, day-7 usage low | Product problem, not marketing | This is the most valuable finding in the whole beta. Investigate properly. |
| Testers dropping before day 14 | Not enough contact | Day-10 message is non-negotiable |
| Everything fine, feedback thin | Forms too long, or questions too polite | Shorten. Ask "what confused you", never "what did you think" |

---

## 7. The daily log

Five minutes each morning. A spreadsheet with one row per day:

| Date | Spend | Impr | Clicks | CTR | LP views | Apps | Android apps | Qualified | Invited | Opted in | CPL | Cost/tester | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

The `Note` column is the one that turns out to matter — "changed hero headline", "paused ad 3", "ran out of budget by 2pm". In three weeks you won't remember what you changed on day 4, and without it every number becomes uninterpretable.

**Weekly, ask four questions:**
1. Which single stage lost the most people?
2. Which ad produced *retained* testers, not clicks? (`select * from beta_by_ad;`)
3. What did I change this week, and did it move anything?
4. Am I on pace for 12 opted-in testers?

---

## 8. What you cannot measure, restated

Between "invited" and "still using it on day 7" there is no telemetry. Google doesn't report per-user opt-ins on a closed test, and your app doesn't currently join usage back to an applicant.

So those fields get filled in by hand, from replies. The WhatsApp sequence isn't nagging — it's the only instrument you have for the middle of the funnel. When someone doesn't reply on day 3 and day 10, that silence *is* your data point, and you should record it as one.

**If you run a second beta round**, spend an afternoon passing the applicant's email into the app at signup and storing it on the profile. That single join turns the darkest part of this funnel into real numbers. Not worth it for twenty people; very much worth it for two hundred.

Say NEXT for Phase E.
