import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // "server-only" throws unconditionally on import outside of Next's own
      // bundler (which swaps it for a no-op in server bundles) — it's a
      // marker package, not something with real behavior to test, so it's
      // safe to alias away here.
      "server-only": path.resolve(__dirname, "test/mocks/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/integration/**/*.test.ts"],
  },
});
