import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { repositoryRoot } from "./helpers.mjs";

const artifactDirectory = "packages/contracts/examples/first-slice/artifacts";
const textControlPath = "packages/contracts/examples/first-slice/example-suite.json";

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

describe("raw example artifact Git checkout identity", () => {
  test("marks every tracked artifact as binary and preserves its canonical bytes", async () => {
    const artifactPaths = gitText([
      "ls-tree",
      "-r",
      "--name-only",
      "HEAD",
      "--",
      artifactDirectory,
    ]).split("\n");
    expect(artifactPaths.length).toBeGreaterThan(0);

    for (const path of artifactPaths) {
      expect(gitText(["check-attr", "--cached", "text", "--", path])).toBe(`${path}: text: unset`);

      const canonicalBlob = git(["cat-file", "blob", `HEAD:${path}`]);
      const filteredCheckout = gitFilteredBytes(path);
      const workingBytes = await readFile(resolve(repositoryRoot, path));

      expect(filteredCheckout.equals(canonicalBlob), path).toBe(true);
      expect(workingBytes.equals(canonicalBlob), path).toBe(true);
    }
  });

  test("exercises a normal text checkout conversion as a control", () => {
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
