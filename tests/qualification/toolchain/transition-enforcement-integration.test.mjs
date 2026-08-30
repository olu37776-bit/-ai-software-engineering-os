import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, test } from "vitest";

import {
  P1_O04_FINAL_AMENDMENT_CHANGED_PATHS,
  P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH,
  P1_O04_FINAL_AMENDMENT_EXECUTION_PATH,
  P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_PATHS,
  P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
  P1_O04_REQUIRED_SCOPE_PATHS,
} from "../../../scripts/toolchain/scope-policy.mjs";

const root = resolve(import.meta.dirname, "../../..");
const baseCommit = "69804341c21c220863389571d9b5be8796eb0382";
const temporaryDirectories = [];

function run(command, args, cwd, options = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    ...options,
  });
}

function runPass(command, args, cwd, options) {
  const result = run(command, args, cwd, options);
  expect(result.status, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`).toBe(0);
  return result.stdout.trim();
}

function git(cwd, ...args) {
  return runPass("git", args, cwd);
}

function createControlPathCommit(repository, parent) {
  const ref = "refs/heads/attack/noncanonical-object";
  const stream = `blob
mark :1
data <<BLOB
export const bypass = true;
BLOB
commit ${ref}
mark :2
author Issue 29 test <issue29-test@example.invalid> 0 +0000
committer Issue 29 test <issue29-test@example.invalid> 0 +0000
data <<MESSAGE
test: adversarial tracked path
MESSAGE
from ${parent}
M 100644 :1 "packages/policy/control\\tname.ts"

done
`;
  runPass("git", ["fast-import", "--quiet"], repository, { input: stream });
  return git(repository, "rev-parse", ref);
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function copyEnforcementScripts(target) {
  for (const path of [
    "scripts/toolchain/scope-policy.mjs",
    "scripts/toolchain/verify-scope.mjs",
    "scripts/governance/verify_m0.py",
  ]) {
    await writeFile(join(target, path), await readFile(join(root, path)));
  }
}

async function makeRepository() {
  const parent = await mkdtemp(join(tmpdir(), "aseos-issue29-"));
  temporaryDirectories.push(parent);
  const repository = join(parent, "repo");
  runPass("git", ["clone", "--quiet", "--no-hardlinks", root, repository], parent);
  git(repository, "config", "user.name", "Issue 29 test");
  git(repository, "config", "user.email", "issue29-test@example.invalid");
  git(repository, "checkout", "--quiet", "-B", "transition-enforcement", baseCommit);
  await copyEnforcementScripts(repository);
  git(repository, "add", "scripts/toolchain", "scripts/governance/verify_m0.py");
  git(repository, "commit", "--quiet", "-m", "test: transition enforcement subject");
  const implementationCommit = git(repository, "rev-parse", "HEAD");
  const implementationTree = git(repository, "rev-parse", "HEAD^{tree}");
  git(repository, "commit", "--quiet", "--allow-empty", "-m", "test: reviewed transition head");
  const reviewedHeadCommit = git(repository, "rev-parse", "HEAD");
  git(repository, "checkout", "--quiet", "-B", "simulated-main", baseCommit);
  git(
    repository,
    "merge",
    "--quiet",
    "--no-ff",
    "transition-enforcement",
    "-m",
    "test: merge transition enforcement",
  );
  const transitionMainCommit = git(repository, "rev-parse", "HEAD");
  return {
    repository,
    implementationCommit,
    implementationTree,
    reviewedHeadCommit,
    transitionMainCommit,
  };
}

async function createFinalAmendment(repository, transitionMainCommit) {
  const recoveryBranch = "phase-1/test-transition-recovery";
  git(repository, "checkout", "--quiet", "-B", recoveryBranch, transitionMainCommit);
  git(repository, "commit", "--quiet", "--allow-empty", "-m", "test: recovery remediation");
  git(repository, "checkout", "--quiet", "simulated-main");
  git(
    repository,
    "merge",
    "--quiet",
    "--no-ff",
    recoveryBranch,
    "-m",
    "test: merge recovery remediation",
  );
  const authorizationBaseCommit = git(repository, "rev-parse", "HEAD");

  const trackingIssue = 30;
  const authorizationBranch = "gate/final-amendment-authorization";
  git(repository, "checkout", "--quiet", "-B", authorizationBranch, authorizationBaseCommit);
  const authorizationPath =
    "operations/phase-1/evidence/o01/p1-governance-amendment-authorization-issue-30.json";
  await writeJson(join(repository, authorizationPath), {
    schemaVersion: "1.0.0",
    evidenceType: "Phase1GovernanceAmendmentAuthorization",
    trackingIssue,
    decision: "AUTHORIZED",
    subject: {
      repository: "olu37776-bit/-ai-software-engineering-os",
      authorizationBase: authorizationBaseCommit,
      authorizedBasePolicy: "DIRECT_PROTECTED_MAIN_CHILD_CONTAINING_THIS_GATE",
      implementationBranch: `governance/p1-o04-final-scope-authority-amendment-issue-${trackingIssue}`,
    },
    verifier: {
      role: "INDEPENDENT_VERIFIER",
      independent: true,
      readOnlySubjectVerification: true,
      remediationPerformed: false,
    },
    authorization: {
      mode: "GOVERNANCE_AMENDMENT",
      allowedChangedPaths: P1_O04_FINAL_AMENDMENT_CHANGED_PATHS,
      exactAmendmentPaths: P1_O04_FINAL_AMENDMENT_CHANGED_PATHS,
      authorityOwnershipDeltas: P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
      unlistedPhase1AuthorityPaths: "DENIED",
    },
    claimBoundary: {
      acceptedAdrMutationAuthorized: false,
      productionRuntimeAuthorized: false,
      p1O02ImplementationAuthorized: false,
    },
  });
  git(repository, "add", authorizationPath);
  git(repository, "commit", "--quiet", "-m", "test: authorize final amendment");
  const authorizationGateReviewedHeadCommit = git(repository, "rev-parse", "HEAD");
  git(repository, "checkout", "--quiet", "simulated-main");
  git(
    repository,
    "merge",
    "--quiet",
    "--no-ff",
    authorizationBranch,
    "-m",
    "test: merge final amendment authorization",
  );
  const authorizationGateMainCommit = git(repository, "rev-parse", "HEAD");

  const amendmentBranch = `governance/p1-o04-final-scope-authority-amendment-issue-${trackingIssue}`;
  git(repository, "checkout", "--quiet", "-B", amendmentBranch, authorizationGateMainCommit);
  const scopePath = "operations/phase-1/write-scope.json";
  const scope = JSON.parse(await readFile(join(repository, scopePath), "utf8"));
  const operationScope = scope.operations.find(({ operationId }) => operationId === "P1-O04");
  for (const path of P1_O04_REQUIRED_SCOPE_PATHS) {
    if (!operationScope.allowedPathGlobs.includes(path)) {
      operationScope.allowedPathGlobs.push(path);
    }
  }
  await writeJson(join(repository, scopePath), scope);
  const scopeText = await readFile(join(repository, scopePath), "utf8");

  const roadmapPath = "docs/roadmap/phase-1-write-scope.md";
  await writeFile(
    join(repository, roadmapPath),
    `${await readFile(join(repository, roadmapPath), "utf8")}\nTest final amendment.\n`,
    "utf8",
  );
  const roadmapText = await readFile(join(repository, roadmapPath), "utf8");

  const lockPath = "operations/phase-1/authority-lock.json";
  const lock = JSON.parse(await readFile(join(repository, lockPath), "utf8"));
  lock.authorityFiles.find(({ path }) => path === scopePath).sha256 = createHash("sha256")
    .update(scopeText.replace(/\r\n?/g, "\n"), "utf8")
    .digest("hex");
  lock.authorityFiles.find(({ path }) => path === roadmapPath).sha256 = createHash("sha256")
    .update(roadmapText.replace(/\r\n?/g, "\n"), "utf8")
    .digest("hex");
  for (const path of P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_PATHS) {
    lock.authorityFiles.find(({ path: entryPath }) => entryPath === path).allowedOperationIds = [
      "P1-O02",
      "P1-O04",
    ];
  }
  await writeJson(join(repository, lockPath), lock);
  git(repository, "add", scopePath, lockPath, roadmapPath);
  git(repository, "commit", "--quiet", "-m", "test: implement final scope authority amendment");
  const implementationCommit = git(repository, "rev-parse", "HEAD");
  const implementationTree = git(repository, "rev-parse", "HEAD^{tree}");

  await writeJson(join(repository, P1_O04_FINAL_AMENDMENT_EXECUTION_PATH), {
    schemaVersion: "1.0.0",
    executionId: "P1-O01-P1-O04-FINAL-SCOPE-AUTHORITY-AMENDMENT-TEST",
    executionType: "PHASE_1_GOVERNANCE_AMENDMENT",
    operationId: "P1-O01",
    writeScopeOperationId: "P1-O01",
    status: "IMPLEMENTED",
    trackingIssue,
    implementationBranch: amendmentBranch,
    baseCommit: authorizationGateMainCommit,
    implementationCommit,
    implementationTree,
    priorAuthorizationGateRef: authorizationPath,
  });
  await writeJson(join(repository, P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH), {
    schemaVersion: "1.0.0",
    evidenceType: "P1O04FinalScopeAuthorityAmendmentEvidence",
    decision: "IMPLEMENTED",
    operationId: "P1-O01",
    trackingIssue,
    subject: { implementationCommit, implementationTree },
    governanceOutcome: {
      requiredScopePaths: P1_O04_REQUIRED_SCOPE_PATHS,
      authorityOwnershipPaths: P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_PATHS,
      exactChangedPaths: P1_O04_FINAL_AMENDMENT_CHANGED_PATHS,
      authorityOwnershipDeltas: P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
    },
    claimBoundary: { p1O04Implemented: false, acceptedAdrChanged: false },
  });
  git(
    repository,
    "add",
    P1_O04_FINAL_AMENDMENT_EXECUTION_PATH,
    P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH,
  );
  git(repository, "commit", "--quiet", "-m", "test: bind final amendment evidence");
  const reviewedHeadCommit = git(repository, "rev-parse", "HEAD");
  git(repository, "checkout", "--quiet", "simulated-main");
  git(
    repository,
    "merge",
    "--quiet",
    "--no-ff",
    amendmentBranch,
    "-m",
    "test: merge final amendment",
  );
  const mainCommit = git(repository, "rev-parse", "HEAD");
  return {
    trackingIssue,
    authorizationGateReviewedHeadCommit,
    authorizationGateMainCommit,
    implementationCommit,
    implementationTree,
    reviewedHeadCommit,
    mainCommit,
  };
}

async function createP1O04Operation(repository, operationBase, branch, suffix) {
  git(repository, "checkout", "--quiet", "-B", branch, operationBase);
  const executionPath = `operations/phase-1/executions/p1-o04-${suffix}.json`;
  await writeJson(join(repository, executionPath), {
    schemaVersion: "1.0.0",
    executionId: `P1-O04-${suffix.toUpperCase()}`,
    executionType: "P1_O04_POLICY_QUALIFICATION",
    operationId: "P1-O04",
    writeScopeOperationId: "P1-O04",
    implementationBranch: branch,
    baseCommit: operationBase,
  });
  const policyPath = `packages/policy/src/${suffix}.ts`;
  await mkdir(join(repository, "packages/policy/src"), { recursive: true });
  await writeFile(join(repository, policyPath), "export const issue29Probe = true;\n", "utf8");
  git(repository, "add", executionPath, policyPath);
  git(repository, "commit", "--quiet", "-m", `test: ${suffix}`);
  return git(repository, "rev-parse", "HEAD");
}

function makeP1O04Gate(transition, finalAmendment, decision = "PASS") {
  return {
    schemaVersion: "1.0.0",
    evidenceType: "IndependentPhase1TransitionGate",
    trackingIssue: 29,
    decision,
    subject: {
      repository: "olu37776-bit/-ai-software-engineering-os",
      preliminaryScopeAmendmentMainCommit: baseCommit,
      transitionEnforcementImplementationCommit: transition.implementationCommit,
      transitionEnforcementImplementationTree: transition.implementationTree,
      transitionEnforcementReviewedHeadCommit: transition.reviewedHeadCommit,
      transitionEnforcementMainCommit: transition.transitionMainCommit,
      finalAmendmentTrackingIssue: finalAmendment.trackingIssue,
      finalAmendmentAuthorizationGateReviewedHeadCommit:
        finalAmendment.authorizationGateReviewedHeadCommit,
      finalAmendmentAuthorizationGateMainCommit: finalAmendment.authorizationGateMainCommit,
      finalAmendmentImplementationCommit: finalAmendment.implementationCommit,
      finalAmendmentImplementationTree: finalAmendment.implementationTree,
      finalAmendmentReviewedHeadCommit: finalAmendment.reviewedHeadCommit,
      finalAmendmentMainCommit: finalAmendment.mainCommit,
      finalAmendmentExecutionPath: P1_O04_FINAL_AMENDMENT_EXECUTION_PATH,
      finalAmendmentEvidencePath: P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH,
    },
    verifier: {
      role: "INDEPENDENT_VERIFIER",
      independent: true,
      readOnlySubjectVerification: true,
      remediationPerformed: false,
    },
    authorization: {
      p1O04Start: "RELEASED",
      authorizedBasePolicy: "PROTECTED_MAIN_COMMIT_CONTAINING_THIS_GATE_AFTER_POST_MERGE_PASS",
      finalAmendmentChangedPaths: P1_O04_FINAL_AMENDMENT_CHANGED_PATHS,
      finalAuthorityOwnershipDeltas: P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
    },
    verification: {
      transitionEnforcementIndependentVerdict: "PASS",
      transitionEnforcementExactHeadChecks: "PASS",
      transitionEnforcementPostMergeChecks: "PASS",
      finalAmendmentIndependentVerdict: "PASS",
      finalAmendmentExactHeadChecks: "PASS",
      finalAmendmentPostMergeChecks: "PASS",
    },
    claimBoundary: {
      acceptedAdrChanged: false,
      requiredCheckIdentityChanged: false,
    },
  };
}

async function commitP1O04Gate(repository, gate, gateBase, branch, mergeToMain = false) {
  git(repository, "checkout", "--quiet", "-B", branch, gateBase);
  const path = "operations/phase-1/evidence/o01/p1-o04-resume-after-issue-29-independent-gate.json";
  await writeJson(join(repository, path), gate);
  git(repository, "add", path);
  git(repository, "commit", "--quiet", "-m", "test: independent P1-O04 resume Gate");
  if (!mergeToMain) {
    return git(repository, "rev-parse", "HEAD");
  }
  git(repository, "checkout", "--quiet", "simulated-main");
  git(repository, "merge", "--quiet", "--no-ff", branch, "-m", "test: merge resume Gate");
  return git(repository, "rev-parse", "HEAD");
}

function runScope(repository, operation, base, head, branch) {
  return run(
    process.execPath,
    [
      "scripts/toolchain/verify-scope.mjs",
      "--operation",
      operation,
      "--base",
      base,
      "--head",
      head,
      "--branch",
      branch,
      "--event",
      "local",
    ],
    repository,
  );
}

function runScopeWithoutOperation(repository, base, head, branch) {
  return run(
    process.execPath,
    [
      "scripts/toolchain/verify-scope.mjs",
      "--base",
      base,
      "--head",
      head,
      "--branch",
      branch,
      "--event",
      "local",
    ],
    repository,
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Issue #29 executable transition enforcement", () => {
  test("performs an exact transactional SHA refresh with real files", async () => {
    const { repository, transitionMainCommit } = await makeRepository();
    const branch = "phase-1/test-p1-o02-lock-refresh";
    git(repository, "checkout", "--quiet", "-B", branch, transitionMainCommit);
    const executionPath = "operations/phase-1/executions/p1-o02-issue29-lock-refresh.json";
    await writeJson(join(repository, executionPath), {
      schemaVersion: "1.0.0",
      executionId: "P1-O02-ISSUE29-LOCK-REFRESH",
      executionType: "P1_O02_CONTRACT_QUALIFICATION",
      operationId: "P1-O02",
      writeScopeOperationId: "P1-O02",
      implementationBranch: branch,
      baseCommit: transitionMainCommit,
    });

    const assetPath = "packages/contracts/planned-contracts.json";
    const asset = `${await readFile(join(repository, assetPath), "utf8")} \n`;
    await writeFile(join(repository, assetPath), asset, "utf8");
    const hash = createHash("sha256").update(asset.replace(/\r\n?/g, "\n"), "utf8").digest("hex");
    const lockPath = "operations/phase-1/authority-lock.json";
    const lock = JSON.parse(await readFile(join(repository, lockPath), "utf8"));
    lock.authorityFiles.find(({ path }) => path === assetPath).sha256 = hash;
    await writeJson(join(repository, lockPath), lock);

    const result = runScope(
      repository,
      "P1-O02",
      transitionMainCommit,
      transitionMainCommit,
      branch,
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      result: "PASS",
      mode: "OPERATION_EXECUTION",
      operationId: "P1-O02",
      authorityLockRefresh: {
        lockChanged: true,
        changedLockedPaths: [assetPath],
      },
      violations: [],
    });
  });

  test("fails P1-O04 closed without or with an invalid Gate, then passes exact Gate ancestry", async () => {
    const transition = await makeRepository();
    const { repository, transitionMainCommit } = transition;

    const absentBranch = "phase-1/test-p1-o04-absent";
    const absentHead = await createP1O04Operation(
      repository,
      transitionMainCommit,
      absentBranch,
      "issue29-absent-gate",
    );
    const absent = runScope(repository, "P1-O04", transitionMainCommit, absentHead, absentBranch);
    expect(absent.status).toBe(1);
    expect(absent.stderr).toContain("P1_O04_START_BLOCKED");
    expect(absent.stderr).toContain("is absent from authorized base");

    const finalAmendment = await createFinalAmendment(repository, transitionMainCommit);
    const invalidBase = await commitP1O04Gate(
      repository,
      makeP1O04Gate(transition, finalAmendment, "FAIL"),
      finalAmendment.mainCommit,
      "gate/invalid-resume",
    );
    const invalidBranch = "phase-1/test-p1-o04-invalid";
    const invalidHead = await createP1O04Operation(
      repository,
      invalidBase,
      invalidBranch,
      "issue29-invalid-gate",
    );
    const invalid = runScope(repository, "P1-O04", invalidBase, invalidHead, invalidBranch);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain("Issue #29 independent PASS Gate is missing or invalid");

    const gateBase = await commitP1O04Gate(
      repository,
      makeP1O04Gate(transition, finalAmendment),
      finalAmendment.mainCommit,
      "gate/valid-resume",
      true,
    );
    const validBranch = "phase-1/test-p1-o04-valid";
    const validHead = await createP1O04Operation(
      repository,
      gateBase,
      validBranch,
      "issue29-valid-gate",
    );
    git(repository, "config", "core.autocrlf", "true");
    git(repository, "checkout-index", "--force", "--all");
    const valid = runScope(repository, "P1-O04", gateBase, validHead, validBranch);
    expect(valid.status, valid.stderr).toBe(0);
    const report = JSON.parse(valid.stdout);
    expect(report).toMatchObject({
      result: "PASS",
      mode: "OPERATION_EXECUTION",
      operationId: "P1-O04",
      baseCommit: gateBase,
      headCommit: validHead,
      branch: validBranch,
      operationStartGate: {
        required: true,
        decision: "PASS",
        p1O04Start: "RELEASED",
        transitionEnforcementImplementationCommit: transition.implementationCommit,
        transitionEnforcementMainCommit: transitionMainCommit,
        finalAmendmentMainCommit: finalAmendment.mainCommit,
        finalAmendmentOutcome: {
          requiredScopePathsVerified: P1_O04_REQUIRED_SCOPE_PATHS.length,
          authorityOwnershipPathsVerified: P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_PATHS.length,
        },
      },
      violations: [],
    });

    const reportPath = join(repository, "scope-report.json");
    await writeJson(reportPath, report);
    const m0 = run(
      "python",
      [
        "scripts/governance/verify_m0.py",
        "--base",
        gateBase,
        "--head",
        validHead,
        "--branch",
        validBranch,
        "--scope-report",
        reportPath,
        "--subject",
        "simulated-p1-o04",
      ],
      repository,
    );
    expect(m0.status, `${m0.stdout}\n${m0.stderr}`).toBe(0);
    const m0Report = JSON.parse(m0.stdout);
    expect(m0Report).toMatchObject({
      decision: "PASS",
      summary: { passed: 14, failed: 0, total: 14 },
    });
    expect(m0Report.checks.find(({ id }) => id.startsWith("M0-V13"))).toMatchObject({
      result: "PASS",
      detail: {
        scopeReportResult: "PASS",
        scopeMode: "OPERATION_EXECUTION",
        operationId: "P1-O04",
        baseCommit: gateBase,
        headCommit: validHead,
        branch: validBranch,
      },
    });

    const authorityPath = join(repository, "operations/phase-1/authority-lock.schema.json");
    const canonicalAuthority = (await readFile(authorityPath, "utf8")).replaceAll("\r\n", "\n");
    await writeFile(authorityPath, canonicalAuthority.replace("\n", "\r\n"), "utf8");
    const mixedLineEndings = run(
      "python",
      [
        "scripts/governance/verify_m0.py",
        "--base",
        gateBase,
        "--head",
        validHead,
        "--branch",
        validBranch,
        "--scope-report",
        reportPath,
      ],
      repository,
    );
    expect(mixedLineEndings.status).toBe(1);
    expect(mixedLineEndings.stderr).toContain("mixed LF and CRLF line endings");
    git(
      repository,
      "checkout-index",
      "--force",
      "--",
      "operations/phase-1/authority-lock.schema.json",
    );

    const missingReport = run(
      "python",
      [
        "scripts/governance/verify_m0.py",
        "--base",
        gateBase,
        "--head",
        validHead,
        "--branch",
        validBranch,
      ],
      repository,
    );
    expect(missingReport.status).toBe(1);
    expect(missingReport.stderr).toContain(
      "Exact --base, --head, --branch and --scope-report must be supplied together",
    );

    const mismatched = { ...report, branch: "phase-1/wrong-branch" };
    await writeJson(reportPath, mismatched);
    const mismatchedReport = run(
      "python",
      [
        "scripts/governance/verify_m0.py",
        "--base",
        gateBase,
        "--head",
        validHead,
        "--branch",
        validBranch,
        "--scope-report",
        reportPath,
      ],
      repository,
    );
    expect(mismatchedReport.status).toBe(1);
    expect(mismatchedReport.stderr).toContain("Malformed or mismatched operation scope report");

    await writeJson(reportPath, report);
    const wrongCheckout = run(
      "python",
      [
        "scripts/governance/verify_m0.py",
        "--base",
        gateBase,
        "--head",
        gateBase,
        "--branch",
        validBranch,
        "--scope-report",
        reportPath,
      ],
      repository,
    );
    expect(wrongCheckout.status).toBe(1);
    expect(wrongCheckout.stderr).toContain("Checked-out HEAD does not match exact --head");

    const incompleteBaseline = run(
      "python",
      ["scripts/governance/verify_m0.py", "--head", validHead],
      repository,
    );
    expect(incompleteBaseline.status).toBe(1);
    expect(incompleteBaseline.stderr).toContain(
      "Exact --base, --head, --branch and --scope-report must be supplied together",
    );
  }, 30_000);

  test("rejects raw adversarial Git paths before scope classification", async () => {
    const { repository, transitionMainCommit } = await makeRepository();
    const branch = "attack/noncanonical-path";
    git(repository, "checkout", "--quiet", "-B", branch, transitionMainCommit);
    const badPath = join(repository, "packages/policy/control-e\u0301.ts");
    await mkdir(join(repository, "packages/policy"), { recursive: true });
    await writeFile(badPath, "export const bypass = true;\n", "utf8");

    const untracked = runScopeWithoutOperation(
      repository,
      transitionMainCommit,
      transitionMainCommit,
      branch,
    );
    expect(untracked.status).toBe(1);
    expect(untracked.stderr).toContain("NON_CANONICAL_GIT_PATH");

    git(repository, "add", "-A");
    git(repository, "commit", "--quiet", "-m", "test: adversarial non-NFC path");
    const attackHead = git(repository, "rev-parse", "HEAD");
    const tracked = runScopeWithoutOperation(repository, transitionMainCommit, attackHead, branch);
    expect(tracked.status).toBe(1);
    expect(tracked.stderr).toContain("NON_CANONICAL_GIT_PATH");

    let m0AttackHead = attackHead;
    if (process.platform !== "win32") {
      const controlPathHead = createControlPathCommit(repository, transitionMainCommit);
      const controlPath = runScopeWithoutOperation(
        repository,
        transitionMainCommit,
        controlPathHead,
        branch,
      );
      expect(controlPath.status).toBe(1);
      expect(controlPath.stderr).toContain("NON_CANONICAL_GIT_PATH");
      m0AttackHead = controlPathHead;
    }

    const reportPath = join(repository, "attack-scope-report.json");
    await writeJson(reportPath, {
      schemaVersion: "1.0.0",
      check: "PHASE1_OPERATION_AWARE_WRITE_SCOPE",
      result: "PASS",
      mode: "NON_OPERATION_GOVERNANCE",
      operationId: null,
      baseCommit: transitionMainCommit,
      headCommit: m0AttackHead,
      branch,
      enforcementMode: "DENY_BY_DEFAULT",
      changedPaths: [],
      violations: [],
    });
    git(repository, "update-ref", "HEAD", m0AttackHead);
    const m0 = run(
      "python",
      [
        "scripts/governance/verify_m0.py",
        "--base",
        transitionMainCommit,
        "--head",
        m0AttackHead,
        "--branch",
        branch,
        "--scope-report",
        reportPath,
      ],
      repository,
    );
    expect(m0.status).toBe(1);
    expect(m0.stderr).toContain("Non-canonical repository path");
  });

  test.each([
    ["rename", ["mv", "packages/contracts/README.md", "renamed-contracts-readme.md"]],
    ["delete", ["rm", "packages/contracts/README.md"]],
  ])("keeps governed source paths visible for a real Git %s", async (_label, gitArgs) => {
    const { repository, transitionMainCommit } = await makeRepository();
    const branch = `attack/${_label}`;
    git(repository, "checkout", "--quiet", "-B", branch, transitionMainCommit);
    git(repository, ...gitArgs);
    git(repository, "commit", "--quiet", "-m", `test: ${_label} governed path`);
    const head = git(repository, "rev-parse", "HEAD");
    const result = runScopeWithoutOperation(repository, transitionMainCommit, head, branch);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("MISSING_OPERATION_CONTEXT");
    expect(result.stderr).toContain("packages/contracts/README.md");
  });
});

describe("required verify workflow transition wiring", () => {
  test("keeps one verify producer and wires exact event bindings through one PASS report", async () => {
    const directory = join(root, ".github/workflows");
    const workflowFiles = (await readdir(directory)).filter((name) => /\.ya?ml$/.test(name));
    const producers = [];
    for (const name of workflowFiles) {
      const source = await readFile(join(directory, name), "utf8");
      const producerCount = (source.match(/^ {2}verify:\s*$/gm) ?? []).length;
      for (let index = 0; index < producerCount; index += 1) {
        producers.push(`${name}#verify`);
      }
    }
    expect(producers).toEqual(["m0-independent-verify.yml#verify"]);

    const workflow = await readFile(join(directory, "m0-independent-verify.yml"), "utf8");
    expect(workflow).toContain("PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}");
    expect(workflow).toContain("PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}");
    expect(workflow).toContain("PUSH_BEFORE_SHA: ${{ github.event.before }}");
    expect(workflow).toContain("PUSH_HEAD_SHA: ${{ github.sha }}");
    expect(workflow).toContain('node scripts/toolchain/resolve-scope-event.mjs >> "${GITHUB_ENV}"');
    expect(workflow).toContain('node scripts/toolchain/verify-scope.mjs > "${SCOPE_REPORT}"');
    expect(workflow).toContain('--scope-report "${SCOPE_REPORT}"');
    expect(workflow).toContain('--base "${PHASE1_SCOPE_BASE}"');
    expect(workflow).toContain('--head "${PHASE1_SCOPE_HEAD}"');
    expect(workflow).toContain('--branch "${PHASE1_SCOPE_BRANCH}"');
    expect(workflow).not.toContain("Phase 1 started");

    const qualityWorkflow = await readFile(join(directory, "quality.yml"), "utf8");
    const dependencyInstall =
      'python -m pip install --disable-pip-version-check --no-input "jsonschema==4.25.1" "referencing==0.36.2"';
    expect(qualityWorkflow).toContain(dependencyInstall);
    expect(qualityWorkflow.indexOf(dependencyInstall)).toBeLessThan(
      qualityWorkflow.indexOf("pnpm run quality"),
    );
  });
});
