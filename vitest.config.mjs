import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@aseos/contracts": fileURLToPath(
        new URL("./packages/contracts/dist/index.js", import.meta.url),
      ),
      "@aseos/policy": fileURLToPath(new URL("./packages/policy/dist/index.js", import.meta.url)),
      "@aseos/persistence": fileURLToPath(
        new URL("./packages/persistence/dist/index.js", import.meta.url),
      ),
      "@aseos/platform": fileURLToPath(
        new URL("./packages/platform/dist/index.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/qualification/toolchain/**/*.test.mjs",
      "tests/qualification/policy/**/*.test.mjs",
      "tests/qualification/persistence/**/*.test.mjs",
      "tests/qualification/control-api/**/*.test.mjs",
      "tests/acceptance/control-api/**/*.test.mjs",
      "tests/fault-injection/persistence/**/*.test.mjs",
      "tests/contract/**/*.test.mjs",
    ],
    passWithNoTests: false,
    reporters: ["default"],
    testTimeout: 10_000,
  },
});
