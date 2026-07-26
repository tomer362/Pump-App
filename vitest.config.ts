import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The integrity tests run against a real Postgres — see tests/helpers.ts.
    setupFiles: ["./tests/setup.ts"],
    // The database tests share one Postgres instance and one seeded user, so
    // they must not interleave.
    fileParallelism: false,
    env: { NODE_ENV: "test" },
  },
});
