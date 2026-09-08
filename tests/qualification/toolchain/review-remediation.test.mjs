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
    adapted = {m.ROOT / p.relative_to(original): v for p, v in documents.items()}
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
