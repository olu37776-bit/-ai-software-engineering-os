# 项目知识库重建：Authority Index

状态：`CURRENT / KB-P0 CONTROLLED BASELINE & GBRAIN PUBLICATION`
更新：`2026-11-03`；跟踪：Issue #115。

本目录仅维护 Swap / GBrain 项目知识库重建支线**可公开的任务与设计 Authority**。正式 Knowledge、原始资料、内部源码、完整 Evidence 与私有报告留在本地，不上传此仓库。

## 1. 唯一 CURRENT Task

| Authority 文件 | 状态 | 说明 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 事实来源、知识模型、验证/发布边界 |
| `tasks/kb-p0-controlled-publication-v1.md` | **`CURRENT TASK`** | 受控完成 F1 已审候选的正式双知识仓 Commit Pair、GBrain Source/Index、独立发布验收与联合基线 |
| `tasks/kb-f1-independent-candidate-review-v1.md` | `HISTORICAL / LOCALLY REPORTED APPROVED` | 用户反馈 `F1_APPROVED_CANDIDATE`；完整独立报告和 exact subject 必须在本机检查 |
| `tasks/kb-f0-existing-assets-fast-build-v1.md` | `HISTORICAL / LOCALLY REPORTED COMPLETE` | 候选工作树/manifest/建设自检 |
| `tasks/kb-v0-b3-review-reverify-v1.md` | `SUPERSEDED` | 曾误用不存在的新 B2 Review 路径的任务，禁止执行 |
| `tasks/kb-v0-b2-review-reverify-v1.md` | `HISTORICAL` | 旧 B2 审查任务，与当下发布门禁无自动等价 |
| `operations/authority-sync.md` | `CURRENT DELIVERY` | fixed SHA + exact path 下载 Authority；不克隆 Framework |

## 2. 已知 Gate 与准确权限

- KB-D0：设计基线已通过并合并。
- KB-R0：本机状态恢复完成，用户提供下一 Gate。
- KB-F0：用户报告候选知识建设完成，真实模式/产物以本地 manifest 为准。
- KB-F1：用户明确反馈 `F1_APPROVED_CANDIDATE`、下一 Gate 为 `KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION`。这是允许准备 KB-P0 的路由，不证明正式知识已发布，也不代替 F1 原始 Evidence。
- KB-P0：本次唯一允许动作。运行前必须验证 F1 exact-subject、真实两 Knowledge Repo Git HEAD、候选 Git HEAD 与当前 GBrain Source 索引绑定。先做好预检/恢复措施后才允许 Promotion/Index Sync。

## 3. 目录与隔离

```text
D:\gbrain-knowledge\swap-kb\
D:\gbrain-knowledge\microwave-kb\
D:\swap-knowledge-sources\
<SwapRepo>\.ai-local\knowledge\reconstruction\
<SwapRepo>\.ai-local\knowledge\reconstruction\authority-cache\<AUTHORITY_SHA>\
```

候选目录、F0 build 目录、F1 review 目录和 KB-P0 本地发布 Evidence 路径仅由各任务文档及本地真实 manifest 确认。不存在的旧 cache/new B2 Review 目录不是有效 blocker。旧 `reviews\batch-2-v1\` 的 subject 前缀 `3b25e85` 只能用作历史来源，不自动将 PASS 迁移至当前 commit。

## 3.1 当前 Preflight 状态与处置

本机 P0 预检用户报告：

- `P0-B1` PR #116 未合并：**已解除**。PR #116 required checks 成功，现已合并至 main `009132b02f0caa06d0000b3f00b5f4393c270ba2`。
- `P0-B2` Windows Owner = `BUILTIN\Administrators`：**待本机区分 Git safe.directory 信任问题和实际 NTFS ACL 写权限**，不得一概视为必须改 Owner。
- `P0-B3` GBrain 两 Source `tracked_branch=null`：**待核实 native Source/sync/index subject 证据**。null 不单独证明索引无法绑定，也绝不允许伪造绑定。
- `P0-B4` 无消费者暂停证据：**仍是关键发布阻塞**。先取得可验证的原生维护门禁或单机完全停止消费/自动任务方案，否则禁止 promotion/sync。

具体单轮处理步骤已经加入 `tasks/kb-p0-controlled-publication-v1.md` 的 **§1.1**。不另开一轮形式化状态调查；在同一 P0 Task 中先只读解除三个 blocker，全部 PASS 才允许进入后续正式发布，失败只保留证据并停止。

## 4. KB-P0 必须保留的 Gate

在一轮任务中完成受控流程：

1. 冻结并确认 F1 当前批准的 candidate/full Knowledge target commit pair。
2. 验证正式两仓 working tree clean、Git 目标可无破坏 fast-forward，GBrain Source 指向正确正式目录，确保避免未完成索引被正式消费。
3. 用本地非破坏性 Git promotion 更新受影响的正式 Knowledge branch；不得自动 reset/rebase/cherry-pick 或修改未审页面。
4. 以本机实际支持的受控 GBrain Source 同步方式发布；禁止重建 DB/Source。
5. 由独立 Reviewer 验证两个 Source、查询、Unknown、index subject 与 Git commit Pair 一致；仅全通过后写双仓 `published-baseline.json` 并恢复正式消费。

如果不能安全执行则返回真实 `PREFLIGHT_BLOCKED` / `PARTIAL_PUBLICATION_HOLD` / `PUBLISH_HOLD`，绝不假报 PUBLISHED，也不自动覆盖旧基线。

成功后唯一下一 Gate 为 `KB_BN_INCREMENTAL_KNOWLEDGE_MAINTENANCE`。失败则进入明确受限的修复/恢复任务，不自动开启 Batch #4。

## 5. Framework 与保密边界

本知识支线不修改 Framework 受治理 Runtime、Context、Policy、Router、Verification System、Learning 的实现或 Contract。内部 Knowledge Page、Raw Sources、Review/Build/发布完整 Evidence 不上传 GitHub，公开仓库只存可公开 Authority 与脱敏短回执。

仅按聊天给出的 exact 40 位 Authority SHA 下载 `authority-index.md`、唯一 CURRENT Task 和 Task 明确指定的 supporting Authority，缓存到既有 `<SwapRepo>\.ai-local\knowledge\reconstruction\authority-cache\<SHA>\`。禁止 clone/fetch/pull/checkout Framework 整仓、ZIP/archive；不能因单文件下载失败而退化为拉整仓。

## 6. 历史入口

旧收入工具仓库任务目录 `SUPERSEDED`；旧 LLM Wiki clue-only；`.ai-local/knowledge-reconstruction/` 是错误旧路径，长期治理根始终为 `.ai-local/knowledge/reconstruction/`。
