-- The columns the push sender has always read but the database never had.
--
-- `send-daily-affirmation` routes each subscription by platform:
--
--     const isNativeSub =
--       sub.endpoint.startsWith("native:") ||
--       sub.platform === "ios" ||
--       sub.platform === "android";
--     const token = sub.device_token ?? sub.endpoint.replace(/^native:/, "");
--
-- Neither `platform` nor `device_token` exists on `public.push_subscriptions`,
-- in this repo or in the live database. `select=*` simply never returned them,
-- so both comparisons were `undefined === "ios"` and the code fell back to
-- parsing the token out of the endpoint string.
--
-- It did not throw, which is why nobody found it. It quietly meant that the
-- only way a native device could ever be recognised was by having written its
-- token into the `endpoint` column behind a `native:` prefix — a text column
-- with a UNIQUE constraint meant for web push endpoints — and that a device
-- re-registering with a new FCM token would collide with its own old row.
--
-- Adding the columns makes the existing code mean what it reads as. The
-- fallbacks stay in place, so rows written before this migration keep working.
--
-- There are 0 native subscriptions today, so this is additive and cannot
-- disturb anything. Both columns are nullable on purpose: a web subscription
-- legitimately has neither.

alter table public.push_subscriptions
  add column if not exists platform text
    check (platform is null or platform in ('web', 'ios', 'android')),
  add column if not exists device_token text;

comment on column public.push_subscriptions.platform is
  'web, ios or android. Null on rows created before native push existed; treat null as web.';
comment on column public.push_subscriptions.device_token is
  'FCM registration token for native devices. Null for web push, which uses endpoint + p256dh + auth instead.';

-- Backfill only what can be known for certain. A row whose endpoint is a real
-- URL is unambiguously web push. A `native:` row is NOT backfilled, because
-- iOS also delivers through Firebase and the endpoint alone cannot tell the
-- two apart — guessing 'android' here would write a wrong value that looks
-- authoritative. Those rows keep the existing endpoint-prefix fallback until
-- the device re-registers and says which it is.
update public.push_subscriptions
   set platform = 'web'
 where platform is null
   and endpoint not like 'native:%';

-- A device token is per install and must not be shared between rows. Partial,
-- because null is the normal case for web subscriptions and several nulls must
-- not collide with each other.
create unique index if not exists push_subscriptions_device_token_key
  on public.push_subscriptions (device_token)
  where device_token is not null;
