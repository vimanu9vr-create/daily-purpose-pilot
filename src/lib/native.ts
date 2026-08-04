/**
 * Native platform capability, behind one small surface.
 *
 * Every native API is loaded lazily and guarded, so the same code runs
 * unchanged on the web — importing Capacitor plugins eagerly would break the
 * browser build and the SSR pass. Nothing here throws if a plugin is missing.
 */

export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export function nativePlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const platform = cap?.getPlatform?.();
  return platform === "ios" || platform === "android" ? platform : "web";
}

/* ---------------------------------------------------------------- haptics */

type ImpactWeight = "light" | "medium" | "heavy";

/**
 * A small physical confirmation on the actions that deserve one — saving an
 * affirmation, ticking a habit, starting a story. Silent no-op on web.
 */
export async function haptic(weight: ImpactWeight = "light"): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style =
      weight === "heavy"
        ? ImpactStyle.Heavy
        : weight === "medium"
          ? ImpactStyle.Medium
          : ImpactStyle.Light;
    await Haptics.impact({ style });
  } catch {
    // Plugin absent or unavailable — nothing worth surfacing.
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Ignore.
  }
}

/* ------------------------------------------------------------------ share */

/**
 * Native share sheet where available, Web Share where not, clipboard as the
 * last resort. Returns whether anything actually happened.
 */
export async function share(options: {
  title?: string;
  text: string;
  url?: string;
}): Promise<boolean> {
  if (isNative()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: options.title ?? "ManifestAI",
        text: options.text,
        ...(options.url ? { url: options.url } : {}),
        dialogTitle: "Share",
      });
      return true;
    } catch {
      return false;
    }
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        ...(options.title ? { title: options.title } : {}),
        text: options.text,
        ...(options.url ? { url: options.url } : {}),
      });
      return true;
    } catch {
      return false;
    }
  }

  try {
    await navigator.clipboard.writeText(options.text);
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------- browser */

/** Opens external links outside the app, which App Store review expects. */
export async function openExternal(url: string): Promise<void> {
  if (isNative()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url, presentationStyle: "popover" });
      return;
    } catch {
      // Fall through.
    }
  }
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
}

/* ------------------------------------------------------------ status bar */

/** The app is light-first, so the status bar needs dark glyphs. */
export async function configureStatusBar(isDark: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
  } catch {
    // Ignore.
  }
}

/* ----------------------------------------------------------- push tokens */

export type NativePushRegistration = { token: string; platform: "ios" | "android" };

/**
 * Registers for APNs and resolves with the device token.
 *
 * Native push is a different mechanism from web push: APNs issues a device
 * token rather than a VAPID subscription, so the sender has to branch on which
 * kind it's holding. Resolves null if permission is refused.
 */
export async function registerNativePush(): Promise<NativePushRegistration | null> {
  if (!isNative()) return null;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const status = await PushNotifications.checkPermissions();
    let granted = status.receive === "granted";
    if (!granted) {
      const request = await PushNotifications.requestPermissions();
      granted = request.receive === "granted";
    }
    if (!granted) return null;

    return await new Promise<NativePushRegistration | null>((resolve) => {
      // Resolve on whichever of the two events fires first.
      let settled = false;
      const finish = (value: NativePushRegistration | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      void PushNotifications.addListener("registration", (token) => {
        finish({
          token: token.value,
          platform: nativePlatform() === "android" ? "android" : "ios",
        });
      });
      void PushNotifications.addListener("registrationError", () => finish(null));

      void PushNotifications.register();
      setTimeout(() => finish(null), 10_000);
    });
  } catch {
    return null;
  }
}
