import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AuroraBackground } from "@/components/aurora-background";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — ManifestAI" },
      {
        name: "description",
        content: "Send yourself a secure link to choose a new ManifestAI password.",
      },
      { property: "og:title", content: "Reset your password — ManifestAI" },
      {
        property: "og:description",
        content: "Send yourself a secure link to choose a new ManifestAI password.",
      },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
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
            <h1 className="text-2xl font-semibold">Forgot your password?</h1>
            {sent ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                If an account exists for <span className="text-foreground">{email}</span>, a reset
                link is on its way. Check your inbox and spam folder.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter your email and we'll send a secure reset link.
                </p>
                <form onSubmit={handleSubmit} className="mt-7 space-y-4">
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
                  <Button
                    type="submit"
                    variant="hero"
                    size="lg"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : null}
                    Send reset link
                  </Button>
                </form>
              </>
            )}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/auth" className="font-medium text-primary hover:underline">
                Back to log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
