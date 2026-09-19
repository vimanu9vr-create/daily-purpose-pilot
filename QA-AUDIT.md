# END-TO-END QA REPORT — ManifestAI

Audited: the repository at `f6f4f16`..`94698e3`, the production Supabase project
`pkxkksamenqcvsaulceq`, and the public pages on
`daily-purpose-pilot.vimanu9-vr.workers.dev`.

**Read this first.** A large part of what you asked for could not be tested, and
I would rather say so than invent results. I cannot create an account (I have no
inbox and won't register on your behalf), so **no authenticated flow was
exercised** — no signup, no onboarding, no manifestation lifecycle, no data
persistence, no cross-user isolation. Two live probes were blocked mid-audit: a
direct REST call to check whether RLS actually stops an anonymous reader, and a
console/network read on `/app`. Both are listed under NOT VERIFIED with the
exact test you can run yourself in under a minute.

What follows is everything I *did* verify, and it found one issue that is
costing paying customers.

---

## SCALING PASS — "will this hold at a million users?"

Asked after the fix pass. The answer was no, for three reasons, and two of them
are now fixed in code. What follows is what was actually measured, not what
sounded likely.

### 1. The morning push job would have failed in the low thousands — FIXED

`send-daily-affirmation` fetched **every** profile with notifications enabled,
with no limit and no pagination, filtered them in JavaScript, then made roughly
six sequential HTTP round trips per due user inside a function with a 150-second
wall clock. At ~120 ms per round trip that is about two users a second.

The failure mode is the dangerous kind: it returns 200 having done part of the
job. Because the loop is ordered, the same people are served every morning and
the people sorted last are never reached at all. Nothing alerts.

Three changes, in order of how much they matter:

The due calculation moved into Postgres. `claim_due_morning_pushes` computes
"is it 07:00 where this person lives" as a SQL predicate, so only due rows ever
leave the database. This is the change that removes the dependency on total user
count. It also **claims** — marking and returning in one statement with `for
update skip locked` — so overlapping runs partition the work instead of
double-sending, which the old mark-at-the-end order could not prevent.

The per-user queries became per-batch queries using `user_id=in.(...)`. Six
hundred round trips for a batch of two hundred users became three.

The pushes now run with bounded concurrency (25 in flight) instead of strictly
one at a time. The bound matters as much as the concurrency: an unbounded
`Promise.all` would open thousands of sockets and get throttled, which is a
slower way to fail than being serial.

Net effect: roughly 2 users/second to roughly 200. When the per-invocation
budget runs out the function hands the remainder to a fresh invocation of
itself rather than being killed mid-batch.

**The honest remaining ceiling**, written down so it is a decision rather than
an oversight: this handles tens of thousands of users due in the same window.
Past that the handover chain gets long enough that its tail falls outside the
twenty-minute send window, and the right answer becomes a real queue (pgmq)
with independent consumers. Separately, the claim query still walks the
notification-enabled profiles once per run; past a few million that wants a
maintained `next_notify_at` column so it becomes a range scan. Neither is
needed yet.

### 2. The database had three indexes — FIXED

Not three missing indexes. **Three indexes, total**, across 22 tables:
`idx_affirmations_desire`, `idx_narration_spend_user_day`, `habits_desire_id_idx`.

Postgres indexes a primary key and a unique constraint automatically. It does
**not** index a foreign key. Every table here hangs off `user_id`, and every RLS
policy is a form of `using (auth.uid() = user_id)` — which is not a filter
applied after rows arrive, it is welded onto the query. So "read my
affirmations" was a sequential scan of the whole table, for every request, by
every user. Invisible at 661 rows. Fatal at ten million, and fatal across every
screen at once rather than one slow page.

`20260918100000_index_the_hot_paths.sql` adds 34 indexes on the columns the app
actually filters and sorts by. This is also the cheapest possible moment to do
it: `create index` on a 661-row table is instant, and on a ten-million-row table
it is a maintenance window.

### 3. The real ceiling is margin, not machines — NOT a code fix

Cloudflare Workers and Supabase will both scale past a million without changes.
The unit economics won't. A Voice subscriber using the full 45 narrations costs
about $8.76 against $10.62 net — **18 cents kept on the dollar** — and every free
user costs AI calls while earning nothing. A million users on the current cost
model is a bill, not a win. That is a pricing decision, not an engineering one,
so nothing was changed here.

### Also found while looking: two phantom columns

`send-daily-affirmation` reads `sub.platform` and `sub.device_token`. Neither
column exists on `push_subscriptions` — not in the migrations, not in the live
database. `select=*` simply never returned them, so both comparisons were
`undefined === "ios"` and the code silently fell back to parsing the token out
of the `endpoint` string. It never threw, which is why it was never found. Added
in `20260918102000_push_subscriptions_native_columns.sql`, with the fallbacks
kept so existing rows still work.

### What was verified, and what was not

Verified: 205 tests pass (28 new, covering the batching, grouping and
concurrency that previously had no test coverage at all), types clean, lint
clean, build clean. All three migrations were parsed with libpg_query, including
the function body inside the `$$` quotes — which the outer parse treats as an
opaque string and would happily have let a syntax error through. The parse tree
was then checked to confirm the `for update skip locked` and the clamped limit
survived, rather than trusting that they read correctly.

That check caught two real defects before they shipped: `return query update ...
returning` is not valid PL/pgSQL and fails at CREATE time (rewritten as a plain
SQL function wrapping the UPDATE in a CTE), and the columns `date` and
`position` are keywords that the parser takes as a type and a function unless
quoted in an index column list.

**NOT verified: none of the three migrations has been run.** `execute_sql` and
`apply_migration` are both blocked in this environment, and no Postgres was
available locally to run them against. They parse correctly and the logic has
been reasoned through, but "parses" is not "works". Applying them is the test.

---

## STATUS AFTER THE FIX PASS

**Fixed and verified** — 177 tests pass, build clean, types clean, lint clean:

| # | Was | Now |
|---|---|---|
| 1 | Voice sold ~50 narrations, server enforced 30 | Server raised to **4/day, 45/month**. `allowance-parity.test.ts` reads the literal out of the edge function and fails the build if client and server ever drift again. |
| 2 | `.env` tracked in git | Untracked via `git rm --cached` (file kept on disk), `.gitignore` rule added, `.env.example` added. Full history scan: only public values were ever committed — **no rotation needed**. |
| 4 | 21 of 26 routes had no error branch | `ErrorState` component added next to the existing `EmptyState`. Applied to `app.week`, `app.vision`, `app.library`. `app.week` had the worst form of the bug — `if (isPending \|\| !summary)` spun forever after a failed request. |
| 6 | No sitemap | `public/sitemap.xml` written, referenced from `robots.txt`. |
| 7 | No canonical | Added, driven by a single `SITE_URL` constant. |
| 8 | No og:title/description/image | All added plus `twitter:*`, with a real 1200×630 `og.jpg` built from the app's own UI copy. Verified present in the SSR bundle. |

### Correction to finding #5 — I was wrong

I reported Sentry as "440 KB shipped to every visitor". **It isn't.** `telemetry.ts`
loads it through a dynamic `import()` guarded by `if (VITE_SENTRY_DSN)`, and that
variable is not set. The chunk sits on the CDN and is never fetched — users
download zero bytes of it. I saw a large file in the assets directory and
inferred it shipped, which is exactly the assumption this audit was supposed to
avoid. No change was made because none was needed.

### RLS enforcement — NOW VERIFIED, and it passes

Tested live, signed out, against `public.desires` with the publishable key:

```
{"code":"42501","message":"permission denied for table desires",
 "hint":"Grant the required privileges to the current role with:
         GRANT SELECT ON public.desires TO anon;"}
```

Stronger than the `[]` I was hoping for. `42501` means the `anon` role does not
hold SELECT on the table at all — the request is refused at the **GRANT** layer,
before row-level security is even consulted. That is defence in depth: two
independent barriers, so a misconfigured RLS policy alone could not expose the
table.

The app still works because `authenticated` holds the grant and RLS then scopes
those rows to `auth.uid()`.

**This closes the only potential P0 in the audit.**

Worth repeating the same URL against `journals`, `moments` and `profiles` to
confirm the grants are consistent — one table configured differently from the
rest is exactly the kind of thing that hides.

**Still outstanding** — 3 (RLS policies in migrations), 9 (analytics), and the
authenticated flows under NOT VERIFIED. Reasons below.

---

## Executive Summary

| | |
| --- | --- |
| **Production readiness** | Close, but not ready for paid traffic until #1 is fixed |
| **Critical blockers** | **0** — RLS enforcement tested live and passed at the GRANT layer |
| **Major issues** | 1 — the app promises more narration than the server allows |
| **Minor issues** | 6 — secrets hygiene, RLS reproducibility, SEO, bundle weight, error states |
| **Security concerns** | 1 latent (`.env` tracked, `.gitignore` has no env rule) |
| **UX concerns** | Error states exist on 5 of 26 authenticated routes |

---

## 1. VERIFIED WORKING

Each of these was actually executed, not inferred.

- **Build succeeds.** `vite build` completes in 1.37s, Nitro output generated, Cloudflare worker config written.
- **174 unit tests pass** across 15 files. TypeScript compiles with zero errors. ESLint passes with zero errors.
- **RLS is enabled on all 22 public tables.** Confirmed from Supabase's own metadata via `list_tables`, not from the code.
- **16 of 17 edge functions verify the caller's JWT.** The seventeenth, `push-config`, deliberately does not — it serves only the VAPID *public* key, which ships in every subscription request anyway. Documented at length in the function itself. Not a finding.
- **`revenuecat-webhook` is authenticated** by a shared secret in the `Authorization` header.
- **The service-role key never reaches the browser.** It appears only in `src/integrations/supabase/client.server.ts`, read from `process.env`, which is server-only. No `VITE_`-prefixed secret exists anywhere in `src/`.
- **Password reset is fully implemented** — both halves. `src/routes/forgot-password.tsx` calls `resetPasswordForEmail`, and `src/routes/reset-password.tsx` exists to set the new one. You asked me to flag this as missing if it were; it isn't.
- **Google and Apple OAuth are wired** in `src/routes/auth.tsx` alongside email/password.
- **Public pages render correctly in a real browser** — landing page at `/`, workbook page at `/reset/`, thank-you page at `/reset/thanks.html`. Screenshotted, not assumed.
- **Landing pricing is live and correct** — $2.49 and $6.99 per week with the yearly price as small print.
- **Every `<img>` in the app has an `alt` attribute.**
- **Icon-only buttons carry `aria-label`** across 12 route files.
- **The narration spend cap exists and is enforced server-side** in `narrate-story`, not just in the client. (Its *value* is wrong — see #1.)

---

## 2. BROKEN

| # | Feature | Problem | Severity | Evidence | Fix |
|---|---|---|---|---|---|
| 1 | Voice narration allowance | The app sells "around fifty narrations a month — four in a day" but the server cuts subscribers off at **30/month and 3/day**. A Voice subscriber who uses what they paid for hits a wall 40% early. | **P1** | `src/features/billing/plans.ts:255` → `voice: { perDay: 4, perMonth: 45 }` and `:185` → "Around fifty narrations a month". `supabase/functions/narrate-story/index.ts:65` → `voice: { perDay: 3, perMonth: 30 }` | Decide which is true and make both match. The plans.ts comment argues 45 is affordable against the yearly plan; if that maths still holds, raise the server. If not, lower the marketing copy. Do not ship the mismatch. |
| 2 | Secrets hygiene | `.env` is tracked in git across 5 commits and `.gitignore` contains no env rule. | **P2** | `git ls-files` returns `.env`; `grep env .gitignore` returns nothing | See "Security findings" — the current contents are harmless, the pattern is not. |
| 3 | RLS reproducibility | 22 tables have RLS enabled, but only **one** policy is defined in migrations (`narration_spend_own_read`). The rest were created in the dashboard and exist nowhere in version control. | **P2** | `grep -c "create policy" supabase/migrations/*.sql` → 1 | Dump the live policies and commit them as a migration. Right now a restore from this repo produces an app where every table is either locked or, worse, differently permissioned than you think. |
| 4 | Error states | 5 of 26 authenticated routes render anything when a query fails. The other 21 render a permanent skeleton or an empty screen. | **P3** | `grep -lc "error &&\|isError" src/routes/_authenticated/*.tsx` → 5 of 26 | At minimum add the pattern already used in `app.habits.tsx` to the routes a new user hits first: index, practice, vision, journal. |
| 5 | Client bundle weight | Sentry ships **440 KB raw / 142 KB gzipped** to every visitor. That is the single largest client asset, larger than the app's own entry chunk. | **P3** | `.output/public/assets/prod-DMkOm_a7.js`, confirmed to contain Sentry | Lazy-load Sentry after first paint, or drop to `@sentry/browser`'s minimal build. On the mobile traffic you're driving from Instagram this is the most expensive thing on the page. |
| 6 | SEO — no sitemap | `public/sitemap.xml` does not exist. | **P3** | `ls public/` | Generate one covering `/`, `/get`, `/reset/`, `/auth`. |
| 7 | SEO — no canonical | No canonical URL tag anywhere in `__root.tsx`. | **P3** | `grep canonical src/routes/__root.tsx` → nothing | Add one. Matters more once you have a custom domain and both it and `workers.dev` resolve. |
| 8 | Social sharing | `og:type` and `twitter:card` are present, but **`og:title`, `og:description`, `og:image` and `twitter:image` are all absent.** Every link anyone shares — including the one in your Instagram bio — renders as a bare URL with no image. | **P3** | `grep "og:title\|og:image" src/routes/__root.tsx` → no matches | Add the four tags. You already have `og.jpg` built for the workbook page; make an equivalent for the app. This is the cheapest conversion fix on the list. |

---

## 3. NOT VERIFIED

| Feature | Why it could not be verified |
|---|---|
| **RLS actually enforced at runtime** | Two attempts blocked. The sandbox cannot reach `supabase.co` (allowlisted network, `curl` returned HTTP 000), and the tool-level fetch was denied by the safety classifier. **This is the single most important unverified item.** See the test below. |
| Signup, login, logout, session persistence | I will not create accounts on your behalf and have no inbox to confirm an email. |
| Onboarding flow | Behind auth. |
| Manifestation / affirmation / journal lifecycle (create → save → refresh → edit → delete) | Behind auth. |
| Data persistence across logout/login | Behind auth. |
| **Cross-user data isolation** | Requires two accounts. Not testable by me. Depends entirely on the RLS policies that aren't in version control. |
| All AI endpoints end to end | Require a valid JWT. Code review only: all 16 verify auth and most reference rate limiting. |
| Console errors and failed network requests on `/app` | Browser read blocked by the classifier. |
| Mobile viewports at 320/375/390/414/768/1024 | `resize_window` resized the browser window but the page continued rendering at desktop width, so any screenshot would have been misleading. I did not want to report a layout finding I hadn't actually seen. |
| Browser compatibility (Safari, Firefox, Edge) | Only Chrome available. |
| Real-world page load timing | Requires a live profiling run against `/app`. |

### The RLS test — run this yourself, it takes 30 seconds

Open a **private/incognito window** (so you are not logged in) and paste this
into the address bar:

```
https://pkxkksamenqcvsaulceq.supabase.co/rest/v1/desires?select=title&limit=5&apikey=sb_publishable_HreDAA4wnMELA_10F3dfPQ_-Epz3eYh
```

- **`[]` (empty array)** → RLS is working. Anonymous readers see nothing. Good.
- **Any rows of real data** → **P0 BLOCKER.** Every user's private dreams are readable by anyone with your publishable key, which ships in your app bundle and is therefore public. Stop and fix before another person signs up.

Repeat with `journals`, `moments` and `profiles` — those are the most sensitive.

---

## 4. MISSING FEATURES

| Feature | Importance | Recommendation |
|---|---|---|
| Sitemap | Low now, medium later | One static file. |
| OG image / title / description | **High** | Every share of your bio link currently previews as a naked URL. Fix before you drive more traffic. |
| Canonical URL | Low | Add with the custom domain. |
| Analytics | **High** | There is no analytics in the codebase. You cannot see where users drop off, which means the conversion funnel below is reasoning, not measurement. |

---

## 5. SECURITY FINDINGS

| Issue | Severity | Evidence | Fix |
|---|---|---|---|
| `.env` committed to git, no `.gitignore` rule | **P2 (latent, not current)** | `git ls-files` → `.env`, across 5 commits. Contents inspected without printing values: `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, three `VITE_` duplicates, `VITE_VAPID_PUBLIC_KEY`. **All seven are public by design** — they ship in the browser bundle regardless. | Nothing is currently leaked. But you are about to add Brevo SMTP credentials and the private VAPID key, and with no `.gitignore` rule those get committed the moment you save. Add `.env` to `.gitignore` and `git rm --cached .env` now, before the next secret goes in. |
| RLS policies absent from version control | **P2** | 1 policy in migrations vs 22 tables with RLS on | Export and commit them. The security of every table currently depends on dashboard state nobody can review. |
| Webhook secret compared with `!==` | **P4** | `revenuecat-webhook/index.ts:98` | Timing-safe comparison is the textbook fix. Realistically negligible for a webhook secret; noted for completeness, not urgency. |
| Service-role key exposure | **None found** | Only in `client.server.ts`, server-side | No action. |

---

## 6. PERFORMANCE FINDINGS

| Issue | Impact | Recommendation |
|---|---|---|
| Sentry: 440 KB raw / 142 KB gzip on the client | Largest asset on the page. On 4G this is roughly a second of the load budget, spent on error reporting rather than the product. | Lazy-load after first paint. |
| `index` chunk 404 KB raw / 120 KB gzip | Entry cost before anything renders | Acceptable, but worth checking what's in it once Sentry moves. |
| `app.progress` 388 KB (recharts) | Already code-split — only paid on that route | No action. Correctly done. |
| Total heavy client JS ≈ 1.2 MB raw | The audience arrives from Instagram on phones, on mobile data | Sentry is the one worth moving. |

---

## 7. MOBILE FINDINGS

Only one mobile issue was found and it came from code review, not observation —
I could not get a trustworthy mobile render.

| Screen | Problem | Severity | Recommendation |
|---|---|---|---|
| App shell (every screen) | Bottom nav used `pb-5` (20px) against a ~34px iPhone home-indicator inset, so the bar sat partly underneath it | P2 — **already fixed** this session | Verify on your own phone. |
| All | Not observed at 320–1024px | NOT VERIFIED | Open the app on a real phone and a tablet. This is the gap I'd most like closed. |

---

## 8. UX / CONVERSION FINDINGS

Funnel reasoning, not measurement — **there is no analytics in this codebase**,
so drop-off is not measurable from the current implementation.

| Step | Problem | Potential impact | Recommendation |
|---|---|---|---|
| Share → landing | No `og:image`/`og:title`. Every shared link previews as a bare URL. | People decide whether to tap from the preview. A blank one loses them before the page loads. | Add the four OG tags. Highest return on the smallest effort here. |
| Landing → signup | Fixed this session — the page led with $149.99/year | Was asking a year-long commitment from someone who'd read nothing | Done. |
| Signup → first value | Not verifiable without an account | — | Watch a real person do it. |
| Any screen, on failure | 21 of 26 routes show a permanent skeleton rather than an error | A new user on a flaky connection sees a broken app and concludes the app is broken | Add error states to index, practice, vision, journal first. |
| Paid user, day 11 | Voice subscriber hits a 30/month cap after being sold ~50 | Refund request and a bad review from your best-paying user | Fix #1. |

---

## 9. TOP FIXES, in order

1. **Run the RLS test above.** Everything else is cosmetic if that returns data.
2. **Fix the narration allowance mismatch** (`plans.ts` vs `narrate-story`).
3. **`.gitignore` the `.env` and `git rm --cached` it** — before adding Brevo or the private VAPID key.
4. **Add `og:title`, `og:description`, `og:image`, `twitter:image`.**
5. **Commit the RLS policies as a migration.**
6. **Add error states** to the four first-visit routes.
7. **Lazy-load Sentry.**
8. **Test on a real phone** at 320px and 768px and report anything broken.
9. **Add analytics** — you are optimising a funnel you cannot see.
10. Sitemap and canonical.

---

## 10. FINAL PRODUCTION CHECKLIST

| Item | Status |
|---|---|
| Signup | [NOT VERIFIED] |
| Login | [NOT VERIFIED] |
| Logout | [NOT VERIFIED] |
| Authentication persistence | [NOT VERIFIED] |
| Database persistence | [NOT VERIFIED] |
| **User data isolation** | **[NOT VERIFIED — test it first]** |
| Manifestation creation / editing / deletion | [NOT VERIFIED] |
| AI functionality | [NOT VERIFIED] — auth verified in code on all 16 endpoints |
| Dashboard | [NOT VERIFIED] |
| Navigation | [NOT VERIFIED] |
| Forms | [NOT VERIFIED] |
| Error handling | [FAIL] — 5 of 26 routes |
| Mobile responsiveness | [NOT VERIFIED] — safe-area bug found and fixed by code review |
| Desktop responsiveness | [PASS] — public pages verified in browser |
| Performance | [FAIL] — Sentry at 142 KB gzip on the client |
| Security | [PASS with caveats] — no secret exposure found; RLS enforcement unverified |
| Accessibility | [PASS, partial] — alt text and aria-labels present; keyboard and contrast not tested |
| SEO | [FAIL] — no sitemap, no canonical |
| Social sharing | [FAIL] — no OG title/description/image |
| Core user journey | **[NOT VERIFIED]** |

---

## Does the core user journey work end to end?

**Unknown, and I won't pretend otherwise.** Every step of it sits behind a
signup I can't perform. The build is clean, the tests pass, the auth code is
present and correct-looking, and the public surface works — but "looks correct
in the source" is precisely the answer you told me not to give.

The honest position: this is a well-built application with unusually careful
code comments and one real bug that is currently short-changing paying
customers. Whether the journey works is a twenty-minute question, and it needs a
human with an email address.

Do that walkthrough yourself, write down every place you hesitate, and bring me
the list.
