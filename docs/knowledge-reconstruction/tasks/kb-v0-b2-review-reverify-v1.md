# KB-V0-B2：Batch #2 独立 Review / Re-Verification V1

状态：`CURRENT TASK / INDEPENDENT READ-ONLY REVIEW`
跟踪：Issue #106
上位设计：`docs/knowledge-reconstruction/architecture/overall-design-v1.md`
前置状态恢复 Authority：`ff592837c82c4bbb2010f90315aa828e3f797f42`

## 1. Goal

对 Batch #2：`Core Swap Processing Architecture` 的当前可识别 Knowledge subject 完成独立 Review 或 Remediation 后 Re-Verification，收口 B2 的独立 Gate。

本任务不重做 B2 Reconstruction，不开始 B3/B4，不修改正式 Knowledge。

## 2. Required Starting Facts

必须先读取 KB-R0 本地输出：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\reconciliation\kb-r0\ff592837c82c4bbb2010f90315aa828e3f797f42\state-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\reconciliation\kb-r0\ff592837c82c4bbb2010f90315aa828e3f797f42\state-reconciliation.md
<SwapRepo>\.ai-local\knowledge\reconstruction\reconciliation\kb-r0\ff592837c82c4bbb2010f90315aa828e3f797f42\next-gate.md
```

确认其中：

- `nextGate = KB_V0_B2_REVIEW_OR_REVERIFY`；
- B2 当前派生状态；
- `swap-kb` / `microwave-kb` HEAD 与 dirty 状态；
- 最近 B2 Review / Remediation / Reverification subject；
- GBrain Source binding / index subject 状态。

如果 KB-R0 输出缺失、互相冲突，或 nextGate 不是本任务：`BLOCKED_BY_AUTHORITY`。

## 3. Review Mode Selection

根据 KB-R0 的 B2 状态选择且只选择一个模式：

| KB-R0 B2 状态 | 本轮模式 |
| --- | --- |
| `IMPLEMENTED_NOT_REVIEWED` | `FULL_INDEPENDENT_REVIEW` |
| `REMEDIATION_REQUIRED` 且存在后续 remediation commit/artifact | `FULL_REMEDIATION_REVERIFICATION` |
| `REMEDIATED_NOT_REVERIFIED` | `FULL_REMEDIATION_REVERIFICATION` |
| `VERIFIED_NOT_BASELINED` 但当前 Knowledge HEAD 已超出 reviewed subject | `CURRENT_SUBJECT_REVERIFICATION` |
| `BASELINED` 但当前 HEAD 已超出 baseline/review subject | `CURRENT_SUBJECT_REVERIFICATION` |
| `UNKNOWN` / `BLOCKED` | `BLOCKED_BY_LOCAL_STATE` |

如果历史 artifact 已有有效 review，必须复用它的 findings/subject，不重新发明一套 finding 历史。

## 4. Subject Freeze

本轮开始时记录：

```text
AUTHORITY_SHA
REVIEW_MODE
SWAP_KB_HEAD
SWAP_KB_BRANCH
SWAP_KB_DIRTY
MICROWAVE_KB_HEAD
MICROWAVE_KB_BRANCH
MICROWAVE_KB_DIRTY
B2_TARGET_PAGES
B2_TARGET_PAGE_HASHES
HISTORICAL_REVIEW_SUBJECT
HISTORICAL_REMEDIATION_SUBJECT
GBRAIN_VERSION
GBRAIN_SOURCE_BINDINGS
```

若 B2 target page 或其 Primary Home/shared dependency 存在未提交修改，不能对 committed HEAD 声称 VERIFIED；记录 `BLOCKED_BY_DIRTY_B2_SUBJECT`。

其他无关 dirty 文件不得自动清理；若能证明与 B2 scope 无关，可记录 `DIRTY_OUTSIDE_REVIEW_SCOPE` 后继续。

## 5. B2 Canonical Scope

Batch #2 核心链必须覆盖：

```text
SwapParam
  -> SwapService#doTransfer
  -> *Module / AbstractTransfer
  -> module txt / relevant GET MML
  -> device-specific specialization / XML applicability
  -> module result merge
  -> JNI / C++
  -> cfg.ini GET->SET mapping
  -> final SET output boundary
```

并验证：

- 前端/UI 初始化聚合是概念阶段，不能虚构不存在的具名组件；
- `Feature != Processing Module`；
- `Frontend Scenario != Processing Module`；
- `MML != Processing Module`；
- module txt 表示 Relevant Input，不自动证明 unique ownership；
- 区分 `Relevant Input`、`Context-only Consumption`、`Actual Transformation`；
- 不得无 Evidence 声称固定全局 Module 顺序；
- Module 业务转换与 JNI/C++/`cfg.ini` 最终 GET->SET formatting 分责；
- XML/Bean 设备限制、版本/板卡/端口约束按实际代码/配置解释，缺省含义不能泛化；
- `SwapService#doTransfer` merge/aggregation 结论必须有真实代码路径 Evidence。

B3 的 Source Configuration Ingestion & Normalization 只检查与 B2 的接口点，不重新审查 B3。

## 6. Evidence Sources

优先级：当前 Swap 源码/配置；对应 Test/Runtime Evidence（若历史已有）；B2 Reconstruction/Review/Remediation Artifact；适用正式产品/MML资料；旧 Wiki 仅 clue。

本轮可以只读检查 Swap 源码/配置、`D:\gbrain-knowledge\swap-kb\`、必要的 `microwave-kb`、B2 历史 Artifact、B2 Evidence 中明确引用的 Raw Source、以及 GBrain 明确只读的 query/status。

禁止为了补 Evidence 运行会修改产品、Knowledge Repo 或 GBrain 索引的命令。

## 7. Review Obligations

### B2-VR-01 — Architecture Chain Completeness
当前 B2 页面能否从 `SwapParam` 到 GET->SET boundary 解释主处理链，且没有把 B3 输入规范化混成 B2 内部职责。

### B2-VR-02 — Semantic Ownership
Feature / Frontend Scenario / Module / MML 的层级和 owner 正确，没有虚构一对一映射。

### B2-VR-03 — Module txt Semantics
所有强表述有代码依据；module txt 仅出现不等于 actual transformation 或 unique ownership。

### B2-VR-04 — Module Order / Merge
固定执行顺序、merge、遍历等陈述与真实实现一致；无固定顺序时不得写死。

### B2-VR-05 — Device Specialization
XML/Bean/subclass applicability、设备/版本/板卡限制真实，不把未验证缺省语义写成全局规则。

### B2-VR-06 — Business Transformation vs Formatting
Module 业务转换与 JNI/C++/`cfg.ini` 最终 GET->SET 映射责任清晰分离。

### B2-VR-07 — Current Truth / Evidence Strength
关键 Claim 强度不超过 Evidence；Current Truth、Unknown、历史/计划分开。

### B2-VR-08 — Primary Home / Cross-link
Swap-specific architecture Primary Home 在 `swap-kb`；领域 MML/设备 truth 不重复复制，必要时跨库引用。

### B2-VR-09 — Historical Findings Regression
完整读取 B2 历史 independent review findings 与 remediation；逐项确认旧 finding 在当前 subject 上真正关闭。

### B2-VR-10 — Query Validation
用现有 GBrain 只读查询或历史 query harness 验证至少覆盖：SwapParam 到 Module、module txt 含义、设备 specialization、Module result merge、GET->SET 最终责任，以及一个明确 Unknown/负例。

若 GBrain index subject 无法绑定当前 Knowledge content，不把 query PASS 当 current-subject VERIFIED Evidence；记录 `QUERY_SUBJECT_UNBOUND`，内容审查仍可继续。

## 8. Severity / Decision

Finding 使用 `P0/P1/P2/P3`。

- P0/P1：阻塞 B2 VERIFIED；
- P2：默认需要 remediation，只有 Reviewer 明确证明不影响当前使用范围时才可 defer；
- P3：记录性，不阻塞。

Decision 只能是：

- `B2_VERIFIED_CURRENT_SUBJECT`
- `B2_REMEDIATION_REQUIRED`
- `B2_REVIEW_BLOCKED`

## 9. WRITE_SCOPE

本任务默认只读，只允许写新的 Review/Reverification 结果：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\batch-2\<AUTHORITY_SHA>\review-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\batch-2\<AUTHORITY_SHA>\findings.json
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\batch-2\<AUTHORITY_SHA>\subject-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\batch-2\<AUTHORITY_SHA>\query-validation.md
```

Authority cache 按 `operations/authority-sync.md` 允许写入。

禁止修改 `swap-kb` / `microwave-kb`、既有 B2 Reconstruction/Remediation/Review、Raw Sources、Swap production code、GBrain DB/index/source config。

## 10. Current-head Rule

旧 PASS 只对旧 subject 有效。

如果当前 `swap-kb` HEAD 与历史 B2 VERIFIED subject 不同：

- 检查差异是否触及 B2 target pages、Primary Home、引用关系或 supporting code/config Evidence；
- 若触及，当前 subject 按 B2-VR-01～10 完整重证；
- 若完全无关，Reviewer 可用具体 diff Evidence 证明历史结论仍覆盖，并在当前 report 写清继承边界。

不能只验证 remediation 那几行就声明整个 B2 current subject VERIFIED。

## 11. Next Gate

若 `B2_VERIFIED_CURRENT_SUBJECT`：

- KB-R0 中 B3 未达到 VERIFIED：`NEXT_GATE = KB_V0_B3_REVIEW_OR_REVERIFY`；
- B3 已 VERIFIED 但当前 Knowledge HEAD 超出其 subject：`NEXT_GATE = KB_V0_CURRENT_HEAD_REVERIFY`；
- B2/B3 与 current HEAD 均有有效覆盖，但 Baseline/GBrain published subject 未绑定：`NEXT_GATE = KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION`。

若 `B2_REMEDIATION_REQUIRED`：`NEXT_GATE = KB_B2_REMEDIATION`。
若 blocked：`NEXT_GATE = BLOCKED_BY_LOCAL_STATE`。

本任务不能自动执行 NEXT_GATE。

## 12. Final Receipt

成功审查后只返回：

```text
KB_V0_B2_REVIEW_COMPLETE
mode: FULL_INDEPENDENT_REVIEW | FULL_REMEDIATION_REVERIFICATION | CURRENT_SUBJECT_REVERIFICATION
decision: B2_VERIFIED_CURRENT_SUBJECT | B2_REMEDIATION_REQUIRED | B2_REVIEW_BLOCKED
findings: P0=<n> P1=<n> P2=<n> P3=<n>
reviewed_swap_head: <40-char-sha>
next_gate: KB_B2_REMEDIATION | KB_V0_B3_REVIEW_OR_REVERIFY | KB_V0_CURRENT_HEAD_REVERIFY | KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION | BLOCKED_BY_LOCAL_STATE
```

无法开始/完成时：

```text
KB_V0_B2_REVIEW_BLOCKED
reason: <一句不含内部敏感内容的原因>
```

完成后停止，不自动修复、不自动进入 B3。
