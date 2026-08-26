# 目标系统架构

状态：`BASELINE DRAFT v0.2`  
日期：`2026-08-26`

## 1. 架构风格

V1 采用 **模块化单体（Modular Monolith）+ 隔离 Worker**：

- Control Kernel、Workflow Runtime、Policy、Verification Orchestration 和持久化协调位于一个本地 Runtime；
- 模型调用、工具执行、命令运行、构建测试等非确定性或高风险工作由隔离 Worker/Adapter 执行；
- 模块边界通过 package dependency、public Contract 和 architecture test 强制；
- 不因“先进”而拆成需要复杂运维的微服务；
- 当真实性能、隔离或多机执行证据出现后，再通过 ADR 把特定 Worker 远程化。

## 2. 运行平面

```text
┌──────────────────────────────────────────────────────────┐
│ Interface Plane                                          │
│ CLI / Local Control API / UI Adapter                     │
├──────────────────────────────────────────────────────────┤
│ Governance Plane                                         │
│ Policy / Permission / Human Approval / Budget            │
├──────────────────────────────────────────────────────────┤
│ Deterministic Control Plane                              │
│ Workflow Router / Node Lifecycle / Transition Kernel     │
│ Scheduler / Recovery / Idempotency / Versioning          │
├──────────────────────────────────────────────────────────┤
│ Verification & Evidence Plane                            │
│ Planner / Executors / Oracle / Gate / EvidenceGraph      │
├──────────────────────────────────────────────────────────┤
│ Intelligence Plane                                       │
│ Model Adapter / Proposal / Claim / Planning Candidate    │
├──────────────────────────────────────────────────────────┤
│ Execution Plane                                          │
│ Tool Worker / Workspace Worker / Test Worker / Sandbox   │
├──────────────────────────────────────────────────────────┤
│ Integration Plane                                        │
│ Model / Tool / Workspace / Knowledge / Secret Adapters   │
├──────────────────────────────────────────────────────────┤
│ Data Plane                                               │
│ Event Journal / Projections / Artifacts / Config / Logs  │
└──────────────────────────────────────────────────────────┘
```

## 3. 权威边界

### 3.1 Deterministic Control Kernel

它是权威状态的唯一写入协调者，负责：

- 接收并验证 Command；
- 加载 aggregate version；
- 运行纯 transition/reducer；
- 原子追加 Domain Event；
- 创建待执行 SideEffectTask；
- 管理 lease、retry、timeout、cancel 与 recovery；
- 更新 projection；
- 向 Router 暴露经过提交的事实。

Control Kernel 不直接调用模型、网络、文件系统或任意工具。

### 3.2 Intelligence Plane

模型可以输出：

- `PlanProposal`；
- `RouteProposal`；
- `ActionProposal`；
- `Claim`；
- `RootCauseCandidate`；
- `LearningProposal`。

模型输出必须通过 schema validation、Policy、Contract、权限和必要的 Verification，才能转化为 Command。模型无法直接把 Workflow 或 Node 标记为完成。

### 3.3 Execution Plane

所有外部副作用经 `SideEffectTask` 执行。每次调用至少具备：

```text
taskId
executionId
idempotencyKey
capability
permissionSet
requiredIsolationLevel
inputArtifactRefs
timeout
resourceBudget
adapterVersion
```

Worker 返回结构化 Result、IsolationEvidence 和其他 Evidence。Control Kernel 决定如何提交结果，不信任 Worker 自行修改状态。

`PersistenceWorker` 是 Runtime 内部专用 storage worker thread，只执行已经由 Kernel 决定的持久化 batch；它不是 SideEffect Worker，也不能生成业务 Event 或终态。

## 4. 核心 bounded contexts

V1 canonical 代码边界：

```text
packages/
├─ contracts              # schema、envelope、public types
├─ kernel                 # command/event/transition/transaction
├─ workflow               # definition、run、router、scheduler
├─ node-runtime           # node lifecycle、attempt、record
├─ context                # context snapshot、budget、provenance
├─ policy                 # permission、risk、approval、minimum requirements
├─ verification           # plan、executor registry、oracle、gate
├─ evidence               # artifact、edge、attestation、query
├─ learning               # attribution、causal validation、proposal
├─ persistence            # journal、projection、migration、unit of work
├─ adapters               # model/tool/workspace/knowledge/isolation implementations
├─ observability          # OTel mapping、diagnostics、metrics
└─ platform               # composition root、config、runtime/API lifecycle

apps/
├─ cli
├─ runtime
└─ worker
```

目录细节由 [Repository Blueprint](../engineering/repository-blueprint.md) 约束。调整目录不得改变依赖方向或创建平行语义 owner。

## 5. 依赖规则

```text
contracts <- domain modules <- application services <- adapters/platform
```

硬约束：

- Domain 不依赖 Adapter；
- Kernel 不依赖具体模型、数据库或测试工具；
- Adapter 不拥有 Workflow/Node 状态语义；
- UI/CLI 不直接写数据库或 import Kernel internal；
- Learning 不直接修改 Kernel；
- Verification Executor 不决定最终 Gate；
- Policy Adapter/fake 不得替换 V1 canonical evaluator；
- projection 不是事实源；
- cache 不是权威状态；
- package 之间只通过公开入口依赖，不允许 deep import。

## 6. 数据架构

### 6.1 权威 Journal

Workflow/Node 生命周期使用 append-only event journal。每条 event 至少包含：

```text
eventId
aggregateType
aggregateId
aggregateVersion
eventType
schemaVersion
occurredAt
causationId
correlationId
actor
payloadHash
payload
```

Event 在提交后不可原地修改。Schema 演进使用 versioned decoder/upcaster，不靠直接编辑历史数据。

### 6.2 Projection

查询、UI、调度索引、统计与 EvidenceGraph 查询使用 projection。Projection 可被重建，不得承载无法从事实或外部权威源恢复的唯一数据。

### 6.3 Artifact Store

大文本、模型响应、diff、测试报告和二进制结果使用 content-addressed Artifact Store；数据库只保存 metadata、hash、media type、size、provenance 和引用。

### 6.4 默认本地存储

V1 已按 [ADR-0008](../decisions/ADR-0008-embedded-persistence-sqlite.md) 冻结为：

```text
SQLite 3.53.3
+ Node.js 24.19.0 内置 node:sqlite
+ 专用 PersistenceWorker
+ 单一 authoritative database
```

Event、Command dedup、outbox、inbox、必要 projection checkpoint 与 audit 在同一个 SQLite transaction boundary 内提交。大 Artifact 继续保存在 content-addressed filesystem store。

数据库/driver 细节只存在于 `packages/persistence` internal；Kernel、Domain、public Contract 和 persisted event payload 不得依赖 SQL row、table name 或 `node:sqlite` type。

持久化必须提供：

- transaction 与 optimistic concurrency；
- WAL/崩溃恢复；
- migration；
- backup/restore；
- integrity check/quarantine；
- append-only 约束；
- inbox/outbox/idempotency；
- projection rebuild。

`node:sqlite` 的 Release Candidate 风险由 exact runtime pin、Port 隔离和 Phase 1 qualification Gate 管理；失败只能通过 superseding ADR 改变实现，不允许同一 Release 自动 fallback 到平行 driver。

## 7. 已接受技术基线

Phase 1/Release 必须同时符合：

- [ADR-0007](../decisions/ADR-0007-typescript-toolchain-baseline.md)：Node.js `24.19.0`、TypeScript `6.0.3`、pnpm `11.24.0`、ESM-only、`tsc -b`；
- [ADR-0008](../decisions/ADR-0008-embedded-persistence-sqlite.md)：SQLite + `node:sqlite` + PersistenceWorker；
- [ADR-0009](../decisions/ADR-0009-local-control-api-protocol.md)：`127.0.0.1` HTTP/JSON、token auth、OpenAPI 3.1.1、durable operation 与 SSE；
- [ADR-0010](../decisions/ADR-0010-windows-execution-isolation.md)：四级 IsolationLevel、capability proof 与禁止 silent downgrade；
- [ADR-0011](../decisions/ADR-0011-policy-engine-and-representation.md)：内置 deterministic Policy evaluator、declarative PolicySet 与 fail closed。

跨系统基础规则：

- JSON Schema 2020-12 作为跨边界 schema 基线；
- RFC 3339 UTC 时间；
- execution/event identity 必须可稳定排序并显式版本化，具体格式在 Schema inventory 冻结；
- SHA-256 content identity；
- OpenTelemetry-compatible trace/log/metric correlation，但 telemetry 非权威；
- 自包含 Windows-first Release，不要求用户安装开发工具链。

具体 supporting library patch 版本由 `pnpm-lock.yaml` 和 `toolchain/toolchain.json` 唯一记录。不得在文档、workflow 或脚本中维护另一套漂移版本清单。

## 8. 关键运行链

```text
User/API Command
  -> Control API schema/auth/idempotency validation
  -> Policy evaluation
  -> deterministic transition
  -> events + side-effect outbox atomic commit
  -> isolation capability selection/proof
  -> worker executes effect
  -> result + evidence returned
  -> result command validated
  -> events committed
  -> Verification System plans/evaluates
  -> GateDecision committed
  -> Router selects next eligible Node
```

## 9. 可扩展性

V1 允许外部实现的明确 Port：

- `ModelProviderPort`；
- `ToolExecutorPort`；
- `WorkspacePort`；
- `KnowledgeProviderPort`；
- `VerificationExecutorPort`；
- `ArtifactStorePort`；
- `SecretProviderPort`；
- `IsolationProviderPort`；
- `TelemetryExporterPort`。

每个 Adapter 必须声明 capability、version、permissions、health、supported Contract range，并用 conformance/probe Evidence 支持其声明。无法满足 Contract 时必须 fail closed，而不是静默降级。

`PolicyEnginePort` 保留为 application boundary、fake 和 conformance seam；V1 的唯一 authority implementation 是 `packages/policy` 内置 evaluator。不得通过 configuration、plugin 或 Adapter 把第三方 evaluator 变成平行 Policy owner。未来替换必须由 superseding ADR 证明 deterministic snapshot、requirements、replay 和 fail-closed 等价。
