# ADR-0003：确定性、事件日志化的权威执行模型

状态：`ACCEPTED`  
日期：`2026-08-26`

## Context

自然语言会话、可变内存和日志无法可靠表示长时间运行状态。外部调用与状态写入分离不当会造成重复副作用和未知结果。多个 operation 各自修改状态会形成重复语义。

## Decision

Workflow/Node 权威状态由纯 transition 根据 Command 和当前 aggregate state 决定，并通过 append-only Domain Event 提交。外部副作用使用 transactionally-created outbox task，由 Worker 执行并以 Result Command 返回。

Projection、cache、telemetry 和 Agent summary 都不是事实源。

## Consequences

- 支持 crash recovery、replay、audit 和版本兼容；
- 需要 event schema、upcaster、projection 和 migration 纪律；
- reducer 内禁止 I/O、模型、全局时间和随机；
- duplicate command/effect 需要 idempotency；
- 复杂度集中在小而严格的 Kernel，而不是分散在所有 operation。

## Rejected Alternatives

- 直接更新可变状态表：审计和恢复能力不足；
- 依靠日志重建：日志可采样、丢失且缺少事务语义；
- 使用模型生成下一份完整状态：不可确定、不可安全验证；
- 每个 operation 内独立 switch：重复 semantic owner。

## Verification

必须通过 replay、duplicate delivery、crash boundary、concurrency conflict 和 mutation tests。
