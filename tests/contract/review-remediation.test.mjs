import fc from "fast-check";
import { beforeAll, expect, test } from "vitest";

import { canonicalJson, canonicalJsonSha256, loadContractRegistry } from "@aseos/contracts";
import { readJson, repositoryRoot } from "./helpers.mjs";
import { runSchemaTypeConsistency } from "../../scripts/contracts/schema-type-consistency.mjs";

let registry;
beforeAll(async () => {
  registry = await loadContractRegistry(repositoryRoot);
});

test.each(
  [
    Array(1),
    Array(2),
    Object.assign(Array(3), { 0: 1, 2: 3 }),
    [undefined],
    new Date(),
    new Map(),
    new Set(),
    { x: undefined },
  ].map((value) => [value]),
)(
  "canonical serialization rejects unsupported JavaScript values instead of losing data: %j",
  (value) => {
    expect(() => canonicalJson(value)).toThrow(TypeError);
    expect(() => canonicalJsonSha256(value)).toThrow(TypeError);
  },
);

test("canonical serialization rejects cycles, accessors and hidden properties", () => {
  const cyclic = {};
  cyclic.self = cyclic;
  let invoked = false;
  const accessor = {
    get value() {
      invoked = true;
      return 1;
    },
  };
  const hidden = Object.defineProperty({}, "hidden", { value: 1 });
  for (const value of [cyclic, accessor, hidden, { [Symbol("hidden")]: 1 }]) {
    expect(() => canonicalJson(value)).toThrow(TypeError);
  }
  expect(invoked).toBe(false);
});

test("canonical JSON round trips valid nested JSON and remains stable", () => {
  fc.assert(
    fc.property(fc.jsonValue(), (value) => {
      const encoded = canonicalJson(value);
      expect(JSON.parse(encoded)).toEqual(JSON.parse(JSON.stringify(value)));
      expect(canonicalJson(JSON.parse(encoded))).toBe(encoded);
    }),
    { numRuns: 500 },
  );
});

test.each([
  "2026-99-08T12:00:00Z",
  "2026-02-31T12:00:00Z",
  "2025-02-29T12:00:00Z",
  "1900-02-29T12:00:00Z",
  "2026-00-01T00:00:00Z",
  "2026-01-00T00:00:00Z",
  "2026-01-01T24:00:00Z",
  "2026-01-01T00:60:00Z",
  "2026-01-01T00:00:61Z",
  "2026-01-01T00:00:00+99:00",
  "2026-01-01T00:00:00+00:60",
  "2026-01-01T00:00:60Z",
])("the canonical runtime validator rejects impossible date-time %s", async (timestamp) => {
  const health = await readJson(
    repositoryRoot,
    "packages/contracts/examples/control-api/valid/runtime-health.json",
  );
  health.checkedAt = timestamp;
  const result = registry.validate(
    { schemaId: "urn:aseos:schema:runtime-health:1.0.0", schemaVersion: "1.0.0" },
    health,
  );
  expect(result.ok).toBe(false);
  expect(result.errors).toContainEqual(
    expect.objectContaining({ keyword: "format", instancePath: "/checkedAt" }),
  );
});

test.each([
  "2024-02-29T23:59:59Z",
  "2000-02-29T00:00:00Z",
  "2026-01-01t00:00:00z",
  "2026-09-08T12:00:00.123+08:00",
  "1990-12-31T23:59:60Z",
  "1990-12-31T15:59:60-08:00",
])("the canonical runtime validator accepts valid date-time %s", async (timestamp) => {
  const health = await readJson(
    repositoryRoot,
    "packages/contracts/examples/control-api/valid/runtime-health.json",
  );
  health.checkedAt = timestamp;
  expect(
    registry.validate(
      { schemaId: "urn:aseos:schema:runtime-health:1.0.0", schemaVersion: "1.0.0" },
      health,
    ).ok,
  ).toBe(true);
});

test("type consistency detects operator drift below allOf and multiple local references", async () => {
  const schema = await readJson(
    repositoryRoot,
    "packages/contracts/schemas/policy/policy-rule.schema.json",
  );
  schema.$defs.conditionLeaf.properties.operator.enum =
    schema.$defs.conditionLeaf.properties.operator.enum.filter((operator) => operator !== "eq");
  await expect(
    runSchemaTypeConsistency({ repositoryRoot, schemaOverrides: new Map([[schema.$id, schema]]) }),
  ).rejects.toThrow("SCHEMA_TYPE_SEMANTIC_DRIFT");
});
