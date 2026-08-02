import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PageTransition } from "@/components/page-transition";

export function AppPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </header>
        {children}
      </div>
    </PageTransition>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl glass-panel px-8 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl surface-gradient shadow-glow">
        <Icon className="h-6 w-6 text-primary-foreground" />
      </span>
      <h2 className="mt-6 text-xl font-semibold">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {hint && <p className="mt-5 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}
