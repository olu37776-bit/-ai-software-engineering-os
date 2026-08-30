import { describe, expect, test } from "vitest";

import { qualifyContracts } from "../../scripts/contracts/qualify-contracts.mjs";
import { repositoryRoot } from "./helpers.mjs";

describe("P1-V03-CONTRACTS", () => {
  test("produces all four required Evidence result types", async () => {
    const result = await qualifyContracts(repositoryRoot);
    expect(result).toMatchObject({
      gateStepId: "P1-V03-CONTRACTS",
      result: "PASS",
      schemaMetaValidation: { evidenceType: "SchemaMetaValidationResult", result: "PASS" },
      schemaRegistryValidation: {
        evidenceType: "SchemaRegistryValidationResult",
        result: "PASS",
      },
      exampleSuite: { evidenceType: "ExampleSuiteResult", result: "PASS" },
      schemaTypeConsistency: {
        evidenceType: "SchemaTypeConsistencyResult",
        result: "PASS",
      },
      compatibility: { result: "PASS" },
      runtimeValidation: { result: "PASS" },
    });
  });
});
