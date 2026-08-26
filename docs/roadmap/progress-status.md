# Current Progress Status

状态：`ACTIVE`  
日期：`2026-08-26`

## 1. 总体结论

新 GitHub 仓库已完成第一轮架构基线、独立一致性审查和五项实现级关键 ADR，但尚无生产 Framework 实现。

```text
Phase 0 — Architecture Authority
Overall Status: IN_PROGRESS
Independent Architecture Review Gate: PASSED
Production Implementation: NOT_STARTED
```

Review 决策为 `PASS_WITH_RESIDUAL_WORK`：当前基线可用于 Phase 1 规划，不代表 capability 已实现或 Phase 0 已全部退出。

## 2. 已完成

- 删除旧 migration-centered baseline；
- 明确 Full Rebuild，不整体迁移旧实现；
- 冻结 Node 最小执行/归因单位；
- 冻结确定性 authority 与模型 proposer 分离；
- 冻结 event journal + outbox/inbox + replay 方向；
- 定义 Verification System、Evidence、Oracle 和 Gate；
- 定义 Learning 因果验证链；
- 定义 GitHub -> Local 单向 Release 边界；
- 定义 GBrain/本地 KB Adapter 边界；
- 定义 security/governance baseline；
- 定义 engineering/quality/release standards；
- 定义 capability map、Contract catalog 和 first vertical slice；
- 接受 ADR-0001～ADR-0006；
- 完成 [Phase 0 Independent Architecture Review](../reviews/phase-0-independent-architecture-review.md)；
- 接受五项实现级决策：
  - ADR-0007：Node.js 24.19.0 / TypeScript 6.0.3 / pnpm 11.24.0 / ESM-only；
  - ADR-0008：SQLite 3.53.3 + `node:sqlite` + PersistenceWorker；
  - ADR-0009：loopback HTTP Local Control API + token auth + OpenAPI/SSE；
  - ADR-0010：Windows 四级 isolation 与禁止 silent downgrade；
  - ADR-0011：内置 deterministic Policy evaluator + declarative PolicySet；
- 修复 Policy/Isolation 与 roadmap 的阶段顺序歧义；
- 更新 canonical glossary 与 Contract Catalog。

## 3. Review Findings

| Severity | Open | Closed | Result |
|---|---:|---:|---|
| P0 | 0 | 0 | 无 authority/owner critical conflict |
| P1 | 0 | 6 | 五项 ADR + Phase ordering 已关闭 |
| P2/P3 | 0 blockers | tracked as residual work | 不阻塞 Phase 1 planning |

审查未发现目标架构重新引入：terminal transition 双属主、旧/新路径伪版本化、cache authority、模型/Adapter 直接提交终态或 VerificationExecutor 自行标记 verified。

## 4. 当前文档成熟度

| Area | Status | Next gate |
|---|---|---|
| Charter / Invariants | `BASELINE` | M0 final Gate |
| Target Architecture | `BASELINE` | implementation conformance |
| Durable Execution | `BASELINE` | executable Command/Event schema |
| Context/Contract | `BASELINE` | machine-readable schemas/examples |
| Policy | `ADR ACCEPTED` | compiler/evaluator conformance |
| Verification/Evidence | `BASELINE` | executable plan/gate schema |
| Learning | `BASELINE` | V1 application scope before Phase 7 |
| Local Integrations | `BASELINE` | GBrain protocol survey |
| Security | `BASELINE` | sandbox/API/threat scenario implementation |
| Toolchain | `ADR ACCEPTED` | clean-build spike |
| Persistence | `ADR ACCEPTED WITH QUALIFICATION` | `node:sqlite` crash/package spike |
| Local Control API | `ADR ACCEPTED` | exposure/auth/contract spike |
| Windows Isolation | `ADR ACCEPTED` | PROCESS_RESTRICTED Phase 1 implementation |
| ADR-0001～0011 | `ACCEPTED` | implementation conformance |

## 5. Implementation Status

所有 GitHub runtime capability：`NOT_STARTED`。

当前仓库不能构建、安装或本地运行 Framework。任何相反表述都不准确。

本次新增的是权威设计与 Gate，不是代码实现。`node:sqlite`、AppContainer、Control API 和 Policy evaluator 均尚未通过运行验证。

## 6. Phase 0 Remaining Work

按优先级：

1. machine-readable Schema inventory 与首批 JSON Schema；
2. first vertical slice 的 executable Command/Event/Policy/Verification examples；
3. Phase 1 `WRITE_SCOPE`、VerificationPlan、风险分类与结构化回执；
4. GBrain connector facts/protocol survey（不阻塞 Kernel foundation）；
5. M0 final Gate 与用户批准进入代码建设。

进入 production-grade Release 前另需关闭：

- Event/Artifact cryptographic integrity depth；
- local Human Approval identity；
- Evidence encryption/key management；
- provider data-retention verification；
- third-party Adapter loading policy。

这些不得被临时代码静默决定。

## 7. Phase 1 Qualification Obligations

ADR 已选定唯一方向，但以下必须在明确 WRITE_SCOPE 内验证：

- exact toolchain clean build 与 Windows self-contained runtime；
- `node:sqlite` transaction/crash/WAL/backup/migration/package behavior；
- Control API loopback exposure、token ACL、idempotency、stale discovery；
- Windows Job Object process-tree/resource containment；
- PolicySet parse/canonicalize/evaluate/replay/fail-closed；
- architecture dependency/no-duplicate-owner tests。

任何 qualification 失败都形成 Evidence 与 remediation/superseding ADR；不允许自动 fallback 到平行实现。

## 8. 当前阻塞

没有阻塞继续完成 Phase 0 文档与 Phase 1 规划的外部依赖。

本地事实仍待调查：

- GBrain 当前 API/protocol；
- 本地模型/provider 列表与能力；
- Windows edition/AppContainer/Windows Sandbox 实际可用性；
- Workspace/路径/进程限制；
- 旧 Framework 必须保留的少量外部行为兼容项。

这些通过结构化事实摘要输入，不上传私有知识库、源码或 Evidence。

## 9. 下一里程碑

`M0 — Architecture Baseline Verified`

剩余退出条件：

- 首批 machine-readable Contract 覆盖第一 slice；
- executable examples 与 ADR 一致；
- Phase 1 operation plan 可由独立 Agent直接执行；
- WRITE_SCOPE、VerificationPlan、回执和停止条件明确；
- 用户批准进入代码建设。

独立架构审查与五项关键技术 ADR 已不再是 M0 阻塞项。
