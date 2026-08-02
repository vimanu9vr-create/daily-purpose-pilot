import { createFileRoute } from "@tanstack/react-router";
import { Flame } from "lucide-react";

import { AppPage, EmptyState } from "@/components/app/app-page";

export const Route = createFileRoute("/_authenticated/app/habits")({
  head: () => ({ meta: [{ title: "Habits — ManifestAI" }] }),
  component: Habits,
});

function Habits() {
  return (
    <AppPage
      title="Habits"
      description="Small, repeatable actions with weekly targets. Consistency beats intensity."
    >
      <EmptyState
        icon={Flame}
        title="No habits tracked yet"
        body="Choose two or three habits that directly support your goal. Weekly targets leave room for the days life gets in the way."
      />
    </AppPage>
  );
}
