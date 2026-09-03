/**
 * Where the signed-in session is kept.
 *
 * ## Why this file exists
 *
 * On the web, localStorage is the right answer and nothing here changes that.
 *
 * Inside the Android app it is the wrong answer. The app is a Capacitor
 * WebView, and WebView storage is treated by Android as cache: it is cleared
 * when the system reclaims space, when the user taps "clear cache", and on some
 * devices simply when the app is swiped away. The person did nothing wrong and
 * gets the sign-in screen anyway, with no explanation available to them or to
 * us.
 *
 * Capacitor Preferences writes to SharedPreferences on Android and
 * UserDefaults on iOS. Both survive app restarts, cache clears and OS memory
 * pressure. They are removed only when the app is uninstalled, which is exactly
 * when a session *should* disappear.
 *
 * ## Migration
 *
 * Anyone already signed in has their session in localStorage. `getItem` falls
 * back to it and copies what it finds into Preferences on the way past, so the
 * switch does not sign a single existing user out. The fallback can be deleted
 * once no installs predate this change; it is cheap enough to leave.
 *
 * ## Async is fine
 *
 * Supabase accepts a storage adapter whose methods return promises, and this
 * one does on native because the plugin bridge is asynchronous. `getAuthSession`
 * already waits for the first `onAuthStateChange` before letting the route
 * guard decide anything, so nothing reads a session before storage has spoken.
 */

import { isNative } from "@/lib/native";

type AsyncStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

function webStorage(): AsyncStorage | undefined {
  if (typeof window === "undefined") return undefined;
  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
  };
}

async function preferences() {
  const { Preferences } = await import("@capacitor/preferences");
  return Preferences;
}

/**
 * Native storage, with a one-way migration out of localStorage.
 *
 * Every method swallows plugin failures and falls back to localStorage rather
 * than throwing. A storage error must never surface as "you are signed out" —
 * that is the exact mistake this file exists to stop making.
 */
function nativeStorage(): AsyncStorage {
  return {
    getItem: async (key) => {
      try {
        const Preferences = await preferences();
        const { value } = await Preferences.get({ key });
        if (value !== null && value !== undefined) return value;

        // Nothing stored natively yet. An existing install will still have the
        // session in WebView localStorage; adopt it so upgrading does not sign
        // anybody out.
        const legacy = window.localStorage.getItem(key);
        if (legacy !== null) {
          await Preferences.set({ key, value: legacy });
          return legacy;
        }
        return null;
      } catch {
        return typeof window === "undefined" ? null : window.localStorage.getItem(key);
      }
    },

    setItem: async (key, value) => {
      try {
        const Preferences = await preferences();
        await Preferences.set({ key, value });
      } catch {
        window.localStorage.setItem(key, value);
      }
    },

    removeItem: async (key) => {
      try {
        const Preferences = await preferences();
        await Preferences.remove({ key });
      } catch {
        // ignore — see below
      }
      // Always clear the legacy copy too, or a genuine sign-out would leave a
      // session behind for the migration path to find and restore.
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Storage disabled entirely. Nothing to remove.
      }
    },
  };
}

export function sessionStorageAdapter(): AsyncStorage | undefined {
  if (typeof window === "undefined") return undefined;
  return isNative() ? nativeStorage() : webStorage();
}
