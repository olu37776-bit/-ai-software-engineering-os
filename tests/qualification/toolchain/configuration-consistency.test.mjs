import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

describe("repository toolchain consistency", () => {
  for (const script of [
    "scripts/toolchain/verify-config.mjs",
    "scripts/toolchain/verify-versions.mjs",
    "scripts/toolchain/verify-scope.mjs",
  ]) {
    test(script, () => {
      const result = spawnSync(process.execPath, [script], {
        cwd: root,
        encoding: "utf8",
        shell: false,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ result: "PASS" });
    });
  }
});
