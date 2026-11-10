# KB-BN-C3：优先 Gap 收口与增量维护实战

状态：`CURRENT TASK / BACKLOG-DRIVEN INCREMENTAL DELIVERY`；Issue #127。
上位设计：`docs/knowledge-reconstruction/architecture/overall-design-v1.md`。
发布门禁：`docs/knowledge-reconstruction/tasks/kb-p0-controlled-publication-v1.md`。
上轮：`docs/knowledge-reconstruction/tasks/kb-bn-c2-device-version-mml-impact-v1.md`。
Authority 下载：`docs/knowledge-reconstruction/operations/authority-sync.md`。

> 用户已报告 KB-BN-C2 `publication=PUBLISHED`、`index_subject=BOUND`、`next_gate=KB_BN_C3_PRIORITY_GAPS`。本轮**直接消费 C2 剩余问题并交付可用修复**，不要重复 C2 的 18 Case、全量 Survey、历史 B2/B3、F0/F1 或重新开发知识平台。所有原始证据必须由本地真实文件证明，用户口头回报不是文件 hash 或 Git pair 的替代。

## 1. 从确切已发布状态和剩余问题出发

仅使用已打开且能证明的 `<SwapRepo>\.ai-local\knowledge\reconstruction\`。正式双知识仓：`D:\gbrain-knowledge\swap-kb\`、`D:\gbrain-knowledge\microwave-kb\`；原始设备资料：`D:\swap-knowledge-sources\`（只读）。

读取 C2 本地 `baselines\kb-bn-c2\<C2_AUTHORITY_SHA>\published-baseline.json`、`publishing\kb-bn-c2\...\independent-publish-review.md` 和 `increments\kb-bn-c2\...\coverage-and-backlog.md` / `gap-register.json` / `query-cases.json`，以及已明确引用的 C1/C2 问题。C2 实际 Authority SHA 首选已生效的 `e9d76a23512eeb086ce45bc8bbb4c4bf880f153a`；如真实 C2 执行记录绑定另一 SHA，**只能按受证实的 manifest 引用确定**，不按文件名/mtime 猜。

确认独立 Published PASS、真实双 Git HEAD、正式两个 GBrain Source ID/path 与已完成索引的精确 subject 均一致；旧出版记录和当前状态冲突则 `BLOCKED_BY_BASELINE`。如果 C2 实际 `NO_CHANGE`，按其引用的上一已证明 baseline 继续。不得重复发布 C2。

## 2. 优先级排序和精确施工范围

只选择**真实 Backlog 中最有研发影响且具备代码/设备资料来源**的 5–8 个 Gap；实际可证明不足 5 个时可以更少，禁止凑数。先去重，按以下权重从高到低：

1. 已被 GBrain 错答/误导开发的**错误事实**，尤其设备/版本/板卡/端口/Feature 兼容与限制；
2. 会造成错误配置或遗漏的 MML 命令参数语义、GET→SET、DB/NCE Source MML 差异；
3. 设备/版本/MML 的实际变更影响链、`SwapParam`、`SwapService#doTransfer`、`*Module`/`AbstractTransfer`、设备特化 XML / `cfg.ini` 责任混淆；
4. 事实已经存在但导航或跨 `swap-kb` / `microwave-kb` Primary Home、aliases、links 不正确。

先将每个 Gap 分类：`CONTENT_INCORRECT | CONTENT_MISSING | NAVIGATION_BROKEN | RETRIEVAL_ONLY | SOURCE_UNKNOWN | OUT_OF_SCOPE`，记录 `gap_id / case_id / affected business path / device+version applicability / current wrong or missing answer / code or official MML evidence / owning page / priority / resolution`。纯 `RETRIEVAL_ONLY` 不可通过编造 Markdown 内容掩盖，也不得擅自触碰正式索引；`SOURCE_UNKNOWN` 必须明确缺少哪项证据，不能自动视为产品不支持。

实际知识归属：`swap-kb` 为前端/模块/Swap 转换与变更责任主家；`microwave-kb` 为命令、参数、设备型号、单板、端口、版本/Feature 语义主家。正确内容不复制两份；跨库维护可追溯链接。中文解释为主，MML、方法、型号原名不翻译。

## 3. 增量维护的最小可复用流程（不开发新平台）

为选出的 Gap 另外记录至少两条**真实存在证据**的变更/差异样本（例如设备版本约束变化、MML 参数改变、新单板规则；若无实际变更则明确 `NO_PROVEN_CHANGE_EVENT`，不得构造历史事件）。用统一结构保存：

```text
change_id | source_type=CODE|XML|MML_DOC|DEVICE_DOC | source_ref_or_commit
before_after_or_observed_diff | affected_feature_and_scope | affected_primary_home
candidate_pages | related_query_cases | evidence_needed | verification_result
```

目的仅是证明未来再次遇到同类差异时，能按 `source change → impact candidates → bounded evidence → knowledge update → review → publish` 更新。**不新增 watcher、daemon、自动定时任务、框架 Port、索引平台、数据收集服务或生产代码**；无源差异证据时只产出可复用模板与 Unknown。

## 4. 一轮编排完成实施与独立 Gate

**A / Triage + Evidence（可并行只读）**：最多两个只读 worker 从真实 C2 Backlog 和现有 Swap 源码/配置/正式设备/MML 文档取证，复现选中 Gap 的旧 GBrain 回答，冻结 `priority-gaps.json` 与目标 12–16 条回归/正反例 Query Case（若不足则按实际数量报告）。必须对关键错误给具体可复现来源，而不是“搜索不到所以补写”。

**B / Candidate（每仓唯一 writer）**：以正式已发布 Git Pair 建立隔离 Candidate Git worktree；只对 `priority-gaps.json` 已证实且属于 CONTENT/NAVIGATION 的页写入。先冻结 `candidate-scope.json`（base, target paths, primary home, cause, source evidence, create/update, hash）；本轮两仓合计**最多修改 10 个 Markdown、新增 3 个 Markdown**。Candidate HEAD 清洁提交、hash 和 diff 写入 `candidate-manifest.json`。已有经确认的同 subject 候选可复用；不因没有改动造空提交。禁止未审候选被 GBrain 正式 Source 自动消费。

**C / Independent Review（与 B 实施者不同）**：审查精确 Candidate HEAD、文件 hash/scope、每个 Gap 修复前后证据、设备和版本适用范围、两 Source MML 路径/转换后段边界、跨库链接、至少一个负例/正确拒答。P0/P1 和未合法豁免的 P2 阻断。独立 Reviewer 不修改页面；失败只写 Finding 和 `REMEDIATION_REQUIRED`；通过给 `C3_CANDIDATE_APPROVED`。若 `NO_CHANGES_NEEDED`，仍需独立核对真实 GBrain 结果与索引 subject 才可确认无变更。

**D / Controlled Publish（仅合并 Authority 后）**：只有本 Task 的 Authority 已并入 GitHub main、C 阶段独立 PASS、当前 candidate hash 与 approved subject 完全相同、正式双仓 clean、Git 可精确 `ff-only`、GBrain Source/path/index subject、消费者暂停/恢复机制和 P0 发布前置全部**重新证明**，才可把批准的 Candidate Commit 非破坏性提升正式仓并通过本机可验证的原生 GBrain Source 定向 Sync。未通过绝不能 reset/rebase/cherry-pick/force、改 Windows Owner/全局 ACL、重建数据库或直接更新正式页。双仓非原子发布遇到部分失败则保持消费隔离并报告 `PARTIAL_PUBLICATION_HOLD`。

**E / Independent Publish Check**：独立于 Candidate Writer 和 Publisher 的 Reviewer 核对正式双仓 Pair、Source 路径、GBrain 当前完成索引的精确 subject、选中 Gap 查询的修复后实测、正反例及对旧 Published Baseline 的继承。全部 PASS 才创建新 `published-baseline.json` 并恢复消费者。索引不能绑定时 `PUBLISH_HOLD`，不得以 sync exit 0 或 `tracked_branch` 猜测宣称成功。

同一轮可顺序执行 A→E，无需每阶段要求用户回复；不能满足独立性或安全 Gate 必须停止。**当前 Authority 仅处于 PR 而未合并 main 时，仅授权 A/B/C（隔离候选与独立验证），禁止 D/E 的正式知识仓 Git Promotion 与 live GBrain Sync。** 若候选批准后才合并，恢复须核对原本 current-subject hash 未变，再执行发布，不重做已通过的工作。

## 5. 唯一本地 WRITE_SCOPE

Governance 根以 `<SwapRepo>\.ai-local\knowledge\reconstruction\` 为前缀，仅允许新建：

```text
increments\kb-bn-c3\<AUTHORITY_SHA>\base-and-backlog.json
increments\kb-bn-c3\<AUTHORITY_SHA>\priority-gaps.json
increments\kb-bn-c3\<AUTHORITY_SHA>\query-regressions.json
increments\kb-bn-c3\<AUTHORITY_SHA>\change-delta-cases.json
increments\kb-bn-c3\<AUTHORITY_SHA>\candidate-scope.json
increments\kb-bn-c3\<AUTHORITY_SHA>\candidate-manifest.json
increments\kb-bn-c3\<AUTHORITY_SHA>\build-report.md
increments\kb-bn-c3\<AUTHORITY_SHA>\remaining-backlog.md
reviews\kb-bn-c3\<AUTHORITY_SHA>\independent-review.md
reviews\kb-bn-c3\<AUTHORITY_SHA>\findings.json
publishing\kb-bn-c3\<AUTHORITY_SHA>\preflight.json
publishing\kb-bn-c3\<AUTHORITY_SHA>\publish-report.md
publishing\kb-bn-c3\<AUTHORITY_SHA>\independent-publish-review.md
publishing\kb-bn-c3\<AUTHORITY_SHA>\recovery-plan.md
baselines\kb-bn-c3\<AUTHORITY_SHA>\published-baseline.json
```

Candidate 只能在以下独立 worktree 中写入 `candidate-scope.json` 准许的 Markdown（从最新正式 Published Pair 派生，单仓只允许一个 writer）：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-bn-c3\<AUTHORITY_SHA>\swap-kb\
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-bn-c3\<AUTHORITY_SHA>\microwave-kb\
```

正式 `D:\gbrain-knowledge\swap-kb\`、`D:\gbrain-knowledge\microwave-kb\` 和 GBrain 仅 D Gate 特许的精确 ff-only + Source 限定 Sync 可写；`published-baseline.json` 仅 E Gate PASS 可写。Swap production code、Raw Sources、旧 Review、历史 Published Baseline、Framework Runtime、学习层和验证系统不能改。公开 GitHub 不上传私有知识或 Evidence。

## 6. 完成判定、缺口回收和短回执

输出真实 `before/after` 检索、已修/保留 Gap 及其证据、设备/版本适用范围、两库 Primary Home、至少一个有效负例；`change-delta-cases` 显示真实变化与受影响页，不把空模板说成自动检测已经落地。`RETRIEVAL_ONLY` 与 `SOURCE_UNKNOWN` 单独列后续任务，不作为本轮知识内容已修复。

成功：`publication=PUBLISHED`、`index_subject=BOUND`、独立 Review PASS，所有已修改页都在正式发布且相关问答可验证；若无真实内容 Gap，则只有独立确认正式知识与索引正确后，才可 `NO_CHANGE`。失败保留精确 Gate 和恢复证据，不自动扩张第二批。

```text
KB_BN_C3_COMPLETE
baseline: BOUND | UNBOUND
priority_gaps: selected=<n> fixed=<n> deferred=<n>
regression_queries: passed=<n> partial=<n> wrong=<n> not_testable=<n>
change_delta_cases: evidenced=<n> unknown=<n>
candidate: BUILT | REUSED | NO_CHANGES_NEEDED | BLOCKED
independent_review: PASS | FAIL | NOT_RUN
publication: PUBLISHED | NO_CHANGE | APPROVED_NOT_PUBLISHED | PREFLIGHT_BLOCKED | PARTIAL_PUBLICATION_HOLD | PUBLISH_HOLD | NOT_STARTED
published_pair: <swap_sha>/<microwave_sha> | UNBOUND
index_subject: BOUND | UNBOUND | UNKNOWN
next_gate: KB_BN_C4_INCREMENTAL_MAINTENANCE | KB_BN_C3_REMEDIATION | KB_BN_C3_PUBLISH_RECOVERY | BLOCKED_BY_LOCAL_STATE
```

任务完成即停止，保留精确的剩余 backlog。C4 只针对已证实的重复变更维护痛点，不预设新建自动监控系统。
