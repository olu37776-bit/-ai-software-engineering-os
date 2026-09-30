import { run } from "../../toolchain/lib.mjs";

console.log(
  run(process.execPath, [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "tests/qualification/persistence/p2-vitest.config.mjs",
  ]),
);
console.log(
  JSON.stringify({
    schemaVersion: "1.0.0",
    operationId: "P2-O02",
    evidenceType: "AtomicResultJournalQualificationResult",
    result: "PASS",
    storage: "REAL_SQLITE_DEDICATED_WORKER",
    productionApproved: false,
  }),
);
