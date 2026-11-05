# KB-BN-C1：四核心业务场景一轮增量建设、独立验收与受控发布

状态：`CURRENT TASK / GATED BATCH EXECUTION`
跟踪：Issue #123。注意：这是新连续维护批次 **KB-BN-C1**，不是历史 `KB-V0-B2 / Batch #2 Core Swap Processing`；不得混淆路径、Evidence 或 Gate。
上位设计：`docs/knowledge-reconstruction/architecture/overall-design-v1.md`。
正式发布规则：`docs/knowledge-reconstruction/tasks/kb-p0-controlled-publication-v1.md`。
最近 XPIC 任务：`docs/knowledge-reconstruction/tasks/kb-b1-gap-close-and-publish-v1.md`（已由用户回报受控发布完成）。
Authority 交付：`docs/knowledge-reconstruction/operations/authority-sync.md`。

> **本次改变推进粒度**：一次性针对 SCC、IF、Data、CCIC 四个使用场景，先批量验证，再仅补确定的知识缺口，统一独立审核与受控发布。不再给每个场景、每个 Gap 创建独立聊天 Gate。整个项目未完成全覆盖前，按已验证切片逐批交付，不能宣称 100%。

## 1. 准入、范围与事实优先级

用户回报 XPIC 增量已正式发布；但远端不能看到完整本地 `published-baseline.json`。首先只读从 `<SwapRepo>\.ai-local\knowledge\reconstruction\baselines\kb-b1-close\` 或其确切发布 Evidence 定位**最新独立发布通过**的双知识仓 HEAD、两个 GBrain Source 实际路径和 Index Subject，冻结为本轮 Base Pair。

禁止按目录字典序或“last modified”直接猜最新 Baseline；只有真实 `publication=PUBLISHED` / `index_subject=BOUND` / 独立发布核验证据组合才可视为当前正式 Baseline。若其缺失，使用确切的以前 P0 Baseline 对照真实 Git/Source 状态排除冲突，无法证明时 `BLOCKED_BY_BASELINE`，不得继续写候选或暗中重同步。

正式知识：`D:\gbrain-knowledge\swap-kb\`、`D:\gbrain-knowledge\microwave-kb\`。Raw Sources：`D:\swap-knowledge-sources\`。本地 Governance Root：`<SwapRepo>\.ai-local\knowledge\reconstruction\`。SwapRepo 是当前已打开、能被证明的 Swap 项目根，不扫描磁盘猜路径。

严格证据优先级：当前 Swap 代码、配置、测试/调用链；官方 MML/设备版本/板卡限制及转换源；双知识库当前受审内容；旧 Review/历史 Artifact；旧 Wiki 只能作为 clue。业务设想不等于已实现行为，所有结论写出适用设备、版本、输入条件及 Unknown。

## 2. 四个固定场景与验收义务

**SCC 配置**：真实前端 SCC 参数、`SwapParam` 数据、处理模块与转换链；目标设备选择、硬件/软件版本和最终 MML/输出边界。不以通用架构介绍冒充 SCC 适配规则。

**IF 配置（包括 ODU→MODU）**：迁移后的 IF 参数与 ODU→MODU 兼容逻辑；若实际支持，识别可配置复用关系、关联的端口/板卡限制及由谁校验/生成 MML。区分 UI 展示/源采集与实际目标转换。

**Data 配置**：实际数据配置的输入、源 MML/`SwapParam`、场景约束、目标转换/生成、版本差异与结果验证。不得把名字叫 Data 的所有模块都认定为此业务路径。

**CCIC 配置**：前端新增/扩展场景而不只是传统源配置迁移。分别标注当前已实现的独立新增、计划中的“迁移 + 扩展”一体化及可能的设备/版本约束；不得把规划能力写成当前支持。

所有场景必须回到 `SwapParam → SwapService#doTransfer → *Module/AbstractTransfer → 模块依赖的 GET MML / 设备特化/XML → result merge → JNI/C++/cfg.ini GET→SET` 的**真实局部依赖**，而非假设每个场景都有相同严格顺序或单一 MML ownership；Feature/Scenario/MML 与 Module 不可强制一对一。

本轮固定查询验收集：每个场景 5 类 Q（真实正例/入口；负例/非法输入；设备/版本差异；代码责任与模块关系；输出/MML 证据或真实不支持边界），共 **20 个**。再增加 4 个跨场景问题：输入链 NCE vs DB→Source MML、跨库 MML Primary Home、版本变更影响、未实现/Unknown 的正确拒答。合计 **24 个有证据的 Query Cases**。

Query Case 评分：`CORRECT_WITH_EVIDENCE`、`CORRECT_ABSTENTION`、`PARTIAL`、`WRONG_OR_UNSUPPORTED`、`NOT_TESTABLE`。真实不支持/未知且正确拒答可以达标，但必须有代码/产品文档的确定边界或诚实说明证据不足；不能为提高分数补造业务规则。各场景出具体正确率和 Remaining Gaps，不必把所有未实现需求变成 blocker。

## 3. 单轮工作流：取证可并行，写入必须单写者

**A — READ-ONLY PROBE / GAP TRIAGE**：按 4 场景划分至多 2 个并行轻量取证 worker，均只读正式 GBrain/知识仓、源码/配置、现有版本/MML 资料；不使用会改变 GBrain Index 的命令。先执行 24 个 Query Case，列出 page/section、引用与代码事实，分为 `CONTENT_GAP / NAVIGATION_GAP / RETRIEVAL_GAP / SOURCE_UNKNOWN / VERIFIED_EXISTING`。只根据证据定义 candidate update，不在 A 阶段写知识。四 worker 的结果合成 `gap-register.json`；即使一场景资料不足，其他场景继续完成只读取证。

**B — SINGLE-WRITER CANDIDATE BUILD**：候选**每个知识仓仅一个**集成 worktree/writer，禁止四个 Agent 在不同分支同时改同一知识库导致无法非破坏性合并。先按两库的 canonical primary home 冻结不重复的 `candidate-scope.json`，最多更新 **12** 个、创建 **4** 个 Markdown（整个批次上限，不是每个场景）。已有页面能复用只补精确链接/版本/负例。高价值 Gap 优先级：错误事实 > 缺少必需限制 > 错误链接/责任边界 > 缺少完整介绍；检索-only Gap 只登记问题，不通过篡改业务内容掩盖。

从正式已验证 Base Pair 创建两个仓中**实际需要改动**的独立本地 Knowledge Git worktree（路径见 WRITE_SCOPE），完全保持正式 Git 工作树和 live GBrain index 不变。候选目录不得属于 GBrain 正式 Source。若已有工作树/未提交变动/正式 HEAD 漂移，记录实际冲突，不 stash/reset/overwrite。若官方 repo owner != 用户，须仅按可信仓逐命令 `-c safe.directory=<exact path>` 且有真实 OS 写权限；禁止扩大到 `safe.directory=*` 或自动修改 ACL。

实施者完成最小内容增量、每条 Claim 的 Code/Config/Source Evidence、相对链接、Primary Home/alias、版本适用性、Unknown/负例检查，提交到**唯一每仓最终集成候选 HEAD**。在 manifest 冻结 `file hash + paths + diff + base/head`。只允许自称 `CANDIDATE_READY`，不能自评 Verified。

如果四场景现有已发布内容已经满足，有证据的 24 Cases 可全部只读验收，允许 `NO_CHANGES_NEEDED`，不强制空 Git worktree；若只有部分问题可证实，至少记录真实达标范围及 backlog，不假造完整覆盖。

**C — INDEPENDENT BATCH REVIEW**：由不参与 A/B 写入的 Reviewer（必须与实际候选实施者不同）核验整个最终集成候选的 24 个 Query Case、受影响完整页面/关系、设备/版本/Feature/MML 边界、示例和负例。审查 candidate HEAD 必须与冻结 manifest 相同；P0/P1/未合法豁免的 P2 阻断 PASS。若一个场景有重大未知，允许将其标为 `PARTIAL/DEFERRED`，但不得把未知作为已交付能力；本次写入的所有 Claim 仍必须通过。Reviewer 不改内容；其结论仅 `BATCH_CANDIDATE_APPROVED` / `REMEDIATION_REQUIRED` / `BLOCKED_BY_SUBJECT`。

**D — CONTROLLED PROMOTION & GBRAIN SYNC**：只有 C PASS + 本 Authority 已作为 merged main 的 exact SHA 生效 + 预检证明两正式 repo clean、目标可 **ff-only**、GBrain Source 路径及当前 Index Subject、已验证的消费入口暂停、恢复方案均有效时才进行。一轮只发布一个集成候选 Commit Pair；没有变更的仓保持原发布 HEAD。不允许 rebase/cherry-pick/force/reset 或 GBrain 全库重建/reinit；必要时参考 P0 的严格发布 Gate。候选批准与 Authority/CI 成功都不等于正式发布。

**E — INDEPENDENT PUBLISH CHECK**：独立于实施和发布操作的 Reviewer 检查正式两仓 Commit Pair、Source/Index commit binding、24 问的实际有证据响应及回退边界；仅成功时写新的 Published Baseline 并恢复正式消费。不能证明 Index Subject 时维持 `PUBLISH_HOLD`，不得报 Published。若两个仓更新期间出现部分失败，保持消费隔离，返回 `PARTIAL_PUBLICATION_HOLD` 和恢复说明，不自动强制回滚。

以上 A→E 为同一轮本地编排，不因纯阶段完成要求回聊天确认。但 Reviewer/Publisher 必须分离 actor，任何必要的独立性缺失自动停止，不得用同一 Agent 的自检冒充独立 Gate。

## 4. 产物与 WRITE_SCOPE

唯一允许的本地新增 Governance 文件：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c1\<AUTHORITY_SHA>\baseline-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c1\<AUTHORITY_SHA>\query-cases.json
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c1\<AUTHORITY_SHA>\gap-register.json
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c1\<AUTHORITY_SHA>\candidate-scope.json
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c1\<AUTHORITY_SHA>\candidate-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c1\<AUTHORITY_SHA>\build-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c1\<AUTHORITY_SHA>\coverage-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\kb-bn-c1\<AUTHORITY_SHA>\independent-review.md
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\kb-bn-c1\<AUTHORITY_SHA>\findings.json
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-bn-c1\<AUTHORITY_SHA>\preflight.json
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-bn-c1\<AUTHORITY_SHA>\publish-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-bn-c1\<AUTHORITY_SHA>\independent-publish-review.md
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-bn-c1\<AUTHORITY_SHA>\recovery-plan.md
<SwapRepo>\.ai-local\knowledge\reconstruction\baselines\kb-bn-c1\<AUTHORITY_SHA>\published-baseline.json
```

候选（仅冻结的 Markdown）：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-bn-c1\<AUTHORITY_SHA>\swap-kb\
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-bn-c1\<AUTHORITY_SHA>\microwave-kb\
```

正式知识仓和正式 GBrain 的**唯一例外写入**：D 阶段安全门禁全部 PASS 后，严格对已独立审核的 exact candidate commit 做 non-destructive Git ff-only 和经本机证实的 Source 限定 Sync。所有正式 Git 更新须记录、对应精确 F1/B1 以来已验收链路；不得改生产源码、Raw Sources、现有历史 Review、正式 GBrain DB Schema 或任何无关仓。

`published-baseline.json` 仅 E 独立发布 Gate PASS 才可创建。所有私有日志、知识页和 Evidence 留本地，不上传 Framework GitHub。严格遵守 `operations/authority-sync.md`：只按 exact SHA 下载当前 index/task/supporting Authority 单文件，不 clone Framework。

## 5. 完成标准与效率指标

报告必须清楚区分：`现有知识正确但未被索引召回`、`实际知识缺失`、`产品不支持`、`暂时缺乏 Evidence`，不得用一句“有 gap”笼统回答。

每场景应有 5 个可重现真实 Query Case，并记录此前与修补后结果；跨场景 4 个。交付应显示四个场景的具体验证状态、24 个 Case 的 Pass/Partial/Wrong/Not-Testable 数量、修复实际引用的 Claim 和 remaining backlog。不能出自证的 100% 覆盖分数。

如果 24 个 Case 都有证据且已通过，标为 `FOUR_SCENARIOS_VALIDATED`；部分可验且事实正确、已发布可用切片，则标 `VERIFIED_PARTIAL_WITH_BACKLOG`，明确未覆盖范围；若质量/安全 Gate 失败，不得发布。

本任务优先完成真正可用的一批内容，不扩大到 XPIC 重做、旧历史 B2 重跑、知识平台重装或所有型号全量覆盖。

## 6. 最终 Receipt（唯一）

```text
KB_BN_C1_COMPLETE
baseline: BOUND | UNBOUND
scenario_status: SCC=<VERIFIED|PARTIAL|BLOCKED> IF=<VERIFIED|PARTIAL|BLOCKED> DATA=<VERIFIED|PARTIAL|BLOCKED> CCIC=<VERIFIED|PARTIAL|BLOCKED>
query_cases: pass=<n> partial=<n> wrong=<n> not_testable=<n>
candidate: BUILT | REUSED | NO_CHANGES_NEEDED | BLOCKED
independent_review: PASS | FAIL | NOT_RUN
publication: PUBLISHED | NO_CHANGE | APPROVED_NOT_PUBLISHED | PREFLIGHT_BLOCKED | PARTIAL_PUBLICATION_HOLD | PUBLISH_HOLD | NOT_STARTED
published_pair: <swap_sha>/<microwave_sha> | UNBOUND
index_subject: BOUND | UNBOUND | UNKNOWN
backlog: <n>
next_gate: KB_BN_C2_PRIORITY_BACKLOG | KB_BN_C1_REMEDIATION | KB_BN_C1_PUBLISH_RECOVERY | BLOCKED_BY_LOCAL_STATE
```

如果仅做只读验证且内容已足够、双方正式基线仍未改变，`publication=NO_CHANGE` 只能在独立 Reviewer 认可 Query Evidence 并确认既有 Index 与当前 pair 有效时使用；不创建假新 Baseline。

完成后停止，保留审查/发布 Evidence 与 backlog。**如果 Authority 仍为 PR 分支且未合并 main，允许 A/B/C 阶段准备，禁止 D/E 正式发布。**
