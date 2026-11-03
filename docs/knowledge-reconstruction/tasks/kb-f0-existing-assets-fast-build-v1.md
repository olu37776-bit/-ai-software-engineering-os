# KB-F0：已有知识资产快速整合与候选基线建设 V1

状态：`CURRENT TASK / CANDIDATE IMPLEMENTATION ONLY`
跟踪：Issue #112。上位设计：`docs/knowledge-reconstruction/architecture/overall-design-v1.md`。

## 0. 决策与纠错

本任务取代此前 B2 → B3 的错误硬前置门禁。用户报告唯一可见的 B2 本地 Review 位于 `<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\batch-2-v1\`，旧审查绑定 `3b25e85...`（仅已知前缀，完整 SHA 由本地实际 Artifact 取得）。

**禁止要求存在** `reviews\batch-2\f2e4e473...\` 或对应旧 Authority SHA cache。后者是前次聊天任务设计的预期输出，不是已存在的事实。目录缺失只表示这次新 Review 尚未形成，不能因此判旧 B2 Review 不存在或失效。

KB-R0 本地 reconciliation 的状态、旧 B2 Review/Remediation、Convention、Golden Slice、B2/B3 Knowledge Repo 当前页面均作为现存事实源。状态冲突时明确 `HISTORICAL_SUBJECT_UNBOUND`；不要创建一个空的旧 Review 目录假装补证。

本轮核心不是再审一遍已有文档，而是**先用现有知识资产做出可导航、可维护的候选知识切片**，再将候选一次性交给独立 Reviewer，严格区分 `IMPLEMENTED_CANDIDATE` / `VERIFIED` / `PUBLISHED`。

## 1. 固定位置与前置

- 当前 Agent 工作目录必须可证明是 Swap 项目根；长期治理根 `<SwapRepo>\.ai-local\knowledge\reconstruction\`。
- 项目知识仓 `D:\gbrain-knowledge\swap-kb\`。
- 领域知识仓 `D:\gbrain-knowledge\microwave-kb\`。
- Raw Sources `D:\swap-knowledge-sources\`，只读。
- 当前 Authority cache `<SwapRepo>\.ai-local\knowledge\reconstruction\authority-cache\<AUTHORITY_SHA>\`。

只检查上述已知路径与它们内部的 relevant manifests、reviews、pages；不得扫描整盘找另一套目录。历史路径根据实际本地记录定位，**不得猜测固定 Batch 目录必须存在**。

先读取：

1. KB-R0 的现有 `state-manifest.json` / `state-reconciliation.md`（若存在）；
2. `<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\batch-2-v1\` 中实际 Review/Findings/Subject（不要预设文件名）；
3. Convention V1、Golden Slice、已有 B2/B3 Reconstruction/Remediation/Review 实际清单；
4. 两个 Knowledge Git Repo 的 HEAD、branch、dirty 状态、当前 B2/B3 页面；
5. 关联的当前 Swap code/config 与正式原资料（只读、仅证据需要的目标）。

如果 `batch-2-v1` 审查完整可定位，记录其 Reviewed Subject、Decision、Findings、Remediation 链；不把旧 `3b25e85...` 直接当当前 HEAD PASS，也不凭旧 Authority cache 缺失判无效。若旧报告缺失，记录 `HISTORICAL_REVIEW_NOT_LOCATED`，**继续允许仅做来源充分的候选内容建设**，但禁止声称历史 Finding 已关闭。

## 2. 本轮具体交付（只做最有用的范围）

目标是从已有资产形成可读且有来源的最小使用闭环，不重建 Survey、不重造平台、不重做已有效页面：

**Swap 项目导航主线：**

`实际源输入（NCE Log 或 Device DB） → Source MML → SwapParam / UI 目标选择 → SwapService#doTransfer → *Module / AbstractTransfer → 设备特化/配置处理 → result merge → JNI/C++/cfg.ini GET→SET → SET output boundary`。

**本轮必需包含的五类信息：**

1. Swap 入口/导航：能从一处进入源输入、Core Processing、重要异常、Raw Source/Evidence、相关 microwave 领域页面；已有导航达标则直接复用。
2. NCE Log 路径：GET MML 从日志采集/读取/规范化的实际代码链、适用范围、Known/Unknown；不猜 parser 名称。
3. Device DB 路径：legacy C++ parser 与 Java supplemental parser 的真实责任、汇合与覆盖空白；与后段 C++ GET→SET 不能混淆。
4. B2 接口：Source MML 被哪个实际 API/变量/结构消费；`SwapParam` 与模块所有权等已有 B2 事实不被重复改写成第二个 Primary Home。
5. 代表性查找路径：一个“新增设备/版本/Feature 适配”问题可以沿链接定位配置约束、源路径、处理责任及待确认点；找不到来源的点明确 Unknown。

如果 B2/B3 已有可靠页面，优先**只补链接、缺失证据或最关键的导航**。不要为了达到文件数量新建页面。界面、Feature、MML、Module、Source MML 都不应靠命名相似自动关联；引用需说明方向/适用条件。

## 3. 精确写范围与工作树保护

本轮只允许修改**与正式 Knowledge Source 分离的本地 Candidate Git worktree**。不得直接更改正式 Source 当前分支/工作树，不能让候选被 GBrain 正式索引自动消费。

实施前冻结一个私有 manifest：

`<SwapRepo>\.ai-local\knowledge\reconstruction\builds\kb-f0\<AUTHORITY_SHA>\candidate-scope.json`

其中必须列明：`authoritySha`、两个正式 Knowledge Repo 的 baseline HEAD、当前 dirty 状态、B2/B3 actual artifact refs、candidate worktree 路径、精确待改 Markdown 相对路径、每个路径 CREATE/UPDATE/SKIP、理由、主事实页与来源。最多 10 个 Markdown 目标文件，最多新建 3 个；超过必须停下返回 `NEED_SCOPE_EXTENSION`，不得无限扩大。

候选路径仅可在：

`<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-f0\<AUTHORITY_SHA>\swap-kb\`

`<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-f0\<AUTHORITY_SHA>\microwave-kb\`

对每个需要修改的 Source，先核对它是本地 Git Repo，并从明确的 baseline HEAD 通过 `git -C <officialRepo> worktree add -b <unique-kb-f0-branch> <candidatePath> <exact-HEAD>` 创建**独立候选 worktree**。该命令只作用于本地 Knowledge Repo；**不得对 Framework 仓库执行 clone/fetch/pull/checkout**。已存在候选路径不得覆盖，必须先核验相同 Authority+base subject 或停。

若 Source 工作树存在相关未提交知识改动，优先停止对应页面的修改并记录 `DIRTY_RELEVANT_TARGET`；不提交、不 stash/reset 正式 Repo。只改 `candidate-scope.json` 中批准路径；候选可以 `git add <exact paths>` 和提交到本地 candidate branch，绝不 merge/push 正式知识仓。

若不能安全创建独立候选 worktree，不回退为直接写正式 Source，记录 blocker；仍可完成可只读的 inventory/nav plan，但不能报告 candidate implementation 完成。

完整本地文件、编排报告可写：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\builds\kb-f0\<AUTHORITY_SHA>\candidate-scope.json
<SwapRepo>\.ai-local\knowledge\reconstruction\builds\kb-f0\<AUTHORITY_SHA>\build-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\builds\kb-f0\<AUTHORITY_SHA>\candidate-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\builds\kb-f0\<AUTHORITY_SHA>\smoke-checks.md
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-f0\<AUTHORITY_SHA>\swap-kb\...
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-f0\<AUTHORITY_SHA>\microwave-kb\...
```

除上述和 Authority cache 外，其余本地治理目录、正式知识、Swap code、Raw Sources 一律只读。

## 4. 轻量验证，不重复整批审查

实施者至少执行：

- 检查所有改动都属于已冻结的 10 文件以内目标；对比 Git baseline diff，所有未预期文件为零。
- Markdown 语法/必要 frontmatter、相对链接、primary-home/alias、证据定位检查；链接指向真实页面/明确 Source ID，不凭空造 GBrain graph behavior。
- 每个 Current Truth 都有能定位的源码或官方资料/历史经独立 Review 的证据；历史 Evidence 绑定旧 HEAD 时只能称历史依据，当前表述单独核验。
- 五类信息可以从候选入口实际阅读定位（无需 GBrain 重建索引）；Unknown 示例不能被写成已支持。
- 记录 Candidate worktree commit（若有改动）、正式 Source 原始 HEAD、文件 hashes、改动清单、缺口。
- GBrain 只读检索只可用于**当前已索引正式内容**的现状检查；候选若未被真实索引，不得用正式查询结果当候选 PASS。

**本轮不执行 Independent Review，也不把自检叫 VERIFIED。** 新候选下一步统一受独立 Reviewer 检查，旧 B2 Findings 与 B3 问题只在相关 scope 中回归，不强制重新做完整 Survey 或重建已达标内容。

## 5. 禁止动作

禁止修改正式 `D:\gbrain-knowledge\swap-kb\`、`microwave-kb\` 工作树；禁止运行可能更新正式 GBrain DB/Source/index 的 sync/extract/reinit/write 等命令；禁止改 Raw Sources、Swap production code、正式 Baseline、历史 Reviews/Remediation；禁止自动 merge candidate 到正式 KB；禁止从 Framework clone/fetch/checkout 整仓、ZIP/archive 下载；禁止上传内部知识与完整 Evidence 到公共 GitHub。

对候选 Schema/Embedding/Graphiti/新增索引平台不建新基础设施；本机 CPU/内存条件不允许假定本轮必须先做 embedding。

## 6. 结论与唯一下一 Gate

若完成候选改动与 smoke checks：`IMPLEMENTED_CANDIDATE`，唯一下一 Gate：`KB_F0_INDEPENDENT_CANDIDATE_REVIEW`。

若现有页面已全部满足并且没有任何内容改动：`NO_CHANGES_NEEDED`，但仍记录现有 Knowledge HEAD 和可用性 Evidence，唯一下一 Gate：`KB_F0_INDEPENDENT_CANDIDATE_REVIEW`（独立确认现有内容后再谈发布）。

如目标证据不足或相关 worktree dirty：仅阻塞对应 Claim/文件；允许其他有证据目标继续。若没有安全有效的候选可产出：`BLOCKED_BY_LOCAL_STATE`，不得强行写正式知识。

## 7. 最终交付

报告必须包含：当前 Authority SHA、历史 B2 Review 真实路径/完整 Reviewed Subject、B2 historical verdict 是否可判断、B3 actual state、两知识仓 baseline HEAD、candidate HEAD、实际新增/修改/复用页面清单、五类导航覆盖、source evidence、smoke-checks、Unknown/Conflict 和唯一 next Gate。

**短回执仅如下：**

```text
KB_F0_BUILD_COMPLETE
decision: IMPLEMENTED_CANDIDATE | NO_CHANGES_NEEDED | BLOCKED_BY_LOCAL_STATE
legacy_b2_review: FOUND | INCOMPLETE | NOT_FOUND
candidate_pages: new=<n> updated=<n> reused=<n>
swap_candidate_head: <40-char-sha | UNCHANGED | NONE>
microwave_candidate_head: <40-char-sha | UNCHANGED | NONE>
next_gate: KB_F0_INDEPENDENT_CANDIDATE_REVIEW | BLOCKED_BY_LOCAL_STATE
```

如果无法识别 Swap Repo 或不能安全执行：

```text
KB_F0_BUILD_BLOCKED
reason: <不包含私有内容的一句话>
```

完成后停止，不自动进入独立审查和发布。
