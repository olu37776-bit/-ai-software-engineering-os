# 文档体系

本目录是 AI Software Engineering OS 的权威设计入口。文档不是代码的附属说明，而是 Contract、实现、测试、Evidence 与发布门禁的共同基线。

## 1. 文档权威层级

从高到低：

1. **Framework Charter / Architecture Invariants**：定义不可随实现任意改变的系统目标与不变量；
2. **ADR（Architecture Decision Record）**：记录已批准的关键选择、背景与后果；
3. **Subsystem Contract / Schema**：定义可机器验证的边界与数据结构；
4. **Implementation Plan**：定义阶段、WRITE_SCOPE、验证与退出条件；
5. **Implementation Note / Evidence**：记录真实实现与验证事实。

发生冲突时不得凭“代码已经存在”自动判定代码正确。必须确定哪一层权威已被批准，并通过 ADR 或 remediation 恢复一致性。

## 2. 状态词

- `DRAFT`：仍可调整，不得作为生产实现的唯一依据；
- `BASELINE`：已形成阶段基线，可以指导实现；
- `FROZEN`：关键语义冻结，变更必须通过 ADR；
- `IMPLEMENTED`：执行者已完成实现，但未完成独立验证；
- `VERIFIED`：独立验证已确认文档、Contract、代码、测试和 Evidence 一致；
- `SUPERSEDED`：已被新文档替代，不得继续作为当前权威；
- `RETIRED`：语义或能力已正式退役。

实现 Agent 不得自行把状态从 `IMPLEMENTED` 改为 `VERIFIED`。

## 3. 当前目录

```text
docs/
├─ architecture/   目标架构、运行模型和跨子系统边界
├─ decisions/      Architecture Decision Records
├─ engineering/    工程标准、代码结构和质量门禁
├─ operations/     本地运行、发布、升级、恢复与诊断
├─ roadmap/        分阶段建设计划与退出门禁
├─ references/     标准、规范与外部先验
└─ glossary.md     Canonical terms 与 aliases
```

## 4. 第一批架构文档

| 文档 | 作用 |
|---|---|
| `00-current-knowledge-baseline.md` | 固化从现有工作中已验证的决策和负面经验 |
| `01-framework-charter.md` | 定义使命、范围、成功标准与非目标 |
| `02-target-architecture.md` | 定义完整系统的组件、依赖方向和运行拓扑 |
| `03-durable-execution-model.md` | 定义 Workflow、Node、Command、Event、恢复与并发 |
| `04-context-contract-policy.md` | 定义 Context、Contract、Skill、Policy 与审批 |
| `05-verification-and-evidence.md` | 定义 Verification System、Evidence 和门禁 |
| `06-learning-and-feedback.md` | 定义归因、因果验证、LearningProposal 和 LearningGate |
| `07-local-integrations.md` | 定义模型、工具、Workspace 和知识库接入边界 |
| `08-security-and-governance.md` | 定义威胁模型、权限、隔离、供应链和治理 |

## 5. 文档变更规则

任何影响以下事项的改动必须新增或更新 ADR：

- Node、Workflow 或执行身份模型；
- authoritative state 与事实存储方式；
- 状态转换所有权；
- 并发、幂等、重试、取消或恢复语义；
- Verification Gate 或 Human Approval Gate；
- 本地数据边界与外部适配器权限；
- persisted schema / public contract 的不兼容变更；
- Release、升级与回滚协议；
- 安全边界和默认权限。

## 6. 一致性要求

每个正式能力必须能建立如下映射：

```text
Architecture Decision
        -> Contract / Schema
        -> Canonical Implementation Owner
        -> Verification Assets
        -> Runtime Evidence
        -> Release Manifest
```

禁止出现多个文件、多个 operation 或多个 adapter 分别复制同一核心业务语义。共享语义必须有一个 canonical owner，其他路径只能委托或使用其公开 Contract。

本文档状态：`BASELINE DRAFT v0.1`
