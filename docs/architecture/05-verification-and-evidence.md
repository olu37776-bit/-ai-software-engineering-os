# Verification System 与 Evidence

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 定位

Verification System 是 Framework 的一等运行时子系统。它不是固定测试列表，也不是 GitHub Actions 的别名。

它根据 Node、变更影响、风险、Contract、可用验证资产、环境能力和历史 Evidence，生成可追溯 VerificationPlan，执行步骤，评估结果并形成 GateDecision。

## 2. 核心对象

```text
VerificationRequest
VerificationProfile
VerificationPlan
VerificationStep
VerificationExecution
Evidence
OracleAssessment
VerificationAssessment
GateDecision
```

### VerificationRequest

由 Node lifecycle、Router、Policy、Human 或 Learning replay 发起，包含 subject、目标 Contract、风险和已知 Evidence。

### VerificationPlan

不可变、版本化，说明：

- 为什么需要这些步骤；
- 哪些风险被覆盖；
- 哪些风险未覆盖；
- 步骤依赖和并行关系；
- executor capability；
- timeout、预算与重试；
- required Evidence；
- completion/gate rule。

### VerificationStep

可包含但不限于：

- static analysis / compile；
- unit；
- module / integration；
- API / contract；
- application startup / health；
- E2E；
- ResultOracle；
- property/model-based test；
- mutation test；
- fuzzing；
- architecture/dependency check；
- security/supply-chain check；
- deterministic replay；
- migration/rollback test；
- human review。

不是每个 Node 都运行全部步骤。Policy 与 planner 必须解释选择。

## 3. Planner

Planner 可以使用规则、历史统计和模型建议，但最终 Plan 必须满足确定性 minimum policy。

输入至少包括：

```text
node contract
changed scopes / impact graph
risk class
side effects
permissions
available executors
known test assets
recent failures
historical evidence quality
runtime environment capabilities
```

Plan 不能因为某验证工具不可用就静默标记通过。应形成 `UNAVAILABLE`、`NOT_APPLICABLE`、`SKIPPED_BY_POLICY` 或 `BLOCKED` 等明确结果。

## 4. Evidence 模型

Evidence 是带 provenance、完整性和 subject 关联的事实，不只是日志。

最小 metadata：

```text
evidenceId
evidenceType
subjectRefs
producer
producerVersion
executionRef
createdAt
contentRef
contentHash
mediaType
schemaVersion
trustLevel
collectionMethod
```

Evidence 类型示例：

- test result；
- compiler/static report；
- command transcript；
- process exit/result；
- diff/patch；
- file hash/snapshot；
- model invocation；
- tool invocation；
- approval decision；
- policy decision；
- runtime event；
- performance measurement；
- replay comparison；
- release attestation。

## 5. EvidenceGraph

EvidenceGraph 是逻辑关系模型，不要求 V1 使用图数据库。它需要表达：

```text
produced-by
supports
contradicts
verifies
invalidates
derived-from
caused-by
observed-during
applies-to
supersedes
```

边本身也必须有 producer、rule/version 和时间。模型推断的边与确定性生成的边使用不同 trust level。

## 6. ResultOracle

Executor 只报告“发生了什么”；Oracle 判断“是否满足目标”。二者分离。

例如：

- 命令 exit code 0 不必然代表业务正确；
- 测试数量增加不必然覆盖目标风险；
- 文件存在不代表内容有效；
- 模型声称修复不构成验证；
- coverage 提升不代表关键语义被执行。

OracleAssessment 至少包含：

```text
oracleId/version
subject
observed evidence
expected condition
result: PASS | FAIL | INCONCLUSIVE
confidence
limitations
reason codes
```

关键 Oracle 应优先采用确定性程序；模型 Oracle 只适用于需要语义判断的场景，并必须披露不确定性及独立交叉验证策略。

## 7. GateDecision

建议结果：

```text
PASS
PASS_WITH_RISK_ACCEPTANCE
REWORK
BLOCK
REQUIRE_HUMAN_APPROVAL
FAIL_TERMINAL
INCONCLUSIVE
```

GateDecision 是 canonical policy evaluator 根据 Plan、Assessment、Evidence completeness 和审批事实产生的权威决策。Executor、模型和实现 Agent均不能自行提交 `VERIFIED`。

## 8. NodeExecutionRecord 关系

NodeExecutionRecord 引用：

- VerificationRequest/Plan；
- 每个 VerificationExecution；
- Evidence；
- OracleAssessment；
- GateDecision；
- 未运行/不可用步骤；
- risk acceptance。

这样 Router 和 Learning 才能区别“真正通过”“没有验证”“工具不可用”和“人类接受剩余风险”。

## 9. Observability

OpenTelemetry 用于跨 runtime、worker、tool 和 adapter 关联 traces、logs、metrics。建议映射：

```text
WorkflowRun -> root trace / durable correlation
NodeExecution -> span or span group
Attempt -> child span
Tool/Model/Verification execution -> child span
runId/nodeId/executionId/attempt -> attributes
```

但 telemetry 不是 authoritative event journal。采样、export 失败或日志丢失不能改变业务事实。关键 Evidence 必须由业务 transaction/Artifact Store 保存。

## 10. 验证资产质量

每个 verification asset 记录：

- owner；
- target Contract/risk；
- environment assumptions；
- flakiness；
- last successful execution；
- mutation sensitivity；
- known gaps；
- version/provenance。

历史 Evidence 可以影响规划，但不能让长期未运行的测试被误认为仍有效。

## 11. GitHub 与本地验证

### GitHub

负责可复现的源码、Contract、architecture、unit/integration、packaging、supply-chain 和 synthetic scenario 验证。

### Local

负责私有 Workspace、真实模型/provider、GBrain、设备环境、性能和本地状态迁移验收。

两者不要求自动双向同步。Local 失败可由用户提供结构化 failure facts，在 GitHub 构造去敏的 regression fixture。不得因本地 Evidence 无法上传而跳过本地验收。
