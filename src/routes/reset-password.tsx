import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AuroraBackground } from "@/components/aurora-background";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — ManifestAI" },
      { name: "description", content: "Set a new password for your ManifestAI account." },
      { property: "og:title", content: "Choose a new password — ManifestAI" },
      {
        property: "og:description",
        content: "Set a new password for your ManifestAI account.",
      },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
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
            <h1 className="text-2xl font-semibold">Choose a new password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Open this page from your reset email, then set a new password.
            </p>
            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : null}
                Update password
              </Button>
            </form>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
