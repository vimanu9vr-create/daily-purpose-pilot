import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { profileKeys } from "@/features/onboarding/use-profile";
import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";

/**
 * Web push, via the service worker.
 *
 * The iOS constraint that shapes this whole feature: Safari only allows web
 * push once the app has been added to the Home Screen. Not "it works worse" —
 * the permission prompt does not exist until then. So the UI has to detect
 * standalone mode and tell the user to install first, rather than showing an
 * Enable button that silently does nothing.
 */

export type PushState = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  isStandalone: boolean;
  isIOS: boolean;
  /** True when this device can't be asked yet because iOS needs Home Screen install. */
  needsInstallFirst: boolean;
};

export function usePushState(): PushState {
  const [state, setState] = useState<PushState>({
    supported: false,
    permission: "unsupported",
    isStandalone: false,
    isIOS: false,
    needsInstallFirst: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      // iPadOS reports as Mac but has touch.
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    setState({
      supported,
      permission: supported ? Notification.permission : "unsupported",
      isStandalone,
      isIOS,
      needsInstallFirst: isIOS && !isStandalone,
    });
  }, []);

  return state;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** VAPID public keys are base64url; the browser wants raw bytes. */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

export function useIsSubscribed() {
  const userId = useUserId();
  return useQuery({
    queryKey: ["push-subscription"],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from("push_subscriptions").select("id").limit(1);
      if (error) throw error;
      return data.length > 0;
    },
  });
}

export function useEnableNotifications() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");

      const vapidKey = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;
      if (!vapidKey) {
        throw new Error("Notifications aren't configured yet — the VAPID key hasn't been added.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notifications were blocked. You can change that in browser settings.");
      }

      const registration = await registerServiceWorker();
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(vapidKey),
        }));

      const json = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error("The browser returned an incomplete subscription.");
      }

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent.slice(0, 300),
          failure_count: 0,
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ notifications_enabled: true })
        .eq("id", userId);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      toast.success("Morning affirmations are on");
      void queryClient.invalidateQueries({ queryKey: ["push-subscription"] });
      void queryClient.invalidateQueries({ queryKey: profileKeys.me });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDisableNotifications() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");

      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
      }

      const { error } = await supabase
        .from("profiles")
        .update({ notifications_enabled: false })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Morning affirmations are off");
      void queryClient.invalidateQueries({ queryKey: ["push-subscription"] });
      void queryClient.invalidateQueries({ queryKey: profileKeys.me });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Fires a local notification so the user can confirm it actually appears. */
export function useSendTestNotification() {
  return useMutation({
    mutationFn: async () => {
      if (Notification.permission !== "granted") {
        throw new Error("Turn notifications on first.");
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) throw new Error("The service worker isn't registered yet.");
      await registration.showNotification("Morning", {
        body: "This is what your daily affirmation will look like.",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "test",
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
