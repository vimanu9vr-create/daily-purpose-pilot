import { useEffect, useState } from "react";

/**
 * The drifting placeholder in the desire box.
 *
 * Stella types a manifestation out, holds it, deletes it, and moves to the
 * next one. Ours was a single hardcoded string, so the box read as dead — one
 * suggestion, forever. The movement is the whole point: it tells you what kind
 * of thing to write here, and it keeps suggesting.
 *
 * Deliberately concrete and a little bold. "Be happier" teaches nobody what
 * belongs in this box.
 */
const PROMPTS = [
  "him obsessed with me…",
  "₹10 lakh months…",
  "my business taking off…",
  "the strongest I've ever been…",
  "moving abroad…",
  "unshakeable confidence…",
  "my own apartment…",
  "being paid what I'm worth…",
  "sleeping through the night…",
  "going viral…",
  "a calmer mind…",
  "attracting my person…",
];

const TYPE_MS = 55;
const DELETE_MS = 28;
const HOLD_MS = 1600;

export function useDesirePlaceholder(active = true): string {
  const [index, setIndex] = useState(0);
  const [length, setLength] = useState(0);
  const [deleting, setDeleting] = useState(false);
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
    if (!active || reduceMotion) return;

    const word = PROMPTS[index] ?? "";

    // Finished typing: hold, then start deleting.
    if (!deleting && length === word.length) {
      const id = window.setTimeout(() => setDeleting(true), HOLD_MS);
      return () => window.clearTimeout(id);
    }

    // Finished deleting: move to the next prompt.
    if (deleting && length === 0) {
      setDeleting(false);
      setIndex((i) => (i + 1) % PROMPTS.length);
      return;
    }

    const id = window.setTimeout(
      () => setLength((n) => n + (deleting ? -1 : 1)),
      deleting ? DELETE_MS : TYPE_MS,
    );
    return () => window.clearTimeout(id);
  }, [active, deleting, index, length, reduceMotion]);

  // Reduced motion, or the user is typing: show one full suggestion, still.
  if (reduceMotion || !active) return PROMPTS[0] ?? "";

  return (PROMPTS[index] ?? "").slice(0, length);
}
