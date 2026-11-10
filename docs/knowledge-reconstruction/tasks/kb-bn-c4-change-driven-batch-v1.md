# KB-BN-C4：真实变化驱动的批量增量知识维护

状态：`CURRENT TASK / CHANGE-DRIVEN BATCH`；Issue #129。

支持文档：
- `docs/knowledge-reconstruction/architecture/overall-design-v1.md`
- `docs/knowledge-reconstruction/tasks/kb-bn-c3-priority-gaps-v1.md`（历史 C3）
- `docs/knowledge-reconstruction/tasks/kb-p0-controlled-publication-v1.md`（正式发布安全 Gate）
- `docs/knowledge-reconstruction/operations/authority-sync.md`（固定 SHA、单文件下载）

> C3 用户回报 `publication=PUBLISHED`、`index_subject=BOUND`、下一阶段 C4 Batch。C4 不再增加一轮通用 Survey，也不开发新的知识平台；**一轮批量处理多个确有证据的来源变化**，证明未来可通过同样的机制持续维护知识。

## 1. 本轮起点：确切 Published Pair 与变化证据

本地 `<SwapRepo>` 必须是当前已打开且已证明的 Swap 项目；知识治理根固定 `<SwapRepo>\.ai-local\knowledge\reconstruction\`。正式 Git 知识仓：

```text
D:\gbrain-knowledge\swap-kb\
D:\gbrain-knowledge\microwave-kb\
```

原始资料只读 `D:\swap-knowledge-sources\`。

只读读取 C3 真正通过独立发布的 `baselines\kb-bn-c3\58526ac8fe65fbe12ff6ecaee0258ffd311a6bf5\published-baseline.json` 及相关 `publishing\kb-bn-c3\...\independent-publish-review.md`，如本机 C3 subject 的实际 Authority 路径不同，必须由 C3 manifest 与签实的本机 Evidence 确认，不能按文件名时间选“最新”。冻结正式双知识仓 `HEAD`、GBrain Source ID 与完整路径、已同步 Index Subject、上一批核准的 Query Evidence 和 Backlog。若 C3 的确切 Published Pair / 当前索引不一致，`BLOCKED_BY_BASELINE`，不继续 candidate 或发布。

复用 C3 `increments\kb-bn-c3\...\change-delta-cases.json`、`remaining-backlog.md`、C2 影响导航；不重复 C1/C2/C3 的已通过查询及历史 Review。**本批输入是真实发生且可重新取得的差异/变更**：Swap Git 中明确 base→target 的 commit range、实际项目 XML/cfg.ini 配置差异、具有历史版本对照的 MML/设备正式资料；对 Raw Source 文件需要确切旧版本/Hash 才可证明变化。没有旧版本只能写 `NEW_OR_UNDATED_SOURCE`，不能捏造 before/after。

## 2. 批次目标与变化类型

在上一轮已证实线索中选择 **3–6 条真实 source change / gap 事件**（少于 3 条则用实际数量；没有可靠变化只做可证的 backlog gap，标 `NO_PROVEN_SOURCE_DELTA`）。优先覆盖不同类型：

- Swap Java 或 JNI/C++ 实际处理变化：`SwapParam`、`SwapService#doTransfer`、`*Module`/`AbstractTransfer`、源数据入口及结果转换责任；
- 设备/XML/硬件限制、目标软件版本或板卡/槽位/端口与 Feature 兼容条件变化；
- Source MML 命令/参数、NCE GET 与 DB（legacy C++ + Java supplemental）→Source MML、`cfg.ini` GET→SET 的可证差异；
- 已有知识内容/跨库链接受上述真实变化影响的情况，及 C3 明确遗留的严重错误事实。

**变化类型并不等于每一种都真实发生。** 只选择有原文件、旧/新对照或 commit diff、适用设备/版本和责任证据的事件。每个事件记录 `change_id, source_ref_before, source_ref_after, evidence_hash, changed_paths, affected_feature/device/version, candidate_pages, impact_confidence, uncertainty_reason`。引用当前源码只证明现状，不能冒充历史差异。

把 `CONTENT_CHANGE`、`NAVIGATION_GAP`、`RETRIEVAL_ONLY`、`SOURCE_UNKNOWN` 和 `NOT_APPLICABLE` 分开。检索差且知识页正确，不偷偷更改正式 GBrain 索引或编造业务 Claim；无来源的规则用 `UNKNOWN` 并列确切补证要求。

## 3. 变化定位的可重复机制（轻量，不建新平台）

对每条已证明的变化，使用本机已有 git diff、文件比对、代码搜索和知识页索引/引用查找，执行：

```text
real source diff → changed symbol/MML/Feature/device/version →
bounded candidate knowledge pages → verified provenance →
isolated candidate diff → independent review → guarded publication
```

保存**结构化 impact map**，每条至少列出来源差异、直接知识 Primary Home、跨仓引用/受影响页、相关 Module/Scenario、回归 Query Case、置信依据和 Unknown。对每条变化至少给一个**相关正例或拒答负例**；批次执行 **8–12 条**可复现实测 Query Case（若证据不足则按实际列 `NOT_TESTABLE`，不能编造 12 条），在发布前和发布后对照。

明确检测质量：`changes_seen`、`changes_mapped`、`impacted_pages_confirmed`、`false_positive`、`missed_by_method`（至少审阅一个相关未召回但源码有依赖的负向对照，如没有可用样本则 `UNKNOWN`）、`wrong_or_unsupported_answers`、剩余 backlog。不得写虚假 100% recall / zero false positives。

若需复用自动化，可在本次本地治理写范围内编写**一次性按需调用的只读离线脚本**汇总显式输入的 Git commit/file hashes 与候选路径；禁止常驻 watcher、定时扫描全仓、后台服务、自动修改 live Source、跨库数据库、依赖重装或新平台。可不写脚本，优先用现有 CLI。

## 4. 单轮 A→E；可并行取证，不并行合并 Knowledge Git

**A — DIFF & IMPACT（只读）**：最多两个 worker 对真实变更、C3 回归和剩余高价值 Gap 并行取证；验证 `before/after`/hash，冻结 `change-events.json`、`impact-map.json`、`query-cases.json`。所有 Search/Query 必须只读正式已发布 GBrain。一个源缺少 before/after 时可以登记为无法证明，不拖垮其他真实变化。

**B — SINGLE-WRITER CANDIDATE**：从 C3 Verified Published Pair 创建两个知识仓中实际有改动的独立 candidate Git worktree；每仓**单一 writer**、一个最终集成 HEAD。先冻结 `candidate-scope.json` 与所有目标页、Primary Home、base/target、原始证据及 hash。两仓合计最多更新 **10 个 Markdown**、新增 **3 个 Markdown**；只修已验证的错误事实、必要限制、实际导航缺口，不能自动生成无证据兼容矩阵。验证 Markdown/相对链接/aliases/Device+Version 边界/负例，提交清洁 candidate HEAD 并记 diff/hash。若没有内容缺口可 `NO_CHANGES_NEEDED`，不制造空提交。

**C — INDEPENDENT REVIEW**：独立于 A/B 知识实施者的 Reviewer 检查冻结 candidate HEAD、文件 hash、变更映射的漏检与误报样本、全部新 Claim 的源码/设备/版本证据、Query 正反例、跨库 Primary Home 与全部实际改动。P0/P1/未合法豁免的 P2 阻断；Reviewer 不改候选，结果 `C4_CANDIDATE_APPROVED | C4_REMEDIATION_REQUIRED | C4_REVIEW_BLOCKED`。旧 C3 审核不自动继承新 HEAD。

**D — GUARDED PUBLISH**：仅在本 Authority **确实合并生效于 GitHub main**、C PASS 且 exact candidate hash 未变、正式 Git 工作树 clean、到批准 HEAD 可 `git merge --ff-only`、两个 GBrain Source/path/索引 subject 受证实、消费者可确实阻断、恢复方案存在、P0 发布安全前置重新 PASS 时执行。正式仓只允许批准 subject 的非破坏性 ff-only，GBrain 仅用本机支持且可证明的 Source 定向同步；禁止 reset、force、rebase、cherry-pick、全局放宽 Git trust、自动修改 NTFS ACL、GBrain DB reinit 或全库重建。双仓非原子更新部分失败时停止/保持消费隔离，报告 `PARTIAL_PUBLICATION_HOLD`。

**E — INDEPENDENT PUBLISH GATE**：独立于发布执行者的 Reviewer 检查正式 pair、实际 GBrain index subject、8–12 Query 的正反例、影响导航及回归（包括旧问题不退化）。只有 PASS 才写新的 `published-baseline.json` 并恢复消费者。未验证完整索引 subject 则 `PUBLISH_HOLD`；不能仅凭 Sync exit 0 宣称发布成功。没有内容变更须由独立 Reviewer 证明原 Published Pair/index 和问答已正确，仅允许 `NO_CHANGE`，不伪造新发布。

上述 A→E 是**同一次本地任务编排**，不为每个变化单独创建 Issue/PR/Review；必要的 Actor 独立性和每阶段 Fail-Closed 仍保留。PR 未合并 main 时，只允许 A/B/C，不允许 D/E。每次恢复先读取同一 subject 的已完成 Evidence，复用合法结果，禁止重复构建/审查。

## 5. 唯一 WRITE_SCOPE

本地治理根 `<SwapRepo>\.ai-local\knowledge\reconstruction\` 下，只允许新建：

```text
increments\kb-bn-c4\<AUTHORITY_SHA>\base-and-backlog.json
increments\kb-bn-c4\<AUTHORITY_SHA>\change-events.json
increments\kb-bn-c4\<AUTHORITY_SHA>\impact-map.json
increments\kb-bn-c4\<AUTHORITY_SHA>\query-cases.json
increments\kb-bn-c4\<AUTHORITY_SHA>\candidate-scope.json
increments\kb-bn-c4\<AUTHORITY_SHA>\candidate-manifest.json
increments\kb-bn-c4\<AUTHORITY_SHA>\build-report.md
increments\kb-bn-c4\<AUTHORITY_SHA>\coverage-and-backlog.md
increments\kb-bn-c4\<AUTHORITY_SHA>\read-only-diff-helper.ps1
reviews\kb-bn-c4\<AUTHORITY_SHA>\independent-review.md
reviews\kb-bn-c4\<AUTHORITY_SHA>\findings.json
publishing\kb-bn-c4\<AUTHORITY_SHA>\preflight.json
publishing\kb-bn-c4\<AUTHORITY_SHA>\publish-report.md
publishing\kb-bn-c4\<AUTHORITY_SHA>\independent-publish-review.md
publishing\kb-bn-c4\<AUTHORITY_SHA>\recovery-plan.md
baselines\kb-bn-c4\<AUTHORITY_SHA>\published-baseline.json
```

脚本**可选**，必须先人工/独立检查其写入只限本次报告路径、读取只限已识别 source，绝不能运行时修改源/知识/GBrain 或新增任务计划；无需辅助脚本可直接跳过。

候选仅在以下隔离工作树，对 `candidate-scope.json` 冻结的 Markdown：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-bn-c4\<AUTHORITY_SHA>\swap-kb\
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-bn-c4\<AUTHORITY_SHA>\microwave-kb\
```

正式知识 `D:\gbrain-knowledge\swap-kb\`、`D:\gbrain-knowledge\microwave-kb\` 和 live GBrain 只允许 D/E 的明确受控写入。禁止修改 Swap 源码、XML、`cfg.ini`、Raw Sources、历史 Baseline/Review、Framework Runtime/主线 Learning/Verification System。正式知识与全部私有 Evidence 不上传 GitHub。

## 6. 完成标准与回执

真正成功意味着：可复现的变更事实与知识影响图、最小候选修改或明确无变更、独立审核、受控发布、实际 GBrain Query 回归和已证明的 Git Pair / Index Subject。至少给出一个正确命中的影响链、一个可证实的限制或拒答、一个误报/漏报检查样本（无法取样须报告 UNKNOWN），以及真正未解决的 Gap 排序。

```text
KB_BN_C4_COMPLETE
baseline: BOUND | UNBOUND
source_changes: evidenced=<n> unproven=<n>
impact: mapped=<n> confirmed_pages=<n> fp=<n|UNKNOWN> miss=<n|UNKNOWN>
query_cases: pass=<n> partial=<n> wrong=<n> not_testable=<n>
candidate: BUILT | REUSED | NO_CHANGES_NEEDED | BLOCKED
independent_review: PASS | FAIL | NOT_RUN
publication: PUBLISHED | NO_CHANGE | APPROVED_NOT_PUBLISHED | PREFLIGHT_BLOCKED | PARTIAL_PUBLICATION_HOLD | PUBLISH_HOLD | NOT_STARTED
published_pair: <swap_sha>/<microwave_sha> | UNBOUND
index_subject: BOUND | UNBOUND | UNKNOWN
backlog: <n>
next_gate: KB_CONTINUOUS_MAINTENANCE | KB_BN_C4_REMEDIATION | KB_BN_C4_PUBLISH_RECOVERY | BLOCKED_BY_LOCAL_STATE
```

`KB_CONTINUOUS_MAINTENANCE` 只在**已证实可重复批处理**后成立，不表示已实现 watch/daemon/自动运行。未满足独立发布门禁或基线不一致立即停止，并保留真实证据和具体恢复路径。
