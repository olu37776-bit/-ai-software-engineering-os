import { networkInterfaces } from "node:os";
/* global AbortController, AbortSignal, fetch, setTimeout */
import { writeFile } from "node:fs/promises";

import { BoundedIdempotencyRegistry, createControlApiClient } from "@aseos/platform";
import { describe, expect, test } from "vitest";

import {
  authenticatedFetch,
  endpointUrl,
  rawHttpRequest,
  readBearer,
  readSseRecord,
  tokenAclEvidence,
  withControlApi,
} from "./helpers.mjs";

describe("P1-V07 authenticated loopback Control API", () => {
  test("binds only to the IPv4 loopback endpoint and rejects Host, Origin and unauthenticated access", async () => {
    await withControlApi(async ({ runtime }) => {
      expect(runtime.descriptor.host).toBe("127.0.0.1");
      expect(runtime.descriptor.port).toBeGreaterThan(0);

      const unauthenticated = await fetch(endpointUrl(runtime, "/v1/health"));
      expect(unauthenticated.status).toBe(401);
      expect(unauthenticated.headers.get("access-control-allow-origin")).toBeNull();

      const token = await readBearer(runtime);
      const wrongHost = await rawHttpRequest(runtime, "/v1/health", {
        authorization: `Bearer ${token}`,
        host: "localhost",
      });
      expect(wrongHost.status).toBe(400);
      expect(JSON.parse(wrongHost.body).code).toBe("CONTROL_HOST_REJECTED");

      const hostileOrigin = await authenticatedFetch(runtime, "/v1/health", {
        headers: { origin: "https://hostile.example" },
      });
      expect(hostileOrigin.status).toBe(403);
      expect(hostileOrigin.headers.get("access-control-allow-origin")).toBeNull();

      await expect(
        fetch(`http://[::1]:${String(runtime.descriptor.port)}/v1/health`, {
          signal: AbortSignal.timeout(500),
        }),
      ).rejects.toThrow();
      const lanAddress = Object.values(networkInterfaces())
        .flat()
        .find((entry) => entry?.family === "IPv4" && !entry.internal)?.address;
      if (lanAddress !== undefined) {
        await expect(
          fetch(`http://${lanAddress}:${String(runtime.descriptor.port)}/v1/health`, {
            signal: AbortSignal.timeout(500),
          }),
        ).rejects.toThrow();
      }
    });
  });

  test("rotates a 256-bit token, enforces user-only ACL and never leaks the secret", async () => {
    let firstToken = "";
    const dataRoot = await withControlApi(async ({ dataRoot, runtime }) => {
      firstToken = await readBearer(runtime);
      expect(firstToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      expect((await tokenAclEvidence(runtime.tokenFilePath)).userOnly).toBe(true);
      const rejected = await fetch(endpointUrl(runtime, "/v1/status"), {
        headers: {
          authorization: `Bearer ${firstToken.slice(0, -1)}x`,
          host: `${runtime.descriptor.host}:${String(runtime.descriptor.port)}`,
        },
      });
      const publicError = await rejected.text();
      expect(publicError).not.toContain(firstToken);
      expect(publicError).not.toContain(runtime.tokenFilePath);
      return dataRoot;
    });
    expect(dataRoot).toBeTypeOf("string");
    await withControlApi(async ({ runtime }) => {
      expect(await readBearer(runtime)).not.toBe(firstToken);
    });
  });

  test("validates discovery identity and exposes bounded status metadata through the public client", async () => {
    await withControlApi(async ({ dataRoot, runtime }) => {
      const client = await createControlApiClient({ dataRoot });
      expect(client.descriptor).toEqual(runtime.descriptor);
      await expect(client.version()).resolves.toMatchObject({
        apiVersion: "v1",
        frameworkVersion: "0.1.0",
        releaseId: "p1-v07-qualification",
        instanceId: runtime.descriptor.instanceId,
      });
      await expect(client.health()).resolves.toMatchObject({ readiness: "READY" });
      await expect(client.doctor()).resolves.toMatchObject({ status: "PASS" });
      const status = await client.status();
      expect(status.status).toBe("READY");
      expect(status.limits.authenticationRateLimit.capacity).toBeGreaterThan(0);
      expect(status.limits.idempotency.capacity).toBeGreaterThan(0);
      expect(status.limits.sse.connectionCapacity).toBeGreaterThan(0);
    });
  });

  test("rejects stale PID and authenticated instance identity mismatches", async () => {
    await withControlApi(async ({ dataRoot, runtime }) => {
      const descriptorText = `${JSON.stringify(runtime.descriptor, undefined, 2)}\n`;
      await writeFile(
        runtime.descriptorPath,
        `${JSON.stringify({ ...runtime.descriptor, pid: 2_147_483_647 }, undefined, 2)}\n`,
        "utf8",
      );
      await expect(createControlApiClient({ dataRoot })).rejects.toMatchObject({
        code: "CONTROL_DESCRIPTOR_STALE",
      });

      await writeFile(
        runtime.descriptorPath,
        `${JSON.stringify({ ...runtime.descriptor, instanceId: "00000000-0000-4000-8000-000000000000" }, undefined, 2)}\n`,
        "utf8",
      );
      await expect(createControlApiClient({ dataRoot })).rejects.toMatchObject({
        code: "CONTROL_ENDPOINT_IDENTITY_MISMATCH",
      });
      await writeFile(runtime.descriptorPath, descriptorText, "utf8");
    });
  });

  test("fails closed for malformed, oversized, query-bearing and unknown requests", async () => {
    await withControlApi(
      async ({ runtime }) => {
        const unknown = await authenticatedFetch(runtime, "/v1/not-a-route");
        expect(unknown.status).toBe(404);
        expect(unknown.headers.get("content-type")).toContain("application/problem+json");
        expect(await unknown.json()).toMatchObject({
          code: "CONTROL_ROUTE_NOT_FOUND",
          category: "VALIDATION",
          retryability: "NON_RETRYABLE",
        });

        const query = await authenticatedFetch(runtime, "/v1/status?sql=forbidden");
        expect(query.status).toBe(400);
        expect((await query.json()).code).toBe("CONTROL_QUERY_REJECTED");

        const body = await authenticatedFetch(runtime, "/v1/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ unknown: true }),
        });
        expect(body.status).toBe(413);
        expect((await body.json()).code).toBe("CONTROL_BODY_TOO_LARGE");

        const missingVersion = await authenticatedFetch(runtime, "/v1/runtime/stop", {
          method: "POST",
          headers: { "idempotency-key": "qualification-stop-missing-version" },
        });
        expect(missingVersion.status).toBe(428);
        expect((await missingVersion.json()).code).toBe("CONTROL_PRECONDITION_REQUIRED");

        const versionConflict = await authenticatedFetch(runtime, "/v1/runtime/stop", {
          method: "POST",
          headers: {
            "idempotency-key": "qualification-stop-version-conflict",
            "if-match": '"wrong-instance"',
          },
        });
        expect(versionConflict.status).toBe(412);
        expect((await versionConflict.json()).code).toBe("CONTROL_INSTANCE_VERSION_MISMATCH");
      },
      { limits: { maxBodyBytes: 8 } },
    );
  });

  test("bounds authentication failures and idempotency state with replay and conflict semantics", async () => {
    await withControlApi(
      async ({ runtime }) => {
        const headers = {
          authorization: "Bearer AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          host: `${runtime.descriptor.host}:${String(runtime.descriptor.port)}`,
        };
        expect((await fetch(endpointUrl(runtime, "/v1/health"), { headers })).status).toBe(401);
        const limited = await fetch(endpointUrl(runtime, "/v1/health"), { headers });
        expect(limited.status).toBe(429);
        expect(limited.headers.get("retry-after")).not.toBeNull();
      },
      { limits: { authFailureCapacity: 1 } },
    );

    const registry = new BoundedIdempotencyRegistry(2, 100);
    expect(registry.lookup("key-0001", "payload-a", 1)).toEqual({ outcome: "MISS" });
    registry.record("key-0001", "payload-a", "operation-a", 1);
    expect(registry.lookup("key-0001", "payload-a", 2)).toEqual({
      outcome: "REPLAY",
      resultIdentity: "operation-a",
    });
    expect(registry.lookup("key-0001", "payload-b", 2)).toEqual({ outcome: "CONFLICT" });
    registry.record("key-0002", "payload-b", "operation-b", 2);
    registry.record("key-0003", "payload-c", "operation-c", 3);
    expect(registry.size).toBeLessThanOrEqual(2);
  });

  test("streams bounded read-only SSE metadata and supports replay and gap detection", async () => {
    await withControlApi(
      async ({ dataRoot, runtime }) => {
        const client = await createControlApiClient({ dataRoot });
        const waitForReleasedConnection = async () => {
          for (let attempt = 0; attempt < 40; attempt += 1) {
            if ((await client.status()).limits.sse.activeConnections === 0) return;
            await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
          }
          throw new Error("SSE_CONNECTION_NOT_RELEASED");
        };
        const firstController = new AbortController();
        const firstStream = await authenticatedFetch(runtime, "/v1/events", {
          signal: firstController.signal,
        });
        expect(firstStream.status).toBe(200);
        expect(firstStream.headers.get("content-type")).toContain("text/event-stream");
        const first = runtime.publishNotification({
          kind: "EVIDENCE_METADATA",
          subjectRef: { subjectType: "Evidence", subjectId: "p1-v07-first" },
          projectionVersion: 1,
          resourceUri: "/v1/evidence/p1-v07-first",
        });
        const firstRecord = await readSseRecord(firstStream);
        expect(firstRecord.id).toBe(first.notificationId);
        expect(firstRecord.event).toBe("EVIDENCE_METADATA");
        firstController.abort();
        await waitForReleasedConnection();

        const second = runtime.publishNotification({
          kind: "OPERATION_METADATA",
          subjectRef: { subjectType: "Operation", subjectId: "p1-v07-second" },
          projectionVersion: 2,
          resourceUri: "/v1/operations/p1-v07-second",
        });
        const replayController = new AbortController();
        const replay = await authenticatedFetch(runtime, "/v1/events", {
          headers: { "last-event-id": first.notificationId },
          signal: replayController.signal,
        });
        expect((await readSseRecord(replay)).id).toBe(second.notificationId);
        replayController.abort();
        await waitForReleasedConnection();

        const gapController = new AbortController();
        const gap = await authenticatedFetch(runtime, "/v1/events", {
          headers: { "last-event-id": "unknown-notification" },
          signal: gapController.signal,
        });
        expect(await readSseRecord(gap)).toMatchObject({
          event: "gap",
          data: '{"code":"CONTROL_SSE_RETENTION_GAP"}',
        });
        gapController.abort();
      },
      { limits: { sseConnectionCapacity: 1, sseRetentionCapacity: 2, sseHeartbeatMs: 100 } },
    );
  });
});
