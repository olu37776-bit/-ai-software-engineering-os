const TOOLCHAIN_QUALIFICATION_PROJECT = "tests/qualification/toolchain";
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9._-]+$/;

function fail(code, detail = "") {
  throw new Error(`${code}${detail ? `: ${detail}` : ""}`);
}

function assertSafeRelativePath(path, label) {
  if (typeof path !== "string" || path.length === 0) {
    fail(`MALFORMED_${label}_PATH`);
  }
  if (
    path.startsWith("/") ||
    path.startsWith("\\") ||
    /^[A-Za-z]:/.test(path) ||
    path.includes("\\")
  ) {
    fail(`UNSAFE_${label}_PATH`, path);
  }
  const segments = path.split("/");
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        !SAFE_PATH_SEGMENT.test(segment),
    )
  ) {
    fail(`UNSAFE_${label}_PATH`, path);
  }
  return path;
}

function normalizeWorkspacePackagePath(path) {
  if (path.startsWith("./")) {
    fail("NON_CANONICAL_WORKSPACE_PACKAGE_PATH", path);
  }
  return assertSafeRelativePath(path, "WORKSPACE_PACKAGE");
}

function normalizeBuildReference(reference) {
  if (
    !reference ||
    typeof reference !== "object" ||
    Array.isArray(reference) ||
    Object.keys(reference).length !== 1 ||
    typeof reference.path !== "string"
  ) {
    fail("MALFORMED_BUILD_REFERENCE");
  }
  if (!reference.path.startsWith("./")) {
    fail("NON_CANONICAL_BUILD_REFERENCE", reference.path);
  }
  return assertSafeRelativePath(reference.path.slice(2), "BUILD_REFERENCE");
}

function assertUnique(paths, label) {
  const seen = new Set();
  for (const path of paths) {
    if (seen.has(path)) {
      fail(`DUPLICATE_${label}`, path);
    }
    seen.add(path);
  }
  return seen;
}

export function parseWorkspacePackagePaths(workspace) {
  if (typeof workspace !== "string") {
    fail("MALFORMED_WORKSPACE_CONFIG");
  }
  const lines = workspace.replace(/\r\n?/g, "\n").split("\n");
  const declarations = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^packages\s*:/.test(line));
  if (declarations.length !== 1) {
    fail("WORKSPACE_PACKAGES_DECLARATION_COUNT", String(declarations.length));
  }

  const [{ line: declaration, index }] = declarations;
  if (declaration === "packages: []") {
    return [];
  }
  if (declaration !== "packages:") {
    fail("MALFORMED_WORKSPACE_PACKAGES_DECLARATION", declaration);
  }

  const packages = [];
  for (const line of lines.slice(index + 1)) {
    if (line.length === 0) {
      continue;
    }
    if (!line.startsWith(" ")) {
      break;
    }
    const match = /^ {2}- (\S.*)$/.exec(line);
    if (!match) {
      fail("MALFORMED_WORKSPACE_PACKAGE_ENTRY", line);
    }
    packages.push(match[1]);
  }
  if (packages.length === 0) {
    fail("EMPTY_BLOCK_WORKSPACE_PACKAGES");
  }
  return packages;
}

export function validateMonorepoTopology({
  workspacePackagePaths,
  buildReferences,
  existingProjectPaths,
  existingPackagePaths,
}) {
  if (!Array.isArray(workspacePackagePaths) || !Array.isArray(buildReferences)) {
    fail("MALFORMED_MONOREPO_TOPOLOGY");
  }
  if (!(existingProjectPaths instanceof Set) || !(existingPackagePaths instanceof Set)) {
    fail("MISSING_TOPOLOGY_EXISTENCE_FACTS");
  }

  const workspacePackages = workspacePackagePaths.map(normalizeWorkspacePackagePath);
  const projectReferences = buildReferences.map(normalizeBuildReference);
  const workspaceSet = assertUnique(workspacePackages, "WORKSPACE_PACKAGE");
  const referenceSet = assertUnique(projectReferences, "BUILD_REFERENCE");

  if (!referenceSet.has(TOOLCHAIN_QUALIFICATION_PROJECT)) {
    fail("MISSING_TOOLCHAIN_QUALIFICATION_REFERENCE", TOOLCHAIN_QUALIFICATION_PROJECT);
  }

  const packageReferences = projectReferences.filter(
    (path) => path !== TOOLCHAIN_QUALIFICATION_PROJECT,
  );
  const packageReferenceSet = new Set(packageReferences);
  const missingBuildReferences = workspacePackages.filter((path) => !packageReferenceSet.has(path));
  if (missingBuildReferences.length > 0) {
    fail("WORKSPACE_PACKAGE_MISSING_BUILD_REFERENCE", missingBuildReferences.join(","));
  }
  const referencesOutsideWorkspace = packageReferences.filter((path) => !workspaceSet.has(path));
  if (referencesOutsideWorkspace.length > 0) {
    fail("PACKAGE_BUILD_REFERENCE_OUTSIDE_WORKSPACE", referencesOutsideWorkspace.join(","));
  }

  const missingProjects = projectReferences.filter((path) => !existingProjectPaths.has(path));
  if (missingProjects.length > 0) {
    fail("BUILD_REFERENCE_PROJECT_MISSING", missingProjects.join(","));
  }
  const missingPackages = workspacePackages.filter((path) => !existingPackagePaths.has(path));
  if (missingPackages.length > 0) {
    fail("WORKSPACE_PACKAGE_MANIFEST_MISSING", missingPackages.join(","));
  }

  return {
    toolchainQualificationProject: TOOLCHAIN_QUALIFICATION_PROJECT,
    workspacePackages,
    packageProjectReferences: packageReferences,
    projectReferences,
  };
}
