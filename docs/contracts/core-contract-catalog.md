# Core Contract Catalog

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 目的

本 Catalog 列出必须在开始生产实现前建立的 canonical Schema/Contract。它定义 owner、用途和版本边界；具体 JSON Schema 在 Phase 1 写入 `packages/contracts/schemas/`。

## 2. Envelope Contracts

| Contract | Canonical owner | 用途 | Phase |
|---|---|---|---|
| `CommandEnvelope` | kernel | 状态变更请求、幂等、causation/correlation | 1/2 |
| `DomainEventEnvelope` | kernel | 不可变事实、aggregate version、schema | 1/2 |
| `SideEffectTaskEnvelope` | kernel | outbox task、权限、timeout、idempotency | 2 |
| `SideEffectResultEnvelope` | kernel | Worker 结果、artifact/evidence、error | 2 |
| `TypedError` | contracts | 稳定错误码、类别、retryability | 1 |
| `ArtifactRef` | evidence | content-addressed artifact 引用 | 1/3 |
| `ActorRef` | policy | human/agent/system/worker identity | 1 |

## 3. Workflow and Node

| Contract | 关键字段/责任 |
|---|---|
| `WorkflowDefinition` | id/version, nodes, dependencies, routing, input/output schema, policy refs |
| `WorkflowRun` | runId, definition ref, status projection, created/terminal refs |
| `NodeDefinition` | id/version, Contract, Skill, capability, verification, retry, boundaries |
| `NodeExecutionIdentity` | runId, nodeId, executionId, attempt |
| `NodeOutput` | schemaVersion, output artifact/value refs, claims |
| `NodeExecutionRecord` | identity, versions, context, calls, changes, verification, provenance |
| `RouteProposal` | candidate next nodes + rationale refs；非权威 |
| `RouteDecision` | eligible/selected/rejected + deterministic reasons |

## 4. Context and Skill

| Contract | 关键字段/责任 |
|---|---|
| `ContextItem` | kind, contentRef/value, source, hash, freshness, trust, sensitivity, authority |
| `ContextSnapshot` | ordered items, compiler/policy version, budget, exclusions, hash |
| `ContextPolicy` | allowed sources, trust/freshness, selection, budgets, redaction |
| `SkillManifest` | id/version, contracts, capabilities, risk, source/provenance |
| `KnowledgeQuery` | KB scope, entity/semantic query, filters, freshness, limit |
| `KnowledgeResult` | ref, canonicalName, aliases, source, hash, trust, relations |

## 5. Policy and Approval

| Contract | 关键字段/责任 |
|---|---|
| `CapabilityManifest` | adapter/skill capabilities、version、OS/isolation requirements |
| `PermissionRequest` | subject, capability, resource scope, duration, risk |
| `PolicySnapshot` | policy set/version/hash/effective time |
| `PolicyDecision` | allow/deny/conditions/reason codes/snapshot ref |
| `ApprovalRequest` | action, subject, input/evidence hashes, role, expiry |
| `ApprovalDecision` | approve/reject, actor, scope, reason, time |
| `RiskAssessment` | class, dimensions, evidence, remaining risk |

## 6. Verification and Evidence

| Contract | 关键字段/责任 |
|---|---|
| `VerificationRequest` | subject, Contract, change/impact, risk, evidence refs |
| `VerificationProfile` | minimum rules, executor/oracle requirements |
| `VerificationPlan` | immutable steps, dependencies, budgets, coverage/gaps |
| `VerificationStep` | executor capability, input refs, expected Evidence, timeout |
| `VerificationExecution` | attempt, executor version, result/error, evidence refs |
| `EvidenceMetadata` | type, subjects, producer, hash, trust, method, createdAt |
| `EvidenceEdge` | relation, from/to, producer/version, confidence |
| `OracleAssessment` | expected vs observed, PASS/FAIL/INCONCLUSIVE, limitations |
| `VerificationAssessment` | step/oracle aggregation, completeness, residual gaps |
| `GateDecision` | PASS/REWORK/BLOCK/...、policy snapshot、reason、risk acceptance |

## 7. Learning

| Contract | 关键字段/责任 |
|---|---|
| `NodeAttribution` | node/component candidates, evidence, alternatives, uncertainty |
| `RootCauseCandidate` | claim, support/contradiction, assumptions, validation plan |
| `CausalExperiment` | intervention/replay setup, controlled variables, outcomes |
| `ValidatedRootCause` | validated claim, scope, method, residual uncertainty |
| `LearningProposal` | target component/version, diff, risk, verification, rollback |
| `LearningGateDecision` | accept/reject/rework, approval, application scope |

## 8. Adapter Contracts

| Contract | Canonical methods |
|---|---|
| `ModelProviderPort` | capabilities, invoke, cancel, health |
| `ToolExecutorPort` | capabilities, execute, cancel, reconcile, health |
| `WorkspacePort` | snapshot, read, stage/apply, diff, rollback, health |
| `KnowledgeProviderPort` | capabilities, query, getById, resolveEntity, relations, health |
| `VerificationExecutorPort` | capabilities, executeStep, cancel, health |
| `SecretProviderPort` | resolveHandle for authorized task, health |
| `ArtifactStorePort` | put/get/verify/list metadata |
| `PolicyEnginePort` | evaluate against immutable input/snapshot |
| `TelemetryExporterPort` | export non-authoritative signals |

Adapter Contract 包含 capability/version/conformance，不只包含方法签名。

## 9. Platform and Release

| Contract | 用途 |
|---|---|
| `FrameworkConfig` | validated local configuration root |
| `EffectiveConfigSnapshot` | resolved config values and provenance |
| `ReleaseManifest` | version, commit, toolchain, schemas, hashes, compatibility |
| `MigrationManifest` | source/target schema, preflight, backup, rollback |
| `RuntimeHealth` | readiness, degraded capabilities, blocking failures |
| `DiagnosticFinding` | code, severity, subject, Evidence, remediation |
| `BackupManifest` | included assets, hashes, versions, exclusions |

## 10. Versioning Rules

- 每个 persisted/public payload 含 `schemaVersion`；
- JSON Schema 声明 dialect；
- Contract name 不嵌入含糊 `v2-new` 路径；
- breaking change 创建新 major/schema version；
- DomainEvent decoder/upcaster 有 replay fixtures；
- Adapter conformance 声明支持的 Contract version range；
- unknown required fields/unsupported version fail closed；
- deprecated Contract 有截止 Release 和退役 Evidence。

## 11. Schema Definition of Done

一个 Schema 只有满足以下条件才可 `FROZEN`：

- canonical owner 明确；
- required/optional/null/default 语义明确；
- identity、time、hash 和 provenance 规则明确；
- valid/invalid/boundary examples；
- generated/runtime type consistency；
- compatibility/migration policy；
- sensitive fields/redaction；
- JSON Schema validation tests；
- consumers/producers inventory。
