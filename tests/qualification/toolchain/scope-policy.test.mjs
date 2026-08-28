import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import {
  isPhase1GovernedPath,
  resolveOperationDefinition,
  selectEvidenceOperation,
  validateExecutionRecord,
  validateOperationChangedPaths,
  validateP1O02StartGate,
} from "../../../scripts/toolchain/scope-policy.mjs";

const root = resolve(import.meta.dirname, "../../..");

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

const [operationManifest, writeScope, authorityLock] = await Promise.all([
  readJson("operations/phase-1/operation.json"),
  readJson("operations/phase-1/write-scope.json"),
  readJson("operations/phase-1/authority-lock.json"),
]);

describe("operation-aware Phase 1 scope policy", () => {
  test.each(operationManifest.suboperations.map(({ operationId }) => [operationId]))(
    "resolves the unique frozen operation and scope for %s",
    (operationId) => {
      expect(resolveOperationDefinition(operationId, operationManifest, writeScope)).toMatchObject({
        manifestOperation: { operationId, writeScopeOperationId: operationId },
        operationScope: { operationId },
      });
    },
  );

  test("fails closed for unknown and ambiguous operation identity", () => {
    expect(() => resolveOperationDefinition("P1-O10", operationManifest, writeScope)).toThrow(
      "UNKNOWN_OPERATION",
    );
    const ambiguousScope = {
      ...writeScope,
      operations: [...writeScope.operations, writeScope.operations[1]],
    };
    expect(() => resolveOperationDefinition("P1-O02", operationManifest, ambiguousScope)).toThrow(
      "AMBIGUOUS_OPERATION",
    );
  });

  test("accepts an O02 Contract fixture under O02 and rejects it under O01", () => {
    const fixture = ["packages/contracts/src/runtime-validator.ts"];
    expect(validateOperationChangedPaths(fixture, "P1-O02", writeScope, authorityLock)).toEqual([]);
    expect(validateOperationChangedPaths(fixture, "P1-O01", writeScope, authorityLock)).toContain(
      "DENIED: packages/contracts/src/runtime-validator.ts",
    );
  });

  test("rejects global, operation and broad Phase 1 bypass paths", () => {
    expect(
      validateOperationChangedPaths(
        ["docs/decisions/ADR-0007-typescript-toolchain-baseline.md"],
        "P1-O02",
        writeScope,
        authorityLock,
      ),
    ).toEqual(
      expect.arrayContaining([
        "DENIED: docs/decisions/ADR-0007-typescript-toolchain-baseline.md",
        "IMMUTABLE: docs/decisions/ADR-0007-typescript-toolchain-baseline.md",
      ]),
    );
    expect(
      validateOperationChangedPaths(
        ["packages/kernel/src/index.ts"],
        "P1-O02",
        writeScope,
        authorityLock,
      ),
    ).toContain("DENIED: packages/kernel/src/index.ts");
    expect(
      validateOperationChangedPaths(
        ["operations/phase-1/unapproved-bypass.json"],
        "P1-O02",
        writeScope,
        authorityLock,
      ),
    ).toContain("NOT_ALLOWED: operations/phase-1/unapproved-bypass.json");
    expect(
      isPhase1GovernedPath("operations/phase-1/unapproved-bypass.json", writeScope, authorityLock),
    ).toBe(true);
  });

  test("enforces operation-scoped Authority Lock ownership", () => {
    const path = "packages/contracts/schema-registry.json";
    expect(validateOperationChangedPaths([path], "P1-O02", writeScope, authorityLock)).toEqual([]);
    expect(validateOperationChangedPaths([path], "P1-O04", writeScope, authorityLock)).toContain(
      `AUTHORITY_OPERATION_DENIED: ${path}`,
    );
  });

  test("binds execution path, operation identity, branch and base metadata", () => {
    const valid = {
      operationId: "P1-O02",
      writeScopeOperationId: "P1-O02",
      implementationBranch: "phase-1/p1-o02-contract-foundation",
      baseCommit: "6bc651f7db0dc979b63cdafbc6d4747fdd26f8e9",
    };
    expect(
      validateExecutionRecord(
        "operations/phase-1/executions/p1-o02-contracts.json",
        valid,
        operationManifest,
        writeScope,
      ),
    ).toBe("P1-O02");
    expect(() =>
      validateExecutionRecord(
        "operations/phase-1/executions/p1-o01-contracts.json",
        valid,
        operationManifest,
        writeScope,
      ),
    ).toThrow("MISMATCHED_EXECUTION_OPERATION");
  });

  test("selects independent Evidence only from one operation namespace", () => {
    expect(selectEvidenceOperation(["operations/phase-1/evidence/o02/p1-v03.json"])).toBe("P1-O02");
    expect(
      selectEvidenceOperation([
        "operations/phase-1/evidence/o01/gate.json",
        "operations/phase-1/evidence/o02/gate.json",
      ]),
    ).toBeUndefined();
    expect(selectEvidenceOperation(["docs/reviews/phase-1-gate.md"])).toBeUndefined();
  });

  test("keeps P1-O02 blocked until an independent Issue #11 PASS Gate", () => {
    const passGate = {
      schemaVersion: "1.0.0",
      evidenceType: "IndependentPhase1TransitionGate",
      trackingIssue: 11,
      decision: "PASS",
      subject: {
        remediationImplementationCommit: "0123456789abcdef0123456789abcdef01234567",
      },
      verifier: { role: "INDEPENDENT_VERIFIER", independent: true },
      authorization: { p1O02Start: "RELEASED" },
    };
    expect(validateP1O02StartGate(passGate)).toBe("0123456789abcdef0123456789abcdef01234567");
    expect(() => validateP1O02StartGate({ ...passGate, decision: "IMPLEMENTED" })).toThrow(
      "P1_O02_START_BLOCKED",
    );
    expect(() =>
      validateP1O02StartGate({
        ...passGate,
        verifier: { role: "IMPLEMENTATION_AGENT", independent: false },
      }),
    ).toThrow("P1_O02_START_BLOCKED");
  });
});
