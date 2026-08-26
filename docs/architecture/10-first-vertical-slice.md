# 第一条可执行 Vertical Slice

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 目的

第一条 vertical slice 用最小业务场景同时验证 Kernel、Workflow、Node、Context、Model Proposal、Tool Effect、Evidence、Verification、Gate、Router、restart recovery 和 CLI。它不是演示脚本，而是后续能力的架构验收基座。

## 2. 场景

在隔离 fixture Workspace 中完成一个确定的代码/文件变更：

```text
输入：目标文件、期望内容、验证命令
输出：受控 change set + Verification GateDecision
```

Phase 3 使用 FakeModelProvider 和受限 Workspace Adapter，确保系统正确性不依赖外部模型。Phase 4 只替换 Adapter，不改变 Workflow/Kernel Contract。

## 3. WorkflowDefinition

Canonical ID：`fixture-change-workflow`  
Version：`1.0.0`

### Node A — `propose-change`

职责：基于 request 和 ContextSnapshot 生成结构化 `PatchProposal`。

Input：

```text
workspaceRef
targetPath
desiredContent
contextSnapshotId
```

Output：

```text
proposalId
baseSnapshotHash
operations[]
expectedResultHash
rationaleArtifactRef
```

约束：模型返回的 `completed/verified/approved` 字段即使存在也必须被 schema 拒绝或忽略；Proposal 不是状态变更。

### Node B — `apply-change`

职责：验证 Proposal、申请 `write_workspace` capability，通过 SideEffectTask 在 staged workspace 应用变更。

Preconditions：

- Node A 有 accepted output；
- base snapshot 未变化；
- path 在 allowlist；
- Policy 允许 low-risk fixture write；
- Proposal operations 通过 schema。

Output：

```text
changeSetId
beforeSnapshotRef
afterSnapshotRef
diffArtifactRef
changedPaths
```

### Node C — `verify-change`

职责：根据 Contract 和风险生成 VerificationPlan，执行内容校验和验证命令。

最小步骤：

1. target path/content hash Oracle；
2. workspace diff scope Oracle；
3. configured command executor；
4. command exit/output Evidence；
5. final GateDecision。

### Workflow Completion

Workflow 只有在 Node C 的 GateDecision 为 `PASS` 且所有 required nodes terminal succeeded 时完成。Router 不能仅因 Node B 写入成功而完成 Run。

## 4. Command Sequence

```text
CreateWorkflowRun
StartEligibleNode(propose-change)
BindContextSnapshot
SubmitProposal
AcceptNodeOutput
CompleteNode(propose-change)
StartEligibleNode(apply-change)
ScheduleSideEffect
RecordSideEffectResult
AcceptNodeOutput
CompleteNode(apply-change)
StartEligibleNode(verify-change)
CreateVerificationPlan
RecordVerificationStepResult...
RecordGateDecision
CompleteNode(verify-change)
CompleteWorkflowRun
```

每个 Command 有 `commandId`、`causationId`、`correlationId` 和 expected aggregate version。

## 5. Expected Domain Events

至少包括：

```text
WorkflowRunCreated
NodeBecameEligible
NodeExecutionStarted
ContextSnapshotBound
ProposalRecorded
NodeOutputAccepted
SideEffectTaskScheduled
SideEffectResultRecorded
VerificationRequested
VerificationPlanCreated
VerificationStepCompleted
GateDecisionRecorded
NodeExecutionSucceeded
WorkflowRunSucceeded
```

失败、拒绝、cancel、timeout、retry 和 reconciliation 使用独立 Event，不通过覆盖旧状态表达。

## 6. Atomicity

应用变更的关键边界：

```text
SideEffectTaskScheduled + outbox committed
-> Worker applies staged change
-> SideEffectResult returned with idempotencyKey
-> Result Command commits event
```

Worker 在结果返回前崩溃时，Runtime 重投同一 task。Workspace Adapter 必须检测同一 idempotencyKey/expected base hash，避免重复或基于错误版本写入。

## 7. Context

Node A 的 ContextSnapshot 只包含：

- request；
- target file snapshot；
- output Contract；
- allowed operations；
- Policy summary；
- fixture-specific instructions。

不注入整个仓库。每个 item 有 hash、source、trust 和 instructionAuthority。Fixture 文件中的命令式文本是 untrusted data。

## 8. VerificationPlan

风险级别：`R2`，因为涉及跨边界文件副作用和 Verification Gate。

Minimum Plan：

```text
V1 schema validation of PatchProposal
V2 base snapshot precondition
V3 path scope check
V4 exact desired-content oracle
V5 no unexpected changed paths oracle
V6 configured verification command
V7 Evidence completeness
V8 Gate policy evaluation
```

任何 required step `UNAVAILABLE/INCONCLUSIVE` 时 Gate 不得 `PASS`。

## 9. NodeExecutionRecord 验收

每个 NodeExecutionRecord 必须关联：

- workflow/node definition versions；
- execution/attempt；
- framework commit/version；
- ContextSnapshot；
- proposal/model invocation（Node A）；
- SideEffectTask/result/diff（Node B）；
- VerificationPlan/steps/Evidence/Gate（Node C）；
- PolicySnapshot 和 adapter versions；
- start/end/status/error。

## 10. Mandatory Failure Scenarios

1. **Malformed Proposal**：schema rejection，无 Workspace 写入；
2. **Model claims complete**：不能产生 terminal transition；
3. **Duplicate SubmitProposal**：同 commandId 返回原结果；
4. **Base changed**：Node B `BLOCKED/REWORK`，不覆盖文件；
5. **Crash after outbox commit**：重启后 task 恢复；
6. **Crash after effect before result commit**：相同 idempotencyKey reconcile，不重复改变；
7. **Exit 0 but wrong content**：内容 Oracle FAIL，Gate REWORK；
8. **Verifier unavailable**：Gate BLOCK/INCONCLUSIVE；
9. **Duplicate worker result**：inbox 去重；
10. **Concurrent CompleteNode**：只有一个 event version 成功；
11. **Restart before Workflow terminal**：从 journal 恢复并继续；
12. **Unexpected path write**：Policy/Oracle 拒绝并回滚 staged change。

## 11. CLI Acceptance

```text
framework run fixture-change-workflow --input <fixture.json>
framework inspect run <runId>
framework inspect node <executionId>
framework verify run <runId>
framework stop
framework start
framework inspect run <runId>
```

用户应看到明确状态和 Evidence refs，而不是只看到“成功/失败”文本。

## 12. Exit Gate

该 slice 只有满足以下条件才 `VERIFIED`：

- 12 个 failure scenarios 全部通过；
- restart/replay 后 aggregate 与 projection 一致；
- no duplicate semantic owner architecture check 通过；
- mutation tests 无法轻易移除关键 precondition/gate；
- Windows 和 Linux package smoke 通过；
- 独立审查确认模型、Adapter 和 Executor 均无法直接提交 authority state。
