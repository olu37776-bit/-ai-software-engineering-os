import assert from "node:assert/strict";
import { request } from "node:http";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { loadContractRegistry } from "@aseos/contracts";

import {
  BoundedIdempotencyRegistry,
  createControlApiClient,
  redactForPublicBoundary,
  startControlApi,
} from "../dist/index.js";
import { windowsCurrentUserSidFromWhoami } from "../dist/filesystem.js";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

test("Windows identity parsing binds one exact CSV record to a bounded numeric SID", () => {
  const sid = "S-1-5-21-111111111-222222222-333333333-1001";
  for (const whoamiOutput of [
    `"FV-AZ123\\runneradmin","${sid}"\r\n`,
    `"runneradmin","${sid}"\r\n`,
    `"FV-AZ123\\evil runneradmin","${sid}"\r\n`,
    `"FV-AZ123\\runner, ""admin""","${sid}"\r\n`,
  ]) {
    assert.equal(windowsCurrentUserSidFromWhoami(whoamiOutput), sid, whoamiOutput);
  }
  assert.equal(windowsCurrentUserSidFromWhoami('"runneradmin","not-a-sid"\r\n'), undefined);
  assert.equal(windowsCurrentUserSidFromWhoami(`header\r\n"runneradmin","${sid}"\r\n`), undefined);
  assert.equal(windowsCurrentUserSidFromWhoami(`"runneradmin","${sid}","extra"\r\n`), undefined);
  assert.equal(windowsCurrentUserSidFromWhoami('"runneradmin","S-1-5-4294967296"\r\n'), undefined);
  assert.equal(windowsCurrentUserSidFromWhoami(`"header\r\nuser","${sid}"\r\n`), undefined);
  assert.equal(windowsCurrentUserSidFromWhoami(`"header\nuser","${sid}"\r\n`), undefined);
});

async function rawRequest(
  runtime,
  { path = "/v1/health", token, host, origin, method = "GET" } = {},
) {
  return await new Promise((resolve, reject) => {
    const outgoing = request(
      {
        host: "127.0.0.1",
        port: runtime.descriptor.port,
        path,
        method,
        headers: {
          ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
          host: host ?? `127.0.0.1:${runtime.descriptor.port}`,
          ...(origin === undefined ? {} : { origin }),
        },
      },
      async (response) => {
        const chunks = [];
        for await (const chunk of response) chunks.push(Buffer.from(chunk));
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      },
    );
    outgoing.once("error", reject);
    outgoing.end();
  });
}

function assertContract(registry, schemaId, value) {
  const result = registry.validate({ schemaId, schemaVersion: "1.0.0" }, value);
  assert.equal(result.ok, true, JSON.stringify(result));
}

test("loopback runtime rotates credentials, authenticates public client and stops idempotently", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "aseos-platform-"));
  const registry = await loadContractRegistry(repositoryRoot);
  const runtime = await startControlApi({
    dataRoot,
    frameworkVersion: "0.1.0",
    releaseId: "test-release",
  });
  const firstToken = (await readFile(runtime.tokenFilePath, "utf8")).trim();
  try {
    assert.equal(runtime.descriptor.host, "127.0.0.1");
    assert.ok(runtime.descriptor.port > 0);
    assert.equal(JSON.stringify(runtime.descriptor).includes(firstToken), false);
    assertContract(
      registry,
      "urn:aseos:schema:control-endpoint-descriptor:1.0.0",
      runtime.descriptor,
    );
    if (process.platform !== "win32")
      assert.equal((await stat(runtime.tokenFilePath)).mode & 0o077, 0);

    const unauthenticated = await rawRequest(runtime);
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticated.headers["access-control-allow-origin"], undefined);
    assert.equal(unauthenticated.body.includes(firstToken), false);
    assertContract(
      registry,
      "urn:aseos:schema:control-api-problem:1.0.0",
      JSON.parse(unauthenticated.body),
    );

    const wrongHost = await rawRequest(runtime, { token: firstToken, host: "localhost" });
    assert.equal(wrongHost.status, 400);
    const wrongOrigin = await rawRequest(runtime, {
      token: firstToken,
      origin: "https://untrusted.invalid",
    });
    assert.equal(wrongOrigin.status, 403);
    assert.equal(wrongOrigin.headers["access-control-allow-origin"], undefined);

    const client = await createControlApiClient({ dataRoot });
    assert.equal((await client.version()).instanceId, runtime.descriptor.instanceId);
    const health = await client.health();
    assert.equal(health.readiness, "READY");
    assertContract(registry, "urn:aseos:schema:runtime-health:1.0.0", health);
    assert.equal((await client.status()).limits.sse.retentionCapacity, 512);
    assert.equal((await client.doctor()).status, "PASS");

    const abortController = new globalThis.AbortController();
    const iterator = client.events({ signal: abortController.signal })[Symbol.asyncIterator]();
    const nextEvent = iterator.next();
    await delay(25);
    const published = runtime.publishNotification({
      kind: "EVIDENCE_METADATA",
      subjectRef: { subjectType: "Evidence", subjectId: "test" },
      projectionVersion: 1,
      resourceUri: "/v1/evidence/test",
    });
    assertContract(registry, "urn:aseos:schema:control-event-notification:1.0.0", published);
    const received = await nextEvent;
    assert.equal(received.done, false);
    assert.equal(received.value.notificationId, published.notificationId);
    abortController.abort();

    const accepted = await client.stop({ idempotencyKey: "stop-test-key-0001" });
    assert.equal(accepted.status, "ACCEPTED");
    assertContract(registry, "urn:aseos:schema:control-operation-ref:1.0.0", accepted);
    await runtime.closed;
    await runtime.stop();
    await assert.rejects(readFile(runtime.descriptorPath, "utf8"));
    await assert.rejects(readFile(runtime.tokenFilePath, "utf8"));
  } finally {
    await runtime.stop();
  }

  const restarted = await startControlApi({
    dataRoot,
    frameworkVersion: "0.1.0",
    releaseId: "test-release",
  });
  try {
    const rotated = (await readFile(restarted.tokenFilePath, "utf8")).trim();
    assert.notEqual(rotated, firstToken);
  } finally {
    await restarted.stop();
  }
});

test("bounded idempotency detects payload conflicts and evicts oldest metadata", () => {
  const registry = new BoundedIdempotencyRegistry(2, 100);
  registry.record("key-1", "hash-a", "result-a", 1_000);
  assert.deepEqual(registry.lookup("key-1", "hash-a", 1_001), {
    outcome: "REPLAY",
    resultIdentity: "result-a",
  });
  assert.deepEqual(registry.lookup("key-1", "hash-b", 1_001), { outcome: "CONFLICT" });
  registry.record("key-2", "hash-b", "result-b", 1_001);
  registry.record("key-3", "hash-c", "result-c", 1_002);
  assert.deepEqual(registry.lookup("key-1", "hash-a", 1_003), { outcome: "MISS" });
  assert.deepEqual(registry.lookup("key-2", "hash-b", 1_102), { outcome: "MISS" });
});

test("public redaction removes bearer values and sensitive paths", () => {
  const token = "A".repeat(43);
  const redacted = redactForPublicBoundary(`Bearer ${token} at C:\\private\\secrets\\token.txt`);
  assert.equal(redacted.includes(token), false);
  assert.equal(redacted.includes("C:\\private"), false);
});
