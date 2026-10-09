-- Lifetime app access for Seven-Day Reset buyers.
--
-- The sales page and the thank-you page both promise this, so it has to be
-- delivered without a human in the loop. Granting it by hand worked while
-- there were two sales a day; it fails quietly the first weekend somebody buys
-- at 3am and waits until Monday for a thing they already paid for.
--
-- ---------------------------------------------------------------------------
-- THE PROBLEM THIS TABLE EXISTS FOR
-- ---------------------------------------------------------------------------
--
-- The order and the account arrive in either order, and usually in the wrong
-- one. Somebody buys the workbook, reads it for three days, and only then
-- signs up to the app. At the moment the payment lands there is no user row to
-- attach entitlement to — so a webhook that only knows how to write
-- `subscriptions` has nowhere to put it and silently drops the grant.
--
-- So the grant is recorded against the EMAIL, which exists at purchase time,
-- and is redeemed against the USER when one appears. Whichever happens first.

create table if not exists public.pending_grants (
  id uuid primary key default gen_random_uuid(),

  -- Lowercased on write. The join key between a payment processor that knows
  -- only an email and an auth system that knows only a uuid.
  email text not null,

  plan text not null default 'standard_lifetime',
  store text not null default 'lemonsqueezy',

  -- The processor's order id. Unique, so a webhook retry — and Lemon Squeezy
  -- does retry — cannot create a second grant for one payment.
  order_id text not null,

  price_display text,

  -- Set when the grant is actually applied to an account.
  redeemed_at timestamptz,
  redeemed_user_id uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now()
);

create unique index if not exists pending_grants_order_key
  on public.pending_grants (order_id);

create index if not exists pending_grants_email_idx
  on public.pending_grants (lower(email)) where redeemed_at is null;

alter table public.pending_grants enable row level security;

-- No policy for anon or authenticated. This table is written by the webhook
-- and read by a trigger, both running as the service role. A table that can
-- grant paid access must never be writable by a client.
revoke all on public.pending_grants from anon, authenticated;

-- NOT SUFFICIENT ON ITS OWN, and this file originally stopped here, which was
-- a mistake. Locking the table does nothing about the FUNCTIONS below:
-- Postgres grants EXECUTE on a new function to PUBLIC by default, and
-- PostgREST then serves it at /rest/v1/rpc/<name>. The hole that left is
-- closed in 20261009130000_lock_down_grant_functions.sql — read that before
-- changing anything here.

-- ---------------------------------------------------------------------------
-- APPLYING A GRANT
-- ---------------------------------------------------------------------------
--
-- One function, called from two places: the webhook when the account already
-- exists, and the signup trigger when it turns up later. Having a single
-- implementation is the point — two copies of entitlement logic drift, and
-- the drift is invisible until somebody has paid and has nothing.

create or replace function public.apply_lifetime_grant(
  p_user_id uuid,
  p_plan text,
  p_store text,
  p_order_id text,
  p_price_display text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_plan text;
begin
  -- Never downgrade someone. If they already hold an active plan, only
  -- replace it when the new one is lifetime and the old one isn't — a monthly
  -- subscriber who later buys the workbook should end up better off, and a
  -- lifetime holder who buys it again should not be quietly demoted.
  select plan into existing_plan
  from public.subscriptions
  where user_id = p_user_id and status = 'active'
  limit 1;

  if existing_plan is not null then
    if existing_plan like '%lifetime%' or existing_plan like 'voice%' then
      return false;   -- already equal or better; leave it alone
    end if;

    update public.subscriptions
    set plan = p_plan,
        store = p_store,
        store_transaction_id = coalesce(store_transaction_id, p_order_id),
        price_display = p_price_display,
        current_period_end = null,     -- lifetime does not expire
        cancel_at_period_end = false,
        updated_at = now()
    where user_id = p_user_id and status = 'active';
    return true;
  end if;

  insert into public.subscriptions
    (user_id, plan, status, store, store_transaction_id, price_display)
  values
    (p_user_id, p_plan, 'active', p_store, p_order_id, p_price_display)
  on conflict do nothing;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- REDEEMING ON SIGNUP
-- ---------------------------------------------------------------------------
--
-- The buyer who pays first and signs up later. This fires on account creation,
-- finds any unredeemed grant for that email, and applies it before they have
-- finished onboarding — so the app is already unlocked the first time they
-- look, rather than after a support email.

create or replace function public.redeem_pending_grants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
begin
  if new.email is null then
    return new;
  end if;

  for g in
    select * from public.pending_grants
    where lower(email) = lower(new.email) and redeemed_at is null
  loop
    perform public.apply_lifetime_grant(
      new.id, g.plan, g.store, g.order_id, g.price_display);

    update public.pending_grants
    set redeemed_at = now(), redeemed_user_id = new.id
    where id = g.id;
  end loop;

  return new;
exception
  -- A failing grant must never block account creation. This trigger runs
  -- inside the signup transaction, so an unhandled error here doesn't merely
  -- lose the entitlement — it aborts the INSERT and the person cannot create
  -- an account at all. Someone locked out of signup has no way to tell you
  -- about it; someone who signs up without the grant is a thirty-second fix.
  -- So warn into the Postgres log, let signup through, and reconcile from
  -- grants_awaiting_signup.
  when others then
    raise warning 'redeem_pending_grants failed for %: %', new.email, sqlerrm;
    return new;
end;
$$;

-- AFTER, not BEFORE: the subscriptions row references auth.users, so the user
-- has to exist before entitlement can point at it.
drop trigger if exists redeem_pending_grants_trigger on auth.users;
create trigger redeem_pending_grants_trigger
  after insert on auth.users
  for each row execute function public.redeem_pending_grants();

-- ---------------------------------------------------------------------------
-- OPERATIONAL VIEWS
-- ---------------------------------------------------------------------------

-- Paid, but no account yet. These are not errors — most of them are people
-- who will sign up on day three. Worth watching anyway: a name sitting here
-- for two weeks is somebody who bought and never came back, which is a
-- retention signal rather than a billing one.
create or replace view public.grants_awaiting_signup as
select email, plan, order_id, price_display, created_at,
       (now() - created_at) as waiting_for
from public.pending_grants
where redeemed_at is null
order by created_at desc;

-- Everyone who got their access, and how long it took them to claim it.
create or replace view public.grants_redeemed as
select g.email, g.plan, g.order_id, g.created_at as paid_at, g.redeemed_at,
       (g.redeemed_at - g.created_at) as time_to_claim
from public.pending_grants g
where g.redeemed_at is not null
order by g.redeemed_at desc;

revoke all on public.grants_awaiting_signup, public.grants_redeemed
  from anon, authenticated;
