import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  checkRequestedPaths,
  inspectRequest,
} from "../../../scripts/toolchain/check-lf-c1-scope-request.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const request = JSON.parse(
  readFileSync(
    new URL("../../../operations/phase-1/evidence/o01/lf-c1-entry-request.json", import.meta.url),
    "utf8",
  ),
);

describe("LF-C1 scope request is never entry authorization", () => {
  test("covers the pinned document's exact 54 paths and eighteen verification requirements", () => {
    const report = inspectRequest(request, request.writeScope.allowedChangedPaths);
    expect(report.requestValidation).toBe("PASS");
    expect(report.range.requestedPaths).toBe(54);
    expect(report.verificationSteps).toBe(18);
    expect(report.existingDispatcher.error).toBe("UNKNOWN_OPERATION: LF-C1");
    expect(report.p1O02LearningDenial.length).toBeGreaterThan(0);
    expect(report.codeStartAuthorized).toBe(false);
    expect(report.approvedMain).toBeNull();
    expect(report.decision).toBe("BLOCKED");
  });

  test.each([
    ["packages/learning/src/extra.ts"],
    ["packages/Learning/src/index.ts"],
    ["packages/learning/**"],
    ["../packages/learning/src/index.ts"],
    ["/packages/learning/src/index.ts"],
    ["packages\\learning\\src\\index.ts"],
    ["packages//learning/src/index.ts"],
    ["packages/learning/src/index.ts", "packages/learning/src/index.ts"],
    ["operations/phase-1/authority-lock.json"],
    ["scripts/toolchain/verify-scope.mjs"],
    ["packages/contracts/src/canonical-json.ts"],
    ["docs/reviews/learning-feedback/lf-c1-independent-verification.md"],
    ["docs/decisions/ADR-0002-node-state-machine.md"],
    [],
  ])("rejects unsafe, duplicate, foreign-owner or unrequested path set %j", (...paths) => {
    expect(() => checkRequestedPaths(request, paths)).toThrow();
  });

  test("cannot extend the request with a path absent from the immutable LF document", () => {
    const changed = globalThis.structuredClone(request);
    changed.writeScope.allowedChangedPaths.push("packages/learning/src/extra.ts");
    changed.writeScope.allowedChangedPaths.sort();
    expect(() => inspectRequest(changed, changed.writeScope.allowedChangedPaths)).toThrow(
      "SCOPE_DIFFERS",
    );
  });

  test("cannot remove a VerificationPlan obligation or counterfeit an approval", () => {
    const changed = globalThis.structuredClone(request);
    changed.verificationPlan.steps.pop();
    expect(() => inspectRequest(changed, changed.writeScope.allowedChangedPaths)).toThrow(
      "VERIFICATION_PLAN_DIFFERS",
    );
    changed.codeStartAuthorized = true;
    expect(() => checkRequestedPaths(changed, changed.writeScope.allowedChangedPaths)).toThrow(
      "CANNOT_GRANT_AUTHORITY",
    );
  });

  test("ordinary CLI refuses entry even for the full requested range", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/toolchain/check-lf-c1-scope-request.mjs"],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).decision).toBe("BLOCKED");
  });

  test("real unchanged dispatcher also refuses LF-C1 through its normal CLI", () => {
    const subject = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const result = spawnSync(
      process.execPath,
      [
        "scripts/toolchain/verify-scope.mjs",
        "--operation",
        "LF-C1",
        "--base",
        request.observedMain.commit,
        "--head",
        subject,
      ],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr).error).toBe("UNKNOWN_OPERATION: LF-C1");
  });
});
