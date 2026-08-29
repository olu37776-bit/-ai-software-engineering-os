import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import {
  parseWorkspacePackagePaths,
  validateMonorepoTopology,
} from "../../../scripts/toolchain/topology-policy.mjs";

const root = resolve(import.meta.dirname, "../../..");
const toolchainProject = "tests/qualification/toolchain";

function validateFixture(workspace, references, projects, packages) {
  return validateMonorepoTopology({
    workspacePackagePaths: parseWorkspacePackagePaths(workspace),
    buildReferences: references,
    existingProjectPaths: new Set(projects),
    existingPackagePaths: new Set(packages),
  });
}

describe("repository toolchain consistency", () => {
  const scriptExpectations = new Map([
    [
      "scripts/toolchain/verify-config.mjs",
      { result: "PASS", qualityAggregatorCheck: "p1-o01-toolchain-qualify" },
    ],
    ["scripts/toolchain/verify-versions.mjs", { result: "PASS" }],
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

  test("accepts the current empty-workspace topology", async () => {
    const [workspace, buildConfig] = await Promise.all([
      readFile(resolve(root, "pnpm-workspace.yaml"), "utf8"),
      readFile(resolve(root, "tsconfig.build.json"), "utf8").then(JSON.parse),
    ]);
    expect(
      validateFixture(workspace, buildConfig.references, [toolchainProject], []),
    ).toMatchObject({
      workspacePackages: [],
      packageProjectReferences: [],
      nonPackageProjectReferences: [toolchainProject],
      projectReferences: [toolchainProject],
    });
  });

  test("accepts a real generic non-package project in the authority build", () => {
    const genericProject = "tests/architecture";
    expect(
      validateFixture(
        "packages: []\n",
        [{ path: "./tests/qualification/toolchain" }, { path: "./tests/architecture" }],
        [toolchainProject, genericProject],
        [],
      ),
    ).toMatchObject({
      workspacePackages: [],
      packageProjectReferences: [],
      nonPackageProjectReferences: [toolchainProject, genericProject],
      projectReferences: [toolchainProject, genericProject],
    });
  });

  test("accepts a future workspace package when the authority build contains the same project", () => {
    expect(
      validateFixture(
        "packages:\n  - packages/contracts\n",
        [{ path: "./tests/qualification/toolchain" }, { path: "./packages/contracts" }],
        [toolchainProject, "packages/contracts"],
        ["packages/contracts"],
      ),
    ).toMatchObject({
      workspacePackages: ["packages/contracts"],
      packageProjectReferences: ["packages/contracts"],
      nonPackageProjectReferences: [toolchainProject],
    });
  });

  test("fails closed when a workspace package is absent from the authority build", () => {
    expect(() =>
      validateFixture(
        "packages:\n  - packages/contracts\n",
        [{ path: "./tests/qualification/toolchain" }],
        [toolchainProject, "packages/contracts"],
        ["packages/contracts"],
      ),
    ).toThrow("WORKSPACE_PACKAGE_MISSING_BUILD_REFERENCE");
  });

  test("fails closed when a package build reference is absent from the workspace", () => {
    expect(() =>
      validateFixture(
        "packages: []\n",
        [{ path: "./tests/qualification/toolchain" }, { path: "./packages/contracts" }],
        [toolchainProject, "packages/contracts"],
        ["packages/contracts"],
      ),
    ).toThrow("PACKAGE_BUILD_REFERENCE_OUTSIDE_WORKSPACE");
  });

  test.each([
    [
      "duplicate workspace package",
      "packages:\n  - packages/contracts\n  - packages/contracts\n",
      [{ path: "./tests/qualification/toolchain" }, { path: "./packages/contracts" }],
      "DUPLICATE_WORKSPACE_PACKAGE",
    ],
    [
      "duplicate build reference",
      "packages: []\n",
      [{ path: "./tests/qualification/toolchain" }, { path: "./tests/qualification/toolchain" }],
      "DUPLICATE_BUILD_REFERENCE",
    ],
    [
      "absolute workspace path",
      "packages:\n  - /packages/contracts\n",
      [{ path: "./tests/qualification/toolchain" }],
      "UNSAFE_WORKSPACE_PACKAGE_PATH",
    ],
    [
      "parent traversal workspace path",
      "packages:\n  - ../packages/contracts\n",
      [{ path: "./tests/qualification/toolchain" }],
      "UNSAFE_WORKSPACE_PACKAGE_PATH",
    ],
    [
      "absolute build reference",
      "packages: []\n",
      [{ path: "./tests/qualification/toolchain" }, { path: "/packages/contracts" }],
      "NON_CANONICAL_BUILD_REFERENCE",
    ],
    [
      "parent traversal build reference",
      "packages: []\n",
      [{ path: "./tests/qualification/toolchain" }, { path: "./../outside" }],
      "UNSAFE_BUILD_REFERENCE_PATH",
    ],
    [
      "glob workspace path",
      "packages:\n  - packages/*\n",
      [{ path: "./tests/qualification/toolchain" }],
      "UNSAFE_WORKSPACE_PACKAGE_PATH",
    ],
    [
      "backslash build reference",
      "packages: []\n",
      [{ path: "./tests/qualification/toolchain" }, { path: ".\\packages\\contracts" }],
      "NON_CANONICAL_BUILD_REFERENCE",
    ],
  ])("fails closed for %s", (_name, workspace, references, error) => {
    expect(() =>
      validateFixture(
        workspace,
        references,
        [toolchainProject, "packages/contracts"],
        ["packages/contracts"],
      ),
    ).toThrow(error);
  });

  test("fails closed for malformed and non-canonical references", () => {
    expect(() =>
      validateFixture("packages: []\n", [{ path: "tests/qualification/toolchain" }], [], []),
    ).toThrow("NON_CANONICAL_BUILD_REFERENCE");
    expect(() =>
      validateFixture(
        "packages: []\n",
        [{ path: "./tests/qualification/toolchain", extra: true }],
        [],
        [],
      ),
    ).toThrow("MALFORMED_BUILD_REFERENCE");
    expect(() => parseWorkspacePackagePaths("packages: [packages/contracts]\n")).toThrow(
      "MALFORMED_WORKSPACE_PACKAGES_DECLARATION",
    );
  });

  test("fails closed when a declared package or project does not exist", () => {
    const workspace = "packages:\n  - packages/contracts\n";
    const references = [
      { path: "./tests/qualification/toolchain" },
      { path: "./packages/contracts" },
    ];
    expect(() =>
      validateFixture(workspace, references, [toolchainProject], ["packages/contracts"]),
    ).toThrow("BUILD_REFERENCE_PROJECT_MISSING");
    expect(() =>
      validateFixture(workspace, references, [toolchainProject, "packages/contracts"], []),
    ).toThrow("WORKSPACE_PACKAGE_MANIFEST_MISSING");
  });
});
