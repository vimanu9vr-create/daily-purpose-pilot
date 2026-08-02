import { createFileRoute } from "@tanstack/react-router";
import { Target } from "lucide-react";

import { AppPage, EmptyState } from "@/components/app/app-page";

export const Route = createFileRoute("/_authenticated/app/goals")({
  head: () => ({ meta: [{ title: "Goals — ManifestAI" }] }),
  component: Goals,
});

function Goals() {
  return (
    <AppPage
      title="Goals"
      description="Define what you're working toward, why it matters, and the steps that get you there."
    >
      <EmptyState
        icon={Target}
        title="No goals yet"
        body="Start with one goal you'd be proud to make progress on this quarter. You'll break it into steps and connect supporting habits."
      />
    </AppPage>
  );
}
