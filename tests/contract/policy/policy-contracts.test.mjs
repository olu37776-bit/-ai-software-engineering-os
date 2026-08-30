import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { defaultRepositoryRoot, loadContractRegistry } from "@aseos/contracts";

const contracts = [
  [
    "urn:aseos:schema:capability-manifest:1.0.0",
    "capability-manifest.json",
    "capability-manifest-unknown-field.json",
  ],
  [
    "urn:aseos:schema:policy-evaluation-input:1.0.0",
    "policy-evaluation-input.json",
    "policy-evaluation-input-missing-clock.json",
  ],
  ["urn:aseos:schema:policy-rule:1.0.0", "policy-rule.json", "policy-rule-unknown-operator.json"],
  ["urn:aseos:schema:policy-set:1.0.0", "policy-set.json", "policy-set-default-allow.json"],
  [
    "urn:aseos:schema:policy-snapshot:1.0.0",
    "policy-snapshot.json",
    "policy-snapshot-unknown-field.json",
  ],
];

async function readExample(kind, name) {
  return JSON.parse(
    await readFile(
      resolve(defaultRepositoryRoot, "packages/contracts/examples/policy", kind, name),
      "utf8",
    ),
  );
}

describe("Phase 1 Policy Contract activation", () => {
  test.each(contracts)(
    "%s accepts its canonical example and rejects its fail-closed example",
    async (schemaId, validName, invalidName) => {
      const registry = await loadContractRegistry(defaultRepositoryRoot);
      const identity = { schemaId, schemaVersion: "1.0.0" };
      expect(registry.validate(identity, await readExample("valid", validName))).toMatchObject({
        ok: true,
        schemaId,
      });
      expect(registry.validate(identity, await readExample("invalid", invalidName))).toMatchObject({
        ok: false,
        schemaId,
        code: "SCHEMA_VALIDATION_FAILED",
      });
    },
  );

  test("registers exactly the Phase 1 policy authorities", async () => {
    const registry = await loadContractRegistry(defaultRepositoryRoot);
    const policyEntries = registry
      .list()
      .filter((entry) => entry.authorityPath.startsWith("packages/contracts/schemas/policy/"));
    expect(policyEntries.map((entry) => entry.schemaId).sort()).toEqual([
      "urn:aseos:schema:capability-manifest:1.0.0",
      "urn:aseos:schema:policy-decision:1.0.0",
      "urn:aseos:schema:policy-evaluation-input:1.0.0",
      "urn:aseos:schema:policy-rule:1.0.0",
      "urn:aseos:schema:policy-set:1.0.0",
      "urn:aseos:schema:policy-snapshot:1.0.0",
    ]);
  });
});
