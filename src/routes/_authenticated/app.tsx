import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/app/app-shell";
import { isFreeRoute } from "@/features/billing/free-routes";
import { useSubscription } from "@/features/billing/use-subscription";
import { useProfile } from "@/features/onboarding/use-profile";
import { useTimezoneSync } from "@/hooks/use-timezone-sync";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: profile, isPending } = useProfile();
  const { isPremium, isPending: planPending } = useSubscription();

  // Keeps the stored timezone matching the device, so a 7am notification is
  // 7am where the person actually is.
  useTimezoneSync();

  // New accounts go through onboarding before they ever see an empty dashboard.
  useEffect(() => {
    if (!isPending && profile && !profile.onboarded_at) {
      void navigate({ to: "/onboarding", replace: true });
    }
  }, [isPending, profile, navigate]);

  /**
   * The paywall, as navigation.
   *
   * ## Why this did not exist, and what that looked like
   *
   * Entitlement was enforced in the edge functions and nowhere in the app, so
   * a free account could open the coach, the journal, goals, habits, vision
   * boards and progress and find every screen fully drawn. The product looked
   * entirely unlocked. Nothing paid actually WORKED — generation was refused
   * server-side — but somebody signing in saw a complete app with no
   * indication a subscription existed, and the refusals, when they came, read
   * as the app failing rather than as a product asking to be bought.
   *
   * Both halves are needed and they do different jobs. The server check is the
   * security boundary and cannot be removed. This is the honesty: it tells
   * somebody where they stand before they run into a wall.
   *
   * ## Why it waits for `planPending`
   *
   * `useSubscription` reports `isPremium: false` while the query is still in
   * flight, because there is no row yet to say otherwise. Acting on that would
   * bounce every paying subscriber to the paywall for a few hundred
   * milliseconds on every cold start — the single most alarming thing you can
   * show somebody who has already paid. Waiting costs an unlocked moment on a
   * screen whose contents still refuse to load without a subscription.
   *
   * ## Why `replace`
   *
   * So the back button does not put them straight back on the locked screen,
   * which produces a loop they cannot escape without force-quitting.
   */
  useEffect(() => {
    if (planPending || isPremium) return;
    if (isFreeRoute(pathname)) return;
    void navigate({ to: "/app/upgrade", replace: true });
  }, [planPending, isPremium, pathname, navigate]);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
