export type ContractFoundationErrorCode =
  | "DUPLICATE_SCHEMA_IDENTITY"
  | "DUPLICATE_SCHEMA_PATH"
  | "INVALID_AUTHORITY_PATH"
  | "INVALID_JSON"
  | "MISSING_AUTHORITY_FILE"
  | "REPOSITORY_ESCAPE"
  | "SCHEMA_COMPILE_FAILED"
  | "SCHEMA_HASH_MISMATCH"
  | "SCHEMA_META_VALIDATION_FAILED"
  | "SCHEMA_METADATA_MISMATCH"
  | "UNRESOLVED_SCHEMA_REFERENCE"
  | "VALIDATION_INPUT_INVALID";

export class ContractFoundationError extends Error {
  public readonly code: ContractFoundationErrorCode;
  public readonly details: Readonly<Record<string, unknown>>;

  public constructor(
    code: ContractFoundationErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "ContractFoundationError";
    this.code = code;
    this.details = details;
  }
}
