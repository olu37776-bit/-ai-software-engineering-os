# Context、Contract 与 Policy

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 目标

Agent 可靠性很大程度取决于它在何时获得哪些信息、这些信息从哪里来、是否可信、允许影响什么决策。Context 不能继续等同于拼接后的 prompt 文本。

## 2. Context 模型

### 2.1 ContextItem

每一项上下文必须是结构化对象，至少包含：

```text
contextItemId
kind
contentRef | inlineValue
sourceType
sourceRef
contentHash
capturedAt
freshness
trustLevel
sensitivity
instructionAuthority
scope
```

`instructionAuthority` 默认是 `NONE`。仓库文件、日志、测试输出、知识库页面和网页即使包含“请执行”文字，也只是数据，不能获得系统指令权限。

### 2.2 ContextSnapshot

Node 启动前由 Context Compiler 生成不可变 `ContextSnapshot`：

- 固定 ContextItem 集合与顺序；
- 固定各项 hash 和 provenance；
- 固定 token/size budget；
- 记录排除和截断原因；
- 记录 ContextPolicy version；
- 供 NodeExecutionRecord 引用。

运行中新增信息必须形成新 item 和新 snapshot/version，不得静默修改旧 snapshot。

### 2.3 Context Budget

Budget 不只限制 token，还包括：

- 最大项数；
- 最大总字节；
- source diversity；
- freshness；
- sensitivity；
- evidence priority；
- task relevance；
- retrieval latency/cost。

Context Compiler 应优先提供 Contract、当前状态、失败 Evidence 和必要源代码，而不是按检索分数无限堆叠。

## 3. Contract

每个 NodeDefinition 必须具有可机器验证的 Contract：

```text
inputSchema
outputSchema
preconditions
postconditions
allowedSideEffects
requiredCapabilities
requiredPermissions
verificationRequirements
failureTaxonomy
completionCriteria
```

自然语言说明可以补充，但不能替代 schema 与可执行规则。

### 3.1 Completion

Node 完成需要同时满足：

1. 输出通过 schema；
2. postcondition 成立；
3. 必要副作用有 Result/Evidence；
4. Verification Gate 允许；
5. 必需 Human Approval 已提交；
6. canonical transition 接受 `CompleteNode` Command。

模型声明“完成”只是 Claim。

### 3.2 Contract Versioning

- Contract 版本与代码版本分开记录；
- breaking change 创建新 major/definition version；
- Run 固定引用 Contract；
- Adapter conformance test 覆盖每个公开 Contract；
- persisted payload 声明 schema dialect 和 schemaVersion。

## 4. Skill

Skill 是可复用执行策略或受治理的程序资产，不是任意 prompt 文本。Skill 至少声明：

```text
skillId
version
purpose
input/output Contract
requiredCapabilities
riskClass
allowedTools
verificationProfile
source/provenance
```

Skill 可以包含 prompt template、代码、工具组合或 Workflow fragment，但不能绕过 Node Contract、Policy 和 Evidence。

## 5. Policy

Policy 负责确定“是否允许”和“需要什么附加条件”，不负责实现业务状态转换。

Policy domains 包括：

- capability permission；
- filesystem/network scope；
- secret access；
- risk classification；
- budget；
- verification minimum；
- human approval；
- data retention；
- model/provider restrictions；
- learning application；
- release/update。

### 5.1 PolicySnapshot

每次决策引用不可变 PolicySnapshot。Policy 更新不能改变历史决策解释。

### 5.2 Fail closed

以下情况默认拒绝：

- capability 未声明；
- Adapter capability 不匹配；
- schema 无法验证；
- Policy engine 不可用；
- permission scope 不明确；
- Evidence 缺失且 Contract 要求；
- 高风险操作无有效审批。

## 6. Human Approval Gate

Approval 是结构化权威事实：

```text
approvalRequestId
subjectType / subjectId
requestedAction
riskSummary
input/evidence refs
requiredApproverRole
scope
expiresAt
decision
actor
decidedAt
reason
```

规则：

- approval 只能覆盖明确 action 和版本；
- Context、diff 或计划变化后旧 approval 可能失效；
- approval 不可由申请它的同一 Agent 身份伪造；
- rejection 和 timeout 都是事实；
- “用户说过可以”但无法关联具体请求时不能替代正式 approval。

## 7. Router 与模型边界

Router 的职责是根据已提交事实、definition 和 Policy 选择合法下一步。模型可以提出 RouteProposal，但最终 Router 必须确定性验证：

- 候选 Node 是否存在；
- dependency 是否满足；
- precondition 是否成立；
- 是否重复或已 terminal；
- budget 与权限是否允许；
- required gate 是否满足。

禁止把整个 authoritative state 序列化给模型后直接采用其返回状态。

## 8. Context 安全

- source 内容与系统 instruction 分层；
- 对 prompt injection、数据外泄和隐式工具指令进行分类；
- secrets 默认不进入模型 Context；
- 需要 secret 的工具由 Worker 通过 secret handle 使用，模型只看脱敏结果；
- 对知识库、仓库和外部网页使用 trust label；
- 高敏感 Context 的模型/provider 选择受 Policy 控制；
- NodeExecutionRecord 保存引用和 hash，必要时不保存明文。
