# LF-D1：Feedback Contract 与主线接口提案

状态：`DRAFT / REVIEW_FINDINGS_ADDRESSED_PENDING_REVIEW / NO_CODE_AUTHORIZATION`  
设计起点：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
接口复核主线：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`，2026-09-08  
上一独立审查 subject：`08b701e0ca2f497eafaaa71329666d371c72cf6e`  
[CURRENT](../../roadmap/learning-feedback-branch-plan.md) · [总体设计](branch-design.md) · [开工计划](../../roadmap/learning-feedback-core-entry-plan.md) · [并行协议](parallel-development-protocol.md)

## 1. 范围与 owner

第一包仅定义 ExecutionFeedback、FeedbackResolution 两项业务语义及实际使用的用例入出边界，不新增 Runtime facts、Oracle/Gate、Context 状态或知识库。业务 owner 提案为 packages/learning；公共/持久化 Schema 唯一保存在 contracts。下述内容待独立 review，不是已激活 Schema。

GateDecision 是本次执行裁决；Feedback 是尚待满足的具体义务；Resolution 是后续已裁决事实是否覆盖该历史义务。它们不能互相替代。本次不新增 LearningCase、EvidenceGraph、NodeResult、FeedbackConsumption、Approval 或原 Phase 7 的六项 Learning Schema。

## 2. 直接复用的 Contract

| Contract | 实际来源与限制 |
| --- | --- |
| NodeExecutionIdentity | `packages/contracts/schemas/node/node-execution-identity.schema.json`：runId/nodeId/executionId/attempt；attempt >= 1，不按 Node 名称猜身份 |
| SubjectRef | `packages/contracts/schemas/common/subject-ref.schema.json`：subjectType/subjectId，subjectVersion 可选；LF 对版本化 criterion/definition 的消费要求更严，缺失即 gap，不修改原 Schema |
| SchemaRef | `packages/contracts/schemas/common/schema-ref.schema.json`：schemaId/schemaVersion/schemaHash |
| EvidenceMetadata | `packages/contracts/schemas/evidence/evidence-metadata.schema.json`：executionRef 可选；缺对应执行来源不能自行补造 |
| GateDecision | `packages/contracts/schemas/verification/gate-decision.schema.json`：subject/plan/policy/assessment/Evidence 与七种 outcome |
| ProjectionCheckpoint | 现有 canonical 类型；不能据此假定任意 facts query provider 已存在 |
| NodeExecutionRecord/ContextSnapshot/VerificationAssessment | planned 主线 Contract；LF 不实现其 owner，不导入假想 Repository |

公开入口为 `@aseos/contracts`，`src/index.ts` 导出；类型绑定来自 type-bindings.json。禁止 deep import、平行身份类型或把存在 Schema 当作来源真实/已提交的证明。上游 Schema 的 uniqueItems 只约束去重，不自动声明数组是集合；LF 哈希的消费语义在 §7.2 单独列明，不修改上游签名/原始哈希。

## 3. 输入和信任边界

### FeedbackProjectionInput

| 字段 | 内容与来源 | 不满足时 |
| --- | --- | --- |
| execution | NodeExecutionIdentity | INVALID_INPUT |
| sourceGate | 按现有 Schema 校验的 GateDecision | 未知版本/outcome 拒绝 |
| sourceContractRef / criterionRefs | 固定版本与 hash；可恢复历史语义 | INCONCLUSIVE，不用最新 Contract 替代旧义务 |
| criterionAssessments | Verification 已有逐项裁决的投影；每项 assessmentRef、criterionRef、outcome、evidenceRefs | 不从退出码/日志自由推断；无 producer 时仅 fixture |
| constraints | 原 Contract 的相关约束，每项 constraintRef、sourceRef 和要求内容 | 不发明约束；同 constraintRef 不同内容拒绝 |
| closureRequirements | 原要求，每项 requirementRef、criterionRef、来源版本及关闭要求 | requirementRef 固定一个原子义务，不依赖数组位置生成身份 |
| evidence | 所需 EvidenceMetadata，不复制运行历史 | subject/execution/hash/trust 不符不可作支撑 |
| sourceBoundary | 原事实 snapshot/commit-receipt 等证明引用 | 生产 Adapter 验证一致读取；committed=true 不是证明 |
| evaluationContext | capturedTime、allocatedId、projectionVersion | 核心不读取时钟/随机 UUID；capturedTime 仅用于报告元数据 |
| priorFingerprint（可选） | 既有 feedbackId、idempotencyKey、inputHash、normalizationVersion | 无 prior 只生成候选，不宣称已持久化去重 |

criterionAssessments 的 MET/NOT_MET/UNKNOWN/CONFLICT 只是上游裁决的消费映射，不是 LF 自行计算正确性的 Oracle。该映射须 Verification owner 接受；未接受前只用于组件 conformance。

### FeedbackResolutionInput

候选字段固定为 feedback（原 ExecutionFeedback）、consumerExecution（NodeExecutionIdentity）、lineage、consumptionProof、criterionAssessments、resultingGate、evidence、sourceBoundary、evaluationContext，以及可选 priorResolutionFingerprint。后续 Schema 应按这些字段名实现，不能出现未审查的同义别名。

consumptionProof 固定记录反馈来源、ContextSnapshot 引用及该 Attempt 使用快照的主线事实引用；lineage 证明合法 source-to-consumer 关系。单独 feedbackId、consumed=true 或提供者被调用成功都不够。priorResolutionFingerprint 仅含既有 resolutionId、resolutionKey、inputHash、normalizationVersion，不能把 feedbackId 当 resolutionId。

生产 Adapter 从受授权 query 建立可信输入；纯核心仅验证结构、引用一致性和义务规则，不独立证明来源真实性。sourceBoundary 是固定材料的边界，不是轮询游标；传输 requestId、pollCursor、读取次数不得进入语义身份。

### Schema validation 与纯函数分界

外层通过现有公开 loader 构造 ContractRegistry 并验证六份 Schema；该 I/O 只在测试/外层，不在纯用例中。核心复用 canonical 类型及无 I/O canonical/hash 能力，做语义约束，不复制 JSON Schema validator、不调用文件型 loader。类型断言不能替代真实边界校验。

## 4. ExecutionFeedback 字段

| 字段 | 规则 |
| --- | --- |
| schemaVersion / feedbackId | canonical identity；显式分配，hash 不是 UUID |
| execution / sourceDecisionRef / assessmentRefs | 原始稳定引用，不复制 NodeResult |
| sourceContractRef / criterionRefs | 版本、hash 与原子义务；组合需原 Contract 明确 |
| evidenceRefs | 有来源的支撑证据；缺失不伪装确定结论 |
| observedGap | 已裁决差距的确定性表达，不推测 rootCause |
| requiredOutcome | 原 criterion 要求的结果，不新造实现方案 |
| retainedConstraints | 输入 constraints 的必要投影及 constraintRef/sourceRef，不复制整个 Contract |
| closureRequirements | requirementRef、criterion/version、assessment/Evidence 类型与 Gate 要求 |
| applicability | 合法 lineage/definition version/权限边界；不是 nextNode |
| projectionVersion / normalizationVersion / inputHash / idempotencyKey / createdAt | 可重放的版本化派生身份；历史不可变 |

禁止 nextNode、routeDecision、rootCause、任意 recommendedImplementation、可变 workflowStatus、reward。消费与关闭通过后续事实/派生视图表达，不修改原反馈状态。

## 5. FeedbackResolution 规则与身份

FeedbackResolution 保留 schemaVersion、resolutionId、feedbackRef、consumerExecution、closureCriterionResults、后续 assessmentRefs/resultingGateRef/evidenceRefs、remainingGaps、evaluatorVersion、normalizationVersion、resolutionKey、inputHash、sourceBoundary、evaluatedAt。每个 closureCriterionResult 必须带 requirementRef，而不是仅有数组序号。append-only，不覆盖原 Feedback 或主线终态。

| evaluation status | 结果 |
| --- | --- |
| EVALUATED | 事实足够才产生 RESOLVED / PARTIALLY_RESOLVED / UNRESOLVED 的 Resolution 候选，或按 §7.4 返回 REUSE_EXISTING |
| INCONCLUSIVE | 必要覆盖、身份、版本或事实不完整；可给已知逐项结果，但不新增声称完整评价的业务 Resolution |
| BLOCKED | 权限/必要能力/依赖不足；不得关闭 |
| ERROR / INVALID_INPUT | wiring、Schema、完整性等 typed error，不伪装正常 UNRESOLVED |

全部必要义务获对应可信 MET 与原 Gate 要求支撑、无未处理反证，才 RESOLVED。部分明确满足、剩余明确不满足为 PARTIALLY_RESOLVED；无满足项或阻断性反证为 UNRESOLVED。必要条件 UNKNOWN 时整体 INCONCLUSIVE，不能当普通 NOT_MET。

风险接受、豁免、取消单独记录 disposition/审批 provenance，不等于已修复。一次 Node PASS 不批量关闭未精确关联的历史反馈。无法完成评价的诊断可由已有可观测机制记录，不进入“已经完成的 Resolution”统计。

## 6. Gate outcome 全映射

| outcome | 投影与关闭约束 |
| --- | --- |
| PASS | 通常 NO_FEEDBACK_REQUIRED；矛盾输入拒绝；关闭旧反馈仍要精确 coverage/lineage |
| PASS_WITH_RISK_ACCEPTANCE | 可保留明确未满足义务及风险处置；接受风险本身不是 MET |
| REWORK | 有已裁决 NOT_MET 和来源才 PROJECTED；不由 LF 触发 Retry |
| BLOCK | 有正式前置义务才表达，否则 INCONCLUSIVE；不编造执行失败/根因或自行解锁 |
| REQUIRE_HUMAN_APPROVAL | 保留正式审批交接，不自动批准；审批未满足不关闭 |
| FAIL_TERMINAL | 保留有依据历史差距；不得重开终态，后续合法执行另有 lineage/授权 |
| INCONCLUSIVE | 显式证据 gap，不推断 FAIL，不关闭 |

未知版本/outcome 拒绝。最终 Schema 必须表达这些区分，不能修改上游 Gate 简化语义。前置条件/approval 尚无正式 provider 时，不在 C1 伪造生产能力。

## 7. 无状态、规范化与两类幂等协议

### 7.1 公共用例与元数据边界

拟公开 projectFeedback、evaluateFeedbackResolution；两个 key helper 分别为 deriveFeedbackKey/compareFeedbackFingerprint 与 deriveResolutionKey/compareResolutionFingerprint，共用唯一 normalizeFeedbackSemanticInput。当前都未实现。

normalizationVersion 候选固定 `LF-HN-1`。先完成 Schema/语义校验，再对副本规范化，最后调用 `@aseos/contracts` 的 canonicalJson/canonicalJsonSha256；不修改调用者对象、主线对象或原始 Evidence。这里的 normalizer 不是第二套 JSON serializer，也不重新计算上游已签名 artifact/contentHash。

两个 inputHash 的外层分别为 `{kind:"FeedbackProjectionInput",normalizationVersion:"LF-HN-1",material:...}` 与 `{kind:"FeedbackResolutionInput",normalizationVersion:"LF-HN-1",material:...}`。material 包含本用例所有经 Schema 声明的事实/义务/作用域/适用性输入，但排除本次 evaluationContext、priorFingerprint/priorResolutionFingerprint、调用方 expectedInputHash 及本次计算中的 key/hash。projectionVersion/evaluatorVersion 以独立语义字段纳入 material；不得因排除 evaluationContext 而丢失算法版本。Resolution material 中原 feedback 已有的 identity/fingerprint/version/createdAt 仍是固定历史材料，不递归删除历史字段。

capturedTime/allocatedId 只是本次输出元数据，不能用于会改变判定的 freshness 或权限过期计算。若规则依赖评估时间，必须把主线固定的 evaluationAsOf/适用性裁决作为 material 的显式来源，并在新合法 observation 下重新评价；不能一面排除时钟，一面按“现在”改变语义。缺必要时间证据返回 gap。expectedInputHash 仅供核对，不可信任其替代计算。

### 7.2 LF-HN-1 逐路径集合/序列规则

以下路径是 LF 消费视图，不改变上游 Schema 的全局语义。`P` 指 ProjectionInput；`R` 指 ResolutionInput；`G` 分别为 P.sourceGate 或 R.resultingGate；`A` 为两种输入的 criterionAssessments；`E` 为 evidence；`C` 为 P.constraints 或 R.feedback.retainedConstraints；`Q` 为 P.closureRequirements 或 R.feedback.closureRequirements。`[*]` 只表示对应已声明数组元素，不是任意递归搜索。

| 具体路径 | 类别 | 元素唯一身份与规则 |
| --- | --- | --- |
| G.assessmentRefs / G.evidenceRefs / G.riskAcceptanceRefs | SET | 完整 SubjectRef |
| G.reasonCodes / G.missingEvidence | SET | 原字符串精确值，不 trim/大小写折叠 |
| P.criterionRefs；R.feedback.criterionRefs / assessmentRefs / evidenceRefs | SET | 完整 SubjectRef |
| A | SET | canonical tuple `{assessmentRef,criterionRef}`；两个不同 assessment 的矛盾必须保留并按 §5 处理 |
| A[*].evidenceRefs | SET | 完整 SubjectRef |
| E | SET | evidenceId；同 ID 两份内容不选择其一，拒绝 |
| E[*].subjectRefs | SET | 完整 SubjectRef |
| C | SET | constraintRef；每项必须有稳定引用 |
| Q | SET | requirementRef；每项必须有稳定引用 |
| Q[*].requiredEvidenceTypes / Q[*].allowedGateOutcomes（声明为数组时） | SET | 原字符串精确值 |
| R.lineage.path / R.consumptionProof.chain（声明为数组时） | SEQUENCE | 保持每一步顺序与重复次数，不 sort/deduplicate |
| C[*].steps / Q[*].steps（声明为数组时） | SEQUENCE | 执行/推导步骤有序，保持原顺序 |
| 其余已声明数组路径，包括 applicability/sourceBoundary 内数组 | SEQUENCE | 默认保序；不能由 uniqueItems、字段名后缀 Refs 或内容看起来相似推定 SET |

SET 先验证元素身份无重复，再按“规范化后完整元素的 canonical JSON UTF-8 bytes”升序排列，比较无 locale、无自然语言排序、无 Unicode 归一化。SubjectRef 的身份包含实际存在的 subjectVersion；缺省不能补 null/空串，版本必须存在的消费位置仍按 §2 拒绝缺失。

任何 SET 中同身份重复，即使内容完全一样也返回 DUPLICATE_SEMANTIC_ID，不静默去重；同身份异内容同样拒绝。排序前递归处理表中明确列出的子路径，其余数组保持原序。对象键顺序交 canonicalJson。未在 Schema 声明的字段/扩展拒绝；新数组或 SET 分类变更必须更新 Schema/逐路径表、normalizationVersion、两类 key/version 与兼容测试，不在相同 LF-HN-1 下静默改算法。

该等价仅适用于同一不可变来源中的无序引用被传输/装配重排。若源 artifact hash、事实版本或材料 snapshot 已真实改变，那不是“只是排列”，inputHash 应变化；normalizer 不抹去这些证据差异。

#### 可复制的规范化字节测试向量

以下是 normalizer 子结构向量，不是完整有效 Input，也不是证明来源可信。为了便于独立核算，只使用 ASCII 字符串和 JSON 对象/数组；SHA256 输入为所列 UTF-8 文本，无 BOM、无末尾换行。

HN-S1 输入 G.evidenceRefs 可为 `[a,b]` 或 `[b,a]`，lineage.path 为 `["x","y"]`；其中 a/b 分别是 subjectId=a/b、subjectType=Evidence、subjectVersion=1 的 SubjectRef。两种输入都规范化为：

```json
{"lineage":{"path":["x","y"]},"sourceGate":{"evidenceRefs":[{"subjectId":"a","subjectType":"Evidence","subjectVersion":"1"},{"subjectId":"b","subjectType":"Evidence","subjectVersion":"1"}]}}
```

SHA256：`5d7c324ff99daa61385f46d407b5f61adf55430dce76f393c1d982bc72b832cc`。

HN-Q1 仅将有序 lineage.path 改为 `["y","x"]`：

```json
{"lineage":{"path":["y","x"]},"sourceGate":{"evidenceRefs":[{"subjectId":"a","subjectType":"Evidence","subjectVersion":"1"},{"subjectId":"b","subjectType":"Evidence","subjectVersion":"1"}]}}
```

SHA256：`2d997b983b8ad3848356ad35f036a4169499db77b07ad196052b48cb19ef01b9`，必须不同于 HN-S1。

HN-D1：evidenceRefs 为 `[a,a]`，必须 DUPLICATE_SEMANTIC_ID，不返回去重后的 hash。HN-V1：a.subjectVersion 改为 2，必须与 HN-S1 不同。HN-C1：同一个 evidenceId 对应不同 contentHash，必须重复身份/完整性拒绝，不按输入顺序取第一条。以上向量要通过 public canonical/hash API 重验，手工示例或作者本地 SHA 计算不是库验证。

### 7.3 Feedback projection identity

idempotencyKey 为规范化 key material 的 canonicalJsonSha256，使用 namespace `aseos.feedback.projection.key/1`；材料包含 execution、sourceDecisionRef、原子 criterion/group 的稳定引用与版本、sourceContractRef/hash、projectionVersion、normalizationVersion。key 不包含本次 feedbackId、capturedTime、prior 或被观测结果内容。对多个原子义务分别导出 key，不靠数组下标。

同完整输入/context 重放输出一致。换本次 ID/time 不改语义 key/inputHash。校验后比较显式 priorFingerprint：同 key 同 inputHash/version 返回 REUSE_EXISTING 与旧 feedbackId；同 key 异 hash 返回 IDEMPOTENCY_CONFLICT；不同 key 是不同候选，不覆盖 prior。没有 prior 返回 PROJECTED 候选，不声称已查询存储。生产调用方负责 prior 的可信来源。

### 7.4 Feedback resolution identity

Resolution 必须使用独立 namespace `aseos.feedback.resolution.key/1`，不能复用 projection key。resolutionKey 材料固定为：feedbackRef（含原 feedbackId/schemaVersion 与原 inputHash）、consumerExecution（含 attempt）、原 closureRequirements 的 requirementRef/criterion版本集合、resultingGateRef（decisionId/schemaVersion）、该 observation 的 assessmentRef 集合、evaluatorVersion、normalizationVersion。这些是身份材料，不含 disposition、remainingGaps、resolutionId、evaluatedAt 或 prior。

Resolution inputHash 按 §7.1/7.2 覆盖这一 observation 的全部材料，包括原反馈、逐条件已裁决内容、EvidenceMetadata/hash、合法 lineage/consumptionProof、Gate 及 sourceBoundary。相同身份材料却有不同结论/证据内容时不能通过换 resolutionId 规避冲突。

评价和输入校验后：

- 无 priorResolutionFingerprint：EVALUATED 时返回候选 Resolution；不声称数据库已追加。
- 同 resolutionKey、inputHash、normalizationVersion：REUSE_EXISTING，返回旧 resolutionId；新时间/新分配 ID 不追加重复评价。
- 同 key 异 hash 或 normalization 绑定不一致：IDEMPOTENCY_CONFLICT，不能 last-write-wins 或覆盖旧 Resolution。
- 不同 consumer attempt、已提交的新 Gate/assessment identity 或新 evaluator/normalization version：新合法 key，可形成新的历史评价；引用原反馈但不覆写旧记录。
- 同一次 observation 的引用不变，原记录内容/hash却改变：完整性/幂等冲突，不能把它当正常新评价。新反证应先由主线形成新的合法 assessment/Gate observation，再评价。

INCONCLUSIVE/BLOCKED/ERROR/INVALID_INPUT 不产生虚假的 completed Resolution，因此不进入 Resolution append/count 流程。诊断记录的去重沿用可观测基础设施，不在 C1 再造存储。

C1 只证明两类 key、纯比较和 replay。I1 必须为 projectionKey 与 resolutionKey 分别实现事务性唯一约束、原子比较、并发重试与重启恢复，防止多次消费/复验重复追加污染历史；不能“先查再插”或用 cache 冒充。复用修复后的 canonical serializer，固定规则集，不允许 LLM 回调改变关闭或去重语义。

## 8. 主线接口需求（不是已存在 API）

| Seam | owner | 需求 | 当前/阶段 |
| --- | --- | --- | --- |
| S01 | contracts | identity/ref/Gate/Evidence 及 validator/types/canonicalization | EXISTING；相关 #82 修复仍须证据；C1 |
| S02 | node-runtime/persistence/platform | committed execution/facts 一致查询、checkpoint、错误分类 | PLANNED_PROVIDER；I1 |
| S03 | verification | criterion版本 -> authoritative assessment -> Evidence 覆盖 | PLANNED_PROVIDER；I1/真实 Resolution |
| S04 | context/node-runtime/platform | contribution 拒绝/裁剪、snapshot 来源、Attempt 实际使用 | PLANNED_PROVIDER；I2 |
| S05 | workflow/kernel | 已提交 route/lineage、terminal/retry 合法关系 | PLANNED_PROVIDER；I2/E1 |
| S06 | persistence | 两类派生记录唯一 key、原子比较/写入/checkpoint、恢复与权限 | qualification 存在，不等于业务 Port；I1 |
| S07 | policy/platform | Proposal 授权、版本变更和 rollback 审计 | FUTURE；Learning，不阻塞 C1 |

接口方法签名由主线 owner 提供并通过 consumer-conformance，不让主线去适配 LF 临时 global Repository。生产缺 S02–S07 只阻塞对应集成，不阻止获授权后的纯核心。

## 9. Schema、真实实例与正常资格入口

六份 Schema 为 execution-feedback、feedback-resolution、feedback-projection-input/result、feedback-resolution-input/result。前二是业务对象，后四是立即使用的边界，不是第二运行历史。两类 fingerprint、normalizationVersion、result discriminant 和逐路径数组约束须按 §3–7 表达。

**不再创建独立 learning/example-suite.json。** 当前 `packages/contracts/src/examples.ts` 的 validateExampleSuite 固定读取 `packages/contracts/examples/first-slice/example-suite.json`，`scripts/contracts/qualify-contracts.mjs` 调用这一正常入口。因此采用最小接入：十二份实例保存在 examples/learning/，其 case 全部追加到现有 first-slice/example-suite.json。不要新增 discovery/loader 或隐藏的第二资格命令。

caseId 固定为 `lf-c1.<schema-stem>.<valid|invalid>`，共十二个；每项绑定真实 instancePath、schemaId、expected，invalid 还绑定 expectedError。保留基线所有 caseId、expectation 和 semanticAssertions，不能覆盖旧 suite。该 suite 为共享且 authority-locked 资产，其新增写入必须由 E1/E3 正式批准；此文不是额外权限。

`tests/contract/example-suite.test.mjs` 当前固定 38/19/19/22 的统计值；将该文件纳入候选 scope，仅随保留全部旧 case 后新增十二个合法 binding 修订期望，不降低原负例断言。若开工基线未变且新 case 不增加 semanticAssertions，结果应为 50/25/25/22；若主线已新增 case，应根据新的冻结清单重新确定，不机械保留旧数。

conformance 必须断言十二个固定 ID/路径均被登记，少一项失败；并在隔离完整仓库副本通过正常 contracts:qualify 路径证明：删新实例、错 instancePath、把 invalid 换成 valid 内容、篡改 expectedError 都失败；未破坏时原 case 与十二新 case 一起通过。只运行 LF 专用 validator 或只检查文件存在不能关闭该门禁。withContractRepository 现实现复制完整 packages/contracts，可供同一公开 validateExampleSuite 的局部负例使用，不能用它假装完整 checkout/build。

未知/重复/错版本、wrong-run/criterion、风险接受、UNKNOWN/反证、集合重排/序列反转、两类同 key 异 hash 都有独立负例。Schema 格式正确不证明生产数据真实性；生产读取/并发去重仍由 I/E 验证。

## 10. 审查记录和停止点

上一 subject 的 Codex 独立 review 于 2026-09-08 返回三个 P1：

| ID | 原线程 | 本次文档处置 | 当前 |
| --- | --- | --- | --- |
| LF-RV-01 | discussion_r3953795058：suite 未接正常 qualification | §9 复用现有受检 suite、补共享 scope/旧统计与负例 | ADDRESSED_PENDING_REVIEW |
| LF-RV-02 | discussion_r3953795060：集合/序列哈希未冻结 | §7.2 逐路径表、确定比较器、重复/版本规则与字节向量 | ADDRESSED_PENDING_REVIEW |
| LF-RV-03 | discussion_r3953795062：Resolution 无幂等身份 | §5/7.4 独立 key/hash/prior、append-only 与重放边界 | ADDRESSED_PENDING_REVIEW |

D01–D05（owner、错误不确定性、Verification 裁决来源、纯核心隔离、provider 未就绪边界）继续待完整独立批准；新增去重/normalization 细节由复核明确确认。本次仅修文档，不自行 resolve review threads 或标 VERIFIED，不改变 #85 的未放行状态。
