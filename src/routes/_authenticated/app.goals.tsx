import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout route — the list lives in app.goals.index.tsx, detail in app.goals.$goalId.tsx */
export const Route = createFileRoute("/_authenticated/app/goals")({
  component: () => <Outlet />,
});
