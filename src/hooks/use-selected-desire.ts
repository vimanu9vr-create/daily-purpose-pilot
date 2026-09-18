import { useCallback, useEffect, useState } from "react";

/**
 * Which dream the app is currently about.
 *
 * ## Why this exists
 *
 * Reported as: "daily practice should be what I click in desire — it's showing
 * the 1st one, and SAY THIS ONE is not changing."
 *
 * Both symptoms, and a third nobody had noticed yet, came from the selection
 * living in `useState` on the home screen:
 *
 *   1. `app.practice.tsx` took `desires?.[0]` and ignored the selection
 *      entirely, so the practice was always about the newest dream no matter
 *      what you tapped.
 *
 *   2. Tapping the already-selected chip set the selection to `null`, which
 *      fell through to `desires[0]` — so the anchor sprang back to the first
 *      dream and looked like it simply wasn't changing.
 *
 *   3. Local state resets on reload, so the choice never survived closing the
 *      app — which on a phone is every few minutes.
 *
 * The selection is not really component state. It's "what is this session
 * about", it belongs to the whole app, and it should outlive a navigation.
 *
 * ## Why localStorage and not a store library
 *
 * The project has no state library and doesn't need one for a single string.
 * `storage` events keep multiple tabs in step, and a same-tab custom event
 * keeps two components on the same page in step, which a bare `useState`
 * wrapper would not.
 *
 * Reads are guarded for SSR — this app server-renders through Nitro, so the
 * first render happens where `window` does not exist.
 */
const KEY = "manifestai.selected-desire";
const EVENT = "manifestai:selected-desire";

function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    // Safari private mode throws on access rather than returning null.
    return null;
  }
}

export function useSelectedDesire() {
  const [selected, setSelected] = useState<string | null>(null);

  // Hydrate after mount rather than in the initial state, so the server and
  // the first client render agree and React doesn't warn about a mismatch.
  useEffect(() => {
    setSelected(read());
  }, []);

  useEffect(() => {
    function sync() {
      setSelected(read());
    }
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const select = useCallback((id: string | null) => {
    setSelected(id);
    if (typeof window === "undefined") return;
    try {
      if (id) window.localStorage.setItem(KEY, id);
      else window.localStorage.removeItem(KEY);
    } catch {
      /* private mode — the in-memory value still works for this session */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { selected, select };
}

/**
 * The dream in focus, resolved against the dreams that actually exist.
 *
 * Falls back to the newest when nothing is stored, or when the stored id
 * points at a dream that has since been deleted — otherwise deleting the
 * selected dream would leave the whole app pointing at nothing.
 */
export function resolveDesireId<T extends { id: string }>(
  stored: string | null,
  desires: T[] | undefined,
): string | null {
  if (!desires?.length) return null;
  if (stored && desires.some((d) => d.id === stored)) return stored;
  return desires[0]!.id;
}
