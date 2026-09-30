# Learning & Feedback

状态：`DRAFT v0.3 — mainline-alignment proposal`  
更新：2026-09-08  
设计审查基线：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
接口复核main：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`  
跟踪：[Issue #81](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/81) / [开工Gate #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85)

> 本文件是架构入口，不是第二份具体接口Contract。文档仍待独立批准，不修改accepted ADR，不授权Phase1实现Learning runtime，也不声明运行能力VERIFIED。

## 阅读入口与事实边界

- [分支设计](learning-feedback/branch-design.md)：职责、代码落点和主线集成。
- [Contract精确定义](learning-feedback/contract-and-seam-proposal.md)：唯一的字段、调用基数、key/hash与结果规则。
- [CURRENT/建设计划](../roadmap/learning-feedback-branch-plan.md)：唯一分支当前状态。
- [LF-C1开工包](../roadmap/learning-feedback-core-entry-plan.md)：精确scope请求与验证。
- [原基线审查](../reviews/learning-feedback/github-baseline-review-2026-09-08.md)：历史发现与限制。

GitHub是完整重建仓库，不继承旧本地F1–F4/C-1/C-2实现或验证。初始main已合入O08而phase1Verified仍false；其后5577c2e合入#83审查/计划，不等于#82修复完成。实际Schema存在不证明Node/Context/Verification/Learning生产provider存在，动态进度以CURRENT及exact-head Evidence为准。

## 1. 定位

Feedback处理当前任务已确认的差距与纠偏义务；Learning从跨执行反馈、返工和成功对照中形成可验证的改进。目标不是积累“以后注意”，而是通过Evidence和治理更新Node组件。

Node为最小执行与归因单位。学习对象包括Context Policy、Contract、Skill、Verification Profile/Asset、Routing Policy、Node Boundary、Adapter配置。上游、环境和外部因素可成为解释，不强制归因为Node内部问题。

业务知识的摄取、抽取、验证和存储归KnowledgeProvider/知识资产owner；本分支只提出缺口/建议并交接，不新建GBrain或知识写入权威。

## 2. 权威链

```text
主线committed facts / NodeExecutionRecord
  ├─ 差距 -> Feedback -> 主线Context/执行 -> 后续验证 -> FeedbackResolution
  └─ 执行与反馈历史 / Evidence关系
       -> Node Attribution -> RootCauseCandidate
       -> Causal Validation / Intervention / Replay
       -> ValidatedRootCause -> LearningProposal -> LearningGate
       -> Versioned Component Change -> 后续效果验证
```

NER由packages/node-runtime组装，EvidenceGraph/Edge由packages/evidence拥有，LF只消费，不复制Runtime状态。自由文本摘要只能作为附属Artifact。

Router根据主线事实选择Node，Feedback只提供来源/版本/作用域明确的纠偏输入；二者可消费同一committed fact，不形成LF选路或主线依赖LF具体实现的倒置。

## 3. Attribution与RootCauseCandidate

先定位Node/Attempt/Context/Contract/Skill/Verification/Routing/环境因素，保留替代解释和不确定性。缺Context、Contract歧义、Skill缺陷、错误路由、验证不足、工具/模型/权限/环境、边界或数据质量等是候选类别，不自动成为根因。

RootCauseCandidate记录candidateId、subject、claim、支撑/反证引用、assumptions、confidence、验证计划、producer/version。高置信措辞不能替代Evidence；学习准入、相关性和已验证因果是不同结论。

## 4. 因果验证

复用deterministic replay、Context增减、替代Skill/Contract、验证资产注入、路由干预、受控provider对比、环境复现、counterfactual或human domain review。记录方法、控制变量、范围和限制。

一次重试成功、模型反思或专家意见本身不自动证明因果。ValidatedRootCause必须说明验证依据、结果和残余不确定性；模型重采样创建新实验execution，不改历史。

## 5. LearningProposal

提案应有精确target component/version、validated root cause refs、before/after diff、expected impact、risk、verification、rollback和适用范围。可涉及Context freshness、输出Contract、Node边界、oracle/验证资产、路由条件、Adapter限制、Skill版本。

涉及知识实体alias/provenance的建议只交给知识owner受控流程，LF不直接写知识库。

## 6. LearningGate

沿用既定LearningGateDecision方向和packages/learning owner，复用packages/policy唯一evaluator与既有审批设施，不引入替代Policy authority。

检查根因依据、精确版本、权限/安全、回归/rollback、Workflow/Contract冲突、Human Approval和Evidence，以及GitHub工程变更或本地配置变更的分流。LearningGateDecision不替代业务GateDecision、不修改Node终态；“不要第二Gate”指不复制既有裁决权，不是否定已有正式提案治理对象。

## 7. 单向GitHub建设与变更分流

本地系统可生成/保存Proposal，不假设能自动上传或改GitHub。

- 本地runtime配置：既有Policy/Gate、版本化、rollback后应用。
- 本地知识资产：知识owner治理写入，默认审批。
- Framework代码/Contract：GitHub工程任务、独立验证与Release。
- 项目源码：本地Workspace授权Workflow，不等同Framework学习。

V1 proposal-first，无审批不自修改；私有代码、日志、Evidence、知识内容不自动提交。

## 8. 静默失败防线

历史singleton未初始化、Context cache不同步作为回归案例意图，不当作新仓库已复现bug。新实现显式composition/DI、稳定版本引用与snapshot；依赖/读取/schema错误可观察，不变成普通UNRESOLVED；缺必要输入保持INCONCLUSIVE/BLOCKED，不能编造因果或成功。

cache可删除/重建且不影响正确性。记录evaluator/policy版本；真实集成需cold bootstrap、restart、fault injection和replay，按风险补mutation。默认可选模块禁用不破坏主线；Policy明确要求反馈时由主线fail closed，不私自降低要求。

## 9. 学习质量

不以提案数量衡量。检查重复失败/返工、根因验证率、提案效果、regression、验证缺口、误阻断、rollback、时延和成本。控制任务结构、definition/policy/provider版本变化，保留成功对照与暴露分母，不把其他升级收益归因于本次学习。

## 10. Feedback V1具体边界

**V1一次投影仅一个原子criterion，单个allocatedId/prior/key，至多一个Feedback结果；不支持组合criterion/group或batch。** 同criterion可含多个关闭要求/支撑/反证；另一criterion材料拒绝。多独立义务留外层逐次调用，LF-C1不增调度器或批量事务。一次Resolution同样单反馈/单consumer Attempt，至多一条评价。

ExecutionFeedback/FeedbackResolution是本次拟补的两项业务对象，具体字段/Schema边界/key/hash及错误规则只在Contract提案定义；学习历史准入等不是C1范围。对尚未激活的Schema不声称已发布；未来扩大组合支持须新版本/授权/验证，不能借本入口概述扩大范围。

消费证明优先复用ContextSnapshot/NER provenance：找到反馈不等于快照纳入，纳入不等于Attempt实际使用。Resolution只使用主线已裁决事实评价原关闭义务，不执行新Oracle。依赖不足/UNKNOWN/版本不符不冒充正常未解决；风险接受不等于修复；PASS不批量关闭。

七种主线Gate outcome的逐项处理、单义务规则及两类幂等协议见Contract§3–7，本入口不维护另一个字段表或key公式。

## 11. 独立建设与文档分工

独立的是模块/任务，不是Runtime/事实权威/工具链。复用packages/learning、contracts Schema、platform装配和persistence；不复制NER/Evidence/Policy/业务Gate，不建空未来包。

Phase1现行scope仍禁止LF生产实现。开工需合法operation、精确scope、独立review和VerificationPlan。组件conformance不等于生产闭环。

本入口/branch-design保留架构概述，Contract提案唯一细化接口，core-entry唯一列实施/验收，CURRENT记录阶段，历史review绑定旧SHA；减少重复的规范细节。修改Contract时必须同轮核对所有现行概述，历史报告明确为历史而不改写。

执行者同步代码/测试/文档/Evidence，最多IMPLEMENTED；独立verifier按exact subject裁决。新HEAD/接口变化重评证据，发布/运行绿色检查不等于设计获独立批准。.ai-local/docs/learning-feedback仅属旧本地；新仓库公开Authority用docs/。

## 12. 变更记录

- 2026-08-26 v0.1：proposal-first Learning方向与singleton/cache防线。
- 2026-09-08 v0.2：按GitHub重建基线补反馈闭环、owner、主线依赖和建设门禁。
- 2026-09-08 v0.3：LF-RV-04复核后将入口/总体设计与单criterion V1同步；具体Contract只保留一个定义源。未改accepted ADR、机器scope或运行代码；原稿在历史commit保留。
