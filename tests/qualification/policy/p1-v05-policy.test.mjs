import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import fc from "fast-check";
import { describe, expect, test } from "vitest";

import {
  canonicalizePolicyValue,
  compilePolicySet,
  compileRestrictedPolicyYaml,
  createPolicySnapshot,
  evaluatePolicy,
  hashPolicyValue,
  parseRestrictedPolicyYaml,
} from "@aseos/policy";

const setId = "018f0f55-7d9b-7d32-8b6e-4e87d5e6c401";
const snapshotId = "018f0f55-7d9b-7d32-8b6e-4e87d5e6c403";
const evaluationId = "018f0f55-7d9b-7d32-8b6e-4e87d5e6c402";

function rule(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    ruleId: "allow-read",
    domain: "tool",
    subjectSelector: { subjectTypes: ["NODE"] },
    action: "read",
    resourceSelector: { resourceTypes: ["WORKSPACE"] },
    when: { operator: "eq", reference: "input.riskClass", operand: "R1" },
    ruleEffect: "ALLOW",
    requirements: {},
    reasonCode: "POLICY_ALLOW_READ",
    metadata: { owner: "release" },
    ...overrides,
  };
}

function policy(rules = [rule()]) {
  return {
    schemaVersion: "1.0.0",
    policySetId: setId,
    version: "1.0.0",
    description: "Deterministic policy qualification fixture",
    source: { kind: "RELEASE", ref: "release://phase-1" },
    defaultOutcome: "DENY",
    constants: { LOW_RISK: "R1" },
    rules,
  };
}

function input(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    evaluationId,
    capturedAt: "2026-08-30T21:30:00Z",
    policySnapshotId: snapshotId,
    domain: "tool",
    subjectType: "NODE",
    action: "read",
    resourceType: "WORKSPACE",
    riskClass: "R1",
    dataClassification: "INTERNAL",
    direction: "LOCAL",
    authorityMutation: false,
    controlVerified: true,
    permissionScopes: ["workspace:read"],
    capabilityIds: ["workspace-reader"],
    ...overrides,
  };
}

function snapshot(value) {
  const compiled = compilePolicySet(value);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) throw new Error("fixture failed to compile");
  return createPolicySnapshot(compiled.value, {
    snapshotId,
    compilerVersion: "0.1.0",
    createdAt: "2026-08-30T21:29:00Z",
  });
}

describe("P1-V05 deterministic Policy qualification", () => {
  test("canonicalizes and hashes independent of key order", () => {
    const left = { z: [3, 2, 1], a: -0, text: "e\u0301" };
    const right = { text: "e\u0301", a: 0, z: [3, 2, 1] };
    expect(canonicalizePolicyValue(left)).toBe(canonicalizePolicyValue(right));
    expect(hashPolicyValue(left)).toBe(hashPolicyValue(right));
    expect(() => hashPolicyValue({ value: Number.NaN })).toThrow();
    expect(() => hashPolicyValue({ value: "\ud800" })).toThrow();
    const cyclic = {};
    cyclic.self = cyclic;
    expect(() => hashPolicyValue(cyclic)).toThrow();
  });

  test("returns byte-stable allow and default-deny decisions", () => {
    const allowSnapshot = snapshot(policy());
    const first = evaluatePolicy(allowSnapshot, input());
    expect(first).toEqual(evaluatePolicy(allowSnapshot, input()));
    expect(first.outcome).toBe("ALLOW");
    expect(evaluatePolicy(snapshot(policy([])), input())).toMatchObject({
      outcome: "DENY",
      reasonCodes: ["DEFAULT_DENY"],
    });
  });

  test("applies deny-overrides independent of rule order", () => {
    const allow = rule({ ruleId: "allow-read" });
    const deny = rule({
      ruleId: "deny-read",
      ruleEffect: "DENY",
      reasonCode: "POLICY_DENY_READ",
    });
    fc.assert(
      fc.property(fc.boolean(), (reverse) => {
        const rules = reverse ? [deny, allow] : [allow, deny];
        expect(evaluatePolicy(snapshot(policy(rules)), input())).toMatchObject({
          outcome: "DENY",
          matchedRuleIds: ["allow-read", "deny-read"],
          reasonCodes: ["POLICY_DENY_READ"],
        });
      }),
      { numRuns: 20 },
    );
  });

  test("unions requirements and fails closed on conflicts", () => {
    const read = rule({
      ruleId: "allow-read",
      requirements: { permissionScopes: ["workspace:read"], timeoutMs: 5000 },
    });
    const audit = rule({
      ruleId: "allow-read-audit",
      requirements: {
        permissionScopes: ["audit:write"],
        timeoutMs: 1000,
        postVerificationRequired: true,
      },
    });
    expect(evaluatePolicy(snapshot(policy([read, audit])), input())).toMatchObject({
      outcome: "ALLOW_WITH_REQUIREMENTS",
      requirements: {
        permissionScopes: ["audit:write", "workspace:read"],
        timeoutMs: 1000,
        postVerificationRequired: true,
      },
    });
    const os = rule({
      ruleId: "allow-os",
      requirements: { minimumIsolationLevel: "OS_SANDBOXED" },
    });
    const remote = rule({
      ruleId: "allow-remote",
      requirements: { minimumIsolationLevel: "REMOTE_ISOLATED" },
    });
    expect(evaluatePolicy(snapshot(policy([os, remote])), input())).toMatchObject({
      outcome: "INDETERMINATE",
      reasonCodes: ["REQUIREMENTS_CONFLICT"],
    });
  });

  test("runs built-in hard invariants before explicit allow", () => {
    expect(evaluatePolicy(snapshot(policy()), input({ authorityMutation: true }))).toMatchObject({
      outcome: "DENY",
      hardInvariantIds: ["NO_DIRECT_AUTHORITY_WRITE"],
      reasonCodes: ["HARD_INVARIANT_VIOLATION"],
    });
    expect(
      evaluatePolicy(snapshot(policy()), input({ riskClass: "R4", controlVerified: false })),
    ).toMatchObject({
      outcome: "DENY",
      hardInvariantIds: ["R4_REQUIRES_VERIFIED_CONTROL"],
    });
    expect(
      evaluatePolicy(
        snapshot(policy()),
        input({ dataClassification: "SECRET", direction: "OUTBOUND" }),
      ),
    ).toMatchObject({
      outcome: "DENY",
      hardInvariantIds: ["NO_SECRET_OUTBOUND"],
    });
  });

  test("fails closed for invalid reference, operator, and operand types", () => {
    expect(
      compilePolicySet(
        policy([
          rule({
            when: {
              operator: "eq",
              reference: "process.env.SECRET",
              operand: "x",
            },
          }),
        ]),
      ),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "INVALID_REFERENCE" }] });
    expect(
      compilePolicySet(
        policy([
          rule({
            when: {
              operator: "regex",
              reference: "input.action",
              operand: ".*",
            },
          }),
        ]),
      ),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "INVALID_CONDITION" }] });
    const wrongType = rule({
      when: { operator: "lt", reference: "input.action", operand: 3 },
    });
    expect(evaluatePolicy(snapshot(policy([wrongType])), input())).toMatchObject({
      outcome: "INDETERMINATE",
      reasonCodes: ["CONDITION_TYPE_MISMATCH"],
    });
  });

  test("accepts the bounded YAML subset and rejects unsafe features", () => {
    const source = [
      'schemaVersion: "1.0.0"',
      'policySetId: "' + setId + '"',
      'version: "1.0.0"',
      'description: "Restricted YAML policy"',
      "source:",
      '  kind: "RELEASE"',
      '  ref: "release://phase-1"',
      'defaultOutcome: "DENY"',
      "constants:",
      '  LOW_RISK: "R1"',
      "rules:",
      '  - schemaVersion: "1.0.0"',
      '    ruleId: "allow-read"',
      '    domain: "tool"',
      "    subjectSelector:",
      "      subjectTypes:",
      '        - "NODE"',
      '    action: "read"',
      "    resourceSelector:",
      "      resourceTypes:",
      '        - "WORKSPACE"',
      "    when:",
      '      operator: "eq"',
      '      reference: "input.riskClass"',
      '      operand: "R1"',
      '    ruleEffect: "ALLOW"',
      "    requirements:",
      "      permissionScopes:",
      '        - "workspace:read"',
      '    reasonCode: "POLICY_ALLOW_READ"',
      "    metadata:",
      '      owner: "release"',
    ].join("\n");
    expect(compileRestrictedPolicyYaml(source)).toMatchObject({ ok: true });
    for (const attack of [
      "x: &anchor 1",
      "x: *anchor",
      "x: !tag value",
      "x: $" + "{SECRET}",
      "x:\t1",
      "x: 'single'",
      "x: [1, 2]",
      "x: |\n  data",
      "__proto__: true",
      "x: 1\nx: 2",
      "x: 1\rbroken: 2",
    ]) {
      expect(() => parseRestrictedPolicyYaml(attack)).toThrow();
    }
    expect(() => parseRestrictedPolicyYaml("x: 1\n", { maxBytes: 2 })).toThrow();
  });

  test("contains no evaluation-time I/O, environment, clock, or dynamic code", async () => {
    const source = await readFile(
      resolve(import.meta.dirname, "../../../packages/policy/src/index.ts"),
      "utf8",
    );
    for (const forbidden of [
      'from "node:fs',
      'from "node:net',
      'from "node:http',
      'from "node:child_process',
      "process.env",
      "Date.now",
      "fetch(",
      "eval(",
      "Function(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
