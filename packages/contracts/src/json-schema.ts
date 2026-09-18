import {
  Ajv2020,
  type AnySchemaObject,
  type ErrorObject,
  type Options,
  type ValidateFunction,
} from "ajv/dist/2020.js";

import type { ContractValidationError } from "./result-types.js";

const rfc3339DateTime =
  /^(\d{4})-(\d{2})-(\d{2})[tT](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([zZ]|([+-])(\d{2}):(\d{2}))$/u;

function validDateTime(value: string): boolean {
  const match = rfc3339DateTime.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = Number(match[9] ?? 0);
  const offsetMinute = Number(match[10] ?? 0);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (days[month - 1] ?? 0) ||
    hour > 23 ||
    minute > 59 ||
    second > 60 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return false;
  }
  if (second < 60) return true;
  // RFC 3339 section 5.7: a leap second is at a UTC month boundary,
  // shifted by the numeric offset. Validation does not predict IERS announcements.
  const offset = (offsetHour * 60 + offsetMinute) * (match[8] === "-" ? -1 : 1);
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  utc.setUTCHours(hour, minute - offset, 59, 0);
  const next = new Date(utc.getTime() + 1000);
  return utc.getUTCHours() === 23 && utc.getUTCMinutes() === 59 && next.getUTCDate() === 1;
}

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
  ajv.addFormat("date-time", { type: "string", validate: validDateTime });
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
