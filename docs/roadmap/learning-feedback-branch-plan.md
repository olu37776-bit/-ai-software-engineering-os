# Learning & Feedback 分支建设计划与 CURRENT

状态：`DRAFT — REVIEW_FINDINGS_ADDRESSED_PENDING_REVIEW / CODE_ENTRY_NOT_RELEASED`  
更新：2026-09-08  
核对主线：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`  
设计起点：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
跟踪：[文档 #81](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/81) · [PR #84](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84) · [开工Gate #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85)

## 1. 唯一当前状态

| 维度 | 当前结论 |
| --- | --- |
| 文档 | 四个根因finding已修订；LF-RV-04后续复核要求同步上层设计，本轮已改，待最终复核 |
| 当前动作 | 复核完整文档一致性及#85真实开工条件，不再局部修一份接口而遗漏概述 |
| LF-C1代码 | NOT_IMPLEMENTED / ENTRY_NOT_RELEASED |
| 生产Feedback集成 | NOT_IMPLEMENTED / WAITING_FOR_MAINLINE_CAPABILITY |
| Learning runtime | NOT_IMPLEMENTED |
| 并行主线 | #83已合并问题/计划；#82仍修复；未合并PR及旧绿色CI非依赖关闭证据 |
| 下一代码包 | #85放行后，LF-C1单义务纯投影/关闭评价 |

旧本地D1/F0/F1–F4/C-1不继承；Schema不等于provider。历史review/readiness保留原subject，动态状态在本文与exact-head Evidence。

## 2. 唯一职责分工和入口

- [架构入口](../architecture/06-learning-and-feedback.md)：整体定位与高层边界。
- [分支总体设计](../architecture/learning-feedback/branch-design.md)：owner、目录、生产集成责任。
- [Contract提案](../architecture/learning-feedback/contract-and-seam-proposal.md)：唯一精确字段/基数/key/hash/result定义。
- [并行协议](../architecture/learning-feedback/parallel-development-protocol.md)：单写者、watchlist与重验。
- [LF-C1开工包](learning-feedback-core-entry-plan.md)：唯一精确scope/18项验收及实施步骤。
- [初次自检](../reviews/learning-feedback/lf-d1-readiness-2026-09-08.md)与[原基线审查](../reviews/learning-feedback/github-baseline-review-2026-09-08.md)：历史观察，不提供现行写授权。

上位Charter/accepted ADR/active Schema/机器Authority优先。细化Contract同轮对齐所有现行概述，不在总体设计复制第二套key/字段规范。所有文档仍DRAFT，不解除P1禁令。

## 3. 工作包

| 包 | 交付 | 门禁/声明 |
| --- | --- | --- |
| LF-D0/D1 | 基线、总体设计、Contract/seam、开工包 | 文档修订待完整独立批准 |
| LF-C1 | 单义务两个纯用例、两类key/prior、必要Schema/conformance | #85放行；只依赖public contracts，不要求完整Runtime |
| LF-I1 | committed query、装配、持久化/恢复 | 主线provider及两类key事务唯一性 |
| LF-I2 | Context贡献/快照/Attempt使用 | 主线Context/Router/Execution |
| LF-E1 | public entry真实反馈闭环 | I1/I2+Verification/Gate独立exact-SHA证据 |
| LF-L1 | 准入、归因、因果、Proposal/Gate、效果 | Phase7及其能力门禁 |
| LF-X1 | 受控真实修复实验 | workspace/worker/scope/独立裁判，固定裁判基线 |

LF不是P1-Oxx；CORE_CONFORMANCE VERIFIED不是生产Feedback VERIFIED。V1单原子criterion，不支持任何组合group/batch；同义务多关闭要求不等于多反馈。未来外层分别调用独立义务，C1不新建调度或批量事务。

## 4. Finding与本轮一致性修订

| ID | 独立来源 | 处置 | 状态 |
| --- | --- | --- | --- |
| LF-RV-01 | [suite漏检](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3953795058)，08b701e | 原受检suite绑定十二case，补共享scope/统计与正常资格负例 | ADDRESSED_PENDING_REVIEW |
| LF-RV-02 | [hash集合规则](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3953795060)，08b701e | LF-HN-1逐路径规则、重复/版本/字节向量 | ADDRESSED_PENDING_REVIEW |
| LF-RV-03 | [Resolution幂等](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3953795062)，08b701e | 独立key/hash/prior及I1事务责任 | ADDRESSED_PENDING_REVIEW |
| LF-RV-04 | [多义务配单ID/prior](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3953843051)，39cdb4b；[上层设计残留组合许可](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3953887596)，d3138f1 | Contract/core-entry先收窄单criterion，本轮同步06/branch-design并删除V1组合许可及group key材料；C1-V18 | ADDRESSED_PENDING_REVIEW |

后续线程是LF-RV-04仍未完整关闭的证据，不能因为只修过局部接口就标CLOSED，也不把它重复计为不同根因。作者未resolve线程、不自证E0 PASS。

本次重点修复流程遗漏：原branch-design§6.2/7残留组合criteria许可，已同步§1/6.2/7；06入口同步单义务。现行详细技术定义集中到Contract，概述只链接，以降低未来文档漂移。原基线及初次readiness为历史SHA记录，不改写旧结论。

## 5. 主线与实际写范围

main5577c2e是#83审查/计划合并，不是#82修复完成。双方已有六主线文件与八LF文档不重叠；双父同步保留历史/字节，不force。每次恢复和发布重新核对main与相关PR，未合并修复不当E2证据。

PR相对main仍仅八Markdown：

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

这次相对d3138f1只改06、branch-design、CURRENT；不改Contract或开工包规则，不新增代码/测试候选文件。没有实际源码、测试、Schema、suite、依赖、lock、build、CI、operations、ADR或.ai-local修改。

作者用Python标准库核算过ASCII字节哈希，不是仓库库实现验证；本地git DNS实际失败，未执行repo build/E2E。远端checks与独立review分别绑定新HEAD，旧结果不继承。

## 6. 正式开工与下一动作

E0：最终subject四项finding及D01–D05/owner/完整文档一致性的明确独立结论。
E1：合法LF-C1 operation/authority/精确scope/checker，包括受检suite owner/hash授权。
E2：实际依赖的#82 canonical JSON/类型/日期、Gate/receipt/subject和架构修复有独立/合并证据。
E3：共享Schema/registry/type/suite/workspace/lock/build/test/architecture集成明确单写者/窗口。
E4：开工从获准main重新绑定工具链、Schema、公有入口、Authority与适用Evidence。

证据统一#85，未满足仍NOT_RELEASED。当前可以修文档并发起独立review，不能代替主线owner授权或虚构其依赖修复。不等所有无关未来Runtime，但相关scope和依赖不能绕过。取得新subject完整独立结论后，剩余动作是正式主线交界/授权，而非继续新增大设计。

执行者同步操作/测试/普通文档/Evidence，最多IMPLEMENTED；独立review只读不边审边改。接口变更/首次集成/收口做完整对齐，防止重演本次只修下层而遗漏上层。
