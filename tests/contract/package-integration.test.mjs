import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, test } from "vitest";

import { repositoryRoot } from "./helpers.mjs";

describe("contracts package authority integration", () => {
  test("is ESM-only, composite and exposed through its package public entry", async () => {
    const packageRoot = resolve(repositoryRoot, "packages/contracts");
    const manifest = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
    const tsconfig = JSON.parse(await readFile(resolve(packageRoot, "tsconfig.json"), "utf8"));
    expect(manifest).toMatchObject({
      name: "@aseos/contracts",
      type: "module",
      exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
    });
    expect(tsconfig.compilerOptions).toMatchObject({
      composite: true,
      rootDir: "src",
      outDir: "dist",
    });

    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        'import("@aseos/contracts").then((api) => { if (typeof api.loadContractRegistry !== "function") process.exit(2); });',
      ],
      { cwd: packageRoot, encoding: "utf8", shell: false },
    );
    expect(result.status, result.stderr).toBe(0);
  });
});
