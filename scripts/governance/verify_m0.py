#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import datetime as dt
import fnmatch
import hashlib
import json
import pathlib
import re
import subprocess
import sys
from collections import defaultdict, deque
from typing import Any, Iterable

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = pathlib.Path(__file__).resolve().parents[2]
FORMAT = FormatChecker()

def load_json(path: pathlib.Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))

def write_json(path: pathlib.Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def canonical_json(value: Any) -> bytes:
    def reject_float(v: Any) -> None:
        if isinstance(v, float):
            raise AssertionError("M0 fixture canonical JSON contains floating-point value")
        if isinstance(v, dict):
            for item in v.values():
                reject_float(item)
        elif isinstance(v, list):
            for item in v:
                reject_float(item)
    reject_float(value)
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")

def pointer(path: Iterable[Any]) -> str:
    tokens = []
    for value in path:
        token = str(value).replace("~", "~0").replace("/", "~1")
        tokens.append(token)
    return "/" + "/".join(tokens) if tokens else ""

def walk(value: Any) -> Iterable[Any]:
    yield value
    if isinstance(value, dict):
        for item in value.values():
            yield from walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)

def walk_dicts(value: Any) -> Iterable[dict[str, Any]]:
    for item in walk(value):
        if isinstance(item, dict):
            yield item

def find_refs(value: Any) -> Iterable[str]:
    if isinstance(value, dict):
        if isinstance(value.get("$ref"), str):
            yield value["$ref"]
        for item in value.values():
            yield from find_refs(item)
    elif isinstance(value, list):
        for item in value:
            yield from find_refs(item)

def json_pointer(document: Any, ref: str) -> Any:
    raw = ref[1:] if ref.startswith("#") else ref
    if raw == "":
        return document
    if not raw.startswith("/"):
        raise KeyError(ref)
    value = document
    for token in raw[1:].split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        value = value[int(token)] if isinstance(value, list) else value[token]
    return value

def run_git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=ROOT, text=True, check=True,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    return result.stdout.strip()

def check_dag(ids: set[str], deps: dict[str, list[str]], label: str) -> None:
    unknown = sorted({dep for values in deps.values() for dep in values if dep not in ids})
    if unknown:
        raise AssertionError(f"{label}: unknown dependencies {unknown}")
    indegree = {item: 0 for item in ids}
    outgoing: dict[str, list[str]] = defaultdict(list)
    for item, values in deps.items():
        for dep in values:
            indegree[item] += 1
            outgoing[dep].append(item)
    queue = deque(sorted(item for item, degree in indegree.items() if degree == 0))
    seen = []
    while queue:
        item = queue.popleft()
        seen.append(item)
        for nxt in outgoing[item]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    if len(seen) != len(ids):
        raise AssertionError(f"{label}: cycle detected")

def pattern_covers(parent: str, child: str) -> bool:
    if parent == child:
        return True
    if parent.endswith("/**"):
        prefix = parent[:-3].rstrip("/")
        child_prefix = child[:-3].rstrip("/") if child.endswith("/**") else child
        return child_prefix == prefix or child_prefix.startswith(prefix + "/")
    if not any(ch in parent for ch in "*?["):
        return False
    samples = [
        child.replace("/**", "/__probe__/nested.txt"),
        child.replace("*", "__probe__"),
    ]
    return any(fnmatch.fnmatch(sample, parent) for sample in samples)

def path_matches(pattern: str, path: str) -> bool:
    if pattern.endswith("/**"):
        prefix = pattern[:-3].rstrip("/")
        return path == prefix or path.startswith(prefix + "/")
    return fnmatch.fnmatch(path, pattern)

class Audit:
    def __init__(self) -> None:
        self.checks: list[dict[str, Any]] = []
        self.details: dict[str, Any] = {}

    def check(self, check_id: str, fn) -> Any:
        try:
            detail = fn()
            self.checks.append({"id": check_id, "result": "PASS", "detail": detail})
            self.details[check_id] = detail
            return detail
        except Exception as exc:
            self.checks.append({
                "id": check_id,
                "result": "FAIL",
                "detail": f"{type(exc).__name__}: {exc}",
            })
            raise

def collect_documents() -> tuple[list[pathlib.Path], dict[pathlib.Path, Any]]:
    roots = [ROOT / "packages/contracts", ROOT / "operations/phase-1"]
    files: list[pathlib.Path] = []
    for base in roots:
        files.extend(path for path in base.rglob("*.json") if path.is_file())
    files = sorted(set(files))
    documents = {path: load_json(path) for path in files}
    return files, documents

def build_registry(
    schema_paths: list[pathlib.Path],
    documents: dict[pathlib.Path, Any],
) -> tuple[dict[str, pathlib.Path], Registry]:
    ids: dict[str, pathlib.Path] = {}
    registry = Registry()
    for path in schema_paths:
        schema = documents[path]
        sid = schema.get("$id")
        if not isinstance(sid, str) or not sid:
            raise AssertionError(f"Schema missing $id: {path.relative_to(ROOT)}")
        if sid in ids:
            raise AssertionError(f"Duplicate $id {sid}: {ids[sid]} and {path}")
        Draft202012Validator.check_schema(schema)
        ids[sid] = path
        registry = registry.with_resource(sid, Resource.from_contents(schema))
    return ids, registry

def validate_instance(schema: dict[str, Any], instance: Any, registry: Registry):
    return list(Draft202012Validator(schema, registry=registry, format_checker=FORMAT).iter_errors(instance))

def resolve_refs(
    ids: dict[str, pathlib.Path],
    documents: dict[pathlib.Path, Any],
    schema_paths: list[pathlib.Path],
) -> int:
    count = 0
    for path in schema_paths:
        schema = documents[path]
        for ref in find_refs(schema):
            count += 1
            if ref.startswith("#"):
                json_pointer(schema, ref)
                continue
            target, marker, fragment = ref.partition("#")
            if target not in ids:
                raise AssertionError(f"Unresolved $ref {ref} in {path.relative_to(ROOT)}")
            if marker and fragment:
                json_pointer(documents[ids[target]], "#" + fragment)
    return count

def verify_registry(ids: dict[str, pathlib.Path], documents: dict[pathlib.Path, Any], registry: Registry) -> dict[str, int]:
    path = ROOT / "packages/contracts/schema-registry.json"
    schema_path = ROOT / "packages/contracts/schemas/meta/schema-registry.schema.json"
    value = documents[path]
    errors = validate_instance(documents[schema_path], value, registry)
    if errors:
        raise AssertionError(f"schema-registry.json invalid: {errors[0].message}")
    entries = value["schemas"]
    by_id: dict[str, dict[str, Any]] = {}
    by_path: dict[str, dict[str, Any]] = {}
    for entry in entries:
        sid = entry["schemaId"]
        rel = entry["authorityPath"]
        if sid in by_id:
            raise AssertionError(f"Registry duplicate schemaId: {sid}")
        if rel in by_path:
            raise AssertionError(f"Registry duplicate authorityPath: {rel}")
        file_path = ROOT / rel
        if not file_path.is_file():
            raise AssertionError(f"Registry missing path: {rel}")
        if sid not in ids or ids[sid] != file_path:
            raise AssertionError(f"Registry ID/path mismatch: {sid} -> {rel}")
        if entry["sha256"] != sha256(file_path.read_bytes()):
            raise AssertionError(f"Registry hash mismatch: {rel}")
        by_id[sid] = entry
        by_path[rel] = entry
    expected_paths = {path.relative_to(ROOT).as_posix() for path in ids.values()}
    if set(by_path) != expected_paths:
        missing = sorted(expected_paths - set(by_path))
        extra = sorted(set(by_path) - expected_paths)
        raise AssertionError(f"Registry coverage mismatch missing={missing} extra={extra}")
    return {"schemas": len(entries), "paths": len(by_path)}

def verify_inventories(ids: dict[str, pathlib.Path], documents: dict[pathlib.Path, Any], registry: Registry) -> dict[str, int]:
    active_path = ROOT / "packages/contracts/schema-inventory.json"
    active_schema_path = ROOT / "packages/contracts/schemas/meta/schema-inventory.schema.json"
    planned_path = ROOT / "packages/contracts/planned-contracts.json"
    planned_schema_path = ROOT / "packages/contracts/schemas/meta/planned-contract-inventory.schema.json"
    active = documents[active_path]
    planned = documents[planned_path]
    errors = validate_instance(documents[active_schema_path], active, registry)
    if errors:
        raise AssertionError(f"Active inventory invalid: {errors[0].message} at {pointer(errors[0].path)}")
    errors = validate_instance(documents[planned_schema_path], planned, registry)
    if errors:
        raise AssertionError(f"Planned inventory invalid: {errors[0].message} at {pointer(errors[0].path)}")
    active_ids: set[str] = set()
    active_paths: set[str] = set()
    for entry in active["contracts"]:
        cid = entry["contractId"]
        rel = entry["authorityPath"]
        sid = entry["schemaId"]
        if cid in active_ids:
            raise AssertionError(f"Active duplicate contractId: {cid}")
        if rel in active_paths:
            raise AssertionError(f"Active duplicate authorityPath: {rel}")
        path = ROOT / rel
        if not path.is_file():
            raise AssertionError(f"Active authority path missing: {rel}")
        if sid not in ids or ids[sid] != path:
            raise AssertionError(f"Active schema ID/path mismatch: {sid} -> {rel}")
        if entry["sha256"] != sha256(path.read_bytes()):
            raise AssertionError(f"Active hash mismatch: {rel}")
        active_ids.add(cid)
        active_paths.add(rel)
    planned_ids = [entry["contractId"] for entry in planned["contracts"]]
    if len(planned_ids) != len(set(planned_ids)):
        raise AssertionError("Planned inventory contains duplicate contract IDs")
    overlap = active_ids.intersection(planned_ids)
    if overlap:
        raise AssertionError(f"Active/planned Contract overlap: {sorted(overlap)}")
    return {"active": len(active_ids), "planned": len(planned_ids)}

def find_artifact(ref: dict[str, Any]) -> pathlib.Path:
    logical = ref.get("logicalName")
    if not isinstance(logical, str):
        raise AssertionError("ArtifactRef lacks logicalName required by M0 fixture verification")
    matches = list((ROOT / "packages/contracts/examples/first-slice/artifacts").glob(logical))
    if len(matches) != 1:
        raise AssertionError(f"Artifact fixture not unique or missing: {logical}")
    return matches[0]

def verify_semantic_hashes(instance: Any, ids: dict[str, pathlib.Path], documents: dict[pathlib.Path, Any], registry: Registry) -> dict[str, int]:
    counts = {"payload": 0, "schema": 0, "artifact": 0}
    for item in walk_dicts(instance):
        if all(key in item for key in ("payloadSchema", "payloadHash", "payload")):
            ref = item["payloadSchema"]
            sid = ref.get("schemaId")
            if sid not in ids:
                raise AssertionError(f"Unknown payload SchemaRef: {sid}")
            schema_path = ids[sid]
            if ref.get("schemaHash") != sha256(schema_path.read_bytes()):
                raise AssertionError(f"SchemaRef hash mismatch: {sid}")
            if item["payloadHash"] != sha256(canonical_json(item["payload"])):
                raise AssertionError(f"payloadHash mismatch: {sid}")
            payload_errors = validate_instance(documents[schema_path], item["payload"], registry)
            if payload_errors:
                raise AssertionError(f"Envelope payload invalid for {sid}: {payload_errors[0].message}")
            counts["schema"] += 1
            counts["payload"] += 1
        if {"schemaId", "schemaVersion", "schemaHash"}.issubset(item) and "payloadSchema" not in item:
            sid = item["schemaId"]
            if sid in ids:
                if item["schemaHash"] != sha256(ids[sid].read_bytes()):
                    raise AssertionError(f"Standalone SchemaRef hash mismatch: {sid}")
                counts["schema"] += 1
        if {"artifactId", "sha256", "mediaType", "sizeBytes", "sensitivity"}.issubset(item):
            artifact = find_artifact(item)
            data = artifact.read_bytes()
            if item["sha256"] != sha256(data):
                raise AssertionError(f"Artifact hash mismatch: {artifact}")
            if item["sizeBytes"] != len(data):
                raise AssertionError(f"Artifact size mismatch: {artifact}")
            counts["artifact"] += 1
        if "contentHash" in item and isinstance(item.get("contentRef"), dict):
            if item["contentHash"] != item["contentRef"].get("sha256"):
                raise AssertionError("Evidence contentHash differs from contentRef.sha256")
    return counts

def verify_examples(ids: dict[str, pathlib.Path], documents: dict[pathlib.Path, Any], registry: Registry) -> dict[str, int]:
    suite_path = ROOT / "packages/contracts/examples/first-slice/example-suite.json"
    suite_schema_path = ROOT / "packages/contracts/schemas/meta/example-suite.schema.json"
    suite = documents[suite_path]
    errors = validate_instance(documents[suite_schema_path], suite, registry)
    if errors:
        raise AssertionError(f"Example suite invalid: {errors[0].message} at {pointer(errors[0].path)}")
    coverage: dict[str, set[str]] = defaultdict(set)
    valid_count = invalid_count = 0
    semantic_counts = {"payload": 0, "schema": 0, "artifact": 0}
    for case in suite["cases"]:
        sid = case["schemaId"]
        if sid not in ids:
            raise AssertionError(f"Example references unknown schema: {sid}")
        instance_path = ROOT / case["instancePath"]
        if not instance_path.is_file():
            raise AssertionError(f"Example instance missing: {case['instancePath']}")
        instance = load_json(instance_path)
        case_errors = validate_instance(documents[ids[sid]], instance, registry)
        expected = case["expected"]
        if expected == "VALID":
            valid_count += 1
            if case_errors:
                error = case_errors[0]
                raise AssertionError(
                    f"Valid case {case['caseId']} failed: {error.validator} {error.message} at {pointer(error.path)}"
                )
            counts = verify_semantic_hashes(instance, ids, documents, registry)
            for key, value in counts.items():
                semantic_counts[key] += value
        else:
            invalid_count += 1
            if not case_errors:
                raise AssertionError(f"Invalid case unexpectedly passed: {case['caseId']}")
            expected_error = case["expectedError"]
            matched = [
                error for error in case_errors
                if error.validator == expected_error["keyword"]
                and pointer(error.path) == expected_error["instancePath"]
            ]
            if not matched:
                observed = sorted({(str(error.validator), pointer(error.path)) for error in case_errors})
                raise AssertionError(
                    f"Invalid case {case['caseId']} failed for wrong reason; "
                    f"expected {(expected_error['keyword'], expected_error['instancePath'])}, observed {observed}"
                )
        coverage[sid].add(expected)
    schema_registry = documents[ROOT / "packages/contracts/schema-registry.json"]
    required_ids = {
        entry["schemaId"] for entry in schema_registry["schemas"]
        if entry["examplesRequired"]
    }
    missing = sorted(sid for sid in required_ids if coverage[sid] != {"VALID", "INVALID"})
    if missing:
        raise AssertionError(f"Schemas lacking valid+invalid examples: {missing}")
    if semantic_counts["payload"] < 4 or semantic_counts["schema"] < 5 or semantic_counts["artifact"] < 5:
        raise AssertionError(f"Insufficient semantic hash fixtures: {semantic_counts}")
    return {
        "cases": len(suite["cases"]),
        "valid": valid_count,
        "invalid": invalid_count,
        **semantic_counts,
    }

def verify_no_placeholders(json_files: list[pathlib.Path]) -> int:
    repeated = re.compile(r"(?i)(?:sha256:)?([0-9a-f])\1{63}")
    count = 0
    for path in json_files:
        text = path.read_text(encoding="utf-8")
        if repeated.search(text) or re.search(r"(?i)TODO_HASH|PLACEHOLDER_HASH|deadbeef(?:deadbeef)+", text):
            raise AssertionError(f"Placeholder hash in {path.relative_to(ROOT)}")
        count += 1
    return count

def verify_governance(documents: dict[pathlib.Path, Any], ids: dict[str, pathlib.Path], registry: Registry) -> dict[str, Any]:
    op_path = ROOT / "operations/phase-1/operation.json"
    op_schema_path = ROOT / "operations/phase-1/operation-manifest.schema.json"
    scope_path = ROOT / "operations/phase-1/write-scope.json"
    scope_schema_path = ROOT / "operations/phase-1/write-scope.schema.json"
    plan_path = ROOT / "operations/phase-1/verification-plan.json"
    plan_schema_path = ids["urn:aseos:schema:verification-plan:1.0.0"]
    operation = documents[op_path]
    scope = documents[scope_path]
    plan = documents[plan_path]
    for value, schema_path, label in (
        (operation, op_schema_path, "operation"),
        (scope, scope_schema_path, "write-scope"),
        (plan, plan_schema_path, "verification-plan"),
    ):
        errors = validate_instance(documents[schema_path], value, registry)
        if errors:
            error = errors[0]
            raise AssertionError(f"{label} invalid: {error.validator} {error.message} at {pointer(error.path)}")
    expected_ops = {f"P1-O{i:02d}" for i in range(1, 10)}
    op_items = {item["operationId"]: item for item in operation["suboperations"]}
    if set(op_items) != expected_ops:
        raise AssertionError(f"Operation set mismatch: {set(op_items)}")
    check_dag(expected_ops, {oid: item["dependsOn"] for oid, item in op_items.items()}, "Operation DAG")
    step_items = {item["stepId"]: item for item in plan["steps"]}
    expected_steps = {
        "P1-V00-M0-AUTHORIZATION", "P1-V01-PREFLIGHT", "P1-V02-TOOLCHAIN",
        "P1-V03-CONTRACTS", "P1-V04-ARCHITECTURE", "P1-V05-POLICY",
        "P1-V06-PERSISTENCE", "P1-V07-CONTROL-API", "P1-V08-ISOLATION",
        "P1-V09-PACKAGING", "P1-V10-INTEGRATED-GATE",
    }
    if set(step_items) != expected_steps:
        raise AssertionError(f"Verification step set mismatch: {set(step_items)}")
    check_dag(expected_steps, {sid: item["dependsOn"] for sid, item in step_items.items()}, "Verification DAG")
    for ref in plan["contractRefs"]:
        sid = ref["schemaId"]
        if sid not in ids:
            raise AssertionError(f"VerificationPlan unknown contractRef: {sid}")
        if ref["schemaHash"] != sha256(ids[sid].read_bytes()):
            raise AssertionError(f"VerificationPlan contract hash mismatch: {sid}")
    gate_refs = {step for item in operation["suboperations"] for step in item["gateStepIds"]}
    if gate_refs != expected_steps:
        raise AssertionError(f"Operation Gate coverage mismatch missing={expected_steps-gate_refs} extra={gate_refs-expected_steps}")
    return {"operations": len(op_items), "steps": len(step_items), "gateCoverage": len(gate_refs)}

def verify_write_scope(documents: dict[pathlib.Path, Any]) -> dict[str, Any]:
    scope = documents[ROOT / "operations/phase-1/write-scope.json"]
    global_allowed = scope["globalAllowedPathGlobs"]
    global_denied = scope["globalDeniedPathGlobs"]
    if scope["enforcementMode"] != "DENY_BY_DEFAULT":
        raise AssertionError("WRITE_SCOPE enforcementMode is not DENY_BY_DEFAULT")
    if "operations/phase-1/**" in global_allowed:
        raise AssertionError("WRITE_SCOPE contains prohibited broad Phase 1 operations allow")
    required_global = {
        "tests/fault-injection/**",
        "tests/security/**",
        "operations/phase-1/executions/**",
    }
    for required in required_global:
        if not any(pattern_covers(parent, required) for parent in global_allowed):
            raise AssertionError(f"Global scope missing {required}")
    operations = {item["operationId"]: item for item in scope["operations"]}
    expected_ops = {f"P1-O{i:02d}" for i in range(1, 10)}
    if set(operations) != expected_ops:
        raise AssertionError("WRITE_SCOPE operation set mismatch")
    execution_globs = {
        oid: f"operations/phase-1/executions/{oid.lower()}-*.json"
        for oid in expected_ops
    }
    receipt_path = "operations/phase-1/implementation-receipt.json"
    total_paths = 0
    for oid, item in operations.items():
        expected_execution_glob = execution_globs[oid]
        if expected_execution_glob not in item["allowedPathGlobs"]:
            raise AssertionError(f"{oid} missing exact execution-record scope: {expected_execution_glob}")
        foreign_execution_globs = sorted(
            glob for owner, glob in execution_globs.items()
            if owner != oid and glob in item["allowedPathGlobs"]
        )
        if foreign_execution_globs:
            raise AssertionError(f"{oid} owns foreign execution-record scope: {foreign_execution_globs}")
        owns_receipt = receipt_path in item["allowedPathGlobs"]
        if owns_receipt != (oid == "P1-O09"):
            raise AssertionError(f"{oid} integrated receipt ownership is invalid")
        for path_glob in item["allowedPathGlobs"]:
            total_paths += 1
            if not any(pattern_covers(parent, path_glob) for parent in global_allowed):
                raise AssertionError(f"{oid} path outside global allow: {path_glob}")
            if any(pattern_covers(denied, path_glob) or pattern_covers(path_glob, denied) for denied in global_denied):
                # A broad allowed parent covering a specifically denied authority path is acceptable
                # only through the authority-lock OPERATION_SCOPED policy, checked separately.
                if not path_glob.startswith("packages/contracts/"):
                    raise AssertionError(f"{oid} path overlaps global deny: {path_glob}")
        for output_glob in item["requiredOutputPathGlobs"]:
            if not any(pattern_covers(parent, output_glob) for parent in item["allowedPathGlobs"]):
                raise AssertionError(f"{oid} required output is not writable: {output_glob}")
            if not any(pattern_covers(parent, output_glob) for parent in global_allowed):
                raise AssertionError(f"{oid} required output outside global scope: {output_glob}")
        for path_rule in item["allowedPathGlobs"] + item["deniedPathGlobs"]:
            if " " in path_rule and not any(ch in path_rule for ch in "*?["):
                raise AssertionError(f"{oid} probable semantic prose mixed into path rules: {path_rule}")
    return {
        "operations": len(operations),
        "allowedPathGlobs": total_paths,
        "executionRecordScopes": len(execution_globs),
        "denyByDefault": True,
        "integratedReceiptOwner": "P1-O09",
    }

def verify_authority_lock(documents: dict[pathlib.Path, Any], registry: Registry) -> dict[str, int]:
    lock_path = ROOT / "operations/phase-1/authority-lock.json"
    schema_path = ROOT / "operations/phase-1/authority-lock.schema.json"
    lock = documents[lock_path]
    errors = validate_instance(documents[schema_path], lock, registry)
    if errors:
        error = errors[0]
        raise AssertionError(f"Authority lock invalid: {error.message} at {pointer(error.path)}")
    scope = documents[ROOT / "operations/phase-1/write-scope.json"]
    op_patterns = {
        item["operationId"]: item["allowedPathGlobs"]
        for item in scope["operations"]
    }
    seen: set[str] = set()
    immutable = scoped = 0
    for entry in lock["authorityFiles"]:
        rel = entry["path"]
        if rel in seen:
            raise AssertionError(f"Authority lock duplicate path: {rel}")
        seen.add(rel)
        path = ROOT / rel
        if not path.is_file():
            raise AssertionError(f"Authority lock missing path: {rel}")
        if entry["sha256"] != sha256(path.read_bytes()):
            raise AssertionError(f"Authority lock hash mismatch: {rel}")
        allowed_ops = set(entry["allowedOperationIds"])
        covering_ops = {
            oid for oid, patterns in op_patterns.items()
            if any(path_matches(pattern, rel) for pattern in patterns)
        }
        if entry["mutationPolicy"] == "IMMUTABLE":
            immutable += 1
            if allowed_ops:
                raise AssertionError(f"Immutable authority path has allowedOperationIds: {rel}")
            if covering_ops:
                raise AssertionError(f"Immutable authority path writable by {sorted(covering_ops)}: {rel}")
        else:
            scoped += 1
            if not allowed_ops:
                raise AssertionError(f"Operation-scoped path has no allowed operations: {rel}")
            unexpected = covering_ops - allowed_ops
            missing = allowed_ops - covering_ops
            if unexpected or missing:
                raise AssertionError(
                    f"Operation-scoped authority coverage mismatch {rel}: "
                    f"unexpected={sorted(unexpected)} missing={sorted(missing)}"
                )
    if lock["excludedSelfPath"] in seen:
        raise AssertionError("Authority lock illegally hashes itself")
    return {"paths": len(seen), "immutable": immutable, "operationScoped": scoped}

def make_incomplete_receipt() -> dict[str, Any]:
    ids = [f"P1-O{i:02d}" for i in range(1, 10)]
    steps = [
        "P1-V00-M0-AUTHORIZATION", "P1-V01-PREFLIGHT", "P1-V02-TOOLCHAIN",
        "P1-V03-CONTRACTS", "P1-V04-ARCHITECTURE", "P1-V05-POLICY",
        "P1-V06-PERSISTENCE", "P1-V07-CONTROL-API", "P1-V08-ISOLATION",
        "P1-V09-PACKAGING", "P1-V10-INTEGRATED-GATE",
    ]
    return {
        "$schema": "urn:aseos:operation-schema:phase-1-receipt:1.1.0",
        "schemaVersion": "1.1.0",
        "operationId": "P1-EXECUTABLE-REPOSITORY-FOUNDATION",
        "m0GateRef": "docs/reviews/m0-architecture-baseline-verified.md",
        "authorityLockHash": "0" * 64,
        "baselineCommit": "0" * 40,
        "implementationCommit": "1" * 40,
        "implementationDeclaration": "IMPLEMENTED",
        "declaredBy": {"role": "IMPLEMENTATION_AGENT", "actorId": "negative-fixture"},
        "startedAt": "2026-08-27T00:00:00Z",
        "completedAt": "2026-08-27T00:01:00Z",
        "writeScope": {
            "scopeId": "P1-EXECUTABLE-REPOSITORY-FOUNDATION-WRITE-SCOPE",
            "authorityLockVerified": True,
            "compliant": True,
            "changedPaths": [],
            "generatedPaths": [],
            "violations": [],
        },
        "suboperations": [
            {
                "operationId": oid,
                "status": "NOT_STARTED" if oid == "P1-O01" else "IMPLEMENTED",
                "commitRefs": [],
                "outputs": [],
                "findings": [],
            }
            for oid in ids
        ],
        "verification": {
            "planId": "0198e0a1-0000-7001-8000-000000000001",
            "planHash": "2" * 64,
            "executions": [
                {
                    "stepId": step,
                    "environment": "none",
                    "command": "not-run",
                    "result": "NOT_RUN",
                    "evidenceRefs": [],
                }
                for step in steps
            ],
            "overallResult": "NOT_RUN",
        },
        "qualificationObligations": [
            {
                "obligationId": f"Q-{adr}",
                "adrRef": adr,
                "result": "NOT_RUN",
                "evidenceRefs": [],
            }
            for adr in ["ADR-0007", "ADR-0008", "ADR-0009", "ADR-0010", "ADR-0011"]
        ],
        "evidenceRefs": [],
        "knownGaps": [],
        "stopCondition": {"triggered": False, "condition": None, "action": "none"},
        "unauthorizedFallbackUsed": False,
        "documentationSynchronized": True,
        "independentVerificationRef": None,
    }

def verify_receipt_guards(documents: dict[pathlib.Path, Any], registry: Registry) -> dict[str, int]:
    receipt_schema_path = ROOT / "operations/phase-1/receipt.schema.json"
    independent_schema_path = ROOT / "operations/phase-1/independent-verification-receipt.schema.json"
    Draft202012Validator.check_schema(documents[receipt_schema_path])
    Draft202012Validator.check_schema(documents[independent_schema_path])
    bad = make_incomplete_receipt()
    errors = validate_instance(documents[receipt_schema_path], bad, registry)
    if not errors:
        raise AssertionError("Incomplete IMPLEMENTED receipt was accepted")
    keywords = {str(error.validator) for error in errors}
    if not {"const", "minItems"}.intersection(keywords):
        raise AssertionError(f"Incomplete receipt failed for unexpected reasons only: {keywords}")
    if documents[receipt_schema_path]["properties"]["implementationDeclaration"]["enum"] != ["IMPLEMENTED", "PARTIAL", "BLOCKED"]:
        raise AssertionError("Implementation receipt declaration vocabulary changed")
    independent_role = documents[independent_schema_path]["properties"]["verifiedBy"]["properties"]["role"]
    if independent_role.get("const") != "INDEPENDENT_VERIFIER":
        raise AssertionError("Independent verification role is not fixed")
    if documents[independent_schema_path]["properties"]["remediationPerformed"].get("const") is not False:
        raise AssertionError("Independent verifier is permitted to remediate")
    return {"negativeErrors": len(errors), "schemas": 2}

def verify_accepted_adrs(lock: dict[str, Any]) -> int:
    adr_entries = [
        entry for entry in lock["authorityFiles"]
        if entry["role"] == "ACCEPTED_ADR"
    ]
    expected = {f"ADR-{i:04d}" for i in range(1, 12)}
    observed = {
        re.search(r"(ADR-[0-9]{4})", entry["path"]).group(1)
        for entry in adr_entries
    }
    if observed != expected:
        raise AssertionError(f"Accepted ADR lock coverage mismatch: {observed}")
    if any(entry["mutationPolicy"] != "IMMUTABLE" for entry in adr_entries):
        raise AssertionError("Accepted ADR is not immutable")
    return len(adr_entries)

def verify_no_production_runtime_diff(base: str | None) -> dict[str, Any]:
    if not base:
        return {"status": "NOT_CHECKED", "reason": "no --base supplied"}
    changed = set(filter(None, run_git("diff", "--name-only", f"{base}...HEAD").splitlines()))
    prohibited_prefixes = (
        "apps/", "packages/kernel/", "packages/policy/", "packages/persistence/",
        "packages/platform/", "packages/observability/", "packages/adapters/",
        "packages/workflow/", "packages/node-runtime/", "packages/context/",
        "packages/skills/", "packages/verification/", "packages/evidence/",
        "packages/learning/",
    )
    production = sorted(path for path in changed if path.startswith(prohibited_prefixes))
    if production:
        raise AssertionError(f"Production runtime paths changed during M0 remediation: {production}")
    adr_changes = sorted(path for path in changed if path.startswith("docs/decisions/"))
    if adr_changes:
        raise AssertionError(f"Accepted ADRs changed during M0 remediation: {adr_changes}")
    return {"changedPaths": len(changed), "productionRuntimePaths": 0, "adrPaths": 0}

def verify_branch_prerequisite() -> dict[str, Any]:
    operation = load_json(ROOT / "operations/phase-1/operation.json")
    prerequisite = [
        item for item in operation["prerequisites"]
        if "branch protection" in item.lower() and "required" in item.lower()
    ]
    if not prerequisite:
        raise AssertionError("Branch protection prerequisite is not recorded")
    return {
        "recorded": True,
        "enabledClaimed": False,
        "note": "Repository settings must be independently confirmed before Phase 1 entry.",
    }

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", help="Base commit for M0 remediation scope check")
    parser.add_argument("--subject", default="working-tree")
    parser.add_argument("--write-report")
    args = parser.parse_args()

    audit = Audit()
    json_files, documents = collect_documents()
    audit.check("M0-V01-JSON-PARSE", lambda: len(json_files))
    schema_paths = sorted(path for path in json_files if path.name.endswith(".schema.json"))
    ids, registry = audit.check("M0-V02-SCHEMA-META-AND-ID", lambda: build_registry(schema_paths, documents))
    # Avoid serializing Registry in reports.
    audit.checks[-1]["detail"] = {"schemas": len(ids)}
    audit.details["M0-V02-SCHEMA-META-AND-ID"] = {"schemas": len(ids)}
    audit.check("M0-V03-REF-RESOLUTION", lambda: resolve_refs(ids, documents, schema_paths))
    audit.check("M0-V04-COMPLETE-SCHEMA-REGISTRY", lambda: verify_registry(ids, documents, registry))
    audit.check("M0-V05-ACTIVE-PLANNED-INVENTORIES", lambda: verify_inventories(ids, documents, registry))
    audit.check("M0-V06-EXECUTABLE-EXAMPLES", lambda: verify_examples(ids, documents, registry))
    audit.check("M0-V07-NO-PLACEHOLDER-HASHES", lambda: verify_no_placeholders(json_files))
    audit.check("M0-V08-OPERATION-AND-VERIFICATION-DAG", lambda: verify_governance(documents, ids, registry))
    audit.check("M0-V09-WRITE-SCOPE-CLOSURE", lambda: verify_write_scope(documents))
    lock_detail = audit.check("M0-V10-AUTHORITY-LOCK", lambda: verify_authority_lock(documents, registry))
    lock = documents[ROOT / "operations/phase-1/authority-lock.json"]
    audit.check("M0-V11-ACCEPTED-ADR-IMMUTABILITY", lambda: verify_accepted_adrs(lock))
    audit.check("M0-V12-RECEIPT-ANTI-FALSE-IMPLEMENTED", lambda: verify_receipt_guards(documents, registry))
    audit.check("M0-V13-NO-PRODUCTION-OR-ADR-CHANGE", lambda: verify_no_production_runtime_diff(args.base))
    audit.check("M0-V14-BRANCH-PROTECTION-PREREQUISITE", verify_branch_prerequisite)

    decision = "PASS" if all(item["result"] == "PASS" for item in audit.checks) else "FAIL"
    report = {
        "schemaVersion": "1.0.0",
        "reportType": "M0_PREIMPLEMENTATION_READ_ONLY_VERIFICATION",
        "subject": args.subject,
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "decision": decision,
        "checks": audit.checks,
        "summary": {
            "passed": sum(item["result"] == "PASS" for item in audit.checks),
            "failed": sum(item["result"] == "FAIL" for item in audit.checks),
            "total": len(audit.checks),
        },
        "claimBoundary": {
            "m0FinalGate": "NOT_CREATED_BY_THIS_SCRIPT",
            "phase1": "NOT_STARTED",
            "runtimeCapability": "NOT_IMPLEMENTED",
            "remediationPerformed": False,
        },
    }
    if args.write_report:
        write_json(ROOT / args.write_report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if decision == "PASS" else 1

if __name__ == "__main__":
    raise SystemExit(main())
