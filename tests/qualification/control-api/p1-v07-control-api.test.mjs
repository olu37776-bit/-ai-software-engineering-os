import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
/* global AbortController, AbortSignal, fetch, setTimeout */

import {
  BoundedIdempotencyRegistry,
  ControlApiError,
  createControlApiClient,
} from "@aseos/platform";
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

  test("allows only registered and bounded unauthenticated CORS preflight", async () => {
    const allowedOrigin = "https://ui.aseos.local";
    await withControlApi(
      async ({ runtime }) => {
        const baseHeaders = {
          host: `${runtime.descriptor.host}:${String(runtime.descriptor.port)}`,
          origin: allowedOrigin,
          "access-control-request-headers": "authorization,idempotency-key,if-match",
        };
        const allowed = await rawHttpRequest(
          runtime,
          "/v1/runtime/stop",
          { ...baseHeaders, "access-control-request-method": "POST" },
          "OPTIONS",
        );
        expect(allowed.status).toBe(204);
        expect(allowed.headers["access-control-allow-origin"]).toBe(allowedOrigin);
        expect(allowed.headers["access-control-allow-headers"]).toContain("if-match");
        expect(allowed.headers["access-control-allow-methods"]).toContain("POST");

        const hostileMethod = await rawHttpRequest(
          runtime,
          "/v1/runtime/stop",
          { ...baseHeaders, "access-control-request-method": "DELETE" },
          "OPTIONS",
        );
        expect(hostileMethod.status).toBe(403);
        expect(JSON.parse(hostileMethod.body).code).toBe("CONTROL_PREFLIGHT_REJECTED");

        const hostileHeader = await rawHttpRequest(
          runtime,
          "/v1/runtime/stop",
          {
            ...baseHeaders,
            "access-control-request-method": "POST",
            "access-control-request-headers": "authorization,x-arbitrary-command",
          },
          "OPTIONS",
        );
        expect(hostileHeader.status).toBe(403);
        expect(JSON.parse(hostileHeader.body).code).toBe("CONTROL_PREFLIGHT_REJECTED");
      },
      { allowedOrigins: [allowedOrigin] },
    );
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

  test.skipIf(process.platform !== "win32")(
    "uses absolute System32 ACL tools when cwd and PATH contain hostile executable names",
    async () => {
      const hostileDirectory = await mkdtemp(join(tmpdir(), "aseos-hostile-system-tools-"));
      const originalCwd = process.cwd();
      const originalPath = process.env.PATH;
      const originalSystemRoot = process.env.SystemRoot;
      try {
        await Promise.all([
          writeFile(join(hostileDirectory, "whoami.exe"), "not a Windows executable", "utf8"),
          writeFile(join(hostileDirectory, "icacls.exe"), "not a Windows executable", "utf8"),
        ]);
        process.chdir(hostileDirectory);
        process.env.PATH = hostileDirectory;
        process.env.SystemRoot = hostileDirectory;
        await withControlApi(async ({ runtime }) => {
          expect(await readBearer(runtime)).toMatch(/^[A-Za-z0-9_-]{43}$/u);
          if (originalSystemRoot === undefined) delete process.env.SystemRoot;
          else process.env.SystemRoot = originalSystemRoot;
          expect((await tokenAclEvidence(runtime.tokenFilePath)).userOnly).toBe(true);
        });
      } finally {
        process.chdir(originalCwd);
        if (originalPath === undefined) delete process.env.PATH;
        else process.env.PATH = originalPath;
        if (originalSystemRoot === undefined) delete process.env.SystemRoot;
        else process.env.SystemRoot = originalSystemRoot;
        await rm(hostileDirectory, { force: true, recursive: true });
      }
    },
  );

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
        code: "CONTROL_DESCRIPTOR_INVALID",
      });

      await writeFile(
        runtime.descriptorPath,
        `${JSON.stringify({ ...runtime.descriptor, instanceId: "0198e0a1-0000-7000-8000-000000000001" }, undefined, 2)}\n`,
        "utf8",
      );
      await expect(createControlApiClient({ dataRoot })).rejects.toMatchObject({
        code: "CONTROL_ENDPOINT_IDENTITY_MISMATCH",
      });
      await writeFile(runtime.descriptorPath, descriptorText, "utf8");
    });
  });

  test("rejects non-canonical descriptor fields before any client request", async () => {
    await withControlApi(async ({ dataRoot, runtime }) => {
      const canonical = runtime.descriptor;
      const malformedDescriptors = [
        { label: "unknown field", value: { ...canonical, unexpected: true } },
        {
          label: "non-UUIDv7 instance identity",
          value: { ...canonical, instanceId: "00000000-0000-4000-8000-000000000000" },
        },
        { label: "PID outside Contract maximum", value: { ...canonical, pid: 2_147_483_648 } },
        { label: "invalid API version", value: { ...canonical, apiVersions: ["v0"] } },
        {
          label: "duplicate API version",
          value: { ...canonical, apiVersions: ["v1", "v1"] },
        },
        {
          label: "non-SemVer framework version",
          value: { ...canonical, frameworkVersion: "latest" },
        },
        {
          label: "date-only startup time",
          value: { ...canonical, startedAt: "2026-08-31" },
        },
        {
          label: "normalized invalid calendar date",
          value: { ...canonical, startedAt: "2026-02-31T00:00:00.000Z" },
        },
        { label: "empty release identity", value: { ...canonical, releaseId: "" } },
        {
          label: "absolute token reference",
          value: { ...canonical, tokenFileRef: runtime.tokenFilePath },
        },
        {
          label: "traversing token reference",
          value: { ...canonical, tokenFileRef: "../control-api.token" },
        },
        {
          label: "non-canonical path separator",
          value: { ...canonical, tokenFileRef: "secrets\\runtime\\control-api.token" },
        },
      ];

      for (const malformed of malformedDescriptors) {
        await writeFile(
          runtime.descriptorPath,
          `${JSON.stringify(malformed.value, undefined, 2)}\n`,
          "utf8",
        );
        await expect(
          createControlApiClient({ dataRoot }),
          `descriptor mutation must fail closed: ${malformed.label}`,
        ).rejects.toMatchObject({ code: "CONTROL_DESCRIPTOR_INVALID" });
      }
      await writeFile(
        runtime.descriptorPath,
        `${JSON.stringify({ ...canonical, apiVersions: ["v1", "v2"] }, undefined, 2)}\n`,
        "utf8",
      );
      await expect(createControlApiClient({ dataRoot })).resolves.toMatchObject({
        descriptor: { ...canonical, apiVersions: ["v1", "v2"] },
      });

      await writeFile(
        runtime.descriptorPath,
        `${JSON.stringify({ ...canonical, apiVersions: ["v2"] }, undefined, 2)}\n`,
        "utf8",
      );
      await expect(createControlApiClient({ dataRoot })).rejects.toMatchObject({
        code: "CONTROL_API_VERSION_UNSUPPORTED",
      });
      await writeFile(
        runtime.descriptorPath,
        `${JSON.stringify(canonical, undefined, 2)}\n`,
        "utf8",
      );
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

        const shortIdempotencyKey = await authenticatedFetch(runtime, "/v1/runtime/stop", {
          method: "POST",
          headers: {
            "idempotency-key": "short",
            "if-match": `"${runtime.descriptor.instanceId}"`,
          },
        });
        expect(shortIdempotencyKey.status).toBe(400);
        expect((await shortIdempotencyKey.json()).code).toBe("CONTROL_IDEMPOTENCY_KEY_REQUIRED");

        const legalIdempotencyKey = await authenticatedFetch(runtime, "/v1/runtime/stop", {
          method: "POST",
          headers: {
            "idempotency-key": "qualification+stop/key:01",
            "if-match": '"wrong-instance"',
          },
        });
        expect(legalIdempotencyKey.status).toBe(412);
        expect((await legalIdempotencyKey.json()).code).toBe("CONTROL_INSTANCE_VERSION_MISMATCH");

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

  test("enforces the configured response byte limit without emitting a non-canonical fallback", async () => {
    await withControlApi(
      async ({ runtime }) => {
        const response = await authenticatedFetch(runtime, "/v1/health");
        const body = await response.arrayBuffer();
        expect(response.status).toBe(500);
        expect(Number(response.headers.get("content-length"))).toBe(0);
        expect(response.headers.get("connection")).toBe("close");
        expect(body.byteLength).toBe(0);
      },
      { limits: { maxResponseBytes: 1 } },
    );
  });

  test("bounds authentication failures and idempotency state with replay and conflict semantics", async () => {
    await withControlApi(
      async ({ dataRoot, runtime }) => {
        const client = await createControlApiClient({ dataRoot });
        const invalidToken = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        const headers = {
          authorization: `Bearer ${invalidToken}`,
          host: `${runtime.descriptor.host}:${String(runtime.descriptor.port)}`,
        };
        expect((await fetch(endpointUrl(runtime, "/v1/health"), { headers })).status).toBe(401);
        const limited = await fetch(endpointUrl(runtime, "/v1/health"), { headers });
        expect(limited.status).toBe(429);
        expect(limited.headers.get("retry-after")).not.toBeNull();
        expect((await fetch(endpointUrl(runtime, "/v1/health"), { headers })).status).toBe(429);

        const doctor = await client.doctor();
        expect(doctor.status).toBe("FINDINGS");
        expect(doctor.findings).toHaveLength(1);
        expect(doctor.findings[0]).toMatchObject({
          schemaVersion: "1.0.0",
          code: "CONTROL_AUTH_FAILURE_RATE_LIMITED",
          severity: "WARNING",
          subjectRef: { subjectType: "Runtime", subjectId: runtime.descriptor.instanceId },
          evidenceRefs: [],
        });
        expect(doctor.findings[0].findingId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
        );
        expect(Number.isFinite(Date.parse(doctor.findings[0].detectedAt))).toBe(true);
        expect(doctor.findings[0].remediation).not.toContain(invalidToken);
        expect((await client.status()).limits.authenticationRateLimit.capacity).toBe(1);

        await new Promise((resolvePromise) => setTimeout(resolvePromise, 125));
        await expect(client.doctor()).resolves.toMatchObject({ status: "PASS", findings: [] });
      },
      { limits: { authFailureCapacity: 1, authFailureWindowMs: 75 } },
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

  test("rejects notification kinds outside the read-only public metadata enum", async () => {
    await withControlApi(async ({ runtime }) => {
      expect(() =>
        runtime.publishNotification({
          kind: "AUTHORITATIVE_COMMAND",
          subjectRef: { subjectType: "Runtime", subjectId: runtime.descriptor.instanceId },
          projectionVersion: 1,
          resourceUri: "/v1/status",
        }),
      ).toThrowError(expect.objectContaining({ code: "CONTROL_NOTIFICATION_INVALID" }));
      expect(() =>
        runtime.publishNotification({
          kind: "RUNTIME_STATUS",
          subjectRef: { subjectType: "R", subjectId: runtime.descriptor.instanceId },
          projectionVersion: 1,
          resourceUri: "/v1/status",
        }),
      ).toThrowError(expect.objectContaining({ code: "CONTROL_NOTIFICATION_INVALID" }));
    });
  });

  test("ControlApiError never retains raw causes or sensitive absolute paths", () => {
    const secret = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const sensitivePath = "C:\\Users\\operator\\secrets\\control-api.token";
    const error = new ControlApiError(
      "CONTROL_QUALIFICATION_FAILURE",
      `failed at ${sensitivePath} using Bearer ${secret}`,
      { cause: new Error(`raw cause ${sensitivePath} ${secret}`) },
    );
    expect(error.code).toBe("CONTROL_QUALIFICATION_FAILURE");
    expect(error.message).not.toContain(secret);
    expect(error.message).not.toContain(sensitivePath);
    expect(error.cause).toBeUndefined();
  });

  test("closes replay streams when retained metadata exceeds the backpressure budget", async () => {
    await withControlApi(
      async ({ runtime }) => {
        const first = runtime.publishNotification({
          kind: "EVIDENCE_METADATA",
          subjectRef: { subjectType: "Evidence", subjectId: "replay-budget-first" },
          projectionVersion: 1,
          resourceUri: "/v1/evidence/replay-budget-first",
        });
        runtime.publishNotification({
          kind: "EVIDENCE_METADATA",
          subjectRef: { subjectType: "Evidence", subjectId: "replay-budget-second" },
          projectionVersion: 2,
          resourceUri: "/v1/evidence/replay-budget-second",
        });
        const replay = await authenticatedFetch(runtime, "/v1/events", {
          headers: { "last-event-id": first.notificationId },
        });
        expect(replay.status).toBe(200);
        expect(await replay.text()).toBe("");
      },
      { limits: { sseMaxBufferedBytes: 1 } },
    );
  });

  test("bounds retention-gap and heartbeat SSE frames with the same byte budget", async () => {
    await withControlApi(
      async ({ runtime }) => {
        const gap = await authenticatedFetch(runtime, "/v1/events", {
          headers: { "last-event-id": "unknown-notification" },
        });
        expect(gap.status).toBe(200);
        expect(await gap.text()).toBe("");
      },
      { limits: { sseMaxBufferedBytes: 1 } },
    );

    await withControlApi(
      async ({ runtime }) => {
        const heartbeat = await authenticatedFetch(runtime, "/v1/events");
        expect(heartbeat.status).toBe(200);
        expect(await heartbeat.text()).toBe("");
      },
      { limits: { sseHeartbeatMs: 1, sseMaxBufferedBytes: 1 } },
    );
  });

  test("keeps an established SSE stream beyond the ordinary request timeout", async () => {
    await withControlApi(
      async ({ runtime }) => {
        const controller = new AbortController();
        const stream = await authenticatedFetch(runtime, "/v1/events", {
          signal: controller.signal,
        });
        expect(stream.status).toBe(200);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 75));
        const notification = runtime.publishNotification({
          kind: "RUNTIME_STATUS",
          subjectRef: { subjectType: "Runtime", subjectId: runtime.descriptor.instanceId },
          projectionVersion: 2,
          resourceUri: "/v1/status",
        });
        expect(await readSseRecord(stream)).toMatchObject({
          id: notification.notificationId,
          event: "RUNTIME_STATUS",
        });
        controller.abort();
      },
      { limits: { requestTimeoutMs: 20, sseHeartbeatMs: 1_000 } },
    );
  });
});
