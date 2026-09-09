# LF-D1：Feedback Contract 与主线接口提案

状态：`DRAFT / REVIEW_FINDINGS_ADDRESSED_PENDING_REVIEW / NO_CODE_AUTHORIZATION`  
设计起点：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
接口复核主线：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`，2026-09-08  
本轮修订所依据的独立审查 subject：`39cdb4b33cda6616f98ec67855e4e61ee60705b6`  
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

### 3.1 V1 调用基数：一个原子 criterion，一次调用，至多一个候选

`projectFeedback(input)` 每次只处理一个原子 criterion。`criterionRefs` 必须有且仅有一项（Schema minItems=1、maxItems=1）；所有 criterionAssessments[*].criterionRef 和 closureRequirements[*].criterionRef 必须指向这一相同的完整版本化引用。零项或多项 criterion、混入另一个 criterion 的 assessment/closure，均在分配业务结果之前返回 INVALID_INPUT；不得静默截取第一项、循环返回批量结果或复用一个 ID/prior 处理多项。

一条原子 criterion 可需要多项 closureRequirement、多个支撑/反证 assessment 或多种 Evidence，仍是一条反馈；这些是同一义务的评价材料，不是多个 Feedback。V1 不实现组合 criterion/group，也不把多条 criterion 临时包成一个“组”来规避基数限制。若主线定义明确要求不可分的组合原子组，当前返回不支持的输入/能力结果，等待正式版本扩展，不自行拆坏上游语义。

一个 sourceGate 可以是多 criterion 的真实汇总，保持原始完整 GateDecision 不改写；但本次显式选定且有原 Contract 依据的 criterion 只有一个。不得从无关联的 Gate outcome 推导所选 criterion 的差距；该 criterion 的完整相关支撑/反证必须提供，不能通过选择性删除反证制造 MET。sourceBoundary 与来源关联不足时返回 gap。

每次输入只有一个 evaluationContext.allocatedId、一个可选 priorFingerprint，输出是单一 discriminated result：PROJECTED 带一个 ExecutionFeedback；REUSE_EXISTING 带一个既有 feedbackId；NO_FEEDBACK_REQUIRED、INCONCLUSIVE、BLOCKED、INVALID_INPUT、ERROR 或 IDEMPOTENCY_CONFLICT 不携带新 Feedback。不得同时返回候选和错误，不提供批量 results[]。prior 必须按这一 criterion 派生的 key 比较，不按列表位置配对。

多个独立原子 criterion 的逐个调用属于未来外层已授权应用编排：每次分别分配 ID、按各自 key 查询 prior、分别收集结果。C1 不提供批处理 API、批量事务或跨义务全有全无承诺。该编排不得由 Feedback core 决定 Router 或主线重试。

Resolution 同样一次只接收一个 feedback、一个 consumerExecution 和一个可选 priorResolutionFingerprint，至多返回一条 Resolution；同一义务的多项 closureCriterionResults 不改变输出基数。此限制是总体设计中“可按义务生成反馈”的 V1 具体化，不增加新语义 owner。

### FeedbackProjectionInput

| 字段 | 内容与来源 | 不满足时 |
| --- | --- | --- |
| execution | NodeExecutionIdentity | INVALID_INPUT |
| sourceGate | 按现有 Schema 校验的原完整 GateDecision | 未知版本/outcome 拒绝，不裁剪 Gate 来适应本次 criterion |
| sourceContractRef / criterionRefs | 固定版本与 hash；criterionRefs 恰好一项，历史语义可恢复 | 基数错误 INVALID_INPUT；来源不足 INCONCLUSIVE，不用最新 Contract 替代 |
| criterionAssessments | Verification 已有逐项裁决投影；每项 assessmentRef、criterionRef、outcome、evidenceRefs，criterionRef 与唯一选中项一致 | 错 criterion 拒绝；不从退出码/日志自由推断；无 producer 时仅 fixture |
| constraints | 原 Contract 的相关约束，每项 constraintRef、sourceRef 和要求内容 | 不发明约束；同 constraintRef 不同内容拒绝 |
| closureRequirements | 同一 criterion 的原要求，每项 requirementRef、criterionRef、来源版本及关闭要求 | 稳定 requirementRef，不依赖数组位置；另一 criterion 拒绝 |
| evidence | 所需 EvidenceMetadata，不复制运行历史 | subject/execution/hash/trust 不符不可作支撑 |
| sourceBoundary | 原事实 snapshot/commit-receipt 等证明引用 | 生产 Adapter 验证一致读取；committed=true 不是证明 |
| evaluationContext | capturedTime、allocatedId、projectionVersion | 一个候选 ID；核心不读取时钟/随机 UUID；capturedTime 仅报告 |
| priorFingerprint（可选） | 本次 key 的既有 feedbackId、idempotencyKey、inputHash、normalizationVersion | 无 prior 只生成候选；不可用一个 prior 处理多个 criterion |

criterionAssessments 的 MET/NOT_MET/UNKNOWN/CONFLICT 只是上游裁决的消费映射，不是 LF 自行计算正确性的 Oracle。该映射须 Verification owner 接受；未接受前只用于组件 conformance。

### FeedbackResolutionInput

候选字段固定为 feedback（一个原 ExecutionFeedback）、consumerExecution（一个 NodeExecutionIdentity）、lineage、consumptionProof、criterionAssessments、resultingGate、evidence、sourceBoundary、evaluationContext，以及可选 priorResolutionFingerprint。后续 Schema 按这些字段名实现，不引入未审查的同义别名或批量字段。

consumptionProof 固定记录反馈来源、ContextSnapshot 引用及该 Attempt 使用快照的主线事实引用；lineage 证明合法 source-to-consumer 关系。单独 feedbackId、consumed=true 或提供者被调用成功都不够。priorResolutionFingerprint 仅含既有 resolutionId、resolutionKey、inputHash、normalizationVersion，不能把 feedbackId 当 resolutionId。

生产 Adapter 从受授权 query 建立可信输入；纯核心仅验证结构、引用一致性和义务规则，不独立证明来源真实性。sourceBoundary 是固定材料的边界，不是轮询游标；传输 requestId、pollCursor、读取次数不得进入语义身份。

### Schema validation 与纯函数分界

外层通过现有公开 loader 构造 ContractRegistry 并验证六份 Schema；该 I/O 只在测试/外层，不在纯用例中。核心复用 canonical 类型及无 I/O canonical/hash 能力，做语义约束，不复制 JSON Schema validator、不调用文件型 loader。类型断言不能替代真实边界校验。

## 4. ExecutionFeedback 字段

| 字段 | 规则 |
| --- | --- |
| schemaVersion / feedbackId | canonical identity；每次至多一条、显式分配，hash 不是 UUID |
| execution / sourceDecisionRef / assessmentRefs | 原始稳定引用，不复制 NodeResult |
| sourceContractRef / criterionRefs | 版本/hash，criterionRefs 恰一项；V1 不支持多 criterion/group |
| evidenceRefs | 有来源的支撑证据；缺失不伪装确定结论 |
| observedGap | 已裁决差距的确定性表达，不推测 rootCause |
| requiredOutcome | 原 criterion 要求的结果，不新造实现方案 |
| retainedConstraints | 输入 constraints 的必要投影及 constraintRef/sourceRef，不复制整个 Contract |
| closureRequirements | requirementRef、唯一 criterion/version、assessment/Evidence 类型与 Gate 要求 |
| applicability | 合法 lineage/definition version/权限边界；不是 nextNode |
| projectionVersion / normalizationVersion / inputHash / idempotencyKey / createdAt | 可重放的版本化派生身份；历史不可变 |

禁止 nextNode、routeDecision、rootCause、任意 recommendedImplementation、可变 workflowStatus、reward。消费与关闭通过后续事实/派生视图表达，不修改原反馈状态。

## 5. FeedbackResolution 规则与身份

FeedbackResolution 保留 schemaVersion、resolutionId、feedbackRef、consumerExecution、closureCriterionResults、后续 assessmentRefs/resultingGateRef/evidenceRefs、remainingGaps、evaluatorVersion、normalizationVersion、resolutionKey、inputHash、sourceBoundary、evaluatedAt。每个 closureCriterionResult 带 requirementRef，不仅是数组序号；所有项归属原反馈的唯一 criterion。append-only，不覆盖原 Feedback 或主线终态。

| evaluation status | 结果 |
| --- | --- |
| EVALUATED | 事实足够才产生一个 RESOLVED / PARTIALLY_RESOLVED / UNRESOLVED 的候选，或按 §7.4 返回 REUSE_EXISTING |
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
| REWORK | 所选唯一 criterion 有已裁决 NOT_MET 和来源才 PROJECTED；不由 LF 触发 Retry |
| BLOCK | 所选 criterion 有正式前置义务才表达，否则 INCONCLUSIVE；不编造执行失败/根因或自行解锁 |
| REQUIRE_HUMAN_APPROVAL | 保留正式审批交接，不自动批准；审批未满足不关闭 |
| FAIL_TERMINAL | 保留有依据历史差距；不得重开终态，后续合法执行另有 lineage/授权 |
| INCONCLUSIVE | 显式证据 gap，不推断 FAIL，不关闭 |

未知版本/outcome 拒绝。最终 Schema 必须表达这些区分，不能修改上游 Gate 简化语义。前置条件/approval 尚无正式 provider 时，不在 C1 伪造生产能力。

## 7. 无状态、规范化与两类幂等协议

### 7.1 公共用例与元数据边界

拟公开 projectFeedback、evaluateFeedbackResolution；两个 key helper 分别为 deriveFeedbackKey/compareFeedbackFingerprint 与 deriveResolutionKey/compareResolutionFingerprint，共用唯一 normalizeFeedbackSemanticInput。当前都未实现；所有用例遵守 §3.1 的单义务基数。

normalizationVersion 候选固定 `LF-HN-1`。先完成 Schema/语义校验，再对副本规范化，最后调用 `@aseos/contracts` 的 canonicalJson/canonicalJsonSha256；不修改调用者对象、主线对象或原始 Evidence。normalizer 不是第二套 JSON serializer，也不重新计算上游已签名 artifact/contentHash。

两个 inputHash 的外层分别为 `{kind:"FeedbackProjectionInput",normalizationVersion:"LF-HN-1",material:...}` 与 `{kind:"FeedbackResolutionInput",normalizationVersion:"LF-HN-1",material:...}`。material 包含本用例所有经 Schema 声明的事实/义务/作用域/适用性输入，但排除本次 evaluationContext、priorFingerprint/priorResolutionFingerprint、调用方 expectedInputHash 及本次计算中的 key/hash。projectionVersion/evaluatorVersion 以独立语义字段纳入 material；不得因排除 evaluationContext 而丢失算法版本。Resolution material 中原 feedback 已有的 identity/fingerprint/version/createdAt 仍是固定历史材料，不递归删除历史字段。

capturedTime/allocatedId 只是本次输出元数据，不能用于会改变判定的 freshness 或权限过期计算。若规则依赖评估时间，必须把主线固定的 evaluationAsOf/适用性裁决作为 material 的显式来源，并在新合法 observation 下重新评价；不能一面排除时钟，一面按“现在”改变语义。缺必要时间证据返回 gap。expectedInputHash 仅供核对，不可信任其替代计算。

### 7.2 LF-HN-1 逐路径集合/序列规则

以下路径是 LF 消费视图，不改变上游 Schema 的全局语义。P 指 ProjectionInput；R 指 ResolutionInput；G 分别为 P.sourceGate 或 R.resultingGate；A 为两种输入的 criterionAssessments；E 为 evidence；C 为 P.constraints 或 R.feedback.retainedConstraints；Q 为 P.closureRequirements 或 R.feedback.closureRequirements。[*] 仅表示对应已声明数组元素，不是任意递归搜索。

| 具体路径 | 类别 | 元素唯一身份与规则 |
| --- | --- | --- |
| G.assessmentRefs / G.evidenceRefs / G.riskAcceptanceRefs | SET | 完整 SubjectRef |
| G.reasonCodes / G.missingEvidence | SET | 原字符串精确值，不 trim/大小写折叠 |
| P.criterionRefs / R.feedback.criterionRefs | SINGLETON | 完整 SubjectRef，必须恰好一项；不支持用排列规避基数 |
| R.feedback.assessmentRefs / R.feedback.evidenceRefs | SET | 完整 SubjectRef |
| A | SET | canonical tuple {assessmentRef,criterionRef}；同 criterion 的不同 assessment 矛盾必须保留并按 §5 处理 |
| A[*].evidenceRefs | SET | 完整 SubjectRef |
| E | SET | evidenceId；同 ID 两份内容不选择其一，拒绝 |
| E[*].subjectRefs | SET | 完整 SubjectRef |
| C | SET | constraintRef；每项必须有稳定引用 |
| Q | SET | requirementRef；每项必须有稳定引用且指向所选 criterion |
| Q[*].requiredEvidenceTypes / Q[*].allowedGateOutcomes（声明为数组时） | SET | 原字符串精确值 |
| R.lineage.path / R.consumptionProof.chain（声明为数组时） | SEQUENCE | 保持每一步顺序与重复次数，不 sort/deduplicate |
| C[*].steps / Q[*].steps（声明为数组时） | SEQUENCE | 执行/推导步骤有序，保持原顺序 |
| 其余已声明数组路径，包括 applicability/sourceBoundary 内数组 | SEQUENCE | 默认保序；不能由 uniqueItems、Refs 后缀或内容相似推定 SET |

SET 先验证元素身份无重复，再按“规范化后完整元素的 canonical JSON UTF-8 bytes”升序排列，比较无 locale、无自然语言排序、无 Unicode 归一化。SubjectRef 身份包含实际存在的 subjectVersion；缺省不能补 null/空串，版本必需位置仍按 §2 拒绝缺失。

任何 SET 中同身份重复，即使完全一样也返回 DUPLICATE_SEMANTIC_ID，不静默去重；同身份异内容同样拒绝。排序前递归处理表中明确列出的子路径，其余数组保持原序。对象键顺序交 canonicalJson。未在 Schema 声明的字段/扩展拒绝；新数组或 SET 分类变更必须更新 Schema/逐路径表、normalizationVersion、两类 key/version 与兼容测试，不在已发布的相同 LF-HN-1 下静默改算法。当前版本尚未发布，本轮 SINGLETON 收敛必须纳入首次批准范围。

该等价只适用于同一不可变来源的无序引用被传输/装配重排。若源 artifact hash、事实版本或材料 snapshot 真实改变，inputHash 应变化；不抹去证据差异。

#### 规范化字节测试向量

以下是 normalizer 子结构向量，不是完整有效 Input，也不是来源可信证明。只使用 ASCII 字符串和 JSON 对象/数组；SHA256 输入为所列 UTF-8 文本，无 BOM、无末尾换行。

HN-S1 的 evidenceRefs 可为 [a,b] 或 [b,a]，lineage.path 为 ["x","y"]；a/b 分别是 subjectId=a/b、subjectType=Evidence、subjectVersion=1 的 SubjectRef。两种输入均规范化为：

```json
{"lineage":{"path":["x","y"]},"sourceGate":{"evidenceRefs":[{"subjectId":"a","subjectType":"Evidence","subjectVersion":"1"},{"subjectId":"b","subjectType":"Evidence","subjectVersion":"1"}]}}
```

SHA256：`5d7c324ff99daa61385f46d407b5f61adf55430dce76f393c1d982bc72b832cc`。

HN-Q1 仅将有序 lineage.path 改为 ["y","x"]：

```json
{"lineage":{"path":["y","x"]},"sourceGate":{"evidenceRefs":[{"subjectId":"a","subjectType":"Evidence","subjectVersion":"1"},{"subjectId":"b","subjectType":"Evidence","subjectVersion":"1"}]}}
```

SHA256：`2d997b983b8ad3848356ad35f036a4169499db77b07ad196052b48cb19ef01b9`，必须不同于 HN-S1。

HN-D1：evidenceRefs=[a,a]，必须 DUPLICATE_SEMANTIC_ID，不返回去重 hash。HN-V1：a.subjectVersion 改为2，必须与 HN-S1 不同。HN-C1：同 evidenceId 不同 contentHash 必须身份/完整性拒绝，不取第一条。通过 public canonical/hash API 重验这些向量，作者字节核算不替代库验证。

### 7.3 单义务 Feedback projection identity

idempotencyKey 是规范化 key material 的 canonicalJsonSha256，namespace 为 `aseos.feedback.projection.key/1`；材料包含 execution、sourceDecisionRef、criterionRefs 中唯一的完整版本化引用、sourceContractRef/hash、projectionVersion、normalizationVersion。key 不包含本次 feedbackId、capturedTime、prior 或被观测结果内容。不包含 group、义务数组下标或批次位置。

同完整输入/context 重放输出一致；换本次 ID/time 不改 key/inputHash。校验后比较单个显式 priorFingerprint：同 key/hash/version 返回 REUSE_EXISTING 与旧 feedbackId；同 key 异 hash 返回 IDEMPOTENCY_CONFLICT；不同 key 不是当前义务的历史，不可返回该 prior 的 ID 或覆盖它。没有匹配 prior 返回单个 PROJECTED 候选，不声称已查询存储。生产调用方负责 prior 可信来源。

两个不同独立 criterion 必须以两次合法调用获得不同 key/分配身份；A 调用的 prior 不得让 B 返回 A 的 feedbackId。任何一次错误不代表另一调用被回滚；跨调用事务不属于 C1。

### 7.4 Feedback resolution identity

Resolution 使用独立 namespace `aseos.feedback.resolution.key/1`，不复用 projection key。resolutionKey 材料固定为：feedbackRef（含原 feedbackId/schemaVersion 与原 inputHash）、consumerExecution（含 attempt）、原 closureRequirements 的 requirementRef/criterion版本集合、resultingGateRef（decisionId/schemaVersion）、该 observation 的 assessmentRef 集合、evaluatorVersion、normalizationVersion。不包含 disposition、remainingGaps、resolutionId、evaluatedAt 或 prior。

Resolution inputHash 按 §7.1/7.2 覆盖该 observation 的全部材料，包括原反馈、逐条件已裁决内容、EvidenceMetadata/hash、合法 lineage/consumptionProof、Gate 及 sourceBoundary。相同身份材料却有不同结论/证据内容时，不能通过换 resolutionId 绕过冲突。

校验和评价后，无 priorResolutionFingerprint 时只在 EVALUATED 返回一个候选，不声称数据库已追加。同 resolutionKey/hash/normalizationVersion 返回 REUSE_EXISTING 与旧 resolutionId；新时间/分配 ID 不重复追加。同 key 异 hash 或 normalization 绑定不一致返回 IDEMPOTENCY_CONFLICT，不 last-write-wins。不同 consumer attempt、新合法 Gate/assessment identity 或 evaluator/normalization版本可形成新 key，保留历史而不覆盖。同 observation 引用不变却内容/hash改变为完整性/幂等冲突；新反证须先由主线形成新合法 assessment/Gate observation。

INCONCLUSIVE/BLOCKED/ERROR/INVALID_INPUT 不产生虚假的 completed Resolution，不进入业务 append/count 流程。诊断去重沿用可观测基础设施。C1只证明两类key、纯比较和replay；I1分别实现事务唯一、原子比较、并发重试和checkpoint恢复，不能先查再插或用cache冒充。固定规则集，不允许LLM回调改变关闭/去重语义。

## 8. 主线接口需求（不是已存在 API）

| Seam | owner | 需求 | 当前/阶段 |
| --- | --- | --- | --- |
| S01 | contracts | identity/ref/Gate/Evidence与validator/types/canonicalization | EXISTING；相关#82修复仍须证据；C1 |
| S02 | node-runtime/persistence/platform | committed execution/facts一致查询、checkpoint、错误分类 | PLANNED_PROVIDER；I1 |
| S03 | verification | criterion版本 -> authoritative assessment -> Evidence覆盖 | PLANNED_PROVIDER；I1/真实Resolution |
| S04 | context/node-runtime/platform | contribution拒绝/裁剪、snapshot来源、Attempt实际使用 | PLANNED_PROVIDER；I2 |
| S05 | workflow/kernel | 已提交route/lineage、terminal/retry合法关系 | PLANNED_PROVIDER；I2/E1 |
| S06 | persistence | 两类记录唯一key、原子比较/写入/checkpoint、恢复与权限 | qualification存在，不等于业务Port；I1 |
| S07 | policy/platform | Proposal授权、版本变更和rollback审计 | FUTURE；Learning，不阻塞C1 |

接口方法由主线owner提供并通过consumer-conformance，不让主线适配LF临时global Repository。缺S02–S07只阻塞对应集成，不阻止获授权后的纯核心。V1外层逐criterion调用不得扩为LF内的新调度器。

## 9. Schema、实例与正常资格入口

六份Schema为execution-feedback、feedback-resolution、feedback-projection-input/result、feedback-resolution-input/result。前二为业务对象，后四为立即使用的边界。§3.1的单义务基数必须同时落实到两个Input、两个Result和持久化对象；拒绝额外batch字段，typed discriminant不能同时带candidate和error。两类fingerprint、normalizationVersion按§3–7表达。

不创建独立 learning/example-suite.json。当前 packages/contracts/src/examples.ts 固定读取 packages/contracts/examples/first-slice/example-suite.json，scripts/contracts/qualify-contracts.mjs调用该入口。十二份实例保存在examples/learning/，case追加原受检suite；不新增discovery/loader或隐藏第二资格命令。

caseId固定 `lf-c1.<schema-stem>.<valid|invalid>` 共十二个，绑定instancePath、schemaId、expected；invalid还需expectedError。保留旧case/expectation/semanticAssertions。受检suite为共享且authority-locked资产，写入须E1/E3批准。

tests/contract/example-suite.test.mjs固定38/19/19/22统计；已纳入候选scope，新增十二binding后同步期望，不降低原负例。未变基线且不新增semanticAssertions时为50/25/25/22；主线如新增case则依据最新冻结清单重定，不能动态自算掩盖缺项。

conformance断言十二固定ID/路径全部登记；正常contracts:qualify在隔离完整副本中面对删实例、错路径、invalid改valid、篡改expectedError必须失败，未破坏时新旧案例一起通过。局部withContractRepository/validateExampleSuite可作辅助，不冒充完整checkout/build。

新增基数反例由已授权的现有test文件构造，不增加第十三个实例或新的源码：criterionRefs零项/两项；混入另一criterion的assessment/closure；输出两个候选；同一原Gate下分别调用A/B，不同key/ID且不能交叉复用prior；多closure但同一criterion仍只有一个候选。格式合法不证明生产来源，实际I/O与并发仍由I/E阶段验证。

## 10. 审查记录和停止点

| ID | 独立来源 | 文档处置 | 当前 |
| --- | --- | --- | --- |
| LF-RV-01 | 08b701e / discussion_r3953795058：suite未接正常资格 | §9复用原受检suite与共享scope/负例 | ADDRESSED_PENDING_REVIEW |
| LF-RV-02 | 08b701e / discussion_r3953795060：集合/序列未冻结 | §7.2逐路径表、重复/版本/字节向量 | ADDRESSED_PENDING_REVIEW |
| LF-RV-03 | 08b701e / discussion_r3953795062：Resolution无幂等身份 | §5/7.4独立key/hash/prior | ADDRESSED_PENDING_REVIEW |
| LF-RV-04 | 39cdb4b / discussion_r3953843051：多义务配单ID/prior | §3.1收敛单原子criterion、单候选；§7.3/9与开工包一致 | ADDRESSED_PENDING_REVIEW |

39cdb4b的自动复核完成并提出LF-RV-04，不将未重复前三项等同于其已正式关闭。D01–D05及全部findings仍需最终subject独立覆盖/裁决。本次只修文档，不自行resolve线程/标VERIFIED，不改变#85未放行状态。
