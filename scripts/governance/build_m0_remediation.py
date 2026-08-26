#!/usr/bin/env python3
from __future__ import annotations

import copy
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import subprocess
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[2]
ARCH_BASELINE = "f4f10855f5bfcce2d56ff4b110f271b4d7cfd116"
PLANNING_SOURCE = "e287b7f8cdf6ab7d2df6a5a171a395cc2b60bf45"
BRANCH = "remediation/m0-preimplementation-governance"
NOW = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def write_text(rel: str, content: str) -> pathlib.Path:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.replace("\r\n", "\n"), encoding="utf-8", newline="\n")
    return path

def write_json(rel: str, value: Any) -> pathlib.Path:
    return write_text(rel, json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n")

def load_json(rel: str) -> Any:
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))

def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def sha_file(rel: str) -> str:
    return sha_bytes((ROOT / rel).read_bytes())

def canonical_json(value: Any) -> bytes:
    # Fixture data intentionally excludes floating-point numbers, so this is
    # byte-compatible with RFC 8785 for the supported fixture value set.
    def reject_float(v: Any) -> None:
        if isinstance(v, float):
            raise ValueError("M0 fixture canonical JSON forbids floating-point values")
        if isinstance(v, dict):
            for item in v.values():
                reject_float(item)
        elif isinstance(v, list):
            for item in v:
                reject_float(item)
    reject_float(value)
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")

def sha_canonical(value: Any) -> str:
    return sha_bytes(canonical_json(value))

def uuid7(n: int) -> str:
    # Shape-valid deterministic fixture identity.
    return f"0198e0a1-0000-7{n:03x}-8{n % 16:03x}-{n:012x}"

def schema_ref(schema_id: str, path: str) -> dict[str, str]:
    value = load_json(path)
    return {
        "schemaId": schema_id,
        "schemaVersion": value.get("x-schemaVersion", "1.0.0"),
        "schemaHash": sha_file(path),
    }

def artifact_ref(rel: str, artifact_id: str, media_type: str, sensitivity: str = "INTERNAL") -> dict[str, Any]:
    path = ROOT / rel
    data = path.read_bytes()
    return {
        "artifactId": artifact_id,
        "sha256": sha_bytes(data),
        "mediaType": media_type,
        "sizeBytes": len(data),
        "sensitivity": sensitivity,
        "logicalName": path.name,
    }

def build_fixture_schemas() -> dict[str, str]:
    base = "packages/contracts/schemas/fixtures"
    schemas: dict[str, dict[str, Any]] = {
        "create-workflow-run-payload": {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$id": "urn:aseos:schema:create-workflow-run-payload:1.0.0",
            "x-schemaVersion": "1.0.0",
            "title": "CreateWorkflowRunPayload",
            "type": "object",
            "additionalProperties": False,
            "required": ["workflowDefinitionId", "workflowDefinitionVersion", "inputArtifactRef"],
            "properties": {
                "workflowDefinitionId": {"type": "string", "minLength": 1, "maxLength": 256},
                "workflowDefinitionVersion": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/semanticVersion"},
                "inputArtifactRef": {"$ref": "urn:aseos:schema:artifact-ref:1.0.0"},
            },
        },
        "workflow-run-created-payload": {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$id": "urn:aseos:schema:workflow-run-created-payload:1.0.0",
            "x-schemaVersion": "1.0.0",
            "title": "WorkflowRunCreatedPayload",
            "type": "object",
            "additionalProperties": False,
            "required": ["workflowDefinitionId", "workflowDefinitionVersion", "createdByCommandId"],
            "properties": {
                "workflowDefinitionId": {"type": "string", "minLength": 1, "maxLength": 256},
                "workflowDefinitionVersion": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/semanticVersion"},
                "createdByCommandId": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/uuidV7"},
            },
        },
        "apply-workspace-change-payload": {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$id": "urn:aseos:schema:apply-workspace-change-payload:1.0.0",
            "x-schemaVersion": "1.0.0",
            "title": "ApplyWorkspaceChangePayload",
            "type": "object",
            "additionalProperties": False,
            "required": ["workspaceRef", "baseSnapshotHash", "targetPath", "desiredContentArtifactRef"],
            "properties": {
                "workspaceRef": {"type": "string", "minLength": 1, "maxLength": 256},
                "baseSnapshotHash": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/sha256"},
                "targetPath": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 512,
                    "pattern": "^(?![A-Za-z]:)(?!/)(?!.*(?:^|/)\\.\\.(?:/|$)).+$",
                },
                "desiredContentArtifactRef": {"$ref": "urn:aseos:schema:artifact-ref:1.0.0"},
            },
        },
        "apply-workspace-change-result": {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$id": "urn:aseos:schema:apply-workspace-change-result:1.0.0",
            "x-schemaVersion": "1.0.0",
            "title": "ApplyWorkspaceChangeResult",
            "type": "object",
            "additionalProperties": False,
            "required": ["changeSetId", "beforeSnapshotHash", "afterSnapshotHash", "changedPaths"],
            "properties": {
                "changeSetId": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/uuidV7"},
                "beforeSnapshotHash": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/sha256"},
                "afterSnapshotHash": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/sha256"},
                "changedPaths": {
                    "type": "array",
                    "minItems": 1,
                    "uniqueItems": True,
                    "items": {"type": "string", "minLength": 1, "maxLength": 512},
                },
            },
        },
        "fixture-change-node-contract": {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$id": "urn:aseos:schema:fixture-change-node-contract:1.0.0",
            "x-schemaVersion": "1.0.0",
            "title": "FixtureChangeNodeContract",
            "type": "object",
            "additionalProperties": False,
            "required": [
                "contractId",
                "version",
                "inputSchemaRef",
                "outputSchemaRef",
                "allowedSideEffects",
                "verificationRequirements",
            ],
            "properties": {
                "contractId": {"const": "fixture-change-node"},
                "version": {"const": "1.0.0"},
                "inputSchemaRef": {"$ref": "urn:aseos:schema:schema-ref:1.0.0"},
                "outputSchemaRef": {"$ref": "urn:aseos:schema:schema-ref:1.0.0"},
                "allowedSideEffects": {
                    "type": "array",
                    "const": ["write_workspace"],
                },
                "verificationRequirements": {
                    "type": "array",
                    "minItems": 1,
                    "uniqueItems": True,
                    "items": {"type": "string", "minLength": 1},
                },
            },
        },
    }
    result: dict[str, str] = {}
    for name, schema in schemas.items():
        path = f"{base}/{name}.schema.json"
        write_json(path, schema)
        result[schema["$id"]] = path
    return result

def build_meta_schemas() -> None:
    example_suite_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:aseos:schema:example-suite:1.0.0",
        "x-schemaVersion": "1.0.0",
        "title": "ASEOS Executable Example Suite",
        "type": "object",
        "additionalProperties": False,
        "required": ["$schema", "suiteId", "suiteVersion", "hashPolicy", "cases"],
        "properties": {
            "$schema": {"const": "urn:aseos:schema:example-suite:1.0.0"},
            "suiteId": {"type": "string", "minLength": 1},
            "suiteVersion": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/semanticVersion"},
            "hashPolicy": {
                "type": "object",
                "additionalProperties": False,
                "required": ["payload", "schema", "artifact"],
                "properties": {
                    "payload": {"const": "SHA256_RFC8785_CANONICAL_JSON_UTF8"},
                    "schema": {"const": "SHA256_EXACT_AUTHORITY_FILE_BYTES"},
                    "artifact": {"const": "SHA256_RAW_BYTES"},
                },
            },
            "cases": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["caseId", "schemaId", "instancePath", "expected"],
                    "properties": {
                        "caseId": {"type": "string", "minLength": 1},
                        "schemaId": {"type": "string", "format": "uri"},
                        "instancePath": {"type": "string", "minLength": 1},
                        "expected": {"enum": ["VALID", "INVALID"]},
                        "expectedError": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["keyword", "instancePath"],
                            "properties": {
                                "keyword": {"type": "string", "minLength": 1},
                                "instancePath": {"type": "string"},
                            },
                        },
                        "semanticAssertions": {
                            "type": "array",
                            "uniqueItems": True,
                            "items": {
                                "enum": [
                                    "PAYLOAD_SCHEMA_RESOLVES",
                                    "PAYLOAD_HASH_MATCHES",
                                    "SCHEMA_HASH_MATCHES",
                                    "ARTIFACT_HASH_MATCHES",
                                ]
                            },
                        },
                    },
                    "allOf": [
                        {
                            "if": {"properties": {"expected": {"const": "INVALID"}}, "required": ["expected"]},
                            "then": {"required": ["expectedError"]},
                        }
                    ],
                },
            },
        },
    }
    registry_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:aseos:schema:schema-registry:1.0.0",
        "x-schemaVersion": "1.0.0",
        "title": "ASEOS Complete Schema Registry",
        "type": "object",
        "additionalProperties": False,
        "required": ["$schema", "registryVersion", "hashPolicy", "schemas"],
        "properties": {
            "$schema": {"const": "urn:aseos:schema:schema-registry:1.0.0"},
            "registryVersion": {"const": "1.0.0"},
            "hashPolicy": {"const": "SHA256_EXACT_AUTHORITY_FILE_BYTES"},
            "schemas": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["schemaId", "authorityPath", "sha256", "category", "examplesRequired"],
                    "properties": {
                        "schemaId": {"type": "string", "format": "uri"},
                        "authorityPath": {"type": "string", "minLength": 1},
                        "sha256": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/sha256"},
                        "category": {"enum": ["RUNTIME", "META", "GOVERNANCE", "FIXTURE"]},
                        "examplesRequired": {"type": "boolean"},
                    },
                },
            },
        },
    }
    write_json("packages/contracts/schemas/meta/example-suite.schema.json", example_suite_schema)
    write_json("packages/contracts/schemas/meta/schema-registry.schema.json", registry_schema)

def build_artifacts() -> dict[str, dict[str, Any]]:
    artifacts = {
        "request": ("packages/contracts/examples/first-slice/artifacts/request.json",
                    json.dumps({"request": "replace target.txt", "desired": "hello from ASEOS\n"},
                               ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n",
                    "application/json"),
        "desired": ("packages/contracts/examples/first-slice/artifacts/desired-content.txt",
                    "hello from ASEOS\n", "text/plain"),
        "diff": ("packages/contracts/examples/first-slice/artifacts/change.diff",
                 "--- a/target.txt\n+++ b/target.txt\n@@\n-old\n+hello from ASEOS\n", "text/x-diff"),
        "isolation": ("packages/contracts/examples/first-slice/artifacts/isolation-evidence.json",
                      json.dumps({"level": "PROCESS_RESTRICTED", "provider": "fixture-provider", "probe": "PASS"},
                                 ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n",
                      "application/vnd.aseos.isolation-evidence+json"),
        "oracle": ("packages/contracts/examples/first-slice/artifacts/oracle-result.json",
                   json.dumps({"expected": "hello from ASEOS\n", "observed": "hello from ASEOS\n", "result": "PASS"},
                              ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n",
                   "application/vnd.aseos.oracle-result+json"),
    }
    refs: dict[str, dict[str, Any]] = {}
    for i, (key, (rel, content, media)) in enumerate(artifacts.items(), start=1):
        write_text(rel, content)
        refs[key] = artifact_ref(rel, uuid7(0x100 + i), media)
    return refs

def build_examples(fixture_schemas: dict[str, str], artifacts: dict[str, dict[str, Any]]) -> None:
    root = "packages/contracts/examples/first-slice"
    ids = {
        "command": uuid7(1),
        "run": uuid7(2),
        "correlation": uuid7(3),
        "event": uuid7(4),
        "task": uuid7(5),
        "execution": uuid7(6),
        "result": uuid7(7),
        "evidence": uuid7(8),
        "policy": uuid7(9),
        "policy_snapshot": uuid7(10),
        "plan": uuid7(11),
        "gate": uuid7(12),
        "assessment": uuid7(13),
        "change_set": uuid7(14),
    }
    create_schema_id = "urn:aseos:schema:create-workflow-run-payload:1.0.0"
    created_schema_id = "urn:aseos:schema:workflow-run-created-payload:1.0.0"
    apply_schema_id = "urn:aseos:schema:apply-workspace-change-payload:1.0.0"
    result_schema_id = "urn:aseos:schema:apply-workspace-change-result:1.0.0"
    contract_schema_id = "urn:aseos:schema:fixture-change-node-contract:1.0.0"
    create_payload = {
        "workflowDefinitionId": "fixture-change-workflow",
        "workflowDefinitionVersion": "1.0.0",
        "inputArtifactRef": artifacts["request"],
    }
    command = {
        "schemaVersion": "1.0.0",
        "commandId": ids["command"],
        "commandType": "CreateWorkflowRun",
        "aggregateType": "WorkflowRun",
        "aggregateId": ids["run"],
        "expectedVersion": 0,
        "issuedAt": "2026-08-26T08:10:00Z",
        "actor": {"actorType": "HUMAN", "actorId": "local-operator"},
        "correlationId": ids["correlation"],
        "idempotencyKey": "fixture-change-workflow:create:001",
        "payloadSchema": schema_ref(create_schema_id, fixture_schemas[create_schema_id]),
        "payloadHash": sha_canonical(create_payload),
        "payload": create_payload,
        "requestId": uuid7(15),
    }
    event_payload = {
        "workflowDefinitionId": "fixture-change-workflow",
        "workflowDefinitionVersion": "1.0.0",
        "createdByCommandId": ids["command"],
    }
    event = {
        "schemaVersion": "1.0.0",
        "eventId": ids["event"],
        "eventType": "WorkflowRunCreated",
        "aggregateType": "WorkflowRun",
        "aggregateId": ids["run"],
        "aggregateVersion": 1,
        "occurredAt": "2026-08-26T08:10:00Z",
        "actor": {"actorType": "SYSTEM", "actorId": "kernel", "actorVersion": "0.1.0"},
        "causationId": ids["command"],
        "correlationId": ids["correlation"],
        "payloadSchema": schema_ref(created_schema_id, fixture_schemas[created_schema_id]),
        "payloadHash": sha_canonical(event_payload),
        "payload": event_payload,
    }
    apply_payload = {
        "workspaceRef": "fixture-workspace",
        "baseSnapshotHash": sha_bytes(b"before snapshot"),
        "targetPath": "target.txt",
        "desiredContentArtifactRef": artifacts["desired"],
    }
    task = {
        "schemaVersion": "1.0.0",
        "taskId": ids["task"],
        "executionId": ids["execution"],
        "attempt": 1,
        "correlationId": ids["correlation"],
        "causationId": ids["event"],
        "idempotencyKey": "apply-change:fixture:execution-001",
        "effectScope": "workspace:fixture-change-workflow:target.txt",
        "capability": "write_workspace",
        "permissionSet": ["workspace.read:fixture", "workspace.write:fixture/target.txt"],
        "requiredIsolationLevel": "PROCESS_RESTRICTED",
        "inputArtifactRefs": [artifacts["desired"]],
        "timeoutMs": 30000,
        "resourceBudget": {
            "maxCpuTimeMs": 10000,
            "maxMemoryBytes": 134217728,
            "maxProcessCount": 4,
            "maxOutputBytes": 1048576,
            "networkMode": "DENY",
        },
        "adapterContractVersion": "1.0.0",
        "payloadSchema": schema_ref(apply_schema_id, fixture_schemas[apply_schema_id]),
        "payloadHash": sha_canonical(apply_payload),
        "payload": apply_payload,
    }
    result_payload = {
        "changeSetId": ids["change_set"],
        "beforeSnapshotHash": apply_payload["baseSnapshotHash"],
        "afterSnapshotHash": sha_bytes(b"after snapshot"),
        "changedPaths": ["target.txt"],
    }
    result = {
        "schemaVersion": "1.0.0",
        "resultId": ids["result"],
        "taskId": ids["task"],
        "executionId": ids["execution"],
        "attempt": 1,
        "correlationId": ids["correlation"],
        "outcome": "SUCCEEDED",
        "startedAt": "2026-08-26T08:10:02Z",
        "completedAt": "2026-08-26T08:10:03Z",
        "adapterId": "windows-process-restricted-workspace",
        "adapterVersion": "1.0.0",
        "selectedIsolationLevel": "PROCESS_RESTRICTED",
        "isolationEvidenceRef": artifacts["isolation"],
        "outputArtifactRefs": [artifacts["diff"]],
        "evidenceRefs": [{"subjectType": "Evidence", "subjectId": ids["evidence"]}],
        "payloadSchema": schema_ref(result_schema_id, fixture_schemas[result_schema_id]),
        "payloadHash": sha_canonical(result_payload),
        "payload": result_payload,
    }
    evidence = {
        "schemaVersion": "1.0.0",
        "evidenceId": ids["evidence"],
        "evidenceType": "ExactContentOracleResult",
        "subjectRefs": [{"subjectType": "NodeExecution", "subjectId": ids["execution"]}],
        "producer": {"actorType": "SYSTEM", "actorId": "exact-content-oracle", "actorVersion": "1.0.0"},
        "producerVersion": "1.0.0",
        "executionRef": {"runId": ids["run"], "nodeId": "verify-change", "executionId": ids["execution"], "attempt": 1},
        "createdAt": "2026-08-26T08:10:04Z",
        "contentRef": artifacts["oracle"],
        "contentHash": artifacts["oracle"]["sha256"],
        "mediaType": artifacts["oracle"]["mediaType"],
        "trustLevel": "SYSTEM_AUTHORITY",
        "collectionMethod": "deterministic-content-hash-comparison",
        "sensitivity": "INTERNAL",
    }
    policy = {
        "schemaVersion": "1.0.0",
        "decisionId": ids["policy"],
        "outcome": "ALLOW_WITH_REQUIREMENTS",
        "policySnapshotId": ids["policy_snapshot"],
        "policySnapshotHash": sha_bytes(b"fixture policy snapshot"),
        "inputHash": sha_bytes(b"fixture policy input"),
        "matchedRuleIds": ["fixture-write-low-risk"],
        "hardInvariantIds": ["no-model-authority", "no-isolation-downgrade"],
        "requirements": {
            "permissionScopes": ["workspace.write:fixture/target.txt"],
            "minimumIsolationLevel": "PROCESS_RESTRICTED",
            "verificationProfileRefs": [{"subjectType": "VerificationProfile", "subjectId": "fixture-change-r2", "subjectVersion": "1.0.0"}],
            "timeoutMs": 30000,
            "maxConcurrency": 1,
            "postVerificationRequired": True,
        },
        "reasonCodes": [],
        "residualRiskRefs": [{"subjectType": "Risk", "subjectId": "process-restricted-not-security-sandbox", "subjectVersion": "1.0.0"}],
        "evaluatedAt": "2026-08-26T08:10:01Z",
        "evaluatorVersion": "1.0.0",
    }
    contract_ref = schema_ref(contract_schema_id, fixture_schemas[contract_schema_id])
    verification = {
        "schemaVersion": "1.0.0",
        "planId": ids["plan"],
        "subjectRef": {"subjectType": "NodeExecution", "subjectId": ids["execution"]},
        "contractRefs": [contract_ref],
        "riskClass": "R2",
        "plannerId": "minimum-policy-verification-planner",
        "plannerVersion": "1.0.0",
        "policySnapshotId": ids["policy_snapshot"],
        "createdAt": "2026-08-26T08:10:03Z",
        "steps": [
            {
                "stepId": "V1-proposal-schema",
                "kind": "SCHEMA",
                "required": True,
                "dependsOn": [],
                "executorCapability": "validate_json_schema",
                "inputRefs": [{"subjectType": "Proposal", "subjectId": uuid7(16)}],
                "expectedEvidenceTypes": ["SchemaValidationResult"],
                "timeoutMs": 5000,
                "retryPolicy": {"maxAttempts": 1, "retryableErrorCodes": []},
            },
            {
                "stepId": "V2-exact-content-oracle",
                "kind": "ORACLE",
                "required": True,
                "dependsOn": ["V1-proposal-schema"],
                "executorCapability": "exact_content_oracle",
                "inputRefs": [{"subjectType": "ChangeSet", "subjectId": ids["change_set"]}],
                "expectedEvidenceTypes": ["ExactContentOracleResult"],
                "timeoutMs": 5000,
                "retryPolicy": {"maxAttempts": 1, "retryableErrorCodes": []},
            },
        ],
        "risksCovered": ["malformed-proposal", "wrong-content-with-exit-zero"],
        "risksNotCovered": ["strong-malicious-process-containment"],
    }
    gate = {
        "schemaVersion": "1.0.0",
        "decisionId": ids["gate"],
        "planId": ids["plan"],
        "subjectRef": {"subjectType": "NodeExecution", "subjectId": ids["execution"]},
        "outcome": "PASS",
        "policySnapshotId": ids["policy_snapshot"],
        "assessmentRefs": [{"subjectType": "VerificationAssessment", "subjectId": ids["assessment"]}],
        "evidenceRefs": [{"subjectType": "Evidence", "subjectId": ids["evidence"]}],
        "missingEvidence": [],
        "riskAcceptanceRefs": [],
        "reasonCodes": [],
        "decidedAt": "2026-08-26T08:10:05Z",
        "evaluatorVersion": "1.0.0",
    }
    files: dict[str, Any] = {
        "valid/create-workflow-run.command.json": command,
        "invalid/missing-idempotency.command.json": {k: v for k, v in command.items() if k != "idempotencyKey"},
        "valid/workflow-run-created.event.json": event,
        "invalid/event-version-zero.json": {**event, "aggregateVersion": 0},
        "valid/apply-change.side-effect-task.json": task,
        "invalid/host-unrestricted.side-effect-task.json": {**task, "requiredIsolationLevel": "HOST_UNRESTRICTED"},
        "valid/apply-change.side-effect-result.json": result,
        "invalid/failed-result-without-error.json": {**result, "outcome": "FAILED"},
        "valid/exact-content.evidence.json": evidence,
        "invalid/evidence-without-producer.json": {k: v for k, v in evidence.items() if k != "producer"},
        "valid/fixture-policy-decision.json": policy,
        "invalid/indeterminate-without-reason.policy-decision.json": {**policy, "outcome": "INDETERMINATE", "reasonCodes": []},
        "valid/fixture-verification-plan.json": verification,
        "invalid/verification-plan-empty-steps.json": {**verification, "steps": []},
        "valid/fixture-gate-decision.json": gate,
        "invalid/pass-without-evidence.gate-decision.json": {**gate, "evidenceRefs": [], "missingEvidence": ["ExactContentOracleResult"]},
        "valid/node-execution-identity.json": {"runId": ids["run"], "nodeId": "verify-change", "executionId": ids["execution"], "attempt": 1},
        "invalid/node-execution-attempt-zero.json": {"runId": ids["run"], "nodeId": "verify-change", "executionId": ids["execution"], "attempt": 0},
        "valid/actor-ref.json": {"actorType": "SYSTEM", "actorId": "kernel", "actorVersion": "1.0.0"},
        "invalid/actor-ref-unknown-field.json": {"actorType": "SYSTEM", "actorId": "kernel", "unexpected": True},
        "valid/artifact-ref.json": artifacts["desired"],
        "invalid/artifact-ref-bad-hash.json": {**artifacts["desired"], "sha256": "not-a-hash"},
        "valid/schema-ref.json": schema_ref(create_schema_id, fixture_schemas[create_schema_id]),
        "invalid/schema-ref-bad-hash.json": {**schema_ref(create_schema_id, fixture_schemas[create_schema_id]), "schemaHash": "bad"},
        "valid/subject-ref.json": {"subjectType": "NodeExecution", "subjectId": ids["execution"], "subjectVersion": "1.0.0"},
        "invalid/subject-ref-bad-type.json": {"subjectType": "node-execution", "subjectId": ids["execution"]},
        "valid/typed-error.json": {"code": "WORKER_TIMEOUT", "category": "TIMEOUT", "message": "Worker exceeded deadline", "retryability": "CONDITIONAL"},
        "invalid/typed-error-bad-retryability.json": {"code": "WORKER_TIMEOUT", "category": "TIMEOUT", "message": "Worker exceeded deadline", "retryability": "MAYBE"},
        "valid/create-workflow-run-payload.json": create_payload,
        "invalid/create-workflow-run-payload-extra.json": {**create_payload, "unexpected": True},
        "valid/workflow-run-created-payload.json": event_payload,
        "invalid/workflow-run-created-payload-missing-command.json": {k: v for k, v in event_payload.items() if k != "createdByCommandId"},
        "valid/apply-workspace-change-payload.json": apply_payload,
        "invalid/apply-workspace-change-payload-traversal.json": {**apply_payload, "targetPath": "../secret.txt"},
        "valid/apply-workspace-change-result.json": result_payload,
        "invalid/apply-workspace-change-result-empty-paths.json": {**result_payload, "changedPaths": []},
        "valid/fixture-change-node-contract.json": {
            "contractId": "fixture-change-node",
            "version": "1.0.0",
            "inputSchemaRef": schema_ref(apply_schema_id, fixture_schemas[apply_schema_id]),
            "outputSchemaRef": schema_ref(result_schema_id, fixture_schemas[result_schema_id]),
            "allowedSideEffects": ["write_workspace"],
            "verificationRequirements": ["exact-content", "diff-scope"],
        },
        "invalid/fixture-change-node-contract-side-effect.json": {
            "contractId": "fixture-change-node",
            "version": "1.0.0",
            "inputSchemaRef": schema_ref(apply_schema_id, fixture_schemas[apply_schema_id]),
            "outputSchemaRef": schema_ref(result_schema_id, fixture_schemas[result_schema_id]),
            "allowedSideEffects": ["arbitrary_shell"],
            "verificationRequirements": ["exact-content"],
        },
    }
    for rel, value in files.items():
        write_json(f"{root}/{rel}", value)

    case_specs = [
        ("command-valid", "urn:aseos:schema:command-envelope:1.0.0", "valid/create-workflow-run.command.json", "VALID", None, ["PAYLOAD_SCHEMA_RESOLVES", "PAYLOAD_HASH_MATCHES", "SCHEMA_HASH_MATCHES", "ARTIFACT_HASH_MATCHES"]),
        ("command-missing-idempotency", "urn:aseos:schema:command-envelope:1.0.0", "invalid/missing-idempotency.command.json", "INVALID", ("required", ""), []),
        ("event-valid", "urn:aseos:schema:domain-event-envelope:1.0.0", "valid/workflow-run-created.event.json", "VALID", None, ["PAYLOAD_SCHEMA_RESOLVES", "PAYLOAD_HASH_MATCHES", "SCHEMA_HASH_MATCHES"]),
        ("event-version-zero", "urn:aseos:schema:domain-event-envelope:1.0.0", "invalid/event-version-zero.json", "INVALID", ("minimum", "/aggregateVersion"), []),
        ("task-valid", "urn:aseos:schema:side-effect-task-envelope:1.0.0", "valid/apply-change.side-effect-task.json", "VALID", None, ["PAYLOAD_SCHEMA_RESOLVES", "PAYLOAD_HASH_MATCHES", "SCHEMA_HASH_MATCHES", "ARTIFACT_HASH_MATCHES"]),
        ("task-host-unrestricted", "urn:aseos:schema:side-effect-task-envelope:1.0.0", "invalid/host-unrestricted.side-effect-task.json", "INVALID", ("enum", "/requiredIsolationLevel"), []),
        ("result-valid", "urn:aseos:schema:side-effect-result-envelope:1.0.0", "valid/apply-change.side-effect-result.json", "VALID", None, ["PAYLOAD_SCHEMA_RESOLVES", "PAYLOAD_HASH_MATCHES", "SCHEMA_HASH_MATCHES", "ARTIFACT_HASH_MATCHES"]),
        ("result-failed-no-error", "urn:aseos:schema:side-effect-result-envelope:1.0.0", "invalid/failed-result-without-error.json", "INVALID", ("required", ""), []),
        ("evidence-valid", "urn:aseos:schema:evidence-metadata:1.0.0", "valid/exact-content.evidence.json", "VALID", None, ["ARTIFACT_HASH_MATCHES"]),
        ("evidence-without-producer", "urn:aseos:schema:evidence-metadata:1.0.0", "invalid/evidence-without-producer.json", "INVALID", ("required", ""), []),
        ("policy-valid", "urn:aseos:schema:policy-decision:1.0.0", "valid/fixture-policy-decision.json", "VALID", None, []),
        ("policy-indeterminate-no-reason", "urn:aseos:schema:policy-decision:1.0.0", "invalid/indeterminate-without-reason.policy-decision.json", "INVALID", ("minItems", "/reasonCodes"), []),
        ("verification-plan-valid", "urn:aseos:schema:verification-plan:1.0.0", "valid/fixture-verification-plan.json", "VALID", None, ["SCHEMA_HASH_MATCHES"]),
        ("verification-plan-empty-steps", "urn:aseos:schema:verification-plan:1.0.0", "invalid/verification-plan-empty-steps.json", "INVALID", ("minItems", "/steps"), []),
        ("gate-valid", "urn:aseos:schema:gate-decision:1.0.0", "valid/fixture-gate-decision.json", "VALID", None, []),
        ("gate-pass-without-evidence", "urn:aseos:schema:gate-decision:1.0.0", "invalid/pass-without-evidence.gate-decision.json", "INVALID", ("minItems", "/evidenceRefs"), []),
        ("node-identity-valid", "urn:aseos:schema:node-execution-identity:1.0.0", "valid/node-execution-identity.json", "VALID", None, []),
        ("node-identity-attempt-zero", "urn:aseos:schema:node-execution-identity:1.0.0", "invalid/node-execution-attempt-zero.json", "INVALID", ("minimum", "/attempt"), []),
        ("actor-valid", "urn:aseos:schema:actor-ref:1.0.0", "valid/actor-ref.json", "VALID", None, []),
        ("actor-unknown-field", "urn:aseos:schema:actor-ref:1.0.0", "invalid/actor-ref-unknown-field.json", "INVALID", ("additionalProperties", ""), []),
        ("artifact-valid", "urn:aseos:schema:artifact-ref:1.0.0", "valid/artifact-ref.json", "VALID", None, ["ARTIFACT_HASH_MATCHES"]),
        ("artifact-bad-hash", "urn:aseos:schema:artifact-ref:1.0.0", "invalid/artifact-ref-bad-hash.json", "INVALID", ("pattern", "/sha256"), []),
        ("schema-ref-valid", "urn:aseos:schema:schema-ref:1.0.0", "valid/schema-ref.json", "VALID", None, ["SCHEMA_HASH_MATCHES"]),
        ("schema-ref-bad-hash", "urn:aseos:schema:schema-ref:1.0.0", "invalid/schema-ref-bad-hash.json", "INVALID", ("pattern", "/schemaHash"), []),
        ("subject-valid", "urn:aseos:schema:subject-ref:1.0.0", "valid/subject-ref.json", "VALID", None, []),
        ("subject-bad-type", "urn:aseos:schema:subject-ref:1.0.0", "invalid/subject-ref-bad-type.json", "INVALID", ("pattern", "/subjectType"), []),
        ("typed-error-valid", "urn:aseos:schema:typed-error:1.0.0", "valid/typed-error.json", "VALID", None, []),
        ("typed-error-bad-retryability", "urn:aseos:schema:typed-error:1.0.0", "invalid/typed-error-bad-retryability.json", "INVALID", ("enum", "/retryability"), []),
        ("create-payload-valid", create_schema_id, "valid/create-workflow-run-payload.json", "VALID", None, ["ARTIFACT_HASH_MATCHES"]),
        ("create-payload-extra", create_schema_id, "invalid/create-workflow-run-payload-extra.json", "INVALID", ("additionalProperties", ""), []),
        ("created-payload-valid", created_schema_id, "valid/workflow-run-created-payload.json", "VALID", None, []),
        ("created-payload-missing-command", created_schema_id, "invalid/workflow-run-created-payload-missing-command.json", "INVALID", ("required", ""), []),
        ("apply-payload-valid", apply_schema_id, "valid/apply-workspace-change-payload.json", "VALID", None, ["ARTIFACT_HASH_MATCHES"]),
        ("apply-payload-traversal", apply_schema_id, "invalid/apply-workspace-change-payload-traversal.json", "INVALID", ("pattern", "/targetPath"), []),
        ("apply-result-valid", result_schema_id, "valid/apply-workspace-change-result.json", "VALID", None, []),
        ("apply-result-empty-paths", result_schema_id, "invalid/apply-workspace-change-result-empty-paths.json", "INVALID", ("minItems", "/changedPaths"), []),
        ("node-contract-valid", contract_schema_id, "valid/fixture-change-node-contract.json", "VALID", None, ["SCHEMA_HASH_MATCHES"]),
        ("node-contract-invalid-side-effect", contract_schema_id, "invalid/fixture-change-node-contract-side-effect.json", "INVALID", ("const", "/allowedSideEffects"), []),
    ]
    cases = []
    for case_id, sid, rel, expected, error, assertions in case_specs:
        case = {
            "caseId": case_id,
            "schemaId": sid,
            "instancePath": f"{root}/{rel}",
            "expected": expected,
        }
        if error:
            case["expectedError"] = {"keyword": error[0], "instancePath": error[1]}
        if assertions:
            case["semanticAssertions"] = assertions
        cases.append(case)
    suite = {
        "$schema": "urn:aseos:schema:example-suite:1.0.0",
        "suiteId": "first-slice-contract-examples",
        "suiteVersion": "1.1.0",
        "hashPolicy": {
            "payload": "SHA256_RFC8785_CANONICAL_JSON_UTF8",
            "schema": "SHA256_EXACT_AUTHORITY_FILE_BYTES",
            "artifact": "SHA256_RAW_BYTES",
        },
        "cases": cases,
    }
    write_json(f"{root}/example-suite.json", suite)

def build_inventory_and_registry() -> None:
    inventory_path = "packages/contracts/schema-inventory.json"
    inventory = load_json(inventory_path)
    inventory["$schema"] = "urn:aseos:schema:schema-inventory:1.1.0"
    inventory["inventoryVersion"] = "1.1.0"
    inventory["authority"] = {
        "inventoryPath": inventory_path,
        "schemaRoot": "packages/contracts/schemas",
        "catalogRef": "docs/contracts/core-contract-catalog.md",
        "architectureBaselineCommit": ARCH_BASELINE,
        "planningSourceCommit": PLANNING_SOURCE,
    }
    inventory["hashPolicy"] = "SHA256_EXACT_AUTHORITY_FILE_BYTES"
    for entry in inventory.get("contracts", []):
        rel = entry["authorityPath"]
        schema = load_json(rel)
        entry["schemaId"] = schema["$id"]
        entry["sha256"] = sha_file(rel)
        entry["hashPolicy"] = "SHA256_EXACT_AUTHORITY_FILE_BYTES"
        entry["exampleRequired"] = schema["$id"] != "urn:aseos:schema:common-identifiers:1.0.0"
    write_json(inventory_path, inventory)

    inventory_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:aseos:schema:schema-inventory:1.1.0",
        "x-schemaVersion": "1.1.0",
        "title": "ASEOS Active Schema Inventory",
        "type": "object",
        "additionalProperties": False,
        "required": [
            "$schema", "inventoryVersion", "schemaDialect", "authority",
            "identityPolicy", "statusVocabulary", "hashPolicy", "contracts",
            "plannedInventoryRef",
        ],
        "properties": {
            "$schema": {"const": "urn:aseos:schema:schema-inventory:1.1.0"},
            "inventoryVersion": {"const": "1.1.0"},
            "schemaDialect": {"const": "https://json-schema.org/draft/2020-12/schema"},
            "authority": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "inventoryPath", "schemaRoot", "catalogRef",
                    "architectureBaselineCommit", "planningSourceCommit",
                ],
                "properties": {
                    "inventoryPath": {"const": "packages/contracts/schema-inventory.json"},
                    "schemaRoot": {"const": "packages/contracts/schemas"},
                    "catalogRef": {"const": "docs/contracts/core-contract-catalog.md"},
                    "architectureBaselineCommit": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                    "planningSourceCommit": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                },
            },
            "identityPolicy": {"type": "object"},
            "statusVocabulary": {"type": "array", "minItems": 1, "uniqueItems": True},
            "hashPolicy": {"const": "SHA256_EXACT_AUTHORITY_FILE_BYTES"},
            "contracts": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "required": [
                        "contractId", "canonicalName", "domain", "canonicalOwner",
                        "contractKind", "schemaVersion", "status", "priority",
                        "phaseIntroduced", "authorityPath", "schemaId", "sha256",
                        "hashPolicy", "exampleRequired", "persisted", "publicBoundary",
                        "producers", "consumers", "dependsOn", "adrRefs",
                        "examplePaths", "verificationObligations",
                    ],
                    "properties": {
                        "contractId": {"type": "string", "pattern": "^aseos\\.[a-z0-9-]+(?:\\.[a-z0-9-]+)+$"},
                        "canonicalName": {"type": "string", "minLength": 1},
                        "domain": {"type": "string", "minLength": 1},
                        "canonicalOwner": {"type": "string", "pattern": "^packages/[a-z0-9-]+$"},
                        "contractKind": {"type": "string", "minLength": 1},
                        "schemaVersion": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/schemaVersion"},
                        "status": {"type": "string", "minLength": 1},
                        "priority": {"type": "string", "minLength": 1},
                        "phaseIntroduced": {"type": "string", "pattern": "^PHASE_[0-8]$"},
                        "authorityPath": {"type": "string", "minLength": 1},
                        "schemaId": {"type": "string", "format": "uri"},
                        "sha256": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/sha256"},
                        "hashPolicy": {"const": "SHA256_EXACT_AUTHORITY_FILE_BYTES"},
                        "exampleRequired": {"type": "boolean"},
                        "persisted": {"type": "boolean"},
                        "publicBoundary": {"type": "boolean"},
                        "sensitivity": {"type": "string"},
                        "producers": {"type": "array", "uniqueItems": True},
                        "consumers": {"type": "array", "uniqueItems": True},
                        "dependsOn": {"type": "array", "uniqueItems": True},
                        "adrRefs": {"type": "array", "uniqueItems": True},
                        "examplePaths": {"type": "array", "uniqueItems": True},
                        "verificationObligations": {"type": "array", "minItems": 1, "uniqueItems": True},
                        "notes": {"type": "string"},
                    },
                    "additionalProperties": False,
                },
            },
            "plannedInventoryRef": {"const": "packages/contracts/planned-contracts.json"},
        },
    }
    write_json("packages/contracts/schemas/meta/schema-inventory.schema.json", inventory_schema)
    # Hash changes after schema rewrite.
    inventory = load_json(inventory_path)
    for entry in inventory["contracts"]:
        rel = entry["authorityPath"]
        entry["sha256"] = sha_file(rel)
    write_json(inventory_path, inventory)

    schemas: list[dict[str, Any]] = []
    paths = sorted(
        list((ROOT / "packages/contracts/schemas").rglob("*.schema.json"))
        + list((ROOT / "operations/phase-1").glob("*.schema.json"))
    )
    for path in paths:
        rel = path.relative_to(ROOT).as_posix()
        schema = json.loads(path.read_text(encoding="utf-8"))
        sid = schema.get("$id")
        if not sid:
            raise RuntimeError(f"Schema missing $id: {rel}")
        if rel.startswith("packages/contracts/schemas/fixtures/"):
            category = "FIXTURE"
            examples_required = True
        elif rel.startswith("packages/contracts/schemas/meta/"):
            category = "META"
            examples_required = False
        elif rel.startswith("operations/"):
            category = "GOVERNANCE"
            examples_required = False
        else:
            category = "RUNTIME"
            examples_required = sid != "urn:aseos:schema:common-identifiers:1.0.0"
        schemas.append({
            "schemaId": sid,
            "authorityPath": rel,
            "sha256": sha_file(rel),
            "category": category,
            "examplesRequired": examples_required,
        })
    registry = {
        "$schema": "urn:aseos:schema:schema-registry:1.0.0",
        "registryVersion": "1.0.0",
        "hashPolicy": "SHA256_EXACT_AUTHORITY_FILE_BYTES",
        "schemas": schemas,
    }
    write_json("packages/contracts/schema-registry.json", registry)

def build_governance() -> None:
    write_scope_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:aseos:operation-schema:write-scope:1.1.0",
        "x-schemaVersion": "1.1.0",
        "title": "ASEOS Operation Write Scope",
        "type": "object",
        "additionalProperties": False,
        "required": [
            "$schema", "schemaVersion", "scopeId", "architectureBaselineCommit",
            "planningSourceCommit", "enforcementMode", "authorityLockRef",
            "globalAllowedPathGlobs", "globalDeniedPathGlobs",
            "prohibitedSemantics", "operations", "scopeExpansion",
        ],
        "properties": {
            "$schema": {"const": "urn:aseos:operation-schema:write-scope:1.1.0"},
            "schemaVersion": {"const": "1.1.0"},
            "scopeId": {"const": "P1-EXECUTABLE-REPOSITORY-FOUNDATION-WRITE-SCOPE"},
            "architectureBaselineCommit": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
            "planningSourceCommit": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
            "enforcementMode": {"const": "DENY_BY_DEFAULT"},
            "authorityLockRef": {"const": "operations/phase-1/authority-lock.json"},
            "globalAllowedPathGlobs": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
            "globalDeniedPathGlobs": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
            "prohibitedSemantics": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
            "operations": {
                "type": "array", "minItems": 9, "maxItems": 9,
                "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["operationId", "allowedPathGlobs", "deniedPathGlobs", "semanticConstraints", "requiredOutputs", "requiredOutputPathGlobs"],
                    "properties": {
                        "operationId": {"enum": [f"P1-O{i:02d}" for i in range(1, 10)]},
                        "allowedPathGlobs": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                        "deniedPathGlobs": {"type": "array", "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                        "semanticConstraints": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                        "requiredOutputs": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                        "requiredOutputPathGlobs": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                    },
                },
                "allOf": [
                    {"contains": {"properties": {"operationId": {"const": f"P1-O{i:02d}"}}, "required": ["operationId"]}}
                    for i in range(1, 10)
                ],
            },
            "scopeExpansion": {
                "type": "object", "additionalProperties": False,
                "required": ["mustStop", "requires", "forbiddenBehavior"],
                "properties": {
                    "mustStop": {"const": True},
                    "requires": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                    "forbiddenBehavior": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                },
            },
        },
    }
    write_json("operations/phase-1/write-scope.schema.json", write_scope_schema)

    global_allowed = [
        "package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "tsconfig.base.json",
        "tsconfig.*.json", ".npmrc", ".gitignore", "eslint.config.*",
        "prettier.config.*", "vitest.config.*", ".dependency-cruiser.*",
        "toolchain/**", ".github/workflows/quality.yml", ".github/workflows/release.yml",
        "apps/cli/**", "apps/runtime/**", "apps/worker/**",
        "packages/contracts/**", "packages/kernel/**", "packages/policy/**",
        "packages/persistence/**", "packages/platform/**", "packages/observability/**",
        "packages/adapters/tool/windows-process-restricted/**",
        "tests/architecture/**", "tests/contract/**", "tests/qualification/**",
        "tests/acceptance/**", "tests/fixtures/**", "tests/fault-injection/**",
        "tests/security/**", "schemas/release/**", "scripts/**",
        "operations/phase-1/evidence/**", "operations/phase-1/implementation-receipt.json",
        "docs/contracts/**", "docs/operations/**", "docs/implementation/phase-1/**",
        "docs/reviews/phase-1-*.md", "docs/roadmap/progress-status.md",
        "README.md", "docs/README.md",
    ]
    global_denied = [
        ".ai-local/**", ".ai-work/**", "artifacts/**", "dist/**", "node_modules/**",
        "packages/workflow/**", "packages/node-runtime/**", "packages/context/**",
        "packages/skills/**", "packages/verification/**", "packages/evidence/**",
        "packages/learning/**", "packages/adapters/model/**",
        "packages/adapters/knowledge/**", "packages/adapters/tool/os-sandboxed/**",
        "packages/adapters/tool/container-isolated/**",
        "packages/adapters/tool/remote-isolated/**",
        "operations/phase-1/operation.json", "operations/phase-1/write-scope.json",
        "operations/phase-1/verification-plan.json",
        "operations/phase-1/operation-manifest.schema.json",
        "operations/phase-1/write-scope.schema.json",
        "operations/phase-1/receipt.schema.json",
        "operations/phase-1/independent-verification-receipt.schema.json",
        "operations/phase-1/authority-lock.json",
        "operations/phase-1/authority-lock.schema.json",
        "operations/phase-1/preimplementation-policy-snapshot.json",
        "operations/phase-1/preimplementation-policy-snapshot.schema.json",
        "docs/roadmap/phase-1-operation-plan.md",
        "docs/roadmap/phase-1-write-scope.md",
        "docs/roadmap/phase-1-verification-plan.md",
        "docs/decisions/**",
    ]
    ops = [
        {
            "operationId": "P1-O01",
            "allowedPathGlobs": [
                "package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "tsconfig.base.json",
                "tsconfig.*.json", ".npmrc", ".gitignore", "eslint.config.*",
                "prettier.config.*", "vitest.config.*", "toolchain/**",
                "scripts/toolchain/**", "tests/qualification/toolchain/**",
                ".github/workflows/quality.yml", "docs/implementation/phase-1/o01/**",
                "operations/phase-1/evidence/o01/**",
            ],
            "deniedPathGlobs": ["apps/**", "packages/**"],
            "semanticConstraints": [
                "Pin Node.js 24.19.0, TypeScript 6.0.3 and pnpm 11.24.0 exactly.",
                "Use ESM-only, NodeNext, ES2025 and tsc -b as the authority build.",
                "Do not add production runtime behavior.",
            ],
            "requiredOutputs": [
                "clean frozen-lockfile install", "strict project-reference build",
                "toolchain manifest", "Windows and Linux clean-build Evidence",
            ],
            "requiredOutputPathGlobs": ["toolchain/**", "tests/qualification/toolchain/**", "operations/phase-1/evidence/o01/**"],
        },
        {
            "operationId": "P1-O02",
            "allowedPathGlobs": [
                "packages/contracts/**", "tests/contract/**", "scripts/contracts/**",
                "docs/contracts/**", "docs/implementation/phase-1/o02/**",
                "operations/phase-1/evidence/o02/**",
            ],
            "deniedPathGlobs": [
                "packages/kernel/**", "packages/workflow/**", "packages/node-runtime/**",
                "packages/context/**", "packages/skills/**", "packages/policy/**",
                "packages/verification/**", "packages/evidence/**", "packages/learning/**",
                "packages/persistence/**", "packages/adapters/**",
                "packages/observability/**", "packages/platform/**",
            ],
            "semanticConstraints": [
                "JSON Schema 2020-12 is runtime authority.",
                "Reject unknown fields and unsupported versions at public and persisted boundaries.",
                "Generated TypeScript types cannot replace runtime validation.",
                "Schema, inventory, registry, examples and compatibility Evidence change together.",
            ],
            "requiredOutputs": [
                "schema registry and validator", "inventory validation",
                "first-slice example suite", "schema/type consistency tests",
                "compatibility test harness",
            ],
            "requiredOutputPathGlobs": [
                "packages/contracts/**", "tests/contract/**",
                "operations/phase-1/evidence/o02/**",
            ],
        },
        {
            "operationId": "P1-O03",
            "allowedPathGlobs": [
                ".dependency-cruiser.*", "package.json", "pnpm-lock.yaml",
                "packages/contracts/package.json", "packages/contracts/tsconfig.json", "packages/contracts/src/index.ts",
                "packages/kernel/package.json", "packages/kernel/tsconfig.json", "packages/kernel/src/index.ts",
                "packages/policy/package.json", "packages/policy/tsconfig.json", "packages/policy/src/index.ts",
                "packages/persistence/package.json", "packages/persistence/tsconfig.json", "packages/persistence/src/index.ts",
                "packages/platform/package.json", "packages/platform/tsconfig.json", "packages/platform/src/index.ts",
                "packages/observability/package.json", "packages/observability/tsconfig.json", "packages/observability/src/index.ts",
                "packages/adapters/tool/windows-process-restricted/package.json",
                "packages/adapters/tool/windows-process-restricted/tsconfig.json",
                "packages/adapters/tool/windows-process-restricted/src/index.ts",
                "tests/architecture/**",
                "scripts/architecture/**", "docs/implementation/phase-1/o03/**",
                "operations/phase-1/evidence/o03/**",
            ],
            "deniedPathGlobs": [],
            "semanticConstraints": [
                "Create only packages required by a real Phase 1 consumer.",
                "Enforce public entry points, no deep import, no cycles and dependency direction.",
                "Canonical owner declarations are machine-checkable.",
                "Architecture tests inspect metadata and public contracts, not obsolete source text.",
            ],
            "requiredOutputs": [
                "package DAG check", "deep-import denial", "cycle denial",
                "dependency-inversion denial", "duplicate-semantic-owner denial",
            ],
            "requiredOutputPathGlobs": ["tests/architecture/**", "operations/phase-1/evidence/o03/**"],
        },
        {
            "operationId": "P1-O04",
            "allowedPathGlobs": [
                "packages/policy/**", "packages/contracts/schemas/policy/**",
                "packages/contracts/examples/policy/**", "tests/contract/policy/**",
                "tests/qualification/policy/**", "docs/implementation/phase-1/o04/**",
                "operations/phase-1/evidence/o04/**",
            ],
            "deniedPathGlobs": [],
            "semanticConstraints": [
                "packages/policy is the only V1 authoritative evaluator.",
                "Policy input and captured clock are explicit and evaluation performs no I/O.",
                "Default deny, deny-overrides and INDETERMINATE fail closed.",
                "Restricted YAML is authoring input only; canonical JSON and hash are authority.",
                "No third-party policy authority or dynamic policy module loading.",
            ],
            "requiredOutputs": [
                "PolicySet Rule Input Snapshot schemas", "restricted parser",
                "canonicalization/hash fixtures", "deterministic evaluator skeleton",
                "property and mutation qualification Evidence",
            ],
            "requiredOutputPathGlobs": [
                "packages/policy/**", "tests/qualification/policy/**",
                "operations/phase-1/evidence/o04/**",
            ],
        },
        {
            "operationId": "P1-O05",
            "allowedPathGlobs": [
                "packages/persistence/**", "packages/contracts/schemas/persistence/**",
                "tests/qualification/persistence/**", "tests/fault-injection/persistence/**",
                "scripts/qualification/persistence/**", "docs/implementation/phase-1/o05/**",
                "operations/phase-1/evidence/o05/**",
            ],
            "deniedPathGlobs": [],
            "semanticConstraints": [
                "Use only Node.js 24.19.0 node:sqlite and SQLite 3.53.3.",
                "All SQLite calls run in a dedicated PersistenceWorker.",
                "One authoritative database and transaction cover Event, receipt, outbox, inbox and required audit.",
                "No SQL or driver type crosses the persistence public boundary.",
                "No alternate driver or fallback; qualification failure stops and requires a superseding ADR.",
            ],
            "requiredOutputs": [
                "SQLite qualification harness", "transaction and crash tests",
                "WAL and recovery tests", "backup restore and corruption quarantine",
                "event-loop responsiveness Evidence", "runtime version attestation",
            ],
            "requiredOutputPathGlobs": [
                "packages/persistence/**", "tests/fault-injection/persistence/**",
                "operations/phase-1/evidence/o05/**",
            ],
        },
        {
            "operationId": "P1-O06",
            "allowedPathGlobs": [
                "packages/platform/**", "apps/runtime/**", "apps/cli/**",
                "packages/contracts/schemas/control-api/**",
                "tests/qualification/control-api/**", "tests/acceptance/control-api/**",
                "scripts/qualification/control-api/**", "docs/implementation/phase-1/o06/**",
                "operations/phase-1/evidence/o06/**",
            ],
            "deniedPathGlobs": [],
            "semanticConstraints": [
                "Bind only 127.0.0.1 on an OS-assigned port.",
                "All endpoints require a rotated bearer token stored with user-only ACL.",
                "Mutations require Idempotency-Key and version conflict semantics.",
                "CLI uses only the public Control API client and never accesses SQLite or Kernel internals.",
                "No remote binding, second transport or authoritative SSE.",
            ],
            "requiredOutputs": [
                "OpenAPI 3.1.1 baseline", "endpoint discovery and stale detection",
                "token lifecycle and redaction", "exposure and CSRF tests",
                "minimal version doctor start stop status acceptance",
            ],
            "requiredOutputPathGlobs": [
                "packages/platform/**", "tests/qualification/control-api/**",
                "operations/phase-1/evidence/o06/**",
            ],
        },
        {
            "operationId": "P1-O07",
            "allowedPathGlobs": [
                "packages/adapters/tool/windows-process-restricted/**", "apps/worker/**",
                "packages/contracts/schemas/isolation/**", "tests/qualification/isolation/**",
                "tests/security/isolation/**", "scripts/qualification/isolation/**",
                "docs/implementation/phase-1/o07/**",
                "operations/phase-1/evidence/o07/**",
            ],
            "deniedPathGlobs": [
                "packages/adapters/tool/os-sandboxed/**",
                "packages/adapters/tool/container-isolated/**",
                "packages/adapters/tool/remote-isolated/**",
            ],
            "semanticConstraints": [
                "PROCESS_RESTRICTED is lifecycle and resource containment, not a security sandbox.",
                "Use Job Object kill-on-close and bounded process tree and resources.",
                "No shell:true or raw model command string by default.",
                "No secret or token inheritance; staged cwd and path controls are mandatory.",
                "Unavailable required isolation blocks; no downward fallback.",
            ],
            "requiredOutputs": [
                "capability probe", "Job Object lifecycle Evidence",
                "child and grandchild termination tests", "resource environment and path tests",
                "IsolationEvidence and no-downgrade property tests",
            ],
            "requiredOutputPathGlobs": [
                "packages/adapters/tool/windows-process-restricted/**",
                "tests/security/isolation/**", "operations/phase-1/evidence/o07/**",
            ],
        },
        {
            "operationId": "P1-O08",
            "allowedPathGlobs": [
                "apps/runtime/**", "apps/cli/**", "apps/worker/**", "packages/platform/**",
                "packages/observability/**", "schemas/release/**", "scripts/release/**",
                ".github/workflows/release.yml", "tests/acceptance/release/**",
                "tests/qualification/packaging/**", "docs/operations/**",
                "docs/implementation/phase-1/o08/**",
                "operations/phase-1/evidence/o08/**",
            ],
            "deniedPathGlobs": [],
            "semanticConstraints": [
                "Produce a self-contained Windows-first qualification artifact with pinned runtime.",
                "Release directory and local data root are separated.",
                "Build uses a frozen lockfile and pinned actions and downloads.",
                "Generate checksums, SBOM and provenance where supported.",
                "No production auto-update service or floating unsigned download.",
            ],
            "requiredOutputs": [
                "qualification release artifact", "manifest checksum SBOM provenance",
                "clean Windows startup", "Chinese and space path smoke",
                "no-development-toolchain startup Evidence",
            ],
            "requiredOutputPathGlobs": [
                "schemas/release/**", "tests/qualification/packaging/**",
                "operations/phase-1/evidence/o08/**",
            ],
        },
        {
            "operationId": "P1-O09",
            "allowedPathGlobs": [
                "tests/architecture/**", "tests/contract/**", "tests/qualification/**",
                "tests/acceptance/**", "tests/fault-injection/**", "tests/security/**",
                "scripts/verify-phase-1/**", "operations/phase-1/implementation-receipt.json",
                "operations/phase-1/evidence/o09/**", "docs/reviews/phase-1-*.md",
                "docs/implementation/phase-1/o09/**", "docs/roadmap/progress-status.md",
                "README.md", "docs/README.md",
            ],
            "deniedPathGlobs": [],
            "semanticConstraints": [
                "Run verification from a clean checkout and immutable commit.",
                "Do not remediate failures inside the independent verification pass.",
                "Every skipped unavailable blocked or inconclusive step remains explicit.",
                "Implementation may declare IMPLEMENTED only; VERIFIED requires independent Gate.",
                "No new production feature implementation.",
            ],
            "requiredOutputs": [
                "complete structured receipt", "Evidence index", "known-gap list",
                "independent verification input bundle", "Phase 1 Gate recommendation",
            ],
            "requiredOutputPathGlobs": [
                "operations/phase-1/implementation-receipt.json",
                "operations/phase-1/evidence/o09/**",
                "docs/reviews/phase-1-*.md",
            ],
        },
    ]
    write_scope = {
        "$schema": "urn:aseos:operation-schema:write-scope:1.1.0",
        "schemaVersion": "1.1.0",
        "scopeId": "P1-EXECUTABLE-REPOSITORY-FOUNDATION-WRITE-SCOPE",
        "architectureBaselineCommit": ARCH_BASELINE,
        "planningSourceCommit": PLANNING_SOURCE,
        "enforcementMode": "DENY_BY_DEFAULT",
        "authorityLockRef": "operations/phase-1/authority-lock.json",
        "globalAllowedPathGlobs": global_allowed,
        "globalDeniedPathGlobs": global_denied,
        "prohibitedSemantics": [
            "Implement production Workflow or Node state machines, Router, Scheduler, terminal transition, retry or recovery semantics.",
            "Implement the production Verification System, EvidenceGraph or Learning runtime.",
            "Connect real model providers, GBrain, swap-kb, microwave-kb or private local assets.",
            "Introduce a second persistence driver, Control API transport, Policy evaluator or isolation authority.",
            "Use silent fallback or downward isolation downgrade.",
            "Let CLI or UI read SQLite or import Kernel or persistence internals.",
            "Let Adapter, Worker, Model or test helper create authoritative DomainEvent, terminal state, PolicyDecision or GateDecision.",
            "Batch-create empty future packages or interfaces with no Phase 1 consumer and conformance test.",
            "Copy old local Framework source.",
            "Upload or commit local private data, secrets, Evidence, Workspace or knowledge content.",
        ],
        "operations": ops,
        "scopeExpansion": {
            "mustStop": True,
            "requires": [
                "A written finding identifying the missing path or semantic scope.",
                "Architecture authority and user approval.",
                "Updated Operation Plan, WRITE_SCOPE and VerificationPlan.",
                "A new or superseding ADR when an accepted decision changes.",
            ],
            "forbiddenBehavior": [
                "Do not edit outside allowed paths before approval.",
                "Do not use generated files, rename or copy to bypass a denied path.",
                "Do not introduce a temporary fallback.",
                "Do not continue and report success after a scope violation.",
            ],
        },
    }
    write_json("operations/phase-1/write-scope.json", write_scope)

    operation_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:aseos:operation-schema:operation-manifest:1.1.0",
        "x-schemaVersion": "1.1.0",
        "title": "ASEOS Phase 1 Operation Manifest",
        "type": "object",
        "additionalProperties": False,
        "required": [
            "$schema", "schemaVersion", "operationId", "title",
            "architectureBaselineCommit", "planningSourceCommit",
            "executionBaselinePolicy", "riskClass", "status", "m0GateRef",
            "authorityLockRef", "authorityRefs", "prerequisites", "objectives",
            "nonGoals", "suboperations", "writeScopeRef", "verificationPlanRef",
            "receiptSchemaRef", "independentVerificationReceiptSchemaRef",
            "stopConditions", "completionCriteria", "declarationRules",
        ],
        "properties": {
            "$schema": {"const": "urn:aseos:operation-schema:operation-manifest:1.1.0"},
            "schemaVersion": {"const": "1.1.0"},
            "operationId": {"const": "P1-EXECUTABLE-REPOSITORY-FOUNDATION"},
            "title": {"type": "string", "minLength": 1},
            "architectureBaselineCommit": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
            "planningSourceCommit": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
            "executionBaselinePolicy": {"const": "M0_GATE_COMMIT_DESCENDANT_OF_PLANNING_SOURCE"},
            "riskClass": {"const": "R4"},
            "status": {"const": "PLANNED"},
            "m0GateRef": {"const": "docs/reviews/m0-architecture-baseline-verified.md"},
            "authorityLockRef": {"const": "operations/phase-1/authority-lock.json"},
            "authorityRefs": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
            "prerequisites": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
            "objectives": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
            "nonGoals": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
            "suboperations": {
                "type": "array", "minItems": 9, "maxItems": 9,
                "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["operationId", "title", "riskClass", "dependsOn", "writeScopeOperationId", "outputs", "gateStepIds"],
                    "properties": {
                        "operationId": {"enum": [f"P1-O{i:02d}" for i in range(1, 10)]},
                        "title": {"type": "string", "minLength": 1},
                        "riskClass": {"enum": ["R3", "R4"]},
                        "dependsOn": {"type": "array", "uniqueItems": True, "items": {"enum": [f"P1-O{i:02d}" for i in range(1, 10)]}},
                        "writeScopeOperationId": {"enum": [f"P1-O{i:02d}" for i in range(1, 10)]},
                        "outputs": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                        "gateStepIds": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"pattern": "^P1-V[0-9]{2}-.+$"}},
                    },
                },
                "allOf": [
                    {"contains": {"properties": {"operationId": {"const": f"P1-O{i:02d}"}}, "required": ["operationId"]}}
                    for i in range(1, 10)
                ],
            },
            "writeScopeRef": {"const": "operations/phase-1/write-scope.json"},
            "verificationPlanRef": {"const": "operations/phase-1/verification-plan.json"},
            "receiptSchemaRef": {"const": "operations/phase-1/receipt.schema.json"},
            "independentVerificationReceiptSchemaRef": {"const": "operations/phase-1/independent-verification-receipt.schema.json"},
            "stopConditions": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
            "completionCriteria": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
            "declarationRules": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
        },
    }
    write_json("operations/phase-1/operation-manifest.schema.json", operation_schema)

    subops = [
        ("P1-O01", "Toolchain and reproducible monorepo foundation", "R3", [], ["Exact toolchain manifest and frozen lockfile", "Strict ESM project-reference build", "Windows and Linux clean-build Evidence"], ["P1-V00-M0-AUTHORIZATION", "P1-V01-PREFLIGHT", "P1-V02-TOOLCHAIN"]),
        ("P1-O02", "Machine-readable Contract system foundation", "R3", ["P1-O01"], ["Schema registry and runtime validator", "Inventory and example semantic validation", "Schema and type consistency harness"], ["P1-V03-CONTRACTS"]),
        ("P1-O03", "Architecture dependency and semantic-owner enforcement", "R3", ["P1-O01", "P1-O02"], ["Machine-checkable package DAG", "Public-entry deep-import and cycle checks", "Duplicate semantic-owner check"], ["P1-V04-ARCHITECTURE"]),
        ("P1-O04", "Deterministic Policy compiler and evaluator qualification", "R4", ["P1-O02", "P1-O03"], ["Policy schemas and restricted compiler", "Canonical JSON and hash fixtures", "Fail-closed evaluator skeleton and Evidence"], ["P1-V05-POLICY"]),
        ("P1-O05", "SQLite node:sqlite authority-storage qualification", "R4", ["P1-O01", "P1-O02", "P1-O03"], ["PersistenceWorker qualification implementation", "Crash transaction and recovery Evidence", "Backup corruption and performance Evidence"], ["P1-V06-PERSISTENCE"]),
        ("P1-O06", "Authenticated loopback Control API and lifecycle qualification", "R4", ["P1-O01", "P1-O02", "P1-O03"], ["OpenAPI 3.1.1 baseline", "Runtime discovery and token lifecycle", "CLI public-client acceptance"], ["P1-V07-CONTROL-API"]),
        ("P1-O07", "Windows PROCESS_RESTRICTED worker qualification", "R4", ["P1-O01", "P1-O02", "P1-O03", "P1-O04"], ["Capability probe and IsolationEvidence", "Job Object process-tree lifecycle", "No-downgrade path and environment Evidence"], ["P1-V08-ISOLATION"]),
        ("P1-O08", "Self-contained qualification release and supply-chain baseline", "R4", ["P1-O01", "P1-O02", "P1-O03", "P1-O05", "P1-O06", "P1-O07"], ["Windows qualification artifact", "Release manifest checksum SBOM and provenance", "Clean-machine startup Evidence"], ["P1-V09-PACKAGING"]),
        ("P1-O09", "Integrated Phase 1 verification handoff", "R4", [f"P1-O{i:02d}" for i in range(1, 9)], ["Structured implementation receipt", "Evidence index and known gaps", "Independent-verification input bundle"], ["P1-V10-INTEGRATED-GATE"]),
    ]
    operation = {
        "$schema": "urn:aseos:operation-schema:operation-manifest:1.1.0",
        "schemaVersion": "1.1.0",
        "operationId": "P1-EXECUTABLE-REPOSITORY-FOUNDATION",
        "title": "Phase 1 — Executable Repository Foundation",
        "architectureBaselineCommit": ARCH_BASELINE,
        "planningSourceCommit": PLANNING_SOURCE,
        "executionBaselinePolicy": "M0_GATE_COMMIT_DESCENDANT_OF_PLANNING_SOURCE",
        "riskClass": "R4",
        "status": "PLANNED",
        "m0GateRef": "docs/reviews/m0-architecture-baseline-verified.md",
        "authorityLockRef": "operations/phase-1/authority-lock.json",
        "authorityRefs": [
            "docs/architecture/01-framework-charter.md",
            "docs/architecture/02-target-architecture.md",
            "docs/architecture/03-durable-execution-model.md",
            "docs/architecture/08-security-and-governance.md",
            "docs/architecture/11-nonfunctional-requirements.md",
            "docs/contracts/core-contract-catalog.md",
            "packages/contracts/schema-inventory.json",
            "packages/contracts/schema-registry.json",
            "docs/engineering/repository-blueprint.md",
            "docs/engineering/engineering-standard.md",
            "docs/engineering/quality-gates.md",
            "docs/reviews/phase-0-independent-architecture-review.md",
            *[f"docs/decisions/ADR-{i:04d}-" for i in range(7, 12)],
        ],
        "prerequisites": [
            "M0 Architecture Baseline Verified is PASS and identifies the immutable Phase 1 start commit.",
            "Phase 0 independent architecture review has no open P0 or P1 ownership conflict.",
            "ADR-0001 through ADR-0011 are ACCEPTED.",
            "The schema inventory, complete schema registry, active JSON Schemas, examples and semantic integrity checks pass.",
            "The implementation starts from the M0-authorized commit or an approved rebase that revalidates the authority lock.",
            "Main branch protection and required Phase 1 checks are enabled before implementation merge.",
            "Every suboperation uses a short-lived branch or PR and its own Evidence.",
        ],
        "objectives": [
            "Create a reproducible strict TypeScript monorepo that builds from a clean checkout.",
            "Establish runtime-validated Contract and schema infrastructure.",
            "Enforce package dependency direction and unique authority ownership.",
            "Qualify the accepted toolchain, node:sqlite, Control API, PROCESS_RESTRICTED and Policy decisions.",
            "Produce a self-contained Windows-first qualification artifact and release Evidence.",
            "Provide a repository foundation for Phase 2 without hidden technical decisions.",
        ],
        "nonGoals": [
            "Do not implement production Workflow, Node Runtime, Router, Scheduler or terminal transitions.",
            "Do not implement production Verification System, EvidenceGraph or Learning runtime.",
            "Do not connect real models, tools, GBrain or private Workspaces.",
            "Do not implement OS_SANDBOXED, Human Approval lifecycle or remote execution.",
            "Do not claim a production-ready installer or complete Framework.",
            "Do not migrate or copy old local Framework source.",
        ],
        "suboperations": [
            {
                "operationId": oid, "title": title, "riskClass": risk,
                "dependsOn": deps, "writeScopeOperationId": oid,
                "outputs": outputs, "gateStepIds": gates,
            }
            for oid, title, risk, deps, outputs, gates in subops
        ],
        "writeScopeRef": "operations/phase-1/write-scope.json",
        "verificationPlanRef": "operations/phase-1/verification-plan.json",
        "receiptSchemaRef": "operations/phase-1/receipt.schema.json",
        "independentVerificationReceiptSchemaRef": "operations/phase-1/independent-verification-receipt.schema.json",
        "stopConditions": [
            "The M0 Gate or authority lock cannot be verified against the implementation baseline.",
            "An accepted ADR cannot be implemented as specified or qualification contradicts its claims.",
            "Any required change falls outside the current operation WRITE_SCOPE.",
            "A second authority implementation, fallback driver, transport, evaluator or silent isolation downgrade appears necessary.",
            "A public or persisted Contract has ambiguous owner or cannot be runtime-validated.",
            "A required R4 verification step is not PASS.",
            "Secrets or private local data would need to enter the repository or GitHub workflow.",
            "Clean Windows and Linux build, API exposure control or process containment cannot be demonstrated.",
            "The repository baseline changes concurrently and invalidates Evidence or scope.",
        ],
        "completionCriteria": [
            "All P1-O01 through P1-O09 are IMPLEMENTED with outputs and commit references.",
            "P1-V00 through P1-V10 all PASS with Evidence.",
            "The repository builds from a clean checkout with the exact accepted toolchain.",
            "Architecture checks prevent dependency inversion, deep imports, cycles and duplicate authority ownership.",
            "Every qualification obligation from ADR-0007 through ADR-0011 is PASS.",
            "A self-contained Windows qualification artifact starts without local development tools and stays inside its test data root.",
            "The implementation receipt validates and declares at most IMPLEMENTED.",
            "An independent verifier can reproduce the Gate from public scripts and recorded environment facts.",
        ],
        "declarationRules": [
            "The implementation Agent may declare IMPLEMENTED, PARTIAL or BLOCKED.",
            "The implementation Agent must not declare VERIFIED.",
            "Each suboperation records commands, environment, commit, results, Evidence and gaps.",
            "Skipped unavailable blocked and inconclusive results remain visible and prevent completion.",
            "Independent verification occurs on an immutable commit without remediation in the same pass.",
        ],
    }
    # Replace placeholder ADR path prefixes with exact files.
    exact_adrs = [
        "docs/decisions/ADR-0007-typescript-toolchain-baseline.md",
        "docs/decisions/ADR-0008-embedded-persistence-sqlite.md",
        "docs/decisions/ADR-0009-local-control-api-protocol.md",
        "docs/decisions/ADR-0010-windows-execution-isolation.md",
        "docs/decisions/ADR-0011-policy-engine-and-representation.md",
    ]
    operation["authorityRefs"] = [x for x in operation["authorityRefs"] if not x.startswith("docs/decisions/ADR-00")] + exact_adrs
    write_json("operations/phase-1/operation.json", operation)

    # Receipt schemas.
    op_ids = [f"P1-O{i:02d}" for i in range(1, 10)]
    step_ids = [
        "P1-V00-M0-AUTHORIZATION", "P1-V01-PREFLIGHT", "P1-V02-TOOLCHAIN",
        "P1-V03-CONTRACTS", "P1-V04-ARCHITECTURE", "P1-V05-POLICY",
        "P1-V06-PERSISTENCE", "P1-V07-CONTROL-API", "P1-V08-ISOLATION",
        "P1-V09-PACKAGING", "P1-V10-INTEGRATED-GATE",
    ]
    adr_ids = [f"ADR-{i:04d}" for i in range(7, 12)]
    contains_ops = [{"contains": {"properties": {"operationId": {"const": oid}}, "required": ["operationId"]}} for oid in op_ids]
    contains_steps = [{"contains": {"properties": {"stepId": {"const": sid}}, "required": ["stepId"]}} for sid in step_ids]
    contains_adrs = [{"contains": {"properties": {"adrRef": {"const": aid}}, "required": ["adrRef"]}} for aid in adr_ids]
    receipt_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:aseos:operation-schema:phase-1-receipt:1.1.0",
        "x-schemaVersion": "1.1.0",
        "title": "Phase 1 Implementation Receipt",
        "type": "object", "additionalProperties": False,
        "required": [
            "$schema", "schemaVersion", "operationId", "m0GateRef", "authorityLockHash",
            "baselineCommit", "implementationCommit", "implementationDeclaration",
            "declaredBy", "startedAt", "completedAt", "writeScope", "suboperations",
            "verification", "qualificationObligations", "evidenceRefs", "knownGaps",
            "stopCondition", "unauthorizedFallbackUsed", "documentationSynchronized",
        ],
        "properties": {
            "$schema": {"const": "urn:aseos:operation-schema:phase-1-receipt:1.1.0"},
            "schemaVersion": {"const": "1.1.0"},
            "operationId": {"const": "P1-EXECUTABLE-REPOSITORY-FOUNDATION"},
            "m0GateRef": {"const": "docs/reviews/m0-architecture-baseline-verified.md"},
            "authorityLockHash": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/sha256"},
            "baselineCommit": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
            "implementationCommit": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
            "implementationDeclaration": {"enum": ["IMPLEMENTED", "PARTIAL", "BLOCKED"]},
            "declaredBy": {
                "type": "object", "additionalProperties": False,
                "required": ["role", "actorId"],
                "properties": {
                    "role": {"const": "IMPLEMENTATION_AGENT"},
                    "actorId": {"type": "string", "minLength": 1},
                    "agentVersion": {"type": "string", "minLength": 1},
                },
            },
            "startedAt": {"type": "string", "format": "date-time"},
            "completedAt": {"type": "string", "format": "date-time"},
            "writeScope": {
                "type": "object", "additionalProperties": False,
                "required": ["scopeId", "authorityLockVerified", "compliant", "changedPaths", "generatedPaths", "violations"],
                "properties": {
                    "scopeId": {"const": "P1-EXECUTABLE-REPOSITORY-FOUNDATION-WRITE-SCOPE"},
                    "authorityLockVerified": {"type": "boolean"},
                    "compliant": {"type": "boolean"},
                    "changedPaths": {"type": "array", "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                    "generatedPaths": {"type": "array", "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                    "violations": {"type": "array", "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                },
            },
            "suboperations": {
                "type": "array", "minItems": 9, "maxItems": 9,
                "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["operationId", "status", "commitRefs", "outputs", "findings"],
                    "properties": {
                        "operationId": {"enum": op_ids},
                        "status": {"enum": ["IMPLEMENTED", "PARTIAL", "BLOCKED", "NOT_STARTED"]},
                        "commitRefs": {"type": "array", "uniqueItems": True, "items": {"type": "string", "pattern": "^[0-9a-f]{40}$"}},
                        "outputs": {"type": "array", "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                        "findings": {"type": "array", "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                    },
                },
                "allOf": contains_ops,
            },
            "verification": {
                "type": "object", "additionalProperties": False,
                "required": ["planId", "planHash", "executions", "overallResult"],
                "properties": {
                    "planId": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/uuidV7"},
                    "planHash": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/sha256"},
                    "executions": {
                        "type": "array", "minItems": 11, "maxItems": 11,
                        "items": {
                            "type": "object", "additionalProperties": False,
                            "required": ["stepId", "environment", "command", "result", "evidenceRefs"],
                            "properties": {
                                "stepId": {"enum": step_ids},
                                "environment": {"type": "string", "minLength": 1},
                                "command": {"type": "string", "minLength": 1},
                                "result": {"enum": ["PASS", "FAIL", "BLOCKED", "UNAVAILABLE", "INCONCLUSIVE", "NOT_RUN"]},
                                "exitCode": {"type": ["integer", "null"]},
                                "durationMs": {"type": "integer", "minimum": 0},
                                "evidenceRefs": {"type": "array", "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                                "notes": {"type": "string", "minLength": 1},
                            },
                            "allOf": [
                                {"if": {"properties": {"result": {"const": "PASS"}}, "required": ["result"]},
                                 "then": {"properties": {"evidenceRefs": {"minItems": 1}}}}
                            ],
                        },
                        "allOf": contains_steps,
                    },
                    "overallResult": {"enum": ["PASS", "FAIL", "BLOCKED", "INCONCLUSIVE", "NOT_RUN"]},
                },
            },
            "qualificationObligations": {
                "type": "array", "minItems": 5, "maxItems": 5,
                "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["obligationId", "adrRef", "result", "evidenceRefs"],
                    "properties": {
                        "obligationId": {"type": "string", "minLength": 1},
                        "adrRef": {"enum": adr_ids},
                        "result": {"enum": ["PASS", "FAIL", "BLOCKED", "INCONCLUSIVE", "NOT_RUN"]},
                        "evidenceRefs": {"type": "array", "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                        "notes": {"type": "string", "minLength": 1},
                    },
                    "allOf": [
                        {"if": {"properties": {"result": {"const": "PASS"}}, "required": ["result"]},
                         "then": {"properties": {"evidenceRefs": {"minItems": 1}}}}
                    ],
                },
                "allOf": contains_adrs,
            },
            "evidenceRefs": {"type": "array", "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
            "knownGaps": {"type": "array", "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
            "stopCondition": {
                "type": "object", "additionalProperties": False,
                "required": ["triggered", "condition", "action"],
                "properties": {
                    "triggered": {"type": "boolean"},
                    "condition": {"type": ["string", "null"]},
                    "action": {"type": "string", "minLength": 1},
                },
                "allOf": [
                    {"if": {"properties": {"triggered": {"const": False}}, "required": ["triggered"]},
                     "then": {"properties": {"condition": {"type": "null"}}}},
                    {"if": {"properties": {"triggered": {"const": True}}, "required": ["triggered"]},
                     "then": {"properties": {"condition": {"type": "string", "minLength": 1}}}},
                ],
            },
            "unauthorizedFallbackUsed": {"const": False},
            "documentationSynchronized": {"type": "boolean"},
            "independentVerificationRef": {"type": ["string", "null"]},
        },
        "allOf": [
            {
                "if": {"properties": {"implementationDeclaration": {"const": "IMPLEMENTED"}}, "required": ["implementationDeclaration"]},
                "then": {
                    "properties": {
                        "writeScope": {"properties": {
                            "authorityLockVerified": {"const": True},
                            "compliant": {"const": True},
                            "violations": {"maxItems": 0},
                        }},
                        "suboperations": {"items": {"properties": {
                            "status": {"const": "IMPLEMENTED"},
                            "commitRefs": {"minItems": 1},
                            "outputs": {"minItems": 1},
                        }}},
                        "verification": {"properties": {
                            "executions": {"items": {"properties": {
                                "result": {"const": "PASS"},
                                "evidenceRefs": {"minItems": 1},
                            }}},
                            "overallResult": {"const": "PASS"},
                        }},
                        "qualificationObligations": {"items": {"properties": {
                            "result": {"const": "PASS"},
                            "evidenceRefs": {"minItems": 1},
                        }}},
                        "evidenceRefs": {"minItems": 1},
                        "stopCondition": {"properties": {"triggered": {"const": False}}},
                        "documentationSynchronized": {"const": True},
                    }
                },
            },
            {
                "if": {"properties": {"implementationDeclaration": {"const": "BLOCKED"}}, "required": ["implementationDeclaration"]},
                "then": {"properties": {
                    "stopCondition": {"properties": {"triggered": {"const": True}}},
                    "verification": {"properties": {"overallResult": {"enum": ["FAIL", "BLOCKED", "INCONCLUSIVE", "NOT_RUN"]}}},
                }},
            },
        ],
    }
    write_json("operations/phase-1/receipt.schema.json", receipt_schema)

    independent_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:aseos:operation-schema:phase-1-independent-verification-receipt:1.0.0",
        "x-schemaVersion": "1.0.0",
        "title": "Phase 1 Independent Verification Receipt",
        "type": "object", "additionalProperties": False,
        "required": [
            "$schema", "schemaVersion", "operationId", "implementationCommit",
            "implementationReceiptHash", "verifiedBy", "startedAt", "completedAt",
            "readOnlyVerification", "stepResults", "gateDecision", "evidenceRefs",
            "remediationPerformed",
        ],
        "properties": {
            "$schema": {"const": "urn:aseos:operation-schema:phase-1-independent-verification-receipt:1.0.0"},
            "schemaVersion": {"const": "1.0.0"},
            "operationId": {"const": "P1-EXECUTABLE-REPOSITORY-FOUNDATION"},
            "implementationCommit": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
            "implementationReceiptHash": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/sha256"},
            "verifiedBy": {
                "type": "object", "additionalProperties": False,
                "required": ["role", "actorId"],
                "properties": {
                    "role": {"const": "INDEPENDENT_VERIFIER"},
                    "actorId": {"type": "string", "minLength": 1},
                    "verifierVersion": {"type": "string", "minLength": 1},
                },
            },
            "startedAt": {"type": "string", "format": "date-time"},
            "completedAt": {"type": "string", "format": "date-time"},
            "readOnlyVerification": {"const": True},
            "stepResults": {
                "type": "array", "minItems": 11, "maxItems": 11,
                "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["stepId", "result", "evidenceRefs"],
                    "properties": {
                        "stepId": {"enum": step_ids},
                        "result": {"enum": ["PASS", "FAIL", "BLOCKED", "INCONCLUSIVE"]},
                        "evidenceRefs": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
                        "notes": {"type": "string"},
                    },
                },
                "allOf": contains_steps,
            },
            "gateDecision": {"enum": ["PASS", "REWORK", "BLOCK", "INCONCLUSIVE"]},
            "evidenceRefs": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
            "remediationPerformed": {"const": False},
        },
        "allOf": [
            {
                "if": {"properties": {"gateDecision": {"const": "PASS"}}, "required": ["gateDecision"]},
                "then": {"properties": {"stepResults": {"items": {"properties": {"result": {"const": "PASS"}}}}}},
            }
        ],
    }
    write_json("operations/phase-1/independent-verification-receipt.schema.json", independent_schema)

    lock_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:aseos:operation-schema:authority-lock:1.0.0",
        "x-schemaVersion": "1.0.0",
        "title": "ASEOS Phase 1 Authority Lock",
        "type": "object", "additionalProperties": False,
        "required": [
            "$schema", "schemaVersion", "lockId", "architectureBaselineCommit",
            "planningSourceCommit", "hashPolicy", "authorityFiles",
            "excludedSelfPath", "verificationRules",
        ],
        "properties": {
            "$schema": {"const": "urn:aseos:operation-schema:authority-lock:1.0.0"},
            "schemaVersion": {"const": "1.0.0"},
            "lockId": {"const": "P1-AUTHORITY-LOCK-1"},
            "architectureBaselineCommit": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
            "planningSourceCommit": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
            "hashPolicy": {"const": "SHA256_EXACT_UTF8_LF_FILE_BYTES"},
            "authorityFiles": {
                "type": "array", "minItems": 1,
                "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["path", "sha256", "role", "mutationPolicy", "allowedOperationIds"],
                    "properties": {
                        "path": {"type": "string", "minLength": 1},
                        "sha256": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/sha256"},
                        "role": {"type": "string", "minLength": 1},
                        "mutationPolicy": {"enum": ["IMMUTABLE", "OPERATION_SCOPED"]},
                        "allowedOperationIds": {"type": "array", "uniqueItems": True, "items": {"enum": op_ids}},
                    },
                },
            },
            "excludedSelfPath": {"const": "operations/phase-1/authority-lock.json"},
            "verificationRules": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
        },
    }
    write_json("operations/phase-1/authority-lock.schema.json", lock_schema)

    policy_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:aseos:operation-schema:preimplementation-policy-snapshot:1.0.0",
        "x-schemaVersion": "1.0.0",
        "title": "M0 Preimplementation Policy Snapshot",
        "type": "object", "additionalProperties": False,
        "required": ["$schema", "schemaVersion", "snapshotId", "defaultDecision", "hardInvariants"],
        "properties": {
            "$schema": {"const": "urn:aseos:operation-schema:preimplementation-policy-snapshot:1.0.0"},
            "schemaVersion": {"const": "1.0.0"},
            "snapshotId": {"type": "string", "minLength": 1},
            "defaultDecision": {"const": "DENY"},
            "hardInvariants": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string", "minLength": 1}},
        },
    }
    policy_snapshot = {
        "$schema": "urn:aseos:operation-schema:preimplementation-policy-snapshot:1.0.0",
        "schemaVersion": "1.0.0",
        "snapshotId": "M0-PREIMPLEMENTATION-POLICY-1",
        "defaultDecision": "DENY",
        "hardInvariants": [
            "MODEL_ADAPTER_EXECUTOR_CANNOT_COMMIT_AUTHORITY_STATE",
            "INVALID_OR_UNSUPPORTED_SCHEMA_FAILS_CLOSED",
            "CACHE_PROJECTION_TELEMETRY_ARE_NOT_FACT_SOURCES",
            "REQUIRED_R4_STEP_NOT_PASS_BLOCKS_COMPLETION",
            "IMPLEMENTATION_AGENT_CANNOT_DECLARE_VERIFIED",
            "NO_SILENT_FALLBACK_OR_ISOLATION_DOWNGRADE",
            "LOCAL_PRIVATE_DATA_IS_NOT_UPLOADED",
        ],
    }
    write_json("operations/phase-1/preimplementation-policy-snapshot.schema.json", policy_schema)
    write_json("operations/phase-1/preimplementation-policy-snapshot.json", policy_snapshot)

def build_verification_plan() -> None:
    refs = [
        ("urn:aseos:schema:schema-inventory:1.1.0", "packages/contracts/schemas/meta/schema-inventory.schema.json"),
        ("urn:aseos:schema:schema-registry:1.0.0", "packages/contracts/schemas/meta/schema-registry.schema.json"),
        ("urn:aseos:operation-schema:operation-manifest:1.1.0", "operations/phase-1/operation-manifest.schema.json"),
        ("urn:aseos:operation-schema:write-scope:1.1.0", "operations/phase-1/write-scope.schema.json"),
        ("urn:aseos:operation-schema:phase-1-receipt:1.1.0", "operations/phase-1/receipt.schema.json"),
        ("urn:aseos:operation-schema:authority-lock:1.0.0", "operations/phase-1/authority-lock.schema.json"),
        ("urn:aseos:operation-schema:phase-1-independent-verification-receipt:1.0.0", "operations/phase-1/independent-verification-receipt.schema.json"),
    ]
    contract_refs = []
    for sid, path in refs:
        schema = load_json(path)
        contract_refs.append({
            "schemaId": sid,
            "schemaVersion": schema.get("x-schemaVersion", "1.0.0"),
            "schemaHash": sha_file(path),
        })
    step_defs = [
        ("P1-V00-M0-AUTHORIZATION", "SCHEMA", [], "verify_m0_authorization", ["M0GateEvidence", "AuthorityLockEvidence"]),
        ("P1-V01-PREFLIGHT", "SCHEMA", ["P1-V00-M0-AUTHORIZATION"], "phase1_preflight", ["BaselineIdentityEvidence", "WriteScopeValidationResult"]),
        ("P1-V02-TOOLCHAIN", "COMPILE", ["P1-V01-PREFLIGHT"], "qualify_toolchain", ["FrozenLockfileInstallResult", "TypeScriptBuildResult", "CrossPlatformBuildEvidence"]),
        ("P1-V03-CONTRACTS", "CONTRACT", ["P1-V02-TOOLCHAIN"], "validate_contracts", ["SchemaMetaValidationResult", "SchemaRegistryValidationResult", "ExampleSuiteResult", "SchemaTypeConsistencyResult"]),
        ("P1-V04-ARCHITECTURE", "ARCHITECTURE", ["P1-V02-TOOLCHAIN", "P1-V03-CONTRACTS"], "validate_architecture", ["DependencyGraphResult", "DeepImportDenialResult", "DuplicateSemanticOwnerDenialResult"]),
        ("P1-V05-POLICY", "PROPERTY", ["P1-V03-CONTRACTS", "P1-V04-ARCHITECTURE"], "qualify_policy", ["CanonicalizationDeterminismResult", "FailClosedPropertyResult", "PolicyMutationResult"]),
        ("P1-V06-PERSISTENCE", "MIGRATION", ["P1-V02-TOOLCHAIN", "P1-V03-CONTRACTS", "P1-V04-ARCHITECTURE"], "qualify_node_sqlite", ["PersistenceAtomicityResult", "CrashRecoveryResult", "BackupRestoreResult", "CorruptionQuarantineResult"]),
        ("P1-V07-CONTROL-API", "SECURITY", ["P1-V02-TOOLCHAIN", "P1-V03-CONTRACTS", "P1-V04-ARCHITECTURE"], "qualify_control_api", ["OpenApiValidationResult", "LoopbackExposureResult", "TokenAclRedactionResult", "CliPublicApiAcceptanceResult"]),
        ("P1-V08-ISOLATION", "SECURITY", ["P1-V03-CONTRACTS", "P1-V04-ARCHITECTURE", "P1-V05-POLICY"], "qualify_process_restricted", ["JobObjectLifecycleResult", "ProcessTreeTerminationResult", "NoDowngradePropertyResult"]),
        ("P1-V09-PACKAGING", "STARTUP_HEALTH", ["P1-V02-TOOLCHAIN", "P1-V03-CONTRACTS", "P1-V04-ARCHITECTURE", "P1-V06-PERSISTENCE", "P1-V07-CONTROL-API", "P1-V08-ISOLATION"], "qualify_windows_package", ["SelfContainedArtifactResult", "ReleaseManifestConsistencyResult", "CleanWindowsStartupResult"]),
        ("P1-V10-INTEGRATED-GATE", "HUMAN_REVIEW", ["P1-V05-POLICY", "P1-V06-PERSISTENCE", "P1-V07-CONTROL-API", "P1-V08-ISOLATION", "P1-V09-PACKAGING"], "independent_phase1_review", ["StructuredReceiptValidationResult", "WriteScopeComplianceResult", "IndependentGateDecision"]),
    ]
    steps = []
    for idx, (sid, kind, deps, capability, evidence) in enumerate(step_defs):
        steps.append({
            "stepId": sid,
            "kind": kind,
            "required": True,
            "dependsOn": deps,
            "executorCapability": capability,
            "inputRefs": [{"subjectType": "Operation", "subjectId": "P1-EXECUTABLE-REPOSITORY-FOUNDATION", "subjectVersion": "1.1.0"}],
            "expectedEvidenceTypes": evidence,
            "timeoutMs": 300000 if idx < 2 else 7200000,
            "retryPolicy": {"maxAttempts": 1, "retryableErrorCodes": []},
        })
    plan = {
        "schemaVersion": "1.0.0",
        "planId": uuid7(0x200),
        "subjectRef": {"subjectType": "Operation", "subjectId": "P1-EXECUTABLE-REPOSITORY-FOUNDATION", "subjectVersion": "1.1.0"},
        "contractRefs": contract_refs,
        "riskClass": "R4",
        "plannerId": "phase-1-minimum-verification-planner",
        "plannerVersion": "1.1.0",
        "policySnapshotId": uuid7(0x201),
        "createdAt": "2026-08-27T00:00:00Z",
        "steps": steps,
        "risksCovered": [
            "toolchain-version-drift", "non-reproducible-install-or-build",
            "schema-invalid-unresolved-or-hash-mismatched-boundary",
            "package-dependency-inversion-deep-import-or-duplicate-owner",
            "policy-default-allow-or-indeterminate-allow",
            "node-sqlite-transaction-crash-recovery-or-packaging-failure",
            "control-api-network-exposure-token-leak-or-idempotency-bypass",
            "orphan-process-resource-overrun-secret-inheritance-or-isolation-downgrade",
            "release-version-or-provenance-mismatch",
            "implementation-agent-self-verification",
        ],
        "risksNotCovered": [
            "OS_SANDBOXED-AppContainer-production-guarantee",
            "real-GBrain-protocol-and-private-knowledge-integration",
            "real-model-provider-and-private-workspace-behavior",
            "production-event-artifact-cryptographic-tamper-evidence-depth",
            "local-human-approval-identity-and-evidence-encryption-key-management",
            "complete-durable-Workflow-Node-runtime-semantics",
        ],
    }
    write_json("operations/phase-1/verification-plan.json", plan)

def build_docs() -> None:
    operation_doc = """# Phase 1 Operation Plan — Executable Repository Foundation

状态：`BASELINE — PENDING M0 FINAL GATE`  
机器权威：`operations/phase-1/operation.json`

## Purpose

Phase 1 establishes a reproducible, schema-validated, architecture-enforced repository foundation. It does not implement the production Workflow, Node Runtime, Verification System, EvidenceGraph or Learning runtime.

## Operations

| ID | Scope | Gate |
|---|---|---|
| P1-O01 | exact toolchain and monorepo | P1-V00/V01/V02 |
| P1-O02 | Contract registry and runtime validation | P1-V03 |
| P1-O03 | dependency and semantic-owner enforcement | P1-V04 |
| P1-O04 | deterministic Policy qualification | P1-V05 |
| P1-O05 | node:sqlite/PersistenceWorker qualification | P1-V06 |
| P1-O06 | authenticated loopback Control API | P1-V07 |
| P1-O07 | Windows PROCESS_RESTRICTED qualification | P1-V08 |
| P1-O08 | self-contained qualification artifact | P1-V09 |
| P1-O09 | integrated implementation receipt and handoff | P1-V10 |

## Baseline identity

- Architecture baseline: frozen by accepted Phase 0 decisions.
- Planning source: the commit from which this remediation began.
- Execution baseline: a later immutable commit selected only by the M0 Gate.
- Implementation must verify `operations/phase-1/authority-lock.json` before writing.

## Stop rule

A required R4 result other than PASS, an authority-lock mismatch, scope expansion, fallback implementation, or accepted-ADR conflict stops the current Operation. The implementation Agent cannot declare VERIFIED.
"""
    scope_doc = """# Phase 1 WRITE_SCOPE

状态：`BASELINE — PENDING M0 FINAL GATE`  
机器权威：`operations/phase-1/write-scope.json`  
执行模式：`DENY_BY_DEFAULT`

## Evaluation

```text
path matches current operation allowedPathGlobs
AND path matches globalAllowedPathGlobs
AND path matches no current/global deniedPathGlobs
AND change violates no semantic constraint
AND authority-lock mutation policy permits the operation
```

Path globs and semantic prohibitions are separate machine fields. A prose rule is never interpreted as a path glob.

## Mandatory coverage

Global scope explicitly includes:

- `tests/fault-injection/**`;
- `tests/security/**`;
- operation-specific Evidence paths;
- the final implementation receipt path.

The Phase 1 plan, WRITE_SCOPE, VerificationPlan, Receipt Schemas, Authority Lock, preimplementation policy, accepted ADRs and their human-readable authority documents are immutable during implementation. Contract inventory and registry are operation-scoped to P1-O02.

## Expansion

Any required out-of-scope change stops work and requires a separate governance/remediation decision. Generated files, rename, copy or scripts cannot bypass the scope.
"""
    write_text("docs/roadmap/phase-1-operation-plan.md", operation_doc)
    write_text("docs/roadmap/phase-1-write-scope.md", scope_doc)

    review = f"""# Phase 0 Schema / Phase 1 Governance Remediation Review

状态：`IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`  
日期：`{NOW[:10]}`  
源基线：`{PLANNING_SOURCE}`  
分支：`{BRANCH}`

## 1. 范围

本次 remediation 只处理 M0 实现前治理资产，不实现任何 Framework runtime capability，也不修改 ADR-0001～ADR-0011。

## 2. 已处理阻塞

- Contract hash 由权威文件精确 UTF-8/LF bytes 计算，并由 VerificationPlan 引用；
- WRITE_SCOPE 的 path glob 与 semantic constraint 分离；
- 全局 Scope 明确覆盖 `tests/fault-injection/**` 与 `tests/security/**`；
- Receipt 无法用未完成 Operation、未运行验证或空 Evidence 伪造 `IMPLEMENTED`；
- Implementation Receipt 与 Independent Verification Receipt 分离；
- 首条 slice 的 payload Schema、Schema hash、payload hash 与 Artifact raw-byte hash 可执行；
- 增加完整 Schema Registry、Example Suite Schema 与 expected-failure 断言；
- Architecture baseline、planning source 与最终 execution baseline 的职责分离；
- Authority Lock 对治理资产使用不可变或 operation-scoped mutation policy。

## 3. 状态边界

```text
Remediation implementation: IMPLEMENTED
Independent preimplementation verification: PENDING
M0 final Gate: NOT_YET_GRANTED
Phase 1: NOT_STARTED
Runtime capability: NOT_IMPLEMENTED
```

实现者不得把本文件改为 `VERIFIED`。独立验证必须在不可变 commit 上只读执行，且同一遍验证不得 remediation。
"""
    plan = """# Phase 0 Schema / Phase 1 Governance Remediation Plan

状态：`IMPLEMENTED`  
目标：关闭 machine-readable Schema、examples、Phase 1 Operation、WRITE_SCOPE、VerificationPlan 与 Receipt 的实现前阻塞。

## Required checks

1. Parse every governed JSON file.
2. Draft 2020-12 meta-validation for every Schema.
3. Unique `$id`, resolvable `$ref`, unique authority path and exact SHA-256.
4. Active/planned inventory validation and no overlap.
5. Valid examples pass; invalid examples fail for declared keyword/path.
6. Payload, Schema and Artifact hash fidelity.
7. Operation and Verification DAG closure.
8. WRITE_SCOPE global/suboperation/path-output closure.
9. Authority Lock exact-byte verification.
10. Incomplete `IMPLEMENTED` Receipt rejection.
11. Implementation and independent verification role separation.
12. No production runtime path or accepted ADR change.

## Exit

Only an independent read-only PASS may recommend the M0 final Gate. Any failure returns to a separate remediation operation.
"""
    verification_doc = """# Phase 1 VerificationPlan

状态：`BASELINE — PENDING M0 FINAL GATE`

机器权威：`operations/phase-1/verification-plan.json`

## Gate semantics

- `P1-V00` through `P1-V10` are required.
- A required result other than `PASS` blocks Phase 1 completion.
- Implementation Agent records results but cannot declare `VERIFIED`.
- Independent verification runs on an immutable commit and performs no remediation.
- The Gate preserves `UNAVAILABLE`, `BLOCKED`, `INCONCLUSIVE` and `NOT_RUN`; none is coerced to PASS.
"""
    write_text("docs/reviews/phase-0-schema-phase1-governance-review.md", review)
    write_text("docs/roadmap/phase-0-schema-phase1-remediation-plan.md", plan)
    write_text("docs/roadmap/phase-1-verification-plan.md", verification_doc)

    progress = f"""# Current Progress Status

状态：`ACTIVE`  
日期：`{NOW[:10]}`

## Authority status

```text
Phase 0 independent architecture review: PASS
ADR-0001 through ADR-0011: ACCEPTED
Schema / Phase 1 governance remediation: IMPLEMENTED
Independent preimplementation verification: PENDING
M0 — Architecture Baseline Verified: NOT_YET_GRANTED
Phase 1: NOT_STARTED
Production runtime capability: NOT_IMPLEMENTED
```

当前分支正在修复并闭合 machine-readable Contract、examples、Phase 1 Operation、WRITE_SCOPE、VerificationPlan、Authority Lock 与 Receipt。完成后必须在不可变 commit 上进行独立只读验证。

## Hard boundary

- 不开始 P1-O01，直到 M0 Gate 单独提交 PASS；
- 实现 Agent 只能声明 `IMPLEMENTED`、`PARTIAL` 或 `BLOCKED`；
- 独立验证不得在同一遍中修改 subject；
- branch protection 与 required checks 在 Phase 1 entry 前必须启用并由 GitHub 事实确认；
- GBrain protocol survey 不阻塞 M0，但在真实 KnowledgeProvider Adapter 前完成。
"""
    write_text("docs/roadmap/progress-status.md", progress)

    reviews_path = ROOT / "docs/reviews/README.md"
    reviews = reviews_path.read_text(encoding="utf-8") if reviews_path.exists() else "# Reviews\n"
    if "phase-0-schema-phase1-governance-review.md" not in reviews:
        reviews += "\n- [Phase 0 Schema / Phase 1 Governance Remediation Review](phase-0-schema-phase1-governance-review.md) — `IMPLEMENTED`, pending independent verification.\n"
    write_text("docs/reviews/README.md", reviews)

    root_readme = (ROOT / "README.md").read_text(encoding="utf-8")
    status_marker = "## M0 remediation status"
    status_block = f"""\n\n{status_marker}\n\n```text\nSchema / Phase 1 governance remediation: IMPLEMENTED\nIndependent preimplementation verification: PENDING\nM0 final Gate: NOT_YET_GRANTED\nPhase 1: NOT_STARTED\n```\n\nSee `docs/reviews/phase-0-schema-phase1-governance-review.md`.\n"""
    if status_marker not in root_readme:
        root_readme = root_readme.rstrip() + status_block
    else:
        root_readme = re.sub(r"\n## M0 remediation status.*?\Z", status_block, root_readme, flags=re.S)
    write_text("README.md", root_readme)

    docs_readme = (ROOT / "docs/README.md").read_text(encoding="utf-8")
    link_line = "- [Phase 0 Schema / Phase 1 Governance Remediation Review](reviews/phase-0-schema-phase1-governance-review.md)"
    if link_line not in docs_readme:
        docs_readme = docs_readme.rstrip() + "\n\n## M0 remediation\n\n" + link_line + "\n"
    write_text("docs/README.md", docs_readme)

def build_authority_lock() -> str:
    immutable = [
        ("docs/roadmap/phase-1-operation-plan.md", "OPERATION_PLAN"),
        ("docs/roadmap/phase-1-write-scope.md", "WRITE_SCOPE"),
        ("docs/roadmap/phase-1-verification-plan.md", "VERIFICATION_PLAN"),
        ("operations/phase-1/operation-manifest.schema.json", "META_SCHEMA"),
        ("operations/phase-1/operation.json", "OPERATION_PLAN"),
        ("operations/phase-1/write-scope.schema.json", "META_SCHEMA"),
        ("operations/phase-1/write-scope.json", "WRITE_SCOPE"),
        ("operations/phase-1/verification-plan.json", "VERIFICATION_PLAN"),
        ("operations/phase-1/receipt.schema.json", "RECEIPT_SCHEMA"),
        ("operations/phase-1/independent-verification-receipt.schema.json", "RECEIPT_SCHEMA"),
        ("operations/phase-1/authority-lock.schema.json", "META_SCHEMA"),
        ("operations/phase-1/preimplementation-policy-snapshot.schema.json", "META_SCHEMA"),
        ("operations/phase-1/preimplementation-policy-snapshot.json", "VERIFICATION_POLICY"),
    ]
    scoped = [
        ("packages/contracts/schema-inventory.json", "CONTRACT_INVENTORY", ["P1-O02"]),
        ("packages/contracts/schema-registry.json", "SCHEMA_REGISTRY", ["P1-O02"]),
        ("packages/contracts/planned-contracts.json", "CONTRACT_INVENTORY", ["P1-O02"]),
        ("packages/contracts/schemas/meta/example-suite.schema.json", "META_SCHEMA", ["P1-O02"]),
        ("packages/contracts/schemas/meta/schema-registry.schema.json", "META_SCHEMA", ["P1-O02"]),
        ("packages/contracts/schemas/meta/schema-inventory.schema.json", "META_SCHEMA", ["P1-O02"]),
        ("packages/contracts/examples/first-slice/example-suite.json", "EXAMPLE_SUITE", ["P1-O02"]),
    ]
    files = []
    for path, role in immutable:
        if not (ROOT / path).is_file():
            raise RuntimeError(f"Authority path missing: {path}")
        files.append({
            "path": path, "sha256": sha_file(path), "role": role,
            "mutationPolicy": "IMMUTABLE", "allowedOperationIds": [],
        })
    for path, role, ops in scoped:
        if not (ROOT / path).is_file():
            raise RuntimeError(f"Authority path missing: {path}")
        files.append({
            "path": path, "sha256": sha_file(path), "role": role,
            "mutationPolicy": "OPERATION_SCOPED", "allowedOperationIds": ops,
        })
    for i in range(1, 12):
        matches = sorted((ROOT / "docs/decisions").glob(f"ADR-{i:04d}-*.md"))
        if len(matches) != 1:
            raise RuntimeError(f"Expected one ADR-{i:04d}, got {len(matches)}")
        rel = matches[0].relative_to(ROOT).as_posix()
        files.append({
            "path": rel, "sha256": sha_file(rel), "role": "ACCEPTED_ADR",
            "mutationPolicy": "IMMUTABLE", "allowedOperationIds": [],
        })
    lock = {
        "$schema": "urn:aseos:operation-schema:authority-lock:1.0.0",
        "schemaVersion": "1.0.0",
        "lockId": "P1-AUTHORITY-LOCK-1",
        "architectureBaselineCommit": ARCH_BASELINE,
        "planningSourceCommit": PLANNING_SOURCE,
        "hashPolicy": "SHA256_EXACT_UTF8_LF_FILE_BYTES",
        "authorityFiles": sorted(files, key=lambda x: x["path"]),
        "excludedSelfPath": "operations/phase-1/authority-lock.json",
        "verificationRules": [
            "EVERY_LISTED_PATH_EXISTS",
            "EVERY_LISTED_HASH_MATCHES_EXACT_BYTES",
            "NO_DUPLICATE_PATHS",
            "SELF_PATH_EXCLUDED_FROM_HASH_SET",
            "IMMUTABLE_PATHS_UNCHANGED_BY_IMPLEMENTATION",
            "OPERATION_SCOPED_PATHS_CHANGED_ONLY_BY_ALLOWED_OPERATION",
        ],
    }
    write_json("operations/phase-1/authority-lock.json", lock)
    return sha_file("operations/phase-1/authority-lock.json")

def build_receipt(lock_hash: str) -> None:
    receipt = {
        "$schema": "urn:aseos:operation-schema:m0-remediation-receipt:1.0.0",
        "schemaVersion": "1.0.0",
        "remediationId": "M0-SCHEMA-PHASE1-GOVERNANCE-REMEDIATION",
        "sourceCommit": PLANNING_SOURCE,
        "branch": BRANCH,
        "implementationDeclaration": "IMPLEMENTED",
        "declaredBy": {"role": "IMPLEMENTATION_AGENT", "actorId": "openai-gpt-5.6-pro"},
        "completedAt": NOW,
        "authorityLockHash": lock_hash,
        "resolvedFindings": [
            "P1-R01 contract hash integrity",
            "P1-R02 WRITE_SCOPE consistency",
            "P1-R03 false IMPLEMENTED receipt prevention",
            "P1-R04 executable payload and hash examples",
            "P1-R05 baseline identity separation",
            "P2-R01 complete Schema registry",
            "P2-R02 expected negative-example failure reason",
            "P2-R03 status documentation synchronization",
            "P2-R04 branch-protection prerequisite recorded",
        ],
        "verificationStatus": "PENDING_INDEPENDENT_VERIFICATION",
        "m0GateStatus": "NOT_YET_GRANTED",
        "phase1Status": "NOT_STARTED",
        "productionRuntimeChanged": False,
        "acceptedAdrsChanged": False,
        "unauthorizedFallbackUsed": False,
        "evidenceRefs": [
            "docs/reviews/phase-0-schema-phase1-governance-review.md",
            "docs/roadmap/phase-0-schema-phase1-remediation-plan.md",
            "packages/contracts/schema-registry.json",
            "packages/contracts/examples/first-slice/example-suite.json",
            "operations/phase-1/authority-lock.json",
        ],
    }
    receipt_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "urn:aseos:operation-schema:m0-remediation-receipt:1.0.0",
        "x-schemaVersion": "1.0.0",
        "type": "object",
        "additionalProperties": False,
        "required": list(receipt.keys()),
        "properties": {
            "$schema": {"const": "urn:aseos:operation-schema:m0-remediation-receipt:1.0.0"},
            "schemaVersion": {"const": "1.0.0"},
            "remediationId": {"const": "M0-SCHEMA-PHASE1-GOVERNANCE-REMEDIATION"},
            "sourceCommit": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
            "branch": {"type": "string", "minLength": 1},
            "implementationDeclaration": {"const": "IMPLEMENTED"},
            "declaredBy": {
                "type": "object", "additionalProperties": False,
                "required": ["role", "actorId"],
                "properties": {
                    "role": {"const": "IMPLEMENTATION_AGENT"},
                    "actorId": {"type": "string", "minLength": 1},
                },
            },
            "completedAt": {"type": "string", "format": "date-time"},
            "authorityLockHash": {"$ref": "urn:aseos:schema:common-identifiers:1.0.0#/$defs/sha256"},
            "resolvedFindings": {"type": "array", "minItems": 9, "uniqueItems": True, "items": {"type": "string"}},
            "verificationStatus": {"const": "PENDING_INDEPENDENT_VERIFICATION"},
            "m0GateStatus": {"const": "NOT_YET_GRANTED"},
            "phase1Status": {"const": "NOT_STARTED"},
            "productionRuntimeChanged": {"const": False},
            "acceptedAdrsChanged": {"const": False},
            "unauthorizedFallbackUsed": {"const": False},
            "evidenceRefs": {"type": "array", "minItems": 1, "uniqueItems": True, "items": {"type": "string"}},
        },
    }
    write_json("operations/phase-1/remediation-receipt.schema.json", receipt_schema)
    write_json("operations/phase-1/remediation-receipt.json", receipt)

def main() -> None:
    fixture_schemas = build_fixture_schemas()
    build_meta_schemas()
    artifacts = build_artifacts()
    build_examples(fixture_schemas, artifacts)
    build_governance()
    build_verification_plan()
    build_inventory_and_registry()
    # Rebuild VerificationPlan now that inventory/registry schemas have final bytes.
    build_verification_plan()
    # Registry must include governance schemas created by the previous steps.
    build_inventory_and_registry()
    build_docs()
    lock_hash = build_authority_lock()
    build_receipt(lock_hash)
    # Include remediation receipt schema in the complete registry.
    build_inventory_and_registry()
    # Registry changes after receipt schema addition, so refresh lock and receipt.
    lock_hash = build_authority_lock()
    build_receipt(lock_hash)
    # Remove the privileged one-shot builder workflow from the resulting branch.
    builder = ROOT / ".github/workflows/m0-remediation-build.yml"
    if builder.exists():
        builder.unlink()
    payload_dir = ROOT / ".m0-payload"
    if payload_dir.exists():
        for path in sorted(payload_dir.rglob("*"), reverse=True):
            if path.is_file() or path.is_symlink():
                path.unlink()
            elif path.is_dir():
                path.rmdir()
        payload_dir.rmdir()
    print(json.dumps({
        "status": "IMPLEMENTED",
        "branch": BRANCH,
        "authorityLockHash": lock_hash,
        "schemaRegistry": "packages/contracts/schema-registry.json",
        "exampleSuite": "packages/contracts/examples/first-slice/example-suite.json",
        "phase1": "NOT_STARTED",
        "m0Gate": "NOT_YET_GRANTED",
    }, indent=2))

if __name__ == "__main__":
    main()
