import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadContractRegistry, validateContractInventory } from "@aseos/contracts";

import {
  analyzeModuleGraph,
  assertNoViolations,
  evaluatePackageGraph,
  loadArchitecturePolicy,
  loadGovernedPackageRecords,
  validateCanonicalOwners,
} from "./architecture-policy.mjs";

export async function qualifyArchitecture(repositoryRoot = resolve(import.meta.dirname, "../..")) {
  const policy = await loadArchitecturePolicy(repositoryRoot);
  const rootManifest = JSON.parse(await readFile(resolve(repositoryRoot, "package.json"), "utf8"));
  if (rootManifest.devDependencies?.["dependency-cruiser"] !== policy.dependencyCruiserVersion) {
    throw new Error("DEPENDENCY_CRUISER_VERSION_MISMATCH");
  }
  const packageGraph = assertNoViolations(
    "package graph",
    evaluatePackageGraph(await loadGovernedPackageRecords(repositoryRoot, policy), policy),
  );
  const moduleGraph = assertNoViolations(
    "module graph",
    await analyzeModuleGraph(repositoryRoot, policy),
  );
  const registry = await loadContractRegistry(repositoryRoot);
  const inventory = await validateContractInventory(registry);
  const owners = validateCanonicalOwners(inventory.activeContracts, inventory.plannedContracts);

  return {
    schemaVersion: "1.0.0",
    gateStepId: "P1-V04-ARCHITECTURE",
    result: "PASS",
    dependencyGraph: {
      evidenceType: "DependencyGraphResult",
      result: "PASS",
      engine: `dependency-cruiser ${policy.dependencyCruiserVersion}`,
      governedPackages: packageGraph.packageCount,
      packageEdges: packageGraph.edges.length,
      modules: moduleGraph.moduleCount,
      moduleDependencies: moduleGraph.dependencyCount,
      workspaceImportEdges: moduleGraph.workspaceEdges.length,
      cycles: 0,
      dependencyInversions: 0,
    },
    deepImportDenial: {
      evidenceType: "DeepImportDenialResult",
      result: "PASS",
      publicEntriesChecked: packageGraph.publicEntriesChecked,
      deepImports: 0,
      unknownWorkspaceImports: 0,
    },
    duplicateSemanticOwnerDenial: {
      evidenceType: "DuplicateSemanticOwnerDenialResult",
      result: "PASS",
      semantics: owners.semanticCount,
      activeSemantics: owners.activeCount,
      plannedSemantics: owners.plannedCount,
      canonicalOwnerPackages: owners.canonicalOwnerPackages.length,
      duplicates: owners.duplicateCount,
    },
    cycleDenial: { result: "PASS", moduleCycles: 0, packageCycles: 0 },
    dependencyInversionDenial: { result: "PASS", inversions: 0 },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  process.stdout.write(`${JSON.stringify(await qualifyArchitecture(), null, 2)}\n`);
}
