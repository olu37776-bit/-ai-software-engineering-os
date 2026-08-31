import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { loadContractRegistry } from "@aseos/contracts";

import {
  adapterDist,
  canonicalRequirement,
  catalogFor,
  compileProcessFixture,
  removeProcessFixture,
  repositoryRoot,
  requestFor,
  workerDist,
} from "../../security/isolation/helpers.mjs";

describe("P1-V08 PROCESS_RESTRICTED qualification", () => {
  let adapter;
  let worker;
  let capability;
  let fixture;
  let registry;

  beforeAll(async () => {
    [adapter, worker, fixture, registry] = await Promise.all([
      import(pathToFileURL(adapterDist).href),
      import(pathToFileURL(workerDist).href),
      compileProcessFixture(),
      loadContractRegistry(repositoryRoot),
    ]);
    capability = await adapter.probeWindowsProcessRestrictedCapability();
  }, 60_000);

  afterAll(async () => {
    if (fixture !== undefined) {
      await removeProcessFixture(fixture);
    }
  });

  test("reports an honest canonical capability boundary", () => {
    expect(capability).toMatchObject({
      schemaVersion: "1.0.0",
      capabilityId: "windows-process-restricted",
      providerId: "aseos.windows-job-object",
      providerVersion: "1.0.0",
      isolationLevel: "PROCESS_RESTRICTED",
      guarantees: {
        networkAccessDenied: false,
        filesystemAccessDenied: false,
        registryAccessDenied: false,
        securitySandbox: false,
      },
    });
    expect(
      registry.validate(
        {
          schemaId: "urn:aseos:schema:isolation-capability-report:1.0.0",
          schemaVersion: "1.0.0",
        },
        capability,
      ),
    ).toMatchObject({ ok: true });
    if (process.platform === "win32") {
      expect(capability).toMatchObject({
        result: "AVAILABLE",
        platform: "win32",
        budgetSupport: {
          cpuTime: true,
          memory: true,
          processCount: true,
          wallClock: true,
          stdout: true,
          stderr: true,
        },
        guarantees: {
          processTreeLifecycleContained: true,
          resourceBudgetsEnforced: true,
        },
        reasonCodes: [],
      });
    } else {
      expect(capability).toMatchObject({
        result: "UNAVAILABLE",
        guarantees: {
          processTreeLifecycleContained: false,
          resourceBudgetsEnforced: false,
        },
        reasonCodes: ["UNSUPPORTED_PLATFORM"],
      });
    }
  });

  test("blocks every stronger minimum without downward fallback", () => {
    const baseRequest = {
      evidenceContext: {
        requirementId: "018f47a2-1000-7000-8000-000000000001",
      },
      isolationRequirement: canonicalRequirement(),
    };
    for (const minimumIsolationLevel of ["OS_SANDBOXED", "CONTAINER_ISOLATED", "REMOTE_ISOLATED"]) {
      expect(
        worker.resolveIsolationProvider(
          {
            ...baseRequest,
            isolationRequirement: {
              ...baseRequest.isolationRequirement,
              minimumIsolationLevel,
            },
          },
          capability,
        ),
      ).toMatchObject({
        status: "BLOCKED",
        requested: minimumIsolationLevel,
        selected: null,
        reasonCode: "MINIMUM_ISOLATION_LEVEL_UNAVAILABLE",
      });
    }
  });

  test("fails closed when the provider is unavailable or the canonical requirement is invalid", () => {
    const requirement = canonicalRequirement();
    const request = {
      evidenceContext: {
        requirementId: requirement.requirementId,
      },
      isolationRequirement: requirement,
    };
    expect(
      worker.resolveIsolationProvider(request, {
        ...capability,
        result: "UNAVAILABLE",
        reasonCodes: ["QUALIFICATION_UNAVAILABLE"],
      }),
    ).toMatchObject({
      status: "BLOCKED",
      selected: null,
      reasonCode: "PROCESS_RESTRICTED_PROVIDER_UNAVAILABLE",
    });
    expect(
      worker.resolveIsolationProvider(
        {
          ...request,
          isolationRequirement: {
            ...request.isolationRequirement,
            requiredProviderFeatures: ["NETWORK_DENIAL"],
          },
        },
        { ...capability, result: "AVAILABLE", reasonCodes: [] },
      ),
    ).toMatchObject({
      status: "BLOCKED",
      selected: null,
      reasonCode: "INVALID_ISOLATION_REQUIREMENT",
    });
  });

  test("runs a pinned executable in a staged Unicode path with an allowlisted environment", async () => {
    if (process.platform !== "win32") {
      const result = await adapter.runWindowsProcessRestricted(
        {},
        {
          resolve: () => {
            throw new Error("unavailable provider must not resolve or launch a host tool");
          },
        },
        capability,
      );
      expect(result).toMatchObject({ status: "UNAVAILABLE", capability });
      return;
    }
    const stagingRoot = join(fixture.outputRoot, "staging 根 目录");
    const result = await adapter.runWindowsProcessRestricted(
      requestFor(stagingRoot),
      catalogFor(fixture.executable, fixture.executableSha256),
      capability,
    );
    expect(result.status).toBe("COMPLETED");
    expect(result.exitCode).toBe(0);
    const stdout = Buffer.from(result.stdout).toString("utf8");
    expect(stdout).toContain("ALLOWED=visible");
    expect(stdout).toContain("SECRET=<missing>");
    expect(stdout).toContain("INPUT=受控输入");
    expect(Buffer.from(result.stderr).toString("utf8")).toContain("STDERR=controlled");
    expect(result.stagedWorkingDirectory).toContain("staging 根 目录");
    expect(result.evidence).toMatchObject({
      capabilityReportId: capability.reportId,
      providerId: capability.providerId,
      providerVersion: capability.providerVersion,
      selectedIsolationLevel: "PROCESS_RESTRICTED",
      downgradeOccurred: false,
      processTree: {
        jobObjectAssigned: true,
        killOnJobClose: true,
        descendantTerminationVerified: true,
        activeProcessCountAfterCompletion: 0,
      },
      result: {
        outcome: "SUCCEEDED",
        terminationReason: "EXITED",
        processTreeTerminated: true,
        reasonCodes: [],
      },
    });
    expect(
      registry.validate(
        {
          schemaId: "urn:aseos:schema:isolation-evidence:1.0.0",
          schemaVersion: "1.0.0",
        },
        result.evidence,
      ),
    ).toMatchObject({ ok: true });
  }, 60_000);
});
