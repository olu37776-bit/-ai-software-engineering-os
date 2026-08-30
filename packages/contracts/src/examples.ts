import { ContractFoundationError } from "./foundation-error.js";
import { canonicalJsonSha256 } from "./canonical-json.js";
import { requireValidator, structuredValidationErrors } from "./json-schema.js";
import { isJsonObject, readJsonAuthority, sha256Artifact } from "./repository.js";
import type { ContractRegistry } from "./registry.js";
import type { ExampleSuiteResult } from "./result-types.js";

const suitePath = "packages/contracts/examples/first-slice/example-suite.json";
const suiteSchemaId = "urn:aseos:schema:example-suite:1.0.0";
const artifactRoot = "packages/contracts/examples/first-slice/artifacts";

type ExampleCase = Readonly<{
  caseId: string;
  schemaId: string;
  instancePath: string;
  expected: "VALID" | "INVALID";
  expectedError?: Readonly<{ keyword: string; instancePath: string }>;
  semanticAssertions: readonly string[];
}>;

function parseCase(value: unknown, index: number): ExampleCase {
  if (!isJsonObject(value)) {
    throw new ContractFoundationError(
      "VALIDATION_INPUT_INVALID",
      `example-suite.json.cases[${String(index)}] must be an object`,
    );
  }
  const text = (key: string): string => {
    const candidate = value[key];
    if (typeof candidate !== "string" || candidate.length === 0) {
      throw new ContractFoundationError(
        "VALIDATION_INPUT_INVALID",
        `example-suite.json.cases[${String(index)}].${key} must be a non-empty string`,
      );
    }
    return candidate;
  };
  const expected = text("expected");
  if (expected !== "VALID" && expected !== "INVALID") {
    throw new ContractFoundationError(
      "VALIDATION_INPUT_INVALID",
      `Unknown example expectation: ${expected}`,
    );
  }
  const expectedErrorValue = value["expectedError"];
  const expectedKeyword = isJsonObject(expectedErrorValue)
    ? expectedErrorValue["keyword"]
    : undefined;
  const expectedInstancePath = isJsonObject(expectedErrorValue)
    ? expectedErrorValue["instancePath"]
    : undefined;
  const expectedError =
    typeof expectedKeyword === "string" && typeof expectedInstancePath === "string"
      ? { keyword: expectedKeyword, instancePath: expectedInstancePath }
      : undefined;
  const assertions = value["semanticAssertions"];
  return {
    caseId: text("caseId"),
    schemaId: text("schemaId"),
    instancePath: text("instancePath"),
    expected,
    ...(expectedError === undefined ? {} : { expectedError }),
    semanticAssertions: Array.isArray(assertions)
      ? assertions.map((assertion) => String(assertion))
      : [],
  };
}

function visitObjects(
  value: unknown,
  visitor: (object: Readonly<Record<string, unknown>>) => void,
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      visitObjects(item, visitor);
    }
    return;
  }
  if (isJsonObject(value)) {
    visitor(value);
    for (const child of Object.values(value)) {
      visitObjects(child, visitor);
    }
  }
}

function schemaReferences(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  const results: Readonly<Record<string, unknown>>[] = [];
  visitObjects(value, (object) => {
    if (
      typeof object["schemaId"] === "string" &&
      typeof object["schemaVersion"] === "string" &&
      typeof object["schemaHash"] === "string"
    ) {
      results.push(object);
    }
  });
  return results;
}

function artifactReferences(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  const results: Readonly<Record<string, unknown>>[] = [];
  visitObjects(value, (object) => {
    if (
      typeof object["artifactId"] === "string" &&
      typeof object["sha256"] === "string" &&
      typeof object["sizeBytes"] === "number" &&
      typeof object["logicalName"] === "string"
    ) {
      results.push(object);
    }
  });
  return results;
}

function assertSchemaHashes(registry: ContractRegistry, instance: unknown): void {
  for (const reference of schemaReferences(instance)) {
    const schemaId = reference["schemaId"];
    const schemaVersion = reference["schemaVersion"];
    if (typeof schemaId !== "string" || typeof schemaVersion !== "string") {
      throw new ContractFoundationError("VALIDATION_INPUT_INVALID", "Invalid SchemaRef shape");
    }
    const resolved = registry.resolve({ schemaId, schemaVersion });
    if ("ok" in resolved || resolved.sha256 !== reference["schemaHash"]) {
      throw new ContractFoundationError(
        "SCHEMA_HASH_MISMATCH",
        `Example SchemaRef does not match registry authority: ${schemaId}`,
        { schemaId, schemaVersion },
      );
    }
  }
}

async function assertArtifactHashes(registry: ContractRegistry, instance: unknown): Promise<void> {
  for (const reference of artifactReferences(instance)) {
    const logicalName = String(reference["logicalName"]);
    const actual = await sha256Artifact(
      registry.loaded.repositoryRoot,
      `${artifactRoot}/${logicalName}`,
    );
    if (actual.sha256 !== reference["sha256"] || actual.sizeBytes !== reference["sizeBytes"]) {
      throw new ContractFoundationError(
        "SCHEMA_HASH_MISMATCH",
        `Example ArtifactRef does not match canonical artifact: ${logicalName}`,
        { logicalName },
      );
    }
  }
}

function assertPayloadSchemaResolves(registry: ContractRegistry, instance: unknown): void {
  if (!isJsonObject(instance) || !isJsonObject(instance["payloadSchema"])) {
    throw new ContractFoundationError(
      "VALIDATION_INPUT_INVALID",
      "PAYLOAD_SCHEMA_RESOLVES requires payloadSchema and payload",
    );
  }
  const reference = instance["payloadSchema"];
  const schemaId = reference["schemaId"];
  const schemaVersion = reference["schemaVersion"];
  if (typeof schemaId !== "string" || typeof schemaVersion !== "string") {
    throw new ContractFoundationError("VALIDATION_INPUT_INVALID", "Invalid payload SchemaRef");
  }
  const result = registry.validate({ schemaId, schemaVersion }, instance["payload"]);
  if (!result.ok) {
    throw new ContractFoundationError(
      "SCHEMA_META_VALIDATION_FAILED",
      `Example payload does not satisfy its canonical schema: ${schemaId}`,
      { errors: result.errors },
    );
  }
}

function assertPayloadHash(instance: unknown): void {
  if (!isJsonObject(instance) || typeof instance["payloadHash"] !== "string") {
    throw new ContractFoundationError(
      "VALIDATION_INPUT_INVALID",
      "PAYLOAD_HASH_MATCHES requires payloadHash and payload",
    );
  }
  const actual = canonicalJsonSha256(instance["payload"]);
  if (actual !== instance["payloadHash"]) {
    throw new ContractFoundationError("SCHEMA_HASH_MISMATCH", "Example payload hash mismatch", {
      expected: instance["payloadHash"],
      actual,
    });
  }
}

export async function validateExampleSuite(
  registry: ContractRegistry,
): Promise<ExampleSuiteResult> {
  const suite = await readJsonAuthority(registry.loaded.repositoryRoot, suitePath);
  const suiteValidator = requireValidator(registry.loaded.ajv, suiteSchemaId);
  if (!suiteValidator?.(suite)) {
    throw new ContractFoundationError(
      "SCHEMA_META_VALIDATION_FAILED",
      "example-suite.json does not satisfy its canonical schema",
      { errors: structuredValidationErrors(suiteValidator?.errors) },
    );
  }
  const values = suite["cases"];
  if (!Array.isArray(values)) {
    throw new ContractFoundationError("VALIDATION_INPUT_INVALID", "Example cases must be an array");
  }
  const cases = values.map((value, index) => parseCase(value, index));
  if (new Set(cases.map((item) => item.caseId)).size !== cases.length) {
    throw new ContractFoundationError(
      "VALIDATION_INPUT_INVALID",
      "Duplicate example case identity",
    );
  }
  if (new Set(cases.map((item) => item.instancePath)).size !== cases.length) {
    throw new ContractFoundationError("VALIDATION_INPUT_INVALID", "Duplicate example fixture path");
  }

  let validAccepted = 0;
  let invalidRejected = 0;
  let semanticAssertions = 0;
  for (const item of cases) {
    const entry = registry.list().find((candidate) => candidate.schemaId === item.schemaId);
    if (!entry) {
      throw new ContractFoundationError(
        "SCHEMA_METADATA_MISMATCH",
        `Example references unknown schema: ${item.schemaId}`,
      );
    }
    const instance = await readJsonAuthority(registry.loaded.repositoryRoot, item.instancePath);
    const result = registry.validate(
      { schemaId: item.schemaId, schemaVersion: entry.schemaVersion },
      instance,
    );
    if (item.expected === "VALID") {
      if (!result.ok) {
        throw new ContractFoundationError(
          "SCHEMA_META_VALIDATION_FAILED",
          `Expected valid example was rejected: ${item.caseId}`,
          { errors: result.errors },
        );
      }
      validAccepted += 1;
      for (const assertion of item.semanticAssertions) {
        if (assertion === "PAYLOAD_SCHEMA_RESOLVES") {
          assertPayloadSchemaResolves(registry, instance);
        } else if (assertion === "PAYLOAD_HASH_MATCHES") {
          assertPayloadHash(instance);
        } else if (assertion === "SCHEMA_HASH_MATCHES") {
          assertSchemaHashes(registry, instance);
        } else if (assertion === "ARTIFACT_HASH_MATCHES") {
          await assertArtifactHashes(registry, instance);
        } else {
          throw new ContractFoundationError(
            "VALIDATION_INPUT_INVALID",
            `Unknown semantic assertion: ${assertion}`,
          );
        }
        semanticAssertions += 1;
      }
    } else {
      if (result.ok || !item.expectedError) {
        throw new ContractFoundationError(
          "SCHEMA_META_VALIDATION_FAILED",
          `Expected invalid example was accepted or has no bound violation: ${item.caseId}`,
        );
      }
      const matched = result.errors.some(
        (error) =>
          error.keyword === item.expectedError?.keyword &&
          error.instancePath === item.expectedError.instancePath,
      );
      if (!matched) {
        throw new ContractFoundationError(
          "SCHEMA_META_VALIDATION_FAILED",
          `Invalid example did not prove its declared boundary violation: ${item.caseId}`,
          { expectedError: item.expectedError, actualErrors: result.errors },
        );
      }
      invalidRejected += 1;
    }
  }

  return {
    evidenceType: "ExampleSuiteResult",
    result: "PASS",
    totalCases: cases.length,
    validAccepted,
    invalidRejected,
    semanticAssertions,
  };
}
