# 文档体系

本目录是 AI Software Engineering OS 的权威设计入口。文档不是代码的附属说明，而是 Contract、实现、测试、Evidence 与发布门禁的共同基线。

## 1. 文档权威层级

从高到低：

1. **Framework Charter / Architecture Invariants**：定义不可随实现任意改变的系统目标与不变量；
2. **ADR（Architecture Decision Record）**：记录已批准的关键选择、背景与后果；
3. **Subsystem Contract / Schema**：定义可机器验证的边界与数据结构；
4. **Implementation Plan**：定义阶段、WRITE_SCOPE、验证与退出条件；
5. **Implementation Note / Evidence**：记录真实实现与验证事实。

Review 验证这些层是否一致，但不产生高于 ADR/Contract 的新语义。发生冲突时不得凭“代码已经存在”自动判定代码正确；必须通过 ADR 或 remediation 恢复一致性。

## 2. 状态词

- `DRAFT`：仍可调整，不得作为生产实现的唯一依据；
- `BASELINE`：已形成阶段基线，可以指导实现；
- `FROZEN`：关键语义冻结，变更必须通过 ADR；
- `IMPLEMENTED`：执行者已完成实现，但未完成独立验证；
- `VERIFIED`：独立验证已确认文档、Contract、代码、测试和 Evidence 一致；
- `SUPERSEDED`：已被新文档替代，不得继续作为当前权威；
- `RETIRED`：语义或能力已正式退役。

实现 Agent 不得自行把状态从 `IMPLEMENTED` 改为 `VERIFIED`。架构文档 Review 通过也不代表尚不存在的代码已验证。

## 3. 目录

```text
docs/
├─ architecture/   目标架构、运行模型和跨子系统边界
├─ contracts/      核心对象、Schema inventory 与 public Contract
├─ decisions/      Architecture Decision Records
├─ engineering/    工程结构、实现标准和质量门禁
├─ operations/     本地运行、配置、发布、升级与恢复
├─ reviews/        独立架构/实现审查与 Gate 结论
├─ roadmap/        分阶段建设计划与状态
├─ security/       Threat model 与安全验证
├─ references/     标准、规范与外部先验
└─ glossary.md     Canonical terms 与 aliases
```

## 4. 阅读顺序

### 建立全局理解

1. [当前知识基线](architecture/00-current-knowledge-baseline.md)
2. [Framework Charter](architecture/01-framework-charter.md)
3. [目标系统架构](architecture/02-target-architecture.md)
4. [完整能力地图](architecture/09-capability-map.md)
5. [Canonical Glossary](glossary.md)

### 验证架构决策

1. [ADR Index](decisions/README.md)
2. [Phase 0 Independent Architecture Review](reviews/phase-0-independent-architecture-review.md)
3. [当前状态](roadmap/progress-status.md)
4. [Phase 1 集成验证交接](implementation/phase-1/o09/integrated-verification-handoff.md)
5. [Phase 1 独立 Gate 说明](reviews/phase-1-integrated-verification-handoff.md)

当前五项实现级基线：

- [Toolchain](decisions/ADR-0007-typescript-toolchain-baseline.md)
- [Persistence](decisions/ADR-0008-embedded-persistence-sqlite.md)
- [Local Control API](decisions/ADR-0009-local-control-api-protocol.md)
- [Windows Isolation](decisions/ADR-0010-windows-execution-isolation.md)
- [Policy Engine](decisions/ADR-0011-policy-engine-and-representation.md)

### 理解运行事实链

1. [耐久执行模型](architecture/03-durable-execution-model.md)
2. [Context、Contract 与 Policy](architecture/04-context-contract-policy.md)
3. [Verification 与 Evidence](architecture/05-verification-and-evidence.md)
4. [Learning & Feedback](architecture/06-learning-and-feedback.md)
5. [第一条 Vertical Slice](architecture/10-first-vertical-slice.md)

### 准备实现

1. [核心 Contract Catalog](contracts/core-contract-catalog.md)
2. [Repository Blueprint](engineering/repository-blueprint.md)
3. [工程实现标准](engineering/engineering-standard.md)
4. [质量门禁](engineering/quality-gates.md)
5. [非功能需求](architecture/11-nonfunctional-requirements.md)
6. [Threat Model](security/threat-model.md)
7. [重建路线图](roadmap/rebuild-roadmap.md)

### 准备本地运行

1. [本地资源与知识库接入](architecture/07-local-integrations.md)
2. [Release 与本地运行协议](operations/release-local-runtime.md)
3. [配置 Contract](operations/configuration-contract.md)
4. [当前状态](roadmap/progress-status.md)

## 5. 文档变更规则

任何影响以下事项的改动必须新增或更新 ADR：

- Node、Workflow 或执行身份模型；
- authoritative state 与事实存储方式；
- 状态转换所有权；
- 并发、幂等、重试、取消或恢复语义；
- Verification Gate 或 Human Approval Gate；
- 本地 Control API、数据边界与外部适配器权限；
- Policy representation/evaluation 或 execution isolation；
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

禁止出现多个文件、多个 use case handler 或多个 Adapter 分别复制同一核心业务语义。共享语义必须有一个 canonical owner，其他路径只能委托或使用其公开 Contract。

本文档状态：`BASELINE DRAFT v0.3`

## M0 remediation

- [Phase 0 Schema / Phase 1 Governance Remediation Review](reviews/phase-0-schema-phase1-governance-review.md)
