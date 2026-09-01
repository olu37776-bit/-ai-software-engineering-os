#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultSourceRoot = resolve(scriptDirectory, "../..");
const canonicalRuntimeLockPath = join(scriptDirectory, "windows-runtime-lock.json");
const launcherTemplatePath = join(scriptDirectory, "templates", "aseos.cmd");
const sha256Pattern = /^[0-9a-f]{64}$/u;
const commitPattern = /^[0-9a-f]{40}$/u;
const packageCopies = Object.freeze([
  ["apps/cli", "app/apps/cli"],
  ["apps/runtime", "app/apps/runtime"],
  ["packages/platform", "app/node_modules/@aseos/platform"],
  ["packages/contracts", "app/node_modules/@aseos/contracts"],
]);
const externalPackages = Object.freeze([
  "ajv",
  "fast-deep-equal",
  "fast-uri",
  "json-schema-traverse",
  "require-from-string",
]);

function fail(code, detail = "") {
  throw new Error(detail.length === 0 ? code : `${code}:${detail}`);
}

function normalizeRelativePath(value) {
  return value.split(sep).join("/");
}

function parseArguments(arguments_) {
  const parsed = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index];
    const value = arguments_[index + 1];
    if (!key?.startsWith("--") || value === undefined) fail("RELEASE_ARGUMENT_INVALID", key ?? "");
    parsed[key.slice(2)] = value;
  }
  for (const required of ["runtime-archive", "output"]) {
    if (typeof parsed[required] !== "string" || parsed[required].length === 0) {
      fail("RELEASE_ARGUMENT_REQUIRED", `--${required}`);
    }
  }
  return parsed;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableJson(value) {
  const encode = (current) => {
    if (current === null || typeof current === "boolean" || typeof current === "string") {
      return JSON.stringify(current);
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) fail("RELEASE_CANONICAL_JSON_NONFINITE_NUMBER");
      return JSON.stringify(current);
    }
    if (Array.isArray(current)) return `[${current.map(encode).join(",")}]`;
    if (typeof current === "object") {
      return `{${Object.keys(current)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${encode(current[key])}`)
        .join(",")}}`;
    }
    fail("RELEASE_CANONICAL_JSON_UNSUPPORTED_VALUE", typeof current);
  };
  return `${encode(value)}\n`;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(zip) {
  const minimum = Math.max(0, zip.length - 65_557);
  for (let offset = zip.length - 22; offset >= minimum; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  fail("RUNTIME_ARCHIVE_EOCD_MISSING");
}

function readZipEntries(zip) {
  const eocd = findEndOfCentralDirectory(zip);
  const disk = zip.readUInt16LE(eocd + 4);
  const centralDisk = zip.readUInt16LE(eocd + 6);
  const entriesOnDisk = zip.readUInt16LE(eocd + 8);
  const entryCount = zip.readUInt16LE(eocd + 10);
  const centralSize = zip.readUInt32LE(eocd + 12);
  const centralOffset = zip.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    fail("RUNTIME_ARCHIVE_MULTIDISK_UNSUPPORTED");
  }
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    fail("RUNTIME_ARCHIVE_ZIP64_UNSUPPORTED");
  }
  if (centralOffset + centralSize > eocd) fail("RUNTIME_ARCHIVE_CENTRAL_DIRECTORY_INVALID");

  const entries = new Map();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > zip.length || zip.readUInt32LE(offset) !== 0x02014b50) {
      fail("RUNTIME_ARCHIVE_CENTRAL_ENTRY_INVALID", String(index));
    }
    const flags = zip.readUInt16LE(offset + 8);
    const method = zip.readUInt16LE(offset + 10);
    const expectedCrc32 = zip.readUInt32LE(offset + 16);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const nameEnd = offset + 46 + nameLength;
    if (nameEnd > zip.length) fail("RUNTIME_ARCHIVE_ENTRY_NAME_INVALID", String(index));
    const name = zip
      .subarray(offset + 46, nameEnd)
      .toString("utf8")
      .replaceAll("\\", "/");
    if (
      name.length === 0 ||
      name.startsWith("/") ||
      /^[a-zA-Z]:/u.test(name) ||
      name.split("/").some((part) => part === ".." || part === "." || part.length === 0)
    ) {
      if (!name.endsWith("/")) fail("RUNTIME_ARCHIVE_ENTRY_PATH_UNSAFE", name);
    }
    if ((flags & 1) !== 0) fail("RUNTIME_ARCHIVE_ENCRYPTED_ENTRY", name);
    if (method !== 0 && method !== 8) fail("RUNTIME_ARCHIVE_COMPRESSION_UNSUPPORTED", name);
    if (entries.has(name)) fail("RUNTIME_ARCHIVE_DUPLICATE_ENTRY", name);
    entries.set(name, {
      name,
      method,
      expectedCrc32,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    offset = nameEnd + extraLength + commentLength;
  }
  if (offset !== centralOffset + centralSize) fail("RUNTIME_ARCHIVE_CENTRAL_SIZE_MISMATCH");
  return entries;
}

function extractZipEntry(zip, entry) {
  const offset = entry.localOffset;
  if (offset + 30 > zip.length || zip.readUInt32LE(offset) !== 0x04034b50) {
    fail("RUNTIME_ARCHIVE_LOCAL_ENTRY_INVALID", entry.name);
  }
  const nameLength = zip.readUInt16LE(offset + 26);
  const extraLength = zip.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > zip.length) fail("RUNTIME_ARCHIVE_ENTRY_TRUNCATED", entry.name);
  const compressed = zip.subarray(dataStart, dataEnd);
  const content = entry.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
  if (content.length !== entry.uncompressedSize)
    fail("RUNTIME_ARCHIVE_ENTRY_SIZE_MISMATCH", entry.name);
  if (crc32(content) !== entry.expectedCrc32)
    fail("RUNTIME_ARCHIVE_ENTRY_CRC_MISMATCH", entry.name);
  return content;
}

async function copyDirectoryFiles(source, destination, filter = () => true) {
  const entries = await readdir(source, { withFileTypes: true });
  entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  await mkdir(destination, { recursive: true });
  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (!filter(sourcePath, entry)) continue;
    if (entry.isDirectory()) {
      await copyDirectoryFiles(sourcePath, destinationPath, filter);
    } else if (entry.isFile()) {
      await cp(sourcePath, destinationPath, { force: false, preserveTimestamps: false });
    } else {
      fail("RELEASE_SOURCE_UNSUPPORTED_FILE_TYPE", sourcePath);
    }
  }
}

async function copyWorkspacePackage(
  sourceRoot,
  sourceRelative,
  destinationRoot,
  destinationRelative,
) {
  const source = join(sourceRoot, sourceRelative);
  const destination = join(destinationRoot, destinationRelative);
  const packageMetadata = join(source, "package.json");
  const distribution = join(source, "dist");
  await stat(packageMetadata).catch(() => fail("RELEASE_PACKAGE_METADATA_MISSING", sourceRelative));
  await stat(distribution).catch(() => fail("RELEASE_BUILD_OUTPUT_MISSING", sourceRelative));
  await mkdir(destination, { recursive: true });
  await cp(packageMetadata, join(destination, "package.json"), { force: false });
  await copyDirectoryFiles(
    distribution,
    join(destination, "dist"),
    (path, entry) => entry.isDirectory() || !path.endsWith(".tsbuildinfo"),
  );
}

async function copyExternalPackage(sourceRoot, packageName, destinationRoot, dependencyRoot) {
  const candidates = [
    join(sourceRoot, "node_modules", packageName),
    join(dependencyRoot, packageName),
  ];
  let source;
  for (const candidate of candidates) {
    try {
      source = await realpath(candidate);
      break;
    } catch {
      // Try the package manager's dependency-local node_modules next.
    }
  }
  if (source === undefined) fail("RELEASE_DEPENDENCY_MISSING", packageName);
  const destination = join(destinationRoot, "app", "node_modules", packageName);
  await copyDirectoryFiles(source, destination, (path, entry) => {
    if (entry.isDirectory()) {
      return (
        !entry.name.startsWith(".") && !["test", "tests", "spec", "benchmark"].includes(entry.name)
      );
    }
    return !/\.(md|map|ts)$/iu.test(path);
  });
}

async function listFiles(root, current = root) {
  const result = [];
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) result.push(...(await listFiles(root, path)));
    else if (entry.isFile()) result.push(normalizeRelativePath(relative(root, path)));
    else fail("RELEASE_OUTPUT_UNSUPPORTED_FILE_TYPE", path);
  }
  return result.sort();
}

async function describeFiles(root, paths) {
  const result = [];
  for (const path of [...paths].sort()) {
    const content = await readFile(join(root, ...path.split("/")));
    result.push(Object.freeze({ path, sha256: sha256(content), sizeBytes: content.length }));
  }
  return result;
}

function defaultGitCommit(sourceRoot) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: sourceRoot,
      encoding: "utf8",
      windowsHide: true,
    }).trim();
  } catch {
    fail("RELEASE_GIT_COMMIT_REQUIRED");
  }
}

function validateRuntimeLock(lock) {
  const runtime = lock?.runtime;
  if (
    lock?.schemaVersion !== "1.0.0" ||
    runtime?.distribution !== "node" ||
    runtime?.platform !== "win-x64" ||
    typeof runtime?.version !== "string" ||
    typeof runtime?.archiveUrl !== "string" ||
    !sha256Pattern.test(runtime?.sha256 ?? "") ||
    typeof runtime?.executableEntry !== "string"
  ) {
    fail("RUNTIME_LOCK_INVALID");
  }
  return runtime;
}

async function writeMetadata({
  root,
  corePayload,
  builtAt,
  buildId,
  gitCommit,
  runtime,
  frameworkVersion,
}) {
  await mkdir(join(root, "metadata"), { recursive: true });
  const coreDescriptors = await describeFiles(root, corePayload);
  const packageMetadataPaths = corePayload.filter((path) => path.endsWith("/package.json"));
  const packages = [];
  for (const path of packageMetadataPaths) {
    const metadata = JSON.parse(await readFile(join(root, ...path.split("/")), "utf8"));
    packages.push({
      SPDXID: `SPDXRef-Package-${packages.length + 1}`,
      name: metadata.name,
      versionInfo: metadata.version,
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      licenseConcluded: "NOASSERTION",
      licenseDeclared: "NOASSERTION",
    });
  }
  packages.unshift({
    SPDXID: "SPDXRef-Package-Node",
    name: "node",
    versionInfo: runtime.version,
    downloadLocation: runtime.archiveUrl,
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: "NOASSERTION",
    checksums: [{ algorithm: "SHA256", checksumValue: runtime.archiveSha256 }],
  });
  const sbom = {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `ASEOS-${frameworkVersion}-windows-x64-qualification`,
    documentNamespace: `https://aseos.invalid/spdx/${gitCommit}/${buildId}`,
    creationInfo: { created: builtAt, creators: ["Tool: ASEOS deterministic release assembler"] },
    packages,
  };
  await writeFile(join(root, "metadata", "sbom.spdx.json"), stableJson(sbom), { flag: "wx" });

  const provenance = {
    _type: "https://in-toto.io/Statement/v1",
    predicateType: "https://slsa.dev/provenance/v1",
    subject: coreDescriptors.map(({ path, sha256: digest }) => ({
      name: path,
      digest: { sha256: digest },
    })),
    predicate: {
      buildDefinition: {
        buildType: "https://aseos.invalid/build-types/windows-x64-qualification/v1",
        externalParameters: {
          frameworkVersion,
          gitCommit,
          runtimeArchiveSha256: runtime.archiveSha256,
        },
        internalParameters: { productionApproved: false },
        resolvedDependencies: [
          { uri: `git+https://github.com/olu37776-bit/-ai-software-engineering-os@${gitCommit}` },
          { uri: runtime.archiveUrl, digest: { sha256: runtime.archiveSha256 } },
        ],
      },
      runDetails: {
        builder: { id: "https://aseos.invalid/builders/deterministic-release-assembler/v1" },
        metadata: { invocationId: buildId, startedOn: builtAt, finishedOn: builtAt },
      },
    },
  };
  await writeFile(join(root, "metadata", "provenance.json"), stableJson(provenance), {
    flag: "wx",
  });

  const metadataPayload = ["metadata/provenance.json", "metadata/sbom.spdx.json"];
  const checksumDescriptors = await describeFiles(root, [...corePayload, ...metadataPayload]);
  const checksumText = `${checksumDescriptors.map((item) => `${item.sha256}  ${item.path}`).join("\n")}\n`;
  await writeFile(join(root, "metadata", "checksums.sha256"), checksumText, { flag: "wx" });
  return [...metadataPayload, "metadata/checksums.sha256"];
}

export async function assembleWindowsX64(options) {
  const sourceRoot = resolve(options.sourceRoot ?? defaultSourceRoot);
  const runtimeArchive = resolve(options.runtimeArchive);
  const output = resolve(options.output);
  if (output === sourceRoot || output.startsWith(`${sourceRoot}${sep}`)) {
    fail("RELEASE_OUTPUT_MUST_BE_OUTSIDE_SOURCE_ROOT", output);
  }
  await stat(output)
    .then(() => fail("RELEASE_OUTPUT_ALREADY_EXISTS", output))
    .catch((error) => {
      if (error instanceof Error && error.message.startsWith("RELEASE_OUTPUT_ALREADY_EXISTS"))
        throw error;
      if (error?.code !== "ENOENT") throw error;
    });

  const lock = options.runtimeLock ?? JSON.parse(await readFile(canonicalRuntimeLockPath, "utf8"));
  const lockedRuntime = validateRuntimeLock(lock);
  const archiveBytes = await readFile(runtimeArchive);
  const archiveSha256 = sha256(archiveBytes);
  if (archiveSha256 !== lockedRuntime.sha256) {
    fail("RUNTIME_ARCHIVE_SHA256_MISMATCH", `${archiveSha256}!=${lockedRuntime.sha256}`);
  }
  const entries = readZipEntries(archiveBytes);
  const executableEntry = entries.get(lockedRuntime.executableEntry);
  if (executableEntry === undefined)
    fail("RUNTIME_EXECUTABLE_MISSING", lockedRuntime.executableEntry);
  const nodeExecutable = extractZipEntry(archiveBytes, executableEntry);
  if (nodeExecutable.length < 2 || nodeExecutable[0] !== 0x4d || nodeExecutable[1] !== 0x5a) {
    fail("RUNTIME_EXECUTABLE_FORMAT_INVALID");
  }

  const gitCommit = options.gitCommit ?? defaultGitCommit(sourceRoot);
  if (!commitPattern.test(gitCommit)) fail("RELEASE_GIT_COMMIT_INVALID", gitCommit);
  const frameworkVersion = options.frameworkVersion ?? "0.1.0";
  const builtAt = options.builtAt ?? process.env.SOURCE_DATE_EPOCH;
  if (builtAt === undefined) fail("RELEASE_BUILT_AT_REQUIRED", "--built-at or SOURCE_DATE_EPOCH");
  const builtAtDate = /^\d+$/u.test(builtAt) ? new Date(Number(builtAt) * 1000) : new Date(builtAt);
  if (Number.isNaN(builtAtDate.valueOf())) fail("RELEASE_BUILT_AT_INVALID", builtAt);
  const normalizedBuiltAt = builtAtDate.toISOString();
  const buildId = options.buildId ?? `p1-o08-${gitCommit.slice(0, 12)}`;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u.test(buildId)) fail("RELEASE_BUILD_ID_INVALID");

  await mkdir(dirname(output), { recursive: true });
  const staging = await mkdtemp(join(dirname(output), `.${basename(output)}.assembling-`));
  try {
    await mkdir(join(staging, "node"), { recursive: true });
    await writeFile(join(staging, "node", "node.exe"), nodeExecutable, { flag: "wx" });
    const nodeLicenseEntry = [...entries.values()].find(
      (entry) =>
        entry.name === `${dirname(lockedRuntime.executableEntry).replaceAll("\\", "/")}/LICENSE`,
    );
    if (nodeLicenseEntry !== undefined) {
      await writeFile(
        join(staging, "node", "LICENSE"),
        extractZipEntry(archiveBytes, nodeLicenseEntry),
        {
          flag: "wx",
        },
      );
    }

    for (const [source, destination] of packageCopies) {
      await copyWorkspacePackage(sourceRoot, source, staging, destination);
    }
    const ajvSource = await realpath(join(sourceRoot, "node_modules", "ajv")).catch(() =>
      fail("RELEASE_DEPENDENCY_MISSING", "ajv"),
    );
    const dependencyRoot = dirname(ajvSource);
    for (const packageName of externalPackages) {
      await copyExternalPackage(sourceRoot, packageName, staging, dependencyRoot);
    }
    await cp(launcherTemplatePath, join(staging, "aseos.cmd"), { force: false });

    const corePayload = await listFiles(staging);
    const runtime = {
      distribution: lockedRuntime.distribution,
      version: lockedRuntime.version,
      platform: lockedRuntime.platform,
      archiveUrl: lockedRuntime.archiveUrl,
      archiveSha256,
      executable: "node/node.exe",
    };
    const metadataPayload = await writeMetadata({
      root: staging,
      corePayload,
      builtAt: normalizedBuiltAt,
      buildId,
      gitCommit,
      runtime,
      frameworkVersion,
    });
    const payload = await describeFiles(staging, [...corePayload, ...metadataPayload]);
    const sbomDescriptor = payload.find((item) => item.path === "metadata/sbom.spdx.json");
    const provenanceDescriptor = payload.find((item) => item.path === "metadata/provenance.json");
    const manifest = {
      $schema: "urn:aseos:release-schema:release-manifest:1.0.0",
      schemaVersion: "1.0.0",
      frameworkVersion,
      gitCommit,
      buildId,
      builtAt: normalizedBuiltAt,
      platform: { id: "windows-x64", os: "windows", arch: "x64" },
      toolchain: { node: lockedRuntime.version, pnpm: "11.24.0", typescript: "6.0.3" },
      contracts: {
        controlApi: "1.0.0",
        evidence: "1.0.0",
        isolation: "1.0.0",
        release: "1.0.0",
      },
      configSchemaVersion: "1.0.0",
      stateSchemaVersion: "1.0.0",
      supportedUpgradeSources: [],
      artifact: { kind: "NON_PRODUCTION_QUALIFICATION", productionApproved: false },
      runtime,
      sbom: { path: sbomDescriptor.path, sha256: sbomDescriptor.sha256 },
      provenance: { path: provenanceDescriptor.path, sha256: provenanceDescriptor.sha256 },
      payload,
    };
    await writeFile(join(staging, "release-manifest.json"), stableJson(manifest), { flag: "wx" });
    await rename(staging, output);
    return Object.freeze({ output, manifest });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const result = await assembleWindowsX64({
    runtimeArchive: arguments_["runtime-archive"],
    output: arguments_.output,
    sourceRoot: arguments_["source-root"],
    gitCommit: arguments_["git-commit"],
    frameworkVersion: arguments_["framework-version"],
    builtAt: arguments_["built-at"],
    buildId: arguments_["build-id"],
  });
  process.stdout.write(
    `${JSON.stringify({
      status: "PASS",
      output: result.output,
      frameworkVersion: result.manifest.frameworkVersion,
      gitCommit: result.manifest.gitCommit,
      buildId: result.manifest.buildId,
      payloadFiles: result.manifest.payload.length,
      payloadSizeBytes: result.manifest.payload.reduce(
        (total, entry) => total + entry.sizeBytes,
        0,
      ),
    })}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "RELEASE_ASSEMBLY_FAILED"}\n`);
    process.exitCode = 1;
  });
}
