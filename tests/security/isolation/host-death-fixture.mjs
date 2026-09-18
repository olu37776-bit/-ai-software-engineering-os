import { pathToFileURL } from "node:url";

import { adapterDist, catalogFor, defaultLimits, requestFor } from "./helpers.mjs";

const adapter = await import(pathToFileURL(adapterDist).href);
process.once("message", async ({ fixture, stagingRoot, marker }) => {
  try {
    const capability = await adapter.probeWindowsProcessRestrictedCapability();
    if (capability.result !== "AVAILABLE") throw new Error(JSON.stringify(capability));
    const result = await adapter.runWindowsProcessRestricted(
      requestFor(stagingRoot, {
        argv: ["tree-root-host", marker],
        limits: defaultLimits({ maxWallClockMs: 120_000 }),
      }),
      catalogFor(fixture.executable, fixture.executableSha256),
      capability,
    );
    process.send({ unexpectedCompletion: result });
    process.exitCode = 1;
  } catch (error) {
    process.send({ unexpectedFailure: String(error) });
    process.exitCode = 1;
  }
});
process.send({ ready: true });
