# Learning & Feedback 分支建设计划

状态：`DRAFT — documents only; no implementation start authorization`  
日期：`2026-09-08`  
基线：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
跟踪：[Issue #81](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/81)  
架构入口：[Learning & Feedback](../architecture/06-learning-and-feedback.md)  
详细设计：[branch-design](../architecture/learning-feedback/branch-design.md)  
审查：[github-baseline-review](../reviews/learning-feedback/github-baseline-review-2026-09-08.md)

## 1. 当前准确位置

这是新 GitHub Framework 的计划，不继承旧本地 D1/F0/F1–F4/R1 的状态。用户报告的旧 C-1 验证通过仅是历史信息，不是新仓库的生产 Evidence。

当前 main 已合入 P1-O08 qualification release；P1-O09/Phase 1 integrated final gate 的完成记录本次未找到。生产 Node Runtime、Context、Verification、Learning 模块尚未落盘。Phase 1 的 `operation.json`/`write-scope.json` 明确禁止 production Learning/runtime 提前实现。

**可独立推进设计和边界验证准备；代码需要单独授权；主线集成不能伪造 provider。** 原 rebuild-roadmap 的 Phase 7 仍是 Learning V1 正式交付位置。下面的 LF 编号是支线工作包，不是对原 Phase 顺序或 Machine Gate 的替代。

## 2. 状态与授权分开

每个工作包分别记录：design status、implementation status、verification level/verdict、authorization、subject SHA、dependencies。一个 unit test PASS 不能同时把这些列都改成 VERIFIED。

实现 Agent 最多声明 IMPLEMENTED；独立 verifier 只对 exact SHA、明确 scope 和验证等级给 verdict。Runtime integration 未完成时，允许记录 CORE_CONFORMANCE 已验证，但 Feedback V1 仍 NOT_READY。文档方案通过审查不等于获准改代码。

## 3. 分阶段工作包

| 工作包 | 内容 | 可以独立到何种程度 | 入口与退出门禁 |
| --- | --- | --- | --- |
| LF-D0 | 本次新旧基线、文档审查、边界/代码落点设计 | 可立即做 docs-only | Draft PR + 精确 diff；独立文档 review 待完成 |
| LF-D1 | Feedback/Resolution semantic-gap、主线接口需求、Contract 差异和案例表 | 可独立起草；须 mainline owner 评审 | 无重复 owner；所有需求标明 existing/planned/missing；不激活 Schema |
| LF-C1 | 纯 Feedback projector、closure evaluator、version/idempotency 规则与 property/replay/conformance | **代码 scope 获准后**可先于完整 Runtime | frozen inputs/expected output；不做 I/O；只声明组件级验证 |
| LF-I1 | 正式事实查询、显式 wiring、派生记录 persistence/restart | 依赖主线 Kernel/persistence/identity/assessment producers | clean composition；无 globals/影子 YAML/cache；错误可见 |
| LF-I2 | Context contribution、目标关联、快照与实际消费证明 | 依赖主线 Context/Router/NodeExecution（路线目标 Phase 3） | source -> snapshot -> Attempt 真实 provenance；拒绝不计消费 |
| LF-E1 | 真实 Feedback closed loop | 依赖 I1/I2 及主线 Verification/Gate | public entry 完整闭环及主要失败/恢复路径；独立 exact-SHA 验证 |
| LF-L1 | 学习准入/案例、归因与因果实验、Proposal/Gate、效果评价 | 按 Phase 7 及前置能力逐项建设 | proposal-first；成功对照；变更治理和效果可证，不提前自动应用 |
| LF-X1 | 用真实隔离修复实验 Framework | 依赖受控 worker/workspace 和独立验证，不仅仅 LF-C1 | verifier 基线固定，裁判不可被待修任务修改，外部独立复核 |

LF-C1 的纯逻辑可以先准备、先验证；这不是自动获得 Phase 1 package 创建许可。若希望 Phase 7 前落盘，必须由主线正式接受提前建设的 scope/Contract/phase boundary，必要时进行 ADR 或计划 amendment。本文本身不是 amendment。

## 4. LF-D1 下一合法任务

在 LF-D0 独立 review 通过后，下一项建议只做 LF-D1，不修改源码：

1. 对照 active/planned inventory，确认 ExecutionFeedback、FeedbackResolution 是否真的需要独立 public/persisted Contract；优先引用现有身份、SubjectRef、SchemaRef、GateDecision，不复制 NodeResult。
2. 给出 Contract 候选字段、outcome 全映射、版本/缺失/权限/错误语义和 valid/invalid/boundary cases。Schema 实文件激活前取得 authority scope。
3. 逐项记录 mainline query、criterion assessment、Context provenance 接口的 owner、实际 public entry（若存在）、缺口与 gate。
4. 为 LF-C1 提交唯一、精确代码 WRITE_SCOPE 和 VerificationPlan；先判断当前治理是否允许，未批准保持 BLOCKED_BY_AUTHORITY。

计划文档固定落点：`docs/roadmap/learning-feedback-core-entry-plan.md`。接口/Contract 提案固定落点：`docs/architecture/learning-feedback/contract-and-seam-proposal.md`。这些文件当前尚未创建；创建须在下一 docs-only operation 中明确授权。不要让 Agent 自选第二个目录。

## 5. 本次 LF-D0 WRITE_SCOPE

本次只允许以下四文件：

```text
docs/architecture/06-learning-and-feedback.md
docs/architecture/learning-feedback/branch-design.md
docs/roadmap/learning-feedback-branch-plan.md
docs/reviews/learning-feedback/github-baseline-review-2026-09-08.md
```

禁止代码/测试/构建/工作流/依赖/Schema/authority lock/operation manifest/accepted ADR 变更。不写 `.ai-local/**`。根 README、docs/README、progress-status 属于现有 Phase 1 governed paths；其漂移在报告登记，不借此次设计任务扩大写范围。

现有 `scripts/toolchain/verify-scope.mjs` 对无 governed path 的文档变更有 `NON_OPERATION_GOVERNANCE` 模式。发布仍应由现有检查判定，不能改变 scope resolver 或通过改路径伪装生产代码。若检查失败，先记录原因；不得降低 Gate。

## 6. 后续 LF-C1 允许范围的提案

目标生产 owner 是 `packages/learning`，不是新建平行工程。未来 scope 至少需要核准 package/source/test、公有 Schema/registry/planned inventory/generated bindings、真实 workspace/tsconfig/test discovery integration，以及实施/验证记录。不能只写一个源码目录而漏掉真实构建接线。

这些当前均不在此次授权内，且部分受 Phase 1 显式禁令约束。执行前必须把具体文件、owner 和批准 operation 写入机器可检查的 scope；不能把“文档说可以独立”当作豁免。

## 7. 最小验收案例

| 案例 | 目的 | 可在哪层验证 |
| --- | --- | --- |
| 同一 snapshot 重复投影得到相同纠偏内容 | 确定性 | C1 |
| 相同 key 不同 payload 冲突 | 防伪幂等 | C1 + I1 并发/事务 |
| 缺 facts/错误版本/未 committed | 不编造正常结果 | C1 + I1 |
| C-1 型：bootstrap 未装配 facts dependency | 错误可见而非全部 unresolved | I1，不能手工补 global |
| C-2 型：写入反馈后新进程交付读到同一权威记录 | 无缓存状态分裂 | I1/I2，不能手工填 cache |
| 错 run、attempt、criterion version | 防错误消费/关闭 | C1 + I2/E1 |
| REWORK/BLOCK/INCONCLUSIVE/APPROVAL 等全 outcome | 语义不降级 | C1 + E1 |
| PASS_WITH_RISK_ACCEPTANCE | 不把风险接受当已修复 | C1 + E1 |
| Context 被拒/裁剪，或快照未实际使用 | 不错误记 consumed | I2/E1 |
| Claim fixed 但缺 closure assessment；或有反证 | 不错误 RESOLVED | C1 + E1 |
| crash/restart/重复投递/多条反馈多次修复 | 持久化与 lineage | I1/E1 |
| 默认禁用与 Policy 要求反馈两种模式 | 可选增强不等于无条件 fail open | I2/E1 |

旧缺陷摘要只提供案例意图；公开 fixture 应自行合成或经明确允许脱敏，不上传本地私有日志/代码。报告明确 synthetic、schema example、repository-governance fact、production-runtime fact 四类来源，不混用。

## 8. 主线交界协议

每次操作开始固定：main SHA/tree、authority refs/hashes、当前 package public entry、相关 schema id/version、依赖 capability、WRITE_SCOPE、独立 VerificationPlan。

主线变更相关 Contract、Context/query/worker lifecycle 或 Policy 时，先做 impact check。以同一输入及旧/新版本 conformance 判断是否兼容；不兼容通过正式版本/适配/迁移变更处理，不长期保留隐藏 legacy alias。新 HEAD 不能直接继承旧 verdict。

阻塞只阻塞相应 integration，不抹掉已验证纯核心成果。未满足 upstream provider 时保持明确 `WAITING_FOR_MAINLINE_CAPABILITY`，不是用测试替身把整个分支标为完成。

## 9. Dogfooding 的实际顺序

第一步可用当前 GitHub 的真实 review/CI/remediation 资料验证“案例选择与报告是否可用”，但这只是 repository 工程工作，不是 Runtime 自运行闭环。

第二步等主线真有受控任务执行、作用域 enforcement、完整 Evidence 和独立裁决，再安排一个明确失败 oracle 的小修复。旧 C-2 可作为备选场景，先评估其是否需要主线核心改动；需要修改 Kernel/Gate/verifier 时不得放入首轮自修实验。

第三步才在同一受治理机制内推进多个相关 finding。每个 subject 都独立验证，不能一次“修完所有旧问题”后凭完成声明冻结。LF-X1 和 Feedback V1 readiness 分开记，互不伪造前置条件。

## 10. 文档、Evidence 与停止点

实现任务必须同步代码、Contract、测试、状态、路径和证据，不能专门另开一个 Agent 才更新普通文档。独立 reviewer 不边审边修；其报告与计划可独立产出。

每个工作包结束做局部对齐；每次主线接口版本变化、首次 integration、E1 收口、进入 Learning/Release 前做整体对齐。审查报告绑定 immutable SHA，修正通过新报告/新证据，不改写历史 verdict。

后续实施/验证记录固定在经授权的 `docs/implementation/learning-feedback/` 与 `docs/reviews/learning-feedback/`；机器 operation 资产目录需先定义/批准，不借用 `operations/phase-1` 冒充 P1-Oxx。制品写既有 artifacts 输出，不提交二进制/private data。

下一步是：独立审查本 docs-only 提案，然后 LF-D1 Contract/接口提案与 LF-C1 开工授权。当前不创建业务代码、不恢复旧 Feedback VERIFIED、不开始完整 Learning。
