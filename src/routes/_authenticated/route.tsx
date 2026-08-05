import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getAuthSession } from "@/lib/auth-session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Reads the cached session rather than calling the auth server. The old
    // version used `getUser()` — a network request on every navigation — and a
    // failed request looked identical to being signed out, which is why the app
    // kept asking people to sign in again on a shaky connection.
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/auth" });
    return { user: session.user };
  },
  component: () => <Outlet />,
});
