import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/app/app-shell";
import { useProfile } from "@/features/onboarding/use-profile";
import { useTimezoneSync } from "@/hooks/use-timezone-sync";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { data: profile, isPending } = useProfile();

  // Keeps the stored timezone matching the device, so a 7am notification is
  // 7am where the person actually is.
  useTimezoneSync();

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
