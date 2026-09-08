# Learning & Feedback

状态：`DRAFT v0.2 — mainline-alignment proposal`  
更新：`2026-09-08`  
审查基线：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
跟踪：[Issue #81](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/81)

> 本文件继续作为 Learning & Feedback 架构入口。v0.2 补充 Feedback 闭环、分支边界和建设门禁，不修改已接受 ADR，不授权 Phase 1 提前实现 Learning runtime。本文及配套设计尚待独立审查，不能据此声明任何运行能力 VERIFIED。

## 阅读入口与当前事实

- [分支详细设计：职责、Contract 缺口、代码落点与集成接口](learning-feedback/branch-design.md)
- [建设计划：可独立部分、主线依赖、WRITE_SCOPE 与验证等级](../roadmap/learning-feedback-branch-plan.md)
- [既有文档审查与基线证据](../reviews/learning-feedback/github-baseline-review-2026-09-08.md)

当前 GitHub 是完整重建仓库，不是旧本地 Framework 的代码延续。基线 main 已合入 P1-O08；其 execution record 明确 `phase1Verified: false`。本次在 main 的 execution/evidence 目录未找到 P1-O09 integrated handoff 完成记录。实际 `packages/` 尚无 `learning`、`node-runtime`、`context`、`verification` 等生产模块，Schema 的存在不能替代生产 producer/consumer。

因此，旧本地 F1–F4、C-1/C-2 的进度不能继承到本仓库。当前可以独立准备设计、Contract 差异和验证案例；纯核心实现须取得合法 operation/WRITE_SCOPE，真实运行集成须等待对应主线 provider。详细现状以带 exact SHA 的审查报告为准，不将此快照当作会自动更新的实时进度。

## 1. 定位

Learning & Feedback 的目标不是累积自然语言“经验”，而是利用运行事实识别可验证的系统改进，并在治理门禁后更新 Node Component。

两个时间尺度必须分开：

- **Feedback**：将已经确认的差距或前置条件缺口，交给主线选定的后续执行；用后续可信验证事实判断原纠偏义务是否满足。
- **Learning**：从跨执行反馈、返工及成功对照中识别改进机会，验证归因与效果，形成受治理的版本化变更提案。

Node 是最小执行与归因单位。学习对象包括 Context Policy、Contract、Skill、Verification Profile/Asset、Routing Policy、Node Boundary、Adapter selection/configuration。环境、上游或外部故障可以成为解释，不能强制归因为 Node 内部缺陷。

本分支改善“如何执行任务”，不拥有项目领域知识的摄取、抽取、验证或存储。知识缺失可形成交接请求，由 KnowledgeProvider/知识资产 owner 处理；这不新增一套 GBrain 或知识写入权威。

## 2. 权威链

```text
主线已提交事实 / NodeExecutionRecord
  ├─ 可信差距 -> Feedback -> 主线 Context 接收与执行 -> 后续验证 -> FeedbackResolution
  └─ 执行与反馈历史 / Evidence 关系
       -> Node Attribution
       -> RootCauseCandidate
       -> Causal Validation / Intervention / Replay
       -> ValidatedRootCause
       -> LearningProposal
       -> LearningGate
       -> Versioned Component Change
       -> 后续运行与效果验证
```

这里的 NodeExecutionRecord 是主线 `packages/node-runtime` 组装的结构化事实视图，不是由 Learning 复制一份 Runtime 状态。EvidenceGraph/EvidenceEdge 复用 `packages/evidence` 的关系权威。任何一步都不得由自由文本总结整体替代。

Feedback 不控制 Router。Router 根据主线可信结果决定后续 Node；Feedback 仅在主线构建该 Node Context 时贡献有来源、版本和作用域的纠偏信息。反馈生成与路由可以是同一 committed fact 的不同消费者，不强制 Router 等待 Feedback 或依赖其具体实现。

## 3. Node Attribution

Attribution 首先定位失败或返工与哪个 Node、Attempt、Context、Contract、Skill、Verification、Routing 或环境因素相关。

候选类别包括 missing/incorrect Context、Contract ambiguity、Skill defect、invalid routing、insufficient verification、tool/model/provider failure、permission/config/environment issue、boundary mismatch、implementation defect、data quality issue、non-reproducible/transient condition。

Attribution 必须保留 alternative explanations 和不确定性；“发现相关性”“进入学习案例”“已验证根因”是不同结论。

## 4. RootCauseCandidate

至少表达 candidateId、subject node/component、claim、supportingEvidenceRefs、contradictingEvidenceRefs、assumptions、confidence、proposedValidation、producer/version。高置信措辞不能替代 supporting Evidence。

## 5. Causal Validation

可使用 deterministic replay、Context ablation/addition、alternate Skill/Contract replay、verification asset injection、route intervention、controlled provider comparison、environment reproduction、counterfactual simulation 和 human domain review。

必须记录方法、适用范围、控制变量和限制。一次重试成功或专家意见本身不自动证明因果。只有观察相关性时仍为 candidate；ValidatedRootCause 必须说明验证依据、结果、剩余不确定性。模型重采样建立新的实验 execution，不能重写原历史。

## 6. LearningProposal

Proposal 是可审查差异，而不是“以后注意”。至少记录 target component/version、validated root cause refs、before/after diff、expected impact、risk、verification plan、rollback plan、scope of applicability。

可提出 Context freshness、output Contract、Node Boundary、verification oracle、routing condition、Adapter capability restriction、Skill version 等变更。涉及知识实体 alias/provenance 的建议只能交给知识资产 owner 的受控工作流，本分支不得直接成为知识库写入实现。

## 7. LearningGate

沿用既定 `LearningGateDecision` Contract 方向与 `packages/learning` owner；复用 `packages/policy` 唯一 evaluator 和现有审批/执行设施，不引入可替换的第二套 Policy authority。

Gate 检查 validated root cause、精确 Component/version、权限与安全风险、回归与 rollback、Workflow/Contract 冲突、Human Approval、Evidence 可复现性，以及应走 GitHub 工程变更还是本地配置变更。

`LearningGateDecision` 不替代业务执行的 `GateDecision`，更不能修改当前 Node 的终态。历史文档中“不要第二套 Gate”应解释为不复制既有裁决权，而不是禁止仓库已经规划的 LearningGateDecision 语义。

## 8. GitHub 单向建设的影响

本地 Learning System 可以生成并保存 Proposal，不得假设能自动上传或修改 GitHub Framework。变更按 owner 分流：

1. Local runtime configuration：经既有 Policy/Gate、版本化及 rollback 后应用。
2. Local knowledge asset：交给 Knowledge Adapter 的治理写入能力，默认需审批。
3. Framework Contract/code：转化为 GitHub 工程任务，经实现、独立验证及 Release。
4. Project source change：在本地 Workspace 的授权 Workflow 内处理，不等同于 Framework 学习。

V1 默认 proposal-first，不启用无审批自修改。私有运行 Evidence、代码、日志、知识内容不自动提交本仓库。

## 9. 防止静默失败

历史建设曾报告 singleton 未初始化、Context cache 不同步。新实现要求：

- evaluator 不读取隐式 global state；依赖在正式 composition root 显式装配；
- 输入引用 immutable subject/version 与 snapshot/checkpoint；
- dependency、读取或 schema 错误形成可观察 typed error/diagnostic，不冒充业务 UNRESOLVED；
- 缺少输入为 `INCONCLUSIVE/BLOCKED`，不得推断失败原因或成功关闭；
- cache 只能优化，可删除/重建，不得成为第二权威；
- evaluator 与 policy version 被记录；
- 验证覆盖 cold bootstrap、重启、fault injection、replay，并按风险补 mutation。

## 10. 学习质量

不以 Proposal 数量衡量学习。评价 repeated-failure recurrence、rework、root-cause validation、accepted-proposal effectiveness、regression、verification-gap closure、false block、rollback、延迟及验证成本。比较必须控制 definition/policy/provider/任务类型差异，保留成功对照和不确定性。

## 11. Feedback Contract 补充提案

现有 catalog/planned inventory 已列出六个 Learning Contract，但尚未列出 ExecutionFeedback、FeedbackResolution 和 LearningCase。本次只提出差异，不激活 Schema 或修改 inventory。

ExecutionFeedback 保存原始事实引用、criterion/version、observedGap、requiredOutcome、retainedConstraints、closure requirements、projection version/idempotency。它不包含 nextNode、rootCause 或主线状态副本。

消费证明优先复用主线 ContextSnapshot/NodeExecution 的 provenance：被 provider 找到不等于进入快照，进入快照不等于执行已经使用。新建消费关系必须先证明现有 Contract 不足。

FeedbackResolution 是已有验证事实对原关闭条件的派生评价，不执行新的业务 Oracle。必须区分评价能否完成与纠偏是否满足；缺依赖、证据不足、版本不匹配不可伪装成正常 UNRESOLVED。

主线 GateDecision 的七种 outcome 必须逐项处理。`PASS_WITH_RISK_ACCEPTANCE` 不等于缺口已修复；`REQUIRE_HUMAN_APPROVAL` 不得转成自动 retry；`INCONCLUSIVE` 不得编造 observed failure。细则见详细设计。

## 12. 独立建设的边界

**独立的是工作流和模块，不是状态权威、运行时或工具链。** 目标 owner 沿用 `packages/learning`；Schema 在 `packages/contracts/schemas/learning/`；mainline 集成和依赖装配位于 `packages/platform`；持久化沿用 `packages/persistence`。

Phase 1 禁止 production Learning runtime，也禁止创建空未来 package。此文不是新的 start Gate。代码实现前必须取得合法 operation、精确 WRITE_SCOPE、schema ownership review 与 VerificationPlan。局部 fixture/conformance 通过只证明组件行为，不证明真实 Feedback V1 闭环。

## 13. 文档与阶段维护

本入口定义边界，详细设计定义接口和落点，roadmap 记录阶段门禁与下一合法动作，review 保存 exact-baseline findings。执行者实现时同步文档和 Evidence，但最多声明 IMPLEMENTED；独立 verifier 对 exact SHA 裁决 VERIFIED。新 HEAD 或上游 Contract 变化必须重新判定证据适用范围。

旧本地 `.ai-local/docs/learning-feedback/` 只属于旧工作区。本仓库公开 Authority 按 `docs/README.md` 组织，不提交 `.ai-local/**`。后续本地下载副本不是另一份独立权威。

## 14. 变更记录

- 2026-08-26：v0.1，建立 proposal-first Learning 架构和 singleton/cache 失败防线。
- 2026-09-08：v0.2 提案，按 exact GitHub baseline 审查，补 Feedback 时间尺度、Contract 缺口、知识交接边界和分阶段解耦；保留 NER/Evidence/Policy/LearningGate canonical owners。未变更 accepted ADR、机器 scope 或运行实现。完整原稿保留在基线 commit，不改写历史 review。
