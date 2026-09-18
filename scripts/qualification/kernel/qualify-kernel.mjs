import { run } from "../../toolchain/lib.mjs";

// The suite imports compiled public workspace packages and uses real SQLite workers.
console.log(
  run(process.execPath, [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "tests/qualification/kernel/vitest.config.mjs",
  ]),
);
console.log(
  JSON.stringify({
    schemaVersion: "1.0.0",
    evidenceType: "DurableWorkflowQualificationResult",
    operationId: "P2-O01",
    result: "PASS",
    boundaries: ["DETERMINISTIC_CREATE_AND_REPLAY", "RESTART_SAFE_DEDUP", "REAL_SQLITE"],
    productionApproved: false,
  }),
);
