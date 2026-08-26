# Phase 1 Operation Plan — Executable Repository Foundation

状态：`BASELINE DRAFT v0.1`  
Operation ID：`P1-EXECUTABLE-REPOSITORY-FOUNDATION`  
风险等级：`R4`  
基线 commit：`f4f10855f5bfcce2d56ff4b110f271b4d7cfd116`  
机器可读清单：[`operations/phase-1/operation.json`](../../operations/phase-1/operation.json)

## 1. 目的

Phase 1 的任务不是提前实现完整 Framework，而是建立一个能够承载后续权威运行时的 **可构建、可验证、可发布、可审计的工程地基**。

Phase 1 必须关闭五项已接受技术决策的运行资格风险：

- ADR-0007：精确 TypeScript/Node.js/pnpm 工具链与可复现构建；
- ADR-0008：`node:sqlite` + `PersistenceWorker` 的事务、崩溃、恢复与打包资格；
- ADR-0009：loopback Control API、token、幂等、discovery 与 CLI 公共入口；
- ADR-0010：Windows `PROCESS_RESTRICTED` 的 Job Object 生命周期、能力证明与禁止降级；
- ADR-0011：声明式 PolicySet、canonicalization、确定性 evaluator 与 fail closed。

完成 Phase 1 后，仓库应能够证明：

```text
clean checkout
-> exact toolchain
-> schema/contract validation
-> architecture enforcement
-> qualification components
-> self-contained Windows qualification artifact
-> structured Evidence/receipt
```

它仍不包含完整 Workflow/Node/Verification/Learning 生产能力。

## 2. 权威输入

执行者必须先读取：

- `docs/architecture/01-framework-charter.md`
- `docs/architecture/02-target-architecture.md`
- `docs/architecture/03-durable-execution-model.md`
- `docs/architecture/08-security-and-governance.md`
- `docs/architecture/11-nonfunctional-requirements.md`
- `docs/contracts/core-contract-catalog.md`
- `packages/contracts/schema-inventory.json`
- `docs/engineering/repository-blueprint.md`
- `docs/engineering/engineering-standard.md`
- `docs/engineering/quality-gates.md`
- `docs/reviews/phase-0-independent-architecture-review.md`
- ADR-0007～ADR-0011
- `operations/phase-1/write-scope.json`
- `operations/phase-1/verification-plan.json`

发生冲突时，执行 Agent 不得自行选择一个方便实现的解释。应停止并形成 finding，由 ADR/Contract authority 处理。

## 3. 总体执行策略

Phase 1 拆成九个可独立审查的 Operation。每个 Operation 使用短生命周期分支/PR，完成自己的代码、测试、Evidence 和必要文档同步；不得把所有工作压进一个不可审查的大提交。

```text
P1-O01 Toolchain
   ├─> P1-O02 Contracts
   │      └─> P1-O03 Architecture Enforcement
   │               ├─> P1-O04 Policy Qualification
   │               ├─> P1-O05 Persistence Qualification
   │               └─> P1-O06 Control API Qualification
   │
   └─────────────────────> P1-O07 PROCESS_RESTRICTED
                                  |
P1-O04/O05/O06/O07 --------------> P1-O08 Packaging
                                          |
                                          v
                                    P1-O09 Handoff
```

允许在依赖满足后并行执行 P1-O04、P1-O05、P1-O06；P1-O07 还依赖 Policy minimum-isolation contract。所有并行分支必须从同一已批准基线派生并在集成前重新验证。

## 4. Operation 分解

### P1-O01 — Toolchain and reproducible monorepo foundation

风险：`R3`

目标：

- 固定 Node.js `24.19.0`、TypeScript `6.0.3`、pnpm `11.24.0`；
- 建立 ESM-only、NodeNext、ES2025、`tsc -b` 和 project references；
- 建立 frozen lockfile、toolchain manifest、lint/format/test 基础；
- 证明 Windows/Linux clean checkout 构建可复现。

禁止借此批量建立所有未来 package。只创建有当前消费者与验证资产的 package。

退出 Gate：`P1-V02-TOOLCHAIN`。

### P1-O02 — Machine-readable Contract system foundation

风险：`R3`

目标：

- 将 Phase 0 Schema baseline 接入真实 registry/validator；
- 验证 `schema-inventory.json`、所有 `$id/$ref`、valid/invalid examples；
- 建立 Schema ↔ generated type 一致性机制；
- 建立 compatibility fixture 和 unsupported-version fail-closed；
- 任何新增 Schema 在同一 PR 更新 inventory、examples、producer/consumer 与验证义务。

TypeScript type 只能提高开发体验，不能替代边界 runtime validation。

退出 Gate：`P1-V03-CONTRACTS`。

### P1-O03 — Architecture dependency and semantic-owner enforcement

风险：`R3`

目标：

- 机器化 package DAG、公开入口与 dependency allowlist；
- 阻止 deep import、循环、Domain -> Adapter、CLI -> Kernel/DB；
- 为核心语义建立 machine-readable owner declaration；
- 阻止多个 package 声明同一个 authority owner；
- 架构测试使用依赖元数据和公共 Contract，不读取某个旧文件文本判断实现形态。

退出 Gate：`P1-V04-ARCHITECTURE`。

### P1-O04 — Deterministic Policy qualification

风险：`R4`

目标：

- 实现 PolicySet/Rule/Input/Snapshot 的 Phase 1 Schema；
- 受限 YAML 仅作为 authoring input；
- 实现 semantic validation、RFC 8785 canonical JSON、SHA-256 snapshot；
- 建立唯一 V1 evaluator skeleton；
- 验证 default deny、deny-overrides、requirements merge/conflict、`INDETERMINATE` fail closed；
- 通过 replay、property 和 mutation qualification。

不得引入 OPA/Cedar/CEL/动态 JS 等第二 authority。

退出 Gate：`P1-V05-POLICY`。

### P1-O05 — SQLite / `node:sqlite` qualification

风险：`R4`

目标：

- 使用唯一指定的 Node.js `24.19.0` 内置 `node:sqlite`；
- 建立专用 `PersistenceWorker`、有界队列和明确 shutdown；
- 在一个 transaction 内验证 Event、Command receipt、outbox/inbox 和必要 audit；
- 验证 WAL/FULL、defensive、authorizer、limits、STRICT table；
- 执行 crash-before/after-commit、worker terminate、locked/disk-full、dedup、optimistic conflict；
- 验证 backup/restore、migration failure、corruption quarantine、projection rebuild；
- 验证主 event loop responsiveness 和 NFR 基准。

qualification 失败时必须停止并提交 superseding ADR finding。不得自动切换 `better-sqlite3` 或其他 driver。

退出 Gate：`P1-V06-PERSISTENCE`。

### P1-O06 — Local Control API and Runtime lifecycle qualification

风险：`R4`

目标：

- 建立 OpenAPI 3.1.1 + JSON Schema 2020-12 authority；
- 只绑定 `127.0.0.1` 的 ephemeral port；
- 建立 endpoint descriptor、instance lock、stale detection；
- 建立至少 256-bit token、user-only ACL、轮换和脱敏；
- mutation 使用 `Idempotency-Key` 与 expected-version conflict；
- CLI 只使用公共 API client；
- 提供最小 `version/doctor/start/stop/status`；
- 验证 CORS/Origin/Host/CSRF、SSE gap/reconnect 和 disconnect 不改变业务状态。

本 Operation 只建立 lifecycle/qualification，不实现完整 durable Workflow API。

退出 Gate：`P1-V07-CONTROL-API`。

### P1-O07 — Windows `PROCESS_RESTRICTED` qualification

风险：`R4`

目标：

- 建立 Windows Job Object child-process-tree 管理；
- kill-on-close、timeout、cancel、Runtime shutdown 可终止 child/grandchild；
- CPU、memory、process count、wall-clock、stdout/stderr/output 有界；
- environment 清理、secret/token 不继承；
- executable + typed argv，默认禁止 `shell: true`；
- staged cwd、path canonicalization、junction/reparse point 检查；
- capability probe 和 IsolationEvidence；
- property test 证明 required isolation 不会向下回退。

必须明确记录：`PROCESS_RESTRICTED` 不是 security sandbox。Phase 1 不实现 `OS_SANDBOXED`。

退出 Gate：`P1-V08-ISOLATION`。

### P1-O08 — Qualification Release and supply-chain baseline

风险：`R4`

目标：

- 构建 Windows-first self-contained qualification artifact；
- 随制品携带并校验冻结的 Node runtime；
- 建立 ReleaseManifest、checksums、SBOM、build provenance/attestation；
- 验证干净 Windows 无 Node/pnpm/Python/compiler 也能启动；
- 验证中文、空格路径；
- Release root 与 test data root 分离；
- GitHub Action、bootstrap/download reference 精确 pin；
- 明确标注该制品为 qualification artifact，而非 production Release。

退出 Gate：`P1-V09-PACKAGING`。

### P1-O09 — Integrated verification handoff

风险：`R4`

目标：

- 从 clean checkout 对不可变 commit 执行完整 VerificationPlan；
- 生成符合 `operations/phase-1/receipt.schema.json` 的实现回执；
- 汇总 ADR qualification obligation matrix；
- 汇总 Evidence index、skipped/unavailable/inconclusive 和已知缺口；
- 形成独立 Verification Agent 可直接执行的输入包；
- 实现 Agent 只声明 `IMPLEMENTED`、`PARTIAL` 或 `BLOCKED`。

退出 Gate：`P1-V10-INTEGRATED-GATE`。

## 5. 交付物

Phase 1 最少交付：

```text
root toolchain/workspace/build configuration
toolchain/toolchain.json
pnpm-lock.yaml
packages/contracts + schema registry/validator
Phase 1 required package public entries
architecture rule configuration/tests
Policy qualification assets
Persistence qualification assets
Control API/lifecycle qualification assets
PROCESS_RESTRICTED qualification assets
Windows qualification release assets
GitHub quality/release workflows
tests/contract
tests/architecture
tests/qualification
tests/acceptance
operations/phase-1/implementation-receipt.json
```

构建产生的二进制、报告和 Evidence artifact 不提交进 source tree；正式 receipt 只保存可追溯引用、hash 和摘要。

## 6. Definition of Done

Phase 1 只能在以下全部成立时由实现方声明 `IMPLEMENTED`：

1. P1-O01～P1-O09 均完成；
2. WRITE_SCOPE 无违规；
3. exact toolchain clean build 通过；
4. Schema inventory、Schema、example suite 和生成类型一致；
5. architecture tests 能主动拒绝预置负面 fixture；
6. Policy、Persistence、Control API、Isolation 的 qualification obligation 全部有结果；
7. 没有 fallback、silent downgrade、catch-and-continue 或第二 authority；
8. Windows qualification artifact 在干净环境启动；
9. 结构化 receipt 验证通过；
10. 文档、Contract、代码和测试同步；
11. 所有剩余风险显式；
12. 实现者未声明 `VERIFIED`。

## 7. 强制停止条件

出现以下任一情况立即停止对应 Operation，不以“先完成再汇报”继续：

- ADR 指定实现无法满足其 Verification；
- 需要修改 WRITE_SCOPE 外路径或语义；
- `node:sqlite`、Control API、Job Object 或 Policy evaluator 需要平行 fallback；
- 必需 R4 步骤只能 `SKIPPED/UNAVAILABLE/INCONCLUSIVE`；
- 发现 Contract owner 冲突或 persisted/public Schema 无法兼容；
- 需要上传本地 Secrets、知识库、源码或 Evidence；
- 基线发生未审查变化；
- 发现安全边界被错误表述，例如把 Job Object 声称为 security sandbox。

停止回执必须包含：触发条件、已完成事实、Evidence、影响、推荐 remediation 或 superseding ADR，不得修改失败事实为 PASS。

## 8. 状态与职责

- 实现 Agent：实施、测试、生成 Evidence、同步文档，可声明 `IMPLEMENTED/PARTIAL/BLOCKED`；
- 独立 Verification Agent：在不可变 commit 上按 VerificationPlan 验证，才可提出 `VERIFIED` Gate；
- 架构 authority：处理 ADR/Contract/WRITE_SCOPE 冲突；
- 用户：批准进入 Phase 1 和最终 Gate。

本文件落盘不等于 Phase 1 已开始，也不等于任何 qualification 已通过。
