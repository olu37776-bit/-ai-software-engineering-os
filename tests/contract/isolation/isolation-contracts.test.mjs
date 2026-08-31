import { beforeAll, describe, expect, test } from "vitest";

import { loadContractRegistry } from "@aseos/contracts";

import { readJson, repositoryRoot } from "../helpers.mjs";

const cases = [
  {
    schemaId: "urn:aseos:schema:isolation-requirement:1.0.0",
    valid: "isolation-requirement.json",
    invalid: "isolation-requirement-host-unrestricted.json",
    keyword: "enum",
  },
  {
    schemaId: "urn:aseos:schema:isolation-capability-report:1.0.0",
    valid: "isolation-capability-report.json",
    invalid: "isolation-capability-report-false-network-claim.json",
    keyword: "const",
  },
  {
    schemaId: "urn:aseos:schema:isolation-evidence:1.0.0",
    valid: "isolation-evidence.json",
    invalid: "isolation-evidence-downgrade.json",
    keyword: "const",
  },
];

async function example(kind, name) {
  return readJson(repositoryRoot, `packages/contracts/examples/isolation/${kind}/${name}`);
}

function validate(registry, schemaId, value) {
  return registry.validate({ schemaId, schemaVersion: "1.0.0" }, value);
}

describe("P1-O07 canonical PROCESS_RESTRICTED contracts", () => {
  let registry;

  beforeAll(async () => {
    registry = await loadContractRegistry(repositoryRoot);
  });

  test.each(cases)(
    "validates $schemaId examples and rejects the declared boundary",
    async (item) => {
      const valid = await example("valid", item.valid);
      const invalid = await example("invalid", item.invalid);

      expect(validate(registry, item.schemaId, valid)).toMatchObject({
        ok: true,
        schemaId: item.schemaId,
        schemaVersion: "1.0.0",
      });
      expect(validate(registry, item.schemaId, invalid)).toMatchObject({
        ok: false,
        code: "SCHEMA_VALIDATION_FAILED",
        errors: expect.arrayContaining([expect.objectContaining({ keyword: item.keyword })]),
      });
    },
  );

  test("publishes exactly three active isolation authorities and removes their planned entries", async () => {
    const [inventory, planned] = await Promise.all([
      readJson(repositoryRoot, "packages/contracts/schema-inventory.json"),
      readJson(repositoryRoot, "packages/contracts/planned-contracts.json"),
    ]);
    const activated = inventory.contracts.filter((contract) => contract.domain === "isolation");
    expect(activated.map((contract) => contract.canonicalName)).toEqual([
      "IsolationCapabilityReport",
      "IsolationEvidence",
      "IsolationRequirement",
    ]);
    expect(activated.every((contract) => contract.status === "BASELINE_DRAFT")).toBe(true);
    expect(activated.every((contract) => contract.publicBoundary === true)).toBe(true);
    expect(planned.contracts.some((contract) => contract.domain === "isolation")).toBe(false);
  });

  test("never accepts HOST_UNRESTRICTED or a downward-isolation override", async () => {
    const requirement = await example("valid", "isolation-requirement.json");
    for (const mutation of [
      { minimumIsolationLevel: "HOST_UNRESTRICTED" },
      { downgradeAllowed: true },
    ]) {
      expect(validate(registry, cases[0].schemaId, { ...requirement, ...mutation })).toMatchObject({
        ok: false,
        code: "SCHEMA_VALIDATION_FAILED",
      });
    }
  });

  test("keeps PROCESS_RESTRICTED claims below a security-sandbox boundary", async () => {
    const [report, evidence] = await Promise.all([
      example("valid", "isolation-capability-report.json"),
      example("valid", "isolation-evidence.json"),
    ]);
    for (const field of [
      "networkAccessDenied",
      "filesystemAccessDenied",
      "registryAccessDenied",
      "securitySandbox",
    ]) {
      for (const [schemaId, value] of [
        [cases[1].schemaId, report],
        [cases[2].schemaId, evidence],
      ]) {
        expect(
          validate(registry, schemaId, {
            ...value,
            guarantees: { ...value.guarantees, [field]: true },
          }),
        ).toMatchObject({ ok: false, code: "SCHEMA_VALIDATION_FAILED" });
      }
    }
  });

  test("fails closed for unknown fields and an AVAILABLE report with a failed probe", async () => {
    const [requirement, report] = await Promise.all([
      example("valid", "isolation-requirement.json"),
      example("valid", "isolation-capability-report.json"),
    ]);
    expect(
      validate(registry, cases[0].schemaId, { ...requirement, authorityBypass: true }),
    ).toMatchObject({ ok: false, code: "SCHEMA_VALIDATION_FAILED" });
    expect(
      validate(registry, cases[1].schemaId, {
        ...report,
        probe: { ...report.probe, jobObjectAvailable: false },
      }),
    ).toMatchObject({ ok: false, code: "SCHEMA_VALIDATION_FAILED" });
  });

  test("binds the canonical capability and Windows Job Object provider identities", async () => {
    const report = await example("valid", "isolation-capability-report.json");
    for (const mutation of [
      { capabilityId: "other-capability" },
      { capabilityVersion: "2.0.0" },
      { providerId: "other-provider" },
      { providerVersion: "2.0.0" },
    ]) {
      expect(validate(registry, cases[1].schemaId, { ...report, ...mutation })).toMatchObject({
        ok: false,
        code: "SCHEMA_VALIDATION_FAILED",
      });
    }
  });

  test("encodes unavailable providers without containment claims and rejects dishonest ones", async () => {
    const report = await example("valid", "isolation-capability-report.json");
    const unavailable = {
      ...report,
      platform: "linux",
      probe: {
        ...report.probe,
        windowsBuild: undefined,
        jobObjectAvailable: false,
        nestedProcessAssignmentSupported: false,
      },
      budgetSupport: Object.fromEntries(
        Object.keys(report.budgetSupport).map((key) => [key, false]),
      ),
      guarantees: {
        ...report.guarantees,
        processTreeLifecycleContained: false,
        resourceBudgetsEnforced: false,
      },
      result: "UNAVAILABLE",
      reasonCodes: ["PLATFORM_UNSUPPORTED"],
    };
    delete unavailable.probe.windowsBuild;
    expect(validate(registry, cases[1].schemaId, unavailable)).toMatchObject({ ok: true });
    expect(
      validate(registry, cases[1].schemaId, {
        ...unavailable,
        guarantees: { ...unavailable.guarantees, processTreeLifecycleContained: true },
      }),
    ).toMatchObject({ ok: false, code: "SCHEMA_VALIDATION_FAILED" });
  });

  test("requires probe availability, bounded usage, cleanup result and evidence references", async () => {
    const [report, evidence] = await Promise.all([
      example("valid", "isolation-capability-report.json"),
      example("valid", "isolation-evidence.json"),
    ]);
    expect(
      validate(registry, cases[1].schemaId, {
        ...report,
        result: "UNAVAILABLE",
        reasonCodes: [],
      }),
    ).toMatchObject({ ok: false, code: "SCHEMA_VALIDATION_FAILED" });
    expect(validate(registry, cases[2].schemaId, { ...evidence, usage: {} })).toMatchObject({
      ok: false,
      code: "SCHEMA_VALIDATION_FAILED",
    });
    expect(validate(registry, cases[2].schemaId, { ...evidence, evidenceRefs: [] })).toMatchObject({
      ok: false,
      code: "SCHEMA_VALIDATION_FAILED",
    });
    expect(
      validate(registry, cases[2].schemaId, {
        ...evidence,
        processTree: { ...evidence.processTree, activeProcessCountAfterCompletion: 1 },
      }),
    ).toMatchObject({ ok: false, code: "SCHEMA_VALIDATION_FAILED" });
  });

  test("emits Evidence only after Job Object assignment", async () => {
    const evidence = await example("valid", "isolation-evidence.json");
    const failedToStart = {
      ...evidence,
      usage: {
        cpuTimeMs: 0,
        memoryPeakBytes: 0,
        processPeakCount: 0,
        wallClockMs: 0,
        stdoutBytes: 0,
        stderrBytes: 0,
      },
      processTree: null,
      result: {
        outcome: "FAILED",
        terminationReason: "FAILED_TO_START",
        processTreeTerminated: true,
        reasonCodes: ["JOB_OBJECT_UNAVAILABLE"],
      },
    };
    expect(validate(registry, cases[2].schemaId, failedToStart)).toMatchObject({
      ok: false,
      code: "SCHEMA_VALIDATION_FAILED",
    });
  });
});
