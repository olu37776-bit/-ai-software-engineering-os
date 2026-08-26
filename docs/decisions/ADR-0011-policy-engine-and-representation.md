# ADR-0011：Policy Engine 与声明式 PolicySet

状态：`ACCEPTED`  
日期：`2026-08-26`

## Context

Policy 需要决定 capability、resource scope、risk、budget、minimum verification、isolation、provider/data restriction 和 Human Approval requirement。它影响 authority path，但不拥有 Workflow/Node 业务状态转换。

如果 V1 使用任意脚本、外部 Policy runtime 或多个表达语言，Framework 会在最关键的 fail-closed 路径中引入动态代码、隐式 I/O、版本漂移和难以解释的规则冲突。另一方面，仅把 Policy 写死在业务 handler 中会形成重复语义并使历史决策无法 replay。

## Decision

### 1. Canonical Owner

V1 唯一 authoritative evaluator 位于：

```text
packages/policy
```

它是纯 TypeScript deterministic core。`PolicyEnginePort` 仍作为 application boundary、fake/conformance 和未来替换点，但 V1 不允许第三方 Adapter、模型、配置模块或外部进程成为 authority evaluator。

Adapter 可以提供 capability facts；模型可以提出 Policy/Learning Proposal；只有 canonical evaluator 产生 `PolicyDecision`。

### 2. Representation

Policy 的 canonical persisted representation 是经过 JSON Schema 2020-12 验证的 `PolicySet` JSON。

可选 authoring format 为受限 YAML 1.2，但 YAML 不是 authority bytes：

```text
restricted YAML source
-> parse with duplicate-key/tag/alias/size limits
-> PolicySet schema validation
-> semantic validation
-> canonical JSON (RFC 8785)
-> SHA-256 hash
-> immutable PolicySnapshot
```

禁止：

- custom YAML tag、object construction、include、environment substitution；
- duplicate key、unbounded alias/anchor；
- arbitrary JavaScript/TypeScript expression；
- dynamic module path、eval、template code；
- Policy 在 evaluation 中读取文件、网络、数据库、环境变量或当前系统时间。

### 3. PolicySet Contract

最小结构：

```text
policySetId
version
schemaVersion
description
source/provenance
rules[]
```

每条 Rule：

```text
ruleId
domain
subjectSelector
action
resourceSelector
when
ruleEffect
requirements
reasonCode
metadata
```

`when` 使用受控、带类型的 Condition AST，只允许已注册 operator，例如：

```text
all / any / not
eq / notEq
in / contains
lt / lte / gt / gte
exists
startsWith
setSubset / setIntersects
```

Operand 只能引用经过 Schema 声明的 `PolicyEvaluationInput` 字段、PolicySnapshot 常量或显式 literal。V1 不开放 regex、自定义函数、递归函数、网络查询或模型调用。

### 4. Hard Invariants

以下不可协商约束由版本化 built-in invariant rules 先执行，并通过 ADR/代码/测试治理：

- 模型、Adapter、Executor 不能直接提交 authority state；
- invalid schema/unsupported version 不进入 authority boundary；
- cache/projection/telemetry 不是事实源；
- high-risk effect 缺少要求的 approval/isolation/evidence 时禁止；
- secret 不进入普通模型 Context、日志或公开 Evidence；
- Policy evaluator unavailable/indeterminate 时 fail closed；
- GitHub -> Local 单向边界不能被本地 policy 改为自动上传私有数据。

Declarative PolicySet 只能在这些不变量内定义环境和任务策略，不能覆盖它们。

### 5. Evaluation Input 与 Purity

一次评估输入至少包括：

```text
actor
subject/action/resource
node/workflow definition refs
requested capabilities/permissions
risk assessment
side-effect properties
context sensitivity/trust
provider/adapter capability facts
available isolation levels
verification requirements/evidence summary
approval facts
budget
captured clock value
effective config snapshot ref
policy snapshot ref
```

Evaluator 是纯函数：

```text
(policySnapshot, evaluationInput)
  -> PolicyDecision
```

- clock、identity、capability probe 和 approval 都在调用前捕获；
- 同一 canonical input 与 snapshot 必须产生同一 decision bytes/hash；
- evaluation 不写状态；结果由 Kernel Command 提交为事实；
- compile cache 可优化性能，但不是 authority，丢失后可由 snapshot 重建。

### 6. Decision 与 Conflict Semantics

`PolicyDecision.outcome`：

```text
ALLOW
ALLOW_WITH_REQUIREMENTS
DENY
INDETERMINATE
```

确定性算法：

1. Schema/semantic validation 失败 -> `INDETERMINATE`；
2. built-in hard invariant violation -> `DENY`；
3. 任一匹配 deny rule -> `DENY`（deny-overrides）；
4. 无匹配 explicit allow -> `DENY`（default deny）；
5. 合并所有匹配 allow rule 的 requirements；
6. requirements 不可兼容或无法解析 -> `INDETERMINATE`；
7. 无附加条件 -> `ALLOW`，否则 `ALLOW_WITH_REQUIREMENTS`。

Runtime 对 `INDETERMINATE` 与 evaluator unavailable 一律 fail closed，不能转为 allow。

Requirements 可以包含：

- permission/resource scope；
- minimum isolation level；
- VerificationProfile/minimum steps；
- Human Approval profile；
- budget/timeout/concurrency；
- provider/data handling restriction；
- preview、reconciliation、retention、post-verification。

### 7. Layering 与 Override

有效 PolicySnapshot 由已批准 source 组合：

```text
release hard invariants
+ release PolicySet
+ machine/user PolicySet
+ workspace PolicySet
+ Node/Workflow referenced PolicySet
+ scoped override facts
```

默认组合必须单调收紧：下层可以增加 deny 或 requirements，不能删除上层 deny/requirements。

需要放宽普通（非 hard invariant）策略时，必须使用结构化 `PolicyOverride`：

```text
overrideId
basePolicySnapshotHash
scope/action/resource
removedOrChangedRequirement
actor/approvalRef
reason
expiresAt
```

Override 有显式 scope、expiry、approval/audit，并生成新 PolicySnapshot。它不能覆盖 built-in hard invariant。

### 8. Explanation、Audit 与 Replay

PolicyDecision 至少记录：

```text
decisionId
outcome
policySnapshotId/hash
inputHash
matchedRuleIds
hardInvariantIds
requirements
denial/indeterminate reasonCodes
residual risks
evaluatedAt(captured)
evaluatorVersion
```

自然语言 explanation 是派生 Artifact；稳定 `reasonCode`、rule refs 和 structured requirements 才是 Contract。

每个 governed authority change 引用 PolicyDecision。历史 replay 使用原 PolicySnapshot 和 captured input，不能用当前 Policy 重解释旧决策。

### 9. Phase Placement

- **Phase 1**：PolicySet/PolicySnapshot/PolicyDecision Schema、compiler、canonicalization 和 evaluator skeleton；
- **Phase 2**：Kernel application service 集成、audit/replay、minimum capability/isolation rules；
- **Phase 3**：首条 vertical slice 必须真实消费 PolicyDecision；
- **Phase 6**：扩展完整 permission token、approval lifecycle、risk acceptance 和 OS sandbox governance。

因此 Phase 6 不创建第二套 Policy engine，只扩展同一 canonical owner。

## Consequences

- Policy 可版本化、hash、审查、replay 和 property-test；
- declarative data 不获得任意代码执行权；
- deny-overrides/default-deny/fail-closed 语义明确；
- built-in hard invariant 与环境可配置策略分层；
- V1 表达能力有意受限，复杂组织策略可能需要未来扩展；
- YAML 保留可读性，同时 canonical JSON 消除 parser/序列化歧义。

## Rejected Alternatives

- **任意 TypeScript/JavaScript Policy function**：动态代码、I/O、版本和安全边界不可控；
- **OPA/Rego 作为 V1 authority**：引入第二 runtime/编译目标/builtin 语义和本地打包面，当前规模收益不足；
- **Cedar 作为 V1 authority**：擅长授权，但本框架还需要 verification、isolation、budget 和 approval requirements 聚合；
- **CEL/JSON Logic 直接作为完整策略模型**：不能单独解决版本化、规则冲突、requirements、snapshot 和治理；
- **把 Policy 写在各 Node/Adapter handler**：形成重复 owner 且无法统一 replay；
- **模型直接生成并立即应用 Policy**：违反 proposer/authority 分离；
- **first-match/priority 数字**：容易因规则顺序或隐含优先级产生不可见放宽。

## Verification

至少包括：

1. valid/invalid/boundary Schema 与 restricted YAML parser；
2. RFC 8785 canonicalization/hash deterministic fixtures；
3. default deny、deny-overrides、requirements union 和 conflict；
4. unsupported operator/reference/type -> `INDETERMINATE` -> fail closed；
5. hard invariant 无法被 local Policy/override 关闭；
6. layer monotonic-restriction property tests；
7. captured clock/replay 字节级同结果；
8. evaluator crash/unavailable 不产生 allow；
9. model/Adapter 无法提交 PolicyDecision；
10. mutation tests不能移除关键 deny、approval、isolation 或 verification requirement；
11. PolicyDecision 与 NodeExecutionRecord/audit linkage；
12. Context/secret/provider data handling scenarios。

## Revisit Triggers

- 多用户、组织级或远程部署需要统一外部 Policy authority；
- Condition AST 无法表达经验证的核心需求；
- 性能 benchmark 证明内置 evaluator 不满足预算；
- 需要采用 Cedar/OPA/CEL 等外部生态，且能证明 deterministic snapshot、requirements 和 fail-closed 等价；
- Policy authoring/override 发生真实误配置或安全事件；
- 新 hard invariant 需要 ADR 更新。
