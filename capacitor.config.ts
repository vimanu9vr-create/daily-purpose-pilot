import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the built web app in a real iOS project.
 *
 * `webDir` points at the client output of the native build (vite.config.native.ts),
 * which is a pure static bundle — no server, because there isn't one on a phone.
 *
 * Deliberately no `server.url`. Pointing the shell at a remote URL is exactly
 * the "repackaged website" Apple rejects under Guideline 4.2, and it breaks
 * offline. The bundle ships inside the app.
 */
const config: CapacitorConfig = {
  appId: "com.manifestai888.app",
  appName: "ManifestAI",
  webDir: "dist-native/client",

  ios: {
    // Matches the blush background so there's no white flash on launch.
    backgroundColor: "#f7e9ec",
    contentInset: "always",
    // Links to other sites open in the system browser rather than inside the app.
    limitsNavigationsToAppBoundDomains: true,
  },

  // Android had no section at all, so it launched on the WebView default —
  // a white flash into a blush app, on the platform we are shipping first.
  android: {
    backgroundColor: "#f7e9ec",
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#f7e9ec",
      showSpinner: false,
      launchAutoHide: true,
    },
    PushNotifications: {
      // Sound and badge are opted into at the point the user turns them on.
      presentationOptions: ["alert", "sound"],
    },
    Keyboard: {
      resize: "native",
    },
  },
};

export default config;
