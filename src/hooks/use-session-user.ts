import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * The signed-in user. Routes under `_authenticated` already guarantee a session,
 * so this resolves from cache almost immediately — it exists so mutations can
 * stamp `user_id` without prop-drilling.
 */
export function useSessionUser() {
  return useQuery({
    queryKey: ["session-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserId(): string | undefined {
  return useSessionUser().data?.id;
}
