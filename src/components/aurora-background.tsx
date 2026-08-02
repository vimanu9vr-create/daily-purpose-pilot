import { cn } from "@/lib/utils";

/** Ambient gradient-mesh backdrop used across marketing and app surfaces. */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 aurora-mesh opacity-90" />
      <div className="absolute -left-40 top-[-10%] h-[38rem] w-[38rem] rounded-full bg-primary/25 blur-[140px] animate-float-slow" />
      <div className="absolute right-[-12%] top-[6%] h-[32rem] w-[32rem] rounded-full bg-violet/25 blur-[150px] animate-float-slow [animation-delay:-5s]" />
      <div className="absolute bottom-[-18%] left-1/3 h-[30rem] w-[30rem] rounded-full bg-ember/20 blur-[150px] animate-float-slow [animation-delay:-9s]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,transparent_35%,var(--background)_100%)]" />
    </div>
  );
}
