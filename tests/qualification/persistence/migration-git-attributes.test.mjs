import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterEach, describe, expect, test } from "vitest";

import { readMigrationAssets } from "../../../packages/persistence/dist/migration-assets.js";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const migrationPath = "packages/persistence/migrations/001-initial.sql";
const textControlPath = "packages/persistence/migrations/manifest.json";
const roots = [];

async function migrationFixture() {
  const root = await mkdtemp(join(tmpdir(), "aseos-p1-o05-migration-"));
  roots.push(root);
  await mkdir(join(root, "migrations"), { recursive: true });
  await cp(
    join(repositoryRoot, "packages", "persistence", "migrations"),
    join(root, "migrations"),
    { recursive: true },
  );
  return { root, packageRootUrl: pathToFileURL(root + sep) };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

function git(args, encoding = null) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      [
        `git ${args.join(" ")} exited ${result.status}`,
        result.stdout?.toString(),
        result.stderr?.toString(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result.stdout;
}

function gitText(args) {
  return git(args, "utf8").trim();
}

function gitFilteredBytes(path) {
  return git([
    "-c",
    "core.autocrlf=true",
    "cat-file",
    "--filters",
    `--path=${path}`,
    `HEAD:${path}`,
  ]);
}

describe("persistence migration Git checkout identity", () => {
  test("preserves checksum-bound SQL bytes when core.autocrlf is enabled", () => {
    expect(gitText(["check-attr", "--cached", "text", "--", migrationPath])).toBe(
      `${migrationPath}: text: unset`,
    );

    const canonicalBlob = git(["cat-file", "blob", `HEAD:${migrationPath}`]);
    const filteredCheckout = gitFilteredBytes(migrationPath);

    expect(canonicalBlob.includes("\r".charCodeAt(0))).toBe(false);
    expect(filteredCheckout.equals(canonicalBlob)).toBe(true);
  });

  test("exercises CRLF conversion for an adjacent text file as a control", () => {
    const canonicalBlob = git(["cat-file", "blob", `HEAD:${textControlPath}`]);
    const filteredCheckout = gitFilteredBytes(textControlPath);
    const expectedCrLf = Buffer.from(
      canonicalBlob.toString("utf8").replaceAll("\n", "\r\n"),
      "utf8",
    );

    expect(canonicalBlob.includes("\r".charCodeAt(0))).toBe(false);
    expect(filteredCheckout.equals(canonicalBlob)).toBe(false);
    expect(filteredCheckout.equals(expectedCrLf)).toBe(true);
  });

  test("rejects raw migration byte drift before execution", async () => {
    const { root, packageRootUrl } = await migrationFixture();
    const sqlPath = join(root, "migrations", "001-initial.sql");
    const canonical = await readFile(sqlPath);
    await writeFile(sqlPath, Buffer.concat([canonical, Buffer.from("\n-- raw-byte-drift\n")]));

    await expect(readMigrationAssets(packageRootUrl)).rejects.toThrow(/checksum mismatch/u);
  });

  test("rejects malformed UTF-8 even when its raw checksum is authorized", async () => {
    const { root, packageRootUrl } = await migrationFixture();
    const sqlPath = join(root, "migrations", "001-initial.sql");
    const manifestPath = join(root, "migrations", "manifest.json");
    const canonical = await readFile(sqlPath);
    const malformed = Buffer.concat([
      canonical,
      Buffer.from([0x0a, 0x2d, 0x2d, 0x20, 0xc3, 0x28, 0x0a]),
    ]);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.migrations[0].sha256 = createHash("sha256").update(malformed).digest("hex");
    await writeFile(sqlPath, malformed);
    await writeFile(manifestPath, JSON.stringify(manifest) + "\n", "utf8");

    await expect(readMigrationAssets(packageRootUrl)).rejects.toThrow(/not valid UTF-8/u);
  });
});
