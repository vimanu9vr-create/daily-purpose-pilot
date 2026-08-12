import { useState } from "react";

import { cn } from "@/lib/utils";

import { ANGEL_NUMBERS, numberForToday } from "./angel-numbers";

/**
 * Today's number, on Home.
 *
 * Collapsed it's a single quiet line — the number and its reading. Tapping it
 * opens the reflection question, which is the part that's actually worth
 * having. That ordering is deliberate: the number is the hook, the question is
 * the product.
 *
 * Small on purpose. This sits below the action and the practice because it is
 * the least load-bearing thing on the screen, and putting it at the top would
 * say the app thinks a number matters more than what you do today.
 */
export function NumberCard() {
  const today = numberForToday();
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 rounded-[28px] border border-glass-border bg-card/40 px-5 py-4 text-left transition active:scale-[0.99]"
      >
        <span className="font-display text-2xl tabular-nums text-primary">{today.number}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Today&rsquo;s number
          </span>
          <span
            className={cn(
              "mt-0.5 block text-sm leading-relaxed text-muted-foreground",
              !open && "line-clamp-1",
            )}
          >
            {today.meaning}
          </span>
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-[24px] surface-gradient p-[1px]">
          <div className="rounded-[23px] bg-card/85 p-5">
            <p className="text-[15px] leading-relaxed">{today.prompt}</p>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              A repeated number isn&rsquo;t a prediction. It&rsquo;s a reason to stop for a second
              and ask the question.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/** The full list, for the Library. */
export function NumberList() {
  return (
    <section className="mt-8">
      <p className="eyebrow">Numbers</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        What these are traditionally read to mean, and a question for each.
      </p>

      <div className="mt-4 space-y-2">
        {ANGEL_NUMBERS.map((entry) => (
          <article
            key={entry.number}
            className="rounded-[22px] border border-glass-border bg-card/40 p-4"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-display text-xl tabular-nums text-primary">{entry.number}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{entry.meaning}</span>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed">{entry.prompt}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
