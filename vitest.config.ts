import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Kept separate from vite.config.ts on purpose: that one runs through the
 * Lovable preset, which pulls in Nitro and the TanStack Start plugin. Tests
 * need none of that and shouldn't break when the build config changes.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
