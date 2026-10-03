import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export const THEME_STORAGE_KEY = "manifestai-theme";
const STORAGE_KEY = THEME_STORAGE_KEY;

/**
 * Applies the saved theme to the document, once, at start-up.
 *
 * Called from the root rather than from this component because `ThemeToggle`
 * only renders on the landing page. Inside `/app` nothing read the stored
 * value at all, so somebody who chose dark in their profile and then reloaded
 * straight into the app — which is what happens every time they open it —
 * silently got light back, and the profile toggle agreed with the screen while
 * disagreeing with what they had chosen.
 *
 * Light is the default when nothing is stored: this app's palette is cream and
 * blush, the same colours the launch screen and notification icons use, and
 * dark inverted it into something that didn't look like the brand anywhere
 * else the brand appears.
 */
export function applyStoredTheme(): void {
  if (typeof window === "undefined") return;
  const dark = window.localStorage.getItem(STORAGE_KEY) === "dark";
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Light by default.
 *
 * It was dark, and the palette this app is built on — the cream and blush in
 * `theme-color`, the same colours the launch screen and the notification icons
 * use — is a light palette. Dark mode inverted it into something that didn't
 * look like the brand anywhere else the brand appears.
 *
 * A stored choice still wins, so anybody who deliberately picked dark keeps
 * it. Only the DEFAULT changed, which is what a new account sees.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const dark = stored === "dark";
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      return next;
    });
  }, []);

  return (
    <Button
      variant="glass"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={className}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
