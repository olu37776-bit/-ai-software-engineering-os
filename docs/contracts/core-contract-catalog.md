# Core Contract Catalog

状态：`BASELINE DRAFT v0.2`  
日期：`2026-08-26`

## 1. 目的

本 Catalog 列出必须在开始生产实现前建立的 canonical Schema/Contract。它定义 owner、用途和版本边界；具体 JSON Schema 在 Phase 1 写入 `packages/contracts/schemas/`。

本 Catalog 不等于 machine-readable schema 已完成。Phase 0 的下一步是为第一条 Vertical Slice 把优先 Contract 转成真实 JSON Schema、valid/invalid examples 与 compatibility tests。

## 2. Envelope Contracts

| Contract | Canonical owner | 用途 | Phase |
|---|---|---|---|
| `CommandEnvelope` | kernel | 状态变更请求、幂等、causation/correlation | 1/2 |
| `DomainEventEnvelope` | kernel | 不可变事实、aggregate version、schema | 1/2 |
| `SideEffectTaskEnvelope` | kernel | outbox task、权限、isolation、timeout、idempotency | 2 |
| `SideEffectResultEnvelope` | kernel | Worker 结果、artifact/evidence、error | 2 |
| `TypedError` | contracts | 稳定错误码、类别、retryability | 1 |
| `ArtifactRef` | evidence | content-addressed artifact 引用 | 1/3 |
| `ActorRef` | policy | human/agent/system/worker identity | 1 |
| `SchemaRef` | contracts | Contract name/version/dialect/hash | 1 |

## 3. Durable Persistence

| Contract | Canonical owner | 关键责任 |
|---|---|---|
| `JournalAppendBatch` | kernel/persistence boundary | expected versions、events、command receipt、outbox、audit 的原子提交输入 |
| `PersistenceCommitReceipt` | persistence | committed identities/versions/transaction result，不泄露 driver type |
| `CommandDedupRecord` | kernel | commandId、payload hash、original result/rejection |
| `OutboxRecord` | kernel | SideEffectTask dispatch status、lease、retry、idempotency |
| `InboxRecord` | kernel | Worker result identity/payload hash/dedup result |
| `LeaseRecord` | node-runtime | owner、expiry、heartbeat、version |
| `ProjectionCheckpoint` | persistence | projection version/source event position/rebuild metadata |
| `StateSchemaManifest` | persistence/release | schema version、migration checksums、compatibility |

`node:sqlite`、SQL row 和 table name 都不是 public Contract。

## 4. Workflow and Node

| Contract | 关键字段/责任 |
|---|---|
| `WorkflowDefinition` | id/version, nodes, dependencies, routing, input/output schema, policy refs |
| `WorkflowRun` | runId, definition ref, status projection, created/terminal refs |
| `NodeDefinition` | id/version, Contract, Skill, capability, verification, retry, boundaries |
| `NodeExecutionIdentity` | runId, nodeId, executionId, attempt |
| `NodeOutput` | schemaVersion, output artifact/value refs, claims |
| `NodeExecutionRecord` | identity, versions, context, calls, changes, verification, policy/isolation, provenance |
| `RouteProposal` | candidate next nodes + rationale refs；非权威 |
| `RouteDecision` | eligible/selected/rejected + deterministic reasons |

## 5. Context and Skill

| Contract | 关键字段/责任 |
|---|---|
| `ContextItem` | kind, contentRef/value, source, hash, freshness, trust, sensitivity, authority |
| `ContextSnapshot` | ordered items, compiler/policy version, budget, exclusions, hash |
| `ContextPolicy` | allowed sources, trust/freshness, selection, budgets, redaction |
| `SkillManifest` | id/version, contracts, capabilities, risk, source/provenance |
| `KnowledgeQuery` | KB scope, entity/semantic query, filters, freshness, limit |
| `KnowledgeResult` | ref, canonicalName, aliases, source, hash, trust, relations |

## 6. Policy, Permission and Isolation

| Contract | Canonical owner | 关键字段/责任 |
|---|---|---|
| `PolicySet` | policy | versioned declarative rules、provenance、Schema |
| `PolicyRule` | policy | domain、selectors、condition AST、effect、requirements、reasonCode |
| `PolicyEvaluationInput` | policy | actor/action/resource、risk、capability、isolation、evidence、captured clock |
| `PolicySnapshot` | policy | canonical JSON/hash、source versions、overrides、effective time |
| `PolicyDecision` | policy | ALLOW/DENY/INDETERMINATE、matched rules、requirements、reason codes |
| `PolicyOverride` | policy | base hash、scope、change、approval、expiry、reason |
| `CapabilityManifest` | adapter contract | adapter/skill capabilities、version、OS/isolation requirements |
| `PermissionRequest` | policy | subject, capability, resource scope, duration, risk |
| `IsolationRequirement` | policy | required level、capabilities、network/filesystem/secret constraints |
| `IsolationCapabilityReport` | adapter | supported levels、provider/OS version、probe results、limitations |
| `IsolationEvidence` | evidence | selected provider、probe snapshot、actual enforced controls |
| `ApprovalRequest` | policy | action, subject, input/evidence hashes, role, expiry |
| `ApprovalDecision` | policy | approve/reject, actor, scope, reason, time |
| `RiskAssessment` | policy | class, dimensions, evidence, remaining risk |

V1 `PolicyEnginePort` 由 `packages/policy` 内置 evaluator 实现。fake/alternate implementation 只能用于 conformance；不能通过 configuration 把第三方 evaluator 变成 authority。

## 7. Verification and Evidence

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

## 8. Learning

| Contract | 关键字段/责任 |
|---|---|
| `NodeAttribution` | node/component candidates, evidence, alternatives, uncertainty |
| `RootCauseCandidate` | claim, support/contradiction, assumptions, validation plan |
| `CausalExperiment` | intervention/replay setup, controlled variables, outcomes |
| `ValidatedRootCause` | validated claim, scope, method, residual uncertainty |
| `LearningProposal` | target component/version, diff, risk, verification, rollback |
| `LearningGateDecision` | accept/reject/rework, approval, application scope |

## 9. Adapter Contracts

| Contract | Canonical methods |
|---|---|
| `ModelProviderPort` | capabilities, invoke, cancel, health |
| `ToolExecutorPort` | capabilities, execute, cancel, reconcile, health |
| `WorkspacePort` | snapshot, read, stage/apply, diff, rollback, health |
| `KnowledgeProviderPort` | capabilities, query, getById, resolveEntity, relations, health |
| `VerificationExecutorPort` | capabilities, executeStep, cancel, health |
| `SecretProviderPort` | resolveHandle for authorized task, health |
| `ArtifactStorePort` | put/get/verify/list metadata |
| `PolicyEnginePort` | evaluate immutable input/snapshot；V1 built-in canonical implementation |
| `IsolationProviderPort` | probe, prepare, execute/attach, cancel, collect, teardown |
| `TelemetryExporterPort` | export non-authoritative signals |

Adapter Contract 包含 capability/version/conformance，不只包含方法签名。Adapter 不可自报 isolation/capability 成功；必须返回 probe/Evidence。

## 10. Local Control API

| Contract | Canonical owner | 用途 |
|---|---|---|
| `ControlEndpointDescriptor` | platform | instance/port/API version/token file ref discovery |
| `ControlOperationRef` | platform | durable operation identity/status/result links |
| `ControlEventNotification` | platform | SSE projection notification、notificationId、subject/version |
| `ControlApiProblem` | contracts | RFC 9457 + stable code/retryability/correlation/remediation |
| `RuntimeHealth` | platform | authenticated readiness/degraded/blocking findings |
| `DiagnosticFinding` | platform | code, severity, subject, Evidence, remediation |

OpenAPI 3.1.1 + JSON Schema 2020-12 是 V1 Control API authority。CLI/UI 只能依赖这些 public contracts。

## 11. Platform, Toolchain and Release

| Contract | 用途 |
|---|---|
| `FrameworkConfig` | validated local configuration root |
| `EffectiveConfigSnapshot` | resolved config values and provenance |
| `ToolchainManifest` | Node/TS/pnpm/tool versions、platform、lockfile/build identity |
| `ReleaseManifest` | version, commit, toolchain, schemas, hashes, compatibility |
| `MigrationManifest` | source/target schema, preflight, backup, rollback |
| `BackupManifest` | included assets, hashes, versions, exclusions |
| `RuntimeHealth` | readiness, degraded capabilities, blocking failures |
| `DiagnosticFinding` | code, severity, subject, Evidence, remediation |

## 12. Versioning Rules

- 每个 persisted/public payload 含 `schemaVersion`；
- JSON Schema 声明 dialect；
- Contract name 不嵌入含糊 `v2-new` 路径；
- breaking change 创建新 major/schema version；
- DomainEvent decoder/upcaster 有 replay fixtures；
- Adapter conformance 声明支持的 Contract version range；
- unknown required fields/unsupported version fail closed；
- deprecated Contract 有截止 Release 和退役 Evidence；
- OpenAPI、PolicySet、state schema、toolchain 与 Framework version 独立记录兼容范围；
- driver/library internal type 不得泄露为 persisted/public identity。

## 13. First Schema Inventory Priority

Phase 0/1 首批必须落盘：

1. `TypedError` / `SchemaRef` / canonical identity；
2. `CommandEnvelope` / `DomainEventEnvelope`；
3. `JournalAppendBatch` / `PersistenceCommitReceipt`；
4. `PolicySet` / `PolicySnapshot` / `PolicyDecision`；
5. `IsolationRequirement` / `IsolationCapabilityReport`；
6. `ControlEndpointDescriptor` / `ControlApiProblem`；
7. first slice `WorkflowDefinition` / `NodeDefinition`；
8. `SideEffectTaskEnvelope` / `SideEffectResultEnvelope`；
9. `VerificationPlan` / `EvidenceMetadata` / `GateDecision`；
10. `NodeExecutionRecord`。

每项提供 valid、invalid、boundary 和 version-compatibility example。

## 14. Schema Definition of Done

一个 Schema 只有满足以下条件才可 `FROZEN`：

- canonical owner 明确；
- required/optional/null/default 语义明确；
- identity、time、hash 和 provenance 规则明确；
- valid/invalid/boundary examples；
- generated/runtime type consistency；
- compatibility/migration policy；
- sensitive fields/redaction；
- JSON Schema validation tests；
- consumers/producers inventory；
- ADR 与 architecture invariant 可追溯；
- 没有 driver、HTTP framework 或 Adapter implementation detail 泄露。
