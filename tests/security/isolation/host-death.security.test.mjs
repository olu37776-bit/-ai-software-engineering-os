import { execFile, fork } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import { expect, test } from "vitest";

import { compileProcessFixture, removeProcessFixture, waitForProcessExit } from "./helpers.mjs";

const execFileAsync = promisify(execFile);

function killFixtureProcess(pid) {
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

test.skipIf(process.platform !== "win32")(
  "killing only the Node host terminates its bridge and every tool descendant",
  async () => {
    const fixture = await compileProcessFixture();
    const marker = join(fixture.outputRoot, "live-tree.json");
    const host = fork(new URL("./host-death-fixture.mjs", import.meta.url), [], {
      stdio: ["ignore", "ignore", "inherit", "ipc"],
      windowsHide: true,
    });
    const knownPids = [];
    let unexpected;
    try {
      expect((await once(host, "message"))[0]).toEqual({ ready: true });
      host.on("message", (message) => {
        unexpected = message;
      });
      host.send({
        fixture,
        stagingRoot: join(fixture.outputRoot, "host death staging 根"),
        marker,
      });
      let tree;
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        if (unexpected !== undefined) throw new Error(JSON.stringify(unexpected));
        try {
          tree = JSON.parse((await readFile(marker, "utf8")).replace(/^\uFEFF/u, ""));
          break;
        } catch (error) {
          if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
        }
        await delay(25);
      }
      expect(tree).toBeDefined();
      knownPids.push(tree.root, tree.child, tree.grandchild);
      const systemDirectory = join(process.env.SystemRoot ?? "C:\\Windows", "System32");
      const { stdout } = await execFileAsync(
        join(systemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe"),
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter 'ParentProcessId = ${host.pid}').ProcessId`,
        ],
        { windowsHide: true },
      );
      const bridges = stdout.trim().split(/\s+/u).map(Number);
      expect(bridges).toHaveLength(1);
      expect(bridges[0]).toBeGreaterThan(0);
      knownPids.push(...bridges);
      for (const pid of knownPids) expect(await waitForProcessExit(pid, 1)).toBe(false);
      const hostExited = once(host, "exit");
      // No /T: killing descendants here would invalidate the lifecycle test.
      await execFileAsync(join(systemDirectory, "taskkill.exe"), ["/PID", String(host.pid), "/F"]);
      await hostExited;
      expect(await Promise.all(knownPids.map((pid) => waitForProcessExit(pid, 5_000)))).toEqual([
        true,
        true,
        true,
        true,
      ]);
    } finally {
      if (host.exitCode === null && host.signalCode === null) {
        const exited = once(host, "exit");
        host.kill("SIGKILL");
        await exited;
      }
      // Failure cleanup happens only after the observations, for exact fixture PIDs.
      for (const pid of knownPids) killFixtureProcess(pid);
      await removeProcessFixture(fixture);
    }
  },
  150_000,
);
