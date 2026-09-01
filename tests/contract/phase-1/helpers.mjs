import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const repositoryRoot = resolve(import.meta.dirname, "../../..");
export const BASELINE_COMMIT = "7700b608586868cc6e4c19d519b8eef6fc770ae3";
export const RECEIPT_PATH = "operations/phase-1/implementation-receipt.json";
export const INDEPENDENT_RECEIPT_PATH =
  "operations/phase-1/evidence/o09/independent-verification-receipt.json";
export const INTEGRATED_EVIDENCE_PATH =
  "operations/phase-1/evidence/o09/p1-v10-integrated-gate.json";
export const EXECUTION_PATH = "operations/phase-1/executions/p1-o09-integrated-gate.json";

export const operationIds = Array.from(
  { length: 9 },
  (_, index) => `P1-O${String(index + 1).padStart(2, "0")}`,
);

export const stepIds = [
  "P1-V00-M0-AUTHORIZATION",
  "P1-V01-PREFLIGHT",
  "P1-V02-TOOLCHAIN",
  "P1-V03-CONTRACTS",
  "P1-V04-ARCHITECTURE",
  "P1-V05-POLICY",
  "P1-V06-PERSISTENCE",
  "P1-V07-CONTROL-API",
  "P1-V08-ISOLATION",
  "P1-V09-PACKAGING",
  "P1-V10-INTEGRATED-GATE",
];

export const expectedEvidenceTypes = new Map([
  ["P1-V00-M0-AUTHORIZATION", ["M0GateEvidence", "AuthorityLockEvidence"]],
  ["P1-V01-PREFLIGHT", ["BaselineIdentityEvidence", "WriteScopeValidationResult"]],
  [
    "P1-V02-TOOLCHAIN",
    ["FrozenLockfileInstallResult", "TypeScriptBuildResult", "CrossPlatformBuildEvidence"],
  ],
  [
    "P1-V03-CONTRACTS",
    [
      "SchemaMetaValidationResult",
      "SchemaRegistryValidationResult",
      "ExampleSuiteResult",
      "SchemaTypeConsistencyResult",
    ],
  ],
  [
    "P1-V04-ARCHITECTURE",
    ["DependencyGraphResult", "DeepImportDenialResult", "DuplicateSemanticOwnerDenialResult"],
  ],
  [
    "P1-V05-POLICY",
    ["CanonicalizationDeterminismResult", "FailClosedPropertyResult", "PolicyMutationResult"],
  ],
  [
    "P1-V06-PERSISTENCE",
    [
      "PersistenceAtomicityResult",
      "CrashRecoveryResult",
      "BackupRestoreResult",
      "CorruptionQuarantineResult",
    ],
  ],
  [
    "P1-V07-CONTROL-API",
    [
      "OpenApiValidationResult",
      "LoopbackExposureResult",
      "TokenAclRedactionResult",
      "CliPublicApiAcceptanceResult",
    ],
  ],
  [
    "P1-V08-ISOLATION",
    ["JobObjectLifecycleResult", "ProcessTreeTerminationResult", "NoDowngradePropertyResult"],
  ],
  [
    "P1-V09-PACKAGING",
    [
      "SelfContainedArtifactResult",
      "ReleaseManifestConsistencyResult",
      "CleanWindowsStartupResult",
    ],
  ],
  [
    "P1-V10-INTEGRATED-GATE",
    ["StructuredReceiptValidationResult", "WriteScopeComplianceResult", "IndependentGateDecision"],
  ],
]);

export const evidenceByStep = new Map([
  ["P1-V00-M0-AUTHORIZATION", "operations/phase-1/evidence/o01/p1-v00-authorization.json"],
  ["P1-V01-PREFLIGHT", "operations/phase-1/evidence/o01/p1-v01-preflight.json"],
  ["P1-V02-TOOLCHAIN", "operations/phase-1/evidence/o01/p1-v02-toolchain.json"],
  ["P1-V03-CONTRACTS", "operations/phase-1/evidence/o02/p1-v03-contracts.json"],
  ["P1-V04-ARCHITECTURE", "operations/phase-1/evidence/o03/p1-v04-architecture.json"],
  ["P1-V05-POLICY", "operations/phase-1/evidence/o04/p1-v05-policy.json"],
  ["P1-V06-PERSISTENCE", "operations/phase-1/evidence/o05/p1-v06-persistence.json"],
  ["P1-V07-CONTROL-API", "operations/phase-1/evidence/o06/p1-v07-control-api.json"],
  ["P1-V08-ISOLATION", "operations/phase-1/evidence/o07/p1-v08-isolation.json"],
  ["P1-V09-PACKAGING", "operations/phase-1/evidence/o08/p1-v09-packaging.json"],
  ["P1-V10-INTEGRATED-GATE", INTEGRATED_EVIDENCE_PATH],
]);

const implementationCommitByOperation = new Map([
  ["P1-O01", "eba4ebf219529cca2c34fd813d37f8bd7b1f5a6c"],
  ["P1-O02", "aaabf8d2e61366a4e6d7e8188db7a1262d88d78e"],
  ["P1-O03", "60e832aae4426a0fc076109821029addf197d106"],
  ["P1-O04", "fbf8818cf3e8c69570e9d0671d86a01e247ded34"],
  ["P1-O05", "e157d7888262ef5484273cca35b5c21df34f9d01"],
  ["P1-O06", "571bed2ed1f0ae9e76a497a0d65532f5747ef2eb"],
  ["P1-O07", "3dae67633c29d9bb65e72290886ee96b93ad771a"],
  ["P1-O08", "62f14d7fb5c6699cade844b06486a5850a9347fc"],
]);

const temporaryDirectories = [];

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function git(repository, ...args) {
  const child = spawnSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (child.status !== 0) {
    throw new Error(`GIT_FIXTURE_FAILED: git ${args.join(" ")}\n${child.stdout}\n${child.stderr}`);
  }
  return child.stdout.trim();
}

function gitPaths(repository, ...args) {
  const child = spawnSync("git", [...args, "-z"], {
    cwd: repository,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (child.status !== 0) {
    throw new Error(
      `GIT_FIXTURE_FAILED: git ${args.join(" ")} -z\n${child.stdout}\n${child.stderr}`,
    );
  }
  return child.stdout.split("\0").filter(Boolean).sort();
}

async function sha256File(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

function gitObjectBytes(repository, commit, path) {
  const child = spawnSync("git", ["show", `${commit}:${path}`], {
    cwd: repository,
    encoding: "buffer",
    shell: false,
    windowsHide: true,
  });
  if (child.status !== 0) {
    throw new Error(`GIT_FIXTURE_FAILED: cannot read ${commit}:${path}`);
  }
  return child.stdout;
}

function sha256GitObject(repository, commit, path) {
  return createHash("sha256")
    .update(gitObjectBytes(repository, commit, path))
    .digest("hex");
}

function sha256DeterministicCrlfGitObject(repository, commit, path) {
  const text = gitObjectBytes(repository, commit, path).toString("utf8");
  const bytes = Buffer.from(text.replace(/\r\n|\r|\n/gu, "\n").replace(/\n/gu, "\r\n"), "utf8");
  return createHash("sha256").update(bytes).digest("hex");
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function canonicalPath(repository, relativePath) {
  return join(repository, ...relativePath.split("/"));
}

function makeIntegratedEvidence(implementationCommit) {
  return {
    schemaVersion: "1.0.0",
    operationId: "P1-O09",
    verificationStepId: "P1-V10-INTEGRATED-GATE",
    implementationCommit,
    results: expectedEvidenceTypes.get("P1-V10-INTEGRATED-GATE").map((evidenceType) => ({
      evidenceType,
      result: "PASS",
    })),
  };
}

function makeExecutionRecord(implementationCommit) {
  return {
    schemaVersion: "1.0.0",
    operationId: "P1-O09",
    implementationCommit,
    verificationStepId: "P1-V10-INTEGRATED-GATE",
    result: "PASS",
  };
}

async function makeReceipt(repository, implementationCommit) {
  const changedPaths = gitPaths(
    repository,
    "diff",
    "--name-only",
    `${BASELINE_COMMIT}..${implementationCommit}`,
  );
  const generatedPaths = gitPaths(
    repository,
    "diff",
    "--name-only",
    "--diff-filter=A",
    `${BASELINE_COMMIT}..${implementationCommit}`,
  );
  const verificationPlan = await readJson(
    canonicalPath(repository, "operations/phase-1/verification-plan.json"),
  );
  const operationManifest = await readJson(
    canonicalPath(repository, "operations/phase-1/operation.json"),
  );
  const outputByOperation = new Map(
    operationManifest.suboperations.map(({ operationId, outputs }) => [operationId, outputs]),
  );
  const evidenceRefs = [...new Set(evidenceByStep.values())];

  return {
    $schema: "urn:aseos:operation-schema:phase-1-receipt:1.1.0",
    schemaVersion: "1.1.0",
    operationId: "P1-EXECUTABLE-REPOSITORY-FOUNDATION",
    m0GateRef: "docs/reviews/m0-architecture-baseline-verified.md",
    authorityLockHash: sha256GitObject(
      repository,
      implementationCommit,
      "operations/phase-1/authority-lock.json",
    ),
    baselineCommit: BASELINE_COMMIT,
    implementationCommit,
    implementationDeclaration: "IMPLEMENTED",
    declaredBy: { role: "IMPLEMENTATION_AGENT", actorId: "fixture-implementation-agent" },
    startedAt: "2026-09-01T00:00:00.000Z",
    completedAt: "2026-09-01T00:01:00.000Z",
    writeScope: {
      scopeId: "P1-EXECUTABLE-REPOSITORY-FOUNDATION-WRITE-SCOPE",
      authorityLockVerified: true,
      compliant: true,
      changedPaths,
      generatedPaths,
      violations: [],
    },
    suboperations: operationIds.map((operationId) => ({
      operationId,
      status: "IMPLEMENTED",
      commitRefs: [implementationCommitByOperation.get(operationId) ?? implementationCommit],
      outputs: outputByOperation.get(operationId),
      findings: [],
    })),
    verification: {
      planId: verificationPlan.planId,
      planHash: sha256DeterministicCrlfGitObject(
        repository,
        implementationCommit,
        "operations/phase-1/verification-plan.json",
      ),
      executions: verificationPlan.steps.map(({ stepId }) => ({
        stepId,
        environment: "self-contained-temp-git-repository",
        command: "read-only fixture verification",
        result: "PASS",
        exitCode: 0,
        durationMs: 1,
        evidenceRefs: [evidenceByStep.get(stepId)],
      })),
      overallResult: "PASS",
    },
    qualificationObligations: ["ADR-0007", "ADR-0008", "ADR-0009", "ADR-0010", "ADR-0011"].map(
      (adrRef) => ({
        obligationId: `${adrRef}-PHASE-1-QUALIFICATION`,
        adrRef,
        result: "PASS",
        evidenceRefs: [INTEGRATED_EVIDENCE_PATH],
      }),
    ),
    evidenceRefs,
    knownGaps: [],
    stopCondition: {
      triggered: false,
      condition: null,
      action: "No stop condition was triggered.",
    },
    unauthorizedFallbackUsed: false,
    documentationSynchronized: true,
    independentVerificationRef: INDEPENDENT_RECEIPT_PATH,
  };
}

async function makeIndependentReceipt(repository, receipt, receiptPath) {
  const verificationPlan = await readJson(
    canonicalPath(repository, "operations/phase-1/verification-plan.json"),
  );
  return {
    $schema: "urn:aseos:operation-schema:phase-1-independent-verification-receipt:1.0.0",
    schemaVersion: "1.0.0",
    operationId: "P1-EXECUTABLE-REPOSITORY-FOUNDATION",
    implementationCommit: receipt.implementationCommit,
    implementationReceiptHash: await sha256File(receiptPath),
    verifiedBy: {
      role: "INDEPENDENT_VERIFIER",
      actorId: "fixture-independent-verifier",
      verifierVersion: "1.0.0",
    },
    startedAt: "2026-09-01T00:02:00.000Z",
    completedAt: "2026-09-01T00:03:00.000Z",
    readOnlyVerification: true,
    stepResults: verificationPlan.steps.map(({ stepId }) => ({
      stepId,
      result: "PASS",
      evidenceRefs: [evidenceByStep.get(stepId)],
    })),
    gateDecision: "PASS",
    evidenceRefs: [...new Set(evidenceByStep.values())],
    remediationPerformed: false,
  };
}

async function writeReceiptCommitFiles(fixture, { receipt, independentReceipt, evidence } = {}) {
  const nextReceipt = receipt ?? fixture.receipt;
  const receiptPath = canonicalPath(fixture.fixtureRepository, RECEIPT_PATH);
  const independentReceiptPath = canonicalPath(fixture.fixtureRepository, INDEPENDENT_RECEIPT_PATH);
  await writeJson(receiptPath, nextReceipt);
  const nextIndependent = independentReceipt
    ? cloneJson(independentReceipt)
    : await makeIndependentReceipt(fixture.fixtureRepository, nextReceipt, receiptPath);
  await writeJson(independentReceiptPath, nextIndependent);
  await writeJson(
    canonicalPath(fixture.fixtureRepository, INTEGRATED_EVIDENCE_PATH),
    evidence ?? fixture.integratedEvidence,
  );
  await writeJson(
    canonicalPath(fixture.fixtureRepository, EXECUTION_PATH),
    makeExecutionRecord(fixture.implementationCommit),
  );
  return { nextReceipt, nextIndependent, receiptPath, independentReceiptPath };
}

async function commitReceiptB(fixture, message = "fixture canonical receipt B") {
  git(
    fixture.fixtureRepository,
    "add",
    RECEIPT_PATH,
    "operations/phase-1/evidence/o09",
    EXECUTION_PATH,
  );
  git(fixture.fixtureRepository, "commit", "--quiet", "-m", message);
  fixture.receiptCommit = git(fixture.fixtureRepository, "rev-parse", "HEAD");
}

export async function makeReceiptFixture() {
  const directory = await mkdtemp(join(tmpdir(), "aseos-p1-receipt-fixture-"));
  temporaryDirectories.push(directory);
  const fixtureRepository = join(directory, "repository");
  const clone = spawnSync(
    "git",
    [
      "clone",
      "--quiet",
      "--no-hardlinks",
      "-c",
      "core.autocrlf=true",
      repositoryRoot,
      fixtureRepository,
    ],
    { encoding: "utf8", shell: false, windowsHide: true },
  );
  if (clone.status !== 0) {
    throw new Error(`GIT_FIXTURE_CLONE_FAILED\n${clone.stdout}\n${clone.stderr}`);
  }
  await symlink(
    join(repositoryRoot, "node_modules"),
    join(fixtureRepository, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  git(fixtureRepository, "config", "user.name", "Phase 1 receipt fixture");
  git(fixtureRepository, "config", "user.email", "phase1-receipt-fixture@example.invalid");
  git(
    fixtureRepository,
    "rm",
    "--quiet",
    "--ignore-unmatch",
    RECEIPT_PATH,
    "operations/phase-1/evidence/o09/*.json",
    "operations/phase-1/executions/p1-o09-*.json",
  );
  for (const relativePath of ["scripts/verify-phase-1", "tests/contract/phase-1"]) {
    await cp(
      canonicalPath(repositoryRoot, relativePath),
      canonicalPath(fixtureRepository, relativePath),
      {
        recursive: true,
        force: true,
      },
    );
  }
  git(fixtureRepository, "add", "scripts/verify-phase-1", "tests/contract/phase-1");
  git(fixtureRepository, "commit", "--quiet", "-m", "fixture implementation commit A");
  const implementationCommit = git(fixtureRepository, "rev-parse", "HEAD");
  const receipt = await makeReceipt(fixtureRepository, implementationCommit);
  const integratedEvidence = makeIntegratedEvidence(implementationCommit);
  const fixture = {
    directory,
    fixtureRepository,
    implementationCommit,
    receipt,
    integratedEvidence,
  };
  const written = await writeReceiptCommitFiles(fixture);
  fixture.independentReceipt = written.nextIndependent;
  fixture.receiptPath = written.receiptPath;
  fixture.independentReceiptPath = written.independentReceiptPath;
  await commitReceiptB(fixture);
  fixture.canonicalReceiptCommit = fixture.receiptCommit;
  return fixture;
}

export async function restoreCanonicalFixture(fixture) {
  git(fixture.fixtureRepository, "reset", "--hard", "--quiet", fixture.canonicalReceiptCommit);
  git(fixture.fixtureRepository, "clean", "-fd", "--quiet");
}

export async function materializeReceiptMutation(
  fixture,
  { mutateReceipt, mutateIndependentReceipt, mutateEvidence, intermediateCommit = false } = {},
) {
  git(fixture.fixtureRepository, "reset", "--hard", "--quiet", fixture.implementationCommit);
  git(fixture.fixtureRepository, "clean", "-fd", "--quiet");
  if (intermediateCommit) {
    const marker = canonicalPath(
      fixture.fixtureRepository,
      "operations/phase-1/evidence/o09/intermediate.json",
    );
    await writeJson(marker, { schemaVersion: "1.0.0", purpose: "non-direct topology probe" });
    git(fixture.fixtureRepository, "add", "operations/phase-1/evidence/o09/intermediate.json");
    git(fixture.fixtureRepository, "commit", "--quiet", "-m", "fixture intermediate commit");
  }
  const receipt = cloneJson(fixture.receipt);
  if (mutateReceipt) await mutateReceipt(receipt, fixture);
  const independentReceipt = cloneJson(fixture.independentReceipt);
  if (mutateIndependentReceipt) await mutateIndependentReceipt(independentReceipt, fixture);
  const evidence = cloneJson(fixture.integratedEvidence);
  if (mutateEvidence) await mutateEvidence(evidence, fixture);
  const written = await writeReceiptCommitFiles(fixture, {
    receipt,
    independentReceipt: mutateIndependentReceipt ? independentReceipt : undefined,
    evidence,
  });
  if (mutateIndependentReceipt) {
    independentReceipt.implementationReceiptHash = await sha256File(written.receiptPath);
    await writeJson(written.independentReceiptPath, independentReceipt);
  }
  await commitReceiptB(fixture, "fixture mutated receipt B");
  return {
    receipt,
    independentReceipt: mutateIndependentReceipt ? independentReceipt : written.nextIndependent,
    receiptPath: written.receiptPath,
    independentReceiptPath: written.independentReceiptPath,
  };
}

export async function writeAdversarialEvidence(fixture, value) {
  const relativePath = "operations/phase-1/evidence/o09/adversarial-evidence.json";
  const path = canonicalPath(fixture.fixtureRepository, relativePath);
  await writeJson(path, value);
  return { path, relativePath };
}

export async function replaceWithSymlink(path, target) {
  const info = await lstat(path);
  if (!info.isSymbolicLink()) await rm(path);
  await symlink(target, path, "file");
}

export async function makeExternalJson(fixture, name, value) {
  const path = join(fixture.directory, name);
  await writeJson(path, value);
  return path;
}

export async function removeTemporaryReceipts() {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
}

export function runReceiptVerifier({ receiptPath, independentReceiptPath, fixtureRepository }) {
  const verifierPath = resolve(fixtureRepository, "scripts/verify-phase-1/verify-receipt.mjs");
  const args = [
    verifierPath,
    "--receipt",
    receiptPath,
    "--repository-root",
    fixtureRepository,
    "--json",
  ];
  if (independentReceiptPath) args.push("--independent-receipt", independentReceiptPath);
  const child = spawnSync(process.execPath, args, {
    cwd: fixtureRepository,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  let output;
  try {
    output = JSON.parse(child.stdout);
  } catch (error) {
    throw new Error(
      [
        "RECEIPT_VERIFIER_DID_NOT_RETURN_JSON",
        `status=${String(child.status)}`,
        `stdout=${child.stdout}`,
        `stderr=${child.stderr}`,
        `parseError=${error instanceof Error ? error.message : String(error)}`,
      ].join("\n"),
      { cause: error },
    );
  }
  return { ...child, output };
}

export function verifierDiagnostic(result) {
  return JSON.stringify(
    { status: result.status, stdout: result.stdout, stderr: result.stderr, output: result.output },
    null,
    2,
  );
}

export function expectVerifierPass(expect, result) {
  const diagnostic = verifierDiagnostic(result);
  expect(result.status, diagnostic).toBe(0);
  expect(result.output, diagnostic).toMatchObject({
    schemaVersion: "1.0.0",
    kind: "Phase1ReceiptVerificationResult",
    result: "PASS",
    errors: [],
  });
}

export function expectVerifierFailure(expect, result, expectedPattern) {
  const diagnostic = verifierDiagnostic(result);
  expect(result.status, diagnostic).toBe(1);
  expect(result.output, diagnostic).toMatchObject({
    schemaVersion: "1.0.0",
    kind: "Phase1ReceiptVerificationResult",
    result: "FAIL",
  });
  expect(result.output.errors.length, diagnostic).toBeGreaterThan(0);
  const searchable = result.output.errors
    .map(({ code, message, path }) => [code, message, path].filter(Boolean).join(" "))
    .join("\n");
  expect(searchable, diagnostic).toMatch(expectedPattern);
}
