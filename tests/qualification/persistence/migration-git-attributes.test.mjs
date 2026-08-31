import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const migrationPath = "packages/persistence/migrations/001-initial.sql";
const textControlPath = "packages/persistence/migrations/manifest.json";

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
});
