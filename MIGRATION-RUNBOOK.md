# Migration runbook

Do these in order. Anything marked **you** needs your account or your credentials and
I deliberately can't do it for you.

## Already done

The app no longer imports anything from Lovable. `@lovable.dev/cloud-auth-js` is
removed from `package.json`, and `src/integrations/lovable/index.ts` now calls
Supabase's own `signInWithOAuth`. The return shape is unchanged so the two call sites
in `auth.tsx` didn't need touching. Types, lint and the build all pass without it.

`@lovable.dev/vite-tanstack-config` is also gone. Both Vite configs are now written
out explicitly, verified against a node_modules with the preset genuinely absent.
Nothing in this repo references Lovable any more — the folder `src/integrations/lovable`
is now `src/integrations/oauth`.

So steps 1 to 8 below are all that remain, and every one of them starts with you.

## 1. Create the new Supabase project — **you**

At supabase.com, new project, region **East US (North Virginia) us-east-1**, free tier.
Save the database password somewhere real; you cannot recover it later.

us-east-1 because the audience is global English rather than India. It is the closest
region to the largest share of English-speaking users and the default most services
peer well with. A user in London sees roughly 80ms of extra latency versus a European
region, which is invisible for this app — nothing here is chatty enough to feel it.

Then collect four values from Project Settings:

    Project ref        Settings → General
    Project URL        Settings → API
    Publishable key    Settings → API   (the anon/public one)
    Access token       account-level, Account → Access Tokens

## 2. Rebuild the schema

All fourteen tables, their row-level security policies, and the `narration` storage
bucket are already defined in `supabase/migrations`. Nothing needs writing.

    npm install -g supabase
    cd ~/Claude/Projects/"Manifest anything Ai"
    supabase login
    supabase link --project-ref <YOUR_PROJECT_REF>
    supabase db push

`supabase db push` will list what it's about to apply. Read that list before saying
yes — it should be the nine migration files and nothing else.

## 3. Deploy the edge functions

    supabase functions deploy ai-moment
    supabase functions deploy ai-affirmations
    supabase functions deploy ai-coach
    supabase functions deploy narrate-story
    supabase functions deploy send-daily-affirmation
    supabase functions deploy delete-account
    supabase functions deploy revenuecat-webhook

This is the step that has been silently failing on Lovable for the past three days.
From the CLI it either succeeds or prints an error, which is the main reason this
migration is worth doing on reliability grounds alone.

## 4. Set the secrets — **you**

    supabase secrets set VAPID_PUBLIC_KEY=BBa75Gm0I3PKiHCH_ut9J5G94L4qUxDZc4Yg6nadk6KNhoP3FxxxBhK8FpnYj2juOZHKKNUESOKDmGcXf3UjsRA
    supabase secrets set VAPID_PRIVATE_KEY=<the short one>
    supabase secrets set VAPID_SUBJECT=mailto:vimanu9.vr@gmail.com
    supabase secrets set ELEVENLABS_API_KEY=<from elevenlabs.io>
    supabase secrets set OPENAI_API_KEY=<from platform.openai.com>

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically — don't set
them yourself.

Since you're rebuilding anyway, generate a **fresh** ElevenLabs key and a fresh VAPID
pair. Both current ones have been pasted into a chat window. If you regenerate the VAPID
pair, the new public key must also go into `.env` as `VITE_VAPID_PUBLIC_KEY`, and every
device has to subscribe again — the app now handles that automatically, but it still has
to happen.

## 5. Recreate the morning notification job

In the SQL editor of the new project:

    create extension if not exists pg_cron;
    create extension if not exists pg_net;

    select cron.schedule(
      'daily-affirmation',
      '*/15 * * * *',
      $$
      select net.http_post(
        url     := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/send-daily-affirmation',
        headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
        body    := '{}'::jsonb
      );
      $$
    );

Every fifteen minutes rather than once at 07:00, because the function works out who is
currently at their own local delivery time. That's what makes it correct for users in
other timezones.

## 6. Point the app at the new backend

Update `.env`:

    VITE_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
    VITE_SUPABASE_PROJECT_ID=<project ref>
    SUPABASE_URL=<same as VITE_SUPABASE_URL>
    SUPABASE_PUBLISHABLE_KEY=<same as above>

Tell me when this is done and I'll regenerate `src/integrations/supabase/types.ts`
against the new project so the TypeScript types match.

## 7. Reconnect Google and Apple sign-in — **you**

Authentication → Providers in the new project. Google needs a client ID and secret from
the Google Cloud console; Apple needs a paid developer account, which you don't have
yet, so leave Apple off until you do. Add your site URL and `<site>/app` to the allowed
redirect URLs.

Email and password sign-in works immediately with no configuration.

## 8. Hosting

Cloudflare Pages, connect the GitHub repo, build command `npm run build`, output
directory `.output/public`. Add the same `VITE_*` variables from `.env` as environment
variables in the Cloudflare dashboard — they're baked in at build time, so the build
needs them.

## A note about the lockfile

`@tanstack/start-storage-context@1.167.21` was briefly unpublished from npm, which is
why an earlier version of this file said never to delete `package-lock.json`. It is
back on the registry, so that hazard is gone.

The real one was different and would have broken the first deploy: `package.json` and
`package-lock.json` had drifted out of sync — `lru-cache` was missing from the lock.
That is invisible locally, because `npm install` papers over it, but Cloudflare runs
`npm ci`, which refuses to guess and fails the build outright.

Resynced with `npm install --package-lock-only`, which rewrites the lockfile without
touching `node_modules` — so the platform-specific rolldown binary on your Mac is
undisturbed. Then verified properly: a clean copy of the repo, `npm ci` from scratch on
Linux, and a full `npm run build`. 534 packages, no errors, 3.7 MB in `.output/public`.
That is Cloudflare's build reproduced, so the deploy should not surprise us.

If you ever change dependencies, run `npm install` and commit **both** files together.

## What you lose, honestly

Your current account and its 22 stories. With one user that's a fresh sign-up and a
minute of tapping. This is the entire reason to do it now rather than later.

You also lose Lovable's preview URL and its agent. You keep the repo, the app, both
native shells, and every fix from the past week.

## Verifying it worked

Sign up with email, complete onboarding, and confirm a desire and stories appear. Open a
story and confirm Sarah speaks. Then, from the SQL editor, run the notification job by
hand and read the response — it now reports a real per-device status rather than a bare
count, so a failure will say why.
