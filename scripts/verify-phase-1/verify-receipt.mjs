#!/usr/bin/env node

import { resolve } from "node:path";

import { verifyPhase1Receipt } from "./receipt-verifier.mjs";

function usage() {
  return "Usage: node scripts/verify-phase-1/verify-receipt.mjs --receipt <path> [--independent-receipt <path>] [--repository-root <path>] [--json]";
}

function parseArguments(argv) {
  const options = { repositoryRoot: process.cwd(), json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      options.json = true;
      continue;
    }
    if (["--receipt", "--independent-receipt", "--repository-root"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      index += 1;
      if (argument === "--receipt") options.receiptPath = value;
      if (argument === "--independent-receipt") options.independentReceiptPath = value;
      if (argument === "--repository-root") options.repositoryRoot = value;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.receiptPath) throw new Error("--receipt is required");
  return options;
}

function printHuman(result) {
  process.stdout.write(`Phase 1 receipt verification: ${result.result}\n`);
  for (const check of result.checks) process.stdout.write(`- ${check.result} ${check.id}\n`);
  for (const item of result.errors) {
    process.stdout.write(`  ${item.code}: ${item.message}${item.path ? ` (${item.path})` : ""}\n`);
  }
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (cause) {
    process.stderr.write(`${cause.message}\n${usage()}\n`);
    process.exitCode = 2;
    return;
  }

  try {
    const result = await verifyPhase1Receipt({
      repositoryRoot: resolve(options.repositoryRoot),
      receiptPath: resolve(options.receiptPath),
      executingVerifierPath: process.argv[1],
      independentReceiptPath: options.independentReceiptPath
        ? resolve(options.independentReceiptPath)
        : undefined,
    });
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else printHuman(result);
    process.exitCode = result.result === "PASS" ? 0 : 1;
  } catch (cause) {
    const failure = {
      schemaVersion: "1.0.0",
      kind: "Phase1ReceiptVerificationResult",
      result: "FAIL",
      receiptPath: resolve(options.receiptPath),
      checks: [],
      errors: [{ code: "VERIFIER_INTERNAL_ERROR", message: cause.message }],
    };
    if (options.json) process.stdout.write(`${JSON.stringify(failure)}\n`);
    else process.stderr.write(`Phase 1 receipt verifier failed: ${cause.message}\n`);
    process.exitCode = 2;
  }
}

await main();
