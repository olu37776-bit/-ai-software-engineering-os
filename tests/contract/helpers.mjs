import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";

export const repositoryRoot = resolve(import.meta.dirname, "../..");

export async function readJson(root, path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

export async function writeJson(root, path, value) {
  const target = resolve(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function sha256File(root, path) {
  return createHash("sha256")
    .update(await readFile(resolve(root, path)))
    .digest("hex");
}

export async function updateRegistryHash(root, authorityPath) {
  const registry = await readJson(root, "packages/contracts/schema-registry.json");
  const entry = registry.schemas.find((candidate) => candidate.authorityPath === authorityPath);
  if (!entry) throw new Error(`Missing registry entry for ${authorityPath}`);
  entry.sha256 = await sha256File(root, authorityPath);
  await writeJson(root, "packages/contracts/schema-registry.json", registry);
}

function isRepositoryFixtureSource(source) {
  const segments = relative(repositoryRoot, source).split(/[\\/]/u);
  return !segments.includes("node_modules") && !segments.includes("dist");
}

export async function withContractRepository(action) {
  const root = await mkdtemp(resolve(tmpdir(), "aseos-contract-repository-"));
  try {
    await Promise.all([
      cp(resolve(repositoryRoot, "packages/contracts"), resolve(root, "packages/contracts"), {
        filter: isRepositoryFixtureSource,
        recursive: true,
      }),
      cp(resolve(repositoryRoot, "operations/phase-1"), resolve(root, "operations/phase-1"), {
        filter: isRepositoryFixtureSource,
        recursive: true,
      }),
    ]);
    return await action(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
