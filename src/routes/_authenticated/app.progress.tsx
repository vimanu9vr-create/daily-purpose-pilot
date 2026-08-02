import { createFileRoute } from "@tanstack/react-router";
import { LineChart } from "lucide-react";

import { AppPage, EmptyState } from "@/components/app/app-page";

export const Route = createFileRoute("/_authenticated/app/progress")({
  head: () => ({ meta: [{ title: "Progress — ManifestAI" }] }),
  component: Progress,
});

function Progress() {
  return (
    <AppPage
      title="Progress"
      description="Goal milestones, habit consistency and check-in trends over time."
    >
      <EmptyState
        icon={LineChart}
        title="Not enough data yet"
        body="After about a week of check-ins your trends appear here — habit consistency, energy, mood and goal movement."
      />
    </AppPage>
  );
}
