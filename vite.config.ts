import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * The web build.
 *
 * This used to be three lines wrapping @lovable.dev/vite-tanstack-config, a
 * preset that assembled all of the below invisibly. It's written out because
 * the app no longer depends on Lovable for anything, and a build config you
 * can't read is a bad thing to be unable to leave.
 *
 * Every plugin here was already a direct dependency; nothing new was
 * installed. What the preset did that this doesn't is the part that only ever
 * mattered inside Lovable's own sandbox: their HMR gate, dev-server bridge and
 * asset proxy.
 *
 * Plugin order is deliberate and matches the preset. tanstackStart must come
 * before viteReact, and nitro is build-only because the dev server has its own.
 */
export default defineConfig(({ command, mode }) => {
  // VITE_* values are baked in at build time, so wherever this is built needs
  // them present — Cloudflare Pages as much as a local .env.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  return {
    define,
    css: { transformer: "lightningcss" as const },
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      // One copy of each of these, or hooks break in ways that are miserable
      // to track down.
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Redirect the bundled server entry to src/server.ts, our SSR error
        // wrapper. nitro builds from this.
        server: { entry: "server" },
        // Stops anything under src/**/server/** being pulled into the client
        // bundle by accident, which is how secrets end up in a browser.
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      ...(command === "build" ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
      viteReact(),
    ],
  };
});
