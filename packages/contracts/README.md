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

两份 inventory 合计 73 个 Contract 条目：33 个已经落盘的 `BASELINE_DRAFT` Contract 和 40 个 `PLANNED` Contract。`PLANNED` 条目只冻结 ID、owner、phase、authority path 和 ADR 关系；字段、依赖和兼容性在对应 Operation 中冻结。

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

P1-O02 已把本目录接入 pnpm workspace、root `tsc -b` authority build 和 Vitest quality path。`src/` 提供基于 canonical registry 的 Ajv Draft 2020-12 validator；未知 schema、unsupported version、identity/version mismatch 和 public/persisted boundary 的 unknown field 全部 fail closed。编译 cache 仅优化执行，不改变 registry/JSON Schema authority。

确定性验证入口：

```bash
pnpm run contracts:qualify
```

该入口执行 schema meta-validation、registry/inventory/hash/reference integrity、first-slice examples、Schema ↔ TypeScript semantic consistency、compatibility 和 runtime fail-closed probes，产生 P1-V03 所需四类结构化结果。TypeScript declarations 由 canonical schemas 生成并在 quality 中检查漂移，但不替代 runtime validation。

任何 Contract 变更在同一 PR 中必须同步 Schema、inventory、examples、producer/consumer、compatibility、generated/runtime type、verification obligations 和相关 ADR/文档。禁止只修改 TypeScript interface、只改 example 或创建第二份 Schema authority。

## Phase 1 Policy authority

P1-O04 activates five Draft 2020-12 authorities under `schemas/policy`:
`CapabilityManifest`, `PolicyEvaluationInput`, `PolicyRule`, `PolicySet`, and
`PolicySnapshot`. `PolicyDecision` remains the existing canonical output
Contract. Restricted YAML is authoring input only; canonical persisted authority
is schema-valid PolicySet JSON and its deterministic PolicySnapshot hash.

## Phase 1 Persistence authority

P1-O05 activates seven Draft 2020-12 persistence authorities: `CommandDedupRecord`,
`InboxRecord`, `JournalAppendBatch`, `OutboxRecord`, `PersistenceCommitReceipt`,
`ProjectionCheckpoint`, and `StateSchemaManifest`. `LeaseRecord` remains planned
for Phase 2. SQL rows, table names, and `node:sqlite` driver types are deliberately
excluded from the public Contract boundary.

## Phase 1 Local Control API authority

P1-O06 activates six Draft 2020-12 authorities: `ControlApiProblem`,
`ControlEndpointDescriptor`, `ControlEventNotification`, `ControlOperationRef`,
`DiagnosticFinding`, and `RuntimeHealth`. The OpenAPI 3.1.1 baseline is
[`schemas/control-api/control-api.openapi.json`](schemas/control-api/control-api.openapi.json) and
references those canonical schemas instead of duplicating payload shapes. The descriptor fixes the
transport host to `127.0.0.1`, carries only a relative token-file reference, and never contains bearer
token material. Operation status is a projection string and does not introduce canonical terminal
transition semantics.
