# KB-V0-B3：由 B2 Gate 直接执行 B3 独立 Review / Re-Verification V1（已废止）

> **STOP：本任务存在错误前置假设。** 它要求一个本地未产生的 `reviews/batch-2/f2e4e473...` 目录，不得用它阻塞既有 `reviews/batch-2-v1/` 历史证据。CURRENT Task 已切换为 `tasks/kb-f0-existing-assets-fast-build-v1.md`（Issue #112），先在独立候选 worktree 复用已有资产建设，再集中独立验证。此文件仅保留历史追溯，不授权执行。

状态：`SUPERSEDED / DO NOT EXECUTE`
跟踪：Issue #110
上位设计：`docs/knowledge-reconstruction/architecture/overall-design-v1.md`
历史 B2 Authority SHA：`f2e4e473bc70590ac5132a87733c78231396ed50`
历史 KB-R0 Authority SHA：`ff592837c82c4bbb2010f90315aa828e3f797f42`

> 此任务合并“读取 B2 审查结果”与“真正执行 B3 独立 Gate”，无需再开一次状态调查。只有 B2 通过且选定下一 Gate 为 B3 时才能执行 B3；任何前置门禁不满足均直接停在 B2 对应 Gate。

## 1. 目标与事实约束

用户回报 B2 独立审查已完成，但远端没有拿到可证明 B2 精确 Decision 的本地短回执。B2 的结果只由本机既有 `review-report.md`、`subject-manifest.json`、`findings.json`、`query-validation.md` 及真实 Knowledge Git 状态确定。不要靠聊天中的“好了”判 B2 VERIFIED。

B3 主题为 `Source Configuration Ingestion & Normalization`：NCE 采集日志携带 GET 形式源配置；设备数据库文件经旧 C++ 转换与后续 Java 补充转换为 MML；二者在 Source MML 视图汇合后进入 B2 处理链。这只是调查线索，具体边界、顺序、覆盖及差异要读真实源码/配置/文档证明。

本任务不得自动重建、修改或发布知识；独立 Reviewer 只读事实源并写新的本地 B3 Review Evidence。

## 2. 必须读取的前置 Evidence

先从本机既有 `<SwapRepo>\.ai-local\knowledge\reconstruction\` 读取：

```text
reconciliation\kb-r0\ff592837c82c4bbb2010f90315aa828e3f797f42\state-manifest.json
reconciliation\kb-r0\ff592837c82c4bbb2010f90315aa828e3f797f42\state-reconciliation.md
reviews\batch-2\f2e4e473bc70590ac5132a87733c78231396ed50\review-report.md
reviews\batch-2\f2e4e473bc70590ac5132a87733c78231396ed50\findings.json
reviews\batch-2\f2e4e473bc70590ac5132a87733c78231396ed50\subject-manifest.json
reviews\batch-2\f2e4e473bc70590ac5132a87733c78231396ed50\query-validation.md
```

若历史报告实际文件名不同，只能在上述 Batch #2 Review subject 目录内按历史 manifest 查找其等价文件；不得凭空补造。任何必要 evidence 缺失、互相矛盾或不是该 exact Authority SHA 的 subject，返回 `B2_GATE_NOT_ESTABLISHED`，不开始 B3。

读 B2 的 `decision`、`next_gate`、P0/P1/P2/P3、`reviewed_swap_head`、实际相关页面及 `microwave-kb` subject。核对当前两知识仓 Git HEAD、相关 worktree dirty 状态。B2 若已通过但之后更改了 B2 受审页面/Primary Home/依赖，且无后续有效独立证明，也不得继承 PASS。

**前置 Gate 必须同时满足**：

- `decision = B2_VERIFIED_CURRENT_SUBJECT`；
- `next_gate = KB_V0_B3_REVIEW_OR_REVERIFY`；
- B2 的精确 subject / 当前 B2 相关内容仍被有效 Evidence 覆盖。

否则直接输出 `KB_V0_B3_PRECONDITION_BLOCKED`，并记录 B2 报告要求的 `next_gate`；不得执行 B3。若 B2 的 next_gate 是 `KB_V0_CURRENT_HEAD_REVERIFY`、`KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION` 或 `KB_B2_REMEDIATION`，必须保留它，而不是强行进入 B3。

## 3. B3 Mode Selection

按 KB-R0 的 B3 派生状态及最新已有 B3 Review/Remediation subject 选择：

| 状态 | B3 模式 |
| --- | --- |
| `IMPLEMENTED_NOT_REVIEWED` | `FULL_INDEPENDENT_REVIEW` |
| `REMEDIATED_NOT_REVERIFIED` | `FULL_REMEDIATION_REVERIFICATION` |
| `REMEDIATION_REQUIRED` 且确实存在后续修复 commit/artifact | `FULL_REMEDIATION_REVERIFICATION` |
| `VERIFIED_NOT_BASELINED` 或 `BASELINED`，但 B3 相关 Knowledge 内容已有变化 | `CURRENT_SUBJECT_REVERIFICATION` |
| `VERIFIED_NOT_BASELINED` 或 `BASELINED`，当前完整 subject 与已有独立审查完全一致且有效 | `EXISTING_VERIFICATION_REUSE`，仅记录证据并判断下一 Gate，不重复作无意义审查 |
| `BLOCKED`、`UNKNOWN`、冲突或未提交的 B3 受审内容 | `B3_REVIEW_BLOCKED` |

有有效旧 Review 必须回归其 Findings；不得另造与历史冲突的 finding IDs。已 VERIFIED 而当前 HEAD 变化时应先对差异作精确 scope 证明；若无关，保留历史有效范围，若涉及 B3 页面/关系/核心 Evidence，执行完整 B3-VR-01～10。

## 4. Subject Freeze

开始审查前冻结并写入 subject manifest：

```text
AUTHORITY_SHA
B2_PRIOR_AUTHORITY_SHA
B2_DECISION_AND_NEXT_GATE
B2_REVIEWED_SUBJECT
B3_REVIEW_MODE
SWAP_REPO_HEAD_OR_WORKTREE_FINGERPRINT
SWAP_KB_HEAD_BRANCH_DIRTY
MICROWAVE_KB_HEAD_BRANCH_DIRTY
B3_TARGET_PAGES_AND_HASHES
B3_PRIMARY_HOME_AND_SHARED_DEPENDENCIES
KNOWN_B3_HISTORICAL_REVIEW_REMEDIATION_SUBJECTS
GBRAIN_VERSION_AND_SOURCE_BINDINGS
GBRAIN_INDEX_SUBJECT_BINDING_OR_UNBOUND
```

不得把存在未提交变更的 B3 target pages 视为 committed HEAD 已 VERIFIED。相关 dirty 内容导致 subject 不能冻结时停止；无关 dirty 可记录范围后继续，不 stash/reset。

## 5. B3 Canonical Scope

必须分别核对：

1. NCE 采集配置日志：数据实际来源、输入文件/日志形态、GET MML（或事实证明的其他形式）、读取/解析入口和错误处理。
2. 设备数据库输入：文件格式/适配路径、legacy C++ parser 的真实角色、Java supplemental parser 的真实角色；映射、覆盖、重复/冲突处理和不能证明的部分。
3. 两路转换汇合：何处形成供 Swap 使用的 Source MML；若并非单一具名对象/阶段，按真实流程表达，不能虚构 `SourceMML` 类。
4. 与 B2 的接口：真实进入公共处理链的调用/数据依赖，以及异常、缺失或不支持输入的行为。
5. Coverage boundary：相同 Feature/MML/参数在 NCE 和 DB 路径的覆盖、缺失、差异及适用范围；不能未经证明宣称完全等价、无损、固定优先级。
6. 责任边界：DB→MML 源规范化不同于模块业务转换，也不同于后段 JNI/C++/`cfg.ini` GET→SET formatting；两个 C++ 阶段不能合并叙述。

## 6. Review Obligations

- `B3-VR-01` NCE 入口及 GET/日志语义准确、可定位。
- `B3-VR-02` 设备 DB 文件接入、转换链、失败边界有证据。
- `B3-VR-03` legacy C++ 与 Java supplement 的实际关系、覆盖与是否合并有代码/配置 Evidence；Unknown 不强判。
- `B3-VR-04` 两路在 Source MML 汇合的真实位置/语义，并无虚构统一组件。
- `B3-VR-05` 与 B2 主链的衔接、各自责任边界、JNI/C++ 同名不同层级无混淆。
- `B3-VR-06` MML 命令/参数、Feature、版本/设备/板卡适用条件不被扩写为全局事实。
- `B3-VR-07` Current Truth 与证据强度、未知、例外、计划/当前分离。
- `B3-VR-08` Primary Home：项目接入流程在 `swap-kb`，领域 MML/Feature 真相在 `microwave-kb`；跨库引用真实可追。
- `B3-VR-09` 逐条复核历史 B3 Review findings/remediation（如存在），并主动寻找新增问题。
- `B3-VR-10` 在只读方式可用时验证检索：NCE 输入、DB 输入、C++/Java 关系、Source MML 汇合、进入 B2、coverage unknown/负例；记录返回内容与回答真实性分离。

若 GBrain 索引 subject 无法绑定当前页内容，明确 `QUERY_SUBJECT_UNBOUND`；不能用旧查询成功冒充 current-subject VERIFIED。若当前 Gate 必须依赖但不可获得有效 Query Evidence，Decision 应 `B3_REVIEW_BLOCKED` 或附明确限定，不得无据 PASS。

## 7. Evidence 与严重度

证据使用实际本地定位，例如 `CODE_EVIDENCE`（repo/commit/path/symbol）、`CONFIG_EVIDENCE`、`SOURCE_DOCUMENT_EVIDENCE`（文件指纹/版本/章页/表格单元格）、`KNOWLEDGE_EVIDENCE`（repo HEAD/页 hash/段落）、`GIT_EVIDENCE`、`QUERY_EVIDENCE`、`GBRAIN_READONLY_EVIDENCE`、`HISTORICAL_REVIEW_EVIDENCE`。

旧 Wiki/模型生成内容只算 clue；不能单独证明 Current Truth。代码证明当前实现，不自动证明规范意图。P0/P1 必须整改；P2 默认整改，只有可具体证明不影响本次使用范围才可 defer；P3 记录不阻塞。报告逐项映射 Evidence，不把“0 finding”当无需检查。

## 8. WRITE_SCOPE（仅本地新报告）

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\batch-3\<AUTHORITY_SHA>\review-report.md
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\batch-3\<AUTHORITY_SHA>\findings.json
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\batch-3\<AUTHORITY_SHA>\subject-manifest.json
<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\batch-3\<AUTHORITY_SHA>\query-validation.md
```

还有 `operations/authority-sync.md` 明确允许的 `authority-cache\<AUTHORITY_SHA>\`。如果 B2 前置 Gate 失败，允许在上述新 B3 报告路径仅写 `review-report.md` 解释 precondition blocker，不运行 B3 审查。

## 9. OUT_OF_SCOPE

不修改任何 `D:\gbrain-knowledge\swap-kb\` / `microwave-kb\` 内容、Git commit、branch、worktree；不修改 Raw Sources、Swap 源码/配置、历史 Survey/Golden Slice/B2/B3 报告；不重建新知识页；不写入或重建 GBrain DB/Source/index，不运行 sync/extract/reinit；不改 Framework Runtime/Contract/CI；不开始 Batch #4；不上传内部文件、报告、敏感路径和内容到公开 GitHub。

只使用已证明不会修改索引/内容的 GBrain list/status/query。未知命令副作用时跳过并记录；不能以只读 Review 为由执行设备配置 MML。Reviewer 发现需整改只报告，不边查边修。

## 10. Decision 与 NEXT_GATE

前置条件失败：`KB_V0_B3_PRECONDITION_BLOCKED`，`next_gate` 取 B2 当前证据指定 Gate，或证据冲突时 `BLOCKED_BY_LOCAL_STATE`。

B3 通过：`B3_VERIFIED_CURRENT_SUBJECT`。然后结合 B2/B3 和两仓当前 subject 计算：

- 当前 B2/B3 受审内容与关联依赖的合法 subject 被全部覆盖，且存在 Baseline 或索引发布绑定缺口 → `KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION`；
- 虽有历史 PASS，但当前相关 HEAD/依赖已经改变且尚未充分复验 → `KB_V0_CURRENT_HEAD_REVERIFY`；
- 若上述都不适用但必须判定后续 Gate → `BLOCKED_BY_LOCAL_STATE` 并列出缺口。

B3 有阻塞 finding：`B3_REMEDIATION_REQUIRED`，`next_gate = KB_B3_REMEDIATION`。
B3 subject/evidence 不足：`B3_REVIEW_BLOCKED`，`next_gate = BLOCKED_BY_LOCAL_STATE`。

## 11. Completion Gate

通过必须有：B2 precondition Evidence、B3 当前 subject 冻结、B3-VR-01～10 完整覆盖、历史 finding 回归（若有）、Query/索引证据不越界、无 P0/P1、P2 合法处置、明确下一 Gate、报告实际落盘与只读边界证据。不同 head 的 PASS 不自动继承。

## 12. Short Receipt（只返回以下内容）

```text
KB_V0_B3_REVIEW_COMPLETE
b2_gate: VERIFIED_CURRENT_SUBJECT
mode: FULL_INDEPENDENT_REVIEW | FULL_REMEDIATION_REVERIFICATION | CURRENT_SUBJECT_REVERIFICATION | EXISTING_VERIFICATION_REUSE
decision: B3_VERIFIED_CURRENT_SUBJECT | B3_REMEDIATION_REQUIRED | B3_REVIEW_BLOCKED
findings: P0=<n> P1=<n> P2=<n> P3=<n>
reviewed_swap_head: <40-char-sha>
reviewed_microwave_head: <40-char-sha>
next_gate: KB_B3_REMEDIATION | KB_V0_CURRENT_HEAD_REVERIFY | KB_P0_BASELINE_AND_PUBLISH_RECONCILIATION | BLOCKED_BY_LOCAL_STATE
```

若 B2 前置失败：

```text
KB_V0_B3_PRECONDITION_BLOCKED
b2_decision: <actual>
next_gate: <actual or BLOCKED_BY_LOCAL_STATE>
```

不能完成时：

```text
KB_V0_B3_REVIEW_BLOCKED
reason: <不含内部敏感内容的一句话>
```

结束后停止，不自动 remediation、不自动发布或进入下一 Gate。
