# Phase 1 WRITE_SCOPE

状态：`BASELINE DRAFT v0.1`  
Scope ID：`P1-EXECUTABLE-REPOSITORY-FOUNDATION-WRITE-SCOPE`  
执行模式：`DENY_BY_DEFAULT`  
基线 commit：`f4f10855f5bfcce2d56ff4b110f271b4d7cfd116`  
机器可读权威：[`operations/phase-1/write-scope.json`](../../operations/phase-1/write-scope.json)

## 1. 作用

WRITE_SCOPE 是 Phase 1 的硬边界，不是建议目录。执行 Agent 只能修改当前子 Operation 明确允许的路径，并同时满足语义约束。

判断顺序：

```text
当前子 Operation allowlist
AND 全局 allowlist
AND 不命中任何 deny rule
AND 不触发 prohibited semantics
```

任一条件不满足即停止。生成代码、脚本间接写入、重命名、复制或 vendor 文件不构成绕过方式。

## 2. 全局允许范围

Phase 1 仅允许建设：

- 根工具链、workspace、编译、lint、测试配置；
- `toolchain/**`；
- GitHub quality/release workflow 与模板；
- 最小 `apps/cli`、`apps/runtime`、`apps/worker`；
- `packages/contracts`；
- Phase 1 qualification 所需的 `packages/kernel`、`packages/policy`、`packages/persistence`、`packages/platform`；
- `packages/observability` 的最小非权威诊断；
- `packages/adapters/tool/windows-process-restricted`；
- architecture/contract/qualification/acceptance fixtures；
- release schema、scripts、operations、必要文档。

“允许 package”不等于可实现其未来全部能力。每个子 Operation 的路径和语义约束更窄。

## 3. 全局禁止范围

Phase 1 明确禁止修改或创建以下生产能力：

```text
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

同时禁止提交：

```text
.ai-local/**
.ai-work/**
artifacts/**
dist/**
node_modules/**
Secrets / token / local Evidence / private Workspace / GBrain data
```

Contract Schema 可以位于 `packages/contracts/schemas/<domain>/**`；这不等于对应生产 package 已允许实现。

## 4. 禁止语义

即使文件路径在 allowlist，仍禁止：

1. 实现生产 Workflow/Node 状态机、Router、Scheduler、terminal transition、retry/recovery；
2. 实现生产 Verification System、EvidenceGraph、Learning runtime；
3. 接入真实 Model Provider、GBrain 或私有 Workspace；
4. 创建第二持久化 driver、第二 Control API transport、第二 Policy authority；
5. 在 accepted implementation 不可用时 silent fallback；
6. CLI/UI 直接访问 SQLite 或 Kernel internal；
7. Adapter/Worker/Model/test helper 生成权威 Event、终态、PolicyDecision 或 GateDecision；
8. 批量创建无消费者、无 Contract、无 conformance test 的空 package/interface；
9. 复制旧本地 Framework 代码；
10. 将 Job Object 描述为 `OS_SANDBOXED`；
11. 通过配置开启 unrestricted shell、remote API 或动态 authority plugin；
12. 使用 coverage、文件存在或 Agent 自述替代行为验证。

## 5. 子 Operation Scope

详细 machine-readable path pattern 位于 `write-scope.json`。下面给出权威语义摘要。

| Operation | 主要可写范围 | 必须保持的边界 |
|---|---|---|
| `P1-O01` | 根工具链、lockfile、toolchain、quality workflow | 不写生产 runtime |
| `P1-O02` | `packages/contracts/**`、contract tests/scripts | Schema runtime validation 是 authority |
| `P1-O03` | architecture config/tests、最小 package public entry | 不批量空建 package，不读旧文件文本判断架构 |
| `P1-O04` | `packages/policy/**` 与 Policy Schema/tests | 唯一内置 evaluator，无脚本/外部 authority |
| `P1-O05` | `packages/persistence/**` 与 qualification/fault tests | 仅 `node:sqlite`，无业务 transition，无 fallback |
| `P1-O06` | `packages/platform`、最小 runtime/CLI、Control API | 仅 `127.0.0.1` HTTP，CLI 不直连 Kernel/DB |
| `P1-O07` | Windows process-restricted Adapter/Worker/tests | 仅 PROCESS_RESTRICTED，不实现强 sandbox |
| `P1-O08` | release scripts/schema/workflow/package smoke | qualification artifact，不宣称 production-ready |
| `P1-O09` | verification scripts/tests/receipt/docs | 不新增生产能力，不在独立验证中顺手修复 |

## 6. Scope Expansion Protocol

当实现需要超出 Scope：

1. 立即停止；
2. 记录具体文件、所需语义和原因；
3. 说明当前 Contract/ADR 为什么无法满足；
4. 评估是否产生新 canonical owner、public/persisted Contract 或安全边界；
5. 需要时新增/supersede ADR；
6. 更新 Operation Plan、WRITE_SCOPE 和 VerificationPlan；
7. 经用户/architecture authority 批准后再继续。

禁止：

- 先修改再补 Scope；
- 通过脚本生成 denied path；
- 暂时引入 fallback 后承诺以后删除；
- 用“只是 spike”绕过 authority/safety boundary；
- 继续执行并在回执中隐藏越界。

## 7. Scope Verification

每个 PR 和 Phase 1 总 Gate 必须运行 scope check，至少输出：

```text
baseline commit
operationId
changed paths
matched allow rule
matched deny rule
semantic-owner changes
generated paths
scope violations
```

需要同时检查 Git diff、未跟踪文件和构建脚本输出路径。只检查已提交文件不足以证明 Scope 合规。

最终 receipt：

```json
{
  "writeScope": {
    "scopeId": "P1-EXECUTABLE-REPOSITORY-FOUNDATION-WRITE-SCOPE",
    "compliant": true,
    "changedPaths": [],
    "violations": []
  }
}
```

实现声明为 `IMPLEMENTED` 时，`compliant` 必须为 `true` 且 `violations` 必须为空。

## 8. 状态边界

WRITE_SCOPE 通过只说明改动没有越界，不说明实现正确，也不产生 `VERIFIED`。正确性、安全性与 ADR qualification 仍由 Phase 1 VerificationPlan 判定。
