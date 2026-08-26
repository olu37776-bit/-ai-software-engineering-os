# Architecture Decision Records

ADR 用于记录会长期约束实现的架构选择。

## 状态

- `PROPOSED`
- `ACCEPTED`
- `SUPERSEDED`
- `REJECTED`
- `DEPRECATED`

## 已建立决策

| ADR | 决策 |
|---|---|
| [ADR-0001](ADR-0001-full-rebuild.md) | 完整重建，不迁移旧实现结构 |
| [ADR-0002](ADR-0002-node-unit-of-execution.md) | Node 是最小执行与归因单位 |
| [ADR-0003](ADR-0003-durable-authority-model.md) | 确定性、事件日志化的权威执行模型 |
| [ADR-0004](ADR-0004-github-to-local-boundary.md) | GitHub 完整建设、本地单向部署与私有资产接入 |
| [ADR-0005](ADR-0005-modular-monolith-workers.md) | 模块化单体 + 隔离 Worker |
| [ADR-0006](ADR-0006-model-is-proposer.md) | 模型是提议者，不是权威状态所有者 |
| [ADR-0007](ADR-0007-typescript-toolchain-baseline.md) | Node.js 24.19.0、TypeScript 6.0.3、pnpm 11.24.0 与 ESM-only 工具链 |
| [ADR-0008](ADR-0008-embedded-persistence-sqlite.md) | SQLite 3.53.3 + `node:sqlite` + 专用 PersistenceWorker |
| [ADR-0009](ADR-0009-local-control-api-protocol.md) | loopback HTTP/JSON、token auth、OpenAPI 与 SSE 的 Local Control API |
| [ADR-0010](ADR-0010-windows-execution-isolation.md) | Windows 四级执行隔离、能力证明与禁止静默降级 |
| [ADR-0011](ADR-0011-policy-engine-and-representation.md) | 内置确定性 Policy evaluator 与声明式 PolicySet |

## Current Implementation Baseline

Phase 1 实现必须同时符合 ADR-0001～ADR-0011。具体 library patch、Schema 和代码位置由 lockfile、toolchain manifest、Contract Catalog 与 Phase 1 WRITE_SCOPE 固定，不能创建平行权威清单。

五项实现级决策的独立审查见：

- [Phase 0 Independent Architecture Review](../reviews/phase-0-independent-architecture-review.md)

## 编写模板

```text
Title
Status
Date
Context
Decision
Canonical ownership
Consequences
Rejected alternatives
Verification
Revisit triggers
```

ADR 只记录重要选择，不取代详细 Contract。变更已接受 ADR 必须创建新 ADR 并把旧 ADR 标记 `SUPERSEDED`，不得静默改写历史理由。
