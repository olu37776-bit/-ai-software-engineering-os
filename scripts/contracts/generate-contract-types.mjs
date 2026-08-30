import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { generateContractTypeSource } from "./type-model.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const outputPath = resolve(repositoryRoot, "packages/contracts/src/types.generated.ts");

function normalizeLineEndings(source, label) {
  const withoutCrLf = source.replaceAll("\r\n", "");
  if (withoutCrLf.includes("\r")) {
    throw new Error(`SCHEMA_TYPE_GENERATION_INVALID_LINE_ENDINGS: ${label} contains a lone CR`);
  }
  if (source.includes("\r\n") && withoutCrLf.includes("\n")) {
    throw new Error(
      `SCHEMA_TYPE_GENERATION_INVALID_LINE_ENDINGS: ${label} contains mixed LF and CRLF`,
    );
  }
  return source.replaceAll("\r\n", "\n");
}

export function assertGeneratedTypeSourceCurrent(actual, expected) {
  const normalizedActual = normalizeLineEndings(actual, "generated source");
  const normalizedExpected = normalizeLineEndings(expected, "expected source");
  if (normalizedActual !== normalizedExpected) {
    throw new Error("SCHEMA_TYPE_GENERATION_DRIFT: packages/contracts/src/types.generated.ts");
  }
}

async function main(mode) {
  if (mode !== "--check" && mode !== "--write") {
    throw new Error("Usage: generate-contract-types.mjs --check|--write");
  }

  const expected = await generateContractTypeSource(repositoryRoot);
  if (mode === "--write") {
    await writeFile(outputPath, expected, "utf8");
    process.stdout.write(`${outputPath}\n`);
    return;
  }

  const actual = await readFile(outputPath, "utf8");
  assertGeneratedTypeSourceCurrent(actual, expected);
  process.stdout.write("Schema-generated TypeScript declarations are current.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main(process.argv[2]);
}
