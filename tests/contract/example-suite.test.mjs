import { cp } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { loadContractRegistry, validateExampleSuite } from "@aseos/contracts";

import { readJson, repositoryRoot, withContractRepository, writeJson } from "./helpers.mjs";

const suitePath = "packages/contracts/examples/first-slice/example-suite.json";

describe("first-slice executable examples", () => {
  test("accepts every valid fixture and rejects every invalid fixture", async () => {
    const registry = await loadContractRegistry(repositoryRoot);
    await expect(validateExampleSuite(registry)).resolves.toEqual({
      evidenceType: "ExampleSuiteResult",
      result: "PASS",
      totalCases: 38,
      validAccepted: 19,
      invalidRejected: 19,
      semanticAssertions: 22,
    });
  });

  test("does not infer invalidity from a fixture filename", async () => {
    await withContractRepository(async (root) => {
      await cp(
        resolve(root, "packages/contracts/examples/first-slice/valid/actor-ref.json"),
        resolve(
          root,
          "packages/contracts/examples/first-slice/invalid/actor-ref-unknown-field.json",
        ),
      );
      const registry = await loadContractRegistry(root);
      await expect(validateExampleSuite(registry)).rejects.toThrow(
        /Expected invalid example was accepted/u,
      );
    });
  });

  test("fails closed for missing, duplicate and unknown-schema fixture bindings", async () => {
    await withContractRepository(async (root) => {
      const suite = await readJson(root, suitePath);
      suite.cases[0].instancePath = "packages/contracts/examples/first-slice/valid/missing.json";
      await writeJson(root, suitePath, suite);
      const registry = await loadContractRegistry(root);
      await expect(validateExampleSuite(registry)).rejects.toMatchObject({
        code: "MISSING_AUTHORITY_FILE",
      });
    });
    await withContractRepository(async (root) => {
      const suite = await readJson(root, suitePath);
      suite.cases[1].caseId = suite.cases[0].caseId;
      await writeJson(root, suitePath, suite);
      const registry = await loadContractRegistry(root);
      await expect(validateExampleSuite(registry)).rejects.toMatchObject({
        code: "VALIDATION_INPUT_INVALID",
      });
    });
    await withContractRepository(async (root) => {
      const suite = await readJson(root, suitePath);
      suite.cases[0].schemaId = "urn:aseos:schema:not-registered:1.0.0";
      await writeJson(root, suitePath, suite);
      const registry = await loadContractRegistry(root);
      await expect(validateExampleSuite(registry)).rejects.toMatchObject({
        code: "SCHEMA_METADATA_MISMATCH",
      });
    });
  });

  test("requires invalid cases to prove their declared boundary violation", async () => {
    await withContractRepository(async (root) => {
      const suite = await readJson(root, suitePath);
      const invalid = suite.cases.find((candidate) => candidate.expected === "INVALID");
      invalid.expectedError.keyword = "enum";
      await writeJson(root, suitePath, suite);
      const registry = await loadContractRegistry(root);
      await expect(validateExampleSuite(registry)).rejects.toThrow(
        /did not prove its declared boundary violation/u,
      );
    });
  });
});
