/* global fetch */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { createControlApiClient, verifyControlPathUserOnly } from "@aseos/platform";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const dataRoot = await mkdtemp(join(tmpdir(), "aseos-p1-v07-qualification-"));
const cliEntry = join(repositoryRoot, "apps", "cli", "dist", "main.js");
const runtimeEntry = join(repositoryRoot, "apps", "runtime", "dist", "main.js");
const openApiPath = join(
  repositoryRoot,
  "packages",
  "contracts",
  "schemas",
  "control-api",
  "control-api.openapi.json",
);

async function invokeCli(command, extra = []) {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [cliEntry, command, "--data-root", dataRoot, ...extra],
    { cwd: repositoryRoot, windowsHide: true, timeout: 10_000, maxBuffer: 128 * 1024 },
  );
  if (stderr !== "") throw new Error(`CLI_STDERR_NOT_EMPTY:${stderr}`);
  return JSON.parse(stdout);
}

let client;

try {
  const cliStart = await invokeCli("start", [
    "--runtime-entry",
    runtimeEntry,
    "--framework-version",
    "0.1.0",
    "--release-id",
    "p1-v07-qualification",
  ]);
  const openapi = JSON.parse(await readFile(openApiPath, "utf8"));
  client = await createControlApiClient({ dataRoot });
  const [version, health, status, doctor] = await Promise.all([
    client.version(),
    client.health(),
    client.status(),
    client.doctor(),
  ]);
  const tokenFilePath = resolve(dataRoot, client.descriptor.tokenFileRef);
  const token = (await readFile(tokenFilePath, "utf8")).trim();
  await verifyControlPathUserOnly(tokenFilePath);
  const rejected = await fetch(`http://127.0.0.1:${String(client.descriptor.port)}/v1/health`, {
    headers: {
      authorization: `Bearer ${token.slice(0, -1)}x`,
      host: `127.0.0.1:${String(client.descriptor.port)}`,
    },
  });
  const rejectedText = await rejected.text();
  const cli = {
    start: cliStart,
    version: await invokeCli("version"),
    doctor: await invokeCli("doctor"),
    status: await invokeCli("status"),
    stop: await invokeCli("stop"),
  };

  const requiredPaths = [
    "/version",
    "/health",
    "/endpoint",
    "/status",
    "/doctor",
    "/events",
    "/runtime/stop",
  ];
  const openApiPass =
    openapi.openapi === "3.1.1" &&
    requiredPaths.every((path) => openapi.paths[path] !== undefined) &&
    openapi.security?.[0]?.bearerAuth !== undefined;
  const results = [
    {
      evidenceType: "OpenApiValidationResult",
      result: openApiPass ? "PASS" : "FAIL",
      version: openapi.openapi,
      requiredPaths,
    },
    {
      evidenceType: "LoopbackExposureResult",
      result: client.descriptor.host === "127.0.0.1" ? "PASS" : "FAIL",
      host: client.descriptor.host,
      portClass: "OS_ASSIGNED_EPHEMERAL",
    },
    {
      evidenceType: "TokenAclRedactionResult",
      result: token.length === 43 && !rejectedText.includes(token) ? "PASS" : "FAIL",
      tokenBits: 256,
      acl:
        process.platform === "win32"
          ? "CURRENT_USER_PLUS_TRUSTED_OS_SESSION_PRINCIPALS_NO_INHERITANCE"
          : "0600",
      publicErrorRedacted: !rejectedText.includes(token),
    },
    {
      evidenceType: "CliPublicApiAcceptanceResult",
      result:
        version.apiVersion === "v1" &&
        health.readiness === "READY" &&
        status.status === "READY" &&
        doctor.status === "PASS" &&
        Object.values(cli).every((entry) => entry.ok === true)
          ? "PASS"
          : "FAIL",
      commands: ["start", "version", "doctor", "status", "stop"],
      clientBoundary: "@aseos/platform public Control API client",
    },
  ];
  if (results.some((result) => result.result !== "PASS")) {
    throw new Error(`P1_V07_QUALIFICATION_FAILED:${JSON.stringify(results)}`);
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        qualification: "P1-V07-CONTROL-API",
        result: "PASS",
        platform: process.platform,
        results,
      },
      undefined,
      2,
    )}\n`,
  );
} finally {
  try {
    if (client !== undefined) {
      await client.stop({ idempotencyKey: "qualification-cleanup-stop" });
    }
  } catch {
    // The successful acceptance path already stopped and removed discovery.
  }
  await rm(dataRoot, { force: true, recursive: true });
}
