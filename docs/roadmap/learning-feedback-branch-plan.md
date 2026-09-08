# Learning & Feedback 分支建设计划与 CURRENT

状态：`DRAFT — BLOCKED / INDEPENDENT_E0_RECORDED / CODE_ENTRY_NOT_RELEASED`  
更新：2026-09-08  
核对主线：`ed14d4179808621c8ffd5751ebbf7b6704f33b64`（观察基线；获准开工基线仍 NONE）  
设计起点：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
跟踪：[文档 #81](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/81) · [PR #84](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84) · [开工Gate #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85)

## 1. 唯一当前状态

| 维度 | 当前结论 |
| --- | --- |
| 文档 | 独立复核877eea8：LF-RV-01～04文档层PASS；完整E0因D01～D05未定义而BLOCKED，见下方Evidence |
| 当前动作 | 同步当前main与独立Evidence，收口#85 BLOCKED；单独#95/#97准备治理请求和范围诊断 |
| LF-C1代码 | NOT_IMPLEMENTED / ENTRY_NOT_RELEASED |
| 生产Feedback集成 | NOT_IMPLEMENTED / WAITING_FOR_MAINLINE_CAPABILITY |
| Learning runtime | NOT_IMPLEMENTED |
| 并行主线 | #86已合并为ed14d41；#87/#88仍未合并，相关修复仍需独立及protected-main Evidence |
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

## 5. 本轮真实进展与写范围

本轮恢复先核对main5577c2e、PR#84真实HEAD877eea8和#85，按PR HEAD读取未合并文档。独立审查完整八文档、主线职责/接口、suite实际入口和字节向量；不是作者自证。

[独立E0结论](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85#issuecomment-5578475306)绑定877eea857742a2458f2e5c42b3a7d9a261a5a28b/tree0c5b9be17f25e7ff63610c61f39f95e985ef32b9：四项LF-RV修订文档层PASS，D01～D05没有准确条目及来源映射，完整E0=UNPROVEN/BLOCKED。这些ID只被要求覆盖，不能由作者临时编号自然语言重点或删掉要求后自批。

核对期间#86合并为ed14d4179808621c8ffd5751ebbf7b6704f33b64。本分支以该main的原字节为底，叠加原八Markdown并普通双父同步，保留877eea8历史，不force。除CURRENT状态/Evidence外七文档语义未改；Contract/entry/protocol中的旧main是其冻结观察，最新协调状态以本文为准。新subject需要独立复核；旧subject结果不自动继承。

PR相对同步main仍为#81八文档：

```text
docs/architecture/06-learning-and-feedback.md
docs/architecture/learning-feedback/branch-design.md
docs/architecture/learning-feedback/contract-and-seam-proposal.md
docs/architecture/learning-feedback/parallel-development-protocol.md
docs/roadmap/learning-feedback-branch-plan.md
docs/roadmap/learning-feedback-core-entry-plan.md
docs/reviews/learning-feedback/github-baseline-review-2026-09-08.md
docs/reviews/learning-feedback/lf-d1-readiness-2026-09-08.md
```

另有独立主线治理准备[Issue#95](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/95)/[PR#97](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/97)，没有混入本八文档PR。其机器请求路径为 `operations/phase-1/evidence/o01/lf-c1-entry-request.json`，诊断为同目录 `lf-c1-entry-preflight.json`；正常P1-O01 execution为 `operations/phase-1/executions/p1-o01-lf-c1-entry-preparation.json`。材料在#97实际HEAD，不假定main已有；获准LF Authority仍不存在。

请求冻结54个逐文件路径和C1-V01～18，选择同一原子完整subject的LF-C1-INTEGRATION单写者方案，操作者/base尚无批准，窗口CLOSED；独立报告与治理锁写者分离。诊断脚本 `scripts/toolchain/check-lf-c1-scope-request.mjs` 仅校验请求与原文快照、重现现行拒绝，始终BLOCKED/exit2，不能替代正式dispatcher或发放开工。它复现LF-C1为UNKNOWN_OPERATION、P1-O02写learning为DENIED，未删P1禁令/改现行checker/Authority。

#97准备包原a4deb7e独立review发现依赖未合并PR Git object、干净clone不可复现，现已在原六文件scope内附原文hash快照并增加正常clone回归；新远端HEAD8826c450fdbad3de5decb882c42d6a0c86af480b需独立重新验证。这里记录修复处置，不将作者声明当独立PASS。

本轮实际可clone并运行本地工具；历史DNS失败记录仅属于旧轮次。所有命令结果分别绑定其实际HEAD，未运行的Windows/远端检查不写PASS；没有LF业务源码、Schema激活或生产集成。

## 6. 正式开工与下一动作

E0：BLOCKED。877eea8已有四项finding与owner/一致性独立文档结论；D01～D05准确定义/来源映射缺失，新subject须独立覆盖。
E1：BLOCKED。#95/#97只是六文件请求/诊断准备；合法LF-C1 operation/Authority/正常checker及suite owner/hash增量仍须实际批准。
E2：BLOCKED。R01/R02/R16对应#86已合并，需独立结论和ed14d41适用post-merge Evidence（run34182792727在核对时in_progress）；R06/R09/R10对应#87、R08对应#88仍未合并，不用PR绿替代。
E3：BLOCKED。共享单写者任务和精确集合已入机器请求，获准操作者/接受记录/main/window尚缺；窗口CLOSED。suite当前只归P1-O02，不能用#82接线权限代替LF批准。
E4：BLOCKED；approvedMain=null。ed14d41仅最新观察main，正式开工仍须获准SHA/tree/工具链/Schema/公有入口/Authority/适用Evidence全部重绑。

证据统一#85，未满足仍NOT_RELEASED。当前可以修文档并发起独立review，不能代替主线owner授权或虚构其依赖修复。不等所有无关未来Runtime，但相关scope和依赖不能绕过。取得新subject完整独立结论后，剩余动作是正式主线交界/授权，而非继续新增大设计。

执行者同步操作/测试/普通文档/Evidence，最多IMPLEMENTED；独立review只读不边审边改。接口变更/首次集成/收口做完整对齐，防止重演本次只修下层而遗漏上层。

本次最终回执按#85逐项BLOCKED发布，未关闭Issue、未合并LF文档或治理准备PR，未标LF-C1 READY。后续独立结论记录到#85并绑定确切subject，不以CURRENT改写历史review。
