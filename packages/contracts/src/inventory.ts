import { ContractFoundationError } from "./foundation-error.js";
import { requireValidator, structuredValidationErrors } from "./json-schema.js";
import { isJsonObject, readJsonAuthority, sha256AuthorityFile } from "./repository.js";
import type { ContractRegistry } from "./registry.js";
import type { SchemaRegistryValidationResult } from "./result-types.js";

const inventoryPath = "packages/contracts/schema-inventory.json";
const plannedPath = "packages/contracts/planned-contracts.json";
const inventorySchemaId = "urn:aseos:schema:schema-inventory:1.1.0";
const plannedSchemaId = "urn:aseos:schema:planned-contract-inventory:1.0.0";

type InventoryContract = Readonly<{
  contractId: string;
  canonicalName: string;
  canonicalOwner: string;
  authorityPath: string;
  schemaId?: string;
  schemaVersion?: string;
  sha256?: string;
  status?: string;
  publicBoundary?: boolean;
  persisted?: boolean;
}>;

export type InventoryValidation = Readonly<{
  result: SchemaRegistryValidationResult;
  activeContracts: readonly InventoryContract[];
  plannedContracts: readonly InventoryContract[];
  publicOrPersistedBoundaries: number;
}>;

function stringField(
  object: Readonly<Record<string, unknown>>,
  key: string,
  context: string,
): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ContractFoundationError(
      "VALIDATION_INPUT_INVALID",
      `${context}.${key} must be a non-empty string`,
      { context, key },
    );
  }
  return value;
}

function contractFromJson(value: unknown, context: string): InventoryContract {
  if (!isJsonObject(value)) {
    throw new ContractFoundationError("VALIDATION_INPUT_INVALID", `${context} must be an object`, {
      context,
    });
  }
  const optionalString = (key: string): string | undefined => {
    const candidate = value[key];
    return typeof candidate === "string" ? candidate : undefined;
  };
  const schemaId = optionalString("schemaId");
  const schemaVersion = optionalString("schemaVersion");
  const sha256 = optionalString("sha256");
  const status = optionalString("status");
  return {
    contractId: stringField(value, "contractId", context),
    canonicalName: stringField(value, "canonicalName", context),
    canonicalOwner: stringField(value, "canonicalOwner", context),
    authorityPath: stringField(value, "authorityPath", context),
    ...(schemaId === undefined ? {} : { schemaId }),
    ...(schemaVersion === undefined ? {} : { schemaVersion }),
    ...(sha256 === undefined ? {} : { sha256 }),
    ...(status === undefined ? {} : { status }),
    ...(typeof value["publicBoundary"] === "boolean"
      ? { publicBoundary: value["publicBoundary"] }
      : {}),
    ...(typeof value["persisted"] === "boolean" ? { persisted: value["persisted"] } : {}),
  };
}

function assertUnique(
  contracts: readonly InventoryContract[],
  select: (contract: InventoryContract) => string,
  label: string,
): void {
  const values = new Set<string>();
  for (const contract of contracts) {
    const value = select(contract);
    if (values.has(value)) {
      throw new ContractFoundationError(
        "VALIDATION_INPUT_INVALID",
        `Duplicate ${label}: ${value}`,
        { label, value },
      );
    }
    values.add(value);
  }
}

export async function validateContractInventory(
  registry: ContractRegistry,
): Promise<InventoryValidation> {
  const repositoryRoot = registry.loaded.repositoryRoot;
  const inventory = await readJsonAuthority(repositoryRoot, inventoryPath);
  const planned = await readJsonAuthority(repositoryRoot, plannedPath);
  const inventoryValidator = requireValidator(registry.loaded.ajv, inventorySchemaId);
  const plannedValidator = requireValidator(registry.loaded.ajv, plannedSchemaId);
  if (!inventoryValidator?.(inventory)) {
    throw new ContractFoundationError(
      "SCHEMA_META_VALIDATION_FAILED",
      "schema-inventory.json does not satisfy its canonical schema",
      { errors: structuredValidationErrors(inventoryValidator?.errors) },
    );
  }
  if (!plannedValidator?.(planned)) {
    throw new ContractFoundationError(
      "SCHEMA_META_VALIDATION_FAILED",
      "planned-contracts.json does not satisfy its canonical schema",
      { errors: structuredValidationErrors(plannedValidator?.errors) },
    );
  }
  if (inventory["plannedInventoryRef"] !== plannedPath || planned["status"] !== "PLANNED") {
    throw new ContractFoundationError(
      "SCHEMA_METADATA_MISMATCH",
      "Active and planned inventory linkage/status is inconsistent",
    );
  }

  const activeValues = inventory["contracts"];
  const plannedValues = planned["contracts"];
  if (!Array.isArray(activeValues) || !Array.isArray(plannedValues)) {
    throw new ContractFoundationError(
      "VALIDATION_INPUT_INVALID",
      "Inventory contract collections must be arrays",
    );
  }
  const active = activeValues.map((value, index) =>
    contractFromJson(value, `schema-inventory.json.contracts[${String(index)}]`),
  );
  const plannedContracts = plannedValues.map((value, index) =>
    contractFromJson(value, `planned-contracts.json.contracts[${String(index)}]`),
  );
  const combined = [...active, ...plannedContracts];
  assertUnique(combined, (contract) => contract.contractId, "contractId/canonical owner");
  assertUnique(combined, (contract) => contract.canonicalName, "canonicalName/canonical owner");
  assertUnique(combined, (contract) => contract.authorityPath, "authorityPath");

  const registryById = new Map(registry.list().map((entry) => [entry.schemaId, entry]));
  let verifiedHashes = 0;
  for (const contract of active) {
    if (!contract.schemaId || !contract.schemaVersion || !contract.sha256) {
      throw new ContractFoundationError(
        "SCHEMA_METADATA_MISMATCH",
        `Active contract is missing schema identity metadata: ${contract.contractId}`,
      );
    }
    const entry = registryById.get(contract.schemaId);
    if (
      entry?.schemaVersion !== contract.schemaVersion ||
      entry.authorityPath !== contract.authorityPath ||
      entry.sha256 !== contract.sha256
    ) {
      throw new ContractFoundationError(
        "SCHEMA_METADATA_MISMATCH",
        `Inventory and registry disagree: ${contract.contractId}`,
        { contractId: contract.contractId, schemaId: contract.schemaId },
      );
    }
    if (
      (contract.publicBoundary === true || contract.persisted === true) &&
      entry.examplesRequired &&
      entry.schema["additionalProperties"] !== false
    ) {
      throw new ContractFoundationError(
        "SCHEMA_METADATA_MISMATCH",
        `Public/persisted payload schema does not reject unknown root fields: ${contract.contractId}`,
        { contractId: contract.contractId, schemaId: contract.schemaId },
      );
    }
    const actualHash = await sha256AuthorityFile(repositoryRoot, contract.authorityPath);
    if (actualHash !== contract.sha256) {
      throw new ContractFoundationError(
        "SCHEMA_HASH_MISMATCH",
        `Inventory schema hash mismatch: ${contract.authorityPath}`,
      );
    }
    verifiedHashes += 1;
  }

  return {
    result: {
      evidenceType: "SchemaRegistryValidationResult",
      result: "PASS",
      registryEntries: registry.list().length,
      uniqueSchemaIdentities: new Set(registry.list().map((entry) => entry.schemaId)).size,
      uniqueAuthorityPaths: new Set(registry.list().map((entry) => entry.authorityPath)).size,
      verifiedHashes: registry.list().length + verifiedHashes,
      inventoryActiveContracts: active.length,
      inventoryPlannedContracts: plannedContracts.length,
      uniqueCanonicalOwners: combined.length,
    },
    activeContracts: active,
    plannedContracts,
    publicOrPersistedBoundaries: active.filter(
      (contract) => contract.publicBoundary === true || contract.persisted === true,
    ).length,
  };
}
