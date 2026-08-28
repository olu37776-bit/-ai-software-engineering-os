import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(repositoryRoot, relativePath), "utf8"));
}

export function sha256Utf8Lf(contents) {
  const normalized = contents.replace(/\r\n?/g, "\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export async function sha256Utf8LfFile(relativePath) {
  const contents = await readFile(resolve(repositoryRoot, relativePath), "utf8");
  return sha256Utf8Lf(contents);
}

export function run(command, args, options = {}) {
  let executable = command;
  let effectiveArgs = args;
  if (command === "pnpm" && process.env.npm_execpath) {
    executable = process.execPath;
    effectiveArgs = [process.env.npm_execpath, ...args];
  }
  const result = spawnSync(executable, effectiveArgs, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    shell: false,
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      [
        `${executable} ${effectiveArgs.join(" ")} exited ${result.status}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result.stdout.trim();
}

export function reportAndExit(report) {
  console.log(JSON.stringify(report, null, 2));
}
