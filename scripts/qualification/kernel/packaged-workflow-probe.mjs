import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const artifactRoot = resolve(process.argv[2]);
const packageEntry = (name) =>
  pathToFileURL(join(artifactRoot, "app", "node_modules", "@aseos", name, "dist", "index.js")).href;
const { loadContractRegistry } = await import(packageEntry("contracts"));
const { PersistenceWorker } = await import(packageEntry("persistence"));
const { WorkflowService } = await import(packageEntry("platform"));
const repositoryRoot = join(artifactRoot, "app", "authority");
const registry = await loadContractRegistry(repositoryRoot);
const command = JSON.parse(
  await readFile(
    new URL(
      "../../../packages/contracts/examples/first-slice/valid/create-workflow-run.command.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const dataRoot = await mkdtemp(join(tmpdir(), "aseos P2 打包工作流 "));
let worker;
try {
  worker = await PersistenceWorker.open({ dataRoot, repositoryRoot });
  const first = await new WorkflowService({ registry, persistence: worker }).execute(command);
  await worker.close();
  worker = await PersistenceWorker.open({ dataRoot, repositoryRoot });
  const resumed = new WorkflowService({ registry, persistence: worker });
  assert.deepEqual(await resumed.execute(command), first);
  assert.deepEqual(await resumed.replay(command.aggregateId), { state: first.state, version: 1 });
  assert.equal((await worker.recover()).eventCount, 1);
  console.log(
    JSON.stringify({
      evidenceType: "PackagedDurableWorkflowResult",
      result: "PASS",
      restartReplay: true,
      duplicateEventCount: 0,
    }),
  );
} finally {
  await worker?.close();
  await rm(dataRoot, { recursive: true, force: true });
}
