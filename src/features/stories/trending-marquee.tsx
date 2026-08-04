import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The trending strip that drifts sideways on its own.
 *
 * Deliberately NOT a scroll container. The first version animated
 * `scrollLeft` on an element that also had CSS scroll-snap, so on a phone the
 * animation and the browser's own momentum scrolling fought each other — the
 * row appeared frozen, and a swipe snapped straight back. This is a plain CSS
 * transform on a non-scrollable track, which the browser can't argue with.
 *
 * The list is rendered twice and the animation travels exactly -50%, so the
 * loop point is invisible.
 */
export function TrendingMarquee({
  items,
  onSelect,
  className,
}: {
  items: readonly string[];
  onSelect: (item: string) => void;
  className?: string;
}) {
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = () => setReduceMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  if (items.length === 0) return null;

  // Slower with more chips, so the speed reads the same regardless of count.
  const durationSeconds = Math.max(18, items.length * 4);

  return (
    <div className={cn("relative -mx-5 overflow-hidden", className)}>
      <div
        className="marquee-track flex w-max gap-2 px-5"
        style={{
          animationDuration: `${durationSeconds}s`,
          animationPlayState: paused || reduceMotion ? "paused" : "running",
        }}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Rendered twice; the second copy is hidden from screen readers. */}
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-2" aria-hidden={copy === 1}>
            {items.map((item) => (
              <button
                key={`${copy}-${item}`}
                type="button"
                onClick={() => onSelect(item)}
                tabIndex={copy === 1 ? -1 : 0}
                className="whitespace-nowrap rounded-full bg-white/70 px-4 py-2.5 text-xs font-medium text-secondary-foreground shadow-sm transition active:scale-95"
              >
                {item}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
