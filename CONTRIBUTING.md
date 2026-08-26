# Contributing

本仓库当前处于完整框架重建阶段。所有贡献必须以已冻结的架构、Contract 和 Evidence 为依据。

## 1. 基本流程

```text
Issue / Operation
-> 明确目标与 WRITE_SCOPE
-> Architecture/Contract impact review
-> Implementation
-> Verification Evidence
-> Independent Review
-> Merge
-> Release Gate
```

## 2. Issue / Operation 必填信息

- 目标语义；
- 当前已验证事实；
- 权威文档/ADR/Contract；
- `WRITE_SCOPE`；
- 明确禁止修改范围；
- canonical semantic owner；
- 风险与影响范围；
- 验收条件；
- VerificationPlan；
- 需要生成的 Evidence；
- 回滚方式。

缺少这些信息时，不应通过临时代码猜测架构。

## 3. 状态与职责

- 实现者可以声明 `IMPLEMENTED`；
- 独立 Verification/Review 才能声明 `VERIFIED`；
- 测试通过但未覆盖目标 Contract 时不能声明 `VERIFIED`；
- 文档、Contract、代码、测试和 Evidence 必须在同一变更中保持一致；
- 审查者不得只读取 Agent 总结，必须检查实际 diff、测试目标与 Evidence。

## 4. 变更规则

以下改动必须有 ADR：

- 核心状态机或状态所有权；
- persisted/public schema breaking change；
- 并发、幂等、retry、recovery 语义；
- Node/Workflow identity；
- Policy、Approval 或 Verification Gate；
- 安全边界；
- 本地数据与 Release 边界；
- 引入新的运行时、数据库或远程服务。

## 5. Pull Request 要求

PR 至少说明：

```text
What changed
Why this owner is authoritative
Contract/schema impact
Failure modes considered
Verification performed
Evidence produced
Known gaps
Rollback
```

禁止：

- 在多个 package 复制同一核心语义；
- 为让测试通过而删除关键断言；
- mock 被验证的核心 reducer/oracle；
- 用 snapshot 文件存在替代行为验证；
- 隐藏失败、catch 后继续或返回伪成功；
- 添加未经 schema 验证的持久化 payload；
- 依赖全局 singleton 或 import side effect 初始化；
- 在 Adapter 中重新实现 Core Domain 状态转换。

## 6. Commit 与分支

实现阶段默认使用短生命周期分支和 PR。Commit 应按意图拆分，并使用可读前缀：

```text
docs:
feat:
fix:
refactor:
test:
chore:
security:
```

不得用一个大提交混合架构变更、功能、格式化和无关重构。

## 7. AI Agent 使用

Agent 必须：

- 先读取权威文档和当前 Contract；
- 报告发现的冲突，不得自行扩展核心概念；
- 遵守 WRITE_SCOPE；
- 明确区分事实、推断与建议；
- 产生机器可验证的输出与 Evidence；
- 不在提示词中绑定或自行切换模型；
- 完成代码时同步必要文档，但不得自行标记 `VERIFIED`。

## 8. Definition of Done

一个变更只有在以下条件都成立时才可合并：

- canonical owner 唯一；
- schema/Contract 已更新并验证；
- 正向、失败、边界和恢复路径已有测试；
- 目标风险有对应 Evidence；
- architecture checks 通过；
- 没有未解释的 skipped/inconclusive 验证；
- 安全、迁移和回滚影响已处理；
- 文档状态与实现状态一致。
