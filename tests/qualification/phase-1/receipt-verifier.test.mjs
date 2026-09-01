import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { verifyPhase1Receipt } from "../../../scripts/verify-phase-1/receipt-verifier.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const verifierPath = join(repositoryRoot, "scripts/verify-phase-1/verify-receipt.mjs");
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Phase 1 receipt verifier bootstrap qualification", () => {
  test("fails closed before parsing an external receipt", async () => {
    const directory = await mkdtemp(join(tmpdir(), "aseos-p1-external-receipt-"));
    temporaryDirectories.push(directory);
    const receiptPath = join(directory, "implementation-receipt.json");
    await writeFile(receiptPath, "{}\n", "utf8");

    const result = await verifyPhase1Receipt({
      repositoryRoot,
      receiptPath,
      executingVerifierPath: verifierPath,
    });

    expect(result.result).toBe("FAIL");
    expect(result.errors.map(({ code }) => code)).toContain("NON_CANONICAL_RECEIPT_PATH");
    expect(result.checks).toHaveLength(1);
  });

  test("fails closed when the verifier entrypoint is not canonical", async () => {
    const result = await verifyPhase1Receipt({
      repositoryRoot,
      receiptPath: join(repositoryRoot, "operations/phase-1/implementation-receipt.json"),
      executingVerifierPath: join(repositoryRoot, "scripts/verify-phase-1/receipt-verifier.mjs"),
    });

    expect(result.result).toBe("FAIL");
    expect(result.errors.map(({ code }) => code)).toContain("NON_CANONICAL_VERIFIER_ENTRYPOINT");
  });
});
