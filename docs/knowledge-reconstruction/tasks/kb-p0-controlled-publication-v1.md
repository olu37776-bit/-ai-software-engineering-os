# KB-P0：双知识仓基线对齐与 GBrain 受控发布 V1

状态：`CURRENT TASK / GUARDED PUBLICATION`；Issue #115
上位设计：`docs/knowledge-reconstruction/architecture/overall-design-v1.md`。
F0 实施 Authority：`63dc7a89628d84487f13a7bc5981fb5693c602ee`。
F1 独立审查 Authority：`474e04590250b969d66824a426fbc8f300e482af`。

> 目标是**一次性完成真实的 preflight → 正式知识 Git Promotion → GBrain Index 发布 → 独立发布核验 → 联合 Baseline 记录**。每步必须与 exact subject 绑定。前置不能证明即停止，不得借“加快进度”跳过保护；亦不得因旧 B2 SHA cache 或不存在的新 review 目录错误阻塞。

## 1. 本轮授权与边界

用户回报 F1 决策 `F1_APPROVED_CANDIDATE` 且 `next_gate=KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION`。这只是开始 KB-P0 的路由，不代表 F1 Evidence 已由远端验证或候选已发布；本地必须从真实报告确认。

正式知识 Git Repo 预期路径：

- `D:\gbrain-knowledge\swap-kb\`
- `D:\gbrain-knowledge\microwave-kb\`

本地治理根：`<SwapRepo>\.ai-local\knowledge\reconstruction\`。`<SwapRepo>` 必须是 Agent 已经打开且可证明的 Swap 项目根，不全盘搜索。
正式 Source IDs 预期 `swap-kb`、`microwave-kb`。预期路径与真实 GBrain Source 绑定必须双向校验，不按配置名称猜路径。

本任务允许在严格通过前置门禁后，受控更新正式知识仓 branch/工作树到**已经独立批准的精确 Candidate Commit**，并使用本机已验证的 GBrain 原生正式同步操作发布。不得修改未审知识内容、生产代码、Raw Sources，不得将私有报告或 Knowledge Page 上传到公开 GitHub。

## 2. 必须先读的既有本地 Evidence

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\builds\kb-f0\63dc7a89628d84487f13a7bc5981fb5693c602ee\candidate-scope.json
<SwapRepo>\.ai-local\knowledge\reconstruction\builds\kb-f0\63dc7a89628d84487f13a7bc5981fb5693c602ee\candidate-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\builds\kb-f0\63dc7a89628d84487f13a7bc5981fb5693c602ee\build-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\builds\kb-f0\63dc7a89628d84487f13a7bc5981fb5693c602ee\smoke-checks.md
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\kb-f1\474e04590250b969d66824a426fbc8f300e482af\review-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\kb-f1\474e04590250b969d66824a426fbc8f300e482af\findings.json
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\kb-f1\474e04590250b969d66824a426fbc8f300e482af\subject-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\kb-f1\474e04590250b969d66824a426fbc8f300e482af\navigation-checks.md
```

只在上述已知父目录根据实际 manifest 定位同义文件；不能凭空填补缺失结果。先验证 F1 真正由独立于 F0 实施者的 Reviewer 完成、`decision=F1_APPROVED_CANDIDATE`、`next_gate=KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION`、P0/P1=0，P2 有明确合法处置，且报告包含完整受审页面/Commit/Hash。旧 `reviews\batch-2-v1\` 可以作为历史 Evidence，不能自动把旧 HEAD 的 PASS 当作本次 F1 PASS。

若 F0 为 `NO_CHANGES_NEEDED`，本轮目标 Commit 为 F1 验证过的正式知识 HEAD；**不要要求 candidate worktree 或新的 Git Commit**。若 F0 为 `IMPLEMENTED_CANDIDATE`，从 F1 subject 取实际 candidate Git HEAD；只对有改动的仓库要求相应 candidate worktree。

## 3. 先写 PREPARED / 发布计划（不改正式源）

冻结以下字段并形成 preflight manifest：

```text
authoritySha, f0AuthoritySha, f1AuthoritySha, f1ReviewDecision, reviewActor
sourceIdsAndResolvedAbsolutePaths
swapKbOfficialCurrentHead, microwaveKbOfficialCurrentHead
swapKbReviewedTargetHead, microwaveKbReviewedTargetHead
currentBranches, detachedState, worktreeStatus
candidateWorktreesAndHeads, reviewedPageHashes, crossKbRefs
previousPublishedPair, previousGbrainIndexSubjectOrUnbound
gbrainVersionAndReadOnlySourceInfo
publicationPlan, pauseConsumersProof, rollbackOrRecoveryPlan
```

具体条件：

1. 两个正式仓均为预期 Git Repo/实际路径，无不明未提交、未跟踪改动（dirty 则本轮停止，不 stash/reset/clean）。记录 HEAD/branch，并证明与 F0/F1 的 frozen base/target 之间的关系。
2. candidate worktree 与正式 Source 目录不同；有修改的 candidate HEAD 必须等于 F1 已审 HEAD，工作树必须 clean；候选页 hash/变更路径须与 F1 subject 完全一致；无额外未审提交。
3. 只有目标 commit 是当前正式 HEAD 的后继且可以在无冲突、无丢失修改的条件下精确 fast-forward，才允许 promotion。若需要 rebase、cherry-pick、merge commit、reset 或覆盖，则 `BLOCKED_BY_PUBLISH_SUBJECT_DIVERGENCE`，不自动改写被审 subject。
4. 正式 GBrain Source ID / path /可读取索引版本已核对；如果 GBrain 实际 Source 指向候选目录或存在不明自动索引，标记 `SOURCE_BINDING_UNSAFE`；先记录、阻止发布，不顺手重建 Source。
5. 明确受控维护窗口或能够阻止普通 Agent 消费未完成索引的措施；操作前保存/引用现有可合法恢复的配置和索引状态，记录恢复手段。若不能保证双仓更新期间不会消费半发布状态，停止在 `PREFLIGHT_BLOCKED`。
6. 查询候选/正式知识中实际被审的链接与文件范围必须仍一致；旧 F1 PASS 不得跨新的 B2/B3 相关修改继承。

preflight 满足才宣称 `PREPARED`。如果旧正式 Index Commit 无元数据，标为 `INDEX_SUBJECT_UNBOUND`；这不是自动允许删除或重建数据库的理由，若无法建立有证据的发布/恢复计划则停止。

## 4. 一轮受控 Git Promotion

只有 `PREPARED` 后执行。对有改动的正式仓库，基于 frozen official HEAD 和已批准 candidate target，使用非破坏性的 Git fast-forward（例如先验证 merge-base，再 `git merge --ff-only <EXACT_APPROVED_CANDIDATE_SHA>`），严禁自动 reset/clean/rebase/force；未改动的仓保持原 HEAD。

两仓操作不是文件系统原子事务。同步前先确认完整的目标 Commit Pair 与前置 HEAD，逐仓验证更新后的 HEAD、工作树和页面 hashes 均等于预检目标；任何中途失败：立即维持消费者暂停，记录 `PARTIAL_PROMOTION_HOLD`，不得自动通过强制 reset 恢复，更不得继续 GBrain sync 或声称 BASELINED。

## 5. GBrain 受控同步与独立发布验证

先查看本机实际 GBrain CLI help/version/status；只能使用本机证实为**针对已批准两个正式 Source**的原生同步/更新方法。禁止猜测参数或使用 `reinit-pglite`、全库重建/删库、会改变未授权 Source 的命令。

在消费者保持暂停期间，按已证明安全的操作同步两个 Source 到目标内容；分别记录命令、退出结果、实际 Source path、索引状态/版本信息及输出日志。若其中一个失败，不发布联合 Baseline，继续暂停受影响消费，记录 `PARTIAL_INDEX_HOLD` 并生成精确恢复说明。

同步完成后由独立于 promotion 实施者的 Reviewer 运行只读验证（可在同一任务的明确独立 Agent 子阶段完成；不可由实施者自证）：

- 双仓正式 Git HEAD 精确等于 F1 已审 Target Pair，工作树 clean，受检文件 hashes 一致；
- `swap-kb` / `microwave-kb` Source 指向正式目录而非 Candidate；索引内容是否能绑定目标 Commit Pair 有可核实证据；
- 代表性查询/文件导航：NCE GET Log 路径、Device DB→C++/Java→MML、Source MML 与 B2 接口、实际设备/Feature/版本约束、跨库导航及一个 Unknown/负例；记录实际结果与期望，而非只看命令成功；
- 受检索引不得暴露未批准 Candidate 页面；若只读证据无法证明目标 Index subject，不能报 `PUBLISHED`；
- 验证完成才恢复消费。

如果 GBrain 版本没有可确认的 index-subject binding，允许记录原生查询和 Source 映射等现有证据，但不能编造绑定或从 mtime 推断。若这一缺口影响 `PUBLISHED` 的正确性，保持 `INDEX_SUBJECT_UNBOUND`，结果为 `PUBLISH_HOLD`，不要伪称全链路完成。

## 6. 唯一写入范围

除精确单文件只读 Authority cache，允许下列本地报告：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-p0\<AUTHORITY_SHA>\preflight-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-p0\<AUTHORITY_SHA>\publish-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-p0\<AUTHORITY_SHA>\promotion-evidence.json
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-p0\<AUTHORITY_SHA>\source-index-evidence.md
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-p0\<AUTHORITY_SHA>\independent-publication-review.md
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-p0\<AUTHORITY_SHA>\recovery-plan.md
<SwapRepo>\.ai-local\knowledge\reconstruction\baselines\kb-p0\<AUTHORITY_SHA>\published-baseline.json
```

`published-baseline.json` **只在**全部独立发布 Gate 通过后创建，记录 exact pair、当前 GBrain source/index binding、F1 审查 subject、发布校验与先前基线；不得在预检或部分发布时创建它。

对两个正式知识仓仅允许执行第 4 节的 exact-head 非破坏性受控 promotion；对 GBrain 仅允许第 5 节经证实的 Source 同步。除这些精确受控动作外，禁止编辑正式知识、Raw Sources、Swap production code、历史 Review/Baseline、GBrain Schema/DB 或上传任何私有 Artifact 到 GitHub。

## 7. Decision 与后续

只有 `APPROVED_PUBLISHED_BASELINE` 才允许恢复正式消费并声明双知识仓联合 Baseline 可用，此状态必须有真实独立发布验证。若还未修改任何正式内容且前置失败，输出 `PREFLIGHT_BLOCKED`；若中途产生部分变更，输出 `PARTIAL_PUBLICATION_HOLD` 并保留报告、隔离消费；若只完成同步但独立验证或 Commit Binding 失败，输出 `PUBLISH_HOLD`，不记录正式基线。

成功后的唯一下一 Gate：`KB_BN_INCREMENTAL_KNOWLEDGE_MAINTENANCE`。其余均 `KB_P0_REMEDIATION_OR_RECOVERY` 或 `BLOCKED_BY_LOCAL_STATE`，必须是后续另行授权的准确范围。

## 8. 最终短回执

```text
KB_P0_PUBLISH_COMPLETE
decision: APPROVED_PUBLISHED_BASELINE | PREFLIGHT_BLOCKED | PARTIAL_PUBLICATION_HOLD | PUBLISH_HOLD
swap_head: <40-char-sha>
microwave_head: <40-char-sha>
gbrain_sources: BOUND | PARTIAL | UNBOUND | UNKNOWN
index_subject: BOUND | INDEX_SUBJECT_UNBOUND | UNKNOWN
independent_publish_gate: PASS | FAIL | NOT_RUN
next_gate: KB_BN_INCREMENTAL_KNOWLEDGE_MAINTENANCE | KB_P0_REMEDIATION_OR_RECOVERY | BLOCKED_BY_LOCAL_STATE
```

如无法识别 Swap Repo/必要 F1 Evidence：

```text
KB_P0_PUBLISH_BLOCKED
reason: <一句不包含内部敏感信息的原因>
```

结束后停止，不自动开始新一批知识建设。
