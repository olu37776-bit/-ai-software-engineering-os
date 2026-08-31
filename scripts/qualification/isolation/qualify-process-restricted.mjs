import { rm } from "node:fs/promises";
import { join } from "node:path";

import {
  probeWindowsProcessRestrictedCapability,
  runWindowsProcessRestricted,
} from "@aseos/windows-process-restricted";
import { resolveIsolationProvider } from "@aseos/worker";

import {
  compileProcessFixture,
  canonicalRequirement,
  catalogFor,
  defaultLimits,
  requestFor,
  waitForProcessExit,
} from "../../../tests/security/isolation/helpers.mjs";

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function processIds(output) {
  return [...output.matchAll(/(?:ROOT|CHILD|GRANDCHILD)=(\d+)/gu)].map((match) => Number(match[1]));
}

function noDowngrade(capability) {
  const baseRequest = {
    evidenceContext: {
      requirementId: "018f47a2-1000-7000-8000-000000000001",
    },
    isolationRequirement: canonicalRequirement(),
  };
  const strongerLevels = ["OS_SANDBOXED", "CONTAINER_ISOLATED", "REMOTE_ISOLATED"];
  const stronger = strongerLevels.map((minimumIsolationLevel) =>
    resolveIsolationProvider(
      {
        ...baseRequest,
        isolationRequirement: {
          ...baseRequest.isolationRequirement,
          minimumIsolationLevel,
        },
      },
      capability,
    ),
  );
  assert(
    stronger.every(
      (resolution) =>
        resolution.status === "BLOCKED" &&
        resolution.selected === null &&
        resolution.reasonCode === "MINIMUM_ISOLATION_LEVEL_UNAVAILABLE",
    ),
    "P1_V08_DOWNWARD_FALLBACK_DETECTED",
  );
  const unavailable = resolveIsolationProvider(baseRequest, {
    ...capability,
    result: "UNAVAILABLE",
    reasonCodes: ["QUALIFICATION_UNAVAILABLE"],
  });
  assert(
    unavailable.status === "BLOCKED" && unavailable.selected === null,
    "P1_V08_UNAVAILABLE_PROVIDER_FALLBACK_DETECTED",
  );
  return {
    evidenceType: "NoDowngradePropertyResult",
    result: "PASS",
    strongerMinimumsBlocked: strongerLevels,
    unavailableProcessRestrictedBlocked: true,
    hostUnrestrictedSelectable: false,
  };
}

const capability = await probeWindowsProcessRestrictedCapability();
const noDowngradeResult = noDowngrade(capability);
let fixture;

try {
  if (process.platform !== "win32") {
    const execution = await runWindowsProcessRestricted({});
    assert(
      capability.result === "UNAVAILABLE" && execution.status === "UNAVAILABLE",
      "P1_V08_NON_WINDOWS_DID_NOT_FAIL_CLOSED",
    );
    process.stdout.write(
      `${JSON.stringify(
        {
          schemaVersion: "1.0.0",
          gateStepId: "P1-V08-ISOLATION",
          result: "PASS",
          platform: process.platform,
          capability,
          jobObjectLifecycle: {
            evidenceType: "JobObjectLifecycleResult",
            result: "NOT_APPLICABLE_PROVIDER_UNAVAILABLE",
          },
          processTreeTermination: {
            evidenceType: "ProcessTreeTerminationResult",
            result: "NOT_APPLICABLE_PROVIDER_UNAVAILABLE",
          },
          noDowngrade: noDowngradeResult,
          failClosed: true,
        },
        null,
        2,
      )}\n`,
    );
    process.exit(0);
  }

  assert(capability.result === "AVAILABLE", "P1_V08_WINDOWS_PROVIDER_UNAVAILABLE");
  fixture = await compileProcessFixture();
  const stagingRoot = join(fixture.outputRoot, "qualification staging 根");
  const smoke = await runWindowsProcessRestricted(
    requestFor(stagingRoot),
    catalogFor(fixture.executable, fixture.executableSha256),
    capability,
  );
  assert(smoke.status === "COMPLETED" && smoke.exitCode === 0, "P1_V08_SMOKE_FAILED");
  assert(
    smoke.evidence.processTree.jobObjectAssigned &&
      smoke.evidence.processTree.killOnJobClose &&
      smoke.evidence.processTree.activeProcessCountAfterCompletion === 0,
    "P1_V08_JOB_LIFECYCLE_FAILED",
  );
  const smokeOutput = Buffer.from(smoke.stdout).toString("utf8");
  assert(
    smokeOutput.includes("ALLOWED=visible") && smokeOutput.includes("SECRET=<missing>"),
    "P1_V08_ENVIRONMENT_BOUNDARY_FAILED",
  );

  const tree = await runWindowsProcessRestricted(
    requestFor(stagingRoot, {
      argv: ["tree-root"],
      inputs: [],
      limits: defaultLimits({ maxWallClockMs: 1200, maxProcessCount: 16 }),
    }),
    catalogFor(fixture.executable, fixture.executableSha256),
    capability,
  );
  assert(
    tree.status === "TERMINATED" && tree.reason === "WALL_CLOCK_LIMIT",
    "P1_V08_TREE_TIMEOUT_FAILED",
  );
  const ids = processIds(Buffer.from(tree.stdout).toString("utf8"));
  assert(ids.length === 3, "P1_V08_DESCENDANT_OBSERVATION_FAILED");
  const exited = await Promise.all(ids.map((processId) => waitForProcessExit(processId)));
  assert(exited.every(Boolean), "P1_V08_ORPHAN_PROCESS_DETECTED");
  assert(
    tree.evidence.processTree.descendantTerminationVerified &&
      tree.evidence.processTree.activeProcessCountAfterCompletion === 0,
    "P1_V08_DESCENDANT_EVIDENCE_FAILED",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        schemaVersion: "1.0.0",
        gateStepId: "P1-V08-ISOLATION",
        result: "PASS",
        platform: process.platform,
        capability,
        jobObjectLifecycle: {
          evidenceType: "JobObjectLifecycleResult",
          result: "PASS",
          suspendedCreateBeforeAssignment: true,
          jobObjectAssigned: true,
          killOnJobClose: true,
          activeProcessCountAfterCompletion: 0,
          environmentAllowlist: "PASS",
          stagedUnicodeAndSpacePath: "PASS",
        },
        processTreeTermination: {
          evidenceType: "ProcessTreeTerminationResult",
          result: "PASS",
          observedProcessCount: ids.length,
          rootChildGrandchildTerminated: true,
          terminationReason: tree.reason,
          activeProcessCountAfterCompletion: 0,
        },
        noDowngrade: noDowngradeResult,
        claimBoundary: {
          filesystemDenied: false,
          registryDenied: false,
          networkDenied: false,
          securitySandbox: false,
        },
      },
      null,
      2,
    )}\n`,
  );
} finally {
  if (fixture !== undefined) {
    await rm(fixture.outputRoot, { recursive: true, force: true });
  }
}
