import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The trending-manifestations strip that drifts sideways on its own.
 *
 * The motion is the point — it advertises that these are tappable and that
 * there are more than fit on screen. Pauses on hover or touch so nothing
 * slides away mid-tap, and respects prefers-reduced-motion.
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
  const scrollerRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || paused || reduceMotion || items.length === 0) return;

    let frame = 0;
    let last = performance.now();
    const PIXELS_PER_SECOND = 18;

    const step = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;

      // The list is rendered twice; wrapping at the halfway point makes the
      // loop seamless rather than snapping back to zero.
      const half = el.scrollWidth / 2;
      el.scrollLeft += PIXELS_PER_SECOND * delta;
      if (el.scrollLeft >= half) el.scrollLeft -= half;

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [items.length, paused, reduceMotion]);

  if (items.length === 0) return null;

  // Duplicated so the seam is never visible.
  const doubled = [...items, ...items];

  return (
    <div
      ref={scrollerRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      className={cn("carousel -mx-5 px-5", className)}
      style={{ scrollSnapType: "none" }}
    >
      {doubled.map((item, index) => (
        <button
          key={`${item}-${index}`}
          type="button"
          onClick={() => onSelect(item)}
          className="carousel-item whitespace-nowrap rounded-full bg-white/70 px-4 py-2.5 text-xs font-medium text-secondary-foreground shadow-sm transition hover:bg-white"
        >
          {item}
        </button>
      ))}
    </div>
  );
}
