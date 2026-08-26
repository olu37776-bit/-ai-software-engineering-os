# AI Software Engineering OS

> 面向真实软件工程工作的本地优先、证据驱动、可治理、可验证的 Agentic Engineering Framework。

## 当前状态

本仓库正在进行 **完整框架重建（Full Rebuild）**。它不是旧本地实现的搬运仓库，也不以兼容旧代码结构为目标。

旧实现仅提供三类输入：

1. 已经确认的架构决策；
2. 可验证的行为事实与失败案例；
3. 需要在新架构中明确消除的缺陷模式。

新框架的代码、契约、测试、发布制品和权威文档全部在 GitHub 建设。完成后以不可变 Release 单向下载到本地运行，并连接本地项目、模型、工具、状态与知识库。

```text
GitHub：设计 / 实现 / 验证 / Release
                         |
                         | 单向下载
                         v
Local：运行 Framework + 接入本地资源
```

## 核心目标

- 以 `Node` 作为最小执行和归因单位；
- 以确定性控制内核管理 Workflow、状态转换、并发、重试和恢复；
- 将 LLM 限定为提议者（proposer），而非权威状态修改者；
- 将 Verification System 作为运行时一等子系统，而不是传统 CI 的别名；
- 以 `NodeExecutionRecord`、Evidence 和 provenance 建立可审计事实链；
- 通过策略、权限与 Human Approval Gate 治理高风险操作；
- 通过稳定 Ports/Adapters 接入本地模型、工具、Workspace 与 GBrain 等知识系统；
- 支持完整本地运行、升级、回滚和离线使用，不要求上传本地私有数据。

## 目标运行形态

```text
AI Software Engineering OS
├─ Deterministic Control Kernel
├─ Workflow / Node Runtime
├─ Context & Contract System
├─ Policy & Approval System
├─ Verification System
├─ Evidence & Provenance System
├─ Learning & Feedback System
├─ Model / Tool / Workspace Adapters
├─ Local Knowledge Adapters
├─ CLI / Local Control API
└─ Release / Upgrade / Recovery
```

## 文档入口

### 总览

- [文档体系与权威层级](docs/README.md)
- [Canonical Glossary](docs/glossary.md)
- [完整能力地图](docs/architecture/09-capability-map.md)
- [当前建设状态](docs/roadmap/progress-status.md)

### 架构

- [当前已确认的架构知识](docs/architecture/00-current-knowledge-baseline.md)
- [Framework Charter](docs/architecture/01-framework-charter.md)
- [目标系统架构](docs/architecture/02-target-architecture.md)
- [耐久执行模型](docs/architecture/03-durable-execution-model.md)
- [Context、Contract 与 Policy](docs/architecture/04-context-contract-policy.md)
- [Verification System 与 Evidence](docs/architecture/05-verification-and-evidence.md)
- [Learning & Feedback](docs/architecture/06-learning-and-feedback.md)
- [本地资源与知识库接入](docs/architecture/07-local-integrations.md)
- [安全与治理](docs/architecture/08-security-and-governance.md)
- [第一条可执行 Vertical Slice](docs/architecture/10-first-vertical-slice.md)
- [非功能需求](docs/architecture/11-nonfunctional-requirements.md)

### Contract、工程与运行

- [核心 Contract Catalog](docs/contracts/core-contract-catalog.md)
- [Repository Blueprint](docs/engineering/repository-blueprint.md)
- [工程实现标准](docs/engineering/engineering-standard.md)
- [质量门禁标准](docs/engineering/quality-gates.md)
- [Release 与本地运行协议](docs/operations/release-local-runtime.md)
- [配置 Contract](docs/operations/configuration-contract.md)
- [Threat Model](docs/security/threat-model.md)
- [完整重建路线图](docs/roadmap/rebuild-roadmap.md)
- [Architecture Decision Records](docs/decisions/README.md)

## 当前阶段

当前处于 `Phase 0 — Architecture Authority`。目标是完成文档一致性审查、核心 Schema inventory、工具链/存储 ADR 和第一阶段 WRITE_SCOPE，然后才开始生产代码。

本文档状态：`BASELINE DRAFT v0.2`  
基线日期：`2026-08-26`

## M0 remediation status

```text
Schema / Phase 1 governance remediation: IMPLEMENTED
Independent preimplementation verification: PENDING
M0 final Gate: NOT_YET_GRANTED
Phase 1: NOT_STARTED
```

See `docs/reviews/phase-0-schema-phase1-governance-review.md`.
