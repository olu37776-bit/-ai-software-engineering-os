import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { ControlApiError, createControlApiClient, type ControlApiClient } from "@aseos/platform";

export const CLI_COMMANDS: readonly ["start", "version", "doctor", "status", "stop"] =
  Object.freeze(["start", "version", "doctor", "status", "stop"]);

export type CliCommand = (typeof CLI_COMMANDS)[number];

export interface CliOptions {
  readonly command: CliCommand;
  readonly dataRoot: string;
  readonly frameworkVersion?: string;
  readonly releaseId?: string;
  readonly runtimeEntry?: string;
  readonly startupTimeoutMs?: number;
}

export interface CliResult {
  readonly command: CliCommand;
  readonly ok: true;
  readonly value: unknown;
}

const startupPollIntervalMs = 50;

function defaultRuntimeEntry(): string {
  return fileURLToPath(new URL("../../runtime/dist/main.js", import.meta.url));
}

async function connect(dataRoot: string): Promise<ControlApiClient> {
  return createControlApiClient({ dataRoot });
}

async function waitForClient(dataRoot: string, timeoutMs: number): Promise<ControlApiClient> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const client = await connect(dataRoot);
      await client.health();
      return client;
    } catch (error: unknown) {
      lastError = error;
      await new Promise<void>((resolve) => setTimeout(resolve, startupPollIntervalMs));
    }
  }
  throw new Error("RUNTIME_START_TIMEOUT", { cause: lastError });
}

async function start(options: CliOptions): Promise<unknown> {
  try {
    const existing = await connect(options.dataRoot);
    const health = await existing.health();
    return { outcome: "ALREADY_RUNNING", descriptor: existing.descriptor, health };
  } catch (error: unknown) {
    const recoverableDiscoveryCodes = new Set([
      "CONTROL_DESCRIPTOR_STALE",
      "CONTROL_DESCRIPTOR_UNAVAILABLE",
      "CONTROL_CLIENT_UNAVAILABLE",
    ]);
    if (!(error instanceof ControlApiError) || !recoverableDiscoveryCodes.has(error.code)) {
      throw error;
    }
  }

  const runtimeEntry =
    options.runtimeEntry ?? process.env["ASEOS_RUNTIME_ENTRY"] ?? defaultRuntimeEntry();
  const child = spawn(
    process.execPath,
    [
      runtimeEntry,
      "--data-root",
      options.dataRoot,
      "--framework-version",
      options.frameworkVersion ?? "0.1.0",
      "--release-id",
      options.releaseId ?? "local-qualification",
    ],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    },
  );
  child.unref();
  const client = await waitForClient(options.dataRoot, options.startupTimeoutMs ?? 10_000);
  return { outcome: "STARTED", descriptor: client.descriptor, health: await client.health() };
}

export async function runCli(options: CliOptions): Promise<CliResult> {
  let value: unknown;
  switch (options.command) {
    case "start":
      value = await start(options);
      break;
    case "version":
      value = await (await connect(options.dataRoot)).version();
      break;
    case "doctor":
      value = await (await connect(options.dataRoot)).doctor();
      break;
    case "status":
      value = await (await connect(options.dataRoot)).status();
      break;
    case "stop":
      value = await (
        await connect(options.dataRoot)
      ).stop({
        idempotencyKey: `cli-stop-${randomUUID()}`,
      });
      break;
  }
  return Object.freeze({ command: options.command, ok: true, value });
}
