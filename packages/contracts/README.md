# Machine-readable Contract Baseline

状态：`IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`  
基线 commit：`f4f10855f5bfcce2d56ff4b110f271b4d7cfd116`

## Authority

- Active baseline inventory：[`schema-inventory.json`](schema-inventory.json)
- Planned inventory：[`planned-contracts.json`](planned-contracts.json)
- Inventory schemas：[`schemas/meta/`](schemas/meta/)
- Schema root：`packages/contracts/schemas/`
- First-slice examples：[`examples/first-slice/example-suite.json`](examples/first-slice/example-suite.json)
- Human catalog：[`../../docs/contracts/core-contract-catalog.md`](../../docs/contracts/core-contract-catalog.md)

两份 inventory 合计 73 个 Contract 条目：15 个已经落盘的 `BASELINE_DRAFT` Contract 和 58 个 `PLANNED` Contract。`PLANNED` 条目只冻结 ID、owner、phase、authority path 和 ADR 关系；字段、依赖和兼容性在对应 Operation 中冻结。

当前实际落盘的核心 Contract：

```text
CommonIdentifiers
ActorRef
SchemaRef
SubjectRef
ArtifactRef
TypedError
CommandEnvelope
DomainEventEnvelope
SideEffectTaskEnvelope
SideEffectResultEnvelope
NodeExecutionIdentity
EvidenceMetadata
PolicyDecision
VerificationPlan
GateDecision
```

example suite 必须证明：

- 缺失 `idempotencyKey` 的 Command 无效；
- `HOST_UNRESTRICTED` 不是合法 IsolationLevel；
- FAILED SideEffectResult 缺少 TypedError 无效；
- `INDETERMINATE` PolicyDecision 无 reason code 无效；
- `PASS` GateDecision 缺 Evidence 或仍有 missing Evidence 无效。

Phase 1 必须使用冻结工具链中的 JSON Schema 2020-12 validator 重新执行本 suite 并生成正式 Evidence。Phase 0 的预验证不替代 Phase 1 verification。

任何 Contract 变更在同一 PR 中必须同步 Schema、inventory、examples、producer/consumer、compatibility、generated/runtime type、verification obligations 和相关 ADR/文档。禁止只修改 TypeScript interface、只改 example 或创建第二份 Schema authority。
