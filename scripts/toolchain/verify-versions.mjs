import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readJson, reportAndExit, repositoryRoot, run, sha256Utf8LfFile } from "./lib.mjs";

const packageManifest = await readJson("package.json");
const toolchain = await readJson("toolchain/toolchain.json");
const lockfile = await readFile(resolve(repositoryRoot, "pnpm-lock.yaml"), "utf8");

const actual = {
  node: process.versions.node,
  pnpm: run("pnpm", ["--version"]),
  typescript: run("pnpm", ["exec", "tsc", "--version"]).replace(/^Version\s+/, ""),
};

assert.deepEqual(actual, {
  node: toolchain.authority.node,
  pnpm: toolchain.authority.pnpm,
  typescript: toolchain.authority.typescript,
});
assert.equal(packageManifest.packageManager, `pnpm@${toolchain.authority.pnpm}`);
assert.equal(packageManifest.engines.node, toolchain.authority.node);
assert.equal(packageManifest.engines.pnpm, toolchain.authority.pnpm);
assert.equal(packageManifest.type, toolchain.authority.packageType);
assert.deepEqual(packageManifest.devDependencies, toolchain.tools);
assert.match(lockfile, /^lockfileVersion: ['"]?9\.0['"]?$/m);

for (const [name, version] of Object.entries(packageManifest.devDependencies)) {
  assert.match(version, /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/, `${name} is not exact`);
}

const lockfileSha256 = await sha256Utf8LfFile("pnpm-lock.yaml");
assert.equal("lockfileSha256" in toolchain.packageManager, false);
assert.match(lockfileSha256, /^[0-9a-f]{64}$/);

reportAndExit({
  schemaVersion: "1.0.0",
  check: "BUILD_VERSION_CONSISTENCY",
  result: "PASS",
  actual,
  lockfileSha256,
  packageManager: packageManifest.packageManager,
});
