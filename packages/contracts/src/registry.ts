import type { Ajv2020, AnySchemaObject, ValidateFunction } from "ajv/dist/2020.js";

import { ContractFoundationError } from "./foundation-error.js";
import {
  asSchemaObject,
  createJsonSchemaAuthority,
  requireValidator,
  structuredValidationErrors,
} from "./json-schema.js";
import {
  defaultRepositoryRoot,
  isJsonObject,
  readJsonAuthority,
  sha256AuthorityFile,
  type JsonObject,
} from "./repository.js";
import type {
  ContractIdentity,
  ContractValidationFailure,
  ContractValidationResult,
  SchemaMetaValidationResult,
} from "./result-types.js";

const registryPath = "packages/contracts/schema-registry.json";
const registrySchemaId = "urn:aseos:schema:schema-registry:1.0.0";
const draft202012 = "https://json-schema.org/draft/2020-12/schema";
const semanticVersionSuffix = /:([0-9]+\.[0-9]+\.[0-9]+)$/u;

export type SchemaRegistryEntry = Readonly<{
  schemaId: string;
  schemaVersion: string;
  authorityPath: string;
  sha256: string;
  category: string;
  examplesRequired: boolean;
  schema: JsonObject;
}>;

export type LoadedContractRegistry = Readonly<{
  repositoryRoot: string;
  registry: JsonObject;
  entries: readonly SchemaRegistryEntry[];
  ajv: Ajv2020;
  metaValidation: SchemaMetaValidationResult;
}>;

function requiredString(object: JsonObject, key: string, context: string): string {
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

function versionFromSchemaId(schemaId: string): string {
  const match = semanticVersionSuffix.exec(schemaId);
  if (!match?.[1]) {
    throw new ContractFoundationError(
      "SCHEMA_METADATA_MISMATCH",
      `Schema identity does not end in a semantic version: ${schemaId}`,
      { schemaId },
    );
  }
  return match[1];
}

function validationFailure(
  identity: ContractIdentity,
  code: ContractValidationFailure["code"],
  message: string,
): ContractValidationFailure {
  return {
    ok: false,
    schemaId: identity.schemaId,
    schemaVersion: identity.schemaVersion,
    code,
    errors: [
      {
        keyword: code,
        instancePath: "",
        schemaPath: "",
        message,
        params: {},
      },
    ],
  };
}

function schemaFamily(schemaId: string): string {
  return schemaId.replace(semanticVersionSuffix, ":");
}

export class ContractRegistry {
  readonly #byId: ReadonlyMap<string, SchemaRegistryEntry>;
  readonly #validators = new Map<string, ValidateFunction>();

  public constructor(public readonly loaded: LoadedContractRegistry) {
    this.#byId = new Map(loaded.entries.map((entry) => [entry.schemaId, entry]));
  }

  public list(): readonly SchemaRegistryEntry[] {
    return this.loaded.entries;
  }

  public resolve(identity: ContractIdentity): SchemaRegistryEntry | ContractValidationFailure {
    if (
      typeof identity.schemaId !== "string" ||
      identity.schemaId.length === 0 ||
      typeof identity.schemaVersion !== "string" ||
      identity.schemaVersion.length === 0
    ) {
      return validationFailure(identity, "INVALID_CONTRACT_IDENTITY", "Invalid schema identity");
    }
    const entry = this.#byId.get(identity.schemaId);
    if (!entry) {
      const family = schemaFamily(identity.schemaId);
      const knownFamily = this.loaded.entries.some(
        (candidate) => schemaFamily(candidate.schemaId) === family,
      );
      return validationFailure(
        identity,
        knownFamily ? "UNSUPPORTED_SCHEMA_VERSION" : "UNKNOWN_SCHEMA",
        knownFamily
          ? `Unsupported schema version: ${identity.schemaVersion}`
          : `Unknown schema: ${identity.schemaId}`,
      );
    }
    if (entry.schemaVersion !== identity.schemaVersion) {
      return validationFailure(
        identity,
        "UNSUPPORTED_SCHEMA_VERSION",
        `Schema identity/version mismatch: ${identity.schemaId} / ${identity.schemaVersion}`,
      );
    }
    return entry;
  }

  public validate<T = unknown>(
    identity: ContractIdentity,
    value: unknown,
  ): ContractValidationResult<T> {
    const resolved = this.resolve(identity);
    if ("ok" in resolved) {
      return resolved;
    }
    let validator = this.#validators.get(resolved.schemaId);
    if (!validator) {
      validator = requireValidator(this.loaded.ajv, resolved.schemaId);
      if (!validator) {
        throw new ContractFoundationError(
          "SCHEMA_COMPILE_FAILED",
          `Canonical schema has no compiled validator: ${resolved.schemaId}`,
          { schemaId: resolved.schemaId },
        );
      }
      this.#validators.set(resolved.schemaId, validator);
    }
    if (!validator(value)) {
      return {
        ok: false,
        schemaId: resolved.schemaId,
        schemaVersion: resolved.schemaVersion,
        code: "SCHEMA_VALIDATION_FAILED",
        errors: structuredValidationErrors(validator.errors),
      };
    }
    return {
      ok: true,
      schemaId: resolved.schemaId,
      schemaVersion: resolved.schemaVersion,
      value: value as T,
    };
  }
}

export async function loadContractRegistry(
  repositoryRoot: string = defaultRepositoryRoot,
): Promise<ContractRegistry> {
  const registry = await readJsonAuthority(repositoryRoot, registryPath);
  const schemas = registry["schemas"];
  if (!Array.isArray(schemas)) {
    throw new ContractFoundationError(
      "VALIDATION_INPUT_INVALID",
      "schema-registry.json.schemas must be an array",
    );
  }

  const schemaIds = new Set<string>();
  const paths = new Set<string>();
  const entries: SchemaRegistryEntry[] = [];
  for (const [index, value] of schemas.entries()) {
    if (!isJsonObject(value)) {
      throw new ContractFoundationError(
        "VALIDATION_INPUT_INVALID",
        `schema-registry.json.schemas[${String(index)}] must be an object`,
      );
    }
    const context = `schema-registry.json.schemas[${String(index)}]`;
    const schemaId = requiredString(value, "schemaId", context);
    const authorityPath = requiredString(value, "authorityPath", context);
    const expectedHash = requiredString(value, "sha256", context);
    if (schemaIds.has(schemaId)) {
      throw new ContractFoundationError(
        "DUPLICATE_SCHEMA_IDENTITY",
        `Duplicate schema identity: ${schemaId}`,
        { schemaId },
      );
    }
    if (paths.has(authorityPath)) {
      throw new ContractFoundationError(
        "DUPLICATE_SCHEMA_PATH",
        `Duplicate schema authority path: ${authorityPath}`,
        { authorityPath },
      );
    }
    const actualHash = await sha256AuthorityFile(repositoryRoot, authorityPath);
    if (actualHash !== expectedHash) {
      throw new ContractFoundationError(
        "SCHEMA_HASH_MISMATCH",
        `Schema hash mismatch: ${authorityPath}`,
        { authorityPath, expectedHash, actualHash },
      );
    }
    const schema = await readJsonAuthority(repositoryRoot, authorityPath);
    const actualId = requiredString(schema, "$id", authorityPath);
    if (actualId !== schemaId || schema["$schema"] !== draft202012) {
      throw new ContractFoundationError(
        "SCHEMA_METADATA_MISMATCH",
        `Schema metadata does not match registry: ${authorityPath}`,
        { authorityPath, expectedId: schemaId, actualId, dialect: schema["$schema"] },
      );
    }
    const schemaVersion = versionFromSchemaId(schemaId);
    const explicitVersion = schema["x-schemaVersion"];
    if (explicitVersion !== undefined && explicitVersion !== schemaVersion) {
      throw new ContractFoundationError(
        "SCHEMA_METADATA_MISMATCH",
        `Schema version metadata does not match identity: ${authorityPath}`,
        { authorityPath, schemaVersion, explicitVersion },
      );
    }
    schemaIds.add(schemaId);
    paths.add(authorityPath);
    entries.push({
      schemaId,
      schemaVersion,
      authorityPath,
      sha256: expectedHash,
      category: requiredString(value, "category", context),
      examplesRequired: value["examplesRequired"] === true,
      schema,
    });
  }

  const ajv = createJsonSchemaAuthority();
  for (const entry of entries) {
    if (!ajv.validateSchema(asSchemaObject(entry.schema))) {
      throw new ContractFoundationError(
        "SCHEMA_META_VALIDATION_FAILED",
        `Schema is not valid Draft 2020-12: ${entry.authorityPath}`,
        { schemaId: entry.schemaId, errors: structuredValidationErrors(ajv.errors) },
      );
    }
    try {
      ajv.addSchema(asSchemaObject(entry.schema), entry.schemaId);
    } catch (error: unknown) {
      throw new ContractFoundationError(
        "SCHEMA_COMPILE_FAILED",
        `Schema registration failed: ${entry.schemaId}`,
        { schemaId: entry.schemaId, cause: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  let compiled = 0;
  for (const entry of entries) {
    try {
      if (!requireValidator(ajv, entry.schemaId)) {
        throw new Error("validator unavailable");
      }
      compiled += 1;
    } catch (error: unknown) {
      throw new ContractFoundationError(
        "UNRESOLVED_SCHEMA_REFERENCE",
        `Schema reference resolution failed: ${entry.schemaId}`,
        { schemaId: entry.schemaId, cause: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  const registryValidator = requireValidator(ajv, registrySchemaId);
  if (!registryValidator?.(registry)) {
    throw new ContractFoundationError(
      "SCHEMA_META_VALIDATION_FAILED",
      "schema-registry.json does not satisfy its canonical schema",
      { errors: structuredValidationErrors(registryValidator?.errors) },
    );
  }

  return new ContractRegistry({
    repositoryRoot,
    registry,
    entries,
    ajv,
    metaValidation: {
      evidenceType: "SchemaMetaValidationResult",
      result: "PASS",
      dialect: draft202012,
      registeredSchemas: entries.length,
      metaValidatedSchemas: entries.length,
      compiledSchemas: compiled,
      unresolvedReferences: 0,
    },
  });
}

export function schemaObject(entry: SchemaRegistryEntry): AnySchemaObject {
  return asSchemaObject(entry.schema);
}
