# KB-F1：现有知识候选一次性独立审查 V1

状态：`CURRENT TASK / INDEPENDENT REVIEW ONLY`
跟踪：Issue #113；依据：`architecture/overall-design-v1.md`。
上一建设 Authority：`63dc7a89628d84487f13a7bc5981fb5693c602ee`（KB-F0）。

## 1. 目的：一次收口，不再造前置任务

用户报告 KB-F0 已完成。本任务在一轮中完成：识别 F0 真实产物 → 冻结 current subject → 独立审查（B2/B3 主链、来源、导航、两仓关系）→ 给出可进入发布门禁的明确结论。不得再因旧 Authority SHA 缓存或上一轮凭空假设的 review 目录不存在而停止。

实施者与本次审查者必须是两个不同 actor；如无法独立，`BLOCKED_BY_INDEPENDENCE`。本任务只读候选与正式知识；不修复、发布或做新的 Survey。

## 2. 唯一工作区与真实输入

Swap 项目已打开的 `<SwapRepo>\.ai-local\knowledge\reconstruction\` 是本机治理根，不扫描磁盘猜路径。正式仓：`D:\gbrain-knowledge\swap-kb\`、`D:\gbrain-knowledge\microwave-kb\`；Raw Sources：`D:\swap-knowledge-sources\`。

优先读取 F0 本机实际产物（只在该确定根内寻找）：

```text
builds\kb-f0\63dc7a89628d84487f13a7bc5981fb5693c602ee\candidate-scope.json
builds\kb-f0\63dc7a89628d84487f13a7bc5981fb5693c602ee\build-report.md
builds\kb-f0\63dc7a89628d84487f13a7bc5981fb5693c602ee\candidate-manifest.json
builds\kb-f0\63dc7a89628d84487f13a7bc5981fb5693c602ee\smoke-checks.md
```

文件名以实际 manifest 为准，仅允许在 F0 已知 build 目录下寻找等价历史产物；不要另开 Survey 或要求不曾建立的历史 cache。必须从这些文件确认 `decision` 是 `IMPLEMENTED_CANDIDATE` 或 `NO_CHANGES_NEEDED`；`BLOCKED_BY_LOCAL_STATE` 不能装作完成。

当 `IMPLEMENTED_CANDIDATE`：仅检查 manifest 指定的实际 Candidate worktree 路径、真实 Git HEAD、modified/new file list、page hash 和 frozen base。只要 manifest 明确声明改过哪一仓，就必须存在对应候选 worktree；另一仓未改动时不得强制要求候选 worktree 存在。

当 `NO_CHANGES_NEEDED`：不要求空的 Candidate worktree、candidate commit 或文件清单存在；用两个正式 Knowledge repo 的实际 current HEAD、既有 B2/B3 pages、F0 覆盖自检作为本次 reviewed subject。先确认 F0 报告确实解释了无需改动，不能把无产物误当 NO_CHANGES_NEEDED。

历史 B2 review 实际位置：`reviews\batch-2-v1\`；旧 subject 前缀 `3b25e85` 只作历史线索，完整 SHA 必须从原报告读取。旧 PASS 仅证明旧 subject，需验证当前改动和所覆盖的页面/依赖差异；旧 Authority cache 缺失不是阻塞因素。

## 3. 冻结 subject 与禁止漂移

报告至少绑定：

```text
AUTHORITY_SHA
KB_F0_AUTHORITY_SHA
REVIEWER_ACTOR_ID
IMPLEMENTER_ACTOR_ID
BUILD_DECISION
SWAP_REPO_HEAD_OR_CODE_FINGERPRINT
SWAP_KB_OFFICIAL_HEAD_AND_DIRTY_SCOPE
MICROWAVE_KB_OFFICIAL_HEAD_AND_DIRTY_SCOPE
SWAP_KB_CANDIDATE_HEAD_OR_UNCHANGED
MICROWAVE_KB_CANDIDATE_HEAD_OR_UNCHANGED
REVIEWED_PAGE_LIST_AND_SHA256
REVIEWED_PRIMARY_HOMES_AND_DEPENDENCIES
HISTORICAL_B2_REVIEW_SUBJECT_AND_FINDINGS
GBRAIN_SOURCE_BINDINGS_AND_INDEX_SUBJECT_OR_UNBOUND
```

候选受审 Markdown/依赖有未提交 dirty 改动则不得对 Git HEAD 声称 VERIFIED；无关 dirty 可登记而不清理。Candidate worktree 必须与正式工作树隔离，且不被正式 GBrain Source 自动索引；索引隔离不能证明时记录风险并禁发布，不能伪称已隔离。

## 4. 一轮完整独立验证的十项检查

- `F1-VR-01` 先对照 F0 scope/manifest：候选真实存在、无越权变更、新增/更新/复用统计与 Git diff 完全一致；NO_CHANGES_NEEDED 分支要证据充分。
- `F1-VR-02` 入口导航实际通向 B2/B3 主知识页面，断链/错链/别名与 Primary Home 不冲突。
- `F1-VR-03` NCE GET 日志输入的真实入口、配置形态、适用条件与失败/未知边界有源码或权威文档定位。
- `F1-VR-04` Device DB 输入及 legacy C++ parser、Java supplemental parser 的真实职责、覆盖和冲突/例外有 Evidence；不得预设全覆盖、无损或固定优先级。
- `F1-VR-05` 两输入路径形成 Source MML 的真实汇合与调用接口有当前代码定位；不虚构不存在的具名组件。
- `F1-VR-06` Source MML 到 `SwapParam`、`SwapService#doTransfer`、`*Module / AbstractTransfer`、module txt、结果 merge、最终 JNI/C++/cfg.ini GET→SET 的责任边界清晰；DB→MML 与后段 GET→SET 不混淆。
- `F1-VR-07` Feature/Frontend Scenario/Module/MML 不被一对一等同；设备/版本/主控/板卡/端口条件按实际资料，不将 Unknown 扩写为支持。
- `F1-VR-08` `swap-kb` 项目实现与 `microwave-kb` 设备/MML 真相各有 Primary Home，跨库指向真实可定位页面，不维护互相冲突的两套权威矩阵。
- `F1-VR-09` 逐条复核历史 B2 finding 与已知 B3 缺口，只按当前 subject 的 Evidence 判断是否关闭；不得因为模型回答顺畅或旧 HEAD PASS 就判新 HEAD VERIFIED。
- `F1-VR-10` 至少用文件/链接导航复现一条新增设备/版本/特性适配路径，包含一个 Unknown/负例。若有确实只读且索引 subject 已绑定的 GBrain query，可增加检索验证；若未绑定，不把 GBrain 的旧索引结果当候选验证，文件导航验证仍可完成。

独立检查必须既验证 F0 改动也覆盖受其影响的整个主链，不限于改过的几行；无需为了证明旧工作全局完成而扩大成全仓扫描。

## 5. Finding、Decision 与下一门禁

Finding 用 P0/P1/P2/P3，包含 id、severity、位置、claim、依据、影响、最小修复。P0/P1 直接阻塞；P2 默认整改，只有 Reviewer 有证据证明对当前 subject 不构成发布风险才允许 defer；P3 记录不阻塞。

Decision 三选一：

- `F1_APPROVED_CANDIDATE`：所有十项 obligations 有有效证据，当前实际受检 subject 可作为发布候选；**不是** PUBLISHED / BASELINED / GBrain VERIFIED。
- `F1_REMEDIATION_REQUIRED`：存在阻塞 Finding；下一 Gate 为 `KB_F0_CANDIDATE_REMEDIATION`，仅由后续独立写授权执行。
- `F1_REVIEW_BLOCKED`：无法冻结真实 subject、缺关键 evidence、Reviewer 不独立或索引隔离对安全完成审核产生无法界定的风险；下一 Gate `BLOCKED_BY_LOCAL_STATE`。

通过时下一 Gate 固定 `KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION`，下一任务先建立正式仓与 GBrain Source 的目标 commit 组合，再由独立发布 Gate 受控同步/验收。**本任务不执行发布**。

## 6. WRITE_SCOPE

除已授权的只读 Authority 缓存，唯一写入范围：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\kb-f1\<AUTHORITY_SHA>\review-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\kb-f1\<AUTHORITY_SHA>\findings.json
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\kb-f1\<AUTHORITY_SHA>\subject-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\kb-f1\<AUTHORITY_SHA>\navigation-checks.md
```

禁止修改正式 `swap-kb` / `microwave-kb` 工作树、任何 candidate、Swap 源码、Raw Sources、已存在 Review/Remediation/Baseline、GBrain Source/DB/index；不 sync/extract/reinit，不上传私有内容，不 clone/fetch/pull/checkout Framework 仓库。

## 7. 完成条件与短回执

只有本地四个审查 Artifact 真实存在、subject 可重现、十项均有结论、历史 B2 Review 正确处理、实际 current Git 状态有记录，才返回 COMPLETE。若是 NO_CHANGES_NEEDED，无新 Candidate worktree 并不构成失败。

```text
KB_F1_REVIEW_COMPLETE
decision: F1_APPROVED_CANDIDATE | F1_REMEDIATION_REQUIRED | F1_REVIEW_BLOCKED
build_mode: IMPLEMENTED_CANDIDATE | NO_CHANGES_NEEDED
findings: P0=<n> P1=<n> P2=<n> P3=<n>
reviewed_swap_subject: <40-char-sha>
reviewed_microwave_subject: <40-char-sha>
next_gate: KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION | KB_F0_CANDIDATE_REMEDIATION | BLOCKED_BY_LOCAL_STATE
```

若没有证据可开始：

```text
KB_F1_REVIEW_BLOCKED
reason: <一句不含敏感内容的具体原因>
```

结束后停止，不自动修复，不自动发布。
