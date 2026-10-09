-- Manual lifetime grants — now the FALLBACK, not the mechanism.
--
-- The Lemon Squeezy webhook handles this automatically:
--   supabase/functions/lemonsqueezy-webhook/index.ts
--   supabase/migrations/20261009120000_lifetime_grants.sql
--
-- Three things still need a human, and they are the reason this file survives.

-- ---------------------------------------------------------------------------
-- 1. BACKFILL — anyone who bought before the webhook existed
-- ---------------------------------------------------------------------------
--
-- Take the buyer emails from the Lemon Squeezy orders list and paste them in.
-- Everyone with an account is granted immediately; everyone without one gets a
-- pending grant that redeems itself the moment they sign up.

with buyers(email, order_id) as (
  values
    ('someone@example.com', 'LS-BACKFILL-1'),
    ('another@example.com', 'LS-BACKFILL-2')
    -- add rows here
),
inserted as (
  insert into public.pending_grants (email, plan, store, order_id, price_display)
  select lower(email), 'standard_lifetime', 'lemonsqueezy', order_id, '$29 — Seven-Day Reset'
  from buyers
  on conflict (order_id) do nothing
  returning *
)
select
  g.email,
  u.id is not null as account_exists,
  case when u.id is not null then 'granting now' else 'waiting for signup' end as status
from inserted g
left join auth.users u on lower(u.email) = lower(g.email);

-- Then apply the ones that have accounts:
select public.apply_lifetime_grant(
         u.id, g.plan, g.store, g.order_id, g.price_display)
from public.pending_grants g
join auth.users u on lower(u.email) = lower(g.email)
where g.redeemed_at is null;

update public.pending_grants g
set redeemed_at = now(), redeemed_user_id = u.id
from auth.users u
where lower(u.email) = lower(g.email) and g.redeemed_at is null;

-- ---------------------------------------------------------------------------
-- 2. WRONG EMAIL — the one support ticket this design creates
-- ---------------------------------------------------------------------------
--
-- Both pages say "use the same email you paid with", twice, in bold. Some
-- people will still pay with one address and sign up with another, and there
-- is no way to detect that automatically — the two accounts are genuinely
-- unrelated as far as any system can tell.
--
-- When somebody emails to say it hasn't appeared, move the grant across:

update public.pending_grants
set email = lower('the-address-they-signed-up-with@example.com')
where order_id = 'LS-12345';

-- then re-run the apply + update pair from section 1.

-- ---------------------------------------------------------------------------
-- 3. WATCHING IT
-- ---------------------------------------------------------------------------

-- Paid, no account yet. Not errors — most are people who sign up on day three.
-- A row sitting here for two weeks is a retention signal, not a billing one.
select * from public.grants_awaiting_signup;

-- Who got access, and how long they took to claim it.
select * from public.grants_redeemed;

-- Everyone currently holding lifetime from a workbook purchase.
select u.email, s.plan, s.created_at
from public.subscriptions s
join auth.users u on u.id = s.user_id
where s.store = 'lemonsqueezy' and s.plan like '%lifetime%'
order by s.created_at desc;
