# Phase C — Technical implementation

Everything here is verification and setup. No new copy. Work top to bottom; each step is quick.

---

## 1. Run the hardening SQL

Paste `growth/beta/beta_hardening.sql` into the Supabase SQL Editor and run it once. It fixes three things that would have cost you real testers.

**The unique index was on the wrong column.** It was on `email`, but the address Google actually matches on is `play_email`. Two people could apply with the same Google account under different contact emails, and you'd have invited one account twice while believing you had two testers. On a twenty-place list, that's a hole in the count you'd only find at day 12.

**The `beta_pipeline` view could have leaked the whole table.** Views run with their *owner's* privileges, not the caller's — which makes a view over an RLS-protected table a way around that RLS if anyone can select from it. No grant was issued, so it was probably fine. "Probably fine" isn't a security posture, so this revokes explicitly.

**Nothing rate-limited the endpoint.** The honeypot and the 3-second gate on the page are both JavaScript, which means neither exists as far as a script is concerned — a bot posts straight to the REST endpoint and never loads your page. The trigger caps insertions at 20/hour globally. You're recruiting twenty people in total, so a legitimate hour never comes close.

---

## 2. Verify the security yourself

Don't take my word for it. Two checks, both 30 seconds.

**In the SQL Editor:**

```sql
select
  has_table_privilege('anon','public.beta_applications','select') as can_read_table,
  has_table_privilege('anon','public.beta_applications','insert') as can_insert,
  has_table_privilege('anon','public.beta_pipeline','select')     as can_read_view;
```

You want `false, true, false`. Anything else, stop and tell me.

**From a browser** — open your beta page, press F12, Console tab, paste this:

```js
fetch("https://pkxkksamenqcvsaulceq.supabase.co/rest/v1/beta_applications?select=*", {
  headers: {
    apikey: "sb_publishable_HreDAA4wnMELA_10F3dfPQ_-Epz3eYh",
    Authorization: "Bearer sb_publishable_HreDAA4wnMELA_10F3dfPQ_-Epz3eYh"
  }
}).then(r => r.json()).then(console.log);
```

You want a permission error. **If rows come back, take the page down immediately** — that would mean every applicant's email and personal goal is publicly readable by anyone who views your page source.

This test matters more than it looks. The publishable key is public by design and that's fine — but it's only fine *because* RLS holds. Verify the thing you're relying on.

---

## 3. Deploy the pages

1. Replace `YOUR_PIXEL_ID` in **both** files (2 places in `index.html`, 2 in `thanks.html`)
2. Replace `G-XXXXXXXXXX` in **both** files (2 places each)
3. Create a 1200×630 `og.png` and upload it alongside the HTML
4. Upload all three files to your Cloudflare project
5. Purge cache

---

## 4. Email — the piece you don't have yet

There's no email infrastructure in your stack. You currently have nine emails written and no way to send them.

**Don't automate this.** For twenty testers, send them by hand from Gmail. Reasons:

- Twenty people × nine emails is 180 sends across three weeks. That's minutes a day.
- Beta emails need personalising anyway — Email 9 references what *that tester's* feedback changed. An automated one can't.
- A personal Gmail lands in the inbox. A new sending domain with no reputation lands in Promotions, and the Play invite is the one email that absolutely must arrive.
- Setting up Resend, a domain, SPF/DKIM and templates is half a day you could spend recruiting.

Use Gmail templates: Settings → See all settings → Advanced → Templates → Enable. Paste each of the nine, then it's three clicks per send.

**Automate only when you're past 100 users.** At that point Resend is the right choice — you already have Supabase edge functions to call it from.

**One thing worth setting up now:** a Gmail filter that labels replies from beta testers. `subject:(ManifestAI beta)` → apply label "Beta". You'll be glad of it around day 7.

---

## 5. Test the funnel end to end

Do all of this on a phone, on mobile data, not on your laptop over wifi. Every tester will arrive that way.

| # | Test | Pass |
|---|---|---|
| 1 | Open the page on Android Chrome | Loads under 3s, nothing overlaps |
| 2 | Open on iPhone Safari | Same |
| 3 | Tap "Apply" in the header | Jumps to the form |
| 4 | Submit empty | Errors show, focus lands on the first bad field |
| 5 | Type `you@gmial.com` in Play email, tap away | Typo warning appears |
| 6 | Type `you@yahoo.com`, tap away | Non-Google warning appears |
| 7 | Choose "No, I'm on iPhone" | Amber note appears, launch-list ticks itself |
| 8 | Submit a real application | Lands on thank-you, greeted by first name |
| 9 | Refresh the thank-you page | Greeting changes to "Looking for the application?" and **no second conversion fires** |
| 10 | Submit the same Play email again | "You've already applied" — not an error |
| 11 | Visit with `?utm_source=instagram&utm_campaign=beta_test&utm_content=ad01` and apply | Those values land in the row |
| 12 | Check the row | `select * from beta_pipeline;` |
| 13 | Meta Pixel Helper on both pages | PageView on both, Lead once on thank-you |
| 14 | GA4 DebugView | `form_start`, `beta_application_submitted`, `generate_lead` |

Test 9 is the one people skip and the one that costs money. If Lead fires on every refresh, Meta optimises against inflated numbers and your reported cost per lead is a fiction.

---

## 6. Tracking: what's real and what isn't

You asked me not to pretend we can track things we can't. Here's the honest split.

### Tracked automatically on the website

| Event | Fires when | Where |
|---|---|---|
| `PageView` | Page loads | Pixel + GA4 |
| `cta_click` | Any Apply button | GA4 + Pixel custom |
| `form_start` | First keystroke in the form | GA4 + Pixel custom |
| `ineligible_ios` | Selects iPhone | GA4 + Pixel custom |
| `duplicate_application` | 409 returned | GA4 + Pixel custom |
| `form_error` | Insert failed | GA4 + Pixel custom |
| `beta_application_submitted` | Insert succeeded | GA4 + Pixel custom |
| `Lead` / `generate_lead` | Thank-you page, once per submission | Pixel + GA4 |

### Not trackable from the website — you record these by hand

| Event | Why not | Where it comes from |
|---|---|---|
| `qualified_lead` | It's your judgement, not an action | You set `status` |
| `tester_invited` | You send the email | `invited_at` |
| `play_opt_in` | **Google does not report this to you per-user.** Play Console shows tester counts, not who joined when | Ask them, or infer from installs |
| `installed` | Play Console gives aggregate installs. Per-user attribution isn't available on a closed test | `installed_at`, from asking |
| `day_1` / `day_7` / `day_14` activity | Only if you instrument it in-app and can join it to the applicant | Your own analytics, if you build it |
| `feedback_complete` | Google Forms response | Boolean columns |

**The honest limitation:** between "we invited them" and "they came back on day 7", you are relying on people telling you. That is why the WhatsApp sequence exists — it's not nagging, it's your only instrumentation for the middle of the funnel.

**One thing worth building:** if the app recorded an `applicant_id` at signup, you could join Supabase app usage to beta applicants and see real day-1/7/14 activity. That's an afternoon of work and it'd turn the darkest part of the funnel into data. Worth it if you plan more beta rounds; skip it for twenty people.

---

## 7. UTM structure

**Convention:** all lowercase, underscores not spaces, never change a name once it's live.

```
utm_source   = instagram | facebook | whatsapp | reddit | direct_dm
utm_medium   = paid_social | organic_social | message | community
utm_campaign = beta_recruit_sep26
utm_content  = ad01_day_four | ad02_not_your_fault | ad03_show_product |
               ad04_honest | ad05_vision_board | reel01 … reel10 | dm_friends
utm_term     = broad | interest        (ad set, so you can read them apart)
```

**Ready to paste:**

```
https://manifest-beta.vimanu9-vr.workers.dev/?utm_source=instagram&utm_medium=paid_social&utm_campaign=beta_recruit_sep26&utm_content=ad01_day_four&utm_term=broad
https://manifest-beta.vimanu9-vr.workers.dev/?utm_source=instagram&utm_medium=paid_social&utm_campaign=beta_recruit_sep26&utm_content=ad02_not_your_fault&utm_term=broad
https://manifest-beta.vimanu9-vr.workers.dev/?utm_source=instagram&utm_medium=paid_social&utm_campaign=beta_recruit_sep26&utm_content=ad03_show_product&utm_term=interest
https://manifest-beta.vimanu9-vr.workers.dev/?utm_source=instagram&utm_medium=paid_social&utm_campaign=beta_recruit_sep26&utm_content=ad04_honest&utm_term=broad
https://manifest-beta.vimanu9-vr.workers.dev/?utm_source=instagram&utm_medium=paid_social&utm_campaign=beta_recruit_sep26&utm_content=ad05_vision_board&utm_term=interest
https://manifest-beta.vimanu9-vr.workers.dev/?utm_source=whatsapp&utm_medium=message&utm_campaign=beta_recruit_sep26&utm_content=dm_friends
https://manifest-beta.vimanu9-vr.workers.dev/?utm_source=reddit&utm_medium=community&utm_campaign=beta_recruit_sep26&utm_content=r_alphaandbetausers
```

Then read results with:

```sql
select * from beta_by_ad;
```

That view ranks by **retained testers**, not leads — because an ad that produces ten applicants who all vanish is worse than one that produces three who stay.

---

## 8. Google Sheet (if you want one)

Supabase is the source of truth — the form writes there. Use a Sheet only as a working surface.

Export `beta_pipeline` to CSV, then add these columns to the right of the exported data. Assuming your data starts in row 2 with `android` in column D and `goal` in column E:

| Column | Formula |
|---|---|
| Qualified? | `=IF(D2="no","NOT ELIGIBLE",IF(LEN(TRIM(E2))<12,"WAITLIST","QUALIFIED"))` |
| Days since applied | `=IF(A2="","",DAYS(TODAY(),A2))` |
| Needs chasing | `=IF(AND(H2="invited",I2=""),"CHASE","")` where H=status, I=opted_in_at |
| Day 14 due | `=IF(K2="","",K2+14)` where K=installed_at |

Summary block:

```
Applications        =COUNTA(B2:B)
Android eligible    =COUNTIF(D2:D,"<>no")
Qualified           =COUNTIF(L2:L,"QUALIFIED")
Opted in            =COUNTIF(H2:H,"opted_in")+COUNTIF(H2:H,"installed")+COUNTIF(H2:H,"active")
Still in at day 14  =COUNTIF(N2:N,TRUE)
Cost per tester     =AdSpend/Opted_in
NEED 12             =IF(Opted_in>=12,"✅ CLEAR","NEED "&(12-Opted_in)&" MORE")
```

That last row is the only number that decides whether you get production access.

---

## 9. What's now READY vs NOT READY

| Item | State |
|---|---|
| Landing page copy and design | READY |
| Form, validation, error handling | READY |
| Thank-you page and single-fire conversion | READY |
| Supabase table, RLS, rate limit, dedupe | READY **once you run the hardening SQL** |
| Security verified | NOT READY — you must run the two checks in §2 |
| Meta Pixel | NOT READY — placeholder ID |
| GA4 | NOT READY — placeholder ID |
| OG image | NOT READY — needs making |
| Email sequence | Written, NOT SET UP — Gmail templates |
| Ad creatives | Written, NOT PRODUCED — Phase F |
| Play closed test track | Uploaded, testers not opted in |

**Do not spend on ads until the pixel is verified firing.** Everything else can be imperfect; that one can't, because without it you're buying clicks blind and you won't know which ad worked.

Say NEXT for Phase D.
