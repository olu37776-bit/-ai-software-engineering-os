# 耐久执行模型

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 目标

执行模型必须在进程崩溃、模型超时、工具失败、重复消息、部分写入和版本升级下保持可恢复、可解释和可验证。

本框架借鉴 durable execution、event journal 和 actor/aggregate concurrency 的成熟原则，但不要求本地安装独立编排集群。

## 2. Canonical Terms

### WorkflowDefinition

不可变、版本化的工作流定义，包含 Node、依赖、路由约束、输入输出 Contract、Policy 引用和完成条件。

### WorkflowRun

某个 WorkflowDefinition 的一次运行实例。

### NodeDefinition

Workflow 中一个最小可调度、可验证和可归因单元。

### NodeExecution

某个 Node 在一个 Run 中的一次逻辑执行；可以包含多个 Attempt。

### Attempt

针对同一 NodeExecution 的一次实际尝试。重试不会创建新的逻辑目标，但必须拥有独立 attempt identity 与 Evidence。

### Command

请求系统进行状态变化的意图。Command 不是事实，可能被拒绝。

### DomainEvent

系统已接受并提交的不可变事实。

### SideEffectTask

由已提交事件产生、需要外部 Worker 执行的非确定性或有副作用工作。

### Claim / Proposal

模型或外部组件提出的候选结论，不具有权威状态效力。

## 3. 状态机

NodeExecution 的高层状态建议为：

```text
CREATED
  -> ELIGIBLE
  -> READY
  -> RUNNING
  -> AWAITING_EFFECT
  -> AWAITING_VERIFICATION
  -> AWAITING_APPROVAL
  -> SUCCEEDED | FAILED | CANCELLED | BLOCKED
```

具体状态可细化，但必须满足：

- terminal state 集合唯一；
- terminal transition 只有一个 canonical transition owner；
- 状态只能由 Event 推导；
- 不允许 Adapter、Router 或测试辅助代码直接写终态；
- `BLOCKED` 与 `FAILED` 分开：前者表示缺少外部条件，后者表示已执行但不满足 Contract；
- `RETRYING` 应优先作为 projection/调度状态，不应掩盖 Attempt 事实。

## 4. Command -> Event 决策

核心 transition 函数必须是纯函数：

```text
(currentState, command, policySnapshot, clockValue)
  -> accepted events | typed rejection
```

约束：

- 不读取文件、网络、环境变量或全局 singleton；
- 不调用模型或工具；
- 不使用未注入的当前时间、随机数或 UUID；
- 不写日志作为业务副作用；
- 同一输入产生同一决策；
- 所有 rejection 具备稳定 error code 和上下文。

## 5. 原子提交

一次权威状态更新必须在同一 transaction 内完成：

1. 校验 aggregate version；
2. 追加 Event；
3. 追加 SideEffectTask/outbox（如有）；
4. 更新必要 projection checkpoint；
5. 提交 transaction。

禁止先调用外部工具再尝试记录“已经调用”，否则崩溃会产生不可判断副作用。

## 6. 幂等与重复投递

### 6.1 Command 幂等

每个可能被重复提交的 Command 必须带 `commandId` 或 `idempotencyKey`。Kernel 保存处理结果，使重复 Command 返回原结果或一致拒绝。

### 6.2 Side effect 幂等

外部效果分级：

- 天然幂等：可安全重复；
- 通过 idempotency key 幂等；
- 可检测重复但不可撤销；
- 不可重复高风险操作。

后两类必须使用 Human Approval、precondition、deduplication record 或补偿策略，不得简单自动 retry。

### 6.3 Inbox/Outbox

跨进程 Worker 返回结果时使用 inbox 去重；待执行任务使用 outbox。两者都以持久化 identity 为准，不能以进程内 cache 为准。

## 7. 并发模型

每个 WorkflowRun / NodeExecution aggregate 采用 optimistic concurrency：

- event stream 有递增 version；
- Command 指定 expected version 或在 transaction 中比较；
- 冲突时重新加载事实并重新决策；
- 禁止 last-write-wins 覆盖状态；
- scheduler 使用带过期时间的 lease；
- Worker heartbeat 不等于业务完成事实。

同一 Node 的并行执行必须由 definition 明确允许，并拥有不同 execution identity。不能仅凭线程或进程数量推断合法并发。

## 8. Retry Policy

Retry 必须区分：

- transient infrastructure failure；
- rate limit / dependency unavailable；
- deterministic Contract failure；
- policy rejection；
- human approval rejection；
- non-idempotent partial side effect；
- corrupted state / invariant violation。

只有可恢复类别允许自动 retry。Policy 至少定义：

```text
maxAttempts
backoff
jitter
timeout
retryableErrorCodes
nonRetryableErrorCodes
budget
```

确定性逻辑失败不能靠重复运行同一逻辑解决。

## 9. Timeout、Cancellation 与 Compensation

- timeout 是持久化 deadline，而非仅进程计时器；
- cancel 是 Command，经 Event 提交后传播给 Worker；
- Worker 必须返回 cancellation acknowledgement 或超时事实；
- 对已经产生外部副作用的任务，取消不等于撤销；
- 需要撤销时使用显式 Compensation Node/Task，并独立验证；
- terminal transition 前必须处理未知结果（unknown outcome），不能默认成功或失败。

## 10. Crash Recovery

Runtime 启动时执行：

1. integrity check；
2. migration state check；
3. 读取未完成 outbox；
4. 识别过期 lease；
5. 重建必要 projection；
6. 恢复可重试任务；
7. 将无法判断的外部副作用标记为 `RECONCILIATION_REQUIRED`；
8. 生成 recovery Evidence。

恢复不得依赖内存 cache 或上次会话文本。

## 11. Definition 与 Runtime Versioning

- WorkflowDefinition 一经 Run 引用即不可原地改变；
- 新语义发布为新 definition version；
- Run 固定记录其 definition、Contract 和 runtime compatibility；
- 正在执行的 Node 不得在中途无记录切换 reducer 语义；
- persisted event 使用 `eventType + schemaVersion`；
- decoder/upcaster 必须具有 replay test；
- 删除旧 decoder 前必须证明所有受支持数据已迁移或正式退役。

## 12. NodeExecutionRecord

每次 NodeExecution 至少生成：

```text
identity:
  runId, workflowDefinitionId, workflowDefinitionVersion
  nodeId, nodeDefinitionVersion
  executionId, attempt
runtime:
  frameworkVersion, gitCommit, contractVersion
context:
  contextSnapshotId, inputArtifactRefs, knowledgeRefs
execution:
  modelInvocationRefs, toolInvocationRefs, workspaceChangeRefs
state:
  start/end, status, events, errors, cancellation
verification:
  planId, executionRefs, evidenceRefs, gateDecision
provenance:
  actor, policySnapshotId, adapterVersions
```

Record 是结构化事实视图，不允许由模型自由撰写。自然语言总结只能作为附属 Artifact。

## 13. Replay

必须支持两类 replay：

- **state replay**：从 Event 重建 aggregate state，验证 transition compatibility；
- **evaluation replay**：在固定输入、Context 和 Evidence 下重新运行 Router、Policy、Oracle 或 Learning evaluator。

模型调用通常不能保证字节级确定性，因此模型响应必须作为已记录输入参与 replay；需要重新采样时应创建新的实验 execution，而不是改写历史。
