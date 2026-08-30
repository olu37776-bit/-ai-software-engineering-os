import { access, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { cruise } from "dependency-cruiser";

const workspaceSpecifier = /^@aseos\/[^/]+$/u;
const workspaceDeepSpecifier = /^(@aseos\/[^/]+)\/.+/u;

export class ArchitecturePolicyError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = "ArchitecturePolicyError";
    this.code = code;
    this.details = details;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function assertString(value, context) {
  if (typeof value !== "string" || value.length === 0) {
    throw new ArchitecturePolicyError("INVALID_POLICY", `${context} must be a non-empty string`);
  }
  return value;
}

function assertStringArray(value, context) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new ArchitecturePolicyError("INVALID_POLICY", `${context} must be a string array`);
  }
  if (sortedUnique(value).length !== value.length) {
    throw new ArchitecturePolicyError("INVALID_POLICY", `${context} must not contain duplicates`);
  }
  return value;
}

export async function loadArchitecturePolicy(repositoryRoot) {
  const path = resolve(repositoryRoot, "tests/architecture/architecture-policy.json");
  const policy = await readJson(path);
  if (policy.schemaVersion !== "1.0.0" || policy.policyId !== "P1-PACKAGE-ARCHITECTURE-1") {
    throw new ArchitecturePolicyError("INVALID_POLICY", "Unexpected architecture policy identity");
  }
  assertString(policy.dependencyCruiserVersion, "dependencyCruiserVersion");
  assertStringArray(policy.sourceRoots, "sourceRoots");
  assertStringArray(policy.excludedPaths, "excludedPaths");
  if (!Array.isArray(policy.packages) || policy.packages.length === 0) {
    throw new ArchitecturePolicyError("INVALID_POLICY", "packages must be a non-empty array");
  }
  const packageNames = new Set();
  const packageRoots = new Set();
  for (const [index, item] of policy.packages.entries()) {
    const name = assertString(item?.name, `packages[${String(index)}].name`);
    const root = assertString(item?.root, `packages[${String(index)}].root`);
    if (typeof item?.required !== "boolean" || typeof item?.publicEntryRequired !== "boolean") {
      throw new ArchitecturePolicyError(
        "INVALID_POLICY",
        `packages[${String(index)}] flags invalid`,
      );
    }
    assertStringArray(
      item?.allowedWorkspaceDependencies,
      `packages[${String(index)}].allowedWorkspaceDependencies`,
    );
    if (packageNames.has(name) || packageRoots.has(root)) {
      throw new ArchitecturePolicyError(
        "INVALID_POLICY",
        `Duplicate package policy: ${name}/${root}`,
      );
    }
    packageNames.add(name);
    packageRoots.add(root);
  }
  if (!Array.isArray(policy.requiredEdges)) {
    throw new ArchitecturePolicyError("INVALID_POLICY", "requiredEdges must be an array");
  }
  for (const edge of policy.requiredEdges) {
    if (!packageNames.has(edge?.from) || !packageNames.has(edge?.to)) {
      throw new ArchitecturePolicyError(
        "INVALID_POLICY",
        "requiredEdges must name governed packages",
      );
    }
  }
  return policy;
}

function dependencySections(manifest) {
  return ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].flatMap(
    (section) =>
      Object.entries(manifest[section] ?? {}).map(([name, version]) => ({
        name,
        section,
        version,
      })),
  );
}

function cyclePaths(edges) {
  const adjacency = new Map();
  for (const edge of edges) {
    const targets = adjacency.get(edge.from) ?? [];
    targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }
  const visited = new Set();
  const active = [];
  const activeSet = new Set();
  const cycles = [];
  function visit(node) {
    if (activeSet.has(node)) {
      const index = active.indexOf(node);
      cycles.push([...active.slice(index), node].join(" -> "));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    active.push(node);
    activeSet.add(node);
    for (const target of [...(adjacency.get(node) ?? [])].sort()) visit(target);
    active.pop();
    activeSet.delete(node);
  }
  for (const node of sortedUnique(edges.flatMap((edge) => [edge.from, edge.to]))) visit(node);
  return sortedUnique(cycles);
}

export function evaluatePackageGraph(packageRecords, policy) {
  const records = new Map(packageRecords.map((record) => [record.manifest.name, record]));
  const policyByName = new Map(policy.packages.map((item) => [item.name, item]));
  const violations = [];
  const edges = [];
  let publicEntriesChecked = 0;
  if (records.size !== packageRecords.length) {
    violations.push({ code: "DUPLICATE_PACKAGE_NAME", subject: "package manifests" });
  }
  for (const packagePolicy of policy.packages) {
    const record = records.get(packagePolicy.name);
    if (!record && packagePolicy.required) {
      violations.push({ code: "MISSING_GOVERNED_PACKAGE", subject: packagePolicy.name });
      continue;
    }
    if (!record) continue;
    if (record.root !== packagePolicy.root || record.manifest.type !== "module") {
      violations.push({ code: "PACKAGE_METADATA_MISMATCH", subject: packagePolicy.name });
    }
    if (
      packagePolicy.publicEntryRequired &&
      (!record.manifest.exports || !record.manifest.exports["."])
    ) {
      violations.push({ code: "MISSING_PUBLIC_ENTRY", subject: packagePolicy.name });
    }
    if (packagePolicy.publicEntryRequired) publicEntriesChecked += 1;
    const exportedSubpaths = Object.keys(record.manifest.exports ?? {}).filter(
      (key) => key !== ".",
    );
    if (exportedSubpaths.length > 0) {
      violations.push({
        code: "PUBLIC_SUBPATH_EXPORT",
        subject: packagePolicy.name,
        details: exportedSubpaths.sort(),
      });
    }
    for (const dependency of dependencySections(record.manifest)) {
      if (!policyByName.has(dependency.name)) continue;
      edges.push({ from: packagePolicy.name, to: dependency.name, source: "manifest" });
      if (!packagePolicy.allowedWorkspaceDependencies.includes(dependency.name)) {
        violations.push({
          code: "DEPENDENCY_INVERSION",
          subject: `${packagePolicy.name} -> ${dependency.name}`,
        });
      }
      if (dependency.version !== "workspace:*") {
        violations.push({
          code: "NON_CANONICAL_WORKSPACE_RANGE",
          subject: `${packagePolicy.name} -> ${dependency.name}`,
        });
      }
    }
  }
  for (const cycle of cyclePaths(edges)) {
    violations.push({ code: "PACKAGE_CYCLE", subject: cycle });
  }
  for (const required of policy.requiredEdges) {
    if (!edges.some((edge) => edge.from === required.from && edge.to === required.to)) {
      violations.push({
        code: "MISSING_REQUIRED_EDGE",
        subject: `${required.from} -> ${required.to}`,
      });
    }
  }
  return {
    edges: edges.sort((left, right) =>
      `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`),
    ),
    packageCount: packageRecords.length,
    publicEntriesChecked,
    violations,
  };
}

export async function loadGovernedPackageRecords(repositoryRoot, policy) {
  const records = [];
  for (const item of policy.packages) {
    const path = resolve(repositoryRoot, item.root, "package.json");
    try {
      await access(path);
    } catch {
      continue;
    }
    records.push({ root: item.root, manifest: await readJson(path) });
  }
  return records;
}

function packageForPath(path, policy) {
  const normalized = path.split(sep).join("/");
  const fixtureMatch = /(?:^|\/)packages\/([^/]+)\//u.exec(normalized);
  if (fixtureMatch) {
    const fixtureName = `@aseos/${fixtureMatch[1]}`;
    if (policy.packages.some((item) => item.name === fixtureName)) return fixtureName;
  }
  const candidates = policy.packages
    .filter(
      (item) =>
        item.root !== "." && (normalized === item.root || normalized.startsWith(`${item.root}/`)),
    )
    .sort((left, right) => right.root.length - left.root.length);
  return candidates[0]?.name ?? "@aseos/repository";
}

function workspaceTarget(specifier, policy) {
  if (!workspaceSpecifier.test(specifier)) return undefined;
  return policy.packages.some((item) => item.name === specifier) ? specifier : null;
}

export function inspectCruiseResult(cruiseResult, policy, { enforceRequiredEdges = true } = {}) {
  if (!cruiseResult || !Array.isArray(cruiseResult.modules)) {
    throw new ArchitecturePolicyError(
      "DEPENDENCY_CRUISER_FAILED",
      "Cruiser returned no module graph",
    );
  }
  const allowedByPackage = new Map(
    policy.packages.map((item) => [item.name, new Set(item.allowedWorkspaceDependencies)]),
  );
  const workspaceEdges = [];
  const violations = [];
  for (const module of cruiseResult.modules) {
    const fromPackage = packageForPath(module.source, policy);
    for (const dependency of module.dependencies ?? []) {
      const specifier = dependency.module;
      const deepMatch = workspaceDeepSpecifier.exec(specifier);
      if (deepMatch) {
        violations.push({ code: "DEEP_IMPORT", subject: `${module.source} -> ${specifier}` });
      }
      const specifierTarget = workspaceTarget(specifier, policy);
      if (specifierTarget === null) {
        violations.push({
          code: "UNKNOWN_WORKSPACE_IMPORT",
          subject: `${module.source} -> ${specifier}`,
        });
      }
      const resolvedTarget = dependency.resolved
        ? packageForPath(dependency.resolved, policy)
        : undefined;
      const targetPackage =
        specifierTarget ||
        (specifier.startsWith(".") && resolvedTarget !== fromPackage ? resolvedTarget : undefined);
      if (targetPackage && targetPackage !== fromPackage) {
        workspaceEdges.push({ from: fromPackage, to: targetPackage, source: module.source });
        if (!allowedByPackage.get(fromPackage)?.has(targetPackage)) {
          violations.push({
            code: "DEPENDENCY_INVERSION",
            subject: `${fromPackage} -> ${targetPackage}`,
          });
        }
      }
      if (dependency.circular) {
        violations.push({
          code: "MODULE_CYCLE",
          subject: `${module.source} -> ${dependency.resolved || specifier}`,
        });
      }
      if (dependency.couldNotResolve && specifier.startsWith(".")) {
        violations.push({
          code: "UNRESOLVED_INTERNAL_IMPORT",
          subject: `${module.source} -> ${specifier}`,
        });
      }
    }
  }
  if (enforceRequiredEdges) {
    for (const required of policy.requiredEdges) {
      if (!workspaceEdges.some((edge) => edge.from === required.from && edge.to === required.to)) {
        violations.push({
          code: "MISSING_REQUIRED_IMPORT",
          subject: `${required.from} -> ${required.to}`,
        });
      }
    }
  }
  return {
    moduleCount: cruiseResult.modules.length,
    dependencyCount: cruiseResult.modules.reduce(
      (count, module) => count + (module.dependencies?.length ?? 0),
      0,
    ),
    workspaceEdges: workspaceEdges.sort((left, right) => left.source.localeCompare(right.source)),
    violations,
  };
}

export async function analyzeModuleGraph(repositoryRoot, policy, options = {}) {
  const roots = options.roots ?? policy.sourceRoots;
  let output;
  try {
    const result = await cruise(roots, {
      baseDir: repositoryRoot,
      parser: "tsc",
      doNotFollow: "(^|/)node_modules/",
      exclude: options.exclude ?? policy.excludedPaths.join("|"),
      progress: { type: "none", maximumLevel: -1 },
    });
    output = result.output;
  } catch (error) {
    throw new ArchitecturePolicyError(
      "DEPENDENCY_CRUISER_FAILED",
      error instanceof Error ? error.message : String(error),
    );
  }
  return inspectCruiseResult(output, policy, options);
}

export function validateCanonicalOwners(activeContracts, plannedContracts) {
  const combined = [...activeContracts, ...plannedContracts];
  const indexes = [
    ["contractId", new Map()],
    ["canonicalName", new Map()],
    ["authorityPath", new Map()],
  ];
  for (const contract of combined) {
    for (const [field, index] of indexes) {
      const value = contract[field];
      if (typeof value !== "string" || value.length === 0) {
        throw new ArchitecturePolicyError("INVALID_SEMANTIC_OWNER", `${field} is missing`);
      }
      const prior = index.get(value);
      if (prior) {
        throw new ArchitecturePolicyError(
          "DUPLICATE_SEMANTIC_OWNER",
          `${field} ${value} is declared by ${prior} and ${contract.canonicalOwner}`,
          { field, value, owners: [prior, contract.canonicalOwner] },
        );
      }
      index.set(value, contract.canonicalOwner);
    }
  }
  return {
    semanticCount: combined.length,
    activeCount: activeContracts.length,
    plannedCount: plannedContracts.length,
    canonicalOwnerPackages: sortedUnique(combined.map((contract) => contract.canonicalOwner)),
    duplicateCount: 0,
  };
}

export function assertNoViolations(check, result) {
  if (result.violations.length > 0) {
    throw new ArchitecturePolicyError(
      "ARCHITECTURE_VIOLATION",
      `${check}: ${JSON.stringify(result.violations)}`,
      { check, violations: result.violations },
    );
  }
  return result;
}

export function repositoryRelative(repositoryRoot, path) {
  return relative(repositoryRoot, resolve(repositoryRoot, path)).split(sep).join("/");
}
