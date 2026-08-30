import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { runSchemaTypeConsistency } from "../../scripts/contracts/schema-type-consistency.mjs";
import { readJson, repositoryRoot } from "./helpers.mjs";

const actorSchemaId = "urn:aseos:schema:actor-ref:1.0.0";
const actorSchemaPath = "packages/contracts/schemas/common/actor-ref.schema.json";

describe("JSON Schema and TypeScript public-shape consistency", () => {
  test("checks semantic shape, enums, optionality and readonly exports", async () => {
    await expect(runSchemaTypeConsistency({ repositoryRoot })).resolves.toMatchObject({
      evidenceType: "SchemaTypeConsistencyResult",
      result: "PASS",
      bindings: 24,
    });
  });

  test("detects a required schema field deletion", async () => {
    const actor = await readJson(repositoryRoot, actorSchemaPath);
    actor.required = actor.required.filter((field) => field !== "actorId");
    await expect(
      runSchemaTypeConsistency({
        repositoryRoot,
        schemaOverrides: new Map([[actorSchemaId, actor]]),
      }),
    ).rejects.toThrow(/SCHEMA_TYPE_SEMANTIC_DRIFT/u);
  });

  test("detects primitive and enum drift in TypeScript", async () => {
    const source = await readFile(
      resolve(repositoryRoot, "packages/contracts/src/types.generated.ts"),
      "utf8",
    );
    await expect(
      runSchemaTypeConsistency({
        repositoryRoot,
        typeSource: source.replace("readonly actorId: string", "readonly actorId: number"),
      }),
    ).rejects.toThrow(/SCHEMA_TYPE_SEMANTIC_DRIFT/u);
    await expect(
      runSchemaTypeConsistency({
        repositoryRoot,
        typeSource: source.replace(
          '"HUMAN" | "AGENT" | "SYSTEM" | "WORKER"',
          '"HUMAN" | "AGENT" | "SERVICE" | "WORKER"',
        ),
      }),
    ).rejects.toThrow(/SCHEMA_TYPE_SEMANTIC_DRIFT/u);
  });

  test("detects a mutable public field", async () => {
    const source = await readFile(
      resolve(repositoryRoot, "packages/contracts/src/types.generated.ts"),
      "utf8",
    );
    await expect(
      runSchemaTypeConsistency({
        repositoryRoot,
        typeSource: source.replace("readonly actorId: string", "actorId: string"),
      }),
    ).rejects.toThrow(/SCHEMA_TYPE_READONLY_DRIFT/u);
  });
});
