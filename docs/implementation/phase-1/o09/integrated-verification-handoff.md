# P1-O09 Integrated Verification Handoff

状态：`IMPLEMENTED`（实现方声明）

风险等级：`R4`

Gate：`P1-V10-INTEGRATED-GATE`

## 1. 声明边界

P1-O09 汇总 Phase 1 已实现的仓库基础、Contract、架构、Policy、SQLite、Control API、Windows PROCESS_RESTRICTED 与自包含 Windows qualification release，并把它们交给独立验证器复现。

`IMPLEMENTED` 只表示实现方已准备完整输入。实现方不得把自身声明升级为 `VERIFIED`；独立 Gate 的唯一机器可读结论由 `operations/phase-1/evidence/o09/independent-verification-receipt.json` 给出。

## 2. 不可变输入

独立验证必须使用实现收据中的精确 `implementationCommit`，并验证：

- `operations/phase-1/authority-lock.json` 的精确文件哈希；
- `operations/phase-1/verification-plan.json` 的精确文件哈希；
- `operations/phase-1/implementation-receipt.json` 的精确文件哈希；
- P1-O01 至 P1-O09 各自的 commit references、outputs 与 findings；
- P1-V00 至 P1-V10 各自的 PASS 结果与 Evidence references；
- ADR-0007 至 ADR-0011 五项 qualification obligations；
- P1-O09 deny-by-default write scope 与全部变更路径。

验证过程中不得修改被验证提交，也不得在同一次独立验证中修复失败。

## 3. 输入包索引

- 冻结治理：`operations/phase-1/operation.json`、`write-scope.json`、`authority-lock.json`、`verification-plan.json`；
- 收据契约：`receipt.schema.json`、`independent-verification-receipt.schema.json`；
- 实现收据：`operations/phase-1/implementation-receipt.json`；
- O01-O09 执行记录：`operations/phase-1/executions/`；
- V00-V10 Evidence：`operations/phase-1/evidence/o01/` 至 `operations/phase-1/evidence/o09/`；
- 只读验证器：`scripts/verify-phase-1/verify-receipt.mjs`；
- 集成与负向测试：`tests/qualification/phase-1/`、`tests/contract/phase-1/`；
- 人类可读 Gate 说明：`docs/reviews/phase-1-integrated-verification-handoff.md`。

## 4. 复现入口

```powershell
node scripts/verify-phase-1/verify-receipt.mjs `
  --receipt operations/phase-1/implementation-receipt.json `
  --independent-receipt operations/phase-1/evidence/o09/independent-verification-receipt.json `
  --repository-root . `
  --json
```

任何缺失、重复、跳过、不可用、不确定、非 PASS、哈希漂移、越权路径、无效 Git commit、无效 Evidence reference 或实现方自我升级声明都必须 fail closed。

## 5. 已知边界

- Windows artifact 是 `NON_PRODUCTION_QUALIFICATION`，不是生产 installer；
- 未实现签名分发、production auto-update 或 production approval；
- qualification network guard 是 Node API 级非 loopback 防线，不是 OS 级网络沙箱；
- `PROCESS_RESTRICTED` 不等于 `OS_SANDBOXED`；
- Phase 2 的 production Workflow、Node Runtime、Verification System、EvidenceGraph、Learning runtime 与真实模型/知识适配仍未实现；
- 独立 Gate PASS 只关闭 Phase 1 定义的 V00-V10，不扩张上述能力边界。
