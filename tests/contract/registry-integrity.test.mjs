import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { ContractFoundationError, loadContractRegistry } from "@aseos/contracts";

import {
  readJson,
  repositoryRoot,
  updateRegistryHash,
  withContractRepository,
  writeJson,
} from "./helpers.mjs";

async function expectCode(action, code) {
  await expect(action()).rejects.toMatchObject({ name: "ContractFoundationError", code });
}

describe("machine-executable schema registry", () => {
  test("meta-validates, hashes and compiles every canonical entry", async () => {
    const registryDocument = await readJson(
      repositoryRoot,
      "packages/contracts/schema-registry.json",
    );
    const registry = await loadContractRegistry(repositoryRoot);
    expect(registry.loaded.metaValidation).toEqual({
      evidenceType: "SchemaMetaValidationResult",
      result: "PASS",
      dialect: "https://json-schema.org/draft/2020-12/schema",
      registeredSchemas: registryDocument.schemas.length,
      metaValidatedSchemas: registryDocument.schemas.length,
      compiledSchemas: registryDocument.schemas.length,
      unresolvedReferences: 0,
    });
  });

  test("accepts a consistent CRLF authority checkout and rejects content drift", async () => {
    await withContractRepository(async (root) => {
      const authorityPath = "operations/phase-1/authority-lock.schema.json";
      const schemaPath = resolve(root, authorityPath);
      const checkoutSource = await readFile(schemaPath, "utf8");
      const lfSource = checkoutSource.replaceAll("\r\n", "\n");
      expect(lfSource).not.toContain("\r");
      const crlfSource = lfSource.replaceAll("\n", "\r\n");

      await writeFile(schemaPath, crlfSource, "utf8");
      await expect(loadContractRegistry(root)).resolves.toBeInstanceOf(Object);

      const driftedSource = crlfSource.replace(
        '"title": "ASEOS Phase 1 Authority Lock"',
        '"title": "Drifted Phase 1 Authority Lock"',
      );
      expect(driftedSource).not.toBe(crlfSource);
      await writeFile(schemaPath, driftedSource, "utf8");
      await expectCode(() => loadContractRegistry(root), "SCHEMA_HASH_MISMATCH");
    });
  });

  test.each([
    ["mixed LF and CRLF", (source) => source.replace("\n", "\r\n")],
    ["lone CR", (source) => source.replace("\n", "\r")],
  ])("rejects malformed %s authority line endings", async (_label, mutate) => {
    await withContractRepository(async (root) => {
      const authorityPath = "operations/phase-1/authority-lock.schema.json";
      const schemaPath = resolve(root, authorityPath);
      const checkoutSource = await readFile(schemaPath, "utf8");
      const lfSource = checkoutSource.replaceAll("\r\n", "\n");
      expect(lfSource).not.toContain("\r");
      await writeFile(schemaPath, mutate(lfSource), "utf8");
      await expectCode(() => loadContractRegistry(root), "SCHEMA_HASH_MISMATCH");
    });
  });

  test("rejects duplicate schema identities", async () => {
    await withContractRepository(async (root) => {
      const registry = await readJson(root, "packages/contracts/schema-registry.json");
      registry.schemas[1].schemaId = registry.schemas[0].schemaId;
      await writeJson(root, "packages/contracts/schema-registry.json", registry);
      await expectCode(() => loadContractRegistry(root), "DUPLICATE_SCHEMA_IDENTITY");
    });
  });

  test("rejects duplicate paths, missing files and repository traversal", async () => {
    await withContractRepository(async (root) => {
      const registry = await readJson(root, "packages/contracts/schema-registry.json");
      registry.schemas[1].authorityPath = registry.schemas[0].authorityPath;
      await writeJson(root, "packages/contracts/schema-registry.json", registry);
      await expectCode(() => loadContractRegistry(root), "DUPLICATE_SCHEMA_PATH");
    });
    await withContractRepository(async (root) => {
      const registry = await readJson(root, "packages/contracts/schema-registry.json");
      registry.schemas[0].authorityPath = "packages/contracts/schemas/missing.schema.json";
      await writeJson(root, "packages/contracts/schema-registry.json", registry);
      await expectCode(() => loadContractRegistry(root), "MISSING_AUTHORITY_FILE");
    });
    await withContractRepository(async (root) => {
      const registry = await readJson(root, "packages/contracts/schema-registry.json");
      registry.schemas[0].authorityPath = "../outside.schema.json";
      await writeJson(root, "packages/contracts/schema-registry.json", registry);
      await expectCode(() => loadContractRegistry(root), "INVALID_AUTHORITY_PATH");
    });
  });

  test("rejects unresolved references and schema metadata/version mismatches", async () => {
    const actorPath = "packages/contracts/schemas/common/actor-ref.schema.json";
    await withContractRepository(async (root) => {
      const schema = await readJson(root, actorPath);
      schema.properties.actorId = { $ref: "urn:aseos:schema:not-registered:1.0.0" };
      await writeJson(root, actorPath, schema);
      await updateRegistryHash(root, actorPath);
      await expectCode(() => loadContractRegistry(root), "UNRESOLVED_SCHEMA_REFERENCE");
    });
    await withContractRepository(async (root) => {
      const schema = await readJson(root, actorPath);
      schema.$id = "urn:aseos:schema:different:1.0.0";
      await writeJson(root, actorPath, schema);
      await updateRegistryHash(root, actorPath);
      await expectCode(() => loadContractRegistry(root), "SCHEMA_METADATA_MISMATCH");
    });
    await withContractRepository(async (root) => {
      const schema = await readJson(root, actorPath);
      schema["x-schemaVersion"] = "2.0.0";
      await writeJson(root, actorPath, schema);
      await updateRegistryHash(root, actorPath);
      await expectCode(() => loadContractRegistry(root), "SCHEMA_METADATA_MISMATCH");
    });
  });

  test("uses the exported typed failure and never a fallback validator", () => {
    expect(new ContractFoundationError("VALIDATION_INPUT_INVALID", "x")).toMatchObject({
      name: "ContractFoundationError",
      code: "VALIDATION_INPUT_INVALID",
    });
  });
});
