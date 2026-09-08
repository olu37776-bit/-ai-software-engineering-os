import { spawnSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

test("the unique required verify depends on all quality and packaging jobs, including failed jobs", async () => {
  const source = await readFile(
    resolve(root, ".github/workflows/m0-independent-verify.yml"),
    "utf8",
  );
  const verify = source.slice(source.indexOf("\n  verify:"));
  expect(source).toContain("uses: ./.github/workflows/quality.yml");
  expect(source).toContain("node scripts/toolchain/qualify-required-packaging.mjs");
  expect(verify).toContain("if: always()");
  expect(verify).toContain("needs: [required-quality, required-packaging]");
  for (const name of ["QUALITY", "PACKAGING"]) {
    expect(verify).toContain(`test "$${name}_RESULT" = "success"`);
  }
  expect(source).not.toContain("head_commit.message");
});

// The required aggregation job runs on Ubuntu. Execute its actual checked-in
// shell block with each possible dependency conclusion; do not reimplement it.
test.skipIf(process.platform === "win32")(
  "the actual required Gate shell rejects failed, cancelled, skipped and missing prerequisites",
  async () => {
    const source = await readFile(
      resolve(root, ".github/workflows/m0-independent-verify.yml"),
      "utf8",
    );
    const step = source.slice(
      source.indexOf("      - name: Require every qualification before accepting the subject"),
    );
    const block = step.match(/ {8}run: \|\n((?: {10}.*\n)+)/u);
    expect(block).not.toBeNull();
    const command = block[1].replace(/^ {10}/gmu, "");
    const execute = (quality, packaging) =>
      spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", command], {
        encoding: "utf8",
        env: { ...process.env, QUALITY_RESULT: quality, PACKAGING_RESULT: packaging },
      });
    const valid = execute("success", "success");
    expect(valid.error).toBeUndefined();
    expect(valid.status, valid.stderr).toBe(0);
    for (const result of ["failure", "cancelled", "skipped", "", "unavailable", "pending"]) {
      for (const values of [
        [result, "success"],
        ["success", result],
      ]) {
        const rejected = execute(...values);
        expect(rejected.error).toBeUndefined();
        expect(rejected.status).not.toBeNull();
        expect(rejected.status).not.toBe(0);
      }
    }
  },
);

test("the authority build restores runtime-loaded assets even with up-to-date TypeScript outputs", async () => {
  const asset = "packages/adapters/tool/windows-process-restricted";
  const output = resolve(root, asset, "dist/win32-bridge.ps1");
  await rm(output, { force: true });
  const { scripts } = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const result = spawnSync(scripts.build, { cwd: root, shell: true, encoding: "utf8" });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(await readFile(output)).toEqual(
    await readFile(resolve(root, asset, "src/win32-bridge.ps1")),
  );
});

test("CI evidence binds the checked-out subject and rejects a mismatching requested target", () => {
  const head = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).stdout.trim();
  const controller = "f".repeat(40);
  const execute = (target) =>
    spawnSync(process.execPath, ["scripts/toolchain/emit-ci-evidence.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_SHA: controller,
        TARGET_SHA: target,
        PHASE1_SCOPE_HEAD: head,
        POST_MERGE_QUALIFICATION_TARGET: head,
      },
    });
  const valid = execute(head);
  expect(valid.status, valid.stderr).toBe(0);
  expect(JSON.parse(valid.stdout)).toMatchObject({ commit: head, controllerCommit: controller });
  const invalid = execute(controller);
  expect(invalid.status).not.toBe(0);
  expect(invalid.stderr).toContain("EVIDENCE_SUBJECT_MISMATCH:TARGET_SHA");
});

test("M0 rejects an actual invalid implementation receipt instead of checking only its schema", () => {
  const code = `
import importlib.util, json, pathlib, tempfile
spec = importlib.util.spec_from_file_location("verifier", "scripts/governance/verify_m0.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
paths, documents = m.collect_documents()
_, registry = m.build_registry([p for p in paths if p.name.endswith(".schema.json")], documents)
original = m.ROOT
with tempfile.TemporaryDirectory() as directory:
    m.ROOT = pathlib.Path(directory)
    adapted = {m.ROOT / p.relative_to(original): v for p, v in documents.items() if p.name.endswith(".schema.json")}
    path = m.ROOT / "operations/phase-1/implementation-receipt.json"
    path.parent.mkdir(parents=True)
    assert m.verify_receipt_guards(adapted, registry)["implementationReceipt"] == "NOT_YET_CREATED"
    for value in ({}, {"implementationDeclaration": "VERIFIED"}, m.make_incomplete_receipt()):
        path.write_text(json.dumps(value), encoding="utf-8")
        try:
            m.verify_receipt_guards(adapted, registry)
        except AssertionError as error:
            assert "Invalid actual receipt" in str(error), str(error)
        else:
            raise AssertionError("Invalid repository receipt accepted")
`;
  const result = spawnSync("python", ["-c", code], { cwd: root, encoding: "utf8" });
  expect(result.status, result.stdout + result.stderr).toBe(0);
});

test("M0 rejects a schema-valid self-declared integrated PASS without independent evidence", () => {
  const code = `
import importlib.util, json, pathlib, subprocess, tempfile
spec = importlib.util.spec_from_file_location("verifier", "scripts/governance/verify_m0.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
paths, documents = m.collect_documents()
_, registry = m.build_registry([p for p in paths if p.name.endswith(".schema.json")], documents)
original = m.ROOT
head = m.run_git("rev-parse", "HEAD")
with tempfile.TemporaryDirectory() as directory:
    subprocess.run(["git", "clone", "--shared", "--no-checkout", str(original), directory], check=True, capture_output=True)
    subprocess.run(["git", "-C", directory, "checkout", "--detach", head], check=True, capture_output=True)
    m.ROOT = pathlib.Path(directory)
    adapted = {m.ROOT / p.relative_to(original): v for p, v in documents.items() if p.name.endswith(".schema.json")}
    path = m.ROOT / "operations/phase-1/implementation-receipt.json"
    value = m.make_incomplete_receipt()
    value["baselineCommit"] = value["implementationCommit"] = head
    value["authorityLockHash"] = m.authority_text_sha256(m.ROOT / "operations/phase-1/authority-lock.json")
    value["verification"]["planHash"] = m.authority_text_sha256(m.ROOT / "operations/phase-1/verification-plan.json")
    value["verification"]["planId"] = m.load_json(m.ROOT / "operations/phase-1/verification-plan.json")["planId"]
    value["implementationDeclaration"] = "PARTIAL"
    path.write_text(json.dumps(value), encoding="utf-8")
    assert m.verify_receipt_guards(adapted, registry)["implementationReceipt"] == "VALID"
    value["implementationDeclaration"] = "IMPLEMENTED"
    value["evidenceRefs"] = ["README.md"]
    for operation in value["suboperations"]:
        operation.update(status="IMPLEMENTED", commitRefs=[head], outputs=["README.md"])
    for execution in value["verification"]["executions"]:
        execution.update(result="PASS", evidenceRefs=["README.md"])
    value["verification"]["overallResult"] = "PASS"
    for obligation in value["qualificationObligations"]:
        obligation.update(result="PASS", evidenceRefs=["README.md"])
    path.write_text(json.dumps(value), encoding="utf-8")
    try:
        m.verify_receipt_guards(adapted, registry)
    except AssertionError as error:
        assert "P1-V10 PASS requires a matching independent PASS receipt" in str(error), str(error)
    else:
        raise AssertionError("Self-declared integrated PASS accepted")
`;
  const result = spawnSync("python", ["-c", code], { cwd: root, encoding: "utf8" });
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 30_000);
