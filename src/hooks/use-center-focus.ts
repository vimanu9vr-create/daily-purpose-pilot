import { useEffect, type RefObject } from "react";

/**
 * Makes a horizontal row focus whatever is nearest its centre — the centred
 * card sits at full size while its neighbours shrink back and fade slightly.
 *
 * Stella does this, and it does real work: it tells you which card the snap
 * will land on, and it stops a row of equal-weight thumbnails from reading as
 * a grid. Without it the row is just a strip of pictures.
 *
 * Written against the DOM rather than React state on purpose. This runs on
 * every scroll frame, and re-rendering a dozen cards sixty times a second to
 * animate a transform is how you get a janky carousel on a mid-range phone.
 * Each item gets two CSS custom properties and the compositor does the rest.
 */

/** How much a card off to the side shrinks and fades. */
const SCALE_FALLOFF = 0.14;
const OPACITY_FALLOFF = 0.3;

export function useCenterFocus(ref: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const container = ref.current;
    if (!container || !enabled || typeof window === "undefined") return;

    let frame = 0;

    const items = () => Array.from(container.querySelectorAll<HTMLElement>("[data-focus-item]"));

    /**
     * Pads the row so the first and last cards can actually reach the middle.
     * Without this the first card can never be the focused one, and the row
     * opens looking wrong.
     */
    const layout = () => {
      const first = items()[0];
      if (!first) return;
      const gutter = (container.clientWidth - first.offsetWidth) / 2;
      // Never less than the page gutter, or the row loses its alignment.
      const padding = Math.max(20, Math.round(gutter));
      container.style.paddingLeft = `${padding}px`;
      container.style.paddingRight = `${padding}px`;
    };

    const paint = () => {
      frame = 0;
      const bounds = container.getBoundingClientRect();
      const centre = bounds.left + bounds.width / 2;

      for (const item of items()) {
        const rect = item.getBoundingClientRect();
        const offset = Math.abs(rect.left + rect.width / 2 - centre);
        // 0 at dead centre, 1 once a full card away.
        const t = Math.min(1, offset / (rect.width || 1));
        item.style.setProperty("--focus-scale", (1 - t * SCALE_FALLOFF).toFixed(3));
        item.style.setProperty("--focus-opacity", (1 - t * OPACITY_FALLOFF).toFixed(3));
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(paint);
    };

    const onResize = () => {
      layout();
      onScroll();
    };

    layout();
    paint();

    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    // Cards are image-backed and arrive over the network, so the row's width
    // changes after the first paint. Re-measure when it does.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onResize);
    observer?.observe(container);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
      container.style.paddingLeft = "";
      container.style.paddingRight = "";
    };
  }, [ref, enabled]);
}
