# Current Progress Status

状态：`ACTIVE`  
日期：`2026-08-26`

## 1. 总体结论

新 GitHub 仓库已完成第一轮目标架构文档建设，但尚无生产 Framework 实现。项目处于：

```text
Phase 0 — Architecture Authority
Status: IN_PROGRESS
```

“文档已经存在”不等于架构已 `VERIFIED`。仍需独立一致性审查和 executable schema/ADR 收口。

## 2. 已完成

- 删除旧的 migration-centered baseline；
- 明确 Full Rebuild，不整体迁移旧实现；
- 冻结 Node 最小执行/归因单位；
- 冻结确定性 authority 与模型 proposer 分离；
- 冻结 event journal + outbox/inbox + replay 方向；
- 定义 Verification System、Evidence 和 Gate；
- 定义 Learning 因果验证链；
- 定义 GitHub -> Local 单向 Release 边界；
- 定义 GBrain/本地 KB Adapter 边界；
- 定义 security/governance baseline；
- 定义 engineering/quality/release standards；
- 定义 capability map、Contract catalog 和 first vertical slice；
- 接受 ADR-0001~0006。

## 3. 当前文档成熟度

| Area | Status | Next gate |
|---|---|---|
| Charter / Scope | BASELINE DRAFT | independent consistency review |
| Target Architecture | BASELINE DRAFT | dependency/authority review |
| Durable Execution | BASELINE DRAFT | state/command/event schema |
| Context/Contract/Policy | BASELINE DRAFT | schema + policy engine ADR |
| Verification/Evidence | BASELINE DRAFT | executable plan/gate schema |
| Learning | BASELINE DRAFT | V1 application scope ADR |
| Local Integrations | BASELINE DRAFT | GBrain protocol investigation |
| Security | BASELINE DRAFT | threat review + sandbox ADR |
| Engineering | BASELINE DRAFT | toolchain ADR/spike |
| Release/Operations | BASELINE DRAFT | packaging/storage spike |
| Roadmap | BASELINE DRAFT | Phase 1 operation plan |
| ADR-0001~0006 | ACCEPTED | implementation conformance |

## 4. Implementation Status

所有 GitHub capability：`NOT_STARTED`。

当前仓库不能构建、安装或本地运行 Framework。任何相反表述都不准确。

## 5. Phase 0 Remaining Work

1. 文档交叉一致性和术语审查；
2. machine-readable Schema inventory 落盘；
3. ADR：TypeScript/toolchain exact baseline；
4. ADR：embedded persistence selection；
5. ADR：local Control API protocol；
6. ADR：Windows execution isolation levels；
7. ADR：Policy engine/representation；
8. GBrain connector facts/protocol survey；
9. first vertical slice executable examples；
10. Phase 1 WRITE_SCOPE、VerificationPlan 与回执格式。

## 6. 当前阻塞

没有阻塞文档建设的外部依赖。

以下事项需要本地事实，但不阻塞 Kernel/Contract 的 Phase 1：

- GBrain 当前 API/protocol；
- 本地模型/provider 列表与能力；
- 本地 Workspace/Windows 运行限制；
- 旧 Framework 必须保留的少量外部行为兼容项。

这些通过后续本地调查以事实摘要输入，不上传私有知识库内容。

## 7. 下一里程碑

`M0 — Architecture Baseline Verified`

退出条件：

- 无关键术语和 owner 冲突；
- Contract catalog 覆盖第一 slice；
- 关键 ADR 解决工具链、存储、API、sandbox、Policy；
- Threat model 与 quality gates 对齐；
- Phase 1 operation plan 可由独立 Agent直接执行；
- 用户批准进入代码建设。
