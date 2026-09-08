# LF-D1：Feedback Contract 与主线接口提案

状态：`DRAFT / NOT_APPROVED / NO_CODE_AUTHORIZATION`  
观察基线：`3c387f5f196ddfae8e8989710d5a55f9def472a7`，2026-09-08  
入口：[分支当前计划](../../roadmap/learning-feedback-branch-plan.md) · [总体设计](branch-design.md) · [开工计划](../../roadmap/learning-feedback-core-entry-plan.md) · [并行协议](parallel-development-protocol.md)

## 1. 这份提案解决什么

把总体设计收敛成第一包可以实现和验证的输入、输出、规则及主线交界需求。拟新增的长期业务语义只有 ExecutionFeedback 和 FeedbackResolution；输入/输出 Schema 是这两个用例的边界，不另建 Runtime facts、业务 Gate、Context 状态或知识库。

下述字段是待独立评审的候选 Contract，不是已激活 Schema。没有把上游尚未实现的 producer 写成已存在 API。批准后 Schema/type/consumer 必须在同一受授权变更中落盘。

## 2. 已有权威与不可复制项

| 已有 Contract | 当前真实定义 | 对本分支的约束 |
| --- | --- | --- |
| NodeExecutionIdentity | `packages/contracts/schemas/node/node-execution-identity.schema.json`；runId/nodeId/executionId/attempt，attempt >= 1 | 直接复用，不能只按 Node 名字分组 |
| SubjectRef | `packages/contracts/schemas/common/subject-ref.schema.json`；subjectType/subjectId，subjectVersion 可选 | 本分支引用版本化 definition/criterion/assessment 时额外要求固定版本；不改变原 Schema 的可选规则 |
| SchemaRef | `packages/contracts/schemas/common/schema-ref.schema.json` | 使用 schemaId/version/hash 等真实定义，不维护第二种 Schema identity |
| EvidenceMetadata | `packages/contracts/schemas/evidence/evidence-metadata.schema.json` | executionRef 在上游是可选；缺少来源关联时不能推断本次执行身份 |
| GateDecision | `packages/contracts/schemas/verification/gate-decision.schema.json` | 固定 subject/plan/policy/assessment/Evidence，完整处理七种 outcome |
| ProjectionCheckpoint | 现有 type-bindings 中的 canonical Contract | 不等于已存在能查询任意主线 facts 的 provider |
| NodeExecutionRecord / ContextSnapshot / VerificationAssessment | planned inventory 中的主线 Contract | LF 不实现这些 owner；不得导入尚不存在的类 |

当前公开入口为 `@aseos/contracts`，由 `packages/contracts/src/index.ts` 导出。generated type 绑定来自 `type-bindings.json`，禁止从另一个 package 的 src/dist/internal deep import。active Schema/Type 的存在不证明数据可信或 committed。

## 3. 语义归属决策

| 候选 | 为什么不是已有对象换名 | owner 提案 |
| --- | --- | --- |
| ExecutionFeedback | GateDecision 表达裁决；Feedback 表达尚需满足的具体义务、保留约束和关闭依据 | packages/learning；Schema 存 contracts |
| FeedbackResolution | 后续 Gate 表达该次执行结果；Resolution 表达它是否覆盖某条历史纠偏义务 | packages/learning；不重做业务正确性裁决 |
| FeedbackProjectionInput / FeedbackResolutionInput | 有边界的用例输入，引用原主线 Contract，供纯核心与后续 Adapter 共用 | 应用边界；不是持久化运行历史 |
| FeedbackProjectionResult / FeedbackResolutionResult | 区分结果、输入不足和错误，不把异常吞成正常业务结果 | 应用结果；不拥有主线状态 |

本次不新增 LearningCase、EvidenceGraph、NodeResult、FeedbackConsumption、Approval 或 LearningGate Schema。消费关系先使用主线 provenance；未来不足时另行批准最小补充。

## 4. 输入模型和信任前提

### ProjectionInput（候选边界）

| 字段/组 | 来源 | 缺失或不一致时 |
| --- | --- | --- |
| execution | NodeExecutionIdentity | INVALID_INPUT |
| sourceGate | 原 GateDecision，按现有 Schema 验证 | INVALID_INPUT；不把未知 enum 当成功 |
| sourceContractRef / criterionRefs | 固定版本的 Contract/criterion 引用与 hash | INCONCLUSIVE，不按当前最新 Contract 追认历史 |
| criterionAssessments | 主线 Verification 的逐条件裁决投影；每项带 assessmentRef、criterionRef、outcome、evidenceRefs | 不从日志/退出码自由推断；尚无主线 producer 时只可 fixture conformance |
| constraints / closureRequirements | 原 Contract/Verification 要求的必要投影，每项保留 sourceRef | 不编造新约束；无法映射就 gap |
| evidence | 相关 EvidenceMetadata，内容通过引用获取，不传整份运行历史 | 缺失、错 subject、错 execution、hash/信任不符不能用于确定结论 |
| sourceBoundary | 主线 snapshot/checkpoint/commit-receipt 的引用 | 由真实 Adapter 验证一致读取；调用方布尔值 committed=true 不构成证明 |
| evaluationContext | 显式传入 capturedTime、allocatedId、projectionVersion、inputHash | 纯函数不读当前时间、UUID、环境变量 |

逐条件 outcome 只表达上游已经产生的 MET / NOT_MET / UNKNOWN / CONFLICT 映射；它不是本分支从实际输出重新计算预期结果的 Oracle。这个映射待 Verification owner 接受，未接受前不当作生产接口。

### ResolutionInput（候选边界）

输入包括原 ExecutionFeedback、consumer 的 NodeExecutionIdentity、来源到 consumer 的有效 lineage/provenance、原关闭条件版本、后续主线 criterion assessments、GateDecision/Evidence refs 和一致 sourceBoundary。需要一条能够证明 Attempt 实际使用对应 ContextSnapshot 的事实关系，单独传 feedbackId 或手工写 consumed=true 不够。

核心校验结构、引用一致性与业务规则，不宣称能仅凭一个 DTO 证明源数据真实性。生产 Adapter 负责通过受授权 query/registry/事实来源建立可信输入；conformance fixture 明确不拥有这一信任能力。

## 5. ExecutionFeedback 候选字段

| 字段 | 规则 |
| --- | --- |
| schemaVersion / feedbackId | 按当前 canonical identity；ID 显式分配，不把 hash 冒充 UUID |
| execution / sourceDecisionRef / assessmentRefs | 稳定主线身份和来源；不复制 NodeResult |
| sourceContractRef / criterionRefs | 必须能恢复原版本语义；原子义务一个反馈，组合义务须原 Contract 明确定义 |
| evidenceRefs | 支撑观测差距的真实引用；未知 Evidence 不伪装支撑 |
| observedGap | 由已裁决差距确定性投影，不推测 root cause |
| requiredOutcome | 原 criterion 要求的结果，不指定新的代码修法 |
| retainedConstraints | 相关约束及其来源引用，不复制整个 Contract |
| closureRequirements | 逐条件目标、需要的 assessment/Evidence 类别、Gate requirement 及原版本 |
| applicability | 可用 lineage/definition version/权限范围；不是 nextNode |
| projectionVersion / inputHash / idempotencyKey / createdAt | 固定投影算法与输入；历史不可变，可重放 |

禁止字段：nextNode、routeDecision、rootCause、自由 recommendedImplementation、可变 workflowStatus、模型 reward。Feedback 本身不通过 mutable status 表达消费/关闭。

## 6. FeedbackResolution 和结果判定

Resolution 记录原反馈、consumer execution/attempt、逐关闭条件结果、后续 assessment/Gate/Evidence refs、剩余差距、evaluatorVersion、sourceBoundary、evaluationTime。它是 append-only 评价记录，不覆盖原 Feedback，也不改变主线终态。

两个结果层必须分开：

| evaluation status | 能否产生业务 Resolution | 含义 |
| --- | --- | --- |
| EVALUATED | 可以 | 所需事实已足够，才返回 RESOLVED / PARTIALLY_RESOLVED / UNRESOLVED |
| INCONCLUSIVE | 不得假装完整评价 | 缺必要覆盖、身份/版本关系不完整或事实不可判定 |
| BLOCKED | 不得关闭 | 权限/必要上游能力/依赖尚不具备 |
| ERROR / INVALID_INPUT | 不得伪装正常未解决 | schema、wiring、完整性或内部处理错误；使用 typed error |

完整评价下：全部必要义务由对应可信 MET 与要求的 Gate 结果支撑、无未处理反证，才 RESOLVED；部分明确满足、其余明确不满足为 PARTIALLY_RESOLVED；没有满足或阻断性反证为 UNRESOLVED。必要条件 UNKNOWN 时整体 INCONCLUSIVE，可返回已知逐项结果，但不得将未知塞成普通 NOT_MET。

风险接受/豁免/取消保留独立 disposition 与审批 provenance；不能视为 criterion 已实际修复。后续 Gate PASS 不能批量关闭没有精确关联的历史反馈。

## 7. 七种 Gate outcome 的可执行边界

| Gate outcome | 新反馈投影 | 对旧反馈关闭 |
| --- | --- | --- |
| PASS | NO_FEEDBACK_REQUIRED，除非存在矛盾输入则拒绝 | 必须匹配原 closureRequirements，不是万能关闭信号 |
| PASS_WITH_RISK_ACCEPTANCE | 有明确未满足义务可保留风险处置引用 | 风险接受本身不满足 MET，未修复项不能 RESOLVED |
| REWORK | 有已裁决 NOT_MET 和来源则 PROJECTED | 根据逐项事实评价；不由LF触发Retry |
| BLOCK | 有正式前置条件义务才可投影；不支持的缺口返回 INCONCLUSIVE | 不构造业务成功，不自行解锁 |
| REQUIRE_HUMAN_APPROVAL | 表达已有审批需求/交接，不自动批准 | 等待合法审批与原关闭条件，不能当作已修复 |
| FAIL_TERMINAL | 可保留有依据的差距作为历史/后续合法执行输入 | 不重开 terminal execution；跨执行关联须合法授权 |
| INCONCLUSIVE | 返回证据缺口；不将未知变成失败原因 | INCONCLUSIVE，不误关闭 |

未知 outcome/version 默认拒绝。Contract review 必须同时确认 PASS_WITH_RISK_ACCEPTANCE 的主线语义及“不满足却已获风险接受”的展示方式；不能修改既有 Gate Schema 来简化这张表。

## 8. 纯核心调用、幂等与扩展

目标 public entry：`@aseos/learning`。拟提供 `projectFeedback(input)` 和 `evaluateFeedbackResolution(input)` 两个无 I/O 用例，输入/输出由本提案的 Schema/生成类型校验；执行上下文已包含固定时间/ID。尚未创建任何函数或 package。

幂等语义 key 绑定 execution identity、source decision/version、criterion/group/version、source Contract hash、projectionVersion；inputHash 单独记录。相同语义 key 不同 inputHash 必须冲突可见；算法版本变化产生新投影而非覆盖历史。相同固定输入与上下文重放得到相同结果。

C1 只证明 key 推导与纯规则；唯一索引、并发 insert、事务/checkpoint/restart 属 I1，不用纯测试假装生产幂等。序列化与 hash 复用修复后的 canonical contracts API，不为绕过主线 R06 自建 serializer。

V1 固定一个有版本的规则集，不允许任意 LLM callback 改关闭规则。扩展按新 schema/evaluator version、conformance 与兼容 Gate 接入；无需现在建设 plugin registry。Feedback 不依赖 improvement 子域，后续 Learning 只读公共反馈历史接口。

## 9. 主线接口需求登记（不是已存在 API）

| Seam ID | 主线 owner | 所需能力 | 当前状态 | 何时必需 |
| --- | --- | --- | --- | --- |
| LF-S01 | contracts | 现有 identity/ref/Gate/Evidence Schema 与 public validator/type | EXISTING；R06/R09/R10 修复与重验未在当前main确认 | C1 |
| LF-S02 | node-runtime + persistence + platform | 有边界的 committed execution/facts query，snapshot/checkpoint、错误分类 | PLANNED_PROVIDER；没有承诺的方法名 | I1 |
| LF-S03 | verification | criterion版本 -> authoritative assessment -> Evidence 的覆盖关系 | PLANNED_PROVIDER；本表请求review | I1/真实Resolution |
| LF-S04 | context + node-runtime + platform | Context贡献、拒绝/裁剪结果、snapshot来源与Attempt实际使用证明 | PLANNED_PROVIDER | I2 |
| LF-S05 | workflow/kernel | 已提交route/lineage、terminal/retry合法关系 | PLANNED_PROVIDER | I2/E1 |
| LF-S06 | persistence | 派生数据唯一key、事务写入/checkpoint、恢复与权限边界 | QUALIFICATION_EXISTS；所需业务Port未提供 | I1 |
| LF-S07 | policy/platform | Proposal提交、授权、版本变更/rollback审计 | FUTURE_CAPABILITY | Learning，不阻塞C1 |

协议可以先约定“需要证明什么”；生产方法签名由主线 owner 提供并通过 consumer-conformance。不得反过来让主线去适配本分支随意想出的 Repository/global singleton。主线暂缺 S02–S07 不阻止获授权后的 C1 纯核心。

## 10. Schema 与示例落盘提案

授权后在 `packages/contracts/schemas/learning/` 建立 execution-feedback、feedback-resolution、feedback-projection-input/result、feedback-resolution-input/result 共六份 Schema。前两份为业务对象，后四份为立即使用的用例入出边界，不持久化第二份运行历史。不提前激活原 Phase 7 的其他 Schema。

每个 Schema 明确 required/optional/null、additionalProperties、版本、引用、敏感度；语义条件需额外 validator/property tests，不能只因 JSON 结构合法便宣称来源真实。字段详细含义以本文为候选，最终由独立 Contract review 一次冻结；实施者不能为通过测试自行改 expected results。

valid/invalid/boundary cases 包括：缺失必填引用、attempt=0、空必要集合、重复证据、未知版本、错执行/criterion版本、格式合法但来源不匹配、风险接受、未知事实、矛盾assessment与Gate、相同key异payload。生产读取/消费证明由 I1/I2 测试补足，不在 fixture 中自证。

## 11. 需要独立裁决的决策

D01：两项业务语义由 packages/learning 拥有，六份必要边界Schema只由 contracts保存。
D02：未知/缺失是评价不可完成，不是普通UNRESOLVED；已接受风险不等于已修复。
D03：criterion assessment由Verification owner产生，LF只能映射关闭义务。
D04：C1只依赖修复后的contracts与工具链，不读取数据库、YAML、global state或生产Context。
D05：主线真实seam按I1/I2补齐；C1 conformance通过不宣称provider已实现。

这五项均为待批准提案，正式开工还需 [Issue #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85) 的scope与exact-baseline门禁。禁止作者把本文发布等价成独立设计批准。
