import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellOff, Loader2, Share, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { AppPage } from "@/components/app/app-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AFFIRMATION_CATEGORIES } from "@/features/affirmations/affirmation-library";
import {
  useDisableNotifications,
  useEnableNotifications,
  useIsSubscribed,
  usePushState,
  useSendTestNotification,
} from "@/features/notifications/use-push";
import { useProfile, useUpdateProfile } from "@/features/onboarding/use-profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — ManifestAI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const push = usePushState();
  const { data: isSubscribed } = useIsSubscribed();
  const enable = useEnableNotifications();
  const disable = useDisableNotifications();
  const sendTest = useSendTestNotification();

  const [name, setName] = useState("");
  const [time, setTime] = useState("07:00");

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? "");
    setTime(
      `${String(profile.notify_hour).padStart(2, "0")}:${String(profile.notify_minute).padStart(2, "0")}`,
    );
  }, [profile]);

  function saveTime(next: string) {
    setTime(next);
    const [h, m] = next.split(":").map(Number);
    updateProfile.mutate({
      notify_hour: h ?? 7,
      notify_minute: m ?? 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  const notificationsOn = Boolean(profile?.notifications_enabled && isSubscribed);

  return (
    <AppPage
      title="Settings"
      description="Your details, when the morning affirmation arrives, and how to install the app."
    >
      <section className="rounded-3xl glass-panel p-6">
        <h2 className="font-display text-lg font-semibold">Your name</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Used in your affirmations and the morning notification.
        </p>
        <div className="mt-4 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" />
          <Button
            onClick={() => updateProfile.mutate({ display_name: name.trim() || null })}
            disabled={updateProfile.isPending}
          >
            Save
          </Button>
        </div>
      </section>

      <section className="mt-4 rounded-3xl glass-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Morning affirmation</h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
              One notification each morning with an affirmation written from your own answers.
            </p>
          </div>
          {notificationsOn ? (
            <Bell className="hidden h-5 w-5 shrink-0 text-ember sm:block" />
          ) : (
            <BellOff className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
          )}
        </div>

        <div className="mt-5">
          <label htmlFor="notify-time" className="text-xs font-medium text-muted-foreground">
            Delivery time
          </label>
          <Input
            id="notify-time"
            type="time"
            value={time}
            onChange={(e) => saveTime(e.target.value)}
            className="mt-1.5 w-40"
          />
        </div>

        {push.needsInstallFirst ? (
          <div className="mt-5 rounded-2xl border border-border p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="h-4 w-4 text-primary" />
              Add to Home Screen first
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              On iPhone, Apple only allows notifications once an app has been added to the Home
              Screen. Tap <Share className="inline h-3.5 w-3.5" /> Share in Safari, then
              <span className="font-medium text-foreground"> Add to Home Screen</span>. Open
              ManifestAI from the new icon and this button will work.
            </p>
          </div>
        ) : !push.supported ? (
          <p className="mt-5 rounded-2xl border border-border p-4 text-sm leading-relaxed text-muted-foreground">
            This browser doesn't support notifications. Chrome, Edge and Safari on an installed app
            all do.
          </p>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            {notificationsOn ? (
              <>
                <Button
                  variant="glass"
                  onClick={() => disable.mutate()}
                  disabled={disable.isPending}
                >
                  {disable.isPending ? <Loader2 className="animate-spin" /> : <BellOff />}
                  Turn off
                </Button>
                <Button
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => sendTest.mutate()}
                >
                  Send a test
                </Button>
              </>
            ) : (
              <Button variant="hero" onClick={() => enable.mutate()} disabled={enable.isPending}>
                {enable.isPending ? <Loader2 className="animate-spin" /> : <Bell />}
                Turn on morning affirmations
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-3xl glass-panel p-6">
        <h2 className="font-display text-lg font-semibold">What matters to you</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Decides which affirmations you're shown.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {AFFIRMATION_CATEGORIES.map((category) => {
            const selected = (profile?.focus_areas ?? []).includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  const current = profile?.focus_areas ?? [];
                  updateProfile.mutate({
                    focus_areas: selected
                      ? current.filter((x) => x !== category.id)
                      : [...current, category.id],
                  });
                }}
                aria-pressed={selected}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                  selected
                    ? "border-transparent surface-gradient text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/50",
                )}
              >
                <span className="mr-1">{category.emoji}</span>
                {category.label}
              </button>
            );
          })}
        </div>
      </section>

      {!push.isStandalone && !push.needsInstallFirst && (
        <section className="mt-4 rounded-3xl border border-dashed border-border p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Smartphone className="h-4 w-4" /> Install the app
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Adding ManifestAI to your home screen gives it its own icon, opens it full screen
            without browser chrome, and is what makes notifications possible on iPhone. Your browser
            menu has an Install or Add to Home Screen option.
          </p>
        </section>
      )}
    </AppPage>
  );
}
