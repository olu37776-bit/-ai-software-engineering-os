import { describe, expect, test } from "vitest";

import { loadContractRegistry, validateContractInventory } from "@aseos/contracts";

import { readJson, repositoryRoot, withContractRepository, writeJson } from "./helpers.mjs";

describe("active and planned Contract inventories", () => {
  test("bind every active contract to one registry identity and canonical owner", async () => {
    const registry = await loadContractRegistry(repositoryRoot);
    const inventory = await validateContractInventory(registry);
    expect(inventory.result).toMatchObject({
      evidenceType: "SchemaRegistryValidationResult",
      result: "PASS",
      registryEntries: 31,
      uniqueSchemaIdentities: 31,
      uniqueAuthorityPaths: 31,
      inventoryActiveContracts: 15,
      inventoryPlannedContracts: 58,
      uniqueCanonicalOwners: 73,
    });
    expect(inventory.publicOrPersistedBoundaries).toBe(15);
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
