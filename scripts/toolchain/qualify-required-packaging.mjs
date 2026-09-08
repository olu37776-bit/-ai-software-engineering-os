import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readJson, repositoryRoot, run } from "./lib.mjs";

assert.equal(process.platform, "win32", "REQUIRED_PACKAGING_NEEDS_WINDOWS");
const commit = run("git", ["rev-parse", "HEAD"]);
assert.equal(commit, process.env.TARGET_SHA, "PACKAGING_SUBJECT_MISMATCH");
const output = resolve(process.env.RUNNER_TEMP, "required-packaging");
await mkdir(output, { recursive: true });
const { runtime } = await readJson("scripts/release/windows-runtime-lock.json");
assert.equal(runtime.platform, "win-x64");
const response = await globalThis.fetch(runtime.archiveUrl, {
  signal: globalThis.AbortSignal.timeout(120_000),
});
assert.ok(response.ok, `RUNTIME_DOWNLOAD_FAILED:${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
assert.equal(createHash("sha256").update(bytes).digest("hex"), runtime.sha256);
const archive = resolve(output, "node-win-x64.zip");
await writeFile(archive, bytes);
const artifact = resolve(output, "artifact");
const manifest = await readJson("package.json");
console.log(
  run(process.execPath, [
    "scripts/release/assemble-windows-x64.mjs",
    "--runtime-archive",
    archive,
    "--output",
    artifact,
    "--git-commit",
    commit,
    "--built-at",
    new Date().toISOString(),
    "--build-id",
    `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`,
  ]),
);
console.log(
  run(process.execPath, [
    "scripts/release/verify-manifest.mjs",
    "--artifact-root",
    artifact,
    "--manifest",
    "release-manifest.json",
    "--expected-version",
    manifest.version,
    "--expected-git-commit",
    commit,
    "--toolchain-path",
    "toolchain/toolchain.json",
  ]),
);
console.log(
  run(process.execPath, ["tests/qualification/packaging/clean-windows-startup.test.mjs"], {
    env: {
      ...process.env,
      ASEOS_QUALIFICATION_ARTIFACT: artifact,
      ASEOS_QUALIFICATION_EVIDENCE: resolve(output, "p1-v09-packaging.json"),
      ASEOS_QUALIFICATION_EXPECTED_VERSION: manifest.version,
      ASEOS_QUALIFICATION_EXPECTED_GIT_COMMIT: commit,
      ASEOS_QUALIFICATION_TOOLCHAIN: resolve(repositoryRoot, "toolchain/toolchain.json"),
    },
  }),
);
