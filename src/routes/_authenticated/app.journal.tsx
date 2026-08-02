import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { AppPage, EmptyState } from "@/components/app/app-page";

export const Route = createFileRoute("/_authenticated/app/journal")({
  head: () => ({ meta: [{ title: "Journal — ManifestAI" }] }),
  component: Journal,
});

function Journal() {
  return (
    <AppPage
      title="Journal"
      description="Guided prompts for reflection, gratitude and mood — three minutes is enough."
    >
      <EmptyState
        icon={BookOpen}
        title="Your journal is empty"
        body="Entries you write will be collected here with their prompt and mood, so you can look back at how your thinking changed."
      />
    </AppPage>
  );
}
