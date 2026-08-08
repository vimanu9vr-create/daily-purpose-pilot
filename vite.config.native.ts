import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * Build config for the native (Capacitor) app.
 *
 * The web build server-renders through Nitro. A native app can't — Capacitor
 * serves files from the device with no server behind them — so this produces a
 * pure client bundle instead:
 *
 *   no nitro plugin       skip the server build entirely
 *   spa.enabled           emit a static shell that boots the router on device
 *   maskPath "/app"       the shell is prerendered from /app, which is where
 *                         the native app always starts
 *
 * Kept as a separate file so the web deploy is completely untouched.
 * Build with: npm run build:native
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  return {
    define: {
      ...define,
      // Lets the app branch on packaging without sniffing the user agent.
      "import.meta.env.VITE_NATIVE_BUILD": JSON.stringify("true"),
    },
    css: { transformer: "lightningcss" as const },
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    build: {
      outDir: "dist-native",
      emptyOutDir: true,
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
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
      }),
      viteReact(),
    ],
  };
});
