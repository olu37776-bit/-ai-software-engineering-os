# Verification 与质量门禁标准

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 目的

质量门禁必须回答“目标语义和风险是否被可靠验证”，而不仅是“命令是否退出 0”。

## 2. 变更风险分类

### R0 — Documentation only

不改变 Contract、代码和运行语义。需要链接、术语和一致性检查。

### R1 — Localized implementation

不改变 public/persisted Contract，影响单一 package。需要 unit、package integration 和 architecture check。

### R2 — Cross-boundary behavior

影响多个 package、Adapter 或 public Contract。需要 contract、integration、failure、migration/compatibility 验证。

### R3 — Runtime authority

影响 state transition、routing、idempotency、retry、Policy、Verification Gate 或 persistence。需要 property/model/replay、concurrency、fault injection、mutation 和独立审查。

### R4 — Security/release/destructive

影响权限、Secrets、sandbox、approval、供应链、升级或不可逆副作用。除 R3 外，还需要 threat-model verification、human security review、release/rollback drill。

风险由影响决定，不能由作者自行降级以减少验证。

## 3. 基础 PR Gate

所有代码 PR：

- clean install with lockfile；
- format/lint/typecheck；
- dependency/architecture checks；
- unit tests；
- changed Contract/schema validation；
- no secret leak；
- build/package smoke；
- changed-file scope check；
- test/Evidence summary。

## 4. Core Authority Gate

涉及 Kernel、Workflow、Node、Router、Policy、Gate：

- transition table/Contract 更新；
- positive/negative/boundary tests；
- terminal transition uniqueness；
- duplicate Command/idempotency；
- concurrent Command conflict；
- replay from journal；
- version compatibility；
- mutation score on critical decisions；
- independent verification；
- no duplicate semantic owner architecture test。

## 5. Persistence Gate

- migration from every supported schema version；
- failed migration leaves recoverable state；
- backup/restore drill；
- crash before/after event/outbox commit；
- duplicate inbox/outbox；
- integrity corruption detection；
- projection rebuild equivalence；
- large-history replay benchmark。

## 6. Adapter Gate

- capability manifest correctness；
- contract conformance；
- health/preflight；
- timeout/cancellation；
- retry classification；
- permission denial；
- malformed/partial provider result；
- Evidence completeness；
- version reporting；
- no Core semantic ownership。

## 7. Verification System Gate

Verification System 自身必须被验证：

- planner minimum policy 不可绕过；
- executor unavailable 不能伪装 pass；
- Oracle 能识别 exit-0-but-wrong；
- missing Evidence 导致正确 `INCONCLUSIVE/BLOCK`；
- GateDecision 对相同输入确定；
- implementation Agent 无法自行提交 `VERIFIED`；
- risk acceptance 记录剩余风险；
- historical Evidence freshness 规则；
- model-based Oracle 的不确定性与交叉验证。

## 8. Security Gate

- permission property tests；
- prompt injection fixtures；
- secret redaction/exfiltration tests；
- path traversal/command injection fuzzing；
- approval scope/expiry/replay；
- sandbox minimum level；
- local API exposure/authentication；
- tampered artifact/release detection；
- SBOM/provenance/checksum verification。

## 9. Coverage

Coverage 用于发现未执行区域，但不是唯一目标。

要求：

- 关键 reducer/policy/oracle 接近完整 branch coverage；
- 新代码不能仅通过聚合覆盖率掩盖目标方法未执行；
- coverage merge/baseline 必须可解释；
- coverage 提升必须对应真实行为测试；
- mutation、property 和 fault tests 优先补充关键语义；
- coverage gate 不得鼓励测试私有实现细节或过度 mock。

具体百分比由 package risk profile 决定，并在实施阶段冻结。

## 10. Evidence 回执

验证回执必须结构化包含：

```text
subject commit/artifact
risk class
plan/version
executed steps
results
evidence refs
skipped/unavailable/inconclusive
known gaps
gate decision
verifier identity
```

只有 GateDecision 满足发布策略时，状态才能从 `IMPLEMENTED` 进入 `VERIFIED`。

## 11. Release Gate

- 所有 required PR Gate；
- clean source checkout build；
- version/manifest consistency；
- cross-platform package smoke；
- fresh local-data install；
- supported-version upgrade；
- rollback；
- checksum/signature/provenance；
- SBOM；
- release notes 与 breaking changes；
- no unresolved R3/R4 inconclusive evidence；
- installer does not overwrite local data。
