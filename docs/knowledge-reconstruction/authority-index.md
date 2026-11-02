# 项目知识库重建：Authority Index

状态：`CURRENT / KB-V0-B3 B2-GATED INDEPENDENT REVIEW OR REVERIFICATION`
更新：`2026-11-02`；跟踪：Issue #110。

本目录是 Swap / GBrain 知识库重建支线的**唯一远端执行 Authority**。只发布可公开的设计、任务、Gate 规则；内部知识、源码、完整本地 Review/Evidence 不上传此仓库。

## 1. Authority 层级与 CURRENT

上位 Framework Charter / accepted ADR / public Contract 不变。本支线只拥有知识治理与本地建设流程，不拥有 Runtime、Context、Policy、Router、Verification System 或 Learning 的核心实现语义。

| 文档 | 状态 | 用途 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 知识模型、边界、持续维护、验证与发布设计 |
| `tasks/kb-v0-b3-review-reverify-v1.md` | `CURRENT TASK` | 读取 B2 实际 Review Gate；确认通过后，同轮完成 B3 独立 Review / Reverification |
| `tasks/kb-v0-b2-review-reverify-v1.md` | `HISTORICAL TASK / LOCAL COMPLETION REPORTED` | B2 审查规则与上轮 Subject |
| `tasks/kb-r0-local-state-reconciliation-v1.md` | `HISTORICAL TASK / COMPLETED LOCALLY` | 本机历史状态恢复任务 |
| `operations/authority-sync.md` | `CURRENT DELIVERY` | exact SHA、单文件 HTTP 下载，仅缓存需要的 Authority |

**当前唯一允许任务是上述 KB-V0-B3**。它必须先通过 B2 的本机 exact-subject Gate 检查。不得凭聊天“已完成”或远端表格直接宣布 B2 VERIFIED。

## 2. 已知 Gate 与尚未证实的内容

- KB-D0：已合并设计基线。用户回报独立审查通过，仅 2 个 P3 记录性问题。
- KB-R0：用户回报已完成并选择 `KB_V0_B2_REVIEW_OR_REVERIFY`。完整证据保存在本地。
- KB-V0-B2：用户回报“好了”，但未在当前会话提供精确 `decision`/`next_gate`。远端标记 `REPORTED_COMPLETED / DECISION_NOT_EXPORTED`；本任务将直接读取本地 Review Artifact 确定 Gate，不新增纯调查轮次。
- B3：先前用户回报 Reconstruction 已完成，是否已有独立审查和 current-subject coverage 由本机 KB-R0 与 B3 Evidence 判定。
- 双仓 HEAD、dirty、GBrain Source、index binding：都以本机实际 subject 为准，远端不补猜。

## 3. 当前阶段与边界

Batch #3 是 `Source Configuration Ingestion & Normalization`。重点验证 NCE GET 日志与设备 DB→MML（legacy C++ + Java supplement）两路输入、Source MML 汇合、接入 B2 公共处理链、覆盖差异及未知。

当前任务默认只读，不允许改正式知识页、Raw Sources、Swap 代码、GBrain 索引或旧 Evidence；输出仅在新 `.ai-local` Review subject 目录。

本地固定路径：

- `D:\gbrain-knowledge\swap-kb\`
- `D:\gbrain-knowledge\microwave-kb\`
- `D:\swap-knowledge-sources\`
- `<SwapRepo>\.ai-local\knowledge\reconstruction\`
- `<SwapRepo>\.ai-local\knowledge\reconstruction\authority-cache\<AUTHORITY_SHA>\`

`<SwapRepo>` 必须是 Agent 当前已打开、能够核实为 Swap 的工程；禁止凭猜测或磁盘全盘搜索确定目录。

## 4. 前置 Gate（必须）

本轮首先读取 B2 Authority `f2e4e473bc70590ac5132a87733c78231396ed50` 下的最新本地 Review、findings、subject-manifest、query-validation 和 KB-R0 状态记录。

仅当 B2 `decision = B2_VERIFIED_CURRENT_SUBJECT`、`next_gate = KB_V0_B3_REVIEW_OR_REVERIFY`，并且独立 subject 仍覆盖当前相关 Knowledge，才允许 B3 实际审查。否则返回 B2 当前真实下一 Gate 并停止，**不得伪造通过状态**。

## 5. B3 当前义务

- 真实代码/文档源驱动，验证源输入、解析/规范化/汇合和边界，不把 DB→MML 和后段 JNI/C++ GET→SET 混为一谈。
- 不预设 C++/Java 固定优先级、无损或两路完全等价。
- 回归历史 B3 Findings；所有 Current Truth 有当前来源、版本/适用范围；跨知识仓 Primary Home 明确。
- 独立审查完整 `B3-VR-01～10`，输出 exact-subject Decision。

## 6. Next Gate

由 CURRENT Task 中的 B2 前置结果和 B3 独立审查结果选择且仅选择一个：

- `KB_B2_REMEDIATION`（B2 未通过且要求整改）；
- `KB_B3_REMEDIATION`（B3 发现阻塞）；
- `KB_V0_CURRENT_HEAD_REVERIFY`（当前 subject 漂移，未覆盖）；
- `KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION`（B2/B3 有效、发布/基线绑定待收口）；
- `BLOCKED_BY_LOCAL_STATE`（证据不足）。

本任务不可自动执行下一个 Gate，不启动 B4。

## 7. Authority 下载规则

严格按 `operations/authority-sync.md`；Chat 提供 exact 40-char Authority SHA。**禁止 Git clone/fetch/pull/checkout 整个 Framework**，不下载 ZIP/archive；只将本 `authority-index.md`、CURRENT Task、Task 明确引用的 supporting Authority 逐文件下载到既有 `.ai-local/knowledge/reconstruction/authority-cache/<SHA>/`。其他 Framework 文件按需只读到内存，不能落到本地知识仓。

## 8. 历史入口

收入工具仓库旧 `docs/swap-knowledge-reconstruction/` 视为 `SUPERSEDED`；原旧 Wiki clue-only；`.ai-local/knowledge-reconstruction/` 是错误旧路径，正式治理根为 `.ai-local/knowledge/reconstruction/`。既有 Survey/Golden Slice/Convention/B2/B3 历史 Evidence 均不因 Authority 换仓而失效。
