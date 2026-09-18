import { fork } from "node:child_process";
import { once } from "node:events";
import { promises as filesystem } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { createControlApiClient } from "@aseos/platform";
import { expect, test } from "vitest";

import { acquireRuntimeLock, controlPaths } from "../../../packages/platform/dist/filesystem.js";
import { authenticatedFetch, readBearer, withControlApi } from "./helpers.mjs";

test("concurrent lock losers cannot remove a live owner's claim or metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "aseos-lock-race-"));
  const ioFailures = [];
  const originals = new Map();
  for (const method of [
    "mkdir",
    "readdir",
    "readFile",
    "writeFile",
    "open",
    "stat",
    "rename",
    "rm",
  ]) {
    const original = filesystem[method];
    originals.set(method, original);
    filesystem[method] = (...args) =>
      original(...args).catch((error) => {
        if (String(args[0]).includes(root) && error.code !== "ENOENT") {
          ioFailures.push({ method, code: error.code, message: error.message });
        }
        throw error;
      });
  }
  syncBuiltinESMExports();
  try {
    for (let round = 0; round < 40; round += 1) {
      const settled = await Promise.allSettled(
        Array.from({ length: 16 }, (_, index) =>
          acquireRuntimeLock(root, `owner-${round}-${index}`),
        ),
      );
      const winners = settled.filter((result) => result.status === "fulfilled");
      try {
        expect(
          winners,
          JSON.stringify({
            round,
            failures: settled
              .filter((result) => result.status === "rejected")
              .map(({ reason }) => ({ code: reason.code, message: reason.message })),
            ioFailures: ioFailures.slice(-32),
          }),
        ).toHaveLength(1);
        expect(settled.filter((result) => result.status === "rejected")).toHaveLength(15);
        expect(await readdir(`${controlPaths(root).lockFilePath}.claims`)).toHaveLength(1);
        await expect(acquireRuntimeLock(root, "late-contender")).rejects.toMatchObject({
          code: "CONTROL_RUNTIME_ALREADY_ACTIVE",
        });
      } finally {
        await Promise.all(winners.flatMap(({ value }) => [value(), value()]));
      }
    }
    expect(await readdir(`${controlPaths(root).lockFilePath}.claims`)).toEqual([]);
  } finally {
    for (const [method, original] of originals) filesystem[method] = original;
    syncBuiltinESMExports();
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);

test("separate processes elect one owner and recover a killed owner's unique claim", async () => {
  const root = await mkdtemp(join(tmpdir(), "aseos-lock-processes-"));
  const children = [];
  try {
    for (let index = 0; index < 8; index += 1) {
      const child = fork(new URL("./runtime-lock-contender.mjs", import.meta.url), [], {
        stdio: ["ignore", "ignore", "inherit", "ipc"],
      });
      children.push(child);
      expect((await once(child, "message"))[0]).toEqual({ ready: true });
    }
    const results = await Promise.all(
      children.map(async (child, index) => {
        const result = once(child, "message");
        child.send({ action: "acquire", dataRoot: root, instanceId: `process-${index}` });
        return (await result)[0];
      }),
    );
    expect(results.filter((result) => result.acquired)).toHaveLength(1);
    const winner = children[results.findIndex((result) => result.acquired)];
    const exited = once(winner, "exit");
    winner.kill("SIGKILL");
    await exited;
    const release = await acquireRuntimeLock(root, "recovered-owner");
    try {
      expect(JSON.parse(await readFile(controlPaths(root).lockFilePath, "utf8"))).toMatchObject({
        instanceId: "recovered-owner",
        pid: process.pid,
      });
      expect(await readdir(`${controlPaths(root).lockFilePath}.claims`)).toHaveLength(1);
    } finally {
      await release();
    }
  } finally {
    await Promise.all(
      children.map(async (child) => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        const exited = once(child, "exit");
        child.kill("SIGKILL");
        await exited;
      }),
    );
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);

test("timed-out unfinished bodies close their socket and release capacity exactly once", async () => {
  await withControlApi(
    async ({ runtime }) => {
      const token = await readBearer(runtime);
      for (let round = 0; round < 5; round += 1) {
        const outgoing = request({
          host: "127.0.0.1",
          port: runtime.descriptor.port,
          path: "/v1/runtime/stop",
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "transfer-encoding": "chunked",
            "idempotency-key": `timeout-stop-${round}`,
            "if-match": `"${runtime.descriptor.instanceId}"`,
          },
        });
        outgoing.on("error", () => {});
        const responsePromise = once(outgoing, "response");
        const closed = new Promise((resolve) => outgoing.once("close", resolve));
        try {
          outgoing.flushHeaders();
          const [response] = await responsePromise;
          const chunks = [];
          for await (const chunk of response) chunks.push(chunk);
          expect(response.statusCode).toBe(504);
          expect(JSON.parse(Buffer.concat(chunks).toString()).code).toBe("CONTROL_REQUEST_TIMEOUT");
          await closed;
          expect(outgoing.destroyed).toBe(true);
          expect((await authenticatedFetch(runtime, "/v1/health")).status).toBe(200);
        } finally {
          outgoing.destroy();
        }
      }
      expect((await authenticatedFetch(runtime, "/v1/status")).status).toBe(200);
    },
    { limits: { maxConcurrentRequests: 1, requestTimeoutMs: 100 } },
  );
}, 30_000);

async function withWireServer(run, { chunks = [], healthStatus = 200 } = {}) {
  await withControlApi(async ({ dataRoot, runtime }) => {
    const health = await (await authenticatedFetch(runtime, "/v1/health")).json();
    const server = createServer((incoming, response) => {
      if (incoming.url === "/v1/health") {
        response.writeHead(healthStatus, { "content-type": "application/json" });
        response.end(JSON.stringify(health));
        return;
      }
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.flushHeaders();
      void (async () => {
        for (const chunk of chunks) {
          if (response.destroyed) return;
          response.write(chunk);
          await delay(10);
        }
        response.end();
      })();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      await writeFile(
        runtime.descriptorPath,
        JSON.stringify({
          ...runtime.descriptor,
          port: server.address().port,
        }),
      );
      await run({ dataRoot, runtime });
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });
}

test("SSE preserves Unicode split inside multibyte characters", async () => {
  const notification = {
    schemaVersion: "1.0.0",
    notificationId: "0198e0a1-0000-7000-8000-000000000001",
    kind: "EVIDENCE_METADATA",
    subjectRef: { subjectType: "Evidence", subjectId: "中文😀证据" },
    projectionVersion: 1,
    occurredAt: "2026-09-08T00:00:00Z",
    resourceUri: "/v1/evidence/example",
  };
  const bytes = Buffer.from(`event: EVIDENCE_METADATA\ndata: ${JSON.stringify(notification)}\n\n`);
  const split = bytes.indexOf(Buffer.from("中")) + 1;
  await withWireServer(
    async ({ dataRoot }) => {
      const client = await createControlApiClient({ dataRoot });
      const items = [];
      for await (const item of client.events()) items.push(item);
      expect(items).toEqual([notification]);
    },
    {
      chunks: [
        bytes.subarray(0, split),
        bytes.subarray(split, split + 1),
        bytes.subarray(split + 1),
      ],
    },
  );
});

test.each([
  ["invalid UTF-8", Buffer.from([0xc3, 0x28])],
  ["truncated UTF-8", Buffer.from([0xe4, 0xb8])],
  ["incomplete frame", Buffer.from('event: gap\ndata: {"code":"CONTROL_SSE_RETENTION_GAP"}')],
])("SSE rejects %s without silently changing its payload", async (_label, bytes) => {
  await withWireServer(
    async ({ dataRoot }) => {
      const client = await createControlApiClient({ dataRoot });
      await expect(client.events()[Symbol.asyncIterator]().next()).rejects.toMatchObject({
        code: "CONTROL_CLIENT_EVENT_INVALID",
      });
    },
    { chunks: [bytes] },
  );
});

test("discovery rejects a valid health body bound to an unregistered success status", async () => {
  await withWireServer(
    async ({ dataRoot }) => {
      await expect(createControlApiClient({ dataRoot })).rejects.toMatchObject({
        code: "CONTROL_CLIENT_RESPONSE_INVALID",
      });
    },
    { healthStatus: 201 },
  );
});
