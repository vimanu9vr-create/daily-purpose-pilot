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
    /**
     * The second pattern reaches into the edge functions.
     *
     * Those run on Deno and cannot be imported here — `Deno.serve` at the top
     * level and remote `https://` imports both fail under Node. So each
     * function with logic worth testing keeps that logic in a sibling module
     * with no Deno globals and no imports (`fanout.ts` is the first), and the
     * Deno entrypoint imports it. Supabase deploys a function directory as one
     * bundle, so the split costs nothing at runtime.
     *
     * This matters because the untested half is where the expensive bugs have
     * been. The morning send looped serially over an unbounded fetch for
     * months: invisible at twelve users, fatal at ten thousand, and no test
     * could reach it.
     */
    include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
  },
});
