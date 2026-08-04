/**
 * Build config for the native (Capacitor) app.
 *
 * The web build server-renders through Nitro. A native app can't — Capacitor
 * serves files from the device with no server behind them — so this produces a
 * pure client bundle instead:
 *
 *   nitro: false          skip the server build entirely
 *   spa.enabled           emit a static shell that boots the router on device
 *   maskPath "/app"       the shell is prerendered from /app, which is where
 *                         the native app always starts
 *
 * Kept as a separate file so the web deploy is completely untouched.
 * Build with: npm run build:native
 */
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    spa: {
      enabled: true,
      maskPath: "/app",
      prerender: {
        enabled: true,
        outputPath: "/index.html",
        crawlLinks: false,
        retryCount: 1,
      },
    },
  },
  vite: {
    build: {
      outDir: "dist-native",
      emptyOutDir: true,
    },
    define: {
      // Lets the app branch on packaging without sniffing the user agent.
      "import.meta.env.VITE_NATIVE_BUILD": JSON.stringify("true"),
    },
  },
});
