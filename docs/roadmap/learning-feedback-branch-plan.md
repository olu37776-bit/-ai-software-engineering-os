# Learning & Feedback 分支建设计划与 CURRENT

状态：`DRAFT — REVIEW_FINDINGS_ADDRESSED_PENDING_REVIEW / CODE_ENTRY_NOT_RELEASED`  
更新：2026-09-08  
核对主线：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`  
设计起点：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
跟踪：[文档 #81](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/81) · [PR #84](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84) · [开工 Gate #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85)

## 1. 唯一当前状态

| 维度 | 当前结论 |
| --- | --- |
| 设计材料 | 两轮独立自动审查共四项P1；已针对性修订，待新subject完整复核 |
| 当前动作 | 收口单原子criterion调用基数并请求复核；核对#85真实授权与依赖证据 |
| LF-C1代码 | NOT_IMPLEMENTED / ENTRY_NOT_RELEASED |
| 生产Feedback集成 | NOT_IMPLEMENTED / WAITING_FOR_MAINLINE_CAPABILITY |
| Learning runtime | NOT_IMPLEMENTED |
| 并行主线 | #83已合并审查/计划；#82仍修复，未合并PR不作为依赖关闭证据 |
| 下一代码任务 | #85放行后，LF-C1单义务纯投影/关闭评价核心 |

旧本地D1/F0/F1–F4/C-1属另一subject，不继承。Schema不等于生产provider。历史review/readiness保留原SHA观察，当前状态只在本文及exact-head证据更新。

## 2. 文档入口

- [架构入口](../architecture/06-learning-and-feedback.md)：定位与owner。
- [总体设计](../architecture/learning-feedback/branch-design.md)：结构与生命周期。
- [Contract/接口提案](../architecture/learning-feedback/contract-and-seam-proposal.md)：单义务基数、LF-HN-1、两类幂等及结果。
- [并行协议](../architecture/learning-feedback/parallel-development-protocol.md)：单写者与基线重验。
- [LF-C1开工包](learning-feedback-core-entry-plan.md)：精确scope请求、18项验证和开工步骤。
- [初次准备自检](../reviews/learning-feedback/lf-d1-readiness-2026-09-08.md)及[原基线审查](../reviews/learning-feedback/github-baseline-review-2026-09-08.md)：历史证据/限制，不改写。

Charter/accepted ADR/active Schema/机器Authority优先，候选接口和文件清单不解除P1禁令。

## 3. 工作包

| 包 | 交付 | 前置/声明边界 |
| --- | --- | --- |
| LF-D0/D1 | 设计、Contract/seam、开工包 | 4个P1待最终subject复核，不以作者修订自证 |
| LF-C1 | 两个单义务纯用例、两类key/prior、必要Schema/conformance | #85放行，只依赖public contracts，不需要完整Runtime |
| LF-I1 | committed facts/query、正式装配、持久化/恢复 | 主线provider；两类key均需真实事务唯一性 |
| LF-I2 | Context贡献、快照/Attempt消费 | 主线Context/Router/NodeExecution |
| LF-E1 | public entry真实Feedback闭环与恢复 | I1/I2+Verification/Gate独立exact-SHA证据 |
| LF-L1 | 准入、归因、因果、Proposal/Gate、效果 | Phase7及对应能力，不提前自动改框架 |
| LF-X1 | 受控修复实验 | Workspace/worker/scope/独立裁判就绪，裁判基线固定 |

LF非P1-Oxx。CORE_CONFORMANCE VERIFIED非生产Feedback VERIFIED。本次收窄V1调用基数不改变总体反馈目标，不建设batch/调度器/第二Runtime；知识仍由KnowledgeProvider负责。

## 4. 主线同步与Finding Ledger

同步主线5577c2e为#83审查/计划合并，不是修复完成。主线六个文件与LF八文档不重叠，双父同步保留字节与历史，无force-push。本轮只在现有LF分支改三文档，不写主线共享代码；依赖以最新独立/合并Evidence判定。

| ID | 独立来源 | 文档处置 | 当前 |
| --- | --- | --- | --- |
| LF-RV-01 | [suite漏检](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3953795058)，08b701e | 原受检suite绑定十二case，补共享scope/统计/正常入口负例 | ADDRESSED_PENDING_REVIEW |
| LF-RV-02 | [哈希集合语义](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3953795060)，08b701e | LF-HN-1逐路径SET/SEQUENCE规则、重复/版本/字节向量 | ADDRESSED_PENDING_REVIEW |
| LF-RV-03 | [Resolution幂等](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3953795062)，08b701e | 独立resolutionKey/hash/prior与I1事务义务 | ADDRESSED_PENDING_REVIEW |
| LF-RV-04 | [多义务配单ID/prior](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3953843051)，39cdb4b | Contract§3.1/7.3收窄单原子criterion；两接口最多单候选；C1-V18覆盖交叉prior/基数/错关联 | ADDRESSED_PENDING_REVIEW |

39cdb4b自动审查完成且新增LF-RV-04；前三项没有再次提出不等于正式CLOSED。本次不由作者resolve线程，不标E0 PASS。单criterion可含多closure要求，但不得带另一个criterion/group；多条独立义务留外层逐次调用，不在C1新增批处理接口。

实际核对原examples.ts/qualify-contracts/example-suite.test/helpers及Schema；作者对ASCII哈希向量用Python标准库核算，结果与所列值一致，不宣称仓库canonical实现测试PASS。当前本地git ls-remote实际DNS失败，未运行repo build/E2E。远端quality/独立review以新HEAD分别记录，不继承旧green结论。

## 5. 实际WRITE_SCOPE

PR相对main仍为以下八Markdown：

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

本轮相对39cdb4b仅改Contract提案、core-entry-plan、CURRENT三份。其他历史文档未重写；没有源码/测试/Schema/suite/依赖/lock/build/CI/operations/ADR/.ai-local改动。C1-V18使用既定测试文件，不扩大候选源码清单。

## 6. 正式开工条件

E0：最终文档subject完整独立review，四P1处理及D01–D05/owner/边界有明确裁决。
E1：合法LF-C1 operation/authority/精确scope与checker，包含原受检suite的owner/hash接入；候选目录或评论不是批准。
E2：直接使用的#82 canonical JSON/类型/日期以及Gate/回执/subject/架构修复有适用的独立/合并证据。
E3：Schema/registry/type/suite/workspace/lock/build/test/architecture共享集成明确单写者和窗口。
E4：开工从获准main重新绑定工具链、Schema、public entry及Authority。

#85统一收口。不要求无关未来Runtime都完成，也不把“正在修复”“已发请求”写成放行。本分支可自行完成文档修订和发起复核；主线owner的授权/承接不能由作者虚构。

## 7. 执行维护与下一动作

每轮恢复、相关主线PR合并、共享集成前后核对watchlist，相关语义改变重验，新HEAD需新证据；并发推进停止覆盖，不force。实现时同步代码/测试/普通文档/Evidence，最多IMPLEMENTED；独立review只读、不边审边改。每包局部对齐、接口/首次集成/收口时完整对齐。

下一动作是复核LF-RV-04及前述三项，并完成#85正式scope与依赖证据。开工短提示词只指向仓库CURRENT、core-entry-plan和#85；若Gate仍未放行，它必须停止并说明缺少的具体证据，不能作为绕过Gate的直接编码令。
