#!/usr/bin/env node
import { CLI_COMMANDS, runCli, type CliCommand } from "./index.js";

function readOption(arguments_: readonly string[], name: string): string | undefined {
  const index = arguments_.indexOf(name);
  return index === -1 ? undefined : arguments_[index + 1];
}

function parseCommand(value: string | undefined): CliCommand {
  if (value !== undefined && (CLI_COMMANDS as readonly string[]).includes(value)) {
    return value as CliCommand;
  }
  throw new Error(`CLI_COMMAND_REQUIRED:${CLI_COMMANDS.join(",")}`);
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  const command = parseCommand(arguments_[0]);
  const dataRoot = readOption(arguments_, "--data-root");
  if (dataRoot === undefined || dataRoot.length === 0) throw new Error("CLI_DATA_ROOT_REQUIRED");
  const frameworkVersion = readOption(arguments_, "--framework-version");
  const releaseId = readOption(arguments_, "--release-id");
  const runtimeEntry = readOption(arguments_, "--runtime-entry");
  const result = await runCli({
    command,
    dataRoot,
    ...(frameworkVersion === undefined ? {} : { frameworkVersion }),
    ...(releaseId === undefined ? {} : { releaseId }),
    ...(runtimeEntry === undefined ? {} : { runtimeEntry }),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "CLI_FAILED";
  process.stderr.write(`${JSON.stringify({ code: "CLI_FAILED", message })}\n`);
  process.exitCode = 1;
});
