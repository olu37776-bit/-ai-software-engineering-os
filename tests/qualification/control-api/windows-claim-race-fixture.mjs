import assert from "node:assert/strict";
import { promises as filesystem } from "node:fs";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { acquireRuntimeLock, controlPaths } from "../../../packages/platform/dist/filesystem.js";

const [mode, code] = process.argv.slice(2);
assert.ok(["transient", "persistent"].includes(mode));
assert.ok(["EPERM", "EACCES", "EBUSY"].includes(code));
const nativePlatform = process.platform;
const root = await mkdtemp(join(tmpdir(), "aseos-claim-delete-pending-"));
const directory = `${controlPaths(root).lockFilePath}.claims`;
const otherName = `${process.pid}-${"f".repeat(32)}`;
const otherClaim = join(directory, otherName);
const otherTicket = join(otherClaim, "ticket.json");
await mkdir(otherClaim, { recursive: true });
await writeFile(otherTicket, "1\n");
let injected = 0;
let release;
const originalRead = filesystem.readFile;
// This isolated fault case models Windows delete-pending errors on any runner.
// Real Windows qualification still runs the unchanged native competition tests.
Object.defineProperty(process, "platform", { value: "win32" });
filesystem.readFile = (path, ...options) => {
  if (path !== otherTicket) return originalRead(path, ...options);
  injected += 1;
  const failure = Object.assign(new Error("Injected claim handle is delete-pending"), { code });
  if (mode === "persistent") return Promise.reject(failure);
  return rm(otherClaim, { recursive: true, force: true }).then(() => Promise.reject(failure));
};
syncBuiltinESMExports();
try {
  if (mode === "transient") {
    release = await acquireRuntimeLock(root, "owner-after-departing-claim");
    assert.equal(injected, 1);
    assert.equal((await readdir(directory)).length, 1);
    await assert.rejects(acquireRuntimeLock(root, "second-owner"), {
      code: "CONTROL_RUNTIME_ALREADY_ACTIVE",
    });
    await release();
    release = undefined;
    assert.deepEqual(await readdir(directory), []);
  } else {
    await assert.rejects(acquireRuntimeLock(root, "cannot-ignore-live-claim"), {
      code: "CONTROL_RUNTIME_LOCK_FAILED",
    });
    assert.ok(injected > 0);
    assert.deepEqual(await readdir(directory), [otherName]);
    await assert.rejects(originalRead(controlPaths(root).lockFilePath), { code: "ENOENT" });
  }
  console.log(JSON.stringify({ result: "PASS", mode, code, injected, nativePlatform }));
} finally {
  filesystem.readFile = originalRead;
  syncBuiltinESMExports();
  Object.defineProperty(process, "platform", { value: nativePlatform });
  if (release !== undefined) await release();
  await rm(root, { recursive: true, force: true });
}
