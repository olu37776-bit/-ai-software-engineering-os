import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { expect, test } from "vitest";

import { qualifyArchitecture } from "../../scripts/architecture/qualify-architecture.mjs";
import {
  evaluatePackageGraph,
  loadArchitecturePolicy,
  loadGovernedPackageRecords,
} from "../../scripts/architecture/architecture-policy.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");

async function withRepository(action) {
  const root = await mkdtemp(resolve(tmpdir(), "aseos-architecture-review-"));
  try {
    for (const path of [
      "apps",
      "packages",
      "scripts",
      "operations",
      "toolchain",
      "tests/architecture",
      "package.json",
      "pnpm-workspace.yaml",
    ]) {
      await cp(resolve(repositoryRoot, path), resolve(root, path), {
        recursive: true,
        filter: (source) =>
          !source
            .split(/[\\/]/u)
            .some((part) => ["node_modules", "dist", "__pycache__"].includes(part)),
      });
    }
    await action(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("normal qualification includes all workspace applications with explicit dependency policy", async () => {
  const policy = await loadArchitecturePolicy(repositoryRoot);
  const records = await loadGovernedPackageRecords(repositoryRoot, policy);
  expect(
    records
      .filter((item) => item.root.startsWith("apps/"))
      .map((item) => item.root)
      .sort(),
  ).toEqual(["apps/cli", "apps/runtime", "apps/worker"]);
  expect(
    evaluatePackageGraph(records, { ...policy, sourceRoots: ["packages", "scripts/architecture"] })
      .violations,
  ).toContainEqual(
    expect.objectContaining({ code: "UNSCANNED_WORKSPACE_PACKAGE", subject: "apps/cli" }),
  );
});

test("normal live qualification rejects an application deep import", async () => {
  await withRepository(async (root) => {
    await writeFile(
      resolve(root, "apps/cli/src/review-probe.ts"),
      'import "@aseos/platform/internal";\n',
    );
    await expect(qualifyArchitecture(root)).rejects.toThrow("DEEP_IMPORT");
  });
});

test("normal live qualification rejects application module cycles", async () => {
  await withRepository(async (root) => {
    await writeFile(resolve(root, "apps/runtime/src/review-a.ts"), 'import "./review-b.js";\n');
    await writeFile(resolve(root, "apps/runtime/src/review-b.ts"), 'import "./review-a.js";\n');
    await expect(qualifyArchitecture(root)).rejects.toThrow("MODULE_CYCLE");
  });
});

test("an application cannot inherit the repository root's broad dependency allowance", async () => {
  await withRepository(async (root) => {
    await writeFile(
      resolve(root, "apps/cli/src/review-probe.ts"),
      'import "@aseos/persistence";\n',
    );
    await expect(qualifyArchitecture(root)).rejects.toThrow("@aseos/cli -> @aseos/persistence");
  });
});

test("a newly declared workspace without an explicit architecture owner fails qualification", async () => {
  await withRepository(async (root) => {
    const workspace = await readFile(resolve(root, "pnpm-workspace.yaml"), "utf8");
    await writeFile(
      resolve(root, "pnpm-workspace.yaml"),
      workspace.replace("packages:", "packages:\n  - apps/ungoverned"),
    );
    await mkdir(resolve(root, "apps/ungoverned"), { recursive: true });
    await writeFile(
      resolve(root, "apps/ungoverned/package.json"),
      JSON.stringify({ name: "@aseos/ungoverned", type: "module" }),
    );
    await expect(qualifyArchitecture(root)).rejects.toThrow("UNGOVERNED_WORKSPACE_PACKAGE");
  });
});
