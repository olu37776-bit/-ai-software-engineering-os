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

## 编写模板

```text
Title
Status
Date
Context
Decision
Consequences
Rejected alternatives
Verification / revisit trigger
```

ADR 只记录重要选择，不取代详细 Contract。变更已接受 ADR 必须创建新 ADR 并把旧 ADR 标记 `SUPERSEDED`，不得静默改写历史理由。
