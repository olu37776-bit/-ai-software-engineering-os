import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import { normalizeUtf8Lf, sha256Utf8Lf } from "../../../scripts/toolchain/lib.mjs";

const root = resolve(import.meta.dirname, "../../..");

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

describe("exact toolchain manifest", () => {
  test("validates against its JSON Schema and matches package dependency identity", async () => {
    const [schema, manifest, packageManifest] = await Promise.all([
      readJson("toolchain/toolchain.schema.json"),
      readJson("toolchain/toolchain.json"),
      readJson("package.json"),
    ]);
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validate = ajv.compile(schema);

    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
    expect(packageManifest.devDependencies).toEqual(manifest.tools);
    expect(packageManifest.packageManager).toBe("pnpm@11.24.0");
    expect(manifest.authority).toMatchObject({
      node: "24.19.0",
      pnpm: "11.24.0",
      typescript: "6.0.3",
      packageType: "module",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      target: "ES2025",
    });
  });

  test("uses one canonical lockfile hash for LF and CRLF checkouts", async () => {
    const [manifest, lockfile] = await Promise.all([
      readJson("toolchain/toolchain.json"),
      readFile(resolve(root, "pnpm-lock.yaml"), "utf8"),
    ]);
    expect(manifest.packageManager.lockfileHashPolicy).toBe("SHA256_UTF8_LF_NORMALIZED");
    expect(sha256Utf8Lf(lockfile)).toBe(manifest.packageManager.lockfileSha256);
    expect(sha256Utf8Lf(normalizeUtf8Lf(lockfile).replace(/\n/g, "\r\n"))).toBe(
      manifest.packageManager.lockfileSha256,
    );
  });
});
