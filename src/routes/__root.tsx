import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { primeAuthSession, registerNavigator } from "@/lib/auth-session";

import appCss from "../styles.css?url";
import { Toaster } from "../components/ui/sonner";
import { reportBoundaryError, startTelemetry } from "../lib/telemetry";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportBoundaryError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * The canonical origin, in one place.
 *
 * Taken from the deployment that actually exists rather than an aspirational
 * custom domain — an incorrect canonical is worse than none. When a domain is
 * registered, change this single line and the canonical, og:url and both image
 * URLs all follow.
 */
const SITE_URL = "https://daily-purpose-pilot.vimanu9-vr.workers.dev";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ManifestAI — Turn your intentions into daily actions" },
      {
        name: "description",
        content:
          "ManifestAI blends AI coaching, journaling, affirmations and habit tracking into one calm daily practice.",
      },
      /**
       * Open Graph and Twitter cards.
       *
       * `og:type` and `twitter:card` were here on their own, which is the
       * worst of both worlds: the card renders, and renders empty. Every link
       * shared to WhatsApp, Instagram DMs, Facebook or X previewed as a bare
       * URL with no title, no description and no image — including the one in
       * the bio that all the traffic goes through.
       *
       * The image is absolute because relative URLs are not resolved by most
       * crawlers, and it is a real 1200x630 file rather than the app icon,
       * which social platforms crop badly.
       */
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "ManifestAI" },
      { property: "og:title", content: "ManifestAI — one goal in, it writes the rest" },
      {
        property: "og:description",
        content:
          "Not \u201cI am abundant.\u201d The specific line, written from your own words, for the thing you actually want. Free to start in your browser.",
      },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/og.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "ManifestAI, asking what do you want to manifest",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ManifestAI — one goal in, it writes the rest" },
      {
        name: "twitter:description",
        content:
          "The specific line, written from your own words, for the thing you actually want.",
      },
      { name: "twitter:image", content: `${SITE_URL}/og.jpg` },
      { name: "theme-color", content: "#f7e9ec" },
      // Lets iOS run this full screen once it's on the Home Screen — which is
      // also the precondition for web push working at all on iPhone.
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "ManifestAI" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Canonical. Without it the same page served from a future custom domain
      // and from workers.dev would compete with itself in search results.
      { rel: "canonical", href: SITE_URL },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  const navigate = useNavigate();

  // Start listening for the stored session immediately, so the auth gate is
  // already open by the time any protected route asks.
  //
  // The navigator is handed over first. Signing in moves the person into the
  // app, and that move has to go through the router: inside the native build
  // there is no server behind the WebView, only one bundled index.html, so a
  // document-level navigation to /app resolves to nothing and shows a blank
  // screen.
  useEffect(() => {
    registerNavigator((to) => void navigate({ to, replace: true }));
    primeAuthSession();
    // Async failures — audio, push, network — happen outside React's error
    // boundary and would otherwise disappear entirely.
    void startTelemetry();
  }, [navigate]);

  // Register the service worker so the app is installable and can receive push.
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
