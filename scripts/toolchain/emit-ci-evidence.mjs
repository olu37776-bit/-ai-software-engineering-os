import assert from "node:assert/strict";
import { readJson, reportAndExit, run, sha256Utf8LfFile } from "./lib.mjs";

const commit = run("git", ["rev-parse", "HEAD"]);
for (const name of ["TARGET_SHA", "PHASE1_SCOPE_HEAD", "POST_MERGE_QUALIFICATION_TARGET"]) {
  if (process.env[name]) {
    assert.equal(commit, process.env[name], `EVIDENCE_SUBJECT_MISMATCH:${name}`);
  }
}
const toolchain = await readJson("toolchain/toolchain.json");

reportAndExit({
  schemaVersion: "1.0.0",
  evidenceType: "CrossPlatformBuildEvidence",
  result: "PASS",
  commit,
  controllerCommit: process.env.GITHUB_SHA ?? null,
  environment: {
    os: process.platform,
    arch: process.arch,
    node: process.versions.node,
    pnpm: run("pnpm", ["--version"]),
    typescript: run("pnpm", ["exec", "tsc", "--version"]).replace(/^Version\s+/, ""),
    runnerImage: process.env.ImageOS ?? "local",
    runnerImageVersion: process.env.ImageVersion ?? "local",
  },
  lockfileSha256: await sha256Utf8LfFile("pnpm-lock.yaml"),
  authorityBuild: toolchain.authority.buildCommand,
});
