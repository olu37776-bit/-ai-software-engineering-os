import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  canonicalJson,
  canonicalJsonBytes,
  sha256Bytes,
} from "../../../scripts/release/canonical.mjs";
import {
  assertReleasePath,
  verifyReleaseManifest,
} from "../../../scripts/release/verify-manifest.mjs";

const temporaryRoots = [];
const gitCommit = "a".repeat(40);
const runtimeArchiveSha256 = "b".repeat(64);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture() {
  const workspace = await mkdtemp(join(tmpdir(), "aseos manifest 验证 "));
  temporaryRoots.push(workspace);
  const artifactRoot = join(workspace, "artifact");
  const toolchainPath = join(workspace, "toolchain.json");
  const runtimeLockPath = join(workspace, "windows-runtime-lock.json");
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(
    toolchainPath,
    JSON.stringify({
      authority: { node: "24.19.0", pnpm: "11.24.0", typescript: "6.0.3" },
    }),
  );
  await writeFile(
    runtimeLockPath,
    JSON.stringify({
      runtime: {
        distribution: "node",
        version: "24.19.0",
        platform: "win-x64",
        archiveUrl: "https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-x64.zip",
        sha256: runtimeArchiveSha256,
        executableEntry: "node-v24.19.0-win-x64/node.exe",
      },
    }),
  );

  const builtAt = "2026-09-01T00:00:00.000Z";
  const buildId = "qualification-1";
  const coreContents = new Map([
    [
      "app/package.json",
      canonicalJsonBytes({ name: "@aseos/cli", version: "0.1.0", type: "module" }),
    ],
    ["node/node.exe", Buffer.from("qualified bundled runtime")],
  ]);
  const describe = ([path, bytes]) => ({
    path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sizeBytes: bytes.length,
  });
  const coreDescriptors = [...coreContents]
    .map(describe)
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  const sbom = {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: "ASEOS-0.1.0-windows-x64-qualification",
    documentNamespace: `https://aseos.invalid/spdx/${gitCommit}/${buildId}`,
    creationInfo: {
      created: builtAt,
      creators: ["Tool: ASEOS deterministic release assembler"],
    },
    packages: [
      {
        SPDXID: "SPDXRef-Package-Node",
        name: "node",
        versionInfo: "24.19.0",
        downloadLocation: "https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-x64.zip",
        filesAnalyzed: false,
        licenseConcluded: "NOASSERTION",
        licenseDeclared: "NOASSERTION",
        checksums: [{ algorithm: "SHA256", checksumValue: runtimeArchiveSha256 }],
      },
      {
        SPDXID: "SPDXRef-Package-1",
        name: "@aseos/cli",
        versionInfo: "0.1.0",
        downloadLocation: "NOASSERTION",
        filesAnalyzed: false,
        licenseConcluded: "NOASSERTION",
        licenseDeclared: "NOASSERTION",
      },
    ],
  };
  const provenance = {
    _type: "https://in-toto.io/Statement/v1",
    predicateType: "https://slsa.dev/provenance/v1",
    subject: coreDescriptors.map(({ path: name, sha256 }) => ({
      name,
      digest: { sha256 },
    })),
    predicate: {
      buildDefinition: {
        buildType: "https://aseos.invalid/build-types/windows-x64-qualification/v1",
        externalParameters: {
          frameworkVersion: "0.1.0",
          gitCommit,
          runtimeArchiveSha256,
        },
        internalParameters: { productionApproved: false },
        resolvedDependencies: [
          {
            uri: `git+https://github.com/olu37776-bit/-ai-software-engineering-os@${gitCommit}`,
          },
          {
            uri: "https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-x64.zip",
            digest: { sha256: runtimeArchiveSha256 },
          },
        ],
      },
      runDetails: {
        builder: {
          id: "https://aseos.invalid/builders/deterministic-release-assembler/v1",
        },
        metadata: { invocationId: buildId, startedOn: builtAt, finishedOn: builtAt },
      },
    },
  };
  const metadataContents = new Map([
    ["metadata/provenance.json", canonicalJsonBytes(provenance)],
    ["metadata/sbom.spdx.json", canonicalJsonBytes(sbom)],
  ]);
  const checksumDescriptors = [...coreContents, ...metadataContents]
    .map(describe)
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  metadataContents.set(
    "metadata/checksums.sha256",
    Buffer.from(
      `${checksumDescriptors.map(({ path, sha256 }) => `${sha256}  ${path}`).join("\n")}\n`,
    ),
  );
  const contents = new Map([...coreContents, ...metadataContents]);
  for (const [path, bytes] of contents) {
    const destination = join(artifactRoot, ...path.split("/"));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
  const payload = [...contents]
    .map(describe)
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  const descriptor = (path) => {
    const entry = payload.find((candidate) => candidate.path === path);
    return { path: entry.path, sha256: entry.sha256 };
  };
  const manifest = {
    $schema: "urn:aseos:release-schema:release-manifest:1.0.0",
    schemaVersion: "1.0.0",
    frameworkVersion: "0.1.0",
    gitCommit,
    buildId,
    builtAt,
    artifact: { kind: "NON_PRODUCTION_QUALIFICATION", productionApproved: false },
    platform: { id: "windows-x64", os: "windows", arch: "x64" },
    toolchain: { node: "24.19.0", pnpm: "11.24.0", typescript: "6.0.3" },
    runtime: {
      distribution: "node",
      version: "24.19.0",
      platform: "win-x64",
      archiveUrl: "https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-x64.zip",
      archiveSha256: runtimeArchiveSha256,
      executable: "node/node.exe",
    },
    contracts: {
      controlApi: "1.0.0",
      evidence: "1.0.0",
      isolation: "1.0.0",
      release: "1.0.0",
    },
    configSchemaVersion: "1.0.0",
    stateSchemaVersion: "1.0.0",
    supportedUpgradeSources: [],
    sbom: descriptor("metadata/sbom.spdx.json"),
    provenance: descriptor("metadata/provenance.json"),
    payload,
  };

  const writeManifest = async (value = manifest, bytes = canonicalJsonBytes(value)) => {
    await writeFile(join(artifactRoot, "release-manifest.json"), bytes);
  };
  const refreshPayload = async () => {
    for (const entry of manifest.payload) {
      const bytes = await readFile(join(artifactRoot, ...entry.path.split("/")));
      entry.sha256 = createHash("sha256").update(bytes).digest("hex");
      entry.sizeBytes = bytes.length;
    }
    manifest.sbom = descriptor("metadata/sbom.spdx.json");
    manifest.provenance = descriptor("metadata/provenance.json");
  };
  const rewriteBoundFile = async (path, bytes) => {
    await writeFile(join(artifactRoot, ...path.split("/")), bytes);
    await refreshPayload();
    await writeManifest();
  };
  const verify = (overrides = {}) =>
    verifyReleaseManifest({
      artifactRoot,
      expectedVersion: "0.1.0",
      expectedGitCommit: gitCommit,
      toolchainPath,
      runtimeLockPath,
      ...overrides,
    });
  return {
    artifactRoot,
    manifest,
    payload,
    provenance,
    sbom,
    verify,
    writeManifest,
    rewriteBoundFile,
    toolchainPath,
  };
}

describe("release canonical JSON", () => {
  test("is byte-stable in code-unit key order and normalizes negative zero", () => {
    const left = { z: -0, a: { beta: 2, alpha: 1 } };
    const right = { a: { alpha: 1, beta: 2 }, z: 0 };
    expect(canonicalJson(left)).toBe('{"a":{"alpha":1,"beta":2},"z":0}');
    expect(canonicalJsonBytes(left)).toEqual(canonicalJsonBytes(right));
    expect(sha256Bytes(canonicalJsonBytes(left))).toMatch(/^[0-9a-f]{64}$/u);
  });

  test("rejects values which do not have a JSON wire representation", () => {
    expect(() => canonicalJson({ missing: undefined })).toThrow("Non-JSON value");
    expect(() => canonicalJson({ number: Number.NaN })).toThrow("Non-finite number");
    const cyclic = {};
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow("Cyclic value");
  });
});

describe("release manifest verifier", () => {
  test("verifies canonical identity, authority versions and every payload byte", async () => {
    const subject = await fixture();
    await subject.writeManifest();
    await expect(subject.verify()).resolves.toMatchObject({
      result: "PASS",
      frameworkVersion: "0.1.0",
      gitCommit,
      payloadFiles: 5,
    });
  });

  test("rejects non-canonical JSON and unknown manifest fields", async () => {
    const subject = await fixture();
    await subject.writeManifest(
      subject.manifest,
      Buffer.from(`${JSON.stringify(subject.manifest, null, 2)}\n`),
    );
    await expect(subject.verify()).rejects.toThrow("NON_CANONICAL_JSON");

    const withUnknown = { ...subject.manifest, ungoverned: true };
    await subject.writeManifest(withUnknown);
    await expect(subject.verify()).rejects.toThrow("MANIFEST_SCHEMA_INVALID");
  });

  test("fails closed on payload hash, size and missing-file tampering", async () => {
    const subject = await fixture();
    await subject.writeManifest();
    const target = join(subject.artifactRoot, "metadata", "sbom.spdx.json");
    await writeFile(target, "tampered");
    await expect(subject.verify()).rejects.toThrow("RELEASE_PAYLOAD_SIZE_MISMATCH");

    const originalEntry = subject.payload.find((entry) => entry.path === "metadata/sbom.spdx.json");
    const sameSizeTamper = Buffer.alloc(originalEntry.sizeBytes, 0x78);
    await writeFile(target, sameSizeTamper);
    await expect(subject.verify()).rejects.toThrow("RELEASE_PAYLOAD_HASH_MISMATCH");

    await rm(target);
    await expect(subject.verify()).rejects.toThrow("RELEASE_PAYLOAD_MISSING");
  });

  test("rejects files which are not declared in the manifest inventory", async () => {
    const subject = await fixture();
    await subject.writeManifest();
    await writeFile(join(subject.artifactRoot, "undeclared.exe"), "not governed");
    await expect(subject.verify()).rejects.toThrow("RELEASE_PAYLOAD_INVENTORY_MISMATCH");
  });

  test("rejects duplicate, unsorted, traversal and self-referential payload paths", async () => {
    const subject = await fixture();
    const duplicate = {
      ...subject.manifest,
      payload: [...subject.manifest.payload, subject.manifest.payload.at(-1)],
    };
    await subject.writeManifest(duplicate);
    await expect(subject.verify()).rejects.toThrow("DUPLICATE_PAYLOAD_PATH");

    const unsorted = { ...subject.manifest, payload: [...subject.manifest.payload].reverse() };
    await subject.writeManifest(unsorted);
    await expect(subject.verify()).rejects.toThrow("NON_CANONICAL_MANIFEST");

    const selfReference = {
      ...subject.manifest,
      payload: [
        { path: "release-manifest.json", sha256: "0".repeat(64), sizeBytes: 1 },
        ...subject.manifest.payload,
      ],
    };
    await subject.writeManifest(selfReference);
    await expect(subject.verify()).rejects.toThrow("SELF_REFERENTIAL_MANIFEST");

    for (const unsafe of [
      "../escape",
      "a/../escape",
      "C:/escape",
      "/escape",
      "a\\b",
      "a//b",
      "NUL",
    ]) {
      expect(() => assertReleasePath(unsafe)).toThrow("UNSAFE_PAYLOAD_PATH");
    }
  });

  test("binds framework, commit, toolchain and official runtime lock", async () => {
    const subject = await fixture();
    await subject.writeManifest();
    await expect(subject.verify({ expectedVersion: "0.2.0" })).rejects.toThrow(
      "FRAMEWORK_VERSION_MISMATCH",
    );
    await expect(subject.verify({ expectedGitCommit: "c".repeat(40) })).rejects.toThrow(
      "GIT_COMMIT_MISMATCH",
    );

    const toolchain = JSON.parse(await readFile(subject.toolchainPath, "utf8"));
    toolchain.authority.pnpm = "11.25.0";
    await writeFile(subject.toolchainPath, JSON.stringify(toolchain));
    await expect(subject.verify()).rejects.toThrow("TOOLCHAIN_VERSION_MISMATCH");
  });

  test("binds SBOM, provenance and bundled runtime executable to payload", async () => {
    const subject = await fixture();
    const unbound = {
      ...subject.manifest,
      sbom: { ...subject.manifest.sbom, sha256: "f".repeat(64) },
    };
    await subject.writeManifest(unbound);
    await expect(subject.verify()).rejects.toThrow("BOUND_PAYLOAD_MISMATCH");

    const withoutRuntime = {
      ...subject.manifest,
      payload: subject.manifest.payload.filter((entry) => entry.path !== "node/node.exe"),
    };
    await subject.writeManifest(withoutRuntime);
    await expect(subject.verify()).rejects.toThrow("BOUND_PAYLOAD_MISMATCH");
  });

  test("rejects empty or runtime-drifted SPDX documents even when hashes are rebound", async () => {
    const subject = await fixture();
    await subject.rewriteBoundFile("metadata/sbom.spdx.json", canonicalJsonBytes({}));
    await expect(subject.verify()).rejects.toThrow("RELEASE_SBOM_INVALID");

    const wrongRuntime = cloneJson(subject.sbom);
    wrongRuntime.packages[0].versionInfo = "24.18.0";
    await subject.rewriteBoundFile("metadata/sbom.spdx.json", canonicalJsonBytes(wrongRuntime));
    await expect(subject.verify()).rejects.toThrow("RELEASE_SBOM_INVALID");

    const wrongRuntimeDigest = cloneJson(subject.sbom);
    wrongRuntimeDigest.packages[0].checksums[0].checksumValue = "c".repeat(64);
    await subject.rewriteBoundFile(
      "metadata/sbom.spdx.json",
      canonicalJsonBytes(wrongRuntimeDigest),
    );
    await expect(subject.verify()).rejects.toThrow("RELEASE_SBOM_INVALID");
  });

  test("requires exact payload package inventory and non-invented SPDX licenses", async () => {
    const subject = await fixture();
    const inventedLicense = cloneJson(subject.sbom);
    inventedLicense.packages[1].licenseDeclared = "MIT";
    await subject.rewriteBoundFile("metadata/sbom.spdx.json", canonicalJsonBytes(inventedLicense));
    await expect(subject.verify()).rejects.toThrow("RELEASE_SBOM_INVALID");

    const missingPackage = cloneJson(subject.sbom);
    missingPackage.packages.pop();
    await subject.rewriteBoundFile("metadata/sbom.spdx.json", canonicalJsonBytes(missingPackage));
    await expect(subject.verify()).rejects.toThrow("RELEASE_SBOM_INVALID");
  });

  test("rejects empty, incomplete and duplicate SLSA subjects after hash rebinding", async () => {
    const subject = await fixture();
    await subject.rewriteBoundFile("metadata/provenance.json", canonicalJsonBytes({}));
    await expect(subject.verify()).rejects.toThrow("RELEASE_PROVENANCE_INVALID");

    const incomplete = cloneJson(subject.provenance);
    incomplete.subject.pop();
    await subject.rewriteBoundFile("metadata/provenance.json", canonicalJsonBytes(incomplete));
    await expect(subject.verify()).rejects.toThrow("RELEASE_PROVENANCE_INVALID");

    const duplicate = cloneJson(subject.provenance);
    duplicate.subject.push(cloneJson(duplicate.subject[0]));
    await subject.rewriteBoundFile("metadata/provenance.json", canonicalJsonBytes(duplicate));
    await expect(subject.verify()).rejects.toThrow("RELEASE_PROVENANCE_INVALID");
  });

  test("binds SLSA parameters, resolved dependencies and invocation metadata", async () => {
    const subject = await fixture();
    const wrongExternalParameter = cloneJson(subject.provenance);
    wrongExternalParameter.predicate.buildDefinition.externalParameters.gitCommit = "d".repeat(40);
    await subject.rewriteBoundFile(
      "metadata/provenance.json",
      canonicalJsonBytes(wrongExternalParameter),
    );
    await expect(subject.verify()).rejects.toThrow("RELEASE_PROVENANCE_INVALID");

    const productionApproved = cloneJson(subject.provenance);
    productionApproved.predicate.buildDefinition.internalParameters.productionApproved = true;
    await subject.rewriteBoundFile(
      "metadata/provenance.json",
      canonicalJsonBytes(productionApproved),
    );
    await expect(subject.verify()).rejects.toThrow("RELEASE_PROVENANCE_INVALID");

    const wrongInvocation = cloneJson(subject.provenance);
    wrongInvocation.predicate.runDetails.metadata.invocationId = "different-build";
    await subject.rewriteBoundFile("metadata/provenance.json", canonicalJsonBytes(wrongInvocation));
    await expect(subject.verify()).rejects.toThrow("RELEASE_PROVENANCE_INVALID");
  });

  test("requires checksums to exactly cover every other payload once and in order", async () => {
    const subject = await fixture();
    const checksumPath = join(subject.artifactRoot, "metadata", "checksums.sha256");
    const original = await readFile(checksumPath, "utf8");
    const lines = original.trimEnd().split("\n");

    await subject.rewriteBoundFile(
      "metadata/checksums.sha256",
      Buffer.from(`${lines.slice(1).join("\n")}\n`),
    );
    await expect(subject.verify()).rejects.toThrow("RELEASE_CHECKSUMS_INVALID");

    await subject.rewriteBoundFile(
      "metadata/checksums.sha256",
      Buffer.from(`${original}${lines[0]}\n`),
    );
    await expect(subject.verify()).rejects.toThrow("RELEASE_CHECKSUMS_INVALID");

    const drifted = [...lines];
    drifted[0] = `${"e".repeat(64)}${drifted[0].slice(64)}`;
    await subject.rewriteBoundFile(
      "metadata/checksums.sha256",
      Buffer.from(`${drifted.join("\n")}\n`),
    );
    await expect(subject.verify()).rejects.toThrow("RELEASE_CHECKSUMS_INVALID");
  });
});
