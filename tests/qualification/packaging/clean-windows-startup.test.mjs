import assert from "node:assert/strict";

import {
  expectManifestFailure,
  qualifyWindowsArtifact,
  sanitizedWindowsEnvironment,
  selectRuntimeAuditPids,
  waitForRuntimeShutdown,
} from "../../../scripts/release/qualify-windows-x64.mjs";

const { test } = process.env.VITEST === "true" ? await import("vitest") : await import("node:test");

test("P1-V09 removes development toolchain discovery from the runtime environment", () => {
  const environment = sanitizedWindowsEnvironment({
    SystemRoot: "C:\\Windows",
    TEMP: "C:\\Temp",
    PATH: "C:\\host-node;C:\\pnpm;C:\\compiler",
    NODE_PATH: "C:\\host-modules",
    PNPM_HOME: "C:\\pnpm",
    npm_config_userconfig: "C:\\host.npmrc",
    SECRET_NOT_IN_ALLOWLIST: "must-not-cross-boundary",
  });

  assert.equal(environment.PATH, "");
  assert.equal(environment.Path, "");
  assert.equal(environment.PATHEXT, "");
  assert.equal(environment.NODE_PATH, "");
  assert.equal(environment.PNPM_HOME, "");
  assert.equal(environment.npm_config_userconfig, undefined);
  assert.equal(environment.SystemRoot, "C:\\Windows");
  assert.equal(environment.SECRET_NOT_IN_ALLOWLIST, undefined);
});

test("P1-V09 refuses to report an expected code when verification failed differently", async () => {
  const wrongCode = new Error("payload size changed");
  wrongCode.code = "RELEASE_PAYLOAD_SIZE_MISMATCH";

  await assert.rejects(
    expectManifestFailure(Object.freeze({}), "RELEASE_PAYLOAD_HASH_MISMATCH", async () =>
      Promise.reject(wrongCode),
    ),
    /QUALIFICATION_REJECTION_CODE_MISMATCH:RELEASE_PAYLOAD_HASH_MISMATCH:RELEASE_PAYLOAD_SIZE_MISMATCH/u,
  );
});

test("P1-V09 requires process exit and both discovery files to disappear", async () => {
  const snapshots = [
    { processRunning: true, descriptorPresent: true, tokenPresent: true },
    { processRunning: false, descriptorPresent: false, tokenPresent: true },
    { processRunning: false, descriptorPresent: false, tokenPresent: false },
  ];
  let probeCount = 0;
  const result = await waitForRuntimeShutdown({
    pid: 42,
    descriptorPath: "descriptor",
    tokenFilePath: "token",
    timeoutMs: 1_000,
    probe: async () => snapshots[Math.min(probeCount++, snapshots.length - 1)],
  });
  assert.deepEqual(result, {
    processExited: true,
    discoveryRemoved: true,
    tokenRemoved: true,
  });
  assert.equal(probeCount, 3);

  await assert.rejects(
    waitForRuntimeShutdown({
      pid: 42,
      descriptorPath: "descriptor",
      tokenFilePath: "token",
      timeoutMs: 1,
      probe: async () => ({
        processRunning: false,
        descriptorPresent: false,
        tokenPresent: true,
      }),
    }),
    /^Error: QUALIFICATION_SHUTDOWN_TIMEOUT:false:false:true$/u,
  );
});

test("P1-V09 cleanup accepts only the exact packaged runtime entrypoint from audit logs", () => {
  const runtimeEntry = "D:\\artifact\\app\\apps\\runtime\\dist\\main.js";
  const events = [
    { pid: 7101, kind: "guard", decision: "INSTALLED", entrypoint: runtimeEntry },
    { pid: 7101, kind: "guard", decision: "INSTALLED", entrypoint: runtimeEntry },
    {
      pid: 7102,
      kind: "guard",
      decision: "INSTALLED",
      entrypoint: "D:\\artifact\\app\\apps\\cli\\dist\\main.js",
    },
    {
      pid: 7103,
      kind: "guard",
      decision: "INSTALLED",
      entrypoint: "D:\\unrelated\\arbitrary.js",
    },
    { pid: 7104, kind: "fetch", decision: "ALLOW_LOOPBACK", entrypoint: runtimeEntry },
    { pid: process.pid, kind: "guard", decision: "INSTALLED", entrypoint: runtimeEntry },
  ];

  assert.deepEqual(selectRuntimeAuditPids(events, runtimeEntry), [7101]);
});

test(
  "P1-V09 starts the immutable artifact from Unicode and space-separated release/data roots",
  { skip: process.platform !== "win32" || process.env.ASEOS_QUALIFICATION_ARTIFACT === undefined },
  async () => {
    const required = (name) => {
      const value = process.env[name];
      assert.ok(value, `${name} is required for Windows artifact qualification`);
      return value;
    };
    const artifactRoot = required("ASEOS_QUALIFICATION_ARTIFACT");
    const evidence = await qualifyWindowsArtifact({
      artifactRoot,
      manifestPath: `${artifactRoot}\\release-manifest.json`,
      expectedVersion: required("ASEOS_QUALIFICATION_EXPECTED_VERSION"),
      expectedGitCommit: required("ASEOS_QUALIFICATION_EXPECTED_GIT_COMMIT"),
      toolchainPath: required("ASEOS_QUALIFICATION_TOOLCHAIN"),
      evidenceOutput: required("ASEOS_QUALIFICATION_EVIDENCE"),
    });

    assert.equal(evidence.verificationStepId, "P1-V09-PACKAGING");
    assert.deepEqual(
      evidence.results.map((result) => [result.evidenceType, result.result]),
      [
        ["SelfContainedArtifactResult", "PASS"],
        ["ReleaseManifestConsistencyResult", "PASS"],
        ["CleanWindowsStartupResult", "PASS"],
      ],
    );
    const consistency = evidence.results[1];
    const startup = evidence.results[2];
    const selfContained = evidence.results[0];
    assert.equal(selfContained.offlineStartup, true);
    assert.equal(selfContained.negativeNonLoopbackProbeBlocked, true);
    assert.equal(selfContained.observedNonLoopbackOutboundAttempts, 0);
    assert.ok(selfContained.observedLoopbackOperations > 0);
    assert.equal(selfContained.runtimeGuardInstalled, true);
    assert.equal(consistency.tamperRejected, true);
    assert.equal(consistency.verifiedManifestSha256Before, consistency.verifiedManifestSha256After);
    assert.equal(consistency.manifestSha256, consistency.verifiedManifestSha256Before);
    assert.equal(startup.commandResults.tamper.expectedCode, "RELEASE_PAYLOAD_HASH_MISMATCH");
    assert.match(startup.commandResults.tamper.message, /^RELEASE_PAYLOAD_HASH_MISMATCH:/u);
    assert.equal(startup.commandResults.missing.expectedCode, "RELEASE_PAYLOAD_MISSING");
    assert.match(startup.commandResults.missing.message, /^RELEASE_PAYLOAD_MISSING:/u);
    assert.equal(startup.processExited, true);
    assert.equal(startup.discoveryRemoved, true);
    assert.equal(startup.tokenRemoved, true);
  },
);
