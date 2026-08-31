import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { beforeAll, describe, expect, test } from "vitest";

import { loadContractRegistry } from "@aseos/contracts";

import { readJson, repositoryRoot } from "../helpers.mjs";

const cases = [
  {
    schemaId: "urn:aseos:schema:control-api-problem:1.0.0",
    valid: "control-api-problem.json",
    invalid: "control-api-problem-bad-retryability.json",
    keyword: "enum",
  },
  {
    schemaId: "urn:aseos:schema:control-endpoint-descriptor:1.0.0",
    valid: "control-endpoint-descriptor.json",
    invalid: "control-endpoint-descriptor-exposed-host.json",
    keyword: "const",
  },
  {
    schemaId: "urn:aseos:schema:control-event-notification:1.0.0",
    valid: "control-event-notification.json",
    invalid: "control-event-notification-missing-resource.json",
    keyword: "required",
  },
  {
    schemaId: "urn:aseos:schema:control-operation-ref:1.0.0",
    valid: "control-operation-ref.json",
    invalid: "control-operation-ref-bad-status.json",
    keyword: "pattern",
  },
  {
    schemaId: "urn:aseos:schema:diagnostic-finding:1.0.0",
    valid: "diagnostic-finding.json",
    invalid: "diagnostic-finding-bad-severity.json",
    keyword: "enum",
  },
  {
    schemaId: "urn:aseos:schema:runtime-health:1.0.0",
    valid: "runtime-health.json",
    invalid: "runtime-health-ready-with-findings.json",
    keyword: "maxItems",
  },
];

async function example(kind, name) {
  return readJson(repositoryRoot, `packages/contracts/examples/control-api/${kind}/${name}`);
}

describe("P1-O06 canonical Control API contracts", () => {
  let registry;

  beforeAll(async () => {
    registry = await loadContractRegistry(repositoryRoot);
  });

  test.each(cases)(
    "validates $schemaId examples and rejects the declared boundary",
    async (item) => {
      const identity = { schemaId: item.schemaId, schemaVersion: "1.0.0" };
      const valid = await example("valid", item.valid);
      const invalid = await example("invalid", item.invalid);

      expect(registry.validate(identity, valid)).toMatchObject({ ok: true, ...identity });
      expect(registry.validate(identity, invalid)).toMatchObject({
        ok: false,
        code: "SCHEMA_VALIDATION_FAILED",
        errors: expect.arrayContaining([expect.objectContaining({ keyword: item.keyword })]),
      });
    },
  );

  test("keeps runtime authority in the six canonical Draft 2020-12 schemas", async () => {
    const inventory = await readJson(repositoryRoot, "packages/contracts/schema-inventory.json");
    const activated = inventory.contracts.filter((contract) =>
      cases.some((item) => item.schemaId === contract.schemaId),
    );
    expect(activated).toHaveLength(6);
    expect(activated.every((contract) => contract.status === "BASELINE_DRAFT")).toBe(true);
    expect(activated.every((contract) => contract.publicBoundary === true)).toBe(true);
  });

  test("publishes OpenAPI 3.1.1 with loopback bearer auth and canonical schema references", async () => {
    const openapi = await readJson(
      repositoryRoot,
      "packages/contracts/schemas/control-api/control-api.openapi.json",
    );
    expect(openapi.openapi).toBe("3.1.1");
    expect(openapi.servers).toEqual([
      expect.objectContaining({ url: "http://127.0.0.1:{port}/v1" }),
    ]);
    expect(openapi.security).toEqual([{ bearerAuth: [] }]);
    expect(openapi.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });

    const externalSchemas = Object.values(openapi.components.schemas).filter(
      (schema) => schema.$ref !== undefined,
    );
    const canonicalRefs = externalSchemas.map((schema) => schema.$ref);
    expect(canonicalRefs).toEqual([
      "./control-api-problem.schema.json",
      "./control-endpoint-descriptor.schema.json",
      "./control-event-notification.schema.json",
      "./control-operation-ref.schema.json",
      "../platform/diagnostic-finding.schema.json",
      "../platform/runtime-health.schema.json",
    ]);
    expect(externalSchemas.every((schema) => Object.keys(schema).length === 1)).toBe(true);
    expect(Object.keys(openapi.components.schemas)).toEqual(
      expect.arrayContaining([
        "VersionResponse",
        "StatusResponse",
        "DoctorResponse",
        "RetentionGap",
      ]),
    );
  });

  test("does not leak token material through descriptor examples or schemas", async () => {
    const [schemaSource, exampleSource] = await Promise.all([
      readFile(
        resolve(
          repositoryRoot,
          "packages/contracts/schemas/control-api/control-endpoint-descriptor.schema.json",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          repositoryRoot,
          "packages/contracts/examples/control-api/valid/control-endpoint-descriptor.json",
        ),
        "utf8",
      ),
    ]);
    for (const source of [schemaSource, exampleSource]) {
      expect(source).not.toMatch(/"token"\s*:/u);
      expect(source).not.toMatch(/bearer\s+[A-Za-z0-9._~+/-]+/iu);
    }
  });

  test.each(["../secrets/control-api.token", "/secrets/control-api.token", "C:/secrets/token"])(
    "rejects unsafe token file reference %s",
    async (tokenFileRef) => {
      const descriptor = await example("valid", "control-endpoint-descriptor.json");
      expect(
        registry.validate(
          {
            schemaId: "urn:aseos:schema:control-endpoint-descriptor:1.0.0",
            schemaVersion: "1.0.0",
          },
          { ...descriptor, tokenFileRef },
        ),
      ).toMatchObject({ ok: false, code: "SCHEMA_VALIDATION_FAILED" });
    },
  );
});
