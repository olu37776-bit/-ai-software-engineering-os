import { describe, expect, test } from "vitest";

import { loadContractRegistry, validateContractInventory } from "@aseos/contracts";

import {
  readJson,
  repositoryRoot,
  updateRegistryHash,
  withContractRepository,
  writeJson,
} from "./helpers.mjs";

describe("active and planned Contract inventories", () => {
  test("bind every active contract to one registry identity and canonical owner", async () => {
    const [registryDocument, activeInventory, plannedInventory] = await Promise.all([
      readJson(repositoryRoot, "packages/contracts/schema-registry.json"),
      readJson(repositoryRoot, "packages/contracts/schema-inventory.json"),
      readJson(repositoryRoot, "packages/contracts/planned-contracts.json"),
    ]);
    const registry = await loadContractRegistry(repositoryRoot);
    const inventory = await validateContractInventory(registry);
    expect(inventory.result).toMatchObject({
      evidenceType: "SchemaRegistryValidationResult",
      result: "PASS",
      registryEntries: registryDocument.schemas.length,
      uniqueSchemaIdentities: registryDocument.schemas.length,
      uniqueAuthorityPaths: registryDocument.schemas.length,
      inventoryActiveContracts: activeInventory.contracts.length,
      inventoryPlannedContracts: plannedInventory.contracts.length,
      uniqueCanonicalOwners: activeInventory.contracts.length + plannedInventory.contracts.length,
    });
    expect(inventory.publicOrPersistedBoundaries).toBe(
      activeInventory.contracts.filter(
        (contract) => contract.publicBoundary === true || contract.persisted === true,
      ).length,
    );
  });

  test("rejects active/planned ownership collisions", async () => {
    await withContractRepository(async (root) => {
      const active = await readJson(root, "packages/contracts/schema-inventory.json");
      const planned = await readJson(root, "packages/contracts/planned-contracts.json");
      planned.contracts[0].contractId = active.contracts[0].contractId;
      await writeJson(root, "packages/contracts/planned-contracts.json", planned);
      const registry = await loadContractRegistry(root);
      await expect(validateContractInventory(registry)).rejects.toMatchObject({
        code: "VALIDATION_INPUT_INVALID",
      });
    });
  });

  test("rejects inventory identities missing from the canonical registry", async () => {
    await withContractRepository(async (root) => {
      const inventory = await readJson(root, "packages/contracts/schema-inventory.json");
      inventory.contracts[0].schemaId = "urn:aseos:schema:not-registered:1.0.0";
      await writeJson(root, "packages/contracts/schema-inventory.json", inventory);
      const registry = await loadContractRegistry(root);
      await expect(validateContractInventory(registry)).rejects.toMatchObject({
        code: "SCHEMA_METADATA_MISMATCH",
      });
    });
  });

  test("rejects a public payload schema that permits unknown root fields", async () => {
    await withContractRepository(async (root) => {
      const schemaPath = "packages/contracts/schemas/common/actor-ref.schema.json";
      const schema = await readJson(root, schemaPath);
      schema.additionalProperties = true;
      await writeJson(root, schemaPath, schema);
      await updateRegistryHash(root, schemaPath);
      const registryDocument = await readJson(root, "packages/contracts/schema-registry.json");
      const registryEntry = registryDocument.schemas.find(
        (entry) => entry.authorityPath === schemaPath,
      );
      const inventory = await readJson(root, "packages/contracts/schema-inventory.json");
      inventory.contracts.find((contract) => contract.authorityPath === schemaPath).sha256 =
        registryEntry.sha256;
      await writeJson(root, "packages/contracts/schema-inventory.json", inventory);
      const registry = await loadContractRegistry(root);
      await expect(validateContractInventory(registry)).rejects.toMatchObject({
        code: "SCHEMA_METADATA_MISMATCH",
      });
    });
  });

  test("rejects inconsistent active/planned status linkage", async () => {
    await withContractRepository(async (root) => {
      const inventory = await readJson(root, "packages/contracts/schema-inventory.json");
      inventory.plannedInventoryRef = "packages/contracts/parallel-planned-contracts.json";
      await writeJson(root, "packages/contracts/schema-inventory.json", inventory);
      const registry = await loadContractRegistry(root);
      await expect(validateContractInventory(registry)).rejects.toMatchObject({
        code: "SCHEMA_META_VALIDATION_FAILED",
      });
    });
  });
});
