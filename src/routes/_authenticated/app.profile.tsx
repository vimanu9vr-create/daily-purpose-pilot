import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
  BookOpen,
  ChevronRight,
  CreditCard,
  FileText,
  Flame,
  LineChart,
  Loader2,
  LogOut,
  MessageCircleHeart,
  Mic,
  Moon,
  Share,
  Shield,
  Smartphone,
  Sparkles,
  Sun,
  Target,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { useSignOut } from "@/components/app/app-shell";
import { AchievementGrid } from "@/features/achievements/achievement-grid";
import { DesireProgress } from "@/features/milestones/desire-progress";
import { WeekCard } from "@/features/insights/week-card";
import { NumberCard } from "@/features/numbers/number-card";
import { useDesires } from "@/features/stories/use-stories";
import { DeleteAccountDialog } from "@/features/account/delete-account-dialog";
import { planById, tierName } from "@/features/billing/plans";
import { purchaseStore } from "@/features/billing/store";
import { useSubscription } from "@/features/billing/use-subscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useDisableNotifications,
  useEnableNotifications,
  useIsSubscribed,
  usePushState,
  useSendTestNotification,
} from "@/features/notifications/use-push";
import { useProfile, useUpdateProfile } from "@/features/onboarding/use-profile";
import { formatLongDate } from "@/lib/dates";
import { openExternal } from "@/lib/native";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/profile")({
  head: () => ({ meta: [{ title: "You — ManifestAI" }] }),
  component: ProfilePage,
});

/** The rest of the app, reachable but no longer competing for a tab. */
const MORE_LINKS = [
  { to: "/app/journal", label: "Journal", icon: BookOpen },
  { to: "/app/habits", label: "Habits", icon: Flame },
  { to: "/app/goals", label: "Goals", icon: Target },
  { to: "/app/coach", label: "Coach", icon: MessageCircleHeart },
  { to: "/app/progress", label: "Progress", icon: LineChart },
] as const;

function ProfilePage() {
  const { data: profile } = useProfile();
  const { data: desires } = useDesires();
  const updateProfile = useUpdateProfile();
  const signOut = useSignOut();
  const { isPremium, plan, tier, hasVoice, subscription } = useSubscription();

  const push = usePushState();
  const { data: isSubscribed } = useIsSubscribed();
  const enable = useEnableNotifications();
  const disable = useDisableNotifications();
  const sendTest = useSendTestNotification();

  const [name, setName] = useState("");
  const [time, setTime] = useState("07:00");
  const [isDark, setIsDark] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      setIsDark(document.documentElement.classList.contains("dark"));
    }
  }, []);

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
    <PageTransition>
      <header className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full surface-gradient text-2xl text-primary-foreground shadow-glow">
          {(profile?.display_name ?? "Y").charAt(0).toUpperCase()}
        </div>
        <h1 className="mt-4 font-display text-[28px] font-medium leading-none">
          {profile?.display_name ?? "You"}
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">{profile?.email}</p>
      </header>

      <Card label="Your name">
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" />
          <Button
            className="rounded-full"
            onClick={() => updateProfile.mutate({ display_name: name.trim() || null })}
            disabled={updateProfile.isPending}
          >
            Save
          </Button>
        </div>
      </Card>

      <Card label="Morning affirmation">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Daily notification</p>
            <p className="mt-1 text-xs text-muted-foreground">
              One affirmation each morning, written from your answers.
            </p>
          </div>
          {notificationsOn ? (
            <Bell className="h-5 w-5 shrink-0 text-primary" />
          ) : (
            <BellOff className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
        </div>

        <div className="mt-4">
          <label htmlFor="notify-time" className="eyebrow text-muted-foreground">
            Delivery time
          </label>
          <Input
            id="notify-time"
            type="time"
            value={time}
            onChange={(e) => saveTime(e.target.value)}
            className="mt-2 w-36"
          />
        </div>

        {push.needsInstallFirst ? (
          <div className="mt-4 rounded-2xl bg-accent/50 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="h-4 w-4" /> Add to Home Screen first
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              On iPhone, Apple only allows notifications after an app is added to the Home Screen.
              Tap <Share className="inline h-3 w-3" /> Share in Safari, then Add to Home Screen, and
              open ManifestAI from the new icon.
            </p>
          </div>
        ) : !push.supported ? (
          <p className="mt-4 text-xs text-muted-foreground">
            This browser doesn't support notifications.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {notificationsOn ? (
              <>
                <Button
                  variant="glass"
                  size="sm"
                  className="rounded-full"
                  onClick={() => disable.mutate()}
                  disabled={disable.isPending}
                >
                  {disable.isPending ? <Loader2 className="animate-spin" /> : <BellOff />} Turn off
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-muted-foreground"
                  onClick={() => sendTest.mutate()}
                >
                  Send a test
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => enable.mutate()}
                disabled={enable.isPending}
              >
                {enable.isPending ? <Loader2 className="animate-spin" /> : <Bell />} Turn on
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card label="Subscription">
        {isPremium ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm">Status</span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Active
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm">Plan</span>
              <span className="text-sm text-muted-foreground">
                {tierName(tier)}
                {planById(plan) ? ` · ${planById(plan)?.name}` : ""}
                {subscription?.price_display ? ` · ${subscription.price_display}` : ""}
              </span>
            </div>

            {/*
              A Standard subscriber has no way to discover the Voice plan
              otherwise — the paywall only shows to people who haven't paid, so
              without this the one group most likely to buy the upgrade is the
              only group never offered it.
            */}
            {!hasVoice && (
              <Link
                to="/app/upgrade"
                search={{ tier: "voice" }}
                className="mt-3 flex w-full items-center gap-3 rounded-xl bg-primary/5 px-3 py-3 text-left text-sm transition-colors hover:bg-primary/10"
              >
                <Mic className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1">
                  Add the narrated voice
                  <span className="block text-xs text-muted-foreground">
                    Stories and sessions read aloud, instead of read by you.
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            )}
            {subscription?.current_period_end && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm">
                  {subscription.cancel_at_period_end ? "Ends" : "Renews"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatLongDate(subscription.current_period_end.slice(0, 10))}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                void openExternal(
                  purchaseStore().manageUrl() ?? "https://apps.apple.com/account/subscriptions",
                )
              }
              className="mt-4 flex w-full items-center gap-3 rounded-xl px-1 py-3 text-sm transition-colors hover:text-primary"
            >
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Manage subscription</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            </button>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You're on the free plan. Premium removes the limits on stories, narration and
              coaching.
            </p>
            <Button className="mt-4 w-full rounded-full" asChild>
              <Link to="/app/upgrade">
                <Sparkles className="h-4 w-4" /> See Premium
              </Link>
            </Button>
          </>
        )}
      </Card>

      <Card label="More">
        <ul className="-my-1">
          {MORE_LINKS.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className="flex items-center gap-3 rounded-xl px-1 py-3 text-sm transition-colors hover:text-primary"
              >
                <link.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{link.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card label="Appearance">
        <button
          type="button"
          onClick={() => {
            const next = !isDark;
            setIsDark(next);
            document.documentElement.classList.toggle("dark", next);
          }}
          className="flex w-full items-center gap-3 px-1 py-1 text-sm"
        >
          {isDark ? (
            <Moon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Sun className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="flex-1 text-left">{isDark ? "Dark" : "Light"}</span>
          <span
            className={cn(
              "flex h-6 w-11 items-center rounded-full p-0.5 transition-colors",
              isDark ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "h-5 w-5 rounded-full bg-white shadow transition-transform",
                isDark && "translate-x-5",
              )}
            />
          </span>
        </button>
      </Card>

      <Card label="Legal">
        <ul className="-my-1">
          <li>
            <Link
              to="/privacy"
              className="flex items-center gap-3 rounded-xl px-1 py-3 text-sm transition-colors hover:text-primary"
            >
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Privacy Policy</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            </Link>
          </li>
          <li>
            <Link
              to="/terms"
              className="flex items-center gap-3 rounded-xl px-1 py-3 text-sm transition-colors hover:text-primary"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Terms of Use</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            </Link>
          </li>
        </ul>
      </Card>

      <Button
        variant="ghost"
        className="mt-6 w-full rounded-full text-muted-foreground"
        onClick={signOut}
      >
        <LogOut className="h-4 w-4" /> Sign out
      </Button>

      {/* Progress, the week and the number live here rather than on Home.
          They are all things you look at deliberately, not things you need in
          front of you at 7am — and Home had grown to fourteen sections, which
          is a wall rather than an invitation. */}
      {(desires?.length ?? 0) > 0 && <DesireProgress desires={desires!} />}

      <WeekCard />

      <NumberCard />

      {/* Quiet, and above the account controls rather than buried under them.
          Unearned ones are shown too — that's how someone learns what this app
          thinks is worth doing. */}
      <div className="mt-10">
        <AchievementGrid />
      </div>

      {/* Required by App Store Guideline 5.1.1(v), and reachable rather than buried. */}
      <Button
        variant="ghost"
        className="mt-1 w-full rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-4 w-4" /> Delete account
      </Button>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />

      <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
        ManifestAI supports your effort with focus and follow-through. It doesn't promise outcomes.
      </p>
    </PageTransition>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-3xl glass-panel p-5">
      <h2 className="eyebrow mb-3 text-muted-foreground">{label}</h2>
      {children}
    </section>
  );
}
