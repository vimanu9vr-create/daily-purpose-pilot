import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AuroraBackground } from "@/components/aurora-background";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getAuthSession, setAuthSession } from "@/lib/auth-session";
import { lovable } from "@/integrations/lovable/index";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — ManifestAI" },
      {
        name: "description",
        content: "Log in or create your free ManifestAI account and start your daily practice.",
      },
      { property: "og:title", content: "Sign in — ManifestAI" },
      {
        property: "og:description",
        content: "Log in or create your free ManifestAI account and start your daily practice.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const session = await getAuthSession();
    if (session) throw redirect({ to: "/app" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
        // Seed the cache before navigating, so the route guard doesn't read a
        // stale null and bounce straight back here.
        if (data.session) setAuthSession(data.session);
        toast.success("Account created. Welcome to ManifestAI.");
        navigate({ to: "/app" });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthSession(data.session);
        navigate({ to: "/app" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    await getAuthSession();
    navigate({ to: "/app" });
  }

  /**
   * App Store Review Guideline 4.8: offering Google sign-in obliges us to
   * offer Sign in with Apple as an equivalent option.
   */
  async function handleApple() {
    setAppleLoading(true);
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setAppleLoading(false);
      // Apple sign-in needs a paid Apple Developer account and the provider
      // enabled in Supabase. Until then it can't work, and saying "try again"
      // just sends people round in circles.
      toast.error("Apple sign-in isn't available yet — please use Google or email.");
      return;
    }
    if (result.redirected) return;
    await getAuthSession();
    navigate({ to: "/app" });
  }

  return (
    <PageTransition>
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-12">
        <AuroraBackground />

        <div className="relative w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl surface-gradient shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </span>
            <span className="font-display text-lg font-semibold">ManifestAI</span>
          </Link>

          <div className="rounded-3xl glass-panel p-8">
            <h1 className="text-2xl font-semibold">
              {isSignup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isSignup
                ? "Start turning intentions into daily actions."
                : "Pick up your practice where you left off."}
            </p>

            <div className="mt-7 space-y-2.5">
              <Button
                type="button"
                size="lg"
                className="w-full bg-black text-white hover:bg-black/90"
                onClick={handleApple}
                disabled={appleLoading}
              >
                {appleLoading ? <Loader2 className="animate-spin" /> : <AppleIcon />}
                Continue with Apple
              </Button>

              <Button
                type="button"
                variant="glass"
                size="lg"
                className="w-full"
                onClick={handleGoogle}
                disabled={googleLoading}
              >
                {googleLoading ? <Loader2 className="animate-spin" /> : null}
                Continue with Google
              </Button>
            </div>

            <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or with email
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Maya"
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {!isSignup && (
                    <Link
                      to="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                />
              </div>

              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : null}
                {isSignup ? "Start Free" : "Log in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignup ? "Already have an account?" : "New to ManifestAI?"}{" "}
              <button
                type="button"
                onClick={() => setIsSignup((v) => !v)}
                className="font-medium text-primary hover:underline"
              >
                {isSignup ? "Log in" : "Create one free"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

/** Apple's mark, inline so there's no icon-library dependency for a brand asset. */
function AppleIcon() {
  return (
    <svg viewBox="0 0 384 512" aria-hidden className="h-4 w-4 fill-current">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}
