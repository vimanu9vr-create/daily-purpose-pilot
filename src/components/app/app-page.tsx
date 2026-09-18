import { RefreshCw, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/telemetry";

export function AppPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </header>
        {children}
      </div>
    </PageTransition>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl glass-panel px-8 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl surface-gradient shadow-glow">
        <Icon className="h-6 w-6 text-primary-foreground" />
      </span>
      <h2 className="mt-6 text-xl font-semibold">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {hint && <p className="mt-5 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

/**
 * What a screen shows when its data didn't load.
 *
 * ## Why this exists
 *
 * A QA pass found that 21 of 26 authenticated routes had no error branch at
 * all. On a failed request they rendered their loading skeleton forever, which
 * is the worst of the three options: an empty screen at least looks empty, and
 * an error at least explains itself, but a permanent skeleton tells somebody
 * the app is still trying when it has already given up. On a phone with patchy
 * signal — which is most of this audience, most of the time — that reads as a
 * broken app rather than a bad moment of connection.
 *
 * ## Three deliberate choices
 *
 * **No raw error text.** The one screen that did handle errors printed
 * `error.message`, which surfaces things like "FetchError: Failed to fetch" or
 * a Postgres constraint name. That tells the person nothing and tells an
 * attacker slightly too much. The real message goes to telemetry instead.
 *
 * **Retry is the primary action**, because the overwhelming majority of these
 * are a dropped connection rather than a real fault, and a refetch fixes it
 * without losing the user's place.
 *
 * **It reports itself.** Reaching this component is the signal that something
 * failed for a real person, which is exactly the event that was previously
 * invisible.
 */
export function ErrorState({
  title = "That didn't load",
  body,
  error,
  onRetry,
  context,
}: {
  title?: string;
  /** Plain language. What the person was trying to see, not what threw. */
  body: string;
  error?: unknown;
  onRetry?: () => void;
  /** Where this happened, for the report. e.g. "app.journal". */
  context?: string;
}) {
  if (error) {
    reportError(error, { surface: "error_state", ...(context ? { route: context } : {}) });
  }

  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-3xl glass-panel px-8 py-14 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border">
        <WifiOff className="h-6 w-6 text-muted-foreground" />
      </span>
      <h2 className="mt-6 text-xl font-semibold">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {onRetry && (
        <Button variant="glass" className="mt-6" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      )}
      <p className="mt-5 text-xs text-muted-foreground/70">
        Nothing you've saved is lost — this is just today's load.
      </p>
    </div>
  );
}
