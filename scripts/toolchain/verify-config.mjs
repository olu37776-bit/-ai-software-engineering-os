import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import { normalizeUtf8Lf, readJson, reportAndExit, repositoryRoot } from "./lib.mjs";

const packageManifest = await readJson("package.json");
const toolchain = await readJson("toolchain/toolchain.json");
const baseConfig = await readJson("tsconfig.base.json");
const buildConfig = await readJson("tsconfig.build.json");
const workspace = normalizeUtf8Lf(
  await readFile(resolve(repositoryRoot, "pnpm-workspace.yaml"), "utf8"),
);
const npmrc = await readFile(resolve(repositoryRoot, ".npmrc"), "utf8");
const workflow = normalizeUtf8Lf(
  await readFile(resolve(repositoryRoot, ".github/workflows/quality.yml"), "utf8"),
);
const qualityAggregatorCheck = "p1-o01-toolchain-qualify";

const requiredCompilerOptions = {
  target: "ES2025",
  lib: ["ES2025"],
  module: "NodeNext",
  moduleResolution: "NodeNext",
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noImplicitOverride: true,
  noPropertyAccessFromIndexSignature: true,
  useUnknownInCatchVariables: true,
  noFallthroughCasesInSwitch: true,
  verbatimModuleSyntax: true,
  isolatedDeclarations: true,
  noEmitOnError: true,
  skipLibCheck: false,
};

for (const [key, expected] of Object.entries(requiredCompilerOptions)) {
  assert.deepEqual(baseConfig.compilerOptions[key], expected, `tsconfig.base.json: ${key}`);
}
assert.deepEqual(buildConfig.references, [{ path: "./tests/qualification/toolchain" }]);
assert.match(packageManifest.scripts.build, /^tsc -b /);
assert.equal(toolchain.authority.buildCommand, `pnpm exec ${packageManifest.scripts.build}`);

assert.match(workspace, /^packages: \[\]$/m);
assert.match(workspace, /^allowBuilds:\n\s{2}protobufjs: true$/m);
assert.match(workspace, /^blockExoticSubdeps: true$/m);
assert.match(workspace, /^minimumReleaseAge: 1440$/m);
assert.doesNotMatch(npmrc, /(?:token|password|_auth)/i);

assert.match(workflow, /ubuntu-24\.04/);
assert.match(workflow, /windows-2025/);
assert.match(workflow, /node-version: 24\.19\.0/);
assert.match(workflow, /pnpm@11\.24\.0/);
assert.match(workflow, /pnpm install --frozen-lockfile/);
assert.match(workflow, /fetch-depth: 0/);
assert.match(workflow, new RegExp(`^ {2}${qualityAggregatorCheck}:$`, "m"));
assert.match(workflow, new RegExp(`^ {4}name: ${qualityAggregatorCheck}$`, "m"));
assert.doesNotMatch(workflow, /^ {2}verify:$/m);
assert.doesNotMatch(workflow, /^ {4}name: verify$/m);
for (const [action, sha] of Object.entries(toolchain.workflowActions)) {
  assert.match(workflow, new RegExp(`${action.replace("/", "\\/")}@${sha}`));
}

const disallowedExtensions = new Set([".cjs", ".cts"]);
const disallowedModules = [];
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "artifacts", "node_modules"].includes(entry.name)) {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
    } else if (disallowedExtensions.has(extname(entry.name))) {
      disallowedModules.push(path);
    }
  }
}
await scan(repositoryRoot);
assert.deepEqual(disallowedModules, []);

reportAndExit({
  schemaVersion: "1.0.0",
  check: "TOOLCHAIN_CONFIGURATION_CONSISTENCY",
  result: "PASS",
  authorityBuild: packageManifest.scripts.build,
  projectReferences: buildConfig.references.length,
  esmOnly: true,
  qualityAggregatorCheck,
  dependencyBuildPolicy: toolchain.packageManager.dependencyBuildPolicy,
  dependencyBuildAllowlist: toolchain.packageManager.dependencyBuildAllowlist,
});
