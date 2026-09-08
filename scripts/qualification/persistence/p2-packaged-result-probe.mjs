import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const artifactRoot = resolve(process.argv[2]);
const { PersistenceWorker } = await import(
  pathToFileURL(
    join(artifactRoot, "app", "node_modules", "@aseos", "persistence", "dist", "index.js"),
  ).href
);
const fixture = async (name) =>
  JSON.parse(
    await readFile(
      new URL(
        `../../../packages/contracts/examples/persistence/valid/${name}.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  );
const scheduled = await fixture("result-journal-scheduled-batch");
const input = await fixture("result-journal-append-batch");
const dataRoot = await mkdtemp(join(tmpdir(), "aseos P2 原子结果 "));
const repositoryRoot = join(artifactRoot, "app", "authority");
let worker;
try {
  worker = await PersistenceWorker.open({ dataRoot, repositoryRoot });
  await worker.commit(scheduled);
  await worker.close();
  worker = await PersistenceWorker.open({ dataRoot, repositoryRoot });
  assert.deepEqual(
    (await worker.listPendingOutboxTasks()).map((task) => task.taskId),
    [input.result.taskId],
  );
  const first = await worker.commitResult(input);
  await worker.close();
  worker = await PersistenceWorker.open({ dataRoot, repositoryRoot });
  assert.deepEqual(await worker.commitResult(input), first);
  assert.deepEqual(await worker.listPendingOutboxTasks(), []);
  const recovery = await worker.recover();
  assert.equal(recovery.eventCount, 2);
  assert.equal(recovery.inboxCount, 1);
  assert.equal(recovery.commandCount, 2);
  console.log(
    JSON.stringify({
      evidenceType: "PackagedAtomicResultJournalResult",
      result: "PASS",
      restartReceipt: true,
      acceptedResultCount: 1,
    }),
  );
} finally {
  await worker?.close();
  await rm(dataRoot, { recursive: true, force: true });
}
