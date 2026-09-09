# Learning & Feedback 分支设计：独立核心、主线集成、受治理改进

状态：`DRAFT — implementation not authorized`  
更新：2026-09-08  
设计基线：`3c387f5f196ddfae8e8989710d5a55f9def472a7`，tree `5938f8e2f3e3a5e5dfbd0fde5ac66c092f2a7117`  
本轮依赖复核main：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`  
[架构入口](../06-learning-and-feedback.md) · [CURRENT/计划](../../roadmap/learning-feedback-branch-plan.md) · [Contract精确定义](contract-and-seam-proposal.md) · [开工包](../../roadmap/learning-feedback-core-entry-plan.md) · [历史基线审查](../../reviews/learning-feedback/github-baseline-review-2026-09-08.md)

> 本文件定义架构与跨模块责任，不是第二份接口规范。LF-C1字段、调用基数、key/hash、结果与规范化规则唯一在Contract提案中细化，文件及验收在core-entry-plan中细化。它们仍待独立批准，不覆盖Charter、accepted ADR、active Schema或机器Authority，不授权Phase1提前实现Learning runtime。

## 1. 核心决策与V1边界

分支是同一TypeScript modular-monolith中的独立工作流和模块，不是新的Runtime/数据库/部署服务。确定性核心与事实读取、Context交付、持久化和治理执行解耦，运行时复用唯一主线。

LF-C1取得正式scope后可先实现纯核心/conformance，无需完整Runtime；真实集成按主线provider能力门禁接入。fixture通过只证明规则，不证明生产链。V1不训练模型，不自动改裁判，不建设插件市场或业务知识抽取系统。

**V1每次projectFeedback只处理一个原子criterion，criterionRefs恰一项，单个allocatedId/prior/key，至多一个候选；拒绝任何组合criterion/group或batch输入。** 同一criterion可有多个关闭要求和多个支撑/反证，但不能带另一criterion。evaluateFeedbackResolution每次也只处理一个Feedback与一个consumer Attempt，至多一条评价。原主线汇总Gate保留完整，不能为了本次选择伪造单criterion Gate。

多个独立criterion需未来外层分别调用，C1不建设批处理调度或跨义务事务。主线不可分的组合组目前明确不支持，不能借“Contract有定义”绕过V1范围；未来支持须新设计/Contract版本、scope及独立批准，不属于本次开工包。精确定义和反例见Contract§3.1与C1-V18。

## 2. 已观察能力与不可假设项

| 能力 | 指定基线中可见事实 | 当前用途 |
| --- | --- | --- |
| 工具链/Schema基础 | validator、generated types、架构检查已有代码 | 复用公开入口；#82涉及修复的可信性另需Evidence |
| Policy | Phase1 compiler/evaluator qualification | 不等于approval lifecycle实现 |
| Persistence | node:sqlite/PersistenceWorker qualification | 不等于已提供任意Runtime facts query |
| CLI/runtime/worker | Control API与进程资格能力 | startRuntime包装Control API，不是Workflow executor |
| GateDecision/EvidenceMetadata/NodeExecutionIdentity | active Schema存在 | 可作conformance输入，不证明生产producer |
| NodeExecutionRecord | planned，node-runtime owner，Phase2 | 不导入假想Repository |
| ContextSnapshot/ContextItem/RouteDecision | planned，目标Phase3 | 不宣称真实交付完成 |
| VerificationExecution/Assessment | planned，目标Phase3 | 不宣称真实Resolution生产评价完成 |
| 六个Learning Contract | planned，目标Phase7 | 沿用catalog，不另建owner |
| ExecutionFeedback/FeedbackResolution/LearningCase | 初始inventory未登记 | 先做semantic-gap与owner评审；C1不建设LearningCase |

该表为审查基线快照，不是全局CURRENT。主线5577c2e已合并#83审查/计划，但未因此关闭#82修复；实时状态由CURRENT和exact-head Evidence给出，不依赖旧绿色CI。

## 3. 三个闭环与权力边界

```text
主线：Command -> committed Event -> NodeExecution/Attempt
          -> ContextSnapshot -> controlled execution -> Verification/Gate
          -> Router/Kernel transition
                         |
                         | immutable facts / bounded query
                         v
Feedback：可信差距 -> 单原子纠偏义务 -> 受控Context贡献
                -> 后续Attempt使用provenance -> 原义务评价
                         |
                         | history + successful controls
                         v
Learning：准入 -> 归因候选 -> 因果验证 -> Proposal
                -> 既有Policy/approval/工程变更 -> 后续效果评价
KnowledgeProvider：独立治理项目知识，只接受知识缺口交接。
```

Router选择合法后续目标，Feedback仅按可信causation/scope贡献内容；可并行消费同一committed fact，不形成“Feedback先选Node”。分支不拥有第二套NodeRun/NodeResult状态机。Node是最小执行与归因单位，环境/上游/外部问题不能强行归入Node内部。

## 4. Canonical ownership

| 语义 | 唯一owner | 本分支责任 |
| --- | --- | --- |
| Execution/Attempt、NodeExecutionRecord | packages/node-runtime | 消费事实视图和引用，不重建身份 |
| 事件、转换、运行幂等基础 | kernel/workflow与persistence边界 | 使用公开能力，不改终态 |
| ContextSnapshot接收/预算/trust/redaction | packages/context | 贡献内容，不直接制作approved snapshot |
| EvidenceMetadata/EvidenceEdge | packages/evidence | 只查询事实/关系，不建第二EvidenceGraph |
| VerificationExecution/Assessment/业务Gate | packages/verification | 使用已裁决criterion事实，不重新做Oracle |
| Policy authority | packages/policy | 复用唯一evaluator |
| Feedback/Resolution、Learning规则 | packages/learning，新增Feedback ownership待批准 | 确定性投影/派生评价 |
| SQL/journal/projection/checkpoint | packages/persistence | 实现Port，不泄漏driver/table |
| 跨模块用例/wiring/lifecycle | packages/platform | 显式装配，无globalThis locator |
| 项目知识与写入权限 | KnowledgeProvider/资产owner | 只交接缺口或提案，不直接摄取/改库 |

既定LearningGateDecision是提案治理，不是复制业务Gate；仍受唯一Policy authority约束。不能因旧聊天“不要第二Gate/记录”而删除主线NER或已有正式LearningGate方向。

## 5. 代码与文档落点

语言与构建跟随toolchain/toolchain.json、pnpm lock、ADR-0007：TypeScript、ESM/NodeNext、现有project references。不维护平行工具链版本，不新建Java/Python服务。

```text
packages/learning/
  src/index.ts                 # @aseos/learning唯一public entry
  src/feedback/domain/         # 反馈语义
  src/feedback/application/    # C1纯用例、两类key、normalizer
  src/improvement/             # 后续Learning，C1不创建
  src/ports/                   # 后续真实I/O才创建，C1不建空接口
  test/
packages/platform/src/learning-feedback/  # 后续主线装配/用例
packages/persistence/src/                 # 后续复用Worker/Port
packages/contracts/schemas/learning/      # 批准后公共Schema
packages/contracts/examples/learning/     # 真实实例
packages/contracts/examples/first-slice/example-suite.json  # 原标准资格入口登记
```

conformance在tests/contract/learning-feedback/；后续integration/replay/fault-injection/acceptance各用既有测试层。精确文件清单只在core-entry-plan，目录图不是无限写授权。不创建packages/learning-feedback或.ai-local生产源码树。没有真实consumer不批量创建空包。

Domain不做I/O、隐式时钟/随机或环境读取；外层显式调用Port，主线Adapter由platform装配。只有外部model/tool/knowledge provider放packages/adapters。严禁deep import。C1不接platform/persistence，也不添加platform->learning反向接线。

公开Authority用本仓库docs/；旧.ai-local/docs/learning-feedback仅属于旧本地项目，下载副本不是第二权威。

## 6. 生产集成责任

### 6.1 权威事实读取

核心消费经边界验证的身份、版本、criterion assessment、Evidence、Gate、Contract/policy和固定snapshot/checkpoint。真实方法由主线owner提供，不发明NodeResultRepository来凑接口。

Query区分成功一致snapshot与NOT_FOUND/INCONCLUSIVE/BLOCKED/ERROR；暂未提交、版本不支持、权限缺失、引用损坏和wiring错误不能都变成正常UNRESOLVED。多记录读取使用一致snapshot，不能新Gate配旧Evidence。权威持久化遵守SQLite/PersistenceWorker，不新增YAML Facts Store；旧ILayout不自动移植。

### 6.2 ExecutionFeedback

表达一个原子criterion的纠偏义务及来源、关闭要求、适用边界；无Node/Evidence完整副本，无nextNode/rootCause/任意实现指令。V1不支持组合criterion/group；调用及结果均单条，遵守§1。

具体字段、sourceGate与所选criterion的关系、单个prior/allocation、缺失/冲突处理唯一见Contract§3–4/6/7.3，本节不另定第二套字段或identity。保留所有相关反证，事实不足返回gap，不编造observedGap。

### 6.3 Context与消费证明

主线选定目标Attempt后，由授权Context入口按causation/lineage/版本/权限查询相关反馈，不按Node名称或文本相似猜关联。内容经预算、trust、redaction、冲突及Policy检查。

已消费至少需要快照含反馈sourceRef与Attempt实际使用该snapshot的事实；provider调用成功、进入候选列表、内容被裁剪/拒绝都不能记为消费，也不证明模型遵守了内容。优先复用ContextSnapshot和NER provenance，只有主线确实不足才批准最小关联Contract，不新建Context store。新Attempt产生独立消费关系。

### 6.4 FeedbackResolution

一次评价一个Feedback和一个consumer Attempt。只匹配主线已裁决assessment对原关闭要求的覆盖，不跑测试、不把退出码转业务PASS、不重新做Oracle/Gate。完整评价才产生RESOLVED/PARTIALLY_RESOLVED/UNRESOLVED业务候选；必要事实不足或错误单独表达，不产生伪completed Resolution。

风险接受/豁免/取消不是已满足；一次后续PASS不批量关闭历史。固定原版本、lineage、消费证明、必要覆盖与反证，旧记录不可变，后续append-only，当前状态可重建。独立Resolution key/hash/prior、正常/错误结果和去重规则唯一见Contract§5/7.4，不沿用Projection身份。

### 6.5 主线Gate

完整处理active GateDecision的七种outcome：PASS、PASS_WITH_RISK_ACCEPTANCE、REWORK、BLOCK、REQUIRE_HUMAN_APPROVAL、FAIL_TERMINAL、INCONCLUSIVE。风险接受不等于修复，approval不变自动retry，terminal不被重开，unknown不当失败。逐项消费映射唯一见Contract§6；未知版本/required字段通过兼容评审，不默认成功。

## 7. 持久化、幂等与恢复

LF只记录自身语义及来源引用，不复制主线facts。复用基础设施不等于拥有别的owner写权限。核心不直接写SQL或跨模块状态。

Projection与Resolution各有独立key/hash/prior，身份材料、数组规范化及元数据排除规则只在Contract§7定义。**Projection V1 key绑定唯一原子criterion，不含group、批次下标或组合身份。** 无匹配prior的纯调用只生成候选，不宣称已查重或落库。

I1分别对两类key实施数据库唯一约束和事务内原子比较/写入，相同key不同内容冲突可见，不能仅先查再插或cache去重。派生发生在源事实提交后；checkpoint与派生记录具备原子恢复或已批准outbox/retry协议。写失败不撤销主线既成事实，不伪装成功；重启可重放/重建。缓存可丢弃且不影响正确性。

归档/删除保留合法manifest、retention/redaction状态与可解释引用；引用丢失不能当关闭。私有Evidence不因排错上传GitHub。当前Phase1 qualification不证明这些LF业务事务已经实现。

## 8. 后续Learning扩展

先以确定性准入识别重复criterion/version、多次未解决、严重事件或人工升级，保留成功对照与暴露分母。LearningCase只是问题集合，不自动归因。Attribution允许in-node/upstream/external/unknown，再形成RootCauseCandidate；复用现有六个计划Learning Contract，不为空步骤造public对象。

实验冻结target version、Context、模型/工具及允许变量，复用主线Execution/Verification；单次retry PASS不证明因果。保留方法、适用范围、反证和剩余不确定性。Proposal固定target version/diff、风险、回归、rollback，经既有治理应用；效果比较控制任务结构/模型变化，关注成本、时延、误阻断和回归，不将相关性写成学习成功。

未来如需组合criterion/group或batch API，必须有独立需求/Contract版本与验证，不在V1预留可执行旁路；不影响当前单原子义务接口的一致性。

## 9. 故障隔离与安全

默认可选增强：禁用时主线原许可路径仍运行。Policy明确要求反馈/证明时，缺失由主线fail closed，不得以“可选”为由无条件放行。两个模式显式配置，LF不降低Gate。

历史反馈是带provenance的数据，不升为系统指令；限制大小、敏感度、来源权限、寿命和注入风险。内容不能批准自己或修改WRITE_SCOPE。待修模块不得同时改实验verifier、Gate/Policy、审批凭据或expected结果。

## 10. 分层验证

| 层级 | 可证明 | 不可替代 |
| --- | --- | --- |
| Schema/examples | 格式/引用结构/版本与基数 | 来源真实性 |
| Pure/property/replay | 规则、两类key/normalization和反例 | 生产wiring |
| Conformance | consumer/producer接口兼容 | provider已存在 |
| Production integration | 干净bootstrap、正式query/persistence | 整个工作流 |
| Workflow E2E | public CLI/API到消费、复验、关闭 | 所有provider/私有环境 |
| Independent exact-SHA review | 指定scope/subject证据支持的结论 | 新HEAD自动继承 |

核心反例覆盖单criterion调用、错run/attempt/version、UNKNOWN/反证/风险接受、两类重复与冲突。I1/I2覆盖C-1式未装配依赖和C-2式写库读空cache，必须cold bootstrap/新进程正式路径，不手工补global/cache。还要覆盖crash/restart、多次纠偏、禁用/Policy必需模式。mock可用于外部不相关组件，但不得替代被证明的wiring/Context/assessment/transition。

## 11. 主线交界和dogfooding

主线应提供：execution/attempt版本身份；一致committed facts query及错误；criterion-level authoritative assessment；Context sourceRef与Attempt实际使用；后续Proposal/approval/rollback。owner与阶段见Contract§8，具体public entry和可用性由主线真实实现确认，不能把需求表当已存在API。

GitHub Issue/PR/CI是工程材料，不是Runtime NER。首次真正dogfooding须有受控workspace/worker、scope enforcement、可追溯执行及独立Gate；固定Framework/verifier，选单个可复现小修复。旧C-2可作案例意图，不上传旧私有源码，不让待修任务改裁判。外部独立复核保留。

无合法scope、必要provider缺失、owner/身份冲突、HEAD证据过期、测试须造假、需要越权改ADR或上传私有数据时停止。只阻塞相应集成，不抹掉未受影响组件成果。

## 12. 文档一致性与当前结论

LF-RV-04在d3138f1的复核指出本文件原§6.2/7仍允许组合组，与Contract单criterion冲突。本轮删除该V1许可，同步§1/6.2/7；架构入口也明确单义务。历史报告仍保留旧subject，不作为现行接口授权。

架构入口和本文只总结边界，Contract是唯一精确接口说明，core-entry是唯一精确实施/验收清单，CURRENT记录进度。规范细化时同轮检查这些导航与概述，避免多份细节各自漂移。

仍为待独立批准文档；不授权代码、不宣称生产Feedback完成。下一步按#85收口真实独立结论、合法scope、直接依赖与共享接线，不平行造Runtime。
