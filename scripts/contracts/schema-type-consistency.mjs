import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import ts from "typescript";

import {
  collectSchemaShapeCounts,
  generateContractTypeSource,
  loadTypeModel,
} from "./type-model.mjs";

function diagnosticsText(diagnostics) {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  });
}

function countReadonlyProperties(source) {
  const file = ts.createSourceFile(
    "actual.ts",
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  let total = 0;
  let readonly = 0;
  const visit = (node) => {
    if (ts.isPropertySignature(node)) {
      total += 1;
      if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)) {
        readonly += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { total, readonly };
}

export async function runSchemaTypeConsistency({
  repositoryRoot,
  schemaOverrides = new Map(),
  typeSource,
} = {}) {
  const root = repositoryRoot ?? resolve(import.meta.dirname, "../..");
  const model = await loadTypeModel(root, schemaOverrides);
  const expected = await generateContractTypeSource(root, schemaOverrides);
  const actual =
    typeSource ??
    (await readFile(resolve(root, "packages/contracts/src/types.generated.ts"), "utf8"));
  const temporary = await mkdtemp(resolve(tmpdir(), "aseos-contract-types-"));
  try {
    await Promise.all([
      writeFile(resolve(temporary, "expected.ts"), expected, "utf8"),
      writeFile(resolve(temporary, "actual.ts"), actual, "utf8"),
    ]);
    const checks = model.bindings
      .map(
        (binding) =>
          `type ${binding.exportName}Consistency = Assert<Exact<Actual.${binding.exportName}, Expected.${binding.exportName}>>;`,
      )
      .join("\n");
    const assertionSource = [
      'import type * as Actual from "./actual.js";',
      'import type * as Expected from "./expected.js";',
      "type Assert<T extends true> = T;",
      "type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;",
      checks,
      "export {};",
    ].join("\n");
    const assertionPath = resolve(temporary, "assert.ts");
    await writeFile(assertionPath, assertionSource, "utf8");
    const program = ts.createProgram({
      rootNames: [
        assertionPath,
        resolve(temporary, "actual.ts"),
        resolve(temporary, "expected.ts"),
      ],
      options: {
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        target: ts.ScriptTarget.ES2025,
        strict: true,
        exactOptionalPropertyTypes: true,
        noEmit: true,
        skipLibCheck: false,
      },
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length > 0) {
      throw new Error(`SCHEMA_TYPE_SEMANTIC_DRIFT\n${diagnosticsText(diagnostics)}`);
    }
    const readonlyCounts = countReadonlyProperties(actual);
    if (readonlyCounts.total === 0 || readonlyCounts.readonly !== readonlyCounts.total) {
      throw new Error(
        `SCHEMA_TYPE_READONLY_DRIFT: readonly=${readonlyCounts.readonly} total=${readonlyCounts.total}`,
      );
    }
    const shape = collectSchemaShapeCounts(model);
    return {
      evidenceType: "SchemaTypeConsistencyResult",
      result: "PASS",
      bindings: model.bindings.length,
      ...shape,
      readonlyExportChecks: readonlyCounts.total,
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  process.stdout.write(`${JSON.stringify(await runSchemaTypeConsistency(), null, 2)}\n`);
}
