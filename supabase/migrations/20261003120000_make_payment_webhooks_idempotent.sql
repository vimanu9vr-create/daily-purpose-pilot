-- A replayed payment webhook creates a second subscription row.
--
-- Both stores retry. Lemon Squeezy retries on any non-2xx and on a timeout,
-- RevenueCat likewise, and either will happily deliver the same event twice on
-- a slow response that eventually succeeded. Nothing in the current schema
-- stops that: `store_transaction_id` has no unique constraint, and the Lemon
-- webhook builds it as
--
--     ls:{variant_id}:{user_id}
--
-- which is the SAME STRING for every renewal of the same plan by the same
-- person. So it identifies a plan-and-person, not a payment. It cannot
-- deduplicate anything, and it collides on purpose every renewal.
--
-- The visible damage is two active rows for one person. `useSubscription`
-- reads with `.maybeSingle()`, which ERRORS when more than one row comes back
-- — so the paywall would fail open to free for somebody who had just paid,
-- which is the worst possible moment for it.
--
-- Two separate problems, two separate fixes below.

-- ---------------------------------------------------------------------------
-- 1. One active subscription per person, enforced by the database.
-- ---------------------------------------------------------------------------
--
-- The webhooks already supersede the previous row before inserting a new one,
-- but that is two statements with a gap between them, and a retry can land in
-- the gap. A partial unique index closes it: the second insert fails rather
-- than quietly duplicating, the webhook returns non-2xx, and the store retries
-- after the first one has settled.
--
-- Partial rather than plain, because superseded, expired and refunded rows are
-- history and there can be any number of them.

create unique index if not exists subscriptions_one_active_per_user
  on public.subscriptions (user_id)
  where status in ('active', 'trialing');

-- ---------------------------------------------------------------------------
-- 2. Remember which webhook events have been processed.
-- ---------------------------------------------------------------------------
--
-- The real fix for duplicate delivery is to recognise the event itself, not to
-- infer it from the subscription it would have written. Both providers send a
-- stable per-event identifier; this table records it the first time and the
-- webhook returns early on every delivery after that.
--
-- Kept separate from `subscriptions` because the lifecycle is different: a
-- subscription is current state, this is an append-only log, and the log has
-- to be written even for events that change nothing.

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  -- 'lemonsqueezy' | 'revenuecat'. Not a foreign key — the set is small and
  -- changing it should not need a migration.
  provider text not null,
  -- The provider's own id for this delivery. Unique PER PROVIDER, not
  -- globally: two providers can legitimately issue the same string and
  -- deduplicating across them would silently drop a real payment.
  event_id text not null,
  event_name text,
  user_id uuid references auth.users (id) on delete set null,
  -- What we did about it, for reading back when somebody asks why they were
  -- or were not granted access.
  outcome text,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

comment on table public.webhook_events is
  'Append-only record of payment webhook deliveries, keyed by the provider''s '
  'own event id. Exists so a retried delivery is recognised and ignored '
  'rather than creating a second subscription.';

-- No policies, deliberately. RLS on with zero policies means nobody reaches
-- this through PostgREST with a user token; only the service role, which
-- bypasses RLS, can write it. A person's payment history is not something the
-- browser needs.
alter table public.webhook_events enable row level security;

-- The lookup the webhook does on every single delivery, before anything else.
create index if not exists webhook_events_provider_event
  on public.webhook_events (provider, event_id);

-- For reading one person's payment history during a support conversation.
create index if not exists webhook_events_user_received
  on public.webhook_events (user_id, received_at desc);

-- Check afterwards:
--
--   select provider, event_name, outcome, received_at
--     from webhook_events order by received_at desc limit 20;
--
-- Replaying a delivery from the Lemon Squeezy dashboard should add no row the
-- second time and leave `subscriptions` untouched.
