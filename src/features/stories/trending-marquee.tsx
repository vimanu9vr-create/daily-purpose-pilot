import { useEffect, useRef, useState } from "react";

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
 *
 * Speed is a real pixels-per-second rate, measured off the rendered track,
 * rather than a duration guessed from the number of chips. Guessing meant the
 * strip crawled whenever the list was long — which is exactly when there's most
 * to look at.
 */
const SPEED_PX_PER_SECOND = 62;
export function TrendingMarquee({
  items,
  onSelect,
  className,
}: {
  items: readonly string[];
  onSelect: (item: string) => void;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(30);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = () => setReduceMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Measure once the chips have laid out, and again if the width changes
  // (rotation, font loading, a different chip count).
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof window === "undefined") return;

    const measure = () => {
      // The track holds two identical copies; one copy is the loop distance.
      const distance = track.scrollWidth / 2;
      if (distance > 0) {
        setDurationSeconds(distance / SPEED_PX_PER_SECOND);
      }
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className={cn("relative -mx-5 overflow-hidden", className)}>
      <div
        ref={trackRef}
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
                className="whitespace-nowrap rounded-full bg-white/85 px-5 py-3 text-[13px] font-medium text-secondary-foreground shadow-[0_4px_14px_-8px_var(--shadow-color-soft)] transition active:scale-95"
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
