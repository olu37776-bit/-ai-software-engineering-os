import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { expect, test } from "vitest";

import { NETWORK_GUARD_SOURCE } from "../../../scripts/release/qualify-windows-x64.mjs";

const execFileAsync = promisify(execFile);

test("the actual offline preload rejects loopback-looking DNS and malformed IPs before networking", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aseos-network-guard-"));
  const guardPath = join(directory, "guard.mjs");
  const probePath = join(directory, "probe.mjs");
  const logPath = join(directory, "network.jsonl");
  try {
    await writeFile(guardPath, NETWORK_GUARD_SOURCE);
    await writeFile(
      probePath,
      `
      import assert from "node:assert/strict";
      import net from "node:net";
      import dns from "node:dns";
      let reached = 0;
      const original = () => { reached += 1; throw Object.assign(new Error("stub"), {code: "ORIGINAL_REACHED"}); };
      net.connect = original;
      dns.lookup = original;
      await import(${JSON.stringify(pathToFileURL(guardPath).href)});
      const blocked = ["127.example.invalid", "127.0.0.1.example.invalid", "127.0.0.999", "127.000.0.1", "::ffff:127.example.invalid", "0.0.0.0", "192.0.2.1", "2001:db8::1"];
      for (const host of blocked) {
        assert.throws(() => net.connect({host, port: 1}), {code: "ASEOS_NON_LOOPBACK_NETWORK_BLOCKED"});
        assert.throws(() => dns.lookup(host, () => {}), {code: "ASEOS_NON_LOOPBACK_NETWORK_BLOCKED"});
      }
      assert.equal(reached, 0);
      const allowed = ["127.0.0.1", "127.255.255.255", "::1", "0:0:0:0:0:0:0:1", "::ffff:127.0.0.1", "::ffff:7f00:1"];
      for (const host of allowed) assert.throws(() => net.connect({host, port: 1}), {code: "ORIGINAL_REACHED"});
      assert.equal(reached, allowed.length);
      process.stdout.write(JSON.stringify({blocked: blocked.length * 2, allowed: allowed.length}));
    `,
    );
    const { stdout } = await execFileAsync(process.execPath, [probePath], {
      env: { ...process.env, ASEOS_NETWORK_GUARD_LOG: logPath },
    });
    expect(JSON.parse(stdout)).toEqual({ blocked: 16, allowed: 6 });
    const entries = (await readFile(logPath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(entries.filter((entry) => entry.decision === "BLOCK_NON_LOOPBACK")).toHaveLength(16);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
