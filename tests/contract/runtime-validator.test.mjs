import { beforeAll, describe, expect, test } from "vitest";

import { loadContractRegistry } from "@aseos/contracts";

import { repositoryRoot } from "./helpers.mjs";

describe("canonical runtime Contract validator", () => {
  let registry;
  const identity = {
    schemaId: "urn:aseos:schema:actor-ref:1.0.0",
    schemaVersion: "1.0.0",
  };

  beforeAll(async () => {
    registry = await loadContractRegistry(repositoryRoot);
  });

  test("accepts a valid canonical payload and returns structured success", () => {
    expect(registry.validate(identity, { actorType: "SYSTEM", actorId: "kernel" })).toEqual({
      ok: true,
      ...identity,
      value: { actorType: "SYSTEM", actorId: "kernel" },
    });
  });

  test("rejects unknown fields at a public boundary", () => {
    const result = registry.validate(identity, {
      actorType: "SYSTEM",
      actorId: "kernel",
      hiddenAuthority: true,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("SCHEMA_VALIDATION_FAILED");
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyword: "additionalProperties", instancePath: "" }),
      ]),
    );
  });

  test("fails closed for unknown schema and unsupported versions", () => {
    expect(
      registry.validate({ schemaId: "urn:aseos:schema:unknown:1.0.0", schemaVersion: "1.0.0" }, {}),
    ).toMatchObject({ ok: false, code: "UNKNOWN_SCHEMA" });
    expect(
      registry.validate(
        { schemaId: "urn:aseos:schema:actor-ref:99.0.0", schemaVersion: "99.0.0" },
        {},
      ),
    ).toMatchObject({ ok: false, code: "UNSUPPORTED_SCHEMA_VERSION" });
    expect(registry.validate({ ...identity, schemaVersion: "2.0.0" }, {})).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_SCHEMA_VERSION",
    });
  });

  test("reuses compiled validators without changing authority", () => {
    const first = registry.validate(identity, { actorType: "SYSTEM", actorId: "one" });
    const second = registry.validate(identity, { actorType: "SYSTEM", actorId: "two" });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(registry.list()).toHaveLength(31);
  });
});
