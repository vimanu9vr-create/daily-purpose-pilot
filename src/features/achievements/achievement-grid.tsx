import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { useAchievements } from "./use-achievements";

/**
 * The achievements list.
 *
 * Unearned ones are shown rather than hidden, with their progress. Hiding them
 * makes the section look empty and gives no sense of what the app values;
 * showing them greyed out says "here is what counts here" without demanding
 * anything.
 *
 * Nothing pulses, bounces or sparkles. The visual difference between earned
 * and not is a filled circle and full-strength text — which is enough, because
 * anyone reading this list came looking for it.
 */
export function AchievementGrid() {
  const { data: achievements } = useAchievements();

  if (!achievements) return null;

  const earned = achievements.filter((a) => a.earned).length;

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Along the way</p>
        <p className="text-xs text-muted-foreground">
          {earned} of {achievements.length}
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {achievements.map((achievement) => (
          <li
            key={achievement.id}
            className={cn(
              "flex items-start gap-3 rounded-[22px] border border-glass-border p-4 transition-colors",
              achievement.earned ? "bg-card/60" : "bg-transparent",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                achievement.earned
                  ? "border-transparent surface-gradient text-primary-foreground"
                  : "border-muted-foreground/30",
              )}
            >
              {achievement.earned && <Check className="h-3.5 w-3.5" />}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-[15px] font-medium",
                  !achievement.earned && "text-muted-foreground",
                )}
              >
                {achievement.title}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {achievement.detail}
              </span>

              {/* Progress only where there's genuinely something to count, and
                  only before it's earned — a full bar under a tick is noise. */}
              {!achievement.earned && achievement.progress !== null && achievement.progress > 0 && (
                <span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary/50"
                    style={{ width: `${Math.round(achievement.progress * 100)}%` }}
                  />
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
