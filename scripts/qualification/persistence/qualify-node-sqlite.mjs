import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { PersistenceWorker } from "@aseos/persistence";

import { makeJournalBatch } from "../../../tests/qualification/persistence/helpers.mjs";

const dataRoot = await mkdtemp(join(tmpdir(), "aseos-p1-v06-nfr-"));
const backupPath = join(dataRoot, "backup", "aseos.db");
const totalEvents = 100_000;
const batchSize = 1_000;
const worker = await PersistenceWorker.open({ dataRoot, maxQueueDepth: 16 });

try {
  const appendStarted = performance.now();
  for (let sequence = 0; sequence < totalEvents / batchSize; sequence += 1) {
    await worker.commit(
      makeJournalBatch({
        sequence: sequence + 1,
        expectedVersion: sequence * batchSize,
        eventCount: batchSize,
        outboxCount: 0,
      }),
    );
  }
  const appendDurationMs = performance.now() - appendStarted;

  const replayStarted = performance.now();
  const replay = await worker.readEvents("QualificationStream", "qualification-stream", 10_000);
  const replayDurationMs = performance.now() - replayStarted;

  const recoveryStarted = performance.now();
  const recovery = await worker.recover();
  const recoveryDurationMs = performance.now() - recoveryStarted;

  const [health, stateManifest, security, backup] = await Promise.all([
    worker.health(),
    worker.stateSchemaManifest(),
    worker.qualifySecurityControls(),
    worker.backup(backupPath),
  ]);

  if (
    replay.length !== 10_000 ||
    recovery.eventCount !== totalEvents ||
    health.sqliteVersion !== "3.53.3" ||
    stateManifest.compatibility !== "COMPATIBLE" ||
    backup.integrity !== "ok"
  ) {
    throw new Error("P1_V06_NFR_QUALIFICATION_FAILED");
  }

  process.stdout.write(
    JSON.stringify(
      {
        evidenceType: "PersistencePerformanceQualificationResult",
        result: "PASS",
        totalEvents,
        batchSize,
        appendDurationMs: Math.round(appendDurationMs),
        replay: {
          events: replay.length,
          durationMs: Math.round(replayDurationMs),
        },
        recovery: {
          events: recovery.eventCount,
          durationMs: Math.round(recoveryDurationMs),
        },
        eventLoopIsolation: "DEDICATED_WORKER_THREAD",
        health,
        stateManifest,
        security,
        backup: {
          sha256: backup.sha256,
          sizeBytes: backup.sizeBytes,
          pages: backup.pages,
          integrity: backup.integrity,
        },
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await worker.close();
  await rm(dataRoot, { force: true, recursive: true });
}
