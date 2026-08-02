import { createFileRoute } from "@tanstack/react-router";
import { Flame, Sparkles, Sun, Target } from "lucide-react";

import { AppPage } from "@/components/app/app-page";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — ManifestAI" }] }),
  component: Dashboard,
});

const tiles = [
  { icon: Target, label: "Active goals", value: "—", hint: "Add your first goal to begin" },
  { icon: Flame, label: "Habit streak", value: "—", hint: "Streaks start on day one" },
  { icon: Sun, label: "Today's check-in", value: "Not yet", hint: "Takes about three minutes" },
];

function Dashboard() {
  return (
    <AppPage
      title="Today"
      description="Your daily overview: the goal you're moving, the habits you're keeping, and the reflection that closes the loop."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-3xl glass-panel p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/60">
              <tile.icon className="h-4 w-4 text-primary" />
            </span>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {tile.label}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold">{tile.value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{tile.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-3xl surface-gradient p-[1.5px]">
        <div className="rounded-3xl bg-card/85 p-8 backdrop-blur-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-ember/15 px-3 py-1 text-xs font-medium text-ember">
            <Sparkles className="h-3.5 w-3.5" /> Getting started
          </span>
          <h2 className="mt-4 text-2xl font-semibold">Your practice is ready to be set up</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Name one goal, choose two or three habits that support it, and check in each evening.
            The coach, journal and progress views fill in from there.
          </p>
        </div>
      </div>
    </AppPage>
  );
}
