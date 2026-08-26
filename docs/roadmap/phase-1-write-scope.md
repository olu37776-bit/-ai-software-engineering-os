# Phase 1 WRITE_SCOPE

状态：`M0 CANDIDATE v0.2`  
Scope ID：`P1-EXECUTABLE-REPOSITORY-FOUNDATION-WRITE-SCOPE`  
执行模式：`DENY_BY_DEFAULT`  
源基线 commit：`88b237a422c5e0fef0d8d8a16e1291c6fa692599`  
机器权威：[`operations/phase-1/write-scope.json`](../../operations/phase-1/write-scope.json)  
Authority Lock：[`operations/phase-1/authority-lock.json`](../../operations/phase-1/authority-lock.json)

## 1. 判定算法

所有路径先规范化为 repository-relative、NFC、`/` 分隔路径；拒绝 absolute path 与 `.`/`..` segment。Pattern dialect 为 `POSIX_GLOB_V1`：

- `*` 只匹配单个 segment；
- `**` 可跨 segment；
- 精确路径只匹配该路径；
- symlink、junction、reparse point、generated path 和 case variation 都以最终规范化目标检查。

优先级：

```text
immutable authority match -> DENY
else global deny match     -> DENY
else operation deny match  -> DENY
else global allow AND operation allow -> ALLOW
else DENY
```

路径允许不代表语义允许。

## 2. Authority 不可自修改

Implementation Operation 不得修改：

- Architecture、Threat Model、ADR-0001～ADR-0011；
- Phase 0/M0/本次独立实现前 Review；
- Operation Plan、WRITE_SCOPE、VerificationPlan、Receipt Schema；
- operation/write-scope/authority-lock/preimplementation-policy machine authority。

旧版本中 `operations/phase-1/**` 被所有子 Operation 通配允许，会使实施者能够修改自己的 Scope/Gate；该路径已经移除。所有实施回执与 Evidence 只能写入明确的 output 子目录。

## 3. 全局允许与禁止

全局允许：工具链、最小 apps、Phase 1 所需 contracts/kernel/policy/persistence/platform/observability、Windows process-restricted Adapter、architecture/contract/qualification/acceptance/fault-injection/security tests、release schema/scripts、明确的 operation outputs 和必要文档。

全局禁止：

```text
.ai-local/**  .ai-work/**  artifacts/**  dist/**  node_modules/**
packages/workflow/**
packages/node-runtime/**
packages/context/**
packages/skills/**
packages/verification/**
packages/evidence/**
packages/learning/**
packages/adapters/model/**
packages/adapters/knowledge/**
packages/adapters/tool/os-sandboxed/**
packages/adapters/tool/container-isolated/**
packages/adapters/tool/remote-isolated/**
```

原版本全局 allowlist 漏掉 `tests/fault-injection/**` 与 `tests/security/**`，却在 O05/O07 中把它们列为强制输出；该交叉冲突已经关闭。

## 4. 禁止语义

即使路径允许，也禁止：

1. 生产 Workflow/Node state machine、Router、Scheduler、terminal、retry/recovery；
2. 生产 Verification System、EvidenceGraph、Learning runtime；
3. 真实 Model、GBrain、私有 Workspace；
4. 第二 persistence driver、Control API transport、Policy evaluator 或 isolation authority；
5. silent fallback/downward downgrade；
6. CLI/UI 直连 SQLite 或 Kernel internal；
7. Adapter/Worker/Model/test helper 生成权威 Event、终态、PolicyDecision 或 GateDecision；
8. 空 package/interface 批量造进度；
9. 复制旧本地 Framework；
10. 把 Job Object 声称为 `OS_SANDBOXED`；
11. unrestricted shell、remote API 或动态 authority plugin；
12. 用 coverage、文件存在或 Agent 自述代替行为验证；
13. 在实施分支中修改自己的 Scope 或 Verification authority。

## 5. 子 Operation 摘要

| Operation | 可写重点 | 关键边界 |
|---|---|---|
| P1-O01 | root toolchain/lockfile/quality | 不写 apps/packages |
| P1-O02 | contracts/schema/tests | runtime Schema 是 authority |
| P1-O03 | architecture config/tests/minimal entries | 不批量空建 package |
| P1-O04 | policy/schema/tests | 唯一内置 evaluator |
| P1-O05 | persistence/fault-injection | 仅 node:sqlite，无 transition/fallback |
| P1-O06 | platform/runtime/CLI/API security tests | 仅 loopback HTTP，CLI 不直连 internal |
| P1-O07 | windows-process-restricted/security tests | 不是强 sandbox，不降级 |
| P1-O08 | packaging/release/supply-chain | qualification artifact |
| P1-O09 | verification scripts/receipt/Evidence bundle | 不改生产代码和 authority |

详细 glob、deny 与 required outputs 只以 `write-scope.json` 为准。

## 6. Scope Expansion

需要越界时：

1. 立即停止；
2. 记录路径、语义、原因和 Evidence；
3. 判断是否改变 owner/public/persisted Contract/security boundary；
4. 由独立 architecture-authority change 更新 ADR、Operation Plan、WRITE_SCOPE、VerificationPlan 和 Authority Lock；
5. 重新执行实现前验证并取得批准；
6. 从新授权 baseline 继续。

禁止先改后补、generated path 绕过、临时 fallback、以 spike 名义绕过边界。

## 7. Scope Evidence

每个 PR 与总 Gate至少记录：

```text
M0-authorized baseline commit
operationId
authority lock hash/result
changed and generated paths
normalized paths
matched immutable/deny/allow rule
semantic-owner changes
violations
```

检查范围必须包括 Git diff、未跟踪文件和构建脚本输出。WRITE_SCOPE PASS 只说明没有越界，不等于实现正确或 `VERIFIED`。
