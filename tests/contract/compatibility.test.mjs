import { beforeAll, describe, expect, test } from "vitest";

import {
  evaluateCompatibility,
  loadContractRegistry,
  qualifyCompatibility,
} from "@aseos/contracts";

import { repositoryRoot } from "./helpers.mjs";

describe("deterministic Contract compatibility harness", () => {
  let registry;
  const identity = {
    schemaId: "urn:aseos:schema:actor-ref:1.0.0",
    schemaVersion: "1.0.0",
  };

  beforeAll(async () => {
    registry = await loadContractRegistry(repositoryRoot);
  });

  test("accepts only the same registered identity/version pair", () => {
    expect(evaluateCompatibility(registry, identity)).toMatchObject({
      compatible: true,
      code: "SAME_SUPPORTED_VERSION",
    });
  });

  test("fails closed for unknown, future and mismatched versions", () => {
    expect(
      evaluateCompatibility(registry, {
        schemaId: "urn:aseos:schema:unknown:1.0.0",
        schemaVersion: "1.0.0",
      }),
    ).toMatchObject({ compatible: false, code: "UNKNOWN_SCHEMA" });
    expect(
      evaluateCompatibility(registry, {
        schemaId: "urn:aseos:schema:actor-ref:99.0.0",
        schemaVersion: "99.0.0",
      }),
    ).toMatchObject({ compatible: false, code: "UNSUPPORTED_SCHEMA_VERSION" });
    expect(evaluateCompatibility(registry, { ...identity, schemaVersion: "99.0.0" })).toMatchObject(
      { compatible: false, code: "SCHEMA_IDENTITY_VERSION_MISMATCH" },
    );
  });

  test("reports a deterministic qualification inventory", () => {
    expect(qualifyCompatibility(registry)).toEqual({
      evidenceType: "ContractCompatibilityResult",
      result: "PASS",
      probes: 4,
      compatible: 1,
      failClosed: 3,
    });
  });
});
