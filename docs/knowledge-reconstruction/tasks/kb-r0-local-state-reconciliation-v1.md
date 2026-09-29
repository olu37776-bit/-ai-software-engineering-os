# KB-R0：本机 Knowledge Reconstruction 真实状态恢复 V1

状态：`CURRENT TASK / READ-ONLY RECONCILIATION`
跟踪：Issue #104
上位设计：`docs/knowledge-reconstruction/architecture/overall-design-v1.md`

## 1. Context

KB-D0 总体设计已经独立审查通过并合并。远端当前只能确认设计与用户回报，不能直接访问本机 GBrain、两个 Knowledge Repo、Swap 源码仓和既有 `.ai-local` Evidence。

历史聊天曾对 Batch #2 / Batch #3 的最终 Gate 状态出现记忆不一致，因此本任务只从本机真实 Artifact 恢复状态，不根据聊天重新推断，也不重做 Survey。

本任务是状态恢复，不是 Knowledge Reconstruction、Remediation、Verification 或发布任务。

## 2. Proven Facts

当前长期本地资产边界：

- 正式项目知识：`D:\gbrain-knowledge\swap-kb\`
- 正式领域知识：`D:\gbrain-knowledge\microwave-kb\`
- Raw Sources：`D:\swap-knowledge-sources\`
- 本地治理根：`<SwapRepo>\.ai-local\knowledge\reconstruction\`
- Authority cache：`<SwapRepo>\.ai-local\knowledge\reconstruction\authority-cache\<AUTHORITY_SHA>\`

已知建设主题：Survey V1、Golden Slice #1、Knowledge Construction Convention V1、Batch #2（Core Swap Processing Architecture）、Batch #3（Source Configuration Ingestion & Normalization）。

这些名称只用于定位 Artifact；最终状态必须由本机文件、Git 或 GBrain 只读事实重新证明。

## 3. Target State

完成后必须能够回答：

1. Survey V1 / Golden Slice #1 / Convention V1 / 当前 Baseline 实际存在在哪里、状态是什么；
2. Batch #2 的真实证据链走到哪一步；
3. Batch #3 的真实证据链走到哪一步；
4. `swap-kb` 和 `microwave-kb` 当前实际 HEAD、分支、clean/dirty 状态；
5. 既有 Review / Remediation / Verification 绑定的是哪些 Knowledge Repo subject；
6. 当前 Knowledge Repo HEAD 是否比最近被验证 subject 更新；
7. GBrain 中 `swap-kb` / `microwave-kb` Source 是否仍绑定预期本地目录；
8. 当前 GBrain 索引是否能够精确绑定到已验证 Knowledge commit；不能则记录 `INDEX_SUBJECT_UNBOUND`；
9. 下一步唯一合法 Gate 是什么。

不得在本任务中修复任何发现的问题。

## 4. Required Inputs

优先读取既有本地治理目录，按存在情况展开，不要求所有路径都必须存在：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\survey-v1\
<SwapRepo>\.ai-local\knowledge\reconstruction\conventions\v1\
<SwapRepo>\.ai-local\knowledge\reconstruction\baselines\
<SwapRepo>\.ai-local\knowledge\reconstruction\batches\batch-2\
<SwapRepo>\.ai-local\knowledge\reconstruction\batches\batch-3\
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\
<SwapRepo>\.ai-local\knowledge\reconstruction\remediation\
<SwapRepo>\.ai-local\knowledge\reconstruction\coverage\
```

读取两个正式 Knowledge Repo 的 Git metadata 与实际工作树状态：

```text
D:\gbrain-knowledge\swap-kb\
D:\gbrain-knowledge\microwave-kb\
```

Raw Sources 本轮只允许用于确认既有 Evidence 引用目标是否仍存在；不要重新分析内容：`D:\swap-knowledge-sources\`。

Supporting Authority：

- `docs/knowledge-reconstruction/architecture/overall-design-v1.md`
- `docs/knowledge-reconstruction/operations/authority-sync.md`

## 5. WRITE_SCOPE

只允许新建本次 reconciliation 输出：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\reconciliation\kb-r0\<AUTHORITY_SHA>\state-reconciliation.md
<SwapRepo>\.ai-local\knowledge\reconstruction\reconciliation\kb-r0\<AUTHORITY_SHA>\state-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\reconciliation\kb-r0\<AUTHORITY_SHA>\next-gate.md
```

以及 Authority delivery protocol 已允许的：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\authority-cache\<AUTHORITY_SHA>\
```

其他路径一律只读。

## 6. OUT_OF_SCOPE

禁止：

- 修改、提交、reset、clean `swap-kb` 或 `microwave-kb`；
- 修改任何 Knowledge Page；
- 修改 Raw Sources；
- 修改 Swap production code；
- 重新执行 Survey / Golden Slice / B2 / B3 Reconstruction；
- 创建 Batch #4；
- 修改已有 Baseline / Convention / Review / Remediation Artifact；
- 运行 `gbrain sync`、`gbrain extract`、`gbrain reinit-pglite`、forget/write 类命令；
- 删除或重建 GBrain DB / Source；
- 为修复 dirty worktree 自动 stash/reset/checkout；
- 上传内部 Artifact 到 GitHub。

如果现有工作树 dirty，只记录，不清理。

## 7. Execution Phases

### R0-1：固定本地 subject

记录 `AUTHORITY_SHA`、Swap Repo 根目录、governance root 是否存在、当前时间、当前任务实际读取文件。不得扫描磁盘猜 Swap Repo，当前 Workspace 无法证明即 BLOCKED。

### R0-2：恢复历史治理链

对 Survey V1、Golden Slice #1、Convention V1、Baseline：找到实际路径；读取最终状态/Decision；关联 Review / Remediation / Verification；不能因文件名带 final/verified 就判 PASS；多版本必须按 subject、时间和显式状态确定；冲突无法裁决则 `UNKNOWN`。

### R0-3：恢复 Batch #2 证据链

至少分别记录：

```text
reconstruction
independentReview
remediation
independentReverification
baselineInclusion
reviewedKnowledgeHeads
latestDecision
```

派生状态只允许：

- `BASELINED`
- `VERIFIED_NOT_BASELINED`
- `REMEDIATED_NOT_REVERIFIED`
- `REMEDIATION_REQUIRED`
- `IMPLEMENTED_NOT_REVIEWED`
- `BLOCKED`
- `UNKNOWN`

不能因为聊天中“做过”而补齐缺失 Evidence。

### R0-4：恢复 Batch #3 证据链

使用与 Batch #2 相同字段和状态词。重点确认 Reconstruction、Independent Review、Remediation、Remediation Reverification、Baseline Inclusion 是否实际存在。缺一步只报告，不立即补做。

### R0-5：固定两个 Knowledge Repo 当前状态

每个 Repo 至少记录：路径存在性、是否 Git Repo、current HEAD、branch/detached、working tree clean/dirty、staged/unstaged/untracked、最近相关 commit 摘要、当前 HEAD 是否等于已验证 subject；若 HEAD 更新，列出“已验证 subject → 当前 HEAD”之间的 commit 范围，但不得解释为已验证。

### R0-6：只读核对 GBrain

首先只允许查看本机实际 CLI help/version：

```text
gbrain --version
gbrain --help
gbrain sources --help
```

如果当前版本命令不同，根据 help 选择明确只读的 version/list/status/stats 命令。

只读确认 GBrain 版本、`swap-kb`/`microwave-kb` Source 是否存在、local path 是否等于预期目录，以及是否存在能证明索引内容绑定具体 Knowledge Repo commit 的 metadata/Evidence。

禁止运行会改变索引/DB 的命令。若没有可证明的 commit binding：`indexSubject = INDEX_SUBJECT_UNBOUND`。不得根据 mtime 推断。

### R0-7：确定唯一下一 Gate

只选择一个：

- `KB_V0_B2_REVIEW_OR_REVERIFY`
- `KB_V0_B3_REVIEW_OR_REVERIFY`
- `KB_V0_CURRENT_HEAD_REVERIFY`
- `KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION`
- `BLOCKED_BY_LOCAL_STATE`

选择规则：

1. B2 未达到 VERIFIED → 优先 B2；
2. B2 已 VERIFIED、B3 未达到 VERIFIED → B3；
3. B2/B3 都有历史 VERIFIED，但当前 Knowledge HEAD 超出受检 subject → CURRENT_HEAD_REVERIFY；
4. B2/B3 和当前 HEAD 都被有效独立结论覆盖，但 Baseline / GBrain published subject 未绑定 → KB-P0；
5. 证据冲突且无法只读裁决 → BLOCKED。

本任务不能执行所选 Gate。

## 8. Evidence Rules

每项结论必须附本机定位信息。推荐字段：

```text
LOCAL_ARTIFACT_EVIDENCE=
GIT_EVIDENCE=
GBRAIN_READONLY_EVIDENCE=
AUTHORITY_EVIDENCE=
```

不要新造 `CODE_EVIDENCE`、`TEST_EVIDENCE`、`QUERY_EVIDENCE`，除非它们已经存在于历史 Artifact 且本任务只是引用。历史 PASS 只对原 subject 有效。

## 9. Required Outputs

`state-reconciliation.md` 至少包含：Authority Subject、Local Governance Root、Survey/Golden Slice/Convention/Baseline、B2 Evidence Chain、B3 Evidence Chain、两个 Knowledge Repo Current State、GBrain Source Binding、Index Subject Binding、Conflicts/Unknowns、Derived Current State、Next Legal Gate。

`state-manifest.json` 至少包含：`authoritySha`、`swapRepo`、`survey`、`goldenSlice`、`convention`、`baseline`、`batch2`、`batch3`、`swapKb`、`microwaveKb`、`gbrain`、`indexSubject`、`conflicts`、`nextGate`。

`next-gate.md` 只解释为什么选择该唯一 Gate、前置条件以及明确禁止提前执行什么。

## 10. Completion Gate

成功必须同时满足：

- 未修改正式 Knowledge / Raw Source / production code；
- Survey / Golden Slice / Convention / Baseline 已定位或明确 UNKNOWN；
- B2、B3 证据链已恢复；
- 两个 Knowledge Repo HEAD/dirty 状态已记录；
- GBrain 两个 Source 绑定已只读核对或明确无法核对；
- index subject 有 binding 或明确 `INDEX_SUBJECT_UNBOUND`；
- 已选唯一下一 Gate；
- 所有不确定项均未猜测。

## 11. Final Receipt

成功只返回：

```text
KB_R0_LOCAL_STATE_RECONCILED
B2: BASELINED | VERIFIED_NOT_BASELINED | REMEDIATED_NOT_REVERIFIED | REMEDIATION_REQUIRED | IMPLEMENTED_NOT_REVIEWED | BLOCKED | UNKNOWN
B3: BASELINED | VERIFIED_NOT_BASELINED | REMEDIATED_NOT_REVERIFIED | REMEDIATION_REQUIRED | IMPLEMENTED_NOT_REVIEWED | BLOCKED | UNKNOWN
KNOWLEDGE_REPOS: CLEAN | DIRTY | MIXED | UNKNOWN
GBRAIN_SOURCES: BOUND | PARTIAL | UNBOUND | UNKNOWN
INDEX_SUBJECT: BOUND | INDEX_SUBJECT_UNBOUND | UNKNOWN
NEXT_GATE: KB_V0_B2_REVIEW_OR_REVERIFY | KB_V0_B3_REVIEW_OR_REVERIFY | KB_V0_CURRENT_HEAD_REVERIFY | KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION | BLOCKED_BY_LOCAL_STATE
```

失败只返回：

```text
KB_R0_LOCAL_STATE_BLOCKED
reason: <一句不包含内部敏感信息的核心原因>
```

完成后停止，不自动进入下一 Gate。
