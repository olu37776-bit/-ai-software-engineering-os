import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import {
  analyzeModuleGraph,
  evaluatePackageGraph,
  loadArchitecturePolicy,
  validateCanonicalOwners,
} from "../../scripts/architecture/architecture-policy.mjs";
import { qualifyArchitecture } from "../../scripts/architecture/qualify-architecture.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureRoot = "tests/architecture/fixtures";

async function fixtureJson(name) {
  return JSON.parse(await readFile(resolve(repositoryRoot, fixtureRoot, name), "utf8"));
}

describe("P1-V04-ARCHITECTURE", () => {
  test("qualifies the live package/import graph and canonical owner authorities", async () => {
    await expect(qualifyArchitecture(repositoryRoot)).resolves.toMatchObject({
      gateStepId: "P1-V04-ARCHITECTURE",
      result: "PASS",
      dependencyGraph: { evidenceType: "DependencyGraphResult", result: "PASS" },
      deepImportDenial: { evidenceType: "DeepImportDenialResult", result: "PASS" },
      duplicateSemanticOwnerDenial: {
        evidenceType: "DuplicateSemanticOwnerDenialResult",
        result: "PASS",
      },
      cycleDenial: { result: "PASS" },
      dependencyInversionDenial: { result: "PASS" },
    });
  });

  test("executes dependency-cruiser against a deep import fixture", async () => {
    const policy = await loadArchitecturePolicy(repositoryRoot);
    const result = await analyzeModuleGraph(repositoryRoot, policy, {
      roots: [`${fixtureRoot}/deep-import.mjs`],
      exclude: "(^|/)node_modules/",
      enforceRequiredEdges: false,
    });
    expect(result.violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "DEEP_IMPORT" })]),
    );
  });

  test("rejects a relative import across governed package roots", async () => {
    const policy = await loadArchitecturePolicy(repositoryRoot);
    const result = await analyzeModuleGraph(repositoryRoot, policy, {
      roots: [`${fixtureRoot}/relative-cross-package-deep-import/packages/policy/src/probe.mjs`],
      exclude: "(^|/)node_modules/",
      enforceRequiredEdges: false,
    });
    expect(result.workspaceEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "@aseos/policy", to: "@aseos/contracts" }),
      ]),
    );
    expect(result.violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "DEEP_IMPORT" })]),
    );
  });

  test("executes dependency-cruiser against a real module cycle fixture", async () => {
    const policy = await loadArchitecturePolicy(repositoryRoot);
    const result = await analyzeModuleGraph(repositoryRoot, policy, {
      roots: [`${fixtureRoot}/cycle-a.mjs`, `${fixtureRoot}/cycle-b.mjs`],
      exclude: "(^|/)node_modules/",
      enforceRequiredEdges: false,
    });
    expect(result.violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "MODULE_CYCLE" })]),
    );
  });

  test("executes the dependency direction rule against an inversion fixture", async () => {
    const policy = await loadArchitecturePolicy(repositoryRoot);
    const result = await analyzeModuleGraph(repositoryRoot, policy, {
      roots: [`${fixtureRoot}/inversion/packages/contracts/src/inversion.mjs`],
      exclude: "(^|/)node_modules/",
      enforceRequiredEdges: false,
    });
    expect(result.violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "DEPENDENCY_INVERSION" })]),
    );
  });

  test("automatically applies frozen direction rules to a future policy package", async () => {
    const policy = await loadArchitecturePolicy(repositoryRoot);
    const accepted = await analyzeModuleGraph(repositoryRoot, policy, {
      roots: [`${fixtureRoot}/future-policy-valid/packages/policy/src/valid.mjs`],
      exclude: "(^|/)node_modules/",
      enforceRequiredEdges: false,
    });
    expect(accepted.workspaceEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "@aseos/policy", to: "@aseos/contracts" }),
      ]),
    );
    expect(accepted.violations).toEqual([]);

    const rejected = await analyzeModuleGraph(repositoryRoot, policy, {
      roots: [`${fixtureRoot}/future-policy-inversion/packages/policy/src/inversion.mjs`],
      exclude: "(^|/)node_modules/",
      enforceRequiredEdges: false,
    });
    expect(rejected.violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "DEPENDENCY_INVERSION" })]),
    );
  });

  test("fails closed on package cycles and disallowed package edges", async () => {
    const policy = await loadArchitecturePolicy(repositoryRoot);
    const packageRecords = [
      {
        root: "packages/contracts",
        manifest: {
          name: "@aseos/contracts",
          type: "module",
          exports: { ".": "./dist/index.js" },
          dependencies: { "@aseos/repository": "workspace:*" },
        },
      },
      {
        root: ".",
        manifest: {
          name: "@aseos/repository",
          type: "module",
          dependencies: { "@aseos/contracts": "workspace:*" },
        },
      },
    ];
    expect(evaluatePackageGraph(packageRecords, policy).violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "DEPENDENCY_INVERSION" }),
        expect.objectContaining({ code: "PACKAGE_CYCLE" }),
      ]),
    );
  });

  test("fails closed on a governed root with a non-canonical package name", async () => {
    const policy = await loadArchitecturePolicy(repositoryRoot);
    const packageRecords = [
      {
        root: "packages/contracts",
        manifest: {
          name: "@aseos/contracts",
          type: "module",
          exports: { ".": "./dist/index.js" },
        },
      },
      {
        root: "packages/policy",
        manifest: {
          name: "@aseos/not-policy",
          type: "module",
          dependencies: { "@aseos/windows-process-restricted": "^0.1.0" },
        },
      },
      {
        root: ".",
        manifest: {
          name: "@aseos/repository",
          type: "module",
          dependencies: { "@aseos/contracts": "workspace:*" },
        },
      },
    ];
    expect(evaluatePackageGraph(packageRecords, policy).violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PACKAGE_NAME_MISMATCH" }),
        expect.objectContaining({ code: "MISSING_PUBLIC_ENTRY" }),
        expect.objectContaining({ code: "DEPENDENCY_INVERSION" }),
        expect.objectContaining({ code: "NON_CANONICAL_WORKSPACE_RANGE" }),
      ]),
    );
  });

  test("fails closed on duplicate canonical semantic ownership", async () => {
    const fixture = await fixtureJson("duplicate-semantic-owner.json");
    expect(() => validateCanonicalOwners(fixture.active, fixture.planned)).toThrow(
      /DUPLICATE_SEMANTIC_OWNER/u,
    );
  });
});
