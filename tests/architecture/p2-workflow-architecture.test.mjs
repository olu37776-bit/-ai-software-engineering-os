import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  evaluatePackageGraph,
  loadArchitecturePolicy,
} from "../../scripts/architecture/architecture-policy.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");

describe("P2 workflow dependency boundaries", () => {
  test("registers the pure workflow owner and keeps kernel storage/platform independent", async () => {
    const policy = await loadArchitecturePolicy(repositoryRoot);
    const kernel = policy.packages.find((entry) => entry.name === "@aseos/kernel");
    const workflow = policy.packages.find((entry) => entry.name === "@aseos/workflow");
    expect(kernel.allowedWorkspaceDependencies).toEqual(["@aseos/contracts"]);
    expect(workflow.allowedWorkspaceDependencies).toEqual(["@aseos/contracts", "@aseos/kernel"]);
    for (const [name, root, dependency] of [
      ["@aseos/kernel", "packages/kernel", "@aseos/persistence"],
      ["@aseos/kernel", "packages/kernel", "@aseos/workflow"],
      ["@aseos/workflow", "packages/workflow", "@aseos/platform"],
    ]) {
      const result = evaluatePackageGraph(
        [
          {
            root,
            manifest: {
              name,
              type: "module",
              exports: { ".": "./dist/index.js" },
              dependencies: { [dependency]: "workspace:*" },
            },
          },
        ],
        policy,
      );
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "DEPENDENCY_INVERSION" })]),
      );
    }
  });
});
