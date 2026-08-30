import { ContractFoundationError } from "./foundation-error.js";
import type { ContractRegistry, SchemaRegistryEntry } from "./registry.js";
import type { CompatibilityResult, ContractIdentity } from "./result-types.js";

export type CompatibilityDecision = Readonly<{
  compatible: boolean;
  code:
    | "SAME_SUPPORTED_VERSION"
    | "UNKNOWN_SCHEMA"
    | "UNSUPPORTED_SCHEMA_VERSION"
    | "SCHEMA_IDENTITY_VERSION_MISMATCH";
  requested: ContractIdentity;
  resolved?: SchemaRegistryEntry;
}>;

export function evaluateCompatibility(
  registry: ContractRegistry,
  identity: ContractIdentity,
): CompatibilityDecision {
  const resolved = registry.resolve(identity);
  if (!("ok" in resolved)) {
    return {
      compatible: true,
      code: "SAME_SUPPORTED_VERSION",
      requested: identity,
      resolved,
    };
  }
  const mismatch = registry
    .list()
    .some(
      (entry) =>
        entry.schemaId === identity.schemaId && entry.schemaVersion !== identity.schemaVersion,
    );
  return {
    compatible: false,
    code:
      resolved.code === "UNKNOWN_SCHEMA"
        ? "UNKNOWN_SCHEMA"
        : mismatch
          ? "SCHEMA_IDENTITY_VERSION_MISMATCH"
          : "UNSUPPORTED_SCHEMA_VERSION",
    requested: identity,
  };
}

export function qualifyCompatibility(registry: ContractRegistry): CompatibilityResult {
  const entry = registry.list().find((candidate) => candidate.examplesRequired);
  if (!entry) {
    throw new ContractFoundationError(
      "SCHEMA_METADATA_MISMATCH",
      "Compatibility qualification requires an active example schema",
    );
  }
  const same = evaluateCompatibility(registry, {
    schemaId: entry.schemaId,
    schemaVersion: entry.schemaVersion,
  });
  const unknown = evaluateCompatibility(registry, {
    schemaId: "urn:aseos:schema:not-registered:1.0.0",
    schemaVersion: "1.0.0",
  });
  const futureId = entry.schemaId.replace(/:[0-9]+\.[0-9]+\.[0-9]+$/u, ":99.0.0");
  const future = evaluateCompatibility(registry, {
    schemaId: futureId,
    schemaVersion: "99.0.0",
  });
  const mismatch = evaluateCompatibility(registry, {
    schemaId: entry.schemaId,
    schemaVersion: "99.0.0",
  });
  const decisions = [same, unknown, future, mismatch];
  if (
    !same.compatible ||
    unknown.compatible ||
    future.compatible ||
    mismatch.compatible ||
    mismatch.code !== "SCHEMA_IDENTITY_VERSION_MISMATCH"
  ) {
    throw new ContractFoundationError(
      "SCHEMA_METADATA_MISMATCH",
      "Compatibility qualification did not fail closed",
      { decisions },
    );
  }
  return {
    evidenceType: "ContractCompatibilityResult",
    result: "PASS",
    probes: decisions.length,
    compatible: 1,
    failClosed: 3,
  };
}
