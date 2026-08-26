# Phase 0 Schema / Phase 1 Governance Remediation Review

状态：`IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`  
日期：`2026-08-26`  
源基线：`e287b7f8cdf6ab7d2df6a5a171a395cc2b60bf45`  
分支：`remediation/m0-preimplementation-governance`

## 1. 范围

本次 remediation 只处理 M0 实现前治理资产，不实现任何 Framework runtime capability，也不修改 ADR-0001～ADR-0011。

## 2. 已处理阻塞

- Contract hash 由权威文件精确 UTF-8/LF bytes 计算，并由 VerificationPlan 引用；
- WRITE_SCOPE 的 path glob 与 semantic constraint 分离；
- 全局 Scope 明确覆盖 `tests/fault-injection/**` 与 `tests/security/**`；
- Receipt 无法用未完成 Operation、未运行验证或空 Evidence 伪造 `IMPLEMENTED`；
- Implementation Receipt 与 Independent Verification Receipt 分离；
- 首条 slice 的 payload Schema、Schema hash、payload hash 与 Artifact raw-byte hash 可执行；
- 增加完整 Schema Registry、Example Suite Schema 与 expected-failure 断言；
- Architecture baseline、planning source 与最终 execution baseline 的职责分离；
- Authority Lock 对治理资产使用不可变或 operation-scoped mutation policy。

## 3. 状态边界

```text
Remediation implementation: IMPLEMENTED
Independent preimplementation verification: PENDING
M0 final Gate: NOT_YET_GRANTED
Phase 1: NOT_STARTED
Runtime capability: NOT_IMPLEMENTED
```

实现者不得把本文件改为 `VERIFIED`。独立验证必须在不可变 commit 上只读执行，且同一遍验证不得 remediation。
