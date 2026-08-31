import { executeRestrictedWorkerTask } from "./index.js";
import type { RestrictedWorkerTaskRequest } from "./types.js";

async function readRequest(): Promise<RestrictedWorkerTaskRequest> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk as Uint8Array);
    bytes += buffer.length;
    if (bytes > 1_048_576) {
      throw new Error("Worker request exceeds 1 MiB");
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as RestrictedWorkerTaskRequest;
}

try {
  const result = await executeRestrictedWorkerTask(await readRequest(), {
    resolve: () => undefined,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "BLOCKED" ? 2 : 0;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
