# Phase 1 Operation Plan — Executable Repository Foundation

状态：`M0 CANDIDATE v0.2`  
Operation ID：`P1-EXECUTABLE-REPOSITORY-FOUNDATION`  
风险等级：`R4`  
源基线 commit：`88b237a422c5e0fef0d8d8a16e1291c6fa692599`  
机器权威：[`operations/phase-1/operation.json`](../../operations/phase-1/operation.json)  
Authority Lock：[`operations/phase-1/authority-lock.json`](../../operations/phase-1/authority-lock.json)  
启动授权：[`M0 — Architecture Baseline Verified`](../reviews/m0-architecture-baseline-verified.md)

## 1. 目的与边界

Phase 1 建设能够承载后续权威运行时的 **可构建、可验证、可发布、可审计工程地基**，并关闭 ADR-0007～ADR-0011 的运行资格风险。它不提前实现完整 Workflow、Node、Verification、EvidenceGraph 或 Learning runtime。

预期链：

```text
M0-authorized immutable commit
-> authority lock preflight
-> exact toolchain
-> runtime Schema validation
-> architecture enforcement
-> Policy / persistence / API / PROCESS_RESTRICTED qualification
-> self-contained Windows qualification artifact
-> structured implementation receipt
-> independent Phase 1 Gate
```

## 2. 不可变输入

实施前必须验证 M0 Gate 和 Authority Lock。以下内容在 Implementation Operation 中只读：

- Architecture、Threat Model、ADR-0001～ADR-0011；
- Phase 0 与 M0 Review；
- 本 Operation Plan、WRITE_SCOPE、VerificationPlan、Receipt Schema；
- operation/write-scope/authority-lock/preimplementation-policy 的 machine-readable authority。

实施者不能通过 `operations/phase-1/**` 通配写权限修改自己的 Scope 或 Gate。需要变更时必须停止，由独立 architecture-authority change 更新全部相关 authority、重新验证并重新授权。

## 3. 执行图

```text
P1-O01 Toolchain
   └─ P1-O02 Contracts
       └─ P1-O03 Architecture Enforcement
           ├─ P1-O04 Policy Qualification
           ├─ P1-O05 Persistence Qualification
           └─ P1-O06 Control API Qualification
P1-O01/O02/O03/O04
   └─ P1-O07 PROCESS_RESTRICTED
P1-O05/O06/O07
   └─ P1-O08 Packaging
       └─ P1-O09 Integrated Handoff
```

所有子 Operation 使用短生命周期分支/PR。依赖满足后 O04/O05/O06 可并行；集成前必须重新验证 authority lock、baseline 和 scope。

## 4. 子 Operation

### P1-O01 — Toolchain

冻结 Node.js `24.19.0`、TypeScript `6.0.3`、pnpm `11.24.0`，建立 ESM-only、NodeNext、ES2025、`tsc -b`、frozen lockfile 与 Windows/Linux clean build。

Gate：`P1-V00`、`P1-V01`、`P1-V02`。

### P1-O02 — Contract System

实现 Schema registry/runtime validator，验证 inventory、`$id/$ref`、真实 Schema/payload/artifact hash、valid/invalid examples、compatibility 与 generated type consistency。TypeScript type 不替代 boundary validation。

Gate：`P1-V03`。

### P1-O03 — Architecture Enforcement

机器化 package DAG、public entry、deep-import/cycle/dependency inversion 和 duplicate semantic-owner denial。禁止通过读取旧文件文本判断架构。

Gate：`P1-V04`。

### P1-O04 — Policy Qualification

实现受限 authoring parser、semantic validation、canonical JSON/hash 与唯一内置 evaluator skeleton；验证 default deny、deny-overrides、requirements conflict、`INDETERMINATE` fail closed、replay/property/mutation。

Gate：`P1-V05`。

### P1-O05 — Persistence Qualification

仅使用 Node.js `24.19.0` 内置 `node:sqlite` 和专用 PersistenceWorker；验证 transaction、Event/receipt/outbox/inbox/audit 原子性、WAL/FULL、crash、dedup、conflict、backup/restore、migration、corruption quarantine、projection rebuild 与 event-loop responsiveness。

失败即停止并形成 superseding ADR finding；不得 fallback。

Gate：`P1-V06`。

### P1-O06 — Control API Qualification

建立 OpenAPI 3.1.1、`127.0.0.1` ephemeral bind、instance discovery/lock、256-bit token/user-only ACL、idempotency/version conflict、SSE recovery 与只走 public API 的 CLI。仅建设 lifecycle/qualification，不实现完整 Workflow API。

Gate：`P1-V07`。

### P1-O07 — Windows PROCESS_RESTRICTED

实现 Job Object process-tree lifecycle、kill-on-close、timeout/cancel、资源上限、环境清理、typed argv、staged cwd、path/reparse-point 检查、capability probe 与 no-downgrade property。

`PROCESS_RESTRICTED` 不是 security sandbox；Phase 1 不实现 `OS_SANDBOXED`。

Gate：`P1-V08`。

### P1-O08 — Qualification Packaging

构建 Windows-first self-contained qualification artifact，校验 pinned runtime、ReleaseManifest、checksum、SBOM、provenance、干净 Windows 启动、中文/空格路径及 Release/data-root 分离。不得声称 production-ready。

Gate：`P1-V09`。

### P1-O09 — Integrated Handoff

在 immutable commit 上生成符合 Receipt Schema 的实现回执、Evidence index、known gaps 和独立验证输入包。该 Operation 不能修改生产代码或任何锁定 authority。

Gate：`P1-V10`。

## 5. Definition of Done

实现方只有在以下全部成立时才能声明 `IMPLEMENTED`：

1. P1-O01～P1-O09 全部为 `IMPLEMENTED`；
2. P1-V00～P1-V10 全部 `PASS` 且有 Evidence；
3. Authority Lock 和 WRITE_SCOPE 合规，无 immutable path 变更；
4. exact toolchain clean build 通过；
5. Schema/inventory/ref/hash/example/generated type 一致；
6. architecture negative fixtures 可被主动拒绝；
7. ADR-0007～ADR-0011 每项 qualification obligation 全部 `PASS`；
8. 无 fallback、silent downgrade、catch-and-continue 或第二 authority；
9. Windows qualification artifact 在干净环境启动；
10. Receipt Schema 验证通过，文档同步；
11. 剩余风险显式；
12. 实现者没有声明 `VERIFIED`。

`BLOCKED`、`UNAVAILABLE`、`INCONCLUSIVE`、`NOT_RUN` 不是完成状态。

## 6. 强制停止条件

出现任一条件立即停止对应 Operation：

- M0 Gate、Authority Lock 或实施 baseline 无法匹配；
- ADR 指定实现无法满足 Verification；
- 需要修改 Scope 外或 immutable authority 路径；
- 需要平行 driver/transport/evaluator 或 isolation downgrade；
- 必需 R4 步骤不是 PASS；
- owner 冲突或 public/persisted Schema 无法兼容；
- 需要上传 Secrets、知识、源码、Workspace 或本地 Evidence；
- baseline 在验证期间变化；
- 把 Job Object 错误表述为安全沙箱。

停止回执必须保留失败事实、Evidence、影响和 remediation/ADR 建议。

## 7. 状态职责

- Implementation Agent：实施、测试、Evidence、同步文档，只能声明 `IMPLEMENTED/PARTIAL/BLOCKED`；
- Independent Verification Agent：不在同一 pass 修复，在 immutable commit 上决定是否推荐 `VERIFIED`；
- Architecture Authority：处理 ADR/Contract/WRITE_SCOPE 冲突；
- M0 Gate：授权 Phase 1 的唯一启动 commit；
- 用户：批准关键 Gate 和范围变更。

本文落盘本身不代表 Phase 1 已开始；只有 M0 Gate PASS 后，Phase 1 才进入 `ACTIVE`。
