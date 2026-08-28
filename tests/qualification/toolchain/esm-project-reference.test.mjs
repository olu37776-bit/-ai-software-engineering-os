import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import fc from "fast-check";
import { describe, expect, test } from "vitest";

const compiledEntry = resolve(
  import.meta.dirname,
  "../../../artifacts/qualification/toolchain/build/index.js",
);

describe("authority project-reference ESM output", () => {
  test("loads emitted ESM through a Unicode and space-path source import", async () => {
    const module = await import(pathToFileURL(compiledEntry).href);
    expect(module.QUALIFICATION_MARKER).toBe("ESM 中文/space path qualification");

    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(module.normalizeQualificationLabel(`  ${value}  `)).toBe(
          value.normalize("NFC").trim(),
        );
      }),
    );
  });
});
