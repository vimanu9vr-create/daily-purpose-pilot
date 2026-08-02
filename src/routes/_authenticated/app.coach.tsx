import { createFileRoute } from "@tanstack/react-router";
import { MessageCircleHeart } from "lucide-react";

import { AppPage, EmptyState } from "@/components/app/app-page";

export const Route = createFileRoute("/_authenticated/app/coach")({
  head: () => ({ meta: [{ title: "Coach — ManifestAI" }] }),
  component: Coach,
});

function Coach() {
  return (
    <AppPage
      title="Coach"
      description="A short daily conversation that turns intention into a concrete next action."
    >
      <EmptyState
        icon={MessageCircleHeart}
        title="No conversations yet"
        body="Your coaching sessions will appear here. Each one starts from your current goals and habits, and ends with one specific action."
        hint="Coaching is supportive guidance, not therapy or medical advice."
      />
    </AppPage>
  );
}
