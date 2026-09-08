# Learning & Feedback 分支建设计划与 CURRENT

状态：`DRAFT — DOCUMENT_REVIEW_PENDING / CODE_ENTRY_NOT_RELEASED`  
更新：2026-09-08  
最新核对主线：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`  
设计起点：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
跟踪：[文档 #81](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/81) · [PR #84](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84) · [开工 Gate #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85)

## 1. 唯一当前状态

| 维度 | 当前结论 |
| --- | --- |
| 设计材料 | LF-D0/D1 已形成草案；作者自检已修订，独立语义 review 待完成 |
| 当前动作 | 对最终 PR HEAD 请求只读独立审查；协调 #85 开工条件 |
| LF-C1 代码 | NOT_IMPLEMENTED / ENTRY_NOT_RELEASED |
| 生产 Feedback 集成 | NOT_IMPLEMENTED / WAITING_FOR_MAINLINE_CAPABILITY |
| Learning runtime | NOT_IMPLEMENTED |
| 并行主线 | #83 已合并，#82 的审查和修复计划已进入 main；不等于 R01–R16/WR01 已修复 |
| 下一代码任务 | #85 放行后，LF-C1 纯投影/关闭义务评价核心 |

旧本地 D1/F0/F1–F4/C-1 属于另一 subject，不继承到此仓库。Schema 存在不等于 Workflow/Context/Verification producer 存在。历史 review/readiness 文件保留其原始 SHA 的观察；后续状态由本文及 exact-head 证据更新，不改写历史结论。

## 2. 文档入口

- [架构入口](../architecture/06-learning-and-feedback.md)：定位与 canonical owners。
- [总体设计](../architecture/learning-feedback/branch-design.md)：模块、所有权、生命周期。
- [Contract 与接口提案](../architecture/learning-feedback/contract-and-seam-proposal.md)：可执行字段与结果规则。
- [并行建设协议](../architecture/learning-feedback/parallel-development-protocol.md)：单写者、同步、失效与重验。
- [LF-C1 开工包](learning-feedback-core-entry-plan.md)：文件清单、scope 请求、VerificationPlan。
- [LF-D1 初次准备自检](../reviews/learning-feedback/lf-d1-readiness-2026-09-08.md)及[原基线审查](../reviews/learning-feedback/github-baseline-review-2026-09-08.md)：历史证据和覆盖限制。

上位 Charter、accepted ADR、active Schema、机器 Authority 优先。所有候选接口/路径仍须 review 和正式授权，本文不修改 Phase 1 禁令。

## 3. 工作包

| 包 | 交付 | 前置/声明边界 |
| --- | --- | --- |
| LF-D0/D1 | 设计审查、Contract/seam、开工包 | 文档草案已准备；发布不等于批准 |
| LF-C1 | 两个纯用例、key/指纹比较、必要 Schema、conformance | #85 放行；只依赖 public contracts，不需完整 Runtime |
| LF-I1 | 正式 committed facts/query、显式装配、持久化/恢复 | 需要主线身份/assessment/query provider |
| LF-I2 | Context 贡献、快照及 Attempt 消费证明 | 需要主线 Context/Router/NodeExecution |
| LF-E1 | public entry 真实 Feedback 闭环及异常恢复 | I1/I2 + Verification/Gate；独立 exact-SHA 验证 |
| LF-L1 | 准入、归因、因果验证、Proposal/Gate、效果 | 正式 Phase 7 与对应能力门禁；不提前自动改框架 |
| LF-X1 | 受控真实修复实验 | Workspace/worker/WRITE_SCOPE/独立裁判就绪，固定裁判基线 |

LF 编号不是 P1-Oxx，也不覆盖正式阶段。CORE_CONFORMANCE 的 VERIFIED 不能升级为 Feedback V1 生产 VERIFIED。Feedback 改善当前纠偏，Learning 改善未来执行规则；项目知识由 KnowledgeProvider 负责。

## 4. 本轮主线同步记录

主线从 `3c387f5f...` 前进至 `5577c2e8...`，为 PR #83 的合并。核对其六个路径：README、两份 Phase 1 review/plan、progress-status、O09 review-plan execution/evidence；与 LF 八文档交集为空。

本次同步以最新主线 tree 为底，仅叠加八份 LF 文档，以旧 LF HEAD 和该 main SHA 为双父提交；不改主线六文件字节、不 force-push、不冒充已完成主线修复。远端提交及检查以 PR #84 的发布核对为准。

作者自检修正：

1. 现有 example-suite 要求每个 case 有 instancePath；补齐六份 Schema 各自 valid/invalid 实例的十二个实际文件路径。
2. 纯函数不能记忆上次调用；显式定义可选既有指纹比较，不靠 global/cache 或假称数据库幂等。
3. 明确来源 hash 排除本次评价时间、分配 ID、既有指纹等重放元数据；key/inputHash 不能由调用方任意声称。
4. 明确全局 input 校验在纯核心外用现有 ContractRegistry 完成；核心不调用文件型 registry loader，也不自行加载生产依赖。

这些是作者修正，不是独立 verdict。最终审查若发现问题，另起修订 HEAD 重验，不把旧 green check 沿用到新 subject。

## 5. 精确文档范围

本 PR 相对同步后的 main 只允许：

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

不修改源码、测试、构建、lock、CI、Schema、operations、accepted ADR 或 `.ai-local`。主线同步引入的原字节不是本分支原创修复，必须在 diff 中与 LF 变更分开说明。

## 6. 开工条件

E0：独立 reviewer 对最终文档 HEAD 接受 Contract/owner/边界；没有 finding 的自动摘要不等于完整验收。
E1：正式 LF-C1 operation/authority/精确 WRITE_SCOPE，实际 scope checker 支持；不能伪装为 P1-O02。
E2：依赖的 canonical JSON/生成类型/日期与门禁/回执/subject/架构缺陷有修复及独立证据；逐项对应 #82。
E3：Schema/registry/生成物/workspace/lock/build/test/architecture 的共享集成有单写者与形式约定。
E4：真实代码开工时从获准的 protected main 重新绑定工具链、Schema、public entry 与 authority。

这些证据统一收口在 #85。C1 不必等待未使用的完整 Runtime/知识库等未来能力，但不能绕开相关依赖与授权。合并 #83 只发布问题与计划，没有关闭 E2。

## 7. 执行和维护

每轮开始、相关主线 PR 合并、共享集成前和完成前读取 watchlist。无关 main 变化不否定全部成果；合并前仍需 up-to-date；相关语义变化重做 consumer 回归；新 HEAD 必须有新证据。

执行者完成操作时同步实现、测试、普通文档和证据，最多 IMPLEMENTED。独立 reviewer 只读被测 subject，不边审边修。每工作包局部对齐，接口变更/首次集成/闭环收口/进入 Learning 或 Release 前完整对齐。

## 8. 下一步

下一步是最终文档独立审查与 #85 主线承接，而不是再新建一套大计划。通过后按开工包实施 LF-C1；不通过则只修 finding。当前保留 CODE_ENTRY_NOT_RELEASED，不创建生产包、不恢复旧 F2/F3，也不将请求审查写成审查完成。
