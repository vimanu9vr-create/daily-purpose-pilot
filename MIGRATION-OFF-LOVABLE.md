# Leaving Lovable, and building something that lasts

Written 7 August 2026, against the actual code in this repo rather than general advice.

## The short version

You do not need to rewrite anything. You need to move three things off Lovable: the
backend, the hosting, and one authentication helper. The app code — every screen, the
player, the design system, the Capacitor shells for iOS and Android — comes with you
untouched.

Do it now, while you have one account and twenty-two stories. The same move at a
thousand subscribers means migrating live users, their passwords and their purchase
history, with downtime. Today it is an afternoon. That timing argument is the single
most important thing in this document.

## What is actually tied to Lovable

Less than you would expect. Three source files and two packages.

`src/integrations/lovable/index.ts` wraps Google and Apple sign-in through
`@lovable.dev/cloud-auth-js`. This is the only piece of app behaviour that genuinely
depends on Lovable. Supabase has its own `signInWithOAuth` that does the same job, so
this becomes a fifteen-line file instead of a wrapper.

`src/lib/lovable-error-reporting.ts` forwards runtime errors to the Lovable editor's
telemetry. Off Lovable it does nothing. Either delete it or repoint it at Sentry, which
you will want anyway once real people are using this.

`vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, a preset that bundles the
TanStack Start plugin, Tailwind, Nitro, path aliases and env injection. Replacing it
means writing those plugins out explicitly in a normal Vite config. It is fiddly but
mechanical, and `vite.config.native.ts` already does most of it by hand — that file is
the template.

Everything else — Supabase client, TanStack Router, Tailwind, Capacitor, the edge
functions — is standard and portable.

## The backend is the part that matters

Your Supabase instance is Lovable-managed. It is a real Postgres database with real
Supabase Auth, but it lives in Lovable's organisation, not yours. That is the thing to
be careful about, because **auth users are the hard part of any migration**. Rows in
`profiles` or `moments` are easy to copy. The `auth.users` table holds password hashes,
and moving those requires database-level access that a managed instance may not give
you.

With one account this is irrelevant — you sign up again and lose nothing. With a
thousand paying subscribers it is the difference between a smooth move and forcing
every user to reset their password. This is why waiting is expensive.

Concretely: create your own Supabase project on the free tier, in the `ap-south-1`
region since your users are in India. Run the migrations from `supabase/migrations` to
rebuild the schema, redeploy the seven edge functions with the Supabase CLI, recreate
the storage bucket for narration audio, and recreate the pg_cron job that fires the
morning notification. Then point `.env` at the new project. The free tier gives you
500 MB of database and 1 GB of storage, which is comfortably more than this app needs
for its first several thousand users.

The one thing you must copy by hand is the secrets: the VAPID pair, the ElevenLabs key,
the OpenAI key, and eventually the RevenueCat webhook secret.

## Hosting

Cloudflare Pages or Netlify, free tier, connected to the same GitHub repo. Push to main
and it deploys — the same loop you have now, minus the subscription. Cloudflare is the
better fit because the Nitro build already defaults to a Cloudflare target.

The native apps are unaffected. They bundle their own copy of the web build and talk
directly to Supabase, so they do not care who hosts the website.

## What "no errors, no lag, many subscribers" actually requires

This is worth separating from the migration, because they are different problems.

**Lag is mostly not a server problem.** At the scale you are describing, Postgres will
not be your bottleneck. Your slow paths are the ones that call an external service while
the user waits: generating a story with OpenAI, and generating narration with
ElevenLabs. The first play of a story currently blocks on ElevenLabs for several
seconds. That is acceptable for one person and unacceptable at scale.

The fix is to stop generating on demand where you can. The ten catalogue tracks — sleep,
meditation, frequency — are identical for every user. They should be narrated once,
stored as files, and served from a CDN, not regenerated per person. Only the personal
stories need per-user audio.

**The cost risk is larger than the latency risk.** ElevenLabs bills per character. A
thousand active users generating three stories a day each is millions of characters a
month. At current pricing that becomes a serious bill, and it scales linearly with
usage rather than with revenue. Pre-generating the shared catalogue and caching
aggressively — which the code already does per story — is what keeps this viable. Worth
modelling properly before you launch, not after.

**Errors need to be visible.** Right now the only reason we find bugs is that you hit
them and tell me. Today alone that pattern hid stale edge function deployments for
three days and a push subscription bug for a week. Sentry on the frontend and structured
logging in the edge functions would have caught both immediately. This is the single
highest-value thing to add before you have users, because with users you will not hear
about most failures at all.

**Reliability comes from tests, not from care.** There are no automated tests in this
repo. Every fix so far has been verified by me reading code and you tapping around. That
does not survive a growing codebase. The highest-value tests here are not unit tests of
components but integration checks on the things that have actually broken: does the
build succeed from a clean install, does a push subscription match the current VAPID
key, do the declared track durations match their scripts.

## Suggested order

Migrate the backend first, while it is cheap. Then hosting, then remove the Lovable
packages. Then add error reporting before you invite anyone. Then pre-generate the
catalogue audio. Then, and only then, worry about scale.

Realistically the migration is one focused day. The reliability work is a week and is
what actually determines whether this survives contact with real subscribers.

## What this does not fix

Moving off Lovable does not improve the audio, does not add widgets, and does not make
iOS background playback better. Those are the genuine arguments for a native rewrite
later, and they remain true either way. But they are quality decisions to make once
people are using the app, not before.
