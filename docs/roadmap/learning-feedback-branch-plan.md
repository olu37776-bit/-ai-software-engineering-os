# Learning & Feedback 建设计划与 CURRENT

状态：`DRAFT / DOCUMENT_AND_GOVERNANCE_PLANNING_COMPLETE_PENDING_REVIEW / CODE_ENTRY_BLOCKED`  
更新：2026-09-08  
最终同步 main：`eeb65baf9b0446a4b747eefdc7b7f8c1f965ea94`，tree `40cb6c1ad758ae8b3b18ce89ada3bb8b04f08a45`  
本轮初始观察：`ed14d4179808621c8ffd5751ebbf7b6704f33b64`  
编辑前LF HEAD：`7ead85be9c322057207fc0fef8fb0345aee1b39b`  
跟踪：[文档#81](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/81) · [PR#84](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84) · [开工#85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85)

## 1. 当前结论

| 维度 | 状态与依据 |
| --- | --- |
| 文档/设计规划 | D01～D05原定义、来源、验收已补齐；E1～E4的实现路径和记录设计完整；作者声明PREPARED，不是独立批准 |
| E0 | 7ead85b已有LF-RV-01～04文档层独立PASS，完整E0因D01～D05缺失BLOCKED；新subject补齐后待独立接受 |
| E1 | 正常checker、四Authority、先验Gate的G0～G3已具体设计；实际代码/授权未完成 |
| E2 | #86的ed14d41合并后检查成功；发布期间#87已合并为eeb65baf；#88仍未合并。均须按依赖接受规则核对独立/最终base适用性，不以合并代替关闭 |
| E3 | ONE_ATOMIC_COMPLETE_SUBJECT / LF-C1-INTEGRATION方案固定；真实认领及RESERVED接受尚未完成；窗口CLOSED |
| E4 | approvedMain=NONE；上述SHA只是观察与同步base，没有发行正式开工回执 |
| LF-C1 / 生产Feedback / Learning | 均未实现，无运行VERIFIED声明 |

除CURRENT外，各计划/设计顶部的观察SHA和其进度表是明确时点的设计输入，不作为动态进度。授权规划§7保留ed14d41时#87尚未合并的观察；本节与§6记录随后的eeb65baf变化，不改写历史Evidence。旧本地F1～F4/C-1不继承；Schema不等于provider。

## 2. 唯一职责分工与入口

| 文件 | 唯一负责的内容 |
| --- | --- |
| [架构入口](../architecture/06-learning-and-feedback.md) | Feedback/Learning/知识边界与高层导航 |
| [总体设计](../architecture/learning-feedback/branch-design.md) | 模块owner、目录、生产集成职责 |
| [精确Contract](../architecture/learning-feedback/contract-and-seam-proposal.md) | 单criterion、字段、result、两类key/hash/prior与LF-HN-1；本轮保持字节 |
| [决策登记](../architecture/learning-feedback/decision-register.md) | D01～D05唯一完整定义、原始来源、通过/拒绝例与验收映射 |
| [业务开工包](learning-feedback-core-entry-plan.md) | 54业务路径、C1-V01～18及实施步骤 |
| [并行协议](../architecture/learning-feedback/parallel-development-protocol.md) | 写者认领、共享范围、RESERVED/OPEN、冲突及对齐 |
| [授权/checker实施规划](learning-feedback-authority-transition-plan.md) | 默认关闭的正式checker、四Authority、G0～G3、控制面验证、E2证据、E4发布及回滚 |
| [原基线review](../reviews/learning-feedback/github-baseline-review-2026-09-08.md)、[初次readiness](../reviews/learning-feedback/lf-d1-readiness-2026-09-08.md) | 历史观察，不是现行许可 |

Charter/accepted ADR/active Schema/机器Authority优先。决策登记是审查索引，不是第二业务规范；授权规划是待批准决定，不是机器Authority。业务规则只在Contract，规划不复制或改变其精确字段/hash。

## 3. 本轮补齐什么

D01～D05在历史08b701e的Contract§10原有定义（blob2869f19100bce8d61e463cef1a00246a2bc99617）；后续修订只保留编号，导致审查无法定位。decision-register恢复原条目并映射现行规则、主线来源和C1验证，未临时猜编号、未删除审查要求换PASS。

E1不再只写“让主线建立授权”：规划选定正常dispatcher精确LF-C1分支、缺先验Gate默认关闭，列G1候选11文件、G2安装9文件、G3独立Evidence4文件、四Authority字段和14组控制面正反例。它们必须单独授权，不能混入54业务路径。

E3固定一个完整subject，54路径由LF-C1-INTEGRATION写，获准lock派生hash由独立治理任务写。E3可以接受RESERVED，E0/E1/E2/E4齐全才OPEN；不形成“先开工才能获准开工”的循环。

E4规定候选M0→Gate-only发布→landing M1→外部回执approvedMain=M1，避免把M1写入产生M1的文件。实际operator、审批编号、合并后的SHA不能预编；需要真实接受动作的值不是未完成的设计。

## 4. 独立Evidence与业务边界保持

[7ead85b独立复核](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85#issuecomment-5578647644)为四finding文档层PASS、五决策UNPROVEN、完整E0 BLOCKED；[877eea8原报告](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85#issuecomment-5578475306)保持历史。这些结果不能自动批准本轮新subject。

| finding | 保持的规范/测试 |
| --- | --- |
| LF-RV-01 | 原受检suite、十二固定case、54范围及正常资格负例；Contract§9、V01/V17 |
| LF-RV-02 | SET/SINGLETON/SEQUENCE及字节向量；Contract§7.1/7.2、V10 |
| LF-RV-03 | 独立Resolution key/hash/prior、append-only及I1事务；Contract§5/7.4、V15/V16 |
| LF-RV-04 | 所有现行层均单criterion/单结果，无group/batch；Contract§3.1/7.3、V18 |

本轮没有改精确Contract、06入口、总体设计或两个历史报告。不自resolve线程、不自标E0 PASS。完整新subject须独立覆盖D01～D05、LF-RV-01～04和新增控制面规划。

## 5. 写范围与机器请求保持

用户本轮要求全部文档/规划收口，范围已登记#81。本轮原创仅3份现有文档更新（CURRENT、core-entry、parallel）+2份新文档（decision-register、authority-transition-plan）；PR相对最终main为10份Markdown。

LF-C1业务路径仍18 core+26 contracts+6 wiring+4实施文档=54；C1-V01～18保留原要求。作者用Python对准备材料的精确路径清单与已读#97请求比对，54项唯一且集合相等，无治理路径混入。这只是静态材料核对，不是执行正式scope checker。

#97请求HEAD8826c450fdbad3de5decb882c42d6a0c86af480b，路径 `operations/phase-1/evidence/o01/lf-c1-entry-request.json`，原source为877eea8开工包快照。本次开工包hash变化，G0须更新sourceCommit/tree/hash/snapshot并重验；不能以“路径没变”冒充旧请求已绑定新设计。原准备包独立报告只对其旧subject有效。本PR不改#95/#97六文件。

## 6. 发布期间主线同步

初始读取main=ed14d41。重新查询run34182792727：required-packaging101925088786、Linux101925089055、Windows101925089328、toolchain汇总101927737664、verify101927758216均completed/success。这个事实更新原in_progress观察，但不代替独立逐finding关闭。

提交前main前进到eeb65baf9b0446a4b747eefdc7b7f8c1f965ea94，为#87的合并；父为ed14d41和6e1a98b6979ab4f3a761438658256f9fab6184a5。已核对#87的8个变更路径：P1-O02实施文档、execution/evidence、canonical-json、json-schema、generated types、type-model和Contract回归测试；与本PR10份LF文档无交集。

本次以eeb65baf原tree为底，只叠加LF文档，并以旧LF HEAD与新main为双父普通追加，保留主线#87修复原字节，不force/rebase、不把它记作LF原创修复。新main的相关校验实现变化意味着E2需要新的适用性检查，不使用ed14d41检查替eeb65baf盖章。#88仍需独立及合并证据。

本会话git ls-remote实际DNS失败，未运行repo build/Windows/E2E；不同执行环境之前可clone不等于本会话可clone。读取和发布通过GitHub connector。作者静态核对、远端机器检查、独立语义review分别记录。

## 7. 后续任务已可按文档执行

| 工作包 | 内容 | 门禁 |
| --- | --- | --- |
| LF-D0/D1 | 总体设计、Contract、决策登记、业务开工/治理规划 | 准备完成，最终HEAD独立review待接受 |
| G0～G3 | 请求刷新→默认关闭checker→先验授权安装→Evidence/Start Gate | 按授权规划分任务实际实施；不得继承#82/#95权限 |
| LF-C1 | 单义务两个纯用例、双指纹、必要Schema/conformance | #85正式放行后实施54路径与18验证 |
| LF-I1/I2/E1 | 真正facts/query/persistence/Context/工作流闭环 | 对应provider和独立运行Evidence |
| LF-L1/LF-X1 | 后续学习/真实修复实验 | 既定Phase/能力与独立裁判，不提前自修改 |

下一执行者读取D定义完成最终E0，再按授权规划推进获准G任务，取得E2/E3/E4真实证据。无需重新猜目录、定义D编号或再设计一套授权系统。缺批准/认领/合并/运行Evidence时应列具体缺项，不再归因为“设计没给”。

普通文档更新属于操作；实施最多IMPLEMENTED，VERIFIED由独立只读验证给出。#85仍是唯一正式开工回执入口：当前approvedMain=NONE、窗口CLOSED，PR84未合并、LF业务未开工。
