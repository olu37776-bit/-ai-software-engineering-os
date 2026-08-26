# ADR-0002：Node 是最小执行与归因单位

状态：`ACCEPTED`  
日期：`2026-08-26`

## Context

以 Agent 或整个 Workflow 作为最小单位会混合多个 Context、工具调用、失败原因和验证责任，无法精确 retry、Evidence 关联与 Learning attribution。

## Decision

`Node` 是最小可调度、可验证、可重试和可归因单位。一次逻辑执行是 `NodeExecution`，实际重试使用 `Attempt`。

每次执行必须产生可关联的 `NodeExecutionRecord`，Learning 对象定位到 Node 内的 Component。

## Consequences

- Workflow Router 只调度满足条件的 Node；
- VerificationRequest 默认以 NodeExecution 为 subject；
- ContextSnapshot、Contract、Skill、permissions 和 Evidence 均与 execution 绑定；
- 多 Agent 协作也必须映射到一个或多个明确 Node；
- 过大的 Node 需要拆分，过细拆分则由边界成本和 Contract 决定。

## Rejected Alternatives

- Agent 为最小单位：身份与执行目标混淆；
- tool call 为最小单位：粒度过细，不能表达工程完成条件；
- Workflow 为最小单位：无法精确验证和学习。

## Verification

第一条 vertical slice 必须证明 Node 可独立恢复、retry、verify 和 attribution。
