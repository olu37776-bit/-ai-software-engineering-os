import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

import { describe, expect, test } from "vitest";

import { assembleWindowsX64 } from "../../../scripts/release/assemble-windows-x64.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const fixedCommit = "44415c7ca641be439faa064d81079f6d3c88a39f";
const fixedBuiltAt = "2026-09-01T00:00:00.000Z";

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralBytes = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralBytes, eocd]);
}

async function fileDigests(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) result.push(...(await fileDigests(root, path)));
    else {
      const bytes = await readFile(path);
      result.push({
        path: relative(root, path).split(sep).join("/"),
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  return result.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

describe("P1-O08 deterministic Windows x64 artifact assembly", () => {
  test("assembles the same self-contained payload in Unicode and space paths", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "ASEOS P1-O08 中文 空格 "));
    try {
      const archive = storedZip([
        ["node-v24.19.0-win-x64/node.exe", Buffer.from("MZsynthetic qualification node")],
        ["node-v24.19.0-win-x64/LICENSE", Buffer.from("Synthetic test fixture only\n")],
      ]);
      const runtimeArchive = join(temporaryRoot, "node runtime.zip");
      await writeFile(runtimeArchive, archive);
      const archiveSha256 = createHash("sha256").update(archive).digest("hex");
      const runtimeLock = {
        schemaVersion: "1.0.0",
        runtime: {
          distribution: "node",
          version: "24.19.0",
          platform: "win-x64",
          archiveUrl: "https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-x64.zip",
          sha256: archiveSha256,
          executableEntry: "node-v24.19.0-win-x64/node.exe",
        },
      };
      const outputOne = join(temporaryRoot, "产物 one");
      const outputTwo = join(temporaryRoot, "产物 two");
      const common = {
        sourceRoot: repositoryRoot,
        runtimeArchive,
        runtimeLock,
        gitCommit: fixedCommit,
        builtAt: fixedBuiltAt,
        buildId: "p1-o08-determinism",
      };
      await assembleWindowsX64({ ...common, output: outputOne });
      await assembleWindowsX64({ ...common, output: outputTwo });

      expect(await fileDigests(outputOne)).toEqual(await fileDigests(outputTwo));
      const manifest = JSON.parse(await readFile(join(outputOne, "release-manifest.json"), "utf8"));
      expect(manifest).toMatchObject({
        schemaVersion: "1.0.0",
        gitCommit: fixedCommit,
        builtAt: fixedBuiltAt,
        artifact: { kind: "NON_PRODUCTION_QUALIFICATION", productionApproved: false },
        runtime: {
          version: "24.19.0",
          archiveSha256,
          executable: "node/node.exe",
        },
      });
      expect(manifest.payload.map(({ path }) => path)).toEqual(
        [...manifest.payload.map(({ path }) => path)].sort(),
      );
      expect(manifest.payload).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "node/node.exe", sizeBytes: expect.any(Number) }),
          expect.objectContaining({ path: "aseos.cmd" }),
          expect.objectContaining({ path: "app/apps/cli/dist/main.js" }),
          expect.objectContaining({ path: "app/apps/runtime/dist/main.js" }),
          expect.objectContaining({ path: "app/node_modules/@aseos/platform/dist/index.js" }),
          expect.objectContaining({ path: "metadata/checksums.sha256" }),
          expect.objectContaining({ path: "metadata/sbom.spdx.json" }),
          expect.objectContaining({ path: "metadata/provenance.json" }),
        ]),
      );
      expect(manifest.payload.some(({ path }) => path === "release-manifest.json")).toBe(false);
      expect(await readFile(join(outputOne, "aseos.cmd"), "utf8")).toContain(
        '"%~dp0node\\node.exe"',
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }, 30_000);

  test("rejects any runtime archive that does not match the locked SHA-256", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "ASEOS P1-O08 integrity "));
    try {
      const runtimeArchive = join(temporaryRoot, "tampered.zip");
      await writeFile(runtimeArchive, Buffer.from("not the locked archive"));
      await expect(
        assembleWindowsX64({
          sourceRoot: repositoryRoot,
          runtimeArchive,
          output: join(temporaryRoot, "must-not-exist"),
          gitCommit: fixedCommit,
          builtAt: fixedBuiltAt,
        }),
      ).rejects.toThrow(/^RUNTIME_ARCHIVE_SHA256_MISMATCH:/u);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  test("pins the official Node 24.19.0 Windows x64 archive", async () => {
    const lock = JSON.parse(
      await readFile(
        join(repositoryRoot, "scripts", "release", "windows-runtime-lock.json"),
        "utf8",
      ),
    );
    expect(lock.runtime).toEqual({
      distribution: "node",
      version: "24.19.0",
      platform: "win-x64",
      archiveUrl: "https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-x64.zip",
      sha256: "57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73",
      executableEntry: "node-v24.19.0-win-x64/node.exe",
    });
  });
});
