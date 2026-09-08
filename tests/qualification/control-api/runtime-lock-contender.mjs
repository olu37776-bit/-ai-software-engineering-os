import { acquireRuntimeLock } from "../../../packages/platform/dist/filesystem.js";

let release;
process.on("message", async ({ action, dataRoot, instanceId }) => {
  try {
    if (action === "acquire") {
      release = await acquireRuntimeLock(dataRoot, instanceId);
      process.send({ acquired: true, pid: process.pid });
    } else {
      await release?.();
      process.send({ released: true });
    }
  } catch (error) {
    process.send({ acquired: false, code: error.code });
  }
});
process.send({ ready: true });
