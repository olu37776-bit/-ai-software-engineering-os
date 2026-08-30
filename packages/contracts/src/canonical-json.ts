import { createHash } from "node:crypto";

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (Number.isNaN(value) || value === Infinity || value === -Infinity) {
      throw new TypeError("Canonical JSON does not permit non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const object = value as Readonly<Record<string, unknown>>;
    const members = Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`);
    return `{${members.join(",")}}`;
  }
  throw new TypeError(`Value cannot be represented as canonical JSON: ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return canonicalize(value);
}

export function canonicalJsonSha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
