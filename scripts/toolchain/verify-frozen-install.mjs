import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import { reportAndExit, repositoryRoot, run } from "./lib.mjs";

// pnpm uses drive-local stores on Windows. Keep the isolated checkout on the
// repository volume so --offline proves reuse of the store populated by the
// workflow's clean frozen install.
const temporaryRoot = await mkdtemp(join(dirname(repositoryRoot), ".aseos-p1-o01-frozen-"));
const files = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"];

try {
  for (const file of files) {
    await cp(join(repositoryRoot, file), join(temporaryRoot, file));
  }
  const output = run("pnpm", ["install", "--frozen-lockfile", "--offline"], { cwd: temporaryRoot });
  const copiedLockfile = await readFile(join(temporaryRoot, "pnpm-lock.yaml"), "utf8");
  const authorityLockfile = await readFile(join(repositoryRoot, "pnpm-lock.yaml"), "utf8");
  assert.equal(copiedLockfile, authorityLockfile);
  reportAndExit({
    schemaVersion: "1.0.0",
    check: "CLEAN_FROZEN_LOCKFILE_OFFLINE_INSTALL",
    result: "PASS",
    temporaryCheckout: true,
    lockfileUnchanged: true,
    output: output.split(/\r?\n/).at(-1) ?? "",
  });
} finally {
  await rm(temporaryRoot, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}
