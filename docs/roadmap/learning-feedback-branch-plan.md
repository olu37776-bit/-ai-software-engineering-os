# Learning & Feedback 分支建设计划与 CURRENT

状态：`DRAFT — LF-D1 preparation complete; code entry not released`  
更新：2026-09-08  
观察main：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
跟踪：[文档 #81](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/81) · [Draft PR #84](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84) · [开工Gate #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85)

## 1. 唯一分支当前状态

| 维度 | 当前结论 |
| --- | --- |
| 设计材料 | LF-D0 + LF-D1 DRAFT_PREPARED，待独立review |
| 当前动作 | DOCS_AND_CORE_ENTRY_REVIEW |
| 独立核心代码 | NOT_IMPLEMENTED / ENTRY_NOT_RELEASED |
| 生产Feedback集成 | NOT_IMPLEMENTED / WAITING_FOR_MAINLINE_CAPABILITY |
| Learning runtime | NOT_IMPLEMENTED |
| 主线并行工作 | #82修复R01–R16/WR01并完成P1-O09/V10；#83为review/plan PR，不等于已修复main |
| 下一任务 | 关闭#85开工门禁后，LF-C1纯核心 |

旧本地D1/F0/F1–F4/C-1状态属于另一个subject，不继承到本仓库。main当前仍是O08后的foundation，不因存在Schema便具备Workflow/CCP/Verification producer。旧review快照保留，当前状态只在本文维护，不生成第二个CURRENT。

## 2. 文档阅读顺序

1. [架构入口](../architecture/06-learning-and-feedback.md)：定位和canonical owners。
2. [总体设计](../architecture/learning-feedback/branch-design.md)：数据、模块与完整生命周期。
3. [Contract和主线接口提案](../architecture/learning-feedback/contract-and-seam-proposal.md)：第一包精确输入/输出与缺失语义。
4. [并行建设协议](../architecture/learning-feedback/parallel-development-protocol.md)：watchlist、共享文件单写者、head同步和重验。
5. [LF-C1开工包](learning-feedback-core-entry-plan.md)：第一包文件清单、scope请求、VerificationPlan。
6. [LF-D1准备状态](../reviews/learning-feedback/lf-d1-readiness-2026-09-08.md)：已完成材料与尚缺证据。
7. [原基线审查](../reviews/learning-feedback/github-baseline-review-2026-09-08.md)：保留历史发现和覆盖限制。

上位Charter、accepted ADR、active Schema和机器Authority优先。本文与细化提案仍DRAFT；任何“候选文件清单”不覆盖现行Phase 1禁令。

## 3. 独立建设方式

独立任务、工作树和package，不独立事实源或Runtime。采用既定TypeScript/ESM工具链与packages/learning，纯核心只使用公开contracts；主线适配、持久化、Context、治理按真实capability逐段接入。

Feedback改善当前执行纠偏；Learning改善未来执行规则；知识内容的摄取/写入仍由KnowledgeProvider负责。本分支不复制NodeExecutionRecord、EvidenceGraph、Policy evaluator或业务Gate，不将旧Swap/Java/ILayout结构搬进新仓库。

## 4. 工作包与声明边界

| 工作包 | 目标 | 当前/前置 |
| --- | --- | --- |
| LF-D0 | 新旧基线审查、总体设计、代码owner | DRAFT_PREPARED；PR84最初4文件 |
| LF-D1 | Contract、seam、并行协议、core-entry包 | DRAFT_PREPARED；独立review尚未完成 |
| LF-C1 | 纯projector、closure evaluator、key、必要Schema和conformance | #85 E0–E4放行后可独立写代码，不要求完整Runtime |
| LF-I1 | committed facts/query、正式composition、persistence/restart | 等node-runtime/persistence/assessment真实provider |
| LF-I2 | Context贡献、snapshot、Attempt消费provenance | 等Context/Router/NodeExecution真实provider |
| LF-E1 | public entry真实Feedback闭环及异常恢复 | 等I1/I2与Verification/Gate；独立exact-SHA验证 |
| LF-L1 | 学习准入、归因、因果验证、Proposal/Gate、效果 | 按Phase7及正式capability门禁逐项建设 |
| LF-X1 | 真实隔离修复dogfooding | 受控workspace/worker、WRITE_SCOPE、独立裁决具备；固定裁判基线 |

LF编号是工作包，不改rebuild-roadmap的正式Phase，不伪造P1-Oxx。组件级CORE_CONFORMANCE可独立有verdict，不能据此把Feedback V1/runtime标VERIFIED。

## 5. 本轮授权范围

用户本轮要求继续补齐文档到可开工，并确保与主线同步；#81记录docs-only扩展。没有跳过独立review：允许并行起草LF-D1材料，但正式批准和代码启动仍由#85控制。

PR #84相对main仅以下八份Markdown：

```text
docs/architecture/06-learning-and-feedback.md
docs/architecture/learning-feedback/branch-design.md
docs/roadmap/learning-feedback-branch-plan.md
docs/reviews/learning-feedback/github-baseline-review-2026-09-08.md
docs/architecture/learning-feedback/contract-and-seam-proposal.md
docs/architecture/learning-feedback/parallel-development-protocol.md
docs/roadmap/learning-feedback-core-entry-plan.md
docs/reviews/learning-feedback/lf-d1-readiness-2026-09-08.md
```

本轮相对原docs HEAD只新增后四份并更新本文件。禁止source/test/build/lock/workflows/Schema/operations/accepted ADR/.ai-local修改。根README、progress-status与主线review由#82/#83 owner处理，不抢写。

## 6. 开工的实质条件

E0：独立review接受最终docs HEAD的Contract/owner/边界。
E1：主线正式授权LF-C1与精确machine WRITE_SCOPE，scope checker实际可识别，不用文档路径规避。
E2：直接依赖的contracts/类型/日期/hash与门禁/回执/subject/架构缺陷有修复及独立证据。
E3：公共Schema/registry/lock/build/test/architecture接线指定单写者和集成形式。
E4：从最新protected-main重新绑定工具链/Schema/public entry/authority，证据适用于该HEAD。

详细依赖和验收在core-entry-plan，当前#85=NOT_RELEASED。不能把“主线正在修”写成“已修好”；也不要求C1等待所有未来Context、Knowledge或Learning功能。

## 7. 同步和验证规则

每轮启动、共享集成前、相关主线PR合并后和完成前重新读取watchlist。无关main变更不抹掉组件成果，但合并前仍要strict up-to-date；相关Contract/实现变更重做consumer回归；新HEAD不沿用旧独立verdict。

执行者完成实现时同步代码/测试/文档/Evidence，最多IMPLEMENTED。独立reviewer固定subject、只读验证并给verdict，发现问题返回新修复轮。普通文档同步不另拆专门写手。

每包结束局部对齐；接口版本、首次集成、闭环收口或进入Learning/Release时完整对齐。历史review不改写。没有后台调度工具时，检查发生于每轮恢复，不承诺持续后台监控。

## 8. 有意义的早期实验

C1先用明确标记的conformance fixture验证规则，不假装真实运行。I1/I2重点补旧C-1类未装配依赖、C-2类cache状态分裂的cold-start regression，真实query/snapshot消费是证明对象，不手工初始化全局或填cache。

GitHub review/CI/remediation资料可以形成工程案例，但不是Runtime NER；旧私有数据不上传。等受控执行与独立Gate就绪，再选一个可验证的小修复做LF-X1，不让待修模块修改自己的裁判规则。

## 9. 下一步与停止点

材料已准备，下一步由#85承接最终docs独立审查、主线共享接口/文件约定与正式开工授权。全部满足后才从对应main启动LF-C1，不重复规划整个框架，也不直接恢复旧F2/F3。

当前明确停止在代码开工Gate，而不是停在“还缺一份泛泛设计”。若Gate拒绝，按finding做最小文档修正；若相关main修复未合并，继续未受影响的案例准备，不另造基础设施绕过。
