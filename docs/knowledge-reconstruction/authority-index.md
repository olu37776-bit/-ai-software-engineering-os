# 项目知识库重建：Authority Index

状态：`CURRENT / KB-F1 INDEPENDENT CANDIDATE REVIEW`
更新：`2026-11-03`；跟踪：Issue #113。

本目录是本地 Swap / GBrain 知识库支线的正式远程任务/设计 Authority。完整知识、内部源码、原始资料、私有 Evidence 不进入公共仓库。聊天仅分发 exact Authority SHA、CURRENT Task 与短回执。

## 1. CURRENT 与历史

| 文档 | 状态 | 说明 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 知识边界、内容模型、来源、验证/发布隔离 |
| `tasks/kb-f1-independent-candidate-review-v1.md` | **`CURRENT TASK`** | 一次性复核 F0 真实候选或 NO_CHANGES_NEEDED 的当前知识 subject，检查来源、导航、B2/B3 责任边界 |
| `tasks/kb-f0-existing-assets-fast-build-v1.md` | `HISTORICAL / LOCAL COMPLETION REPORTED` | 用户回报 F0 已完成；实际产物和 Decision 由 F1 首先读取并绑定 |
| `tasks/kb-v0-b3-review-reverify-v1.md` | `SUPERSEDED / NOT EXECUTABLE` | 原 B2→B3 硬门禁因错误预设新 B2 Review 路径而取消；不允许继续执行 |
| `tasks/kb-v0-b2-review-reverify-v1.md` | `HISTORICAL / NOT CURRENT` | 旧 B2 审查任务，不能用于推断本地有对应新报告 |
| `tasks/kb-r0-local-state-reconciliation-v1.md` | `HISTORICAL / REPORTED COMPLETE` | 本地状态恢复，真实记录继续在 `.ai-local` |
| `operations/authority-sync.md` | `CURRENT DELIVERY` | fixed SHA + exact path 单文件下载，不 clone Framework |

## 2. 重要纠错

用户本机报告：唯一现有 B2 Review 位于 `<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\batch-2-v1\`，历史 subject 绑定 `3b25e85...`。**历史 Review 不应因旧 Authority cache 不存在而被判不存在。**

此前 B3 任务错误强制要求 `reviews\batch-2\f2e4e473...\` 和旧 Authority 缓存存在。这是尚未执行的任务产生的预期路径，不是已经确认存在的事实。故原 B3 Gate 被暂停并由 KB-F0 取代。

对旧 B2 Review 的正确处理：读取原文件及完整 subject；复用可用来源、Finding 和结论，但不将旧 SHA 的 PASS 无证据延伸为当前 Knowledge HEAD VERIFIED。缺少新 Review 路径不是构建阻塞理由；只有实际缺少源证据、写入隔离或 private state 无法确认时才按 scope 阻塞。

## 3. 当前唯一任务

`docs/knowledge-reconstruction/tasks/kb-f1-independent-candidate-review-v1.md`。

本任务允许**先建设候选知识**，复用已有 Survey、Golden Slice、Convention V1、B2/B3 reconstruction 以及历史 B2 Review。只在独立 candidate worktree 中少量增量补齐导航、NCE GET、Device DB→legacy C++ + Java supplemental MML、Source MML 接 B2 主链与应用例子，不重复建设已有可靠页面。

不允许把 candidate 合并回正式 `swap-kb`/`microwave-kb`，不允许 GBrain 正式 Source 同步未审查内容，也不允许实施者自称 VERIFIED。独立审查通过后下一 Gate 才是 KB-P0 发布基线对齐；本轮不执行发布。

## 4. 固定本地位置

- 正式项目知识：`D:\gbrain-knowledge\swap-kb\`
- 正式领域知识：`D:\gbrain-knowledge\microwave-kb\`
- Raw Sources：`D:\swap-knowledge-sources\`
- 治理根：`<SwapRepo>\.ai-local\knowledge\reconstruction\`
- Authority 只读缓存：`<SwapRepo>\.ai-local\knowledge\reconstruction\authority-cache\<AUTHORITY_SHA>\`
- Candidate + manifest 路径以 CURRENT Task 精确 WRITE_SCOPE 为准。

`<SwapRepo>` 必须从 Agent 已打开的 Swap 工作区唯一证明。不能凭猜测或扫描整盘替代。

## 5. 权威与证据边界

Framework Charter/accepted ADR/Contract 优先，但本支线不拥有主线 Runtime/Context/Policy/Verification System/Learning 语义。代码证明当前实现；官方设备/MML/Feature 文档证明有适用范围的设备事实；旧 Wiki 只是 clue。

Knowledge 正文/原始资料/完整 Git 差异和私有报告只在本机存储；GitHub 远端只接收脱敏短状态。现有旧 B2 PASS 仅绑定其历史 subject。当前F0 实施者只能声明 `IMPLEMENTED_CANDIDATE` / `NO_CHANGES_NEEDED`，KB-F1 由不同 actor 进行独立复核；F1 APPROVED 也不意味着 `BASELINED` 或 `PUBLISHED`。

## 6. 下一门禁

候选实现或确认无需改动 → `KB_F0_INDEPENDENT_CANDIDATE_REVIEW`：对候选实际内容、旧 findings、B2/B3 关键边界做一次 current-subject 的独立验证，再决定是否发布到正式双仓。

上一轮 F0 的旧 Authority cache 缺失或历史 B2 新目录不存在，均不能单独作为 F1 BLOCKED 的理由。审查者必须先读取实际 F0 build manifest，未修改的知识仓不强制要求 candidate worktree。

## 7. Authority 单文件获取

严禁 clone、fetch、pull、checkout Framework 仓库或下载 ZIP/archive。给定 exact 40-char SHA，仅从 Raw GitHub 逐文件下载 `authority-index.md`、本 CURRENT Task 及 Task 明确需要的 `architecture/overall-design-v1.md`、`operations/authority-sync.md`；落到既有 `.ai-local\knowledge\reconstruction\authority-cache\<AUTHORITY_SHA>\`。不得预下载 Framework 其他目录。

## 8. 历史入口

收入工具中的旧 `docs/swap-knowledge-reconstruction/` 已 `SUPERSEDED`；旧 LLM Wiki 线索非权威；`.ai-local/knowledge-reconstruction/` 是曾误用的路径，现有长期治理根继续为 `.ai-local/knowledge/reconstruction/`。
