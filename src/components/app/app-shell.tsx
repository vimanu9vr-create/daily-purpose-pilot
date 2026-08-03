import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Headphones, Heart, Home, User } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Four tabs, the way the app is actually used: browse, listen, affirm, you. */
export const navItems = [
  { title: "Home", to: "/app", icon: Home },
  { title: "Library", to: "/app/library", icon: Headphones },
  { title: "Affirmations", to: "/app/affirmations", icon: Heart },
  { title: "You", to: "/app/profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  function isActive(to: string) {
    return to === "/app" ? pathname === "/app" : pathname.startsWith(to);
  }

  return (
    <div className="blush-field relative min-h-screen">
      <main className="mx-auto w-full max-w-2xl px-5 pb-32 pt-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5">
        <ul className="glass-panel flex w-full max-w-sm items-center justify-around rounded-full px-2 py-2.5">
          {navItems.map((item) => (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                aria-label={item.title}
                className={cn(
                  "flex items-center justify-center rounded-full py-2 transition-colors",
                  isActive(item.to)
                    ? "text-primary"
                    : "text-muted-foreground/70 hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn("h-[22px] w-[22px]", isActive(item.to) && "fill-current")}
                  strokeWidth={isActive(item.to) ? 1.5 : 1.75}
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Used by the profile screen; kept here so sign-out logic lives in one place. */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}
