# KB-CM-V1：Swap/GBrain 按需持续维护操作规程

状态：`PERMANENT CURRENT / ON-DEMAND OPERATIONS`；Issue #131。
设计基线：`docs/knowledge-reconstruction/architecture/overall-design-v1.md`。
发布安全：`docs/knowledge-reconstruction/tasks/kb-p0-controlled-publication-v1.md`。
上次建设批次：`docs/knowledge-reconstruction/tasks/kb-bn-c4-change-driven-batch-v1.md`（历史；用户已报告 `PUBLISHED + BOUND`）。
Authority 获取：`docs/knowledge-reconstruction/operations/authority-sync.md`。

> 这是**长期稳定的可重复使用规程**，而非新建一轮 C5/C6。只有用户明确触发、或在本地已有工作会话中明确委托具体变化维护时才执行。它不启动 daemon、计划任务、定时扫描或自动监控，也不默认允许自动发布正式知识。

## 1. 两种模式，先激活后日常使用

- `ACTIVATE`：用户尚无新的实际代码/版本/MML 变更，仅确认 C4 已发布知识和原生 GBrain 的状态，检查 C4 `published-baseline.json`、独立发布验收、两个 Git HEAD/Source Path/索引 Subject，配置**可调用**的轻量日常 Runbook 入口（只引用本 Authority 和本地现有工具），做一次**只读**的旧样本影响定位回归；不生成新候选，不写正式知识、不重复同步 GBrain、不伪造新 change event。成功输出 `MAINTENANCE_READY`。
- `CHANGE`：有**真实**新的或明确指定的来源变更/Gap 才执行。输入 `CHANGE_REF`：项目 Git 的 old..new 提交、明确版本/文件对照、真实 MML/设备资料修改、或本地已有的有证据 backlog `GAP_ID`。用户可指定 `MODE=PREPARE`（默认，只到独立候选 Review）或 `MODE=PUBLISH`（明确委托完整发布流程，仍必须满足所有 P0 Gate/独立性/消费者隔离）。没有可证明的变更或 gap 时返回 `NO_ACTIONABLE_CHANGE`，不得以 C4 已发布样本充当新任务。

本规程无需每次生成 GitHub Issue/PR/新 Authority SHA；仅当长期规则本身需要改变时更新远端 Authority。每次 CHANGE 是**本地独立运行**，使用同一个 merged-main Authority SHA 与本次变化的明确事实 Subject。

## 2. 固定资产、输入水位线与保密边界

正式知识仓：`D:\gbrain-knowledge\swap-kb\`、`D:\gbrain-knowledge\microwave-kb\`。
设备 Raw Sources：`D:\swap-knowledge-sources\`（只读）。
本地治理根：`<SwapRepo>\.ai-local\knowledge\reconstruction\`；`<SwapRepo>` 必须从当前已打开、身份可证明的 Swap 工程获取，不搜索全盘猜路径。
正式 GBrain Source IDs 以本机验证的 `swap-kb`、`microwave-kb` 为准，验证其真实绝对路径、同步 index subject、版本/配置；`tracked_branch` 不等于受证实 Git Index Commit。

从 C4 真正独立发布的 `baselines\kb-bn-c4\<C4_AUTHORITY_SHA>\published-baseline.json`、`publishing\kb-bn-c4\...\independent-publish-review.md` 确认**双知识仓 commit pair 和精确 GBrain Index Subject**。C4 常用 Authority SHA 是 `080e61af6963c077cc3034ecfb6226bc58f7a1b8`；若本机受签实的 C4 运行 Manifest 使用另一 SHA，以其完整 Evidence 证明真实位置，不能按 mtime 猜。后续每次 CHANGE 使用上次真正 Published Baseline 作为 `BASE_PAIR`，本地记录已处理到哪一个已证明的 source diff/commit，不能将相同 diff 二次发布。

只有明确历史对照的源代码/配置 Git diff 或原始资料旧新 Hash/版本，才可声称 source change；缺失 before 时为 `NEW_OR_UNDATED_SOURCE`。当前代码是实现事实，不自动代表官方设备规则；官方 MML/设备文档证实产品约束。旧 Wiki 仅 clue。私有源码、知识内容、日志、DB、完整 Evidence 不得推送 GitHub Framework。

## 3. CHANGE 单轮工作流（只在确有变更时）

**0 / Baseline preflight（只读）**：核对已签实 Baseline、正式双仓 clean/HEAD、已完成 Index Subject、受影响 Source 的 Git/Hash before/after、已处理 change watermark。Mismatch→`BLOCKED_BY_BASELINE`；不盲目 resync、不改变正式内容。

**A / Source Delta → Impact（可并行只读取证）**：用本地已有 Git diff、文件比较、源码搜索及两正式知识仓的 canonical name/aliases/引用，定位受影响的场景、`SwapParam`、Module、设备版本/板卡/端口、MML GET→SET、`cfg.ini`、Java/C++/JNI 责任和跨库 Primary Home。记录 source evidence、精确受影响候选页、实际错答/缺失与影响置信；给每个影响链至少一个正例、一个不适用/正确拒答或明确 Unknown。将 `CONTENT_GAP`、`NAVIGATION_GAP`、`RETRIEVAL_ONLY`、`SOURCE_UNKNOWN` 和 `NO_CHANGE` 分开，检索-only 不用虚构 Markdown 来伪修。

**B / Minimal Candidate（仅 PREPARE / PUBLISH）**：每个知识仓只有**一个 writer、一个独立 worktree、一个最终 candidate HEAD**，从真实 BASE_PAIR 创建。先冻结允许写入的页面、原始文件 Hash、证据、范围与有限受影响路径；只修改确实需要维护且有证据的 Markdown/导航，保持中文知识、英文代码/MML/型号原名与版本适用范围。默认单次最多修改 8 个、新建 2 个 Markdown（两仓合计）；超过必须明确拆成另一个来源变更任务，不能扩大为全量 Survey。候选不得是 live GBrain Source 的子目录；不修改 Swap 生产源码、XML、cfg.ini、设备 Raw Sources。

**C / Independent Review（不可由实施者自签）**：Reviewer 核对精确 subject（BASE_PAIR、SOURCE_REF、CANDIDATE_PAIR、Hash、diff）、所有新增 Claim 的实际代码/官方设备/MML 证据、错误/负例、版本兼容、跨仓 Primary Home、影响链及原有问题是否退化。P0/P1/未合法豁免的 P2 不通过即 HOLD，Reviewer 不改 Candidate。新 HEAD 必须独立重验。输出 `APPROVED_EXACT_SUBJECT` 或 `REMEDIATION_REQUIRED`。PREPARE 在这里停止，标记 `APPROVED_NOT_PUBLISHED`（不改变 live Source/index）。

**D / Explicitly Authorized Controlled Publish（只在 MODE=PUBLISH）**：必须当前规程的 Authority SHA 已合并 main，C 对同一 subject PASS，用户确已委托本轮发布，并重新满足 P0 的正式知识 repo clean、Git `ff-only` 可达、真实 GBrain Source path/index subject、已验证消费者隔离和恢复方案，才受控将两个仓提升到 exact reviewed candidate commit 并定向增量同步 GBrain。禁止强制/重置/rebase/cherry-pick、全局 Git trust/ACL 变更、GBrain reinit/全量重建或把临时 Candidate 直接指向正式 Source；部分发布失败必须保持消费隔离并进入 `PARTIAL_PUBLICATION_HOLD`。

**E / Independent Published Gate**：另一独立 Reviewer 检查正式双仓 Commit Pair、GBrain 已完成 index 的**确切 subject**、新旧 Query 的正反例、受影响/未受影响知识、运行回归；全部 PASS 才新建 Published Baseline、更新来源 diff watermark 并恢复正式消费者。仅 sync exit code 0 不是 PUBLISHED。未受证实则 `PUBLISH_HOLD`；没有内容改动时须 Reviewer 独立认可 `NO_CHANGE`，不创建假 Git Commit/新 Baseline。

A→E 可在用户明确 `MODE=PUBLISH` 的一次会话中连续执行；安全 Gate 与不同 actor 的独立 Reviewer 不得为了提速绕过。运行状态不满足则停在已通过阶段，后续按 exact Subject 恢复，无需重新做旧任务。

## 4. WRITE_SCOPE：固定一次运行的私有目录，不新建公共 PR

一次运行的本地 `RUN_ID` 为唯一、非私人秘密、无路径穿越的标识（如 `20261112-change-001`）；目录 `<SwapRepo>\.ai-local\knowledge\reconstruction\maintenance\runs\<RUN_ID>\`。只允许新建下列产物：

```text
run-manifest.json
baseline-and-watermark.json
source-diff.json
impact-map.json
query-cases.json
candidate-scope.json
candidate-manifest.json
build-report.md
independent-review.md
findings.json
preflight.json
publish-report.md
independent-publish-review.md
recovery-plan.md
published-baseline.json
receipt.md
```

最后两个文件中 `published-baseline.json` 仅 E Gate PASS 可创建；已发布/NO_CHANGE 水位线记录在运行 manifest 与正式下个 run 的 Base 选择中，不重写旧 Baseline。若用户显式批准第一次 PUBLISH，从此前 PREPARE 状态恢复，必须核对完整 candidate head/hash/源 diff 与旧 reviewer decision 完全相同。

知识 Candidate worktree 只允许在：
```text
<SwapRepo>\.ai-local\knowledge\reconstruction\maintenance\candidates\<RUN_ID>\swap-kb\
<SwapRepo>\.ai-local\knowledge\reconstruction\maintenance\candidates\<RUN_ID>\microwave-kb\
```

只允许 `candidate-scope.json` 冻结的 Markdown 路径；现有历史 Evidence、正式 Raw Sources、生产代码及 Framework Runtime/Learning/Verification 线永不改动。正式双仓与 GBrain 仅 MODE=PUBLISH 且 D/E Gate 授权时可按 P0 精确写入。不要把知识或私有 Evidence 上传公开 GitHub。

## 5. 质量度量与运行回执

日常维护优先看**真实研发问题是否被正确回答**，而不是每天新增多少 Markdown：

- `source_changes`：有明确 before/after 的变更数量与真正新处理的 watermark；
- `impact_precision`：证实命中页、误报和至少一个有来源的潜在漏检样本（缺证据记 UNKNOWN，不能宣称零漏检）；
- `queries`：与该变更相关的检索正确/正确拒答/错误/不可测；
- `review` 与 `publication`：独立审查及 Git pair/index 是否确实形成 Published Baseline；
- `backlog`：检索-only、证据缺失、未实现能力的优先次序，不把未知写成支持。

```text
KB_CM_RUN_COMPLETE
mode: ACTIVATE | PREPARE | PUBLISH
run_id: <id>
baseline: BOUND | UNBOUND
source_ref: <repo diff/hash or GAP_ID or NONE>
impact: confirmed_pages=<n> fp=<n|UNKNOWN> miss=<n|UNKNOWN>
queries: pass=<n> partial=<n> wrong=<n> not_testable=<n>
candidate: BUILT | REUSED | NO_CHANGES_NEEDED | NOT_APPLICABLE | BLOCKED
independent_review: PASS | FAIL | NOT_RUN
publication: PUBLISHED | NO_CHANGE | APPROVED_NOT_PUBLISHED | NOT_APPLICABLE | PUBLISH_HOLD | PARTIAL_PUBLICATION_HOLD | BLOCKED
index_subject: BOUND | UNBOUND | UNKNOWN
backlog: <n>
next_action: MAINTENANCE_READY | READY_TO_PUBLISH | REMEDIATE | RECOVER_PUBLICATION | NEED_SOURCE_CHANGE | BLOCKED_BY_LOCAL_STATE
```

`ACTIVATE` 成功必须 `publication=NOT_APPLICABLE` / `candidate=NOT_APPLICABLE` / `next_action=MAINTENANCE_READY`。这只证明**按需维护入口与已发布 C4 基线可用**，不等于 daemon/watchers/自动定时任务已落地。没有真实变更时常态应保持 `MAINTENANCE_READY`，不应持续制造新批次任务。
