import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(repositoryRoot, relativePath), "utf8"));
}

export async function sha256File(relativePath) {
  const contents = await readFile(resolve(repositoryRoot, relativePath));
  return createHash("sha256").update(contents).digest("hex");
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
