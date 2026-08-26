# ADR-0006：模型是提议者，不是权威状态所有者

状态：`ACCEPTED`  
日期：`2026-08-26`

## Context

LLM 输出非确定、可能 hallucinate、受 Context/prompt injection 影响，也无法自行证明操作结果。让模型直接标记完成、写状态或批准自身输出，会形成不可审计闭环。

## Decision

模型输出只允许成为 versioned/schema-validated Proposal、Claim 或 Candidate。权威状态变化必须经过：

```text
model output
-> schema validation
-> Contract/Policy/permission checks
-> optional verification/approval
-> Command
-> deterministic transition
-> committed Event
```

模型不能直接提交 Node terminal state、GateDecision、ApprovalDecision 或 ValidatedRootCause。

## Consequences

- 需要明确 proposal schema；
- Router、Oracle 和 Learning evaluator 可使用模型建议，但必须有确定性最低规则；
- 模型调用全部记录 provenance；
- Framework 可以更换 provider 而不改变核心状态语义；
- 某些任务增加一步验证，但显著降低幻觉成为事实的风险。

## Rejected Alternatives

- 模型返回完整 Runtime state；
- 模型自评通过后直接完成；
- 仅依赖 prompt 要求“不要犯错”；
- 把 provider-specific agent loop 作为 Framework authority。

## Verification

测试必须证明伪造的模型 `completed=true`、`verified=true` 或审批文本无法绕过 canonical Command/Gate。
