import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "vitest";

import { qualifyPolicyMutations } from "../../../scripts/verify-phase-1/qualify-policy-mutations.mjs";

test("the compiled canonical Policy owner kills eight behavioral mutations while valid ALLOW survives", async () => {
  expect(await qualifyPolicyMutations()).toMatchObject({
    result: "PASS",
    baselineProbes: 8,
    killedMutations: 8,
    survivingMutations: 0,
  });
});

test("logical mutation identity survives a different checkout directory and CRLF emit bytes", async () => {
  const root = resolve(import.meta.dirname, "../../..");
  const copy = await mkdtemp(join(tmpdir(), "aseos-mutation-identity-"));
  try {
    await mkdir(join(copy, "packages/policy/dist"), { recursive: true });
    await writeFile(join(copy, "package.json"), '{"type":"module"}\n');
    await cp(join(root, "packages/contracts/dist"), join(copy, "packages/contracts/dist"), {
      recursive: true,
    });
    const source = await readFile(join(root, "packages/policy/dist/index.js"), "utf8");
    await writeFile(
      join(copy, "packages/policy/dist/index.js"),
      source.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"),
    );
    const original = await qualifyPolicyMutations(root);
    const relocated = await qualifyPolicyMutations(copy);
    expect(relocated.canonicalSourceSha256).toBe(original.canonicalSourceSha256);
    expect(relocated.cases).toEqual(original.cases);
  } finally {
    await rm(copy, { recursive: true, force: true });
  }
});
