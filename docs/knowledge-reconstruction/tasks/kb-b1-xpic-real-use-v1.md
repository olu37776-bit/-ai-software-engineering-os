# KB-B1：正式知识库首次实战使用与 XPIC 扩容知识纵向切片

状态：`CURRENT TASK / BOUNDED INCREMENTAL KNOWLEDGE IMPLEMENTATION`
跟踪：Issue #119
依赖：`docs/knowledge-reconstruction/architecture/overall-design-v1.md`，`docs/knowledge-reconstruction/operations/authority-sync.md`。
KB-P0 发布 Authority：`009132b02f0caa06d0000b3f00b5f4393c270ba2`。

> 用户回报 KB-P0 的正式发布 Gate 已 PASS。此回报属于 `REPORTED_PUBLISHED`；本任务开始须从本地发布证据固定精确双仓 Git Commit Pair 和 GBrain Index Subject。目标是证明“知识库能够帮助做真实研发判断”，而不是再进行 Survey、B2/B3 重建或整库审查。

## 1. 本次只做一个有实际价值的场景

**XPIC 扩容**：迁移场景中根据目标设备能力扩展 XPIC 组的配置。两条需证实的用户输入方式为（1）只提供期望数量，由实际项目规则自动分配；（2）显式指定板卡、槽位和端口。用户描述是调查线索，不等于源码或产品资料已证实的合法业务规则。

回答实际研发者应能追问的五个问题：

1. 哪个前端场景/参数表达这两种模式？如何进入 `SwapParam`？
2. 目标设备、版本、单板、槽位、端口与可用 XPIC 组数量限制在哪里、缺省如何处理？
3. 由哪些现存 `*Module` / `AbstractTransfer` / 设备特化类处理，谁只读取、谁实际生成/改写 MML？
4. 最终与 `SwapService#doTransfer`、输出合并、JNI/C++、`cfg.ini` GET→SET 的责任边界是什么？
5. 遇到资源不足、不支持组合、缺少来源资料时，系统实际行为是什么，知识库如何拒绝过度推断？

仅复述类名不算完成。若现有项目尚不支持某模式，必须说明 `NOT_IMPLEMENTED` / `UNKNOWN`，不能根据业务期待宣称存在。

## 2. 开始前只读验证发布基线

本地根：`<SwapRepo>\.ai-local\knowledge\reconstruction\`；正式知识：`D:\gbrain-knowledge\swap-kb\` 与 `D:\gbrain-knowledge\microwave-kb\`；Raw Sources：`D:\swap-knowledge-sources\`。

首先只读读取 P0 正式发布记录，优先：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\baselines\kb-p0\009132b02f0caa06d0000b3f00b5f4393c270ba2\published-baseline.json
```

如实际本地 P0 使用了另一个 Authority SHA，只能从既有 `publishing\kb-p0\` 的真实 manifest 和明确的 `APPROVED_PUBLISHED_BASELINE` 结论定位，**不能凭文件名猜最新**。检查双知识仓 `official HEAD` 与 baseline pair 的关系、两个 GBrain Source 的实际 resolved path、索引当前使用的受证实 subject。若正式索引已有不受控漂移/本机发布 Evidence 不完整：`BLOCKED_BY_PUBLISHED_BASELINE`；不得继续写候选或暗中重新同步。

不要重审 F1；只核对 P0 当前有效发布证据。旧 B2 `reviews\batch-2-v1\` 继续作为历史引用，不要求以前误设的 SHA cache/Review 路径。

## 3. 先测试现有 GBrain 的实际价值

使用本机经 `--help` 确认为只读的 GBrain CLI/MCP/query 方法，对当前正式索引运行至少五种类型的问题：

- Q1：XPIC 在 Swap 中的场景定位及主处理入口。
- Q2：仅提供新增 XPIC 组数量时，代码如何分配，适用什么目标硬件/版本条件？
- Q3：显式选择单板/槽位/端口时，字段校验与资源冲突如何处理？
- Q4：真实 `*Module`、XML/Bean、MML 与 GET→SET 输出边界如何关联，责任强度是什么？
- Q5：明确不支持或证据缺失的组合（负例），知识库能否明确 `UNKNOWN`/`NOT_SUPPORTED` 而不编造？

每次记录 query text（仅本地）、召回的 Source/Page/Section、引用出处、是否关联实际代码/配置，以及结论类型 `ANSWERED / PARTIAL / UNANSWERED / UNSUPPORTED_ANSWER`。严格分开“检索不到”和“源码不支持”。不要求安装 Embedding/Graphiti，也不改运行组件。

## 4. 精准源码/资料交叉核验与增量判断

仅围绕 Q1～Q5 相关的现存 Swap 源码/配置/测试和已识别的正式领域/MML文档取证，形成：

```text
queryCaseId
retrievedPageAndSubject
codeOrDocumentEvidence
claimAndApplicability
missingOrIncorrectKnowledge
affectedPrimaryHome
resolution: REUSE | FIX_LINK | UPDATE | CREATE | MARK_UNKNOWN
```

业务术语、MML 参数原始名、类名/方法名一律保留。没有代码/正式产品依据的细节不得凭模型推断；现存知识已经足够时选择 `REUSE`，不为写文件而写文件。

## 5. 候选写范围与隔离

本轮最多**修改六个 Markdown，新增两个 Markdown**。只允许在已冻结 manifest 所列出的精确目标页面写入，且必须属于本机独立 Candidate Git worktree：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-b1\<AUTHORITY_SHA>\swap-kb\
<SwapRepo>\.ai-local\knowledge\reconstruction\candidates\kb-b1\<AUTHORITY_SHA>\microwave-kb\
```

候选从 P0 published pair 的精确已验证 HEAD 派生；只对需要修改的知识仓建立 Git worktree。若本地存在其他未合并候选或正式仓 dirty/commit 漂移且触及目标页面，先记录 `SUBJECT_CONFLICT`，不自动合并或覆盖。不得修改正式 Source 目录：

```text
D:\gbrain-knowledge\swap-kb\
D:\gbrain-knowledge\microwave-kb\
```

创建 candidate worktree 使用目标知识 Git repo 的独立工作树命令，**不是** clone/fetch/pull/checkout GitHub Framework。候选目录应防止被 GBrain 正式 Source 自动消费；不能证明隔离，禁止写候选并给出具体 blocker。

开始修改前创建精确 `candidate-scope.json`，冻结 official base HEAD、实际受影响目标、CREATE/UPDATE/SKIP、依据、页面 Primary Home、所需依赖；超出范围停止而非自动扩张。候选改完仅执行本机自检、提交到独立 candidate branch，记录 commit 和文件 hash；实施者不得自己宣称 `VERIFIED` 或 `PUBLISHED`。

## 6. WRITE_SCOPE 与禁止事项

除当前 Authority cache，仅允许新增：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-b1\<AUTHORITY_SHA>\query-cases.md
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-b1\<AUTHORITY_SHA>\evidence-and-gaps.md
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-b1\<AUTHORITY_SHA>\candidate-scope.json
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-b1\<AUTHORITY_SHA>\build-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-b1\<AUTHORITY_SHA>\candidate-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\increments\kb-b1\<AUTHORITY_SHA>\smoke-checks.md
```

以及第 5 节两个固定候选路径中受 `candidate-scope.json` 允许的精确 Markdown 文件。其他路径只读。严禁改正式知识仓/索引、GBrain DB/Source、Raw Sources、Swap production code、历史 Review/P0 Baseline、主线 Framework 或公开 GitHub 私有内容。

## 7. 完成门禁与 NEXT_GATE

本轮目标是**证明一个真实使用场景并按需补缺**，不是直接发布。

必须有：Q1～Q5 的真实检索结果、明确代码/资料证据、至少一个真实正例与一个失败/Unknown 负例、五问是否可导航的客观结论、P0 subject freeze、所改页面/链接自检、无未经授权正式修改。

如果正式知识足够且 Q1～Q5 均可正确回答：`KB_B1_USE_CASE_PROVEN`，`next_gate=KB_BN_NEXT_REAL_USE_CASE`；无须新建候选。

如果确定存在高价值 Gap 且已在隔离候选补证：`KB_B1_CANDIDATE_IMPLEMENTED`，`next_gate=KB_B1_INDEPENDENT_REVIEW_AND_PUBLISH`。下一轮单一任务可以安排独立 Reviewer 后发布，但不得继承旧 F1 PASS。

如果相关证据不足，允许输出可验证的当前查询结果和 Unknown，但不得为补齐目标而捏造实现；如果无法确认 P0 subject、写入隔离或安全条件，`KB_B1_BLOCKED`，`next_gate=BLOCKED_BY_LOCAL_STATE`。

## 8. 短回执

```text
KB_B1_REAL_USE_COMPLETE
decision: KB_B1_USE_CASE_PROVEN | KB_B1_CANDIDATE_IMPLEMENTED | KB_B1_BLOCKED
published_pair: BOUND | UNBOUND
query_cases: passed=<n> partial=<n> failed=<n>
candidate_pages: new=<n> updated=<n> reused=<n>
candidate_swap_head: <SHA | UNCHANGED | NONE>
candidate_microwave_head: <SHA | UNCHANGED | NONE>
next_gate: KB_BN_NEXT_REAL_USE_CASE | KB_B1_INDEPENDENT_REVIEW_AND_PUBLISH | BLOCKED_BY_LOCAL_STATE
```

完成后停止，不自行开展下一轮独立验收或发布。原始源码/MML/实际查询内容只存本地。
