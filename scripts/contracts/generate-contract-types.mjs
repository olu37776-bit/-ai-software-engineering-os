import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { generateContractTypeSource } from "./type-model.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const outputPath = resolve(repositoryRoot, "packages/contracts/src/types.generated.ts");
const mode = process.argv[2];

if (mode !== "--check" && mode !== "--write") {
  throw new Error("Usage: generate-contract-types.mjs --check|--write");
}

const expected = await generateContractTypeSource(repositoryRoot);
if (mode === "--write") {
  await writeFile(outputPath, expected, "utf8");
  process.stdout.write(`${outputPath}\n`);
} else {
  const actual = await readFile(outputPath, "utf8");
  if (actual !== expected) {
    throw new Error("SCHEMA_TYPE_GENERATION_DRIFT: packages/contracts/src/types.generated.ts");
  }
  process.stdout.write("Schema-generated TypeScript declarations are current.\n");
}
