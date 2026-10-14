/**
 * The page an ad points at.
 *
 * One input, one result, then the ask. No navigation, no sign-in wall, nothing
 * to read before the product does something — because the only job here is to
 * get a stranger from "saw a reel" to "this wrote something about MY thing" in
 * under fifteen seconds.
 *
 * The signup prompt deliberately comes AFTER the affirmations are on screen.
 * Asking first makes the account the price of finding out; asking second makes
 * it the way to keep something they already have. Same request, opposite
 * psychology, and the second one converts several times better.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  claimAnonymousAccount,
  tryOneAffirmation,
} from "@/features/onboarding/try-it";
import { trackSignUp } from "@/lib/meta-pixel";

export const Route = createFileRoute("/try")({
  head: () => ({
    meta: [
      { title: "Write me an affirmation — ManifestAI" },
      {
        name: "description",
        content:
          "Type what you want. It writes the line, free, no account needed.",
      },
    ],
  }),
  component: TryIt,
});

function TryIt() {
  const navigate = useNavigate();

  const [desire, setDesire] = useState("");
  const [affirmations, setAffirmations] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shown only once there is something worth keeping.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function write() {
    setBusy(true);
    setError(null);
    try {
      const result = await tryOneAffirmation(desire);
      setAffirmations(result.affirmations);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await claimAnonymousAccount(email, password);
      trackSignUp();
      // Into the app proper. Their affirmations are already there — same user.
      void navigate({ to: "/app" });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const written = affirmations.length > 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-16">
      {!written ? (
        <>
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">
            What do you want?
          </h1>
          <p className="mt-3 text-muted-foreground">
            Say it plainly. It writes the line for you — free, no account.
          </p>

          <Input
            value={desire}
            onChange={(event) => setDesire(event.target.value)}
            onKeyDown={(event) => {
              // Enter submits. On a phone this is the "go" key, and making
              // people hunt for a button after typing loses a share of them.
              if (event.key === "Enter" && desire.trim() && !busy) void write();
            }}
            placeholder="a house with a garden"
            className="mt-8 h-14 rounded-full px-6 text-base"
            autoFocus
          />

          <Button
            size="lg"
            className="mt-4 h-14 w-full rounded-full"
            onClick={() => void write()}
            disabled={busy || !desire.trim()}
          >
            {busy ? "Writing…" : "Write it for me"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Written for you
          </p>

          <ul className="mt-6 space-y-4">
            {affirmations.map((line) => (
              <li
                key={line}
                className="rounded-2xl bg-muted/60 px-6 py-5 font-display text-xl leading-snug"
              >
                {line}
              </li>
            ))}
          </ul>

          {/*
            The ask, now that there is something to lose. Phrased as keeping
            rather than joining — "create an account" is a chore, "keep these"
            is the obvious next step.
          */}
          <div className="mt-10 rounded-2xl border border-border p-6">
            <h2 className="font-display text-xl">Keep these</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              An account saves them and starts your 21 days. Takes a moment.
            </p>

            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
              className="mt-5 h-12 rounded-full px-5"
              autoComplete="email"
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="A password"
              className="mt-3 h-12 rounded-full px-5"
              autoComplete="new-password"
            />

            <Button
              size="lg"
              className="mt-4 h-12 w-full rounded-full"
              onClick={() => void save()}
              disabled={saving || !email.trim() || password.length < 6}
            >
              {saving ? "Saving…" : "Save them"}
            </Button>
          </div>
        </>
      )}

      {error ? <p className="mt-6 text-sm text-destructive">{error}</p> : null}
    </main>
  );
}
