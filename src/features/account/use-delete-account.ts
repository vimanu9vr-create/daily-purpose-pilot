import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

/**
 * Permanently deletes the signed-in account.
 *
 * App Store Review Guideline 5.1.1(v) requires this to be reachable from
 * inside the app, and to actually delete rather than deactivate.
 */
export function useDeleteAccount() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in and try again.");

      const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(detail?.message ?? "Couldn't delete your account. Please try again.");
      }
    },
    onSuccess: async () => {
      // Clear every trace locally too, so nothing lingers on this device.
      await supabase.auth.signOut();
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.localStorage.clear();
        // Drop the push subscription so this device can't be notified again.
        const registration = await navigator.serviceWorker?.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        await subscription?.unsubscribe();
      }
      toast.success("Your account and everything in it has been deleted.");
      void navigate({ to: "/", replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
