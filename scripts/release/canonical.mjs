import { createHash } from "node:crypto";
import { open } from "node:fs/promises";

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertJsonValue(value, location, seen) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Non-finite number at ${location}`);
    }
    return;
  }
  if (typeof value !== "object") {
    throw new TypeError(`Non-JSON value at ${location}`);
  }
  if (seen.has(value)) {
    throw new TypeError(`Cyclic value at ${location}`);
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        throw new TypeError(`Sparse array at ${location}[${index}]`);
      }
      assertJsonValue(value[index], `${location}[${index}]`, seen);
    }
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`Non-plain object at ${location}`);
    }
    for (const key of Object.keys(value)) {
      assertJsonValue(value[key], `${location}.${key}`, seen);
    }
  }
  seen.delete(value);
}

function serializeCanonical(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => serializeCanonical(entry)).join(",")}]`;
  }
  const entries = Object.keys(value)
    .sort(compareCodeUnits)
    .map((key) => `${JSON.stringify(key)}:${serializeCanonical(value[key])}`);
  return `{${entries.join(",")}}`;
}

export function canonicalJson(value) {
  assertJsonValue(value, "$", new Set());
  return serializeCanonical(value);
}

export function canonicalJsonBytes(value, { trailingLf = true } = {}) {
  return Buffer.from(`${canonicalJson(value)}${trailingLf ? "\n" : ""}`, "utf8");
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function sha256File(path) {
  const handle = await open(path, "r");
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let sizeBytes = 0;
  try {
    const before = await handle.stat();
    if (!before.isFile()) {
      throw new Error(`Not a regular file: ${path}`);
    }
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) {
        break;
      }
      hash.update(buffer.subarray(0, bytesRead));
      sizeBytes += bytesRead;
    }
    const after = await handle.stat();
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      sizeBytes !== after.size
    ) {
      throw new Error(`File changed while hashing: ${path}`);
    }
    return { sha256: hash.digest("hex"), sizeBytes };
  } finally {
    await handle.close();
  }
}

export { compareCodeUnits };
