import assert from "node:assert/strict";

import { readJson, reportAndExit, run } from "./lib.mjs";

const execution = await readJson("operations/phase-1/executions/p1-o01-execution.json");
const writeScope = await readJson("operations/phase-1/write-scope.json");
const authorityLock = await readJson("operations/phase-1/authority-lock.json");
const operationScope = writeScope.operations.find((item) => item.operationId === "P1-O01");
assert.ok(operationScope, "P1-O01 WRITE_SCOPE is missing");

function globToRegex(pattern) {
  const segments = pattern.split("**").map((segment) =>
    segment
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]"),
  );
  return new RegExp(`^${segments.join(".*")}$`);
}

function matchesAny(path, patterns) {
  return patterns.some((pattern) => globToRegex(pattern).test(path));
}

const baseCommit = process.argv[2] ?? execution.baseCommit;
const tracked = run("git", ["-c", "core.quotepath=false", "diff", "--name-only", baseCommit])
  .split(/\r?\n/)
  .filter(Boolean);
const untracked = run("git", [
  "-c",
  "core.quotepath=false",
  "ls-files",
  "--others",
  "--exclude-standard",
])
  .split(/\r?\n/)
  .filter(Boolean);
const changedPaths = [...new Set([...tracked, ...untracked])].sort();

const violations = [];
for (const path of changedPaths) {
  if (
    matchesAny(path, writeScope.globalDeniedPathGlobs) ||
    matchesAny(path, operationScope.deniedPathGlobs)
  ) {
    violations.push(`DENIED: ${path}`);
    continue;
  }
  if (
    !matchesAny(path, writeScope.globalAllowedPathGlobs) ||
    !matchesAny(path, operationScope.allowedPathGlobs)
  ) {
    violations.push(`NOT_ALLOWED: ${path}`);
  }
}

const immutablePaths = new Set(
  authorityLock.authorityFiles
    .filter((entry) => entry.mutationPolicy === "IMMUTABLE")
    .map((entry) => entry.path),
);
for (const path of changedPaths) {
  if (immutablePaths.has(path)) {
    violations.push(`IMMUTABLE: ${path}`);
  }
}

assert.deepEqual(violations, []);
reportAndExit({
  schemaVersion: "1.0.0",
  check: "P1_O01_WRITE_SCOPE",
  result: "PASS",
  baseCommit,
  changedPaths,
  violations,
});
