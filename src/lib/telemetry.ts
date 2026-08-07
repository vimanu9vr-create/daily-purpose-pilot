/**
 * Error reporting.
 *
 * Every bug in this app so far has been found the same way: Viggnesh hit it and
 * said so. That worked with one user and stops working immediately with more.
 * Stale edge function deploys hid for three days, a push subscription bug
 * survived four rounds of testing, and an 18-minute sleep track shipped with
 * forty seconds of audio — none of it visible from here.
 *
 * Two deliberate choices:
 *
 * Sentry is optional. Without VITE_SENTRY_DSN nothing is loaded, no network
 * call is made and the bundle doesn't grow — the import is dynamic. So this
 * costs nothing until you decide to switch it on, and swapping providers later
 * means editing one function.
 *
 * Nothing personal is ever sent. Not the desires people type, not story text,
 * not display names, not email. Those are the most sensitive things this app
 * holds, and "data privacy" is one of the loudest complaints against the
 * competitor. Breadcrumbs carry event names and short states, never content.
 */

type Severity = "error" | "warning" | "info";

type Breadcrumb = {
  at: number;
  category: string;
  message: string;
  data?: Record<string, string | number | boolean>;
};

/** Last N events before a failure. Enough to reconstruct, small enough to send. */
const MAX_BREADCRUMBS = 25;
const breadcrumbs: Breadcrumb[] = [];

let sentry: typeof import("@sentry/browser") | null = null;
let started = false;

/**
 * Records what just happened, for context when something later fails.
 *
 * Aimed at the paths that have actually broken: audio start and stop, push
 * subscription, narration generation. Keep the values short and factual —
 * "voice=sarah", "status=403" — never user content.
 */
export function trail(
  category: string,
  message: string,
  data?: Record<string, string | number | boolean>,
): void {
  breadcrumbs.push({ at: Date.now(), category, message, ...(data ? { data } : {}) });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();

  sentry?.addBreadcrumb({ category, message, level: "info", ...(data ? { data } : {}) });
}

/** Starts reporting, if a DSN is configured. Safe to call more than once. */
export async function startTelemetry(): Promise<void> {
  if (started || typeof window === "undefined") return;
  started = true;

  installGlobalHandlers();

  const dsn = import.meta.env["VITE_SENTRY_DSN"] as string | undefined;
  if (!dsn) return;

  try {
    const mod = await import("@sentry/browser");
    mod.init({
      dsn,
      // Errors only. Performance tracing costs quota and we don't need it yet.
      tracesSampleRate: 0,
      // Don't let a user's own text reach the report through a stack frame.
      sendDefaultPii: false,
      beforeSend: (event) => {
        delete event.user;
        delete event.request;
        return event;
      },
    });
    sentry = mod;
  } catch {
    // Reporting must never be the thing that breaks the app.
  }
}

/**
 * Reports an error.
 *
 * Loaders and server functions commonly throw a raw Response, and String() on
 * one gives the useless "[object Response]" — so those are unpacked into a
 * status and URL instead.
 */
export function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
  severity: Severity = "error",
): void {
  if (typeof window === "undefined") return;

  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);

  const payload = {
    message,
    route: window.location.pathname,
    standalone: window.matchMedia?.("(display-mode: standalone)").matches ?? false,
    online: navigator.onLine,
    ...context,
  };

  if (sentry) {
    sentry.captureException(error instanceof Error ? error : new Error(message), {
      level: severity,
      extra: payload,
    });
  } else {
    // No DSN configured. Still make it visible in the console with the trail
    // attached, which is worth having when someone sends you a screenshot.
    console.error("[manifestai]", payload, breadcrumbs.slice(-8));
  }
}

/** Kept for the React error boundary, which already imports this name. */
export function reportLovableError(error: unknown, context: Record<string, unknown> = {}): void {
  reportError(error, { ...context, source: "react_error_boundary" });
}

/**
 * Catches what React's boundary doesn't: rejected promises and errors thrown
 * outside the render tree. Most audio and push failures are async and would
 * otherwise vanish silently.
 */
function installGlobalHandlers(): void {
  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { mechanism: "unhandledrejection" });
  });

  window.addEventListener("error", (event) => {
    // Ignore resource load errors — a failed image is noise, not a bug.
    if (event.error) reportError(event.error, { mechanism: "onerror" });
  });
}
