import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Mutants are isolated copies of the actual compiled owner. Never edit the
// checkout or count import/syntax errors as killed behavioral mutations.
const repositoryRoot = resolve(import.meta.dirname, "../..");
const snapshotId = "018f0f55-7d9b-7d32-8b6e-4e87d5e6c403";
const capturedAt = "2026-08-30T21:30:00Z";
const rule = (overrides = {}) => ({
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
  metadata: { owner: "qualification" },
  ...overrides,
});
const policy = (rules) => ({
  schemaVersion: "1.0.0",
  policySetId: "018f0f55-7d9b-7d32-8b6e-4e87d5e6c401",
  version: "1.0.0",
  description: "Integrated mutation qualification",
  source: { kind: "RELEASE", ref: "release://phase-1" },
  defaultOutcome: "DENY",
  constants: { LOW_RISK: "R1" },
  rules,
});
const input = (overrides = {}) => ({
  schemaVersion: "1.0.0",
  evaluationId: "018f0f55-7d9b-7d32-8b6e-4e87d5e6c402",
  capturedAt,
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
});
function evaluate(api, rules, overrides = {}) {
  const compiled = api.compilePolicySet(policy(rules));
  assert.equal(compiled.ok, true, "valid positive fixture must compile");
  const snapshot = api.createPolicySnapshot(compiled.value, {
    snapshotId,
    compilerVersion: "0.1.0",
    createdAt: "2026-08-30T21:29:00Z",
  });
  return api.evaluatePolicy(snapshot, input(overrides));
}
const wrongType = () =>
  rule({
    when: { operator: "notEq", reference: "input.controlVerified", operand: "true" },
  });
const cases = [
  {
    id: "default-allow",
    before: '"DENY", [], [], {}, ["DEFAULT_DENY"]',
    after: '"ALLOW", [], [], {}, ["DEFAULT_DENY"]',
    probe: (api) => assert.equal(evaluate(api, [rule()], { action: "write" }).outcome, "DENY"),
  },
  {
    id: "deny-override-removal",
    before: "if (denied.length > 0)",
    after: "if (false)",
    probe: (api) =>
      assert.equal(
        evaluate(api, [rule(), rule({ ruleId: "deny-read", ruleEffect: "DENY" })]).outcome,
        "DENY",
      ),
  },
  {
    id: "hard-invariant-bypass",
    before: "if (invariantIds.length > 0)",
    after: "if (false)",
    probe: (api) =>
      assert.equal(evaluate(api, [rule()], { authorityMutation: true }).outcome, "DENY"),
  },
  {
    id: "requirement-conflict-coercion",
    before:
      '"INDETERMINATE", allowed.map((rule) => rule.ruleId), [], {}, ["REQUIREMENTS_CONFLICT"]',
    after: '"ALLOW", allowed.map((rule) => rule.ruleId), [], {}, ["REQUIREMENTS_CONFLICT"]',
    probe: (api) =>
      assert.equal(
        evaluate(api, [
          rule({ requirements: { minimumIsolationLevel: "OS_SANDBOXED" } }),
          rule({
            ruleId: "allow-container",
            requirements: { minimumIsolationLevel: "CONTAINER_ISOLATED" },
          }),
        ]).outcome,
        "INDETERMINATE",
      ),
  },
  {
    id: "unknown-constant-acceptance",
    before: '!Object.hasOwn(constants, reference.slice("constant.".length))',
    after: "false",
    probe: (api) =>
      assert.equal(
        api.compilePolicySet(
          policy([
            rule({
              when: { operator: "notEq", reference: "constant.MISSING", operand: "DENY" },
            }),
          ]),
        ).ok,
        false,
      ),
  },
  {
    id: "incompatible-not-equal-acceptance",
    before: 'case "notEq":\n            return sameJsonType(actual, expected)',
    after: 'case "notEq":\n            return true',
    probe: (api) => assert.equal(evaluate(api, [wrongType()]).outcome, "INDETERMINATE"),
  },
  {
    id: "invalid-deny-skipped",
    before:
      'return createDecision(typedSnapshot, inputValue, "INDETERMINATE", matched.map((candidate) => candidate.ruleId), [], {}, ["CONDITION_TYPE_MISMATCH"], inputHash);',
    after: "continue;",
    probe: (api) =>
      assert.equal(
        evaluate(api, [rule(), { ...wrongType(), ruleId: "deny-invalid", ruleEffect: "DENY" }])
          .outcome,
        "INDETERMINATE",
      ),
  },
  {
    id: "ambient-clock-substitution",
    before: "evaluatedAt: isRfc3339DateTime(input.capturedAt) ? input.capturedAt : fallbackTime,",
    after: "evaluatedAt: new Date().toISOString(),",
    probe: (api) => assert.equal(evaluate(api, [rule()]).evaluatedAt, capturedAt),
  },
];

export async function qualifyPolicyMutations(root = repositoryRoot) {
  const bytes = await readFile(join(root, "packages/policy/dist/index.js"));
  const source = bytes.toString("utf8");
  const contractsUrl = pathToFileURL(join(root, "packages/contracts/dist/index.js")).href;
  assert.equal(source.split('from "@aseos/contracts"').length, 2);
  const portable = source
    .replace('from "@aseos/contracts"', `from ${JSON.stringify(contractsUrl)}`)
    .replace(/^\/\/# sourceMappingURL=.*$/gmu, "");
  const directory = await mkdtemp(join(tmpdir(), "aseos-policy-mutations-"));
  try {
    const baselinePath = join(directory, "baseline.mjs");
    await writeFile(baselinePath, portable);
    const baseline = await import(pathToFileURL(baselinePath).href);
    for (const mutation of cases) mutation.probe(baseline);
    const results = [];
    for (const mutation of cases) {
      assert.equal(
        portable.split(mutation.before).length,
        2,
        `unique mutation anchor: ${mutation.id}`,
      );
      const mutantPath = join(directory, `${mutation.id}.mjs`);
      const mutated = portable.replace(mutation.before, mutation.after);
      await writeFile(mutantPath, mutated);
      const mutant = await import(pathToFileURL(mutantPath).href);
      // All mutants must retain the ordinary valid-ALLOW behavior.
      assert.equal(evaluate(mutant, [rule()]).outcome, "ALLOW");
      let killed = false;
      try {
        mutation.probe(mutant);
      } catch (error) {
        if (error.code !== "ERR_ASSERTION") throw error;
        killed = true;
      }
      assert.equal(killed, true, `SURVIVING_MUTATION:${mutation.id}`);
      results.push({
        id: mutation.id,
        result: "KILLED",
        mutationSha256: createHash("sha256").update(mutated).digest("hex"),
      });
    }
    return {
      evidenceType: "PolicyMutationResult",
      result: "PASS",
      method: "ISOLATED_COMPILED_OWNER_BEHAVIORAL_MUTATION",
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      baselineProbes: cases.length,
      killedMutations: results.length,
      survivingMutations: 0,
      cases: results,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify(await qualifyPolicyMutations(), null, 2));
}
