# 目标系统架构

状态：`BASELINE DRAFT v0.1`  
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

所有外部副作用经 `SideEffectTask` 执行。每次调用具备：

```text
taskId
executionId
idempotencyKey
capability
permissionSet
inputArtifactRefs
timeout
resourceBudget
adapterVersion
```

Worker 返回结构化 Result 和 Evidence。Control Kernel 决定如何提交结果，不信任 Worker 自行修改状态。

## 4. 核心 bounded contexts

建议的代码边界：

```text
packages/
├─ contracts              # schema、envelope、public types
├─ kernel                 # command/event/transition/transaction
├─ workflow               # definition、run、router、scheduler
├─ node-runtime           # node lifecycle、attempt、record
├─ context                # context snapshot、budget、provenance
├─ policy                 # permission、risk、approval、gate
├─ verification           # plan、executor registry、oracle、gate
├─ evidence               # artifact、edge、attestation、query
├─ learning               # attribution、causal validation、proposal
├─ persistence            # journal、projection、migration、unit of work
├─ adapters               # model/tool/workspace/knowledge implementations
├─ observability          # OTel mapping、diagnostics、metrics
└─ platform               # composition root、config、runtime lifecycle

apps/
├─ cli
├─ runtime
└─ worker
```

最终目录可在工程 ADR 中细化，但依赖方向不可反转。

## 5. 依赖规则

```text
contracts <- domain modules <- application services <- adapters/platform
```

硬约束：

- Domain 不依赖 Adapter；
- Kernel 不依赖具体模型、数据库或测试工具；
- Adapter 不拥有 Workflow/Node 状态语义；
- UI/CLI 不直接写数据库；
- Learning 不直接修改 Kernel；
- Verification Executor 不决定最终 Gate；
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

大文本、模型响应、diff、测试报告和二进制结果使用 content-addressed artifact store；数据库只保存 metadata、hash、media type、size、provenance 和引用。

### 6.4 默认本地存储

V1 目标采用本地嵌入式关系数据库作为默认实现，并提供：

- transaction；
- WAL/崩溃恢复；
- migration；
- backup/restore；
- integrity check；
- append-only 约束；
- optimistic concurrency。

首选实现将在工程 ADR 中锁定，架构不得依赖数据库特有业务逻辑。

## 7. 技术基线方向

为兼顾可靠性、Agent 生态、开发效率和本地部署，V1 优先采用：

- 单语言严格 TypeScript；
- 当前受支持的 Node.js Active LTS，并在每个 Release 精确锁定；
- workspace/monorepo 管理；
- JSON Schema 2020-12 作为跨边界 schema 基线；
- RFC 3339 UTC 时间；
- 可排序 execution/event identity（默认候选 UUIDv7）；
- SHA-256 content identity；
- OpenTelemetry-compatible trace/log/metric correlation；
- 自包含 Windows-first Release，不要求用户安装开发工具链。

最终工具与库版本必须通过工程 ADR 和 spike 验证，不能仅因流行度进入 Core。

## 8. 关键运行链

```text
User/API Command
  -> Command validation
  -> Policy pre-check
  -> deterministic transition
  -> events + side-effect outbox atomic commit
  -> worker executes effect
  -> result + evidence returned
  -> result command validated
  -> events committed
  -> Verification System plans/evaluates
  -> GateDecision committed
  -> Router selects next eligible Node
```

## 9. 可扩展性

扩展点只允许出现在明确 Port：

- `ModelProviderPort`；
- `ToolExecutorPort`；
- `WorkspacePort`；
- `KnowledgeProviderPort`；
- `VerificationExecutorPort`；
- `ArtifactStorePort`；
- `SecretProviderPort`；
- `PolicyEnginePort`；
- `TelemetryExporterPort`。

每个 Adapter 必须声明 capability、version、permissions、health 和 Contract conformance。无法满足 Contract 时必须 fail closed，而不是静默降级。
