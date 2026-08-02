import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { AppPage, EmptyState } from "@/components/app/app-page";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — ManifestAI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppPage
      title="Settings"
      description="Your profile, timezone, reminders and subscription."
    >
      <EmptyState
        icon={Settings}
        title="Settings coming together"
        body="Profile details, daily reminder times, theme preference and plan management will live here."
      />
    </AppPage>
  );
}
