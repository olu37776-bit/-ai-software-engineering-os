# Swap / GBrain Knowledge Reconstruction — Authority Index

状态：`CURRENT / KB-BN-C4 CHANGE-DRIVEN MAINTENANCE BATCH`
更新：`2026-11-10`；Issue #129。

本目录只公开任务和规则 Authority；真实 Knowledge、Swap 源码、设备资料、GBrain 索引数据、完整测试 Evidence 只在本地，不上传 GitHub。

## 1. 唯一 CURRENT Task

| 路径 | 状态 | 说明 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 知识 Primary Home、事实来源、独立验证和受控发布约束 |
| `tasks/kb-bn-c4-change-driven-batch-v1.md` | **`CURRENT TASK`** | 用 C3 已证实变更与剩余 Gap 驱动增量知识批处理：diff→impact→候选→独立 Review→受控发布→独立验收 |
| `tasks/kb-bn-c3-priority-gaps-v1.md` | `HISTORICAL / USER-REPORTED PUBLISHED + BOUND` | 用户报告 C3 正式发布与索引绑定，精确双仓 Git pair / Index Subject 仍需本机 Evidence 核验 |
| `tasks/kb-bn-c2-device-version-mml-impact-v1.md` | `HISTORICAL` | 设备版本、MML、影响导航，已纳入持续知识维护基础 |
| `tasks/kb-bn-c1-four-core-flows-batch-v1.md` | `HISTORICAL` | SCC / IF / Data / CCIC 批次 |
| `tasks/kb-b1-gap-close-and-publish-v1.md` | `HISTORICAL` | XPIC 增量 |
| `tasks/kb-p0-controlled-publication-v1.md` | `SUPPORTING AUTHORITY` | 双知识仓/GBrain 原生定向同步、消费者隔离及发布核验的安全 Gate |
| `operations/authority-sync.md` | `CURRENT DELIVERY` | fixed 40-char SHA + exact path 单文件 Authority 获取协议 |

## 2. 本轮目标

用户回报：C3 `publication=PUBLISHED`、`index_subject=BOUND`；下一任务请求 `KB_BN_C4_BATCH`。这个回报为进入新任务的路由，**不代替本地 Published Baseline、Git HEAD、GBrain Index Subject 与 Independent Publish Evidence**。

新任务只在开工时核对上一发布事实并冻结当前 subject，然后从 C3 真实 `change-delta-cases` 与 `remaining-backlog` 抽取证据充分的来源变化。重点验证**源码/配置/MML/设备资料差异能不能可靠定位应更新的知识**，以一次批次更新最重要的受影响页面。没有旧版本对照，不得把当前状态说成“发生了变化”。

本轮优先 3–6 条真实变化（若实际少就照实），8–12 条真实问答回归；每个知识仓只有一个集成候选 writer；只维护有证据的 `swap-kb` / `microwave-kb` 知识，不改生产源码、原始输入或 GBrain Schema。一次独立 Review、一次受控发布和一次独立发布 Gate；不为每条变化创建单独 Issue/PR。

阶段 A/B/C 允许按 Authority 在独立隔离区先执行。**PR 尚未合并 main 时，不允许 D/E 的正式 Git ff-only Promotion、GBrain Sync 或消费者切换。** 必须在发布前重新证明 P0 安全前置、Candidate Current Subject、独立 Actor、Source 路径与 Index Commit Pair。

## 3. 本地边界

正式：`D:\gbrain-knowledge\swap-kb\`、`D:\gbrain-knowledge\microwave-kb\`；Raw Sources 只读 `D:\swap-knowledge-sources\`；治理根 `<SwapRepo>\.ai-local\knowledge\reconstruction\`。Candidate、Report、Review、Published Baseline 的具体 WRITE_SCOPE 唯一由 CURRENT Task 定义。

Authority 使用 `operations/authority-sync.md`：agent 只以聊天下发的 40 位 exact SHA，单文件获取 index → 当前 task → supporting Authority 到原有 `authority-cache`，禁止 clone/fetch/pull/checkout GitHub Framework、下载 ZIP/archive 或上传私有知识。

## 4. 下一 Gate

- 独立审查和发布均 PASS，批量变更影响流程有实证可复用：`KB_CONTINUOUS_MAINTENANCE`。
- 新知识事实问题/Reviewer Finding：`KB_BN_C4_REMEDIATION`。
- 正式仓部分提升或 GBrain Index HOLD：`KB_BN_C4_PUBLISH_RECOVERY`。
- 本地基线/隔离/独立 Reviewer/变更来源无法证明：`BLOCKED_BY_LOCAL_STATE`。
