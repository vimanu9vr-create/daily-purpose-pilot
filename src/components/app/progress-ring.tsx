import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  className,
  label,
  sublabel,
}: {
  /** 0–100 */
  value: number;
  size?: number | undefined;
  stroke?: number | undefined;
  className?: string | undefined;
  label?: string | undefined;
  sublabel?: string | undefined;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const gradientId = `ring-${size}-${stroke}`;

  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="55%" stopColor="var(--violet)" />
            <stop offset="100%" stopColor="var(--ember)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-semibold leading-none"
          style={{ fontSize: Math.max(11, size * 0.24) }}
        >
          {label ?? `${clamped}%`}
        </span>
        {sublabel && (
          <span className="mt-0.5 text-[10px] leading-none text-muted-foreground">{sublabel}</span>
        )}
      </div>
      <span className="sr-only">{clamped}% complete</span>
    </div>
  );
}
