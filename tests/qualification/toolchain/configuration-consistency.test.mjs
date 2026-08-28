import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

describe("repository toolchain consistency", () => {
  const scriptExpectations = new Map([
    [
      "scripts/toolchain/verify-config.mjs",
      { result: "PASS", qualityAggregatorCheck: "p1-o01-toolchain-qualify" },
    ],
    ["scripts/toolchain/verify-versions.mjs", { result: "PASS" }],
    ["scripts/toolchain/verify-scope.mjs", { result: "PASS" }],
  ]);

  for (const [script, expected] of scriptExpectations) {
    test(script, () => {
      const result = spawnSync(process.execPath, [script], {
        cwd: root,
        encoding: "utf8",
        shell: false,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject(expected);
    });
  }
});
