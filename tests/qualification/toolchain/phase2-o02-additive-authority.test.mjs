import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, test } from "vitest";

import { P1_ACCEPTED_HEAD } from "../../../scripts/toolchain/phase2-scope-policy.mjs";
import {
  P2_O02_BRANCH,
  P2_O02_ID,
  P2_O02_EXACT_PATHS,
  P2_O02_PREFIXES,
  RESULT_SCHEMA_ID,
  RESULT_SCHEMA_PATH,
  RESULT_CONTRACT_ID,
  p2O02PathAllowed,
  validateP2O02Declarations,
  validateP2O02ContractDelta,
  validateP2O02RequiredScripts,
} from "../../../scripts/toolchain/phase2-scope-o02-policy.mjs";
import { verifyPhase2O02Scope } from "../../../scripts/toolchain/phase2-scope-o02.mjs";

const root = resolve(import.meta.dirname, "../../..");

async function delta() {
  const before = {};
  const after = {};
  for (const [key, path] of Object.entries({
    registry: "packages/contracts/schema-registry.json",
    inventory: "packages/contracts/schema-inventory.json",
    bindings: "packages/contracts/type-bindings.json",
    suite: "packages/contracts/examples/first-slice/example-suite.json",
  })) {
    const original = spawnSync("git", ["show", `${P1_ACCEPTED_HEAD}:${path}`], {
      cwd: root,
      encoding: "utf8",
      shell: false,
    });
    expect(original.status, original.stderr).toBe(0);
    before[key] = JSON.parse(original.stdout);
    after[key] = JSON.parse(await readFile(resolve(root, path), "utf8"));
  }
  return { before, after, schemaText: await readFile(resolve(root, RESULT_SCHEMA_PATH), "utf8") };
}

describe("P2-O02 single additive authority activation", () => {
  test("validates the actual additive schema, registry, inventory, bindings and two examples", async () => {
    expect(validateP2O02ContractDelta(await delta())).toMatchObject({ schemaId: RESULT_SCHEMA_ID });
  });

  test.each([
    [
      "registry hash",
      (value) => {
        value.after.registry.schemas[0].sha256 = "a".repeat(64);
      },
    ],
    [
      "registry identity",
      (value) => {
        value.after.registry.schemas[0].schemaId = "urn:forged";
      },
    ],
    [
      "old inventory owner",
      (value) => {
        value.after.inventory.contracts[0].canonicalOwner = "packages/workflow";
      },
    ],
    [
      "old inventory removal",
      (value) => {
        value.after.inventory.contracts.shift();
      },
    ],
    [
      "old binding",
      (value) => {
        value.after.bindings.bindings[0].exportName = "Forged";
      },
    ],
    [
      "old example",
      (value) => {
        value.after.suite.cases[0].expected = "INVALID";
      },
    ],
    [
      "metadata weakening",
      (value) => {
        value.after.registry.hashPolicy = "SKIP_HASHES";
      },
    ],
  ])("rejects mutation of %s", async (_name, mutate) => {
    const value = await delta();
    mutate(value);
    expect(() => validateP2O02ContractDelta(value)).toThrow(/P2_O02_EXISTING_/);
  });

  test.each([
    [
      "second schema",
      (value) => {
        value.after.registry.schemas.push({
          schemaId: "urn:unauthorized",
          authorityPath: "forged",
        });
      },
    ],
    [
      "duplicate schema",
      (value) => {
        value.after.registry.schemas.push(value.after.registry.schemas[0]);
      },
    ],
    [
      "wrong new schema ID",
      (value) => {
        value.schemaText = value.schemaText.replace(RESULT_SCHEMA_ID, "urn:forged");
      },
    ],
    [
      "wrong new owner",
      (value) => {
        value.after.inventory.contracts.find(
          (entry) => entry.contractId === RESULT_CONTRACT_ID,
        ).canonicalOwner = "packages/kernel";
      },
    ],
    [
      "unrelated new case",
      (value) => {
        value.after.suite.cases.at(-1).schemaId = value.after.suite.cases[0].schemaId;
      },
    ],
    [
      "incorrect example expectation",
      (value) => {
        value.after.suite.cases.at(-1).expected = "VALID";
      },
    ],
  ])("rejects %s", async (_name, mutate) => {
    const value = await delta();
    mutate(value);
    expect(() => validateP2O02ContractDelta(value)).toThrow(/P2_O02_/);
  });

  test("unbound or forged baseline declarations cannot self-authorize", () => {
    const operation = {
      schemaVersion: "1.0.0",
      operationId: P2_O02_ID,
      acceptedO01MainCommit: null,
      authorization: {
        source: "EXPLICIT_USER_CONTINUATION",
        contractMutation: "SINGLE_ADDITIVE_RESULT_JOURNAL_CONTRACT",
      },
    };
    const scope = {
      schemaVersion: "1.0.0",
      operationId: P2_O02_ID,
      enforcementMode: "DENY_BY_DEFAULT",
      exactPaths: P2_O02_EXACT_PATHS,
      prefixes: P2_O02_PREFIXES,
    };
    const execution = {
      schemaVersion: "1.0.0",
      operationId: P2_O02_ID,
      implementationBranch: P2_O02_BRANCH,
      baseCommit: null,
      status: "IN_PROGRESS",
      phase2Complete: false,
    };
    expect(() => validateP2O02Declarations(operation, scope, execution)).toThrow(
      "P2_O02_UNBOUND_OR_INVALID_ACCEPTED_BASELINE",
    );
    expect(() =>
      validateP2O02Declarations({ ...operation, acceptedO01MainCommit: "f".repeat(40) }, scope, {
        ...execution,
        baseCommit: "f".repeat(40),
      }),
    ).toThrow("P2_O02_UNBOUND_OR_INVALID_ACCEPTED_BASELINE");
  });

  test("denylist remains closed for migration, lifecycle, existing schemas and old phase records", () => {
    for (const path of [
      RESULT_SCHEMA_PATH,
      "packages/persistence/src/persistence-worker.ts",
      "tests/qualification/persistence/p2-result-journal.test.mjs",
    ])
      expect(p2O02PathAllowed(path)).toBe(true);
    for (const path of [
      "packages/persistence/migrations/003.sql",
      "packages/workflow/src/index.ts",
      "packages/kernel/src/index.ts",
      "packages/contracts/schemas/kernel/command-envelope.schema.json",
      "packages/contracts/planned-contracts.json",
      "operations/phase-1/authority-lock.json",
      "operations/phase-2/operation.json",
      "operations/phase-2/executions/p2-o01-durable-kernel.json",
      ".github/workflows/quality.yml",
    ])
      expect(p2O02PathAllowed(path), path).toBe(false);
  });

  test("O01 required checks stay unchanged while result qualification is added", () => {
    const before = {
      scripts: {
        quality: "pnpm run kernel:qualify && pnpm run test",
        "kernel:qualify": "kernel-command",
        test: "test-command",
      },
    };
    const after = {
      scripts: {
        ...before.scripts,
        quality: "pnpm run kernel:qualify && pnpm run result-journal:qualify && pnpm run test",
        "result-journal:qualify":
          "pnpm run build && node scripts/qualification/persistence/qualify-result-journal.mjs",
      },
    };
    expect(() => validateP2O02RequiredScripts(before, after)).not.toThrow();
    expect(() =>
      validateP2O02RequiredScripts(before, {
        scripts: { ...after.scripts, quality: "pnpm run result-journal:qualify" },
      }),
    ).toThrow("P2_O02_REQUIRED_QUALITY_WEAKENED");
    expect(() =>
      validateP2O02RequiredScripts(before, { scripts: { ...after.scripts, test: "true" } }),
    ).toThrow("P2_O02_REQUIRED_SCRIPT_CHANGED");
  });

  test("unknown O02 event or operation fails before it can use a baseline", async () => {
    await expect(verifyPhase2O02Scope({ branch: P2_O02_BRANCH, event: "unknown" })).rejects.toThrow(
      "P2_O02_UNKNOWN_EVENT",
    );
    await expect(
      verifyPhase2O02Scope({ branch: P2_O02_BRANCH, explicitOperation: "P2-O99" }),
    ).rejects.toThrow("P2_O02_UNKNOWN_OPERATION");
  });
});
