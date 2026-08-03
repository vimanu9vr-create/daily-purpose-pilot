import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Makes a horizontally-scrolling row usable with a mouse.
 *
 * Touch devices scroll these natively, but on desktop a horizontal overflow
 * container can only be scrolled with shift+wheel, which nobody discovers —
 * so the row looks frozen. This adds click-and-drag, maps vertical wheel to
 * horizontal scroll, and reports whether there's more content either side so
 * arrow buttons can be shown.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const dragging = useRef(false);
  const moved = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);

  const updateEdges = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    updateEdges();

    const onScroll = () => updateEdges();
    el.addEventListener("scroll", onScroll, { passive: true });

    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);

    // Vertical wheel → horizontal scroll, so a normal mouse works.
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const target = ref.current;
      if (!target) return;
      const atStart = target.scrollLeft <= 0 && event.deltaY < 0;
      const atEnd =
        target.scrollLeft + target.clientWidth >= target.scrollWidth && event.deltaY > 0;
      // Let the page scroll once the row has nowhere left to go.
      if (atStart || atEnd) return;
      event.preventDefault();
      target.scrollLeft += event.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      observer.disconnect();
    };
  }, [updateEdges]);

  const onPointerDown = useCallback((event: React.PointerEvent<T>) => {
    // Touch already scrolls natively; only take over for mouse.
    if (event.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    dragging.current = true;
    moved.current = false;
    startX.current = event.clientX;
    startScroll.current = el.scrollLeft;
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<T>) => {
    if (!dragging.current) return;
    const el = ref.current;
    if (!el) return;
    const delta = event.clientX - startX.current;
    if (Math.abs(delta) > 4) moved.current = true;
    el.scrollLeft = startScroll.current - delta;
  }, []);

  const endDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  /** Swallows the click that ends a drag, so dragging doesn't open a card. */
  const onClickCapture = useCallback((event: React.MouseEvent<T>) => {
    if (moved.current) {
      event.preventDefault();
      event.stopPropagation();
      moved.current = false;
    }
  }, []);

  const scrollBy = useCallback((amount: number) => {
    ref.current?.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  return {
    ref,
    canScrollLeft,
    canScrollRight,
    scrollBy,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerLeave: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
    },
  };
}
