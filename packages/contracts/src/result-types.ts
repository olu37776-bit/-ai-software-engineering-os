export type ContractIdentity = Readonly<{
  schemaId: string;
  schemaVersion: string;
}>;

export type ContractValidationError = Readonly<{
  keyword: string;
  instancePath: string;
  schemaPath: string;
  message: string;
  params: Readonly<Record<string, unknown>>;
}>;

export type ContractValidationFailureCode =
  | "INVALID_CONTRACT_IDENTITY"
  | "SCHEMA_VALIDATION_FAILED"
  | "UNKNOWN_SCHEMA"
  | "UNSUPPORTED_SCHEMA_VERSION";

export type ContractValidationSuccess<T = unknown> = Readonly<{
  ok: true;
  schemaId: string;
  schemaVersion: string;
  value: T;
}>;

export type ContractValidationFailure = Readonly<{
  ok: false;
  schemaId: string;
  schemaVersion: string;
  code: ContractValidationFailureCode;
  errors: readonly ContractValidationError[];
}>;

export type ContractValidationResult<T = unknown> =
  ContractValidationSuccess<T> | ContractValidationFailure;

export type SchemaMetaValidationResult = Readonly<{
  evidenceType: "SchemaMetaValidationResult";
  result: "PASS";
  dialect: "https://json-schema.org/draft/2020-12/schema";
  registeredSchemas: number;
  metaValidatedSchemas: number;
  compiledSchemas: number;
  unresolvedReferences: 0;
}>;

export type SchemaRegistryValidationResult = Readonly<{
  evidenceType: "SchemaRegistryValidationResult";
  result: "PASS";
  registryEntries: number;
  uniqueSchemaIdentities: number;
  uniqueAuthorityPaths: number;
  verifiedHashes: number;
  inventoryActiveContracts: number;
  inventoryPlannedContracts: number;
  uniqueCanonicalOwners: number;
}>;

export type ExampleSuiteResult = Readonly<{
  evidenceType: "ExampleSuiteResult";
  result: "PASS";
  totalCases: number;
  validAccepted: number;
  invalidRejected: number;
  semanticAssertions: number;
}>;

export type SchemaTypeConsistencyResult = Readonly<{
  evidenceType: "SchemaTypeConsistencyResult";
  result: "PASS";
  bindings: number;
  requiredOptionalChecks: number;
  primitiveContainerChecks: number;
  enumDiscriminantChecks: number;
  readonlyExportChecks: number;
}>;

export type CompatibilityResult = Readonly<{
  evidenceType: "ContractCompatibilityResult";
  result: "PASS";
  probes: number;
  compatible: number;
  failClosed: number;
}>;
