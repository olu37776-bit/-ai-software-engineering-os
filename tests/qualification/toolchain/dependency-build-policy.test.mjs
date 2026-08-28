import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

describe("dependency lifecycle policy", () => {
  test("does not execute an unallowlisted dependency install script", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "aseos-build-policy-"));
    const dependency = join(fixture, "dependency");
    const marker = join(fixture, "UNAUTHORIZED_BUILD_SCRIPT_RAN");

    try {
      await import("node:fs/promises").then(({ mkdir }) => mkdir(dependency));
      await writeFile(
        join(fixture, "package.json"),
        JSON.stringify({
          name: "policy-fixture",
          private: true,
          dependencies: { "scripted-dependency": "file:./dependency" },
        }),
      );
      await writeFile(
        join(dependency, "package.json"),
        JSON.stringify({
          name: "scripted-dependency",
          version: "1.0.0",
          scripts: {
            install: `node -e "require('fs').writeFileSync('../UNAUTHORIZED_BUILD_SCRIPT_RAN','bad')"`,
          },
        }),
      );
      await writeFile(join(fixture, ".npmrc"), await readFile(join(root, ".npmrc"), "utf8"));
      await writeFile(
        join(fixture, "pnpm-workspace.yaml"),
        [
          "packages: []",
          "",
          "allowBuilds:",
          "  scripted-dependency: false",
          "blockExoticSubdeps: true",
          "",
        ].join("\n"),
      );

      expect(process.env.npm_execpath).toBeTruthy();
      const result = spawnSync(
        process.execPath,
        [process.env.npm_execpath, "install", "--no-frozen-lockfile"],
        {
          cwd: fixture,
          encoding: "utf8",
          shell: false,
        },
      );
      expect(result.status, result.stderr).toBe(0);
      await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });
});
