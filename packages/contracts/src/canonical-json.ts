import { createHash } from "node:crypto";

function canonicalize(value: unknown, ancestors: Set<object>): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (Number.isNaN(value) || value === Infinity || value === -Infinity) {
      throw new TypeError("Canonical JSON does not permit non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "object") {
    if (ancestors.has(value)) {
      throw new TypeError("Canonical JSON does not permit cyclic values");
    }
    ancestors.add(value);
    try {
      const keys = Reflect.ownKeys(value);
      if (keys.some((key) => typeof key !== "string")) {
        throw new TypeError("Canonical JSON does not permit symbol properties");
      }
      if (Array.isArray(value)) {
        if (keys.length !== value.length + 1) {
          throw new TypeError("Canonical JSON requires dense arrays without extra properties");
        }
        const items: string[] = [];
        for (let index = 0; index < value.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
            throw new TypeError("Canonical JSON requires dense arrays with data properties");
          }
          items.push(canonicalize(descriptor.value, ancestors));
        }
        return `[${items.join(",")}]`;
      }
      const prototype: unknown = Object.getPrototypeOf(value);
      if (prototype !== null && prototype !== Object.prototype) {
        throw new TypeError("Canonical JSON requires plain objects");
      }
      const object = value as Readonly<Record<string, unknown>>;
      const members = Object.keys(object)
        .sort()
        .map((key) => {
          const descriptor = Object.getOwnPropertyDescriptor(object, key);
          if (!descriptor || !("value" in descriptor)) {
            throw new TypeError("Canonical JSON does not permit accessors");
          }
          return `${JSON.stringify(key)}:${canonicalize(descriptor.value, ancestors)}`;
        });
      if (members.length !== keys.length) {
        throw new TypeError("Canonical JSON does not permit non-enumerable properties");
      }
      return `{${members.join(",")}}`;
    } finally {
      ancestors.delete(value);
    }
  }
  throw new TypeError(`Value cannot be represented as canonical JSON: ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return canonicalize(value, new Set());
}

export function canonicalJsonSha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
