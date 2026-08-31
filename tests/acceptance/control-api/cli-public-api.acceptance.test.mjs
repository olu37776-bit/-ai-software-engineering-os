/* global setTimeout */
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const cliEntry = join(repositoryRoot, "apps", "cli", "dist", "main.js");
const runtimeEntry = join(repositoryRoot, "apps", "runtime", "dist", "main.js");

async function cli(dataRoot, command, extra = []) {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [cliEntry, command, "--data-root", dataRoot, ...extra],
    {
      cwd: repositoryRoot,
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 128 * 1024,
    },
  );
  expect(stderr).toBe("");
  return JSON.parse(stdout);
}

async function waitUntilMissing(path, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await access(path);
    } catch {
      return;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error(`PATH_STILL_EXISTS:${path}`);
}

describe("P1-V07 CLI public-client actual acceptance", () => {
  test("runs start, version, doctor, status and stop through the built entrypoints", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "ASEOS P1 中文 V07 "));
    const descriptorPath = join(dataRoot, "state", "runtime", "control-endpoint.json");
    try {
      const start = await cli(dataRoot, "start", [
        "--runtime-entry",
        runtimeEntry,
        "--framework-version",
        "0.1.0",
        "--release-id",
        "p1-v07-cli-acceptance",
      ]);
      expect(start).toMatchObject({ command: "start", ok: true });
      expect(start.value.outcome).toBe("STARTED");
      expect(start.value.descriptor).toMatchObject({ host: "127.0.0.1" });
      expect(start.value.descriptor).not.toHaveProperty("token");

      const version = await cli(dataRoot, "version");
      expect(version).toMatchObject({
        command: "version",
        ok: true,
        value: { frameworkVersion: "0.1.0", releaseId: "p1-v07-cli-acceptance" },
      });
      const doctor = await cli(dataRoot, "doctor");
      expect(doctor).toMatchObject({ command: "doctor", ok: true, value: { status: "PASS" } });
      const status = await cli(dataRoot, "status");
      expect(status).toMatchObject({ command: "status", ok: true, value: { status: "READY" } });

      const stop = await cli(dataRoot, "stop");
      expect(stop).toMatchObject({
        command: "stop",
        ok: true,
        value: { type: "RuntimeStop", status: "ACCEPTED" },
      });
      await waitUntilMissing(descriptorPath);
    } finally {
      try {
        await cli(dataRoot, "stop");
      } catch {
        // The expected path after the stop acceptance is no discoverable runtime.
      }
      await rm(dataRoot, { force: true, recursive: true });
    }
  }, 30_000);

  test("CLI composition has no database, Kernel or persistence dependency", async () => {
    const manifest = JSON.parse(
      await readFile(join(repositoryRoot, "apps", "cli", "package.json"), "utf8"),
    );
    expect(manifest.dependencies).toEqual({ "@aseos/platform": "workspace:*" });
    const source = `${await readFile(join(repositoryRoot, "apps", "cli", "src", "index.ts"), "utf8")}\n${await readFile(join(repositoryRoot, "apps", "cli", "src", "main.ts"), "utf8")}`;
    expect(source).not.toMatch(/@aseos\/(?:kernel|persistence)|node:sqlite|\.db\b|sqlite/iu);
    expect(source).toContain('from "@aseos/platform"');
  });
});
