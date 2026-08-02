import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Flame,
  LayoutDashboard,
  LineChart,
  LogOut,
  MessageCircleHeart,
  Settings,
  Sparkles,
  Target,
} from "lucide-react";
import type { ReactNode } from "react";

import { AuroraBackground } from "@/components/aurora-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const navItems = [
  { title: "Dashboard", to: "/app", icon: LayoutDashboard },
  { title: "Coach", to: "/app/coach", icon: MessageCircleHeart },
  { title: "Goals", to: "/app/goals", icon: Target },
  { title: "Journal", to: "/app/journal", icon: BookOpen },
  { title: "Habits", to: "/app/habits", icon: Flame },
  { title: "Progress", to: "/app/progress", icon: LineChart },
  { title: "Settings", to: "/app/settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <AuroraBackground className="opacity-70" />

      <div className="relative flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-glass-border bg-sidebar/60 p-5 backdrop-blur-xl md:flex">
          <Link to="/app" className="flex items-center gap-2 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl surface-gradient shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </span>
            <span className="font-display text-lg font-semibold">ManifestAI</span>
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {navItems.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>

          <Button variant="ghost" className="justify-start text-muted-foreground" onClick={signOut}>
            <LogOut /> Sign out
          </Button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-glass-border bg-background/60 px-5 py-3 backdrop-blur-xl">
            <Link to="/app" className="flex items-center gap-2 md:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg surface-gradient">
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
              </span>
              <span className="font-display font-semibold">ManifestAI</span>
            </Link>
            <span className="hidden text-sm text-muted-foreground md:block">
              Turn your intentions into daily actions.
            </span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="glass" size="icon" onClick={signOut} aria-label="Sign out" className="md:hidden">
                <LogOut />
              </Button>
            </div>
          </header>

          <main className="flex-1 px-5 pb-28 pt-6 md:px-10 md:pb-12">{children}</main>
        </div>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-glass-border bg-background/80 px-2 py-2 backdrop-blur-xl md:hidden">
        <ul className="flex items-center justify-between">
          {navItems.map((item) => {
            const active = pathname === item.to;
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
