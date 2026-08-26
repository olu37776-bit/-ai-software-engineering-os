# 完整 Framework Capability Map

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 目的

本文件定义“完整框架”到底包含哪些能力，并区分架构成熟度与 GitHub 实现状态。它是路线图、Issue 和 Release scope 的上层索引。

当前事实：新 GitHub 仓库只有文档基线，生产实现均未开始。旧本地代码不计入 GitHub 实现完成度。

## 2. 能力域

| Capability | 核心责任 | 架构状态 | GitHub 实现 | 主要依赖 | V1 完成门禁 |
|---|---|---|---|---|---|
| Framework Platform | composition root、生命周期、配置、CLI/API | BASELINED | NOT_STARTED | contracts, persistence | doctor/start/stop/recovery |
| Contract System | schema、version、compatibility、validation | BASELINED | NOT_STARTED | none | boundary runtime validation |
| Deterministic Kernel | Command、Event、transition、transaction | BASELINED | NOT_STARTED | contracts, persistence | replay/idempotency/crash tests |
| Workflow Runtime | definition、run、dependency、router | BASELINED | NOT_STARTED | kernel, policy | deterministic routing |
| Node Runtime | execution、attempt、lifecycle、record | BASELINED | NOT_STARTED | kernel, workflow | independent retry/verify/attribution |
| Scheduler | eligibility、lease、timeout、backpressure | BASELINED | NOT_STARTED | workflow, persistence | restart-safe scheduling |
| Context System | source、trust、budget、snapshot | BASELINED | NOT_STARTED | contracts, knowledge | immutable context provenance |
| Skill System | versioned reusable execution asset | BASELINED | NOT_STARTED | context, policy | contract and permission conformance |
| Policy System | permission、risk、budget、minimum gate | BASELINED | NOT_STARTED | contracts | fail-closed deterministic decisions |
| Human Approval | request、scope、expiry、decision | BASELINED | NOT_STARTED | policy, evidence | replay-safe approval lifecycle |
| Model Integration | provider capability、invocation、proposal | BASELINED | NOT_STARTED | adapters, context | model cannot commit authority |
| Tool Execution | sandboxed capability execution | BASELINED | NOT_STARTED | workers, policy | idempotent/controlled effects |
| Workspace Integration | git/file snapshot、staged changes | BASELINED | NOT_STARTED | tool, evidence | path safety and rollback |
| Knowledge Integration | GBrain/KB query and provenance | BASELINED | NOT_STARTED | context, adapters | local KB used without migration |
| Verification Planner | risk/impact/evidence-based plan | BASELINED | NOT_STARTED | policy, contracts | explainable minimum-compliant plan |
| Verification Executors | static/test/E2E/security adapters | BASELINED | NOT_STARTED | workers | conformance and explicit unavailable |
| ResultOracle | Evidence -> assessment | BASELINED | NOT_STARTED | verification, evidence | detects exit-0-but-wrong |
| Verification Gate | assessment/policy -> decision | BASELINED | NOT_STARTED | policy, oracle | only authority can mark verified |
| Evidence System | artifacts、metadata、graph、provenance | BASELINED | NOT_STARTED | persistence | content integrity and query |
| Observability | traces、logs、metrics、diagnostics | BASELINED | NOT_STARTED | platform | correlated but non-authoritative |
| Learning Attribution | Node/component attribution | BASELINED | NOT_STARTED | records, evidence | alternatives/uncertainty retained |
| Causal Validation | replay、intervention、counterfactual | BASELINED | NOT_STARTED | learning, runtime | correlation not auto-root-cause |
| Learning Gate | proposal review/application governance | BASELINED | NOT_STARTED | policy, verification | proposal-first and rollback |
| Persistence | journal、projection、artifact metadata | BASELINED | NOT_STARTED | contracts | integrity/migration/backup |
| Security Runtime | capability、secret、sandbox、audit | BASELINED | NOT_STARTED | policy, workers | deny-by-default and fail closed |
| Release System | build、SBOM、provenance、package | BASELINED | NOT_STARTED | platform | verified self-contained artifact |
| Local Operations | init、upgrade、rollback、backup | BASELINED | NOT_STARTED | release, persistence | safe one-way local activation |

## 3. 关键纵向链

### Execution Chain

```text
Command
-> Policy pre-check
-> Kernel transition
-> Event/outbox commit
-> Worker result
-> Evidence
-> Verification
-> GateDecision
-> Router
```

### Learning Chain

```text
NodeExecutionRecord
-> EvidenceGraph
-> Attribution
-> RootCauseCandidate
-> Causal Validation
-> LearningProposal
-> LearningGate
```

### Local Integration Chain

```text
GitHub Release
-> Local Runtime
-> Adapter capability discovery
-> local Model/Tool/Workspace/GBrain
-> Context/Result/Evidence
```

## 4. 当前建设成熟度判断

### 已成熟到可作为重建输入

- Node 最小执行/归因单位；
- Verification System 定位；
- NodeExecutionRecord 与 Evidence 关系；
- Learning 因果链；
- semantic ownership；
- GitHub 完整建设、本地单向运行；
- GBrain 外部接入边界。

### 已有方向但仍需 executable Contract

- Workflow/Node exact schemas；
- Router rule model；
- Policy DSL/engine；
- persistence driver；
- local Control API；
- sandbox implementation levels；
- model/tool adapter protocol；
- LearningProposal application scope。

### 不继承

- 旧目录、类和 operation 布局；
- 隐式 singleton/cache authority；
- 重复 state transition；
- 旧测试对不存在文件或实现细节的依赖；
- 仅靠覆盖率或 Agent 回执判断质量。

## 5. Capability 完成规则

某能力只有在以下都成立时才从 `NOT_STARTED/IMPLEMENTED` 进入 `VERIFIED`：

1. 责任与 canonical owner 已冻结；
2. public/persisted Contract 可机器验证；
3. 正向、失败、恢复和安全路径已实现；
4. 与相邻 capability 的 contract test 通过；
5. 目标风险有 Evidence；
6. 独立 GateDecision 为通过；
7. Release/本地运行所需资产完整。
