import { appendFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import {
  BASELINE_COMMIT,
  INDEPENDENT_RECEIPT_PATH,
  RECEIPT_PATH,
  cloneJson,
  evidenceByStep,
  expectVerifierFailure,
  expectVerifierPass,
  git,
  makeExternalJson,
  makeReceiptFixture,
  materializeReceiptMutation,
  operationIds,
  removeTemporaryReceipts,
  replaceWithSymlink,
  restoreCanonicalFixture,
  runReceiptVerifier,
  stepIds,
  writeAdversarialEvidence,
} from "./helpers.mjs";

let fixture;

vi.setConfig({ hookTimeout: 60_000, testTimeout: 30_000 });

beforeAll(async () => {
  fixture = await makeReceiptFixture();
});

beforeEach(async () => {
  await restoreCanonicalFixture(fixture);
});

afterAll(removeTemporaryReceipts);

function verifyCanonical(overrides = {}) {
  return runReceiptVerifier({
    receiptPath: fixture.receiptPath,
    independentReceiptPath: fixture.independentReceiptPath,
    fixtureRepository: fixture.fixtureRepository,
    ...overrides,
  });
}

async function verifyReceiptMutation(mutate, expectedPattern) {
  await materializeReceiptMutation(fixture, { mutateReceipt: mutate });
  expectVerifierFailure(expect, verifyCanonical(), expectedPattern);
}

async function verifyIndependentMutation(mutate, expectedPattern) {
  await materializeReceiptMutation(fixture, { mutateIndependentReceipt: mutate });
  expectVerifierFailure(expect, verifyCanonical(), expectedPattern);
}

describe("Phase 1 receipt independent-review contract", () => {
  test("accepts canonical commit A plus direct receipt-only commit B", () => {
    expect(git(fixture.fixtureRepository, "rev-parse", "HEAD^")).toBe(fixture.implementationCommit);
    expect(
      git(
        fixture.fixtureRepository,
        "diff",
        "--name-only",
        fixture.implementationCommit,
        fixture.canonicalReceiptCommit,
      )
        .split(/\r?\n/u)
        .filter(Boolean)
        .sort(),
    ).toEqual(
      [
        RECEIPT_PATH,
        INDEPENDENT_RECEIPT_PATH,
        "operations/phase-1/evidence/o09/p1-v10-integrated-gate.json",
        "operations/phase-1/executions/p1-o09-integrated-gate.json",
      ].sort(),
    );
    expectVerifierPass(expect, verifyCanonical());
  });

  test("binds exact frozen operation and verification identities", () => {
    expect(fixture.receipt.suboperations.map(({ operationId }) => operationId).sort()).toEqual(
      operationIds,
    );
    expect(fixture.receipt.verification.executions.map(({ stepId }) => stepId).sort()).toEqual(
      stepIds,
    );
  });

  test.each([
    ["external implementation receipt", "implementation-external.json", "receipt"],
    ["external independent receipt", "independent-external.json", "independent"],
  ])("rejects a noncanonical %s", async (_label, name, kind) => {
    const value = kind === "receipt" ? fixture.receipt : fixture.independentReceipt;
    const externalPath = await makeExternalJson(fixture, name, value);
    expectVerifierFailure(
      expect,
      verifyCanonical(
        kind === "receipt"
          ? { receiptPath: externalPath }
          : { independentReceiptPath: externalPath },
      ),
      /(?:NON_CANONICAL|CANONICAL|RECEIPT_PATH|outside)/i,
    );
  });

  test.each([
    ["implementation receipt", "receiptPath", "IMPLEMENTATION-RECEIPT.json"],
    ["independent receipt", "independentReceiptPath", "INDEPENDENT-VERIFICATION-RECEIPT.json"],
  ])("rejects a case-aliased %s path", (_label, option, leaf) => {
    const canonical =
      option === "receiptPath" ? fixture.receiptPath : fixture.independentReceiptPath;
    const aliased = join(dirname(canonical), leaf);
    expectVerifierFailure(
      expect,
      verifyCanonical({ [option]: aliased }),
      /(?:NON_CANONICAL|CANONICAL|RECEIPT_PATH|INVALID_JSON)/i,
    );
  });

  test("rejects a symlinked canonical implementation receipt", async () => {
    const externalPath = await makeExternalJson(fixture, "symlink-target.json", fixture.receipt);
    try {
      await replaceWithSymlink(fixture.receiptPath, externalPath);
    } catch (error) {
      if (error?.code !== "EPERM") throw error;
      // Windows without Developer Mode cannot create a file symlink. Supplying the
      // same external target still exercises the mandatory canonical-file denial.
      expectVerifierFailure(
        expect,
        verifyCanonical({ receiptPath: externalPath }),
        /(?:NON_CANONICAL|CANONICAL|RECEIPT_PATH|outside)/i,
      );
      return;
    }
    expectVerifierFailure(
      expect,
      verifyCanonical(),
      /(?:SYMLINK|NON_CANONICAL|CANONICAL|RECEIPT_PATH)/i,
    );
  });

  test("rejects a receipt commit B that is not the direct child of commit A", async () => {
    await materializeReceiptMutation(fixture, { intermediateCommit: true });
    expectVerifierFailure(expect, verifyCanonical(), /(?:DIRECT|PARENT|TOPOLOGY|COMMIT_B)/i);
  });

  test("rejects verifier worktree drift from implementation commit A", async () => {
    await appendFile(
      join(fixture.fixtureRepository, "scripts/verify-phase-1/receipt-verifier.mjs"),
      "\n// adversarial worktree drift\n",
      "utf8",
    );
    expectVerifierFailure(expect, verifyCanonical(), /(?:TRUST_ASSET_WORKTREE_DRIFT|WORKTREE)/i);
  });

  test("rejects verifier HEAD drift from implementation commit A", async () => {
    await appendFile(
      join(fixture.fixtureRepository, "scripts/verify-phase-1/receipt-verifier.mjs"),
      "\n// adversarial HEAD drift\n",
      "utf8",
    );
    git(fixture.fixtureRepository, "add", "scripts/verify-phase-1/receipt-verifier.mjs");
    git(fixture.fixtureRepository, "commit", "--amend", "--quiet", "--no-edit");
    expectVerifierFailure(
      expect,
      verifyCanonical(),
      /(?:TRUST_ASSET_HEAD_DRIFT|TRUST_ASSET_WORKTREE_DRIFT|RECEIPT_COMMIT_SCOPE|HEAD)/i,
    );
  });

  test("rejects authority trust-asset worktree drift", async () => {
    await appendFile(
      join(fixture.fixtureRepository, "operations/phase-1/verification-plan.json"),
      " ",
      "utf8",
    );
    expectVerifierFailure(
      expect,
      verifyCanonical(),
      /(?:TRUST_ASSET_WORKTREE_DRIFT|VERIFICATION_PLAN_HASH_MISMATCH|WORKTREE)/i,
    );
  });

  test("accepts a Git-clean CRLF trust asset without platform-dependent drift", async () => {
    const eol = git(
      fixture.fixtureRepository,
      "ls-files",
      "--eol",
      "operations/phase-1/verification-plan.json",
    );
    expect(eol).toMatch(/i\/lf\s+w\/crlf\s+/u);
    expect(git(fixture.fixtureRepository, "status", "--porcelain")).toBe("");
    expectVerifierPass(expect, verifyCanonical());
  });

  test.each([
    [
      "before the Phase 1 baseline",
      (repository) => git(repository, "rev-parse", `${BASELINE_COMMIT}^`),
    ],
    ["the receipt-bearing commit after A", (repository) => git(repository, "rev-parse", "HEAD")],
    ["an arbitrary existing ancestor", () => BASELINE_COMMIT],
  ])("rejects %s as an operation commitRef", async (_label, commit) => {
    await verifyReceiptMutation((candidate) => {
      candidate.suboperations[4].commitRefs = [commit(fixture.fixtureRepository)];
    }, /(?:COMMIT_REF|COMMIT|BIND|EVIDENCE)/i);
  });

  test("rejects a valid qualified commit plus an unbound baseline ancestor", async () => {
    await verifyReceiptMutation((candidate) => {
      candidate.suboperations[4].commitRefs.push(BASELINE_COMMIT);
    }, /(?:OPERATION_COMMIT_REF_EVIDENCE_MISMATCH|COMMIT_REF|EVIDENCE)/i);
  });

  test("rejects a valid qualified commit plus another operation's qualified commit", async () => {
    await verifyReceiptMutation((candidate) => {
      candidate.suboperations[4].commitRefs.push(candidate.suboperations[3].commitRefs[0]);
    }, /(?:OPERATION_COMMIT_REF_EVIDENCE_MISMATCH|COMMIT_REF|EVIDENCE)/i);
  });

  test.each([
    ["missing", (candidate) => candidate.suboperations.pop()],
    [
      "duplicate",
      (candidate) => {
        candidate.suboperations.at(-1).operationId = candidate.suboperations[0].operationId;
      },
    ],
  ])("fails closed for a %s operation", async (_label, mutate) => {
    await verifyReceiptMutation(mutate, /(?:OPERATION|SCHEMA|suboperations)/i);
  });

  test.each([
    ["missing", (candidate) => candidate.verification.executions.pop()],
    [
      "duplicate",
      (candidate) => {
        candidate.verification.executions.at(-1).stepId =
          candidate.verification.executions[0].stepId;
      },
    ],
  ])("fails closed for a %s verification step", async (_label, mutate) => {
    await verifyReceiptMutation(mutate, /(?:VERIFICATION|STEP|SCHEMA|executions)/i);
  });

  test.each(["FAIL", "BLOCKED", "UNAVAILABLE", "INCONCLUSIVE", "NOT_RUN", "SKIPPED"])(
    "does not coerce an explicit %s execution into PASS",
    async (result) => {
      await verifyReceiptMutation((candidate) => {
        candidate.verification.executions[3].result = result;
      }, /(?:PASS|RESULT|SCHEMA|verification)/i);
    },
  );

  test.each(["PARTIAL", "BLOCKED", "NOT_STARTED"])("blocks a %s operation", async (status) => {
    await verifyReceiptMutation((candidate) => {
      candidate.suboperations[4].status = status;
    }, /(?:IMPLEMENTED|STATUS|SCHEMA|suboperations)/i);
  });

  test("rejects unrelated Evidence even when the file exists and says PASS", async () => {
    await materializeReceiptMutation(fixture, {
      mutateReceipt: async (candidate) => {
        const { relativePath } = await writeAdversarialEvidence(fixture, {
          schemaVersion: "1.0.0",
          verificationStepId: "P1-V10-INTEGRATED-GATE",
          results: [{ evidenceType: "UnrelatedEvidence", result: "PASS" }],
        });
        candidate.verification.executions.at(-1).evidenceRefs = [relativePath];
      },
    });
    expectVerifierFailure(expect, verifyCanonical(), /(?:EVIDENCE_TYPE|EVIDENCE|EXPECTED)/i);
  });

  test("rejects referenced Evidence with a non-PASS semantic result", async () => {
    await materializeReceiptMutation(fixture, {
      mutateEvidence: (candidate) => {
        candidate.results[1].result = "FAIL";
      },
    });
    expectVerifierFailure(expect, verifyCanonical(), /(?:EVIDENCE.*PASS|NON_PASS|RESULT)/i);
  });

  test.each([
    ["PASS plus FAIL", "FAIL"],
    ["PASS plus BLOCKED", "BLOCKED"],
    ["duplicate PASS", "PASS"],
  ])("rejects duplicate %s claims for one expected Evidence type", async (_label, result) => {
    await materializeReceiptMutation(fixture, {
      mutateEvidence: (candidate) => {
        candidate.results.push({
          evidenceType: candidate.results[0].evidenceType,
          result,
        });
      },
    });
    expectVerifierFailure(
      expect,
      verifyCanonical(),
      /(?:DUPLICATE_EVIDENCE_CLAIM|NON_PASS_EVIDENCE_CLAIM|exactly one)/i,
    );
  });

  test("rejects a duplicate expected claim split across top-level and results", async () => {
    await materializeReceiptMutation(fixture, {
      mutateEvidence: (candidate) => {
        candidate.evidenceType = candidate.results[0].evidenceType;
        candidate.result = "PASS";
      },
    });
    expectVerifierFailure(
      expect,
      verifyCanonical(),
      /(?:DUPLICATE_EVIDENCE_CLAIM|UNTRUSTED_EVIDENCE_CLAIM_LOCATION|exactly one)/i,
    );
  });

  test("rejects Evidence with an empty formal results array", async () => {
    await materializeReceiptMutation(fixture, {
      mutateEvidence: (candidate) => {
        candidate.results = [];
      },
    });
    expectVerifierFailure(
      expect,
      verifyCanonical(),
      /(?:EVIDENCE_TYPE_OR_RESULT_MISMATCH|lacks PASS|FORMAL_EVIDENCE)/i,
    );
  });

  test("does not accept forged PASS claims from an untrusted nested object", async () => {
    await materializeReceiptMutation(fixture, {
      mutateEvidence: (candidate) => {
        candidate.untrusted = { claims: cloneJson(candidate.results) };
        candidate.results = [];
      },
    });
    expectVerifierFailure(
      expect,
      verifyCanonical(),
      /(?:EVIDENCE_TYPE_OR_RESULT_MISMATCH|lacks PASS|FORMAL_EVIDENCE)/i,
    );
  });

  test("rejects referenced Evidence whose evidenceType does not match the plan", async () => {
    await materializeReceiptMutation(fixture, {
      mutateEvidence: (candidate) => {
        candidate.results[0].evidenceType = "SchemaMetaValidationResult";
      },
    });
    expectVerifierFailure(expect, verifyCanonical(), /(?:EVIDENCE_TYPE|EVIDENCE|EXPECTED)/i);
  });

  test("rejects referenced Evidence whose step identity does not match the execution", async () => {
    await materializeReceiptMutation(fixture, {
      mutateEvidence: (candidate) => {
        candidate.verificationStepId = "P1-V09-PACKAGING";
      },
    });
    expectVerifierFailure(expect, verifyCanonical(), /(?:STEP_ID|STEP|EVIDENCE)/i);
  });

  test.each(["placeholder", "done", "operations/phase-1/evidence/o09/arbitrary.json"])(
    "rejects arbitrary or placeholder suboperation output %s",
    async (output) => {
      await verifyReceiptMutation((candidate) => {
        candidate.suboperations.at(-1).outputs = [output];
      }, /(?:REQUIRED_OUTPUT|OUTPUT|PLACEHOLDER)/i);
    },
  );

  test("rejects a missing evidence reference", async () => {
    await verifyReceiptMutation((candidate) => {
      candidate.verification.executions[0].evidenceRefs = [
        "operations/phase-1/evidence/o09/does-not-exist.json",
      ];
    }, /(?:EVIDENCE|REFERENCE|does-not-exist)/i);
  });

  test("rejects an evidence reference that escapes the repository", async () => {
    await verifyReceiptMutation((candidate) => {
      candidate.evidenceRefs = ["../outside-repository.json"];
    }, /(?:EVIDENCE|REFERENCE|PATH|REPOSITORY)/i);
  });

  test.each([
    ["authority lock", (candidate) => (candidate.authorityLockHash = "f".repeat(64))],
    ["verification plan", (candidate) => (candidate.verification.planHash = "f".repeat(64))],
  ])("rejects %s hash drift", async (_label, mutate) => {
    await verifyReceiptMutation(mutate, /(?:AUTHORITY|PLAN|HASH|DRIFT)/i);
  });

  test("implementation agent cannot issue the independent Gate", async () => {
    await verifyIndependentMutation((candidate) => {
      candidate.verifiedBy.role = "IMPLEMENTATION_AGENT";
      candidate.verifiedBy.actorId = fixture.receipt.declaredBy.actorId;
    }, /(?:INDEPENDENT|VERIFIER|ROLE|SCHEMA|verifiedBy)/i);
  });

  test("renaming the implementation actor does not make it independent", async () => {
    await verifyIndependentMutation((candidate) => {
      candidate.verifiedBy.actorId = fixture.receipt.declaredBy.actorId;
    }, /(?:INDEPENDENT|VERIFIER|ACTOR|IDENTITY)/i);
  });

  test("the independent pass must remain read-only and remediation-free", async () => {
    await verifyIndependentMutation((candidate) => {
      candidate.readOnlyVerification = false;
      candidate.remediationPerformed = true;
    }, /(?:READ.?ONLY|REMEDIATION|SCHEMA)/i);
  });

  test("the independent Gate binds exact canonical implementation-receipt bytes", async () => {
    await materializeReceiptMutation(fixture, {
      mutateIndependentReceipt: (candidate) => {
        candidate.implementationReceiptHash = "e".repeat(64);
      },
    });
    // materialize refreshes normal independent hashes after receipt mutations; force
    // this negative drift in the canonical file and bind it at HEAD.
    const independent = cloneJson(fixture.independentReceipt);
    independent.implementationReceiptHash = "e".repeat(64);
    const path = fixture.independentReceiptPath;
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(path, `${JSON.stringify(independent, null, 2)}\n`, "utf8"),
    );
    git(fixture.fixtureRepository, "add", INDEPENDENT_RECEIPT_PATH);
    git(fixture.fixtureRepository, "commit", "--amend", "--quiet", "--no-edit");
    expectVerifierFailure(expect, verifyCanonical(), /(?:RECEIPT|HASH|BIND)/i);
  });

  test.each(["FAIL", "BLOCKED", "INCONCLUSIVE"])(
    "the independent Gate cannot PASS with a %s step",
    async (result) => {
      await verifyIndependentMutation((candidate) => {
        candidate.gateDecision = "PASS";
        candidate.stepResults[6].result = result;
      }, /(?:GATE|PASS|RESULT|SCHEMA|stepResults)/i);
    },
  );

  test("the positive fixture points every step at real semantic Evidence", async () => {
    for (const execution of fixture.receipt.verification.executions) {
      expect(execution.evidenceRefs).toEqual([evidenceByStep.get(execution.stepId)]);
      const evidencePath = join(fixture.fixtureRepository, ...execution.evidenceRefs[0].split("/"));
      expect((await readFile(evidencePath)).length).toBeGreaterThan(0);
    }
  });
});
