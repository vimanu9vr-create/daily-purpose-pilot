# RevenueCat setup

Work through this in order. Nothing here is code — it is all configuration in
three dashboards, and the app is already written to match it.

The one thing to understand before starting: **the app never decides who has
paid.** RevenueCat tells our server, our server writes a row, and the app reads
that row. So if the webhook is wrong, the purchase succeeds and the person gets
nothing — which is the worst failure available. Step 6 is the one to get right.

---

## 1. App Store Connect — create the products first

RevenueCat imports these, so they have to exist first. Under your app →
**Monetization → In-App Purchases**, create five. The IDs must match character
for character or the plan will not appear on the device.

| Product ID | Type | Price |
| --- | --- | --- |
| `com.manifestai.standard.monthly` | Auto-renewable subscription | $6.99 |
| `com.manifestai.standard.yearly` | Auto-renewable subscription | $49.99 |
| `com.manifestai.standard.lifetime` | Non-consumable | $79.99 |
| `com.manifestai.voice.monthly` | Auto-renewable subscription | $19.99 |
| `com.manifestai.voice.yearly` | Auto-renewable subscription | $149.99 |

The four subscriptions go in **one subscription group**. That is what lets
somebody move between Standard and Voice, and between monthly and yearly,
without buying twice — Apple handles the proration.

Lifetime is a **non-consumable**, not a subscription. It never renews.

Each one needs a display name, a description and a screenshot before Apple will
review it. They can stay in "Ready to Submit" while you test in sandbox.

---

## 2. RevenueCat — project and app

[app.revenuecat.com](https://app.revenuecat.com), create a project.

Add an app: **App Store**. It asks for your bundle ID — `com.manifestai.app` —
and an **App Store Connect API key**, which you generate in App Store Connect
under Users and Access → Integrations. RevenueCat needs it to verify receipts.

---

## 3. Import the products

Products → **Import from App Store Connect**. All five should appear. If any is
missing it is almost always because it has no metadata yet in step 1.

---

## 4. Entitlement — and this one has a trap

Create ONE entitlement with the identifier exactly:

```
premium
```

**Attach all five products to it, including the Standard ones.**

That looks wrong and isn't. The app checks this entitlement only to answer "did
the purchase go through" — see `AppleStore.purchase()` in
`src/features/billing/store.ts`. If a Standard product has no entitlement, the
SDK reports no active entitlement, and the app tells somebody who has just paid
that their purchase failed.

Standard versus Voice is decided by the **plan id on the subscriptions row**,
which the webhook writes from the product id. Not by this entitlement.

---

## 5. Offering

Create an offering, make it **current**, and add five packages — one per
product. The app looks products up by their identifier, so package naming is
free; use whatever is readable.

---

## 6. The webhook — the important one

Project settings → **Integrations → Webhooks → Add**.

**URL**

```
https://pkxkksamenqcvsaulceq.supabase.co/functions/v1/revenuecat-webhook
```

**Authorization header** — invent a long random string. This exact value goes
in two places and must match:

- the Authorization field in RevenueCat
- the `REVENUECAT_WEBHOOK_SECRET` secret in Supabase

```bash
# generate one
openssl rand -hex 32

# store it (paste the same value into RevenueCat)
npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=THE_VALUE --project-ref pkxkksamenqcvsaulceq
```

Send **all** event types. The function ignores what it doesn't handle, and
renewals, refunds and expirations are the ones that keep access honest over
time — a webhook that only sends purchases means nobody's access ever ends.

### Deploy it with JWT verification OFF

This is currently deployed with `verify_jwt: true`, which makes Supabase reject
the request before our code runs — RevenueCat sends the shared secret in the
Authorization header, not a Supabase token. The function does its own auth
(step 6 above), so:

```bash
npx supabase functions deploy revenuecat-webhook \
  --project-ref pkxkksamenqcvsaulceq --use-api --no-verify-jwt
```

Without `--no-verify-jwt` every webhook returns 401 and no purchase ever
reaches the database.

---

## 7. The app's key

RevenueCat → API keys → the **public** Apple key (starts `appl_`). Not the
secret key.

Add to `.env`:

```
VITE_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxx
```

Then rebuild — Vite bakes env vars in, so a running dev server won't pick it up.

---

## 8. Test it in sandbox

In App Store Connect → Users and Access → **Sandbox Testers**, create one. Sign
out of the App Store on your device first, then buy inside the app; the sandbox
account is prompted at purchase time.

Buy Standard monthly, then check the row landed:

```sql
select plan, status, store, current_period_end, created_at
from subscriptions order by created_at desc limit 3;
```

You want `plan = 'standard_monthly'`. If it says `voice_monthly` the product
mapping is wrong; if there is no row at all, the webhook is being rejected —
check step 6, and the function logs will say which.

Then check the app: Profile should show **Standard**, and a story's play button
should offer the Voice plan rather than narrating.

---

## What each failure looks like

| Symptom | Cause |
| --- | --- |
| "The purchase didn't complete" after paying | A product isn't attached to the `premium` entitlement (step 4) |
| Payment works, plan stays Free | Webhook rejected — almost always `verify_jwt`, or a mismatched secret |
| Wrong tier granted | Product id not in `PLAN_BY_PRODUCT`; the function logs `UNMAPPED PRODUCT` |
| Plans don't appear on the device | Product ids don't match `plans.ts`, or the offering isn't marked current |
