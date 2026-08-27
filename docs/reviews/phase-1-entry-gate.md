# Phase 1 Entry Gate

状态：`VERIFIED`  
GateDecision：`PASS`  
日期：`2026-08-27`

## 1. Decision

`M0 — Architecture Baseline Verified` 已为 `PASS`。其唯一剩余的外部 Phase 1 前置条件——GitHub repository protection——已独立核验满足正式硬约束。

因此：

```text
Phase 0 — Architecture Authority: VERIFIED / COMPLETE
M0 — Architecture Baseline Verified: PASS
PHASE1-REPOSITORY-PROTECTION: PASS
Phase 1 Entry Gate: PASS
Phase 1: READY_TO_START_AFTER_GATE_MERGE
First authorized operation: P1-O01
```

本 Gate 只有在通过受保护 `main` 的 PR 合并后生效。P1-O01 必须从包含本 Gate 的受保护 `main` commit 创建短生命周期实施分支。

## 2. Repository Protection Evidence

GitHub Ruleset：

```text
id: 21648824
name: phase-1-main-protection
target: branch
enforcement: active
include: ~DEFAULT_BRANCH
bypass actors: none
current user can bypass: never
```

已核验规则：

- branch deletion restricted；
- non-fast-forward / force push blocked；
- pull request required；
- required approvals = 0；
- status check `verify` required；
- required check provider = GitHub Actions (`integration_id = 15368`)；
- strict required-status-check policy enabled；
- status checks are enforced on creation；
- `main` reports `protected: true`。

`required_review_thread_resolution` 当前为 `false`。它是推荐的额外 hardening，但不在 M0 machine-readable `requiredState` 或 Phase 1 hard exit criteria 中，因此不阻塞本 Gate。后续可单独启用，不得借此修改 Phase 1 semantic authority。

## 3. Closed External Blocker

Issue `#4 — Gate: enable and verify main protection before Phase 1 entry` 已在核验上述 GitHub 事实后以 `completed` 关闭。

因此 M0 Gate 中：

```text
Phase 1 entry: BLOCKED_PENDING_REPOSITORY_PROTECTION
```

对应阻塞条件已被解除。

## 4. Authorization Scope

本 Gate只授权进入 Phase 1 的第一个 Operation：

```text
P1-O01 — Toolchain and reproducible monorepo foundation
Risk class: R3
```

P1-O01 必须严格使用：

- `operations/phase-1/operation.json`；
- `operations/phase-1/write-scope.json`；
- `operations/phase-1/verification-plan.json`；
- `operations/phase-1/authority-lock.json`；
- ADR-0007 及其直接依赖的 accepted architecture decisions。

这些 authority 文件本身保持冻结。Phase 1 运行状态不得通过修改 `operation.json` 的冻结内容表达，而应使用单独 execution record / receipt。

## 5. P1-O01 Boundary

P1-O01 只允许建立：

- exact toolchain manifest；
- workspace / monorepo root；
- frozen lockfile；
- strict TypeScript / ESM / project-reference build；
- lint / format / unit-test infrastructure；
- clean Windows + Linux build qualification；
- GitHub quality workflow；
- P1-O01 Evidence 与 structured execution record。

本 Gate **不授权**：

- production Workflow / Node Runtime；
- Router / Scheduler / terminal transition；
- production Verification System；
- EvidenceGraph / Learning runtime；
- real Model Provider；
- GBrain / KnowledgeProvider；
- production persistence semantics；
- Control API、Windows isolation 或 Policy evaluator 的后续 Operation 实现。

## 6. Role Separation

- Implementation Agent：最多声明 `IMPLEMENTED`；
- Independent Verifier：对不可变 commit 执行验证；
- GitHub Ruleset：负责 PR / required-check / non-force-push enforcement；
- Phase 1 Gate：只有满足对应 VerificationPlan 与 Evidence 后才能继续下一 Operation。

## 7. Next Step

本 Gate 通过受保护主线合并后：

1. 从该 `main` commit 创建 `phase-1/p1-o01-toolchain-foundation`；
2. 创建独立 `P1-O01` execution record，状态 `IN_PROGRESS`；
3. 实施 P1-O01 的 exact WRITE_SCOPE；
4. 产生 Windows/Linux clean-build Evidence；
5. PR 必须通过 required `verify` 和 P1-O01 qualification；
6. 实现 Agent 只提交 `IMPLEMENTED` receipt；
7. 再做独立验证。

Machine-readable Gate：`operations/phase-1/phase-1-entry-gate.json`。
