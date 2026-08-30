export { canonicalJson, canonicalJsonSha256 } from "./canonical-json.js";
export {
  evaluateCompatibility,
  qualifyCompatibility,
  type CompatibilityDecision,
} from "./compatibility.js";
export { ContractFoundationError, type ContractFoundationErrorCode } from "./foundation-error.js";
export { validateExampleSuite } from "./examples.js";
export { validateContractInventory, type InventoryValidation } from "./inventory.js";
export {
  ContractRegistry,
  loadContractRegistry,
  type LoadedContractRegistry,
  type SchemaRegistryEntry,
} from "./registry.js";
export { defaultRepositoryRoot, isSafeRepositoryPath, type JsonObject } from "./repository.js";
export type {
  CompatibilityResult,
  ContractIdentity,
  ContractValidationError,
  ContractValidationFailure,
  ContractValidationFailureCode,
  ContractValidationResult,
  ContractValidationSuccess,
  ExampleSuiteResult,
  SchemaMetaValidationResult,
  SchemaRegistryValidationResult,
  SchemaTypeConsistencyResult,
} from "./result-types.js";
export type * from "./types.generated.js";
