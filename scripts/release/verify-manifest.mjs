import { parseArgs, TextDecoder } from "node:util";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalJsonBytes, compareCodeUnits, sha256Bytes, sha256File } from "./canonical.mjs";

const RELEASE_SCHEMA_ID = "urn:aseos:release-schema:release-manifest:1.0.0";
const SEMVER =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const GIT_COMMIT = /^[0-9a-f]{40}$/u;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const RELEASE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(RELEASE_DIRECTORY, "../..");

export class ManifestVerificationError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "ManifestVerificationError";
    this.code = code;
  }
}

function hasUnsafePathCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 0x1f || codePoint === 0x7f || character === ":";
  });
}

function fail(code, message) {
  throw new ManifestVerificationError(code, message);
}

function assertExactKeys(value, required, location) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("MANIFEST_SCHEMA_INVALID", `${location} must be an object`);
  }
  const actual = Object.keys(value).sort(compareCodeUnits);
  const expected = [...required].sort(compareCodeUnits);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail("MANIFEST_SCHEMA_INVALID", `${location} keys must be exactly ${expected.join(", ")}`);
  }
}

function assertString(value, location, expression, description) {
  if (typeof value !== "string" || !expression.test(value)) {
    fail("MANIFEST_SCHEMA_INVALID", `${location} must be ${description}`);
  }
}

export function assertReleasePath(path, location = "path") {
  if (typeof path !== "string" || path.length === 0 || path.length > 1024) {
    fail("UNSAFE_PAYLOAD_PATH", `${location} must contain 1..1024 characters`);
  }
  if (path !== path.normalize("NFC")) {
    fail("UNSAFE_PAYLOAD_PATH", `${location} must use NFC Unicode normalization`);
  }
  if (
    isAbsolute(path) ||
    path.startsWith("/") ||
    /^[A-Za-z]:/u.test(path) ||
    path.includes("\\") ||
    hasUnsafePathCharacter(path)
  ) {
    fail("UNSAFE_PAYLOAD_PATH", `${location} is not a strict relative POSIX path`);
  }
  const segments = path.split("/");
  for (const segment of segments) {
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      segment.endsWith(".") ||
      segment.endsWith(" ") ||
      WINDOWS_RESERVED.test(segment)
    ) {
      fail("UNSAFE_PAYLOAD_PATH", `${location} has an unsafe path segment`);
    }
  }
  return path;
}

function assertBoundPayload(value, location) {
  assertExactKeys(value, ["path", "sha256"], location);
  assertReleasePath(value.path, `${location}.path`);
  assertString(value.sha256, `${location}.sha256`, SHA256, "a lowercase SHA-256");
}

function assertManifestShape(manifest) {
  assertExactKeys(
    manifest,
    [
      "$schema",
      "schemaVersion",
      "frameworkVersion",
      "gitCommit",
      "buildId",
      "builtAt",
      "artifact",
      "platform",
      "toolchain",
      "runtime",
      "contracts",
      "configSchemaVersion",
      "stateSchemaVersion",
      "supportedUpgradeSources",
      "sbom",
      "provenance",
      "payload",
    ],
    "manifest",
  );
  if (manifest.$schema !== RELEASE_SCHEMA_ID || manifest.schemaVersion !== "1.0.0") {
    fail("MANIFEST_SCHEMA_INVALID", "manifest schema identity is not supported");
  }
  assertString(manifest.frameworkVersion, "frameworkVersion", SEMVER, "SemVer");
  assertString(manifest.gitCommit, "gitCommit", GIT_COMMIT, "a lowercase 40-hex commit");
  if (typeof manifest.buildId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/u.test(manifest.buildId)) {
    fail("MANIFEST_SCHEMA_INVALID", "buildId is invalid");
  }
  if (
    typeof manifest.builtAt !== "string" ||
    !RFC3339.test(manifest.builtAt) ||
    !Number.isFinite(Date.parse(manifest.builtAt))
  ) {
    fail("MANIFEST_SCHEMA_INVALID", "builtAt must be a valid RFC 3339 timestamp");
  }

  assertExactKeys(manifest.artifact, ["kind", "productionApproved"], "artifact");
  if (
    manifest.artifact.kind !== "NON_PRODUCTION_QUALIFICATION" ||
    manifest.artifact.productionApproved !== false
  ) {
    fail("MANIFEST_SCHEMA_INVALID", "artifact must remain explicitly non-production");
  }
  assertExactKeys(manifest.platform, ["id", "os", "arch"], "platform");
  if (
    manifest.platform.id !== "windows-x64" ||
    manifest.platform.os !== "windows" ||
    manifest.platform.arch !== "x64"
  ) {
    fail("MANIFEST_SCHEMA_INVALID", "platform must be windows-x64");
  }
  assertExactKeys(manifest.toolchain, ["node", "pnpm", "typescript"], "toolchain");
  for (const name of ["node", "pnpm", "typescript"]) {
    assertString(manifest.toolchain[name], `toolchain.${name}`, SEMVER, "SemVer");
  }
  assertExactKeys(
    manifest.runtime,
    ["distribution", "version", "platform", "archiveUrl", "archiveSha256", "executable"],
    "runtime",
  );
  if (manifest.runtime.distribution !== "node") {
    fail("MANIFEST_SCHEMA_INVALID", "runtime.distribution must be node");
  }
  assertString(manifest.runtime.version, "runtime.version", SEMVER, "SemVer");
  if (manifest.runtime.platform !== "win-x64") {
    fail("MANIFEST_SCHEMA_INVALID", "runtime.platform must be win-x64");
  }
  if (
    typeof manifest.runtime.archiveUrl !== "string" ||
    !/^https:\/\/nodejs\.org\/dist\//u.test(manifest.runtime.archiveUrl)
  ) {
    fail("MANIFEST_SCHEMA_INVALID", "runtime.archiveUrl must use the official HTTPS origin");
  }
  assertString(
    manifest.runtime.archiveSha256,
    "runtime.archiveSha256",
    SHA256,
    "a lowercase SHA-256",
  );
  assertReleasePath(manifest.runtime.executable, "runtime.executable");

  if (
    manifest.contracts === null ||
    typeof manifest.contracts !== "object" ||
    Array.isArray(manifest.contracts)
  ) {
    fail("MANIFEST_SCHEMA_INVALID", "contracts must be an object");
  }
  for (const [name, version] of Object.entries(manifest.contracts)) {
    if (!/^[A-Za-z][A-Za-z0-9._-]{0,127}$/u.test(name)) {
      fail("MANIFEST_SCHEMA_INVALID", `invalid contract name ${name}`);
    }
    assertString(version, `contracts.${name}`, SEMVER, "SemVer");
  }
  assertString(manifest.configSchemaVersion, "configSchemaVersion", SEMVER, "SemVer");
  assertString(manifest.stateSchemaVersion, "stateSchemaVersion", SEMVER, "SemVer");
  if (!Array.isArray(manifest.supportedUpgradeSources)) {
    fail("MANIFEST_SCHEMA_INVALID", "supportedUpgradeSources must be an array");
  }
  const upgradeSources = new Set();
  for (const version of manifest.supportedUpgradeSources) {
    assertString(version, "supportedUpgradeSources[]", SEMVER, "SemVer");
    if (upgradeSources.has(version)) {
      fail("MANIFEST_SCHEMA_INVALID", `duplicate supported upgrade source ${version}`);
    }
    upgradeSources.add(version);
  }
  const sortedSources = [...manifest.supportedUpgradeSources].sort(compareCodeUnits);
  if (sortedSources.some((version, index) => version !== manifest.supportedUpgradeSources[index])) {
    fail("NON_CANONICAL_MANIFEST", "supportedUpgradeSources must use code-unit order");
  }
  assertBoundPayload(manifest.sbom, "sbom");
  assertBoundPayload(manifest.provenance, "provenance");
  if (!Array.isArray(manifest.payload) || manifest.payload.length === 0) {
    fail("MANIFEST_SCHEMA_INVALID", "payload must be a non-empty array");
  }
  const paths = new Set();
  for (const [index, entry] of manifest.payload.entries()) {
    const location = `payload[${index}]`;
    assertExactKeys(entry, ["path", "sha256", "sizeBytes"], location);
    assertReleasePath(entry.path, `${location}.path`);
    assertString(entry.sha256, `${location}.sha256`, SHA256, "a lowercase SHA-256");
    if (!Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 0) {
      fail("MANIFEST_SCHEMA_INVALID", `${location}.sizeBytes must be a non-negative safe integer`);
    }
    if (entry.path === "release-manifest.json") {
      fail("SELF_REFERENTIAL_MANIFEST", "payload must not contain release-manifest.json");
    }
    if (paths.has(entry.path)) {
      fail("DUPLICATE_PAYLOAD_PATH", entry.path);
    }
    paths.add(entry.path);
  }
  const sortedPaths = [...paths].sort(compareCodeUnits);
  if (sortedPaths.some((path, index) => path !== manifest.payload[index].path)) {
    fail("NON_CANONICAL_MANIFEST", "payload must use code-unit path order");
  }
  const byPath = new Map(manifest.payload.map((entry) => [entry.path, entry]));
  for (const [name, binding] of [
    ["sbom", manifest.sbom],
    ["provenance", manifest.provenance],
  ]) {
    const entry = byPath.get(binding.path);
    if (!entry || entry.sha256 !== binding.sha256) {
      fail("BOUND_PAYLOAD_MISMATCH", `${name} does not match its payload entry`);
    }
  }
  if (!byPath.has(manifest.runtime.executable)) {
    fail("BOUND_PAYLOAD_MISMATCH", "runtime executable is absent from payload");
  }
}

async function readCanonicalJson(path, location) {
  const bytes = await readFile(path);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    fail("INVALID_JSON", `${location}: ${error.message}`);
  }
  const expected = canonicalJsonBytes(value);
  if (!bytes.equals(expected)) {
    fail("NON_CANONICAL_JSON", `${location} must be canonical UTF-8 JSON with one LF`);
  }
  return { value, bytes };
}

async function assertNoLinkComponents(root, relativePath) {
  let current = root;
  for (const segment of relativePath.split("/")) {
    current = resolve(current, segment);
    const status = await lstat(current);
    if (status.isSymbolicLink()) {
      fail("UNSAFE_PAYLOAD_PATH", `${relativePath} traverses a symbolic link or junction`);
    }
  }
}

async function resolvePayloadFile(root, path) {
  const candidate = resolve(root, ...path.split("/"));
  const fromRoot = relative(root, candidate);
  if (
    fromRoot === "" ||
    fromRoot === ".." ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    fail("UNSAFE_PAYLOAD_PATH", `${path} escapes artifact root`);
  }
  try {
    await assertNoLinkComponents(root, path);
    const canonicalRoot = await realpath(root);
    const canonicalFile = await realpath(candidate);
    const fromCanonicalRoot = relative(canonicalRoot, canonicalFile);
    if (
      fromCanonicalRoot === "" ||
      fromCanonicalRoot === ".." ||
      fromCanonicalRoot.startsWith(`..${sep}`) ||
      isAbsolute(fromCanonicalRoot)
    ) {
      fail("UNSAFE_PAYLOAD_PATH", `${path} resolves outside artifact root`);
    }
    return candidate;
  } catch (error) {
    if (error instanceof ManifestVerificationError) {
      throw error;
    }
    if (error?.code === "ENOENT") {
      fail("RELEASE_PAYLOAD_MISSING", path);
    }
    fail("RELEASE_PAYLOAD_UNREADABLE", `${path}: ${error.code ?? error.message}`);
  }
}

function semanticFail(code, location, message) {
  fail(code, `${location}: ${message}`);
}

function assertSemanticKeys(value, required, location, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    semanticFail(code, location, "must be an object");
  }
  const actual = Object.keys(value).sort(compareCodeUnits);
  const expected = [...required].sort(compareCodeUnits);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    semanticFail(code, location, `keys must be exactly ${expected.join(", ")}`);
  }
}

async function readBoundPayloadBytes(root, payloadByPath, path) {
  const descriptor = payloadByPath.get(path);
  if (descriptor === undefined) {
    fail("BOUND_PAYLOAD_MISMATCH", `${path} is absent from payload`);
  }
  const file = await resolvePayloadFile(root, path);
  const bytes = await readFile(file);
  const digest = sha256Bytes(bytes);
  if (bytes.length !== descriptor.sizeBytes) {
    fail("RELEASE_PAYLOAD_SIZE_MISMATCH", `${path}: ${bytes.length} != ${descriptor.sizeBytes}`);
  }
  if (digest !== descriptor.sha256) {
    fail("RELEASE_PAYLOAD_HASH_MISMATCH", `${path}: ${digest} != ${descriptor.sha256}`);
  }
  return bytes;
}

async function readBoundCanonicalJson(root, payloadByPath, path, code) {
  const bytes = await readBoundPayloadBytes(root, payloadByPath, path);
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    semanticFail(code, path, `invalid UTF-8 JSON: ${error.message}`);
  }
  if (!bytes.equals(canonicalJsonBytes(value))) {
    semanticFail(code, path, "must be canonical UTF-8 JSON with one LF");
  }
  return value;
}

function assertQualificationPackageFields(value, location, code, expectedDownloadLocation) {
  if (value.downloadLocation !== expectedDownloadLocation || value.filesAnalyzed !== false) {
    semanticFail(code, location, "downloadLocation/filesAnalyzed are not qualification-safe");
  }
  if (value.licenseDeclared !== "NOASSERTION" || value.licenseConcluded !== "NOASSERTION") {
    semanticFail(code, location, "license fields must remain NOASSERTION");
  }
}

async function verifySbomSemantics(root, manifest, payloadByPath) {
  const code = "RELEASE_SBOM_INVALID";
  if (manifest.sbom.path !== "metadata/sbom.spdx.json") {
    semanticFail(code, "sbom.path", "must be metadata/sbom.spdx.json");
  }
  const sbom = await readBoundCanonicalJson(root, payloadByPath, manifest.sbom.path, code);
  assertSemanticKeys(
    sbom,
    [
      "spdxVersion",
      "dataLicense",
      "SPDXID",
      "name",
      "documentNamespace",
      "creationInfo",
      "packages",
    ],
    "sbom",
    code,
  );
  if (
    sbom.spdxVersion !== "SPDX-2.3" ||
    sbom.dataLicense !== "CC0-1.0" ||
    sbom.SPDXID !== "SPDXRef-DOCUMENT" ||
    sbom.name !== `ASEOS-${manifest.frameworkVersion}-windows-x64-qualification` ||
    sbom.documentNamespace !==
      `https://aseos.invalid/spdx/${manifest.gitCommit}/${manifest.buildId}`
  ) {
    semanticFail(code, "sbom", "document identity does not match the release manifest");
  }
  assertSemanticKeys(sbom.creationInfo, ["created", "creators"], "sbom.creationInfo", code);
  if (
    sbom.creationInfo.created !== manifest.builtAt ||
    !Array.isArray(sbom.creationInfo.creators) ||
    sbom.creationInfo.creators.length !== 1 ||
    sbom.creationInfo.creators[0] !== "Tool: ASEOS deterministic release assembler"
  ) {
    semanticFail(code, "sbom.creationInfo", "creation identity does not match the build");
  }
  if (!Array.isArray(sbom.packages) || sbom.packages.length === 0) {
    semanticFail(code, "sbom.packages", "must be a non-empty array");
  }

  const nodePackages = sbom.packages.filter((entry) => entry?.SPDXID === "SPDXRef-Package-Node");
  if (nodePackages.length !== 1) {
    semanticFail(code, "sbom.packages", "must contain exactly one Node runtime package");
  }
  const nodePackage = nodePackages[0];
  assertSemanticKeys(
    nodePackage,
    [
      "SPDXID",
      "name",
      "versionInfo",
      "downloadLocation",
      "filesAnalyzed",
      "licenseConcluded",
      "licenseDeclared",
      "checksums",
    ],
    "sbom.packages[node]",
    code,
  );
  assertQualificationPackageFields(
    nodePackage,
    "sbom.packages[node]",
    code,
    manifest.runtime.archiveUrl,
  );
  if (
    nodePackage.name !== "node" ||
    nodePackage.versionInfo !== manifest.runtime.version ||
    nodePackage.downloadLocation !== manifest.runtime.archiveUrl ||
    !Array.isArray(nodePackage.checksums) ||
    nodePackage.checksums.length !== 1
  ) {
    semanticFail(code, "sbom.packages[node]", "runtime identity does not match manifest.runtime");
  }
  assertSemanticKeys(
    nodePackage.checksums[0],
    ["algorithm", "checksumValue"],
    "sbom.packages[node].checksums[0]",
    code,
  );
  if (
    nodePackage.checksums[0].algorithm !== "SHA256" ||
    nodePackage.checksums[0].checksumValue !== manifest.runtime.archiveSha256
  ) {
    semanticFail(code, "sbom.packages[node].checksums[0]", "runtime digest does not match");
  }

  const expectedPackages = [];
  for (const entry of manifest.payload.filter(({ path }) => path.endsWith("/package.json"))) {
    const bytes = await readBoundPayloadBytes(root, payloadByPath, entry.path);
    let packageManifest;
    try {
      packageManifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch (error) {
      semanticFail(code, entry.path, `invalid package metadata: ${error.message}`);
    }
    if (
      typeof packageManifest?.name !== "string" ||
      !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(packageManifest.name) ||
      typeof packageManifest?.version !== "string" ||
      !SEMVER.test(packageManifest.version)
    ) {
      semanticFail(code, entry.path, "package name/version is invalid");
    }
    expectedPackages.push(`${packageManifest.name}@${packageManifest.version}`);
  }
  expectedPackages.sort(compareCodeUnits);

  const actualPackages = [];
  const spdxIds = new Set(["SPDXRef-Package-Node"]);
  for (const [index, packageEntry] of sbom.packages.entries()) {
    if (packageEntry === nodePackage) continue;
    const location = `sbom.packages[${index}]`;
    assertSemanticKeys(
      packageEntry,
      [
        "SPDXID",
        "name",
        "versionInfo",
        "downloadLocation",
        "filesAnalyzed",
        "licenseConcluded",
        "licenseDeclared",
      ],
      location,
      code,
    );
    assertQualificationPackageFields(packageEntry, location, code, "NOASSERTION");
    if (
      typeof packageEntry.SPDXID !== "string" ||
      !/^SPDXRef-Package-[1-9][0-9]*$/u.test(packageEntry.SPDXID) ||
      spdxIds.has(packageEntry.SPDXID) ||
      typeof packageEntry.name !== "string" ||
      !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(packageEntry.name) ||
      typeof packageEntry.versionInfo !== "string" ||
      !SEMVER.test(packageEntry.versionInfo)
    ) {
      semanticFail(code, location, "SPDXID/name/versionInfo is invalid or duplicated");
    }
    spdxIds.add(packageEntry.SPDXID);
    actualPackages.push(`${packageEntry.name}@${packageEntry.versionInfo}`);
  }
  actualPackages.sort(compareCodeUnits);
  if (
    actualPackages.length !== expectedPackages.length ||
    actualPackages.some((identity, index) => identity !== expectedPackages[index])
  ) {
    semanticFail(
      code,
      "sbom.packages",
      "package inventory does not match payload package.json files",
    );
  }
}

async function verifyProvenanceSemantics(root, manifest, payloadByPath) {
  const code = "RELEASE_PROVENANCE_INVALID";
  if (manifest.provenance.path !== "metadata/provenance.json") {
    semanticFail(code, "provenance.path", "must be metadata/provenance.json");
  }
  const provenance = await readBoundCanonicalJson(
    root,
    payloadByPath,
    manifest.provenance.path,
    code,
  );
  assertSemanticKeys(
    provenance,
    ["_type", "predicateType", "subject", "predicate"],
    "provenance",
    code,
  );
  if (
    provenance._type !== "https://in-toto.io/Statement/v1" ||
    provenance.predicateType !== "https://slsa.dev/provenance/v1"
  ) {
    semanticFail(code, "provenance", "Statement or predicate type is invalid");
  }
  if (!Array.isArray(provenance.subject)) {
    semanticFail(code, "provenance.subject", "must be an array");
  }
  const metadataPaths = new Set([
    "metadata/checksums.sha256",
    "metadata/provenance.json",
    "metadata/sbom.spdx.json",
  ]);
  const corePayload = manifest.payload.filter(({ path }) => !metadataPaths.has(path));
  const expectedSubjects = new Map(corePayload.map((entry) => [entry.path, entry.sha256]));
  const actualSubjects = new Map();
  for (const [index, subject] of provenance.subject.entries()) {
    const location = `provenance.subject[${index}]`;
    assertSemanticKeys(subject, ["name", "digest"], location, code);
    assertReleasePath(subject.name, `${location}.name`);
    assertSemanticKeys(subject.digest, ["sha256"], `${location}.digest`, code);
    if (!SHA256.test(subject.digest.sha256) || actualSubjects.has(subject.name)) {
      semanticFail(code, location, "subject digest is invalid or name is duplicated");
    }
    actualSubjects.set(subject.name, subject.digest.sha256);
  }
  if (
    actualSubjects.size !== expectedSubjects.size ||
    [...expectedSubjects].some(([path, digest]) => actualSubjects.get(path) !== digest)
  ) {
    semanticFail(code, "provenance.subject", "must exactly cover core payload digests");
  }

  assertSemanticKeys(
    provenance.predicate,
    ["buildDefinition", "runDetails"],
    "provenance.predicate",
    code,
  );
  const buildDefinition = provenance.predicate.buildDefinition;
  assertSemanticKeys(
    buildDefinition,
    ["buildType", "externalParameters", "internalParameters", "resolvedDependencies"],
    "provenance.predicate.buildDefinition",
    code,
  );
  if (
    buildDefinition.buildType !== "https://aseos.invalid/build-types/windows-x64-qualification/v1"
  ) {
    semanticFail(code, "provenance.predicate.buildDefinition.buildType", "is invalid");
  }
  assertSemanticKeys(
    buildDefinition.externalParameters,
    ["frameworkVersion", "gitCommit", "runtimeArchiveSha256"],
    "provenance.predicate.buildDefinition.externalParameters",
    code,
  );
  if (
    buildDefinition.externalParameters.frameworkVersion !== manifest.frameworkVersion ||
    buildDefinition.externalParameters.gitCommit !== manifest.gitCommit ||
    buildDefinition.externalParameters.runtimeArchiveSha256 !== manifest.runtime.archiveSha256
  ) {
    semanticFail(
      code,
      "provenance.predicate.buildDefinition.externalParameters",
      "does not match manifest",
    );
  }
  assertSemanticKeys(
    buildDefinition.internalParameters,
    ["productionApproved"],
    "provenance.predicate.buildDefinition.internalParameters",
    code,
  );
  if (
    buildDefinition.internalParameters.productionApproved !== false ||
    manifest.artifact.productionApproved !== false
  ) {
    semanticFail(
      code,
      "provenance.predicate.buildDefinition.internalParameters",
      "production must not be approved",
    );
  }
  if (
    !Array.isArray(buildDefinition.resolvedDependencies) ||
    buildDefinition.resolvedDependencies.length !== 2
  ) {
    semanticFail(
      code,
      "provenance.predicate.buildDefinition.resolvedDependencies",
      "must contain git and runtime",
    );
  }
  const [gitDependency, runtimeDependency] = buildDefinition.resolvedDependencies;
  assertSemanticKeys(gitDependency, ["uri"], "provenance.resolvedDependencies[0]", code);
  assertSemanticKeys(
    runtimeDependency,
    ["uri", "digest"],
    "provenance.resolvedDependencies[1]",
    code,
  );
  assertSemanticKeys(
    runtimeDependency.digest,
    ["sha256"],
    "provenance.resolvedDependencies[1].digest",
    code,
  );
  if (
    gitDependency.uri !==
      `git+https://github.com/olu37776-bit/-ai-software-engineering-os@${manifest.gitCommit}` ||
    runtimeDependency.uri !== manifest.runtime.archiveUrl ||
    runtimeDependency.digest.sha256 !== manifest.runtime.archiveSha256
  ) {
    semanticFail(
      code,
      "provenance.predicate.buildDefinition.resolvedDependencies",
      "does not match git/runtime inputs",
    );
  }

  const runDetails = provenance.predicate.runDetails;
  assertSemanticKeys(runDetails, ["builder", "metadata"], "provenance.predicate.runDetails", code);
  assertSemanticKeys(runDetails.builder, ["id"], "provenance.predicate.runDetails.builder", code);
  assertSemanticKeys(
    runDetails.metadata,
    ["invocationId", "startedOn", "finishedOn"],
    "provenance.predicate.runDetails.metadata",
    code,
  );
  if (
    runDetails.builder.id !== "https://aseos.invalid/builders/deterministic-release-assembler/v1" ||
    runDetails.metadata.invocationId !== manifest.buildId ||
    runDetails.metadata.startedOn !== manifest.builtAt ||
    runDetails.metadata.finishedOn !== manifest.builtAt
  ) {
    semanticFail(
      code,
      "provenance.predicate.runDetails",
      "builder invocation or timestamps do not match manifest",
    );
  }
}

async function verifyChecksumSemantics(root, manifest, payloadByPath) {
  const code = "RELEASE_CHECKSUMS_INVALID";
  const checksumPath = "metadata/checksums.sha256";
  const bytes = await readBoundPayloadBytes(root, payloadByPath, checksumPath);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    semanticFail(code, checksumPath, `invalid UTF-8: ${error.message}`);
  }
  if (!text.endsWith("\n") || text.includes("\r")) {
    semanticFail(code, checksumPath, "must use LF records and end with one LF");
  }
  const lines = text.slice(0, -1).split("\n");
  const actual = new Map();
  const orderedPaths = [];
  for (const [index, line] of lines.entries()) {
    const match = /^([0-9a-f]{64}) {2}(.+)$/u.exec(line);
    if (match === null) {
      semanticFail(code, `${checksumPath}:${index + 1}`, "record format is invalid");
    }
    const [, digest, path] = match;
    assertReleasePath(path, `${checksumPath}:${index + 1}`);
    if (path === checksumPath || actual.has(path)) {
      semanticFail(code, `${checksumPath}:${index + 1}`, "path is self-referential or duplicated");
    }
    actual.set(path, digest);
    orderedPaths.push(path);
  }
  const expected = manifest.payload.filter(({ path }) => path !== checksumPath);
  if (
    actual.size !== expected.length ||
    expected.some(({ path, sha256 }, index) => {
      return actual.get(path) !== sha256 || orderedPaths[index] !== path;
    })
  ) {
    semanticFail(code, checksumPath, "must exactly cover every other payload digest in order");
  }
}

async function listArtifactFiles(root, directory = root, prefix = "") {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    fail("RELEASE_ARTIFACT_UNREADABLE", `${prefix || "."}: ${error.code ?? error.message}`);
  }
  const files = [];
  for (const entry of entries) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    assertReleasePath(path, "artifact entry");
    if (entry.isSymbolicLink()) {
      fail("UNSAFE_PAYLOAD_PATH", `${path} is a symbolic link or junction`);
    }
    if (entry.isDirectory()) {
      files.push(...(await listArtifactFiles(root, resolve(directory, entry.name), path)));
    } else if (entry.isFile()) {
      files.push(path);
    } else {
      fail("UNSAFE_PAYLOAD_PATH", `${path} is not a regular file or directory`);
    }
  }
  return files;
}

async function readRepositoryAuthority({ expectedVersion, toolchainPath, runtimeLockPath }) {
  const packagePath = resolve(REPOSITORY_ROOT, "package.json");
  const resolvedToolchainPath = resolve(
    toolchainPath ?? resolve(REPOSITORY_ROOT, "toolchain/toolchain.json"),
  );
  const resolvedRuntimeLockPath = resolve(
    runtimeLockPath ?? resolve(REPOSITORY_ROOT, "scripts/release/windows-runtime-lock.json"),
  );
  const [packageManifest, toolchain, runtimeLock] = await Promise.all([
    expectedVersion === undefined
      ? readFile(packagePath, "utf8").then(JSON.parse)
      : Promise.resolve(undefined),
    readFile(resolvedToolchainPath, "utf8").then(JSON.parse),
    readFile(resolvedRuntimeLockPath, "utf8").then(JSON.parse),
  ]);
  return {
    frameworkVersion: expectedVersion ?? packageManifest.version,
    toolchain: {
      node: toolchain.authority?.node,
      pnpm: toolchain.authority?.pnpm,
      typescript: toolchain.authority?.typescript,
    },
    runtime: runtimeLock.runtime,
  };
}

export async function verifyReleaseManifest({
  artifactRoot,
  manifestPath = "release-manifest.json",
  expectedVersion,
  expectedGitCommit,
  toolchainPath,
  runtimeLockPath,
} = {}) {
  if (typeof artifactRoot !== "string" || artifactRoot.length === 0) {
    fail("INVALID_ARGUMENT", "artifactRoot is required");
  }
  assertReleasePath(manifestPath, "manifestPath");
  const root = resolve(artifactRoot);
  let manifestFile;
  try {
    manifestFile = await resolvePayloadFile(root, manifestPath);
  } catch (error) {
    if (error instanceof ManifestVerificationError) {
      throw error;
    }
    fail("MANIFEST_UNREADABLE", error.message);
  }
  const { value: manifest, bytes: manifestBytes } = await readCanonicalJson(
    manifestFile,
    manifestPath,
  );
  assertManifestShape(manifest);
  if (manifest.payload.some((entry) => entry.path === manifestPath)) {
    fail("SELF_REFERENTIAL_MANIFEST", `payload must not contain ${manifestPath}`);
  }

  const actualFiles = (await listArtifactFiles(root)).sort(compareCodeUnits);
  const expectedFiles = [...manifest.payload.map((entry) => entry.path), manifestPath].sort(
    compareCodeUnits,
  );
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((path, index) => path !== expectedFiles[index])
  ) {
    const expected = new Set(expectedFiles);
    const actual = new Set(actualFiles);
    const extra = actualFiles.filter((path) => !expected.has(path));
    const missing = expectedFiles.filter((path) => !actual.has(path));
    if (missing.length > 0) {
      fail("RELEASE_PAYLOAD_MISSING", missing.join(","));
    }
    fail("RELEASE_PAYLOAD_INVENTORY_MISMATCH", `extra=[${extra.join(",")}]`);
  }

  const authority = await readRepositoryAuthority({
    expectedVersion,
    toolchainPath,
    runtimeLockPath,
  });
  if (manifest.frameworkVersion !== authority.frameworkVersion) {
    fail(
      "FRAMEWORK_VERSION_MISMATCH",
      `${manifest.frameworkVersion} != ${authority.frameworkVersion}`,
    );
  }
  for (const name of ["node", "pnpm", "typescript"]) {
    if (manifest.toolchain[name] !== authority.toolchain[name]) {
      fail(
        "TOOLCHAIN_VERSION_MISMATCH",
        `${name}: ${manifest.toolchain[name]} != ${authority.toolchain[name]}`,
      );
    }
  }
  if (manifest.runtime.version !== manifest.toolchain.node) {
    fail("RUNTIME_VERSION_MISMATCH", "runtime.version must equal toolchain.node");
  }
  const runtimeBindings = [
    ["distribution", authority.runtime?.distribution],
    ["version", authority.runtime?.version],
    ["platform", authority.runtime?.platform],
    ["archiveUrl", authority.runtime?.archiveUrl],
    ["archiveSha256", authority.runtime?.sha256],
  ];
  for (const [name, expected] of runtimeBindings) {
    if (manifest.runtime[name] !== expected) {
      fail("RUNTIME_LOCK_MISMATCH", `${name}: ${manifest.runtime[name]} != ${String(expected)}`);
    }
  }
  if (expectedGitCommit !== undefined && manifest.gitCommit !== expectedGitCommit) {
    fail("GIT_COMMIT_MISMATCH", `${manifest.gitCommit} != ${expectedGitCommit}`);
  }

  for (const entry of manifest.payload) {
    const file = await resolvePayloadFile(root, entry.path);
    const actual = await sha256File(file);
    if (actual.sizeBytes !== entry.sizeBytes) {
      fail(
        "RELEASE_PAYLOAD_SIZE_MISMATCH",
        `${entry.path}: ${actual.sizeBytes} != ${entry.sizeBytes}`,
      );
    }
    if (actual.sha256 !== entry.sha256) {
      fail("RELEASE_PAYLOAD_HASH_MISMATCH", `${entry.path}: ${actual.sha256} != ${entry.sha256}`);
    }
  }

  const payloadByPath = new Map(manifest.payload.map((entry) => [entry.path, entry]));
  await verifySbomSemantics(root, manifest, payloadByPath);
  await verifyProvenanceSemantics(root, manifest, payloadByPath);
  await verifyChecksumSemantics(root, manifest, payloadByPath);

  return {
    result: "PASS",
    frameworkVersion: manifest.frameworkVersion,
    gitCommit: manifest.gitCommit,
    buildId: manifest.buildId,
    manifestSha256: sha256Bytes(manifestBytes),
    manifestSizeBytes: manifestBytes.length,
    payloadFiles: manifest.payload.length,
    payloadSizeBytes: manifest.payload.reduce((total, entry) => total + entry.sizeBytes, 0),
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      "artifact-root": { type: "string" },
      manifest: { type: "string", default: "release-manifest.json" },
      "expected-version": { type: "string" },
      "expected-git-commit": { type: "string" },
      "toolchain-path": { type: "string" },
      "runtime-lock-path": { type: "string" },
    },
    strict: true,
  });
  const result = await verifyReleaseManifest({
    artifactRoot: values["artifact-root"],
    manifestPath: values.manifest,
    expectedVersion: values["expected-version"],
    expectedGitCommit: values["expected-git-commit"],
    toolchainPath: values["toolchain-path"],
    runtimeLockPath: values["runtime-lock-path"],
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
