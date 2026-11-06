# KB-BN-C2：设备/版本、MML 语义、变更影响三线批量建设

状态：`CURRENT TASK / BATCH KNOWLEDGE DELIVERY`；Issue #125。
依赖：`architecture/overall-design-v1.md`；`tasks/kb-p0-controlled-publication-v1.md`；`operations/authority-sync.md`。
上一轮：`tasks/kb-bn-c1-four-core-flows-batch-v1.md`（C1 用户报告本地执行完成；不凭聊天假定全量 VERIFIED）。

> 本轮是**实用知识覆盖扩张**，不是新系统开发。按 C1 的真实剩余 Gap 和实际源码/资料挑出高价值对象，三线并行取证，一次集成知识候选、一次独立审查、一次受控发布。没有来源的型号/版本组合明确留在 backlog，不虚构全覆盖，不重做旧 Survey 或 XPIC/SCC/IF/Data/CCIC 已证明内容。

## 1. 仅一次性冻结最新基线

在当前已打开且可证明的 Swap 工程读取 `<SwapRepo>\.ai-local\knowledge\reconstruction\`；以真实 C1 Receipt/`baselines\kb-bn-c1\` 里已独立验收的 `published-baseline.json` / `publishing\kb-bn-c1\` 为本轮正式 Base，确认两 Knowledge Repo 当前 HEAD、GBrain `swap-kb` / `microwave-kb` Source 绝对路径、真实同步索引 subject 与 C1 commit pair 一致。上一轮如 `NO_CHANGE`，必须复用其明确引用的有效旧发布基线；如上一轮仅 Review 完成、尚未正式发布、部分发布/索引 HOLD，`BLOCKED_BY_PREVIOUS_PUBLICATION`，不得基于未发布候选开新批次。

正式知识保持：`D:\gbrain-knowledge\swap-kb\` 与 `D:\gbrain-knowledge\microwave-kb\`；Raw Sources `D:\swap-knowledge-sources\` 只读。不得凭时间戳选择“最新”基线，必须用决策、双 SHA、实际索引和独立发布 Evidence 绑定。

从 C1 的真实 `coverage-report.md`、`gap-register.json`、`query-cases.json`、剩余 backlog 开始，优先复用已证实的代码路径/资料定位；找不到某份非关键旧清单时可由真实源码和现存知识补充精确 Query Seed，不要求凭空存在的新目录，也不扩大扫描范围。预检/旧基线不一致则本轮停止。

## 2. 三条知识建设主线

**T1 — 设备能力及版本适配。** 选真实、证据最充分且影响 SCC/IF/Data/CCIC/XPIC 的目标设备或设备族；覆盖设备/版本、主控/板卡、槽位端口、Feature/XPIC/复用限制以及项目 XML、设备特化类、参数校验之间的可追溯联系。同一命令或特性在不同设备/版本的差异必须标注精确适用范围、证据和未知点。不创建未经来源证实的全组合矩阵。

**T2 — Source MML 与转换语义。** 选择实际高频 GET MML 和参数（由 C1 backlog、源码与真实源输入共同确定），明确命令/参数意义、范围、前置/依赖、设备与版本条件；区分 NCE GET 日志、设备 DB 经 legacy C++ parser 与 Java supplemental parser 得到 Source MML 两路输入；明确 Source MML 与目标 SET/转换输出之间的代码责任。`cfg.ini` 的 GET→SET 映射、JNI/C++ 后段只按真实源码证明。不能从一条 MML 被模块读取就断言该模块独占修改权；不得把 parser 的 DB→MML 和最终 GET→SET 混为一谈。

**T3 — 变更影响导航。** 至少选择三类真实变更类型：新增目标设备/单板、软件版本提升、MML 参数变化。以当前代码和已发布知识做双向导航：`变更对象 → Feature/设备限制 → Scenario/SwapParam → Module/设备特化/XML/cfg.ini → 输出/测试范围`；指出读写责任强弱、必要证据和最小应查文件/测试，而非自动生成未经证明的生产代码改动列表。

知识归属：`swap-kb` 是 Swap 场景/实现/变更责任 Primary Home；`microwave-kb` 是设备、MML、Feature/版本事实 Primary Home。跨仓采用可追溯引用，不复制两套冲突的设备能力定义。中文解释为主，原始类/方法/MML/型号名称不翻译，同义名在核验后登记。

## 3. 实战检索验收，不以页面数代替价值

从本次证据选择**18 个真实 Query Case**：T1 六个、T2 六个、T3 六个。每条有 input/context、真实已发布 GBrain 召回记录、预期证据、正例/负例、正确引用和适用条件；其中每条主线至少一个明确拒答/限制/Unknown Case，且至少三条 Case 必须跨 `swap-kb` 与 `microwave-kb`。

必须覆盖：一个具体设备/版本比较、一条 MML 命令及参数、一个 DB→MML 与 NCE GET 汇合问题、一个 `cfg.ini` GET→SET 责任问题、三个真实变更影响路径（设备/版本/MML）。没有实际证据的对象不能为了凑数称为正确，按 `NOT_TESTABLE` 并形成 backlog。

结果标记 `CORRECT_WITH_EVIDENCE | CORRECT_ABSTENTION | PARTIAL | WRONG_OR_UNSUPPORTED | NOT_TESTABLE`。区分知识正确但检索错、知识确实缺失、设备/版本不支持、源资料不足。给出单条证据和每线分数；不对未知组合计算虚假 100% 覆盖率。

## 4. A→E 同一轮执行，最多三路只读取证

**A / Probe**：最多 3 个 worker 并行只读，各负责 T1/T2/T3 中一条，读取当前正式 GBrain/源码/设备资料，产出 18 条 Query 与证据锚点、优先级、实际 Gap。明确区分 `CONTENT_GAP | NAVIGATION_GAP | RETRIEVAL_GAP | SOURCE_UNKNOWN | VERIFIED_EXISTING`。未证实的资料只进 Unknown；不由 Agent 自行猜设备、型号、版本差异。

**B / Candidate**：每个知识仓最多一个写入者及独立 Git worktree，基于冻结的上一轮 Published Pair。先写精确 scope（计划修改文件、原 HEAD、Primary Home、证据、原因、冲突项），只针对已证实的 CONTENT/NAVIGATION Gap 建候选；更新最多 14 个 Markdown、新增最多 4 个 Markdown（两仓合计）；其余高价值 Gap 排序留待 C3。候选内容做引用/链接、事实适用范围、负例自检，并提交成每仓**唯一最终 candidate HEAD**；不直接修改两个 D 盘正式 Source 目录。若现有知识已足够可 `NO_CHANGES_NEEDED`，不制造空提交。

**C / Independent Review**：不是实施写入者的 Reviewer 对当前整批 exact candidate pair 独立复核：scope/diff/hash、十八个 Case 及证据、设备/版本边界、MML 参数语义、两路输入/后段输出责任、跨库 Primary Home、未知拒答与旧 Backlog 的一致性。旧 C1 PASS 只作引用，不自动继承当前候选。P0/P1/未合法豁免的 P2 阻断；任何新发现导致文件修改需新 HEAD 和重新独立验证。独立 Reviewer 不改候选。结论 `C2_CANDIDATE_APPROVED | C2_REMEDIATION_REQUIRED | C2_REVIEW_BLOCKED`。

**D / Controlled Publish**：仅在 C 通过并且**本 CURRENT Authority 已并入 main 生效**后继续。必须重新确认正式仓 clean、candidate HEAD 与受审精确一致、ff-only 可达、GBrain Source 真正指向正式目录、可证明索引 subject、消费者暂停、维护窗口与恢复方案仍有效。只允许 exact approved SHA 的 non-destructive `git merge --ff-only` 与本机验证的 GBrain Source 限定 sync。禁止无审查的 cherry-pick/merge/reset/rebase/force、ACL 改权、GBrain reinit 或全库索引重建；不能安全发布就 HOLD，不能偷偷把候选当正式内容。

**E / Independent Publish Check**：与 D 发布实施者不同的 reviewer 检查两正式仓 Git Pair、当前 GBrain Source 路径及完整受证实的 Index Subject、18 Query 的正反例与引用、原发布基线的继承；全部 PASS 才写新的 `published-baseline.json` 并恢复消费。部分知识仓/索引更新失败不得自动伪回滚或继续消费，必须按 P0 recovery 保持隔离、报告具体阻塞。无改动且 18 Case 可证实准确时，`NO_CHANGE` 经独立 Reviewer 确认并继续沿用旧正式 Baseline，不能伪造新提交/发布。

跨阶段可自动顺序执行，不需要每个步骤返回用户聊天批准；但实施者、Reviewer 和 Publisher 的角色独立性、Gate 与当前 subject 必须留痕。若未能配置不同 reviewer，`BLOCKED_BY_INDEPENDENCE`，不可自行宣布 PASS。

## 5. WRITE_SCOPE

本地 Governance 允许新建且仅允许如下文件：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c2\<AUTHORITY_SHA>\base-and-backlog.json
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c2\<AUTHORITY_SHA>\query-cases.json
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c2\<AUTHORITY_SHA>\gap-register.json
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c2\<AUTHORITY_SHA>\candidate-scope.json
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c2\<AUTHORITY_SHA>\candidate-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c2\<AUTHORITY_SHA>\build-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-bn-c2\<AUTHORITY_SHA>\coverage-and-backlog.md
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\kb-bn-c2\<AUTHORITY_SHA>\independent-review.md
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\kb-bn-c2\<AUTHORITY_SHA>\findings.json
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-bn-c2\<AUTHORITY_SHA>\preflight.json
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-bn-c2\<AUTHORITY_SHA>\publish-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-bn-c2\<AUTHORITY_SHA>\independent-publish-review.md
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-bn-c2\<AUTHORITY_SHA>\recovery-plan.md
<SwapRepo>\.ai-local\knowledge\reconstruction\baselines\kb-bn-c2\<AUTHORITY_SHA>\published-baseline.json
```

候选仅在下列独立 worktree 中，被 scope 精确冻结的 Markdown 页面：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-bn-c2\<AUTHORITY_SHA>\swap-kb\
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-bn-c2\<AUTHORITY_SHA>\microwave-kb\
```

只有阶段 D 的严格前置 PASS 才可对正式双仓和 GBrain 做限于精确受审 subject 的受控更新；仅 E PASS 写正式 Baseline。禁止改 Swap 生产源码、Raw Sources、历史 Governance Evidence、未受审正式页面、Framework Runtime/Verification/Learning 等，禁止将知识页面或私有资料上传远端 Authority。

## 6. DONE、度量与后续

可用交付需提供 18 个 Query 的 before/after（无修改则 baseline 原状态）、三条线的证据覆盖率及 `CORRECT_WITH_EVIDENCE`/正确拒答/部分/错误/不可测分布，至少三条可实操影响导航和正式 Publisher 的受证实 Commit Pair / Index Subject。不能把正确拒答误判为业务实现已支持。

若全部通过：`C2_BATCH_PUBLISHED`；若实用增量已通过但部分设备/版本资料缺失：`C2_VERIFIED_PARTIAL_WITH_BACKLOG`，且只有独立发布 Gate PASS 才称 PUBLISHED；若没有改动：`C2_NO_CHANGE_VALIDATED`。剩余 backlog 精确到对象、缺的证据、优先级、下一动作，由 C3 针对真正未解决的问题开展，不要重新 Sweep。

```text
KB_BN_C2_COMPLETE
baseline: BOUND | UNBOUND
tracks: device_version=<VERIFIED|PARTIAL|BLOCKED> mml=<VERIFIED|PARTIAL|BLOCKED> impact=<VERIFIED|PARTIAL|BLOCKED>
query_cases: pass=<n> abstain=<n> partial=<n> wrong=<n> not_testable=<n>
candidate: BUILT | REUSED | NO_CHANGES_NEEDED | BLOCKED
independent_review: PASS | FAIL | NOT_RUN
publication: PUBLISHED | NO_CHANGE | APPROVED_NOT_PUBLISHED | PREFLIGHT_BLOCKED | PARTIAL_PUBLICATION_HOLD | PUBLISH_HOLD | NOT_STARTED
published_pair: <swap_40char_sha>/<microwave_40char_sha> | UNBOUND
index_subject: BOUND | UNBOUND | UNKNOWN
backlog: <n>
next_gate: KB_BN_C3_PRIORITY_GAPS | KB_BN_C2_REMEDIATION | KB_BN_C2_PUBLISH_RECOVERY | BLOCKED_BY_LOCAL_STATE
```

如果本 Authority 仍在 PR 分支：只允许 A/B/C 的只读/候选/独立审核，**不得**进入 D 的正式 Git Promotion 或 GBrain live sync。完成当前最大许可阶段即停止，保留精确 Evidence，合并后用新的 main SHA 恢复后续执行。
