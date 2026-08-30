import {
  Ajv2020,
  type AnySchemaObject,
  type ErrorObject,
  type Options,
  type ValidateFunction,
} from "ajv/dist/2020.js";

import type { ContractValidationError } from "./result-types.js";

const rfc3339DateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

const ajvOptions: Options = {
  allErrors: true,
  allowUnionTypes: false,
  strict: true,
  strictRequired: false,
  strictTypes: false,
  validateFormats: true,
};

export function createJsonSchemaAuthority(): Ajv2020 {
  const ajv = new Ajv2020(ajvOptions);
  ajv.addKeyword({ keyword: "x-schemaVersion", schemaType: "string" });
  ajv.addFormat("date-time", rfc3339DateTime);
  ajv.addFormat("uri", {
    type: "string",
    validate(value: string): boolean {
      try {
        void new URL(value);
        return true;
      } catch {
        return /^urn:[a-z0-9][a-z0-9-]{0,31}:.+$/iu.test(value);
      }
    },
  });
  return ajv;
}

export function asSchemaObject(value: Readonly<Record<string, unknown>>): AnySchemaObject {
  return value;
}

export function structuredValidationErrors(
  errors: readonly ErrorObject[] | null | undefined,
): readonly ContractValidationError[] {
  return (errors ?? []).map((error) => ({
    keyword: error.keyword,
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    message: error.message ?? "JSON Schema validation failed",
    params: { ...error.params },
  }));
}

export function requireValidator(ajv: Ajv2020, schemaId: string): ValidateFunction | undefined {
  return ajv.getSchema(schemaId);
}
