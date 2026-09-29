# 项目知识库重建：Authority Index

状态：`CURRENT / KB-R0 LOCAL STATE RECONCILIATION`
更新：`2026-09-29`；跟踪：Issue #104。

本目录是 GBrain / Swap 项目知识库重建支线的远程 Authority。聊天只负责提供 exact Authority SHA、CURRENT Task 路径和短回执；本地正式知识、内部源码、Raw Sources 与完整 Evidence 不上传。

## 1. Authority 层级

上位 Framework Charter / accepted ADR / public Contract 保持原 owner。本支线只拥有知识内容、知识治理、知识发布与本地建设流程，不拥有 Runtime、Context、Router、Verification System 或 Learning 核心语义。

| 文档 | 状态 | 作用 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 知识边界、内容模型、Evidence、维护、独立验证与发布规则 |
| `tasks/kb-r0-local-state-reconciliation-v1.md` | `CURRENT TASK` | 从本机真实 Artifact 恢复 B2/B3、Knowledge Repo、GBrain 与 Baseline 状态 |
| `operations/authority-sync.md` | `CURRENT` | exact-SHA 单文件 Authority 获取协议 |
| `reviews/design-v1-review-scope.md` | `HISTORICAL REVIEW AUTHORITY` | KB-D0 总体设计独立审查范围 |

## 2. KB-D0 设计基线

- PR #98 已合并到 main，merge commit：`6b1fea1fbb7ce54f0d8d50cb1e00e6c01f298846`。
- 独立本地设计审查已完成；用户短回执表明无 P0/P1/P2 阻塞，仅 2 个 P3 记录性问题。
- 设计审查只证明 KB-D0 设计可作为后续任务基线，不证明本地 B2/B3 或 GBrain 当前状态。
- 两个 P3 的完整内容继续保留在本地 Review Artifact，不上传此公开仓库。

## 3. 当前唯一允许任务

`KB-R0：本机 Knowledge Reconstruction 真实状态恢复 V1`

Authority：

`docs/knowledge-reconstruction/tasks/kb-r0-local-state-reconciliation-v1.md`

本任务只读调查既有本地事实，并只写新的 reconciliation 报告。不得修改正式 Knowledge Page、Raw Sources、production code、GBrain 索引或既有历史 Artifact。

## 4. 当前本地边界

- 正式项目知识：`D:\gbrain-knowledge\swap-kb\`
- 正式领域知识：`D:\gbrain-knowledge\microwave-kb\`
- Raw Sources：`D:\swap-knowledge-sources\`
- 本地治理根：`<SwapRepo>\.ai-local\knowledge\reconstruction\`
- Authority cache：`<SwapRepo>\.ai-local\knowledge\reconstruction\authority-cache\<AUTHORITY_SHA>\`

`<SwapRepo>` 必须是 Agent 当前打开且能够证明为 Swap 项目的仓库。不能唯一证明时 fail closed，禁止扫描磁盘猜路径。

## 5. 当前已知但尚待本机重证的历史状态

| 对象 | 当前远端状态 |
| --- | --- |
| Survey V1 | `REPORTED_COMPLETED`，本机 Evidence 待 KB-R0 绑定 |
| Golden Slice #1 | `REPORTED_COMPLETED`，本机 Evidence 待 KB-R0 绑定 |
| Knowledge Construction Convention V1 | `REPORTED_READY`，本机路径/版本待 KB-R0 绑定 |
| Batch #2：Core Swap Processing Architecture | `RECONCILE_REQUIRED`，不得凭聊天判定最终 Gate |
| Batch #3：Source Configuration Ingestion & Normalization | `RECONCILE_REQUIRED`，不得凭聊天判定最终 Gate |
| GBrain Source / index subject | `RECONCILE_REQUIRED` |

## 6. 当前 Blocker

`LOCAL_STATE_NOT_RECONCILED`

原因：远端 Authority 不能直接证明 B2/B3 最终独立结论、两个 Knowledge Repo 当前 HEAD、GBrain Source 路径与索引 subject 是否一致。

## 7. 下一 Gate

KB-R0 完成后只能根据本机 Evidence 进入以下之一：

- `KB_V0_B2_REVIEW_OR_REVERIFY`
- `KB_V0_B3_REVIEW_OR_REVERIFY`
- `KB_V0_CURRENT_HEAD_REVERIFY`
- `KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION`
- `BLOCKED_BY_LOCAL_STATE`

KB-R0 不得自动执行下一 Gate。

## 8. Authority 获取规则

严禁 clone/fetch/pull/checkout 整个 Framework 仓库。按 `operations/authority-sync.md`：

1. 使用聊天给出的 exact `AUTHORITY_SHA`；
2. 只下载本文件；
3. 读取本文件得到 CURRENT Task；
4. 只下载 CURRENT Task 和它明确要求的 supporting Authority；
5. Framework 其他公开文件如确需核对，只允许 exact SHA + exact path 的 HTTP 单文件读取，不落盘。

## 9. 历史入口

- 收入工具仓库中的旧 `docs/swap-knowledge-reconstruction/`：`SUPERSEDED`，仅供历史追踪。
- 历史聊天长提示词：非 Authority。
- `.ai-local/knowledge-reconstruction/`：错误旧路径；正式长期根始终是 `.ai-local/knowledge/reconstruction/`。
- 旧 LLM Wiki：clue only。

当前执行必须从本文件与 CURRENT Task 恢复，不依赖旧会话记忆。
