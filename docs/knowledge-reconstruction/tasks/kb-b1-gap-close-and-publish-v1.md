# KB-B1-CLOSE：XPIC Gap 修补 → 独立验证 → 受控增量发布（单轮编排）

状态：`CURRENT TASK / GATED MULTI-ACTOR EXECUTION`
跟踪：Issue #121。
设计基线：`docs/knowledge-reconstruction/architecture/overall-design-v1.md`。
发布治理：`docs/knowledge-reconstruction/tasks/kb-p0-controlled-publication-v1.md`。
获取协议：`docs/knowledge-reconstruction/operations/authority-sync.md`。
前置 XPIC 实战 Authority SHA：`7027c026e535fd3a164d9cfed4a3f9206b07665f`；其 GitHub merge SHA `c4de5ad609254048a4dc369f36bbf63d6c6c0f57`。

> 本任务以最快路径完成**一个 XPIC 知识纵向切片**，而不是等下一次聊天才启动下一阶段。它可以在单次本地编排里顺序执行 Implementation → Independent Review → Controlled Publication → Independent Publish Check，但每个 Gate 的参与者、证据和失败停止条件依然独立。无需重复 Survey、B2/B3、F0/F1 或整库 review。

## 1. 准入：从真实本地 Gap 和发布基线开始

工作根只使用当前打开且能证明是 Swap 工程的 `<SwapRepo>\.ai-local\knowledge\reconstruction\`。正式双仓为：

```text
D:\gbrain-knowledge\swap-kb\
D:\gbrain-knowledge\microwave-kb\
```

Raw Sources `D:\swap-knowledge-sources\` 只读。Framework 远端 Authority 严禁 clone/fetch/pull/checkout 整仓；只能固定 SHA + exact path 单文件下载到既有 authority-cache。

只在 `<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-b1\7027c026e535fd3a164d9cfed4a3f9206b07665f\` 及其明确链接的产物读取前轮 B1 `query-cases.md`、`evidence-and-gaps.md`、`candidate-scope.json`、`candidate-manifest.json`、`build-report.md`、`smoke-checks.md`。缺失的可选构建产物可以跳过；必须找到可靠的至少一个 Gap、查询原始结果与对应出处。不能凭用户一句“有 Gap”编造 Finding，也不能因不存在候选就判任务失败——可以直接在本轮完成候选。

另读取本地 P0 `APPROVED_PUBLISHED_BASELINE` 及两仓精确 published commit pair、GBrain 两 Source 的真实路径/index subject，并核实当前仓 HEAD 与受控已发布基线的关系。如果实际 Index Subject 已偏移而无有效更新证据，不写候选/不发布，返回 `BLOCKED_BY_PUBLISHED_BASELINE`。

## 2. 只修本轮真正发现的 XPIC Gap

按照已存在的 B1 Gap 记录分级处理，先按 Code/Config/MML 原始资料核验，区分：

- `CONTENT_GAP`：真实实现有证据但知识漏写/错误；
- `NAVIGATION_GAP`：页面已有事实但入口/关系/Primary Home 不可达；
- `RETRIEVAL_GAP`：知识文件正确、GBrain 查询召回错误；**不得凭此改业务事实**，需隔离为检索/索引问题；
- `SOURCE_UNKNOWN`：源码/正式资料无法证明支持规则；仅可记录 Unknown，不能虚构代码行为。

XPIC 两种输入方式（数量自动分配 / 选择板卡、槽位、端口）及设备型号/版本/板卡/端口约束，属于目标调查范围，不代表所有目标设备都支持。必须确认前端与 `SwapParam`、实际负责的 Module、XML/Bean、MML、结果合并、JNI/C++/`cfg.ini` GET→SET 的职责边界。至少有一个正例和一个拒绝过度推断的负例。

只修 `CONTENT_GAP` / `NAVIGATION_GAP` 且能找到当前源码或正式设备文档依据的条目。`RETRIEVAL_GAP` 仅形成独立诊断，不能偷偷改 GBrain live index；`SOURCE_UNKNOWN` 只明确标注未知，优先复用已有页。不向生产代码写入任何内容。

## 3. A 阶段：候选实现（Implementer）

如果 B1 已有 candidate：读取 actual manifest、candidate worktree HEAD、相对路径/文件 hash，核实从 P0 published pair 派生、clean 且没有越界变更；符合即可复用，不重新生成。若 B1 已找出 Gap 但未建 Candidate，在以下本轮目录创建独立 Git worktree，**不得直接修改正式 Knowledge Repo**：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-b1-close\<AUTHORITY_SHA>\swap-kb\
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-b1-close\<AUTHORITY_SHA>\microwave-kb\
```

仅对有修改的知识仓创建候选 worktree；完整命名不得被正式 GBrain Source 解析/索引。不得覆盖已有候选/本地修改；`git -c safe.directory=<exact-trusted-path>` 可逐命令仅对可信本地 Knowledge Repo 使用，不修改系统 ACL/Owner 和全局 Git 信任。

实施前建立 `candidate-scope.json` 并冻结 page path、CREATE/UPDATE/SKIP、证据、Primary Home、正式基线 SHA、候选 worktree。上限：更新 **6 个** Markdown、创建 **2 个** Markdown；超出额度将剩余 Gap 写入 backlog，不扩大任务。最小改动修复重要 Gap，运行 Markdown/链接/证据/真实引用自检，将候选精确提交到独立分支。记录 reviewed-target candidate HEAD、file hash、Git diff 和自检结果；Implementer 只能宣称 `CANDIDATE_READY`，不能自评 Verified。

如果 B1 的全部 Gap 都是检索问题、Unknown 或无修改必要，允许 `NO_CONTENT_CHANGE`；仍要给出结构化检索诊断与实际知识内容已正确的证据，不制造空提交。

## 4. B 阶段：独立 current-subject 审查（Reviewer）

Reviewer 必须不是 A 阶段实际实施者；独立读取冻结后的候选/当前发布 subject，并针对原 B1 查询 Q1～Q5、对应 Gap、源码/配置、历史相关 Findings、Primary Home、两库链接和负例逐项确认。

检查：① 候选 Git diff 仅限冻结 scope；② 内容 Fact/Evidence/设备版本适用范围正确；③ `SwapParam`/Module/MML/最终 GET→SET 分工无混淆；④ 原 Gap 有实际解决证据；⑤ 明确划分知识事实缺口与仅检索问题；⑥ 自检/独立检查均未触碰 live GBrain；⑦ 当前受检 page hash/依赖闭合。

报告 P0/P1/P2/P3 Finding；P0/P1 和未合法豁免的 P2 阻塞。通过只给 `B1_CANDIDATE_APPROVED_CURRENT_SUBJECT`；有阻塞给 `B1_CANDIDATE_REMEDIATION_REQUIRED`。不允许 Reviewer 改写候选。如果审查没有独立 actor，`BLOCKED_BY_INDEPENDENCE`，并不得开始发布。

## 5. C 阶段：同轮受控正式发布（Publisher）

只有 B 阶段独立 PASS、且本 Authority **已合并并生效于 GitHub main**（需读取该任务本次 exact SHA 的 index 并能核实主线包含此授权）后，才允许进入发布。仅 PR 分支 SHA/CI 通过而未合并 main 时，不授权 promotion/sync；此时停在 `APPROVED_NOT_PUBLISHED`。

重新执行 P0 精确发布前置，而不是复制上次 READY：正式 repo current HEAD、clean 状态、被审 candidate HEAD、Git FF 可达性、GBrain Source→正式路径、index subject 证明、消费者阻断/维护窗口、受控恢复策略、独立发布 Reviewer。任何缺口返回 `PUBLISH_PREFLIGHT_BLOCKED`，保留旧正式索引和旧 Published Baseline，不强制 reset/cherry-pick/merge/rebase。

前置满足后按照 `tasks/kb-p0-controlled-publication-v1.md` 的保护条件，使用精确 approved commit 的非破坏性 `git merge --ff-only` 将有改动的正式知识仓提升到已审版本；两个仓不是原子更新，若部分失败必须持续隔离消费者、写 `PARTIAL_PUBLICATION_HOLD` 而不是自动强制回滚或继续 sync。

仅使用本机已证明安全、可限定 `swap-kb` / `microwave-kb` Source 的 GBrain 原生同步方法，绝不删除/reinit DB 或全局重建。两 Source 同步完成后保持消费者暂停，进入 D 阶段；不得仅凭退出码成功就宣布 Published。

## 6. D 阶段：独立发布确认（Publication Reviewer）

必须独立于 Publisher 的发布实施角色；可以由 B 阶段 Reviewer 承担，但不能由 A/C 实施者自证。

对比正式 Git commit pair、F1/P0 旧 baseline、B1 新 approved subject、GBrain Source path 与可证明的索引内容/同步 Ledger；实际运行 Q1～Q5 正反例并核对具体引用来源、返回的逻辑和 Unknown 处理。`tracked_branch=null` 不自动判失败，也不自动证明 Index Commit 绑定；没有完整可信绑定证据则 `PUBLISH_HOLD`，不写新的 Published Baseline。

独立发布 Gate PASS 后才生成新的增量 `published-baseline.json`，记录上一版本引用、目标 Commit Pair、Source/Index Subject、Query Evidence、审核结果，恢复消费者；本次事项才是 `B1_INCREMENT_PUBLISHED`。失败则保持隔离并输出恢复说明，不暗中恢复消费、也不伪造已发布。

## 7. 输出位置与 WRITE_SCOPE

只允许写入当前本地治理根下：

```text
increments\kb-b1-close\<AUTHORITY_SHA>\gap-triage.json
increments\kb-b1-close\<AUTHORITY_SHA>\candidate-scope.json
increments\kb-b1-close\<AUTHORITY_SHA>\implementation-report.md
increments\kb-b1-close\<AUTHORITY_SHA>\candidate-manifest.json
increments\kb-b1-close\<AUTHORITY_SHA>\smoke-checks.md
reviews\kb-b1-close\<AUTHORITY_SHA>\independent-review.md
reviews\kb-b1-close\<AUTHORITY_SHA>\findings.json
publishing\kb-b1-close\<AUTHORITY_SHA>\preflight-manifest.json
publishing\kb-b1-close\<AUTHORITY_SHA>\publish-report.md
publishing\kb-b1-close\<AUTHORITY_SHA>\independent-publish-review.md
publishing\kb-b1-close\<AUTHORITY_SHA>\recovery-plan.md
baselines\kb-b1-close\<AUTHORITY_SHA>\published-baseline.json
```

以及精确冻结的独立候选 worktree 内 Markdown，和 C 阶段严格授权的正式 Git FF / GBrain Source 增量 sync。`baselines/.../published-baseline.json` 只有 D 阶段 PASS 才允许创建。私有源码/知识页/Raw Sources/完整 Evidence 不上传公开 GitHub；禁止修改生产代码、主线 Framework、其他 Raw/Reviews/知识工作树。

## 8. 唯一最终回执

```text
KB_B1_CLOSE_COMPLETE
gap_count: confirmed=<n> resolved=<n> deferred=<n>
candidate: REUSED | BUILT | NO_CONTENT_CHANGE | BLOCKED
independent_review: PASS | FAIL | NOT_RUN
publication: PUBLISHED | APPROVED_NOT_PUBLISHED | PREFLIGHT_BLOCKED | PARTIAL_PUBLICATION_HOLD | PUBLISH_HOLD | NOT_STARTED
published_swap_head: <SHA | UNCHANGED | NONE>
published_microwave_head: <SHA | UNCHANGED | NONE>
gbrain_index_subject: BOUND | UNBOUND | UNKNOWN
next_gate: KB_BN_NEXT_REAL_USE_CASE | KB_B1_REMEDIATION | KB_B1_PUBLISH_RECOVERY | BLOCKED_BY_LOCAL_STATE
```

成功必须 `independent_review=PASS`、`publication=PUBLISHED`、`gbrain_index_subject=BOUND` 且新正式 baseline 存在。否则不得称“已完成发布”。若只有检索问题无法由知识文档解决，下一 Gate 应是有明确 Evidence 的检索/索引专项修复，不把它混同知识内容修补。

完成后停止；若任何阶段失败，保留原始报告和清晰下一 Gate，不重复历史 Survey。
