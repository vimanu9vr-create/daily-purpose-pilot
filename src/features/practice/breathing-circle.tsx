import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * A breathing pacer.
 *
 * Four in, four hold, six out — a longer exhale than inhale, which is the part
 * that actually settles the nervous system rather than just looking calm. A
 * symmetric circle is prettier and does less.
 *
 * The animation drives the instruction rather than the other way around, so
 * the word on screen can never drift out of step with the circle. Running two
 * timers and hoping they agree is how you end up telling someone to breathe in
 * while the circle shrinks.
 */

const IN = 4;
const HOLD = 4;
const OUT = 6;
const CYCLE = IN + HOLD + OUT;

export function BreathingCircle({ seconds }: { seconds: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 100);
    return () => window.clearInterval(id);
  }, []);

  const intoCycle = elapsed % CYCLE;
  const phase = intoCycle < IN ? "in" : intoCycle < IN + HOLD ? "hold" : "out";

  const scale = phase === "in" ? 1 : phase === "hold" ? 1 : 0.62;
  const duration = phase === "in" ? IN : phase === "hold" ? HOLD : OUT;

  const remaining = Math.max(0, Math.ceil(seconds - elapsed));

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-56 w-56 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full surface-gradient opacity-20 blur-2xl"
          animate={{ scale }}
          transition={{ duration, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-4 rounded-full border border-primary/30"
          animate={{ scale }}
          transition={{ duration, ease: "easeInOut" }}
        />
        <motion.div
          className="h-24 w-24 rounded-full surface-gradient shadow-glow"
          animate={{ scale }}
          transition={{ duration, ease: "easeInOut" }}
        />
        <p className="absolute font-display text-lg text-primary-foreground">
          {phase === "in" ? "In" : phase === "hold" ? "Hold" : "Out"}
        </p>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">{remaining}s</p>
    </div>
  );
}
