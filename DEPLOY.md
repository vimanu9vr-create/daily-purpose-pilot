# Deploying

There are **two separate deploys** and they are not connected. Pushing to git
updates the app; it does not touch the edge functions. Forgetting the second
one is how a gate ends up existing only in the browser, where anybody can edit
it.

| What changed | How it ships |
| --- | --- |
| Anything in `src/` | `git push` |
| Anything in `supabase/functions/` | `supabase functions deploy <name>` |
| Anything in `supabase/migrations/` | applied against the database directly |

---

## 1. The app — `git push`

```bash
cd ~/Claude/Projects/"Manifest anything Ai"
git push
```

Cloudflare is watching the GitHub repo and rebuilds on every push to `main`.
Give it two or three minutes, then hard-reload
[the app](https://daily-purpose-pilot.vimanu9-vr.workers.dev) — Cmd+Shift+R, so
you're not looking at the old bundle out of cache.

Before pushing, these should both be silent:

```bash
npx tsc --noEmit && npm test
```

---

## 2. Edge functions — the Supabase CLI

### First time only: sign in

```bash
npx supabase login
```

This opens a browser and stores a token in `~/.supabase`. You only ever do it
once per machine.

### Every time after that

```bash
cd ~/Claude/Projects/"Manifest anything Ai"
npx supabase functions deploy narrate-story \
  --project-ref pkxkksamenqcvsaulceq \
  --use-api
```

Or the short version, which has the flags baked in:

```bash
npm run deploy:fn narrate-story
```

`--use-api` bundles the function on Supabase's side. Without it the CLI may
want Docker Desktop running, which is a lot of machinery for a 20KB file.

### Name the function. Always.

`supabase functions deploy` with **no name deploys all sixteen of them**. If
any local copy is older than what's live, that deploy silently replaces the
newer one with the older one. There is no confirmation and no undo.

Never use `--prune` either. It deletes functions that exist on Supabase but not
in your folder.

### Checking it actually landed

```bash
npx supabase functions list --project-ref pkxkksamenqcvsaulceq
```

The version number for the function you just deployed should have gone up by
one. If it hasn't, the deploy didn't happen, whatever the terminal said.

---

## 3. Secrets

Secrets are set on Supabase, not in `.env`. Changing one takes effect
immediately — no deploy needed.

```bash
npx supabase secrets list --project-ref pkxkksamenqcvsaulceq
npx supabase secrets set NARRATION_MODEL=eleven_multilingual_v2 --project-ref pkxkksamenqcvsaulceq
```

The ones that matter:

| Secret | What it does |
| --- | --- |
| `ELEVENLABS_API_KEY` | Narration. Everything voice-related dies without it. |
| `NARRATION_MODEL` | Unset means Flash (20c a listen). Set to `eleven_multilingual_v2` for full quality at 39c. |
| `LOVABLE_API_KEY` | Gemini, via the OpenAI-compatible endpoint. Stories, affirmations, coach. |
| `PEXELS_API_KEY` | Dream photographs. |

---

## 4. Database migrations

The migrations in `supabase/migrations/` are a record of what was applied, not
a queue that runs itself. Applying one is a deliberate act. Ask me and I'll
apply it against production directly and show you the result.

---

## The order that matters

When a change spans both, **deploy the function first, then push the app.**

The function refusing something the app doesn't know about yet is a clumsy
error message. The app offering something the function hasn't been taught to
refuse is a feature given away for free. Given the choice, be clumsy.

---

## Right now

Four commits are sitting unpushed, and `narrate-story` is three commits behind
what's on disk. The whole Standard/Voice split exists only on your laptop.

```bash
cd ~/Claude/Projects/"Manifest anything Ai"
npx supabase login
npm run deploy:fn narrate-story
git push
```
