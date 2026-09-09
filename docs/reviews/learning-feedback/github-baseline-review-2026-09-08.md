# Learning & Feedback：GitHub 基线与既有文档审查

日期：`2026-09-08`  
类型：`SOURCE_BASED_DOCUMENT_AND_ALIGNMENT_REVIEW`  
subject repository：`olu37776-bit/-ai-software-engineering-os`  
subject commit：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
subject tree：`5938f8e2f3e3a5e5dfbd0fde5ac66c092f2a7117`  
关联：[Issue #81](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/81)

## 1. 判定

**可以建立独立的、契约驱动的建设支线；当前不足以独立交付生产 Feedback 闭环，也未获准在 Phase 1 实施 Learning runtime。**

本次直接核查 GitHub 文档、tree、Schema、实施记录与 exact-main check 状态。它是现状/文档审查与设计输入，不是 Feedback 代码独立验收。配套设计与本报告同轮编写，仍需另一独立 review 才能批准，不能以本报告自证新设计 VERIFIED。

重要纠正：旧本地“F1–F4 完成、C-1 已验证”的叙述不能投射到这个 full-rebuild 仓库。当前主线也不是 README 底部仍描述的 Phase 1 未启动状态。

## 2. 证据与覆盖范围

以下仓库来源统一绑定上述 subject。可用 [exact tree](https://github.com/olu37776-bit/-ai-software-engineering-os/tree/3c387f5f196ddfae8e8989710d5a55f9def472a7) 定位，不以可变 main 替代历史对象。

| ID | 来源 | 本次确认 |
| --- | --- | --- |
| S01 | README.md；CONTRIBUTING.md；docs/README.md | full rebuild、GitHub -> local、Authority/角色/变更规则 |
| S02 | docs/architecture/06-learning-and-feedback.md（旧版 blob ec28490a79729889a87f01a9123e268e5645d302） | 原 Learning 主链、知识交接、singleton/cache 约束 |
| S03 | docs/architecture/03-durable-execution-model.md §12–13 | NER 是结构化事实视图；state/evaluation replay |
| S04 | docs/engineering/repository-blueprint.md | packages/learning、node-runtime、evidence、platform、persistence owners/public entries |
| S05 | docs/contracts/core-contract-catalog.md §4–8 | 身份/Context/Verification/Learning Contract 边界 |
| S06 | packages/contracts/planned-contracts.json | NER/Context/Verification/六个 Learning Contract 仍 planned |
| S07 | packages/contracts/schema-registry.json；schemas/verification/gate-decision.schema.json | active schema 与 Gate 七种 outcome；不证明 runtime producer |
| S08 | docs/roadmap/progress-status.md；rebuild-roadmap.md | 阶段目标和明显过时的当前状态段落 |
| S09 | operations/phase-1/operation.json；write-scope.json；authority-lock.json | Phase 1 禁止 production Learning；immutable/operation-scoped 限制 |
| S10 | operations/phase-1/executions/ tree | 可见 O01–O08 记录；未见 O09 execution |
| S11 | operations/phase-1/executions/p1-o08-windows-qualification-release.json | independentlyVerified true，phase1Verified false，productionApproved false |
| S12 | packages/ tree | 实际仅 adapters/contracts/persistence/platform/policy；缺目标 Runtime/Context/Learning packages |
| S13 | apps/runtime/src/index.ts | startRuntime 包装 startControlApi，不是 Workflow executor |
| S14 | scripts/toolchain/scope-policy.mjs 与 verify-scope.mjs | governed path 判断、NON_OPERATION_GOVERNANCE 与 DENY_BY_DEFAULT |
| S15 | exact-main commit/check-runs API | main 为 O08 merge；可见 verify、Windows qualification/startup 等 success |

证据 API：[main commit](https://github.com/olu37776-bit/-ai-software-engineering-os/commit/3c387f5f196ddfae8e8989710d5a55f9def472a7)；[checks](https://api.github.com/repos/olu37776-bit/-ai-software-engineering-os/commits/3c387f5f196ddfae8e8989710d5a55f9def472a7/check-runs)。已读 `verify` job 99771006081、Windows qualification job 99771006149、clean Windows startup job 99771148665 均为 success。它们支持 repository/packaging qualification，不是 Feedback 工作流 E2E。

覆盖限制：本次执行环境 git clone 因 DNS 不可达失败；改用已连接 GitHub 逐文件/树读取。未在本会话执行仓库 build、unit、Windows 或 runtime E2E。没有取得旧本地 `.ai-local/docs/learning-feedback/learning-feedback-v1.md`、R0/R1/remediation/C-1 原始报告全文；File Library 可获得的是较旧 Phase 1 handoff。因而不能逐条复核旧 18 findings 或确认旧 C-1 的修复事实。它们只作为 user-reported 历史案例，不计入本次新 findings 数量。

## 3. 实际进度重建

1. main 已包含 P1-O08 qualification release；S11 把实现声明限定在 IMPLEMENTED，另记录独立验证，通过项与 production capability 分开。
2. `phase1Verified:false`，本次主线未找到 O09 integrated handoff 完成记录，不能宣布 Phase 1 全部 VERIFIED。
3. S12/S13 与 S09 一致：当前是 executable repository foundation，不是 production Workflow/Node Runtime。
4. active Schema 支持未来 Contract 的表达和验证，不等于已提供 NodeExecutionRecord query、Context delivery 或 criterion-level assessment producer。
5. Learning runtime 新仓库状态为 NOT_IMPLEMENTED；独立建设须先授权再分级验证。旧本地 Feedback 的状态另属一个 subject。

## 4. Findings

以下是八项文档/对齐风险，不是八个已复现运行时 bug。严重性按“若直接据此施工，是否可能越界或产生虚假 readiness”评估。

### LF-DOC-01 — HIGH：当前进度入口明显过时

来源 S01/S08/S10/S11。README 当前阶段仍为 Phase 1 NOT_STARTED/entry blocked；progress-status 仍为 next P1-O01；roadmap 最后的当前下一步仍指向 Phase 0。与 main 的 O08 实施和检查记录不一致。

影响：新 Agent 可能重复开工、错误恢复或高估/低估依赖。建议 P1-O09/获授权状态收口任务依据 exact execution + independent + post-merge Evidence 更新入口，不直接把整个 Phase 1 写 COMPLETE。

本次处理：在 Learning 入口和本报告提供明确 SHA 快照；未改受 Phase 1 scope 管理的全局进度文件。**全局 drift 尚未关闭。**

### LF-DOC-02 — HIGH：原 Learning 文档缺少可实施的 Feedback 闭环

来源 S02/S05/S06。原主链从 NER 直接进入 attribution/causality/proposal，未说明当前运行的纠偏义务如何生成、交付、证明消费、逐条件关闭。inventory 也没有 ExecutionFeedback/FeedbackResolution。

影响：实现者可能分别在 Router/Context/Resolution 中自创三套语义，或把 Node PASS 当全部反馈关闭。建议先做最小 Contract semantic-gap 和 owner review，不立即新增一套框架。

本次处理：更新入口并给出 Contract 候选/消费与关闭边界。**只完成文档提案，Schema 和 runtime 未实施。**

### LF-DOC-03 — HIGH：缺独立建设的阶段授权与依赖门禁

来源 S08/S09/S12。路线图把 Learning V1 放 Phase 7；Phase 1 明确禁止 production Learning 和相关 package 创建。原06没有“可以先做什么/不能假装什么”的交界规则。

影响：以支线名义绕开 Phase 1 scope，或长期等待全部框架却没有可交付小核心。建议拆文档/纯核心/生产集成/工作流验收，所有代码另有合法 operation。

本次处理：新增 staged plan；明确目录设计不是写授权。**当前 production integration 仍 blocked by capability，纯核心代码也尚未授权。**

### LF-DOC-04 — MEDIUM：旧本地概念若照搬会冲突 canonical owner

来源 S03/S04/S05，以及用户旧会话提供的设计摘要。旧提示词曾笼统禁止 NER、新 Gate 或要求新 learning-feedback 模块；新 Authority 已有 node-runtime NER、evidence relation、LearningGateDecision 与 packages/learning。

影响：可能为了“解耦”删除已有 Contract 或创建平行 owner。正确含义应为禁止重复事实/裁决，不是禁止已有正式对象。

本次处理：新增映射，明确旧 NodeRun/NodeResult/ApprovedContext 名称不是新仓库已存在 API。**不是对旧源文件全文的审计结论。**

### LF-DOC-05 — MEDIUM：知识改进建议与知识写入 ownership 需要明确

来源 S02 §6/8。给知识实体 alias/provenance 的 Proposal 以及 Local knowledge asset 分流本身可成立，但与“Framework 自学习”定位之间的责任边界不够显式。

影响：后续可能把知识摄取/存储并入 Learning。建议保留 knowledge-gap/Proposal handoff，实际抽取、验证、持久化和写权限由 KnowledgeProvider/资产 owner 治理。

本次处理：入口与设计明确分流，不删除原有受治理知识交接，不重构 GBrain。

### LF-DOC-06 — MEDIUM：无生产可用接口地图，容易重演 global/cache 故障

来源 S02 §9、S04/S06/S12/S13。原防线禁止隐式 singleton/cache authority，但没将事实读取的真实 provider、cold bootstrap、snapshot、错误传播与当前缺失接口逐项绑定。

影响：只满足静态分层，运行时仍访问未装配 repository；把 cache 当查询源。建议 query/identity/context/assessment interface readiness 表、显式 DI 和两个历史 defect-family regression cases。

本次处理：设计记录 owner/待提供能力，不宣称旧 C-1/C-2 出现在新仓库。**新实现必须在后续真实集成层验证。**

### LF-DOC-07 — MEDIUM：反馈投影与关闭需要覆盖完整 Gate outcome 和不确定性

来源 S07。当前 Gate 包含 PASS_WITH_RISK_ACCEPTANCE、REQUIRE_HUMAN_APPROVAL、FAIL_TERMINAL、INCONCLUSIVE，不等于旧 ACCEPT/REJECT 二分。原06没有反馈侧映射。

影响：风险接受被当修复完成，INCONCLUSIVE 被当失败，approval/terminal 被错误 retry；dependency failure 被压成正常 UNRESOLVED。

本次处理：增加七 outcome 的映射约束；评价状态与纠偏 disposition 分开。**最终字段/枚举仍待 Contract review，不静默修改 active schema。**

### LF-DOC-08 — MEDIUM：缺分层验证与 dogfooding 准入定义

来源 S01/S08/S11。已有一般独立验证原则，但 Feedback 分支没有区分纯核心、conformance、production wiring、workflow E2E、自举实验。

影响：包装启动 E2E、构造 fixture 或 CI finding 会被当 Runtime 真实运行；先让框架修改自己的 Gate/验证器导致自证。

本次处理：分级 evidence claim，固定主线与 verifier，真实自举依赖 worker/workspace/独立 Gate。当前仅设计，不授予任何 Runtime VERIFIED。

## 5. 旧文档处理矩阵

| 原文/约束 | 结论 | 处理 |
| --- | --- | --- |
| repo 06：proposal-first、candidate 非根因、因果验证 | 保留 | 不扩大自动学习权限 |
| repo 06：singleton/cache 防线 | 保留并具体化 | 增加 lifecycle/read-source/错误/重启门禁 |
| repo 03/blueprint：NodeExecutionRecord 与 Evidence owner | 保留 | 只禁止 Learning 复制，不否定正式主线对象 |
| repo 06：Knowledge asset 建议 | 澄清 | 保留治理交接，不增加本分支知识库实现 |
| root/progress/roadmap 当前阶段说明 | 已确认 drift | 后续合法 mainline operation 修正；本次报告不掩盖 |
| 旧本地 .ai-local baseline/R0/R1 | 全文未取得 | 不宣称已逐行审查；本次不上传私人文档 |
| 旧本地 Java/ILayout/F1–F4/C-1 进度 | 不可移植为新框架 Authority | 只保留经来源说明的故障测试意图 |

## 6. 对新设计的审查要求

本次提案新增四份相互关联文档，不改 accepted ADR、Schema、source/test/build/CI 或 Phase 1 authority。独立 reviewer 下一步应确认：owners 没改变；phase scope 没绕过；拟新增 Contract 有真实语义缺口；七 outcome 与缺失输入可表达；代码落点遵守 blueprint；当前状态没有虚假 VERIFIED；旧源码/私有数据没有被搬运。

root status drift 不因局部入口补充而算解决；其他 finding 的“本文给出设计处理”也不等于未来实现已验证。所有闭环生产证明留待新 subject 的独立测试/Review。

## 7. 发布验证与已知限制

本次计划通过 Git data 发布一个仅四文件的 docs-only commit，Draft PR 指向 protected main。发布后在 PR 中记录 exact head、changed paths 与远端 checks；不把 CI 的格式/治理 PASS 等价成新设计的独立语义批准。

本报告不执行旧本地 18 findings 的重审，不审计整个 repo 所有代码，也不代替 P1-O09。若需评价旧修复是否仍有效，必须取得其 exact subject/source reports，不能依据用户摘要做强结论。

## 8. 下一步

先独立审查本提案，再执行 LF-D1 的 Contract/接口需求与 LF-C1 开工授权准备。主线继续自己的 P1-O09/后续合法 Kernel 和 vertical slice；本分支通过 capability gate 接入，而不是平行造 Runtime。完整设计见 [branch-design](../../architecture/learning-feedback/branch-design.md)，执行顺序见 [branch-plan](../../roadmap/learning-feedback-branch-plan.md)。
