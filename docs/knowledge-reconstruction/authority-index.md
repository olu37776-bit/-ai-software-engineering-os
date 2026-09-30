# 项目知识库重建：Authority Index

状态：`CURRENT / KB-V0-B2 INDEPENDENT REVIEW OR RE-VERIFICATION`
更新：`2026-09-30`；跟踪：Issue #106。

本目录是 GBrain / Swap 项目知识库重建支线的远程 Authority。聊天只负责提供 exact Authority SHA、CURRENT Task 路径和短回执；本地正式知识、内部源码、Raw Sources 与完整 Evidence 不上传。

## 1. Authority 层级

上位 Framework Charter / accepted ADR / public Contract 保持原 owner。本支线只拥有知识内容、知识治理、知识发布与本地建设流程，不拥有 Runtime、Context、Router、Verification System 或 Learning 核心语义。

| 文档 | 状态 | 作用 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 知识边界、内容模型、Evidence、维护、独立验证与发布规则 |
| `tasks/kb-v0-b2-review-reverify-v1.md` | `CURRENT TASK` | 对 Batch #2 当前 Knowledge subject 执行独立 Review / Re-Verification |
| `tasks/kb-r0-local-state-reconciliation-v1.md` | `COMPLETED LOCALLY` | 已恢复本机状态，并选择下一 Gate = `KB_V0_B2_REVIEW_OR_REVERIFY` |
| `operations/authority-sync.md` | `CURRENT` | exact-SHA 单文件 Authority 获取协议 |

## 2. 已完成 Gate

- KB-D0 总体设计已独立审查通过并形成 DESIGN BASELINE。
- KB-R0 已在本机完成状态恢复。
- 用户短回执确认 KB-R0 选择的下一 Gate 为：`KB_V0_B2_REVIEW_OR_REVERIFY`。

KB-R0 的完整 `state-manifest.json` / `state-reconciliation.md` / `next-gate.md` 保留本地，不上传公开仓库。

## 3. 当前唯一允许任务

`KB-V0-B2：Batch #2 独立 Review / Re-Verification V1`

Authority：

`docs/knowledge-reconstruction/tasks/kb-v0-b2-review-reverify-v1.md`

当前只允许独立审查/复验 B2；不得修改 Knowledge Page，不得自动 remediation，不得开始 B3/B4。

## 4. 当前本地边界

- 正式项目知识：`D:\gbrain-knowledge\swap-kb\`
- 正式领域知识：`D:\gbrain-knowledge\microwave-kb\`
- Raw Sources：`D:\swap-knowledge-sources\`
- 本地治理根：`<SwapRepo>\.ai-local\knowledge\reconstruction\`
- Authority cache：`<SwapRepo>\.ai-local\knowledge\reconstruction\authority-cache\<AUTHORITY_SHA>\`

本次 B2 Review 必须首先读取 KB-R0 在 Authority `ff592837c82c4bbb2010f90315aa828e3f797f42` 下产生的本地 reconciliation 输出。

## 5. B2 当前目标

Batch #2 主题：`Core Swap Processing Architecture`。

必须验证当前 Knowledge subject 对以下主链和边界的准确性：

`SwapParam -> SwapService#doTransfer -> *Module/AbstractTransfer -> module txt/relevant GET MML -> device specialization/XML -> result merge -> JNI/C++ -> cfg.ini GET->SET -> SET boundary`。

并回归历史 finding，确认：UI aggregation 不被虚构成组件、Feature/Scenario/MML 不等同 Module、module txt 不等于 unique ownership、无 Evidence 不写固定全局 Module 顺序、业务转换与最终 GET->SET formatting 分责。

## 6. 当前 Blocker

`B2_CURRENT_SUBJECT_NOT_INDEPENDENTLY_CLOSED`

KB-R0 已判断应先完成 B2 Review/Reverification；在 B2 独立 Gate 收口前，不推进 B3/B4 或 Knowledge Baseline/Published subject。

## 7. 下一 Gate

由 CURRENT Task 的独立结论决定：

- B2 verified，且 KB-R0 显示 B3 未 VERIFIED -> `KB_V0_B3_REVIEW_OR_REVERIFY`；
- B2 verified，但当前 Knowledge HEAD 超出后续历史 subject -> `KB_V0_CURRENT_HEAD_REVERIFY`；
- B2/B3/current HEAD 均覆盖但 Baseline/Index 未绑定 -> `KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION`；
- B2 有阻塞 finding -> `KB_B2_REMEDIATION`；
- 本地 subject 无法确定 -> `BLOCKED_BY_LOCAL_STATE`。

CURRENT Task 完成后停止，不自动进入下一 Gate。

## 8. Authority 获取规则

严禁 clone/fetch/pull/checkout Framework 仓库。按 `operations/authority-sync.md`：

1. 使用聊天给出的 exact `AUTHORITY_SHA`；
2. 只下载本文件；
3. 再下载 CURRENT Task；
4. 只下载 CURRENT Task 明确要求的 supporting Authority；
5. Framework 其他文件如需核对，只允许 exact SHA + exact path 的 HTTP 单文件读取，不落盘。

## 9. 历史入口

- 收入工具仓库旧 `docs/swap-knowledge-reconstruction/`：`SUPERSEDED`；
- 历史聊天长提示词：非 Authority；
- `.ai-local/knowledge-reconstruction/`：错误旧路径；正式长期根为 `.ai-local/knowledge/reconstruction/`；
- 旧 LLM Wiki：clue only。

当前执行必须从本文件和 CURRENT Task 恢复，不依赖旧会话记忆。
