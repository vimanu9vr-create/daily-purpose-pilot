import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/app/app-shell";
import { useProfile } from "@/features/onboarding/use-profile";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { data: profile, isPending } = useProfile();

  // New accounts go through onboarding before they ever see an empty dashboard.
  useEffect(() => {
    if (!isPending && profile && !profile.onboarded_at) {
      void navigate({ to: "/onboarding", replace: true });
    }
  }, [isPending, profile, navigate]);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
