import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { profileKeys } from "@/features/onboarding/use-profile";
import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import { reportError, trail } from "@/lib/telemetry";
import { isNative, nativePlatform, registerNativePush } from "@/lib/native";

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

    // In the native app, APNs handles this — none of the web-push caveats
    // apply, including the Home Screen requirement.
    if (isNative()) {
      setState({
        supported: true,
        permission: "default",
        isStandalone: true,
        isIOS: nativePlatform() === "ios",
        needsInstallFirst: false,
      });
      return;
    }

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

/** True when this subscription was created with the given server key. */
function usesKey(subscription: PushSubscription, key: ArrayBuffer): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current as ArrayBuffer);
  const b = new Uint8Array(key);
  if (a.length !== b.length) return false;
  return a.every((byte, i) => byte === b[i]);
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

      // Native takes the APNs path — a device token rather than a VAPID
      // subscription, and no service worker involved.
      if (isNative()) {
        const registration = await registerNativePush();
        if (!registration) {
          throw new Error("Notifications were declined. You can change that in iOS Settings.");
        }

        const { error: nativeError } = await supabase.from("push_subscriptions").upsert(
          {
            user_id: userId,
            endpoint: `native:${registration.token}`,
            device_token: registration.token,
            platform: registration.platform,
            user_agent: navigator.userAgent.slice(0, 300),
            failure_count: 0,
          },
          { onConflict: "endpoint" },
        );
        if (nativeError) throw nativeError;

        const { error: profileError } = await supabase
          .from("profiles")
          .update({ notifications_enabled: true })
          .eq("id", userId);
        if (profileError) throw profileError;
        return;
      }

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

      const keyBytes = urlBase64ToBytes(vapidKey);

      // Reuse an existing subscription ONLY if it was created with the key we
      // currently sign with.
      //
      // This used to be `existing ?? subscribe(...)`, which meant that once a
      // subscription existed it was kept forever — even after the VAPID keys
      // were rotated. The push service binds each subscription to the exact
      // key it was made with and rejects anything signed by a different one,
      // so every send failed, and turning notifications off and on again
      // couldn't fix it because the stale subscription was handed straight
      // back. It also upserts onto the same endpoint, so no new row appears
      // and the whole thing looks like nothing happened.
      let subscription = await registration.pushManager.getSubscription();

      if (subscription && !usesKey(subscription, keyBytes)) {
        // The exact condition that broke notifications for a week and was
        // invisible from outside. Worth knowing every time it happens.
        trail("push", "stale-key:resubscribing");
        await subscription.unsubscribe();
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes,
        });
        trail("push", "subscribed");
      }

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
    onError: (error: Error) => {
      reportError(error, { feature: "push", phase: "enable" });
      toast.error(error.message);
    },
  });
}

export function useDisableNotifications() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");

      if (isNative()) {
        // No service worker on native — just drop the stored device token.
        await supabase.from("push_subscriptions").delete().eq("user_id", userId);
        const { error: nativeError } = await supabase
          .from("profiles")
          .update({ notifications_enabled: false })
          .eq("id", userId);
        if (nativeError) throw nativeError;
        return;
      }

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
