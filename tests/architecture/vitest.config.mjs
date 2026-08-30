import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@aseos/contracts": fileURLToPath(
        new URL("../../packages/contracts/dist/index.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/architecture/**/*.test.mjs"],
    exclude: ["tests/architecture/fixtures/**"],
    passWithNoTests: false,
    reporters: ["default"],
    testTimeout: 20_000,
  },
});
