import { useQuery } from "@tanstack/react-query";

import { getAuthSession } from "@/lib/auth-session";

/**
 * The signed-in user.
 *
 * Reads the cached session rather than calling `auth.getUser()`, which was a
 * network round-trip on every mount. Routes under `_authenticated` already
 * guarantee a session, so this resolves immediately; it exists so mutations can
 * stamp `user_id` without prop-drilling.
 */
export function useSessionUser() {
  return useQuery({
    queryKey: ["session-user"],
    queryFn: async () => (await getAuthSession())?.user ?? null,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserId(): string | undefined {
  return useSessionUser().data?.id ?? undefined;
}
