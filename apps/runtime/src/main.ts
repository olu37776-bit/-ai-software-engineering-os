#!/usr/bin/env node
import { startRuntime } from "./index.js";

interface RuntimeArguments {
  readonly dataRoot: string;
  readonly frameworkVersion: string;
  readonly releaseId: string;
}

function readOption(arguments_: readonly string[], name: string): string | undefined {
  const index = arguments_.indexOf(name);
  return index === -1 ? undefined : arguments_[index + 1];
}

function parseArguments(arguments_: readonly string[]): RuntimeArguments {
  const dataRoot = readOption(arguments_, "--data-root");
  if (dataRoot === undefined || dataRoot.length === 0) {
    throw new Error("RUNTIME_DATA_ROOT_REQUIRED");
  }
  return Object.freeze({
    dataRoot,
    frameworkVersion: readOption(arguments_, "--framework-version") ?? "0.1.0",
    releaseId: readOption(arguments_, "--release-id") ?? "local-qualification",
  });
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const runtime = await startRuntime(options);
  const stopOnSignal = (): void => {
    void runtime.stop();
  };
  process.once("SIGINT", stopOnSignal);
  process.once("SIGTERM", stopOnSignal);
  process.stdout.write(
    `${JSON.stringify({
      event: "ASEOS_RUNTIME_READY",
      descriptor: runtime.controlApi.descriptor,
    })}\n`,
  );
  await runtime.stopped;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "RUNTIME_START_FAILED";
  process.stderr.write(`${JSON.stringify({ code: "RUNTIME_START_FAILED", message })}\n`);
  process.exitCode = 1;
});
