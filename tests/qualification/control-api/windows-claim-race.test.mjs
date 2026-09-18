import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

const fixture = fileURLToPath(new URL("./windows-claim-race-fixture.mjs", import.meta.url));

test.each(["EPERM", "EACCES", "EBUSY"])(
  "a departing Windows claim reporting %s does not prevent an uncontested owner",
  (code) => {
    const result = spawnSync(process.execPath, [fixture, "transient", code], {
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ result: "PASS", code, injected: 1 });
  },
);

test("a persistently unreadable live claim remains fail closed and is never removed", () => {
  const result = spawnSync(process.execPath, [fixture, "persistent", "EPERM"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ result: "PASS", mode: "persistent" });
});
