# LF-D1：Feedback Contract 与主线接口提案

状态：`DRAFT / NOT_APPROVED / NO_CODE_AUTHORIZATION`  
设计起点：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
本轮接口复核主线：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`，2026-09-08  
[CURRENT](../../roadmap/learning-feedback-branch-plan.md) · [总体设计](branch-design.md) · [开工计划](../../roadmap/learning-feedback-core-entry-plan.md) · [并行协议](parallel-development-protocol.md)

## 1. 范围与 owner

第一包仅定义 ExecutionFeedback、FeedbackResolution 两项业务语义及实际使用的用例入出边界，不新增 Runtime facts、Oracle/Gate、Context 状态或知识库。业务 owner 提案为 packages/learning；公共/持久化 Schema 唯一保存在 contracts。下述内容待独立 review，不是已激活 Schema。

GateDecision 是本次执行裁决；Feedback 是尚待满足的具体义务；Resolution 是后续已裁决事实是否覆盖该历史义务。它们不能互相替代。本次不新增 LearningCase、EvidenceGraph、NodeResult、FeedbackConsumption、Approval 或原 Phase 7 的六项 Learning Schema。

## 2. 直接复用的 Contract

| Contract | 实际来源与限制 |
| --- | --- |
| NodeExecutionIdentity | `packages/contracts/schemas/node/node-execution-identity.schema.json`：runId/nodeId/executionId/attempt；attempt >= 1，不按 Node 名称猜身份 |
| SubjectRef | `packages/contracts/schemas/common/subject-ref.schema.json`：subjectType/subjectId，subjectVersion 可选；LF 对版本化 criterion/definition 的消费要求更严，缺失即 gap，不修改原 Schema |
| SchemaRef | `packages/contracts/schemas/common/schema-ref.schema.json`：精确为 schemaId/schemaVersion/schemaHash |
| EvidenceMetadata | `packages/contracts/schemas/evidence/evidence-metadata.schema.json`：executionRef 可选；缺对应执行来源不能自行补造 |
| GateDecision | `packages/contracts/schemas/verification/gate-decision.schema.json`：subject/plan/policy/assessment/Evidence 与七种 outcome |
| ProjectionCheckpoint | 现有 canonical 类型；不能据此假定任意 facts query provider 已存在 |
| NodeExecutionRecord/ContextSnapshot/VerificationAssessment | planned 主线 Contract；LF 不实现其 owner，不导入假想 Repository |

公开入口为 `@aseos/contracts`，`src/index.ts` 导出；类型绑定来自 type-bindings.json。禁止 deep import、平行身份类型或把存在 Schema 当作来源真实/已提交的证明。

## 3. 输入和信任边界

### FeedbackProjectionInput

| 组 | 内容与来源 | 不满足时 |
| --- | --- | --- |
| execution | NodeExecutionIdentity | INVALID_INPUT |
| sourceGate | 按现有 Schema 校验的 GateDecision | 未知版本/outcome拒绝 |
| sourceContractRef / criterionRefs | 固定版本与 hash；可恢复历史语义 | INCONCLUSIVE，不读取最新版本替代旧义务 |
| criterionAssessments | 主线 Verification 已作出的逐项裁决投影，含 assessmentRef、criterionRef、outcome、evidenceRefs | 不从退出码/日志自由推断；无 producer 时仅 fixture |
| constraints / closureRequirements | 原 Contract/Verification 必要要求，每项保留来源 | 不发明新要求，无法映射为 gap |
| evidence | 所需 EvidenceMetadata/ref，不复制运行历史 | subject/execution/hash/trust不符不可作支撑 |
| sourceBoundary | 主线 snapshot/checkpoint/commit-receipt 引用 | 生产 Adapter 验证一致读取；committed=true不是证明 |
| evaluationContext | 显式 capturedTime、allocatedId、projectionVersion | 核心不读当前时钟/随机UUID |
| priorFingerprint（可选） | 既有反馈的 feedbackId、idempotencyKey、inputHash；由调用者显式提供 | 未提供只能生成候选，不宣称持久化去重 |

criterionAssessments 的 MET/NOT_MET/UNKNOWN/CONFLICT 仅为上游裁决的消费映射，不是LF自行计算业务正确性的Oracle。该映射须 Verification owner 接受，未接受前只用于组件 conformance。

### FeedbackResolutionInput

原 ExecutionFeedback、consumer 的 NodeExecutionIdentity、合法 source-to-consumer lineage、ContextSnapshot 被该 Attempt 实际使用的事实关系、原关闭条件版本、后续 authoritative assessments/Gate/Evidence、一致 sourceBoundary、显式 evaluator/time/ID。

单独 feedbackId、consumed=true 或提供者被调用成功，均不能证明反馈被执行使用。生产 Adapter 从受授权主线查询建立可信输入；纯核心只校验已提供结构、关系一致性和义务规则，不独立证明来源真实性。

### Schema validation 与纯函数分界

C1 的 fixture/应用边界使用现有 ContractRegistry 验证六份 Schema；通过现有公开 loader 构造 registry 的 I/O 只在测试/外层，不在纯用例执行中。核心复用 canonical 类型和无I/O的canonical/hash能力，做语义约束，不复制JSON Schema validator、不调用 loadContractRegistry 读取文件。未来生产装配负责边界校验；类型断言不能替代真实校验。

## 4. ExecutionFeedback 字段

| 字段 | 规则 |
| --- | --- |
| schemaVersion / feedbackId | canonical identity；显式分配，hash不是UUID |
| execution / sourceDecisionRef / assessmentRefs | 原始稳定引用，不复制NodeResult |
| sourceContractRef / criterionRefs | 版本、hash与原子义务；组合需原Contract明确 |
| evidenceRefs | 有来源的支撑证据；缺失不伪装确定结论 |
| observedGap | 已裁决差距的确定性表达，不推测rootCause |
| requiredOutcome | 原criterion要求的结果，不新造实现方案 |
| retainedConstraints | 相关约束和来源，不复制整个Contract |
| closureRequirements | criterion/version、需要的assessment/Evidence类型和Gate要求 |
| applicability | 合法lineage/definition version/权限边界；不是nextNode |
| projectionVersion / inputHash / idempotencyKey / createdAt | 可重放的版本化派生身份；不可变历史 |

禁止 nextNode、routeDecision、rootCause、任意 recommendedImplementation、可变 workflowStatus、reward。消费与关闭通过后续事实/派生视图表达，不修改原反馈状态。

## 5. Resolution 规则

FeedbackResolution 保留 feedbackRef、consumer execution/attempt、逐关闭条件结果、后续assessment/Gate/Evidence refs、remainingGaps、evaluatorVersion、sourceBoundary、evaluatedAt。append-only，不覆盖原Feedback或主线终态。

评价能否完成与业务结果分开：

| evaluation status | 结果 |
| --- | --- |
| EVALUATED | 事实足够后才产生 RESOLVED / PARTIALLY_RESOLVED / UNRESOLVED |
| INCONCLUSIVE | 必要覆盖、身份、版本或事实不完整；可给已知逐项结果，但不能伪装完整评价 |
| BLOCKED | 权限/必要能力/依赖不足；不得关闭 |
| ERROR / INVALID_INPUT | wiring、Schema、完整性等typed error；不伪装正常UNRESOLVED |

所有必要义务获对应可信MET与原Gate要求支撑、无未处理反证，才RESOLVED。部分明确满足、剩余明确不满足为PARTIALLY_RESOLVED；无满足项或阻断性反证为UNRESOLVED。必要条件UNKNOWN则整体INCONCLUSIVE，不能当普通NOT_MET。

风险接受、豁免、取消单独记录disposition/审批provenance，不等于已修复。一次Node PASS不批量关闭未精确关联的历史反馈。F3式的“依赖为undefined所以全部正常未解决”必须成为可见错误。

## 6. Gate outcome 全映射

| outcome | 投影与关闭约束 |
| --- | --- |
| PASS | 通常NO_FEEDBACK_REQUIRED；矛盾输入拒绝；关闭旧反馈仍要精确coverage/lineage |
| PASS_WITH_RISK_ACCEPTANCE | 可保留明确未满足义务及风险处置；接受风险本身不是MET |
| REWORK | 有已裁决NOT_MET和来源才PROJECTED；不由LF触发Retry |
| BLOCK | 有正式前置义务才表达；否则INCONCLUSIVE；不编造执行失败/根因或自行解锁 |
| REQUIRE_HUMAN_APPROVAL | 保留正式审批交接，不自动批准；审批未满足不关闭 |
| FAIL_TERMINAL | 保留有依据历史差距；不得重开终态，后续合法执行另有lineage/授权 |
| INCONCLUSIVE | 显式证据gap，不推断FAIL、不关闭 |

未知版本/outcome拒绝。最终Schema必须表达这些区分，不能为了缩减枚举修改上游Gate。前置条件/approval的正式来源尚无provider时，不在C1伪造生产能力。

## 7. 无状态调用、指纹与幂等

拟公开 `projectFeedback(input)`、`evaluateFeedbackResolution(input)`，以及同一key模块中的纯 `deriveFeedbackKey` / `compareFeedbackFingerprint`。当前均未实现。核心每次只依赖输入；不存在跨调用的隐式记忆。

idempotencyKey 由 execution identity、source decision/version、criterion/group/version、sourceContract hash、projectionVersion确定。inputHash 对规范化的来源语义输入计算：execution、sourceGate/assessments、criterion/contract引用与hash、约束/关闭要求、evidence metadata及sourceBoundary。排除本次allocatedId/capturedTime/priorFingerprint和计算中的key/hash本身；事实自带的时间字段仍是来源内容。集合按Contract规范化，真正有序的输入不任意排序。调用者提供expected hash时必须核对，不能直接信任。

使用相同完整输入和evaluationContext重放，输出完全一致。新的分配ID或评价时间可以导致新候选元数据不同，但不能改变相同来源义务的语义key/hash。

跨调用比较只能基于显式priorFingerprint：同key同inputHash -> REUSE_EXISTING（返回旧feedbackId，不要求存储生成第二份）；同key异inputHash -> IDEMPOTENCY_CONFLICT；不同key -> 不当作同一记录。未提供既有指纹时返回PROJECTED候选；不能声称已在存储中查重。纯比较不证明priorFingerprint来自真实存储，生产调用方负责权威来源。

C1只证明规则与显式比较。数据库唯一约束、原子插入/比较、并发重试、checkpoint恢复属于I1，必须另有真实存储测试，禁止用先查再插或进程cache冒充正确性。

复用修复后的public canonicalJson/hash能力，不为绕过#82 R06自建serializer。V1固定一个版本化规则集，不支持任意LLM回调改变关闭语义；后续扩展通过Schema/evaluator新版本和conformance。

## 8. 主线接口需求（不是已存在 API）

| Seam | owner | 需求 | 当前/阶段 |
| --- | --- | --- | --- |
| S01 | contracts | identity/ref/Gate/Evidence及validator/types/canonicalization | EXISTING，相关#82修复仍须证据；C1 |
| S02 | node-runtime/persistence/platform | committed execution/facts一致查询、checkpoint、错误分类 | PLANNED_PROVIDER；I1 |
| S03 | verification | criterion版本 -> authoritative assessment -> Evidence覆盖 | PLANNED_PROVIDER；I1/真实Resolution |
| S04 | context/node-runtime/platform | contribution拒绝/裁剪、snapshot来源、Attempt实际使用 | PLANNED_PROVIDER；I2 |
| S05 | workflow/kernel | 已提交route/lineage、terminal/retry合法关系 | PLANNED_PROVIDER；I2/E1 |
| S06 | persistence | 派生记录唯一key、原子写/checkpoint、恢复与权限 | qualification存在，不等于业务Port；I1 |
| S07 | policy/platform | Proposal授权、版本变更和rollback审计 | FUTURE；Learning，不阻塞C1 |

接口方法签名由主线owner提供并通过consumer-conformance，不让主线去适配LF临时global Repository。生产缺S02–S07只阻塞对应集成，不阻止获授权后的纯核心。

## 9. Schema/实例及验证

授权后在 contracts/schemas/learning 下建立 execution-feedback、feedback-resolution、feedback-projection-input/result、feedback-resolution-input/result 六份Schema。前二是业务对象，后四是立即有consumer的用例边界，不是第二运行历史。

每份Schema明确required/optional/null、additionalProperties、版本/引用/敏感度；inputHash/priorFingerprint/result discriminant按§7表达。valid/invalid最小实例各一份，具体十二文件见开工包；example-suite每个case使用真实instancePath，不能内嵌不存在的payload字段。边界/性质测试可在test中构造，无需批量空fixture。

负例包括attempt=0、必需引用缺失、空必要集合、重复ref、未知版本、错执行/criterion、格式合法但来源不匹配、风险接受、未知/矛盾assessment、同key异hash。生产可信来源和并发幂等不得由fixture自证。

## 10. 独立裁决与变更记录

D01：两项业务语义packages/learning拥有，六份必要边界Schema存contracts。
D02：未知/缺依赖非普通UNRESOLVED，风险接受非已修复。
D03：逐criterion裁决由Verification owner产生，LF只评价原义务覆盖。
D04：C1无I/O；validator loader在外层；幂等比较需要显式既有指纹。
D05：I阶段验证真实seam，C1 conformance不冒充provider。

均待独立批准与 [Gate #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85) 放行。2026-09-08作者收口：精确SchemaRef字段、实例文件、无状态幂等/hash与校验边界，未修改任何已激活Schema或生产代码。
