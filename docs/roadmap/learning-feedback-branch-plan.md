# Learning & Feedback 分支建设计划与 CURRENT

状态：`DRAFT — REVIEW_FINDINGS_ADDRESSED_PENDING_REVIEW / CODE_ENTRY_NOT_RELEASED`  
更新：2026-09-08  
核对主线：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`  
设计起点：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
跟踪：[文档 #81](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/81) · [PR #84](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84) · [开工 Gate #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85)

## 1. 唯一当前状态

| 维度 | 当前结论 |
| --- | --- |
| 设计材料 | LF-D0/D1 已形成草案；独立审查返回三个 P1，已修正文档，尚未复核通过 |
| 当前动作 | 对新 HEAD 请求三个 finding 和整体边界的只读独立复核；协调 #85 |
| LF-C1 代码 | NOT_IMPLEMENTED / ENTRY_NOT_RELEASED |
| 生产 Feedback 集成 | NOT_IMPLEMENTED / WAITING_FOR_MAINLINE_CAPABILITY |
| Learning runtime | NOT_IMPLEMENTED |
| 并行主线 | #83已合并审查/计划；#82修复仍进行；#86未合并不作为依赖关闭证据 |
| 下一代码任务 | #85放行后，LF-C1纯投影/关闭义务评价核心 |

旧本地 D1/F0/F1–F4/C-1 属于另一 subject，不继承到新仓库。Schema 存在不等于生产 Workflow/Context/Verification provider 已存在。历史 review/readiness 保留各自原 SHA 的观察，本文件记录后续状态，不改写历史 verdict。

## 2. 文档入口

- [架构入口](../architecture/06-learning-and-feedback.md)：定位与 canonical owners。
- [总体设计](../architecture/learning-feedback/branch-design.md)：模块、所有权、生命周期。
- [Contract 与接口提案](../architecture/learning-feedback/contract-and-seam-proposal.md)：字段、LF-HN-1规范化、两类幂等及结果规则。
- [并行建设协议](../architecture/learning-feedback/parallel-development-protocol.md)：单写者、同步、失效与重验。
- [LF-C1 开工包](learning-feedback-core-entry-plan.md)：源码/Schema/标准suite/构建scope请求与17项验证义务。
- [初次准备自检](../reviews/learning-feedback/lf-d1-readiness-2026-09-08.md)及[原基线审查](../reviews/learning-feedback/github-baseline-review-2026-09-08.md)：历史证据和覆盖限制。

Charter、accepted ADR、active Schema、机器 Authority 优先。候选接口和文件清单仍须独立 review/正式授权，不覆盖 Phase 1 禁令。

## 3. 工作包与声明边界

| 包 | 交付 | 前置 |
| --- | --- | --- |
| LF-D0/D1 | 总体设计、Contract/seam、开工包 | 原审查三个P1已作作者修订；等待新subject复核 |
| LF-C1 | 两个纯用例、两类key/prior、必要Schema、conformance | #85放行；只依赖public contracts，不需完整Runtime |
| LF-I1 | committed facts/query、正式装配、持久化/恢复 | 主线身份/assessment/query provider；两类key均需事务唯一性 |
| LF-I2 | Context贡献、快照与Attempt消费证明 | 主线Context/Router/NodeExecution |
| LF-E1 | public entry真实Feedback闭环及异常恢复 | I1/I2 + Verification/Gate；exact-SHA独立验证 |
| LF-L1 | 准入、归因、因果、Proposal/Gate、效果 | Phase 7及对应能力门禁；不提前自动改框架 |
| LF-X1 | 真实受控修复实验 | Workspace/worker/scope/独立裁判就绪，固定裁判基线 |

LF编号不是P1-Oxx。CORE_CONFORMANCE VERIFIED不等于Feedback V1生产VERIFIED。Feedback改善当前纠偏，Learning改善未来执行规则，项目知识由KnowledgeProvider负责。

## 4. 主线同步与审查处置

主线由3c387f5f前进到5577c2e，是#83审查/计划合并。其六个主线路径与LF八文档交集为空；上一双父同步保留主线原字节和双方历史，没有force-push。本次再次读取main仍为5577c2e。主线#86当前提供R01/R02/R14/R16修复提案，未合并/未完成其独立证据，不将其作为E2 PASS。

独立review针对08b701e0ca2f497eafaaa71329666d371c72cf6e，2026-09-08 02:24Z返回：

| ID | 发现与依据 | 本次处置 | 状态 |
| --- | --- | --- | --- |
| LF-RV-01 | [标准资格漏掉新suite](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3953795058)；examples.ts硬编码first-slice | 不另建suite；十二case追加原受检suite，补共享scope、统计测试与正常入口负例 | ADDRESSED_PENDING_REVIEW |
| LF-RV-02 | [hash集合/序列未冻结](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3953795060) | Contract§7.2逐路径SET/SEQUENCE表、排序与重复规则、版本策略及字节向量 | ADDRESSED_PENDING_REVIEW |
| LF-RV-03 | [Resolution缺幂等身份](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3953795062) | 独立resolutionKey/inputHash/prior、重放/冲突规则、I1事务义务 | ADDRESSED_PENDING_REVIEW |

此次实际复核了examples.ts、qualify-contracts.mjs、example-suite.test.mjs、helpers.mjs。发现原suite统计38/19/19/22，故同步补齐这一受影响共享测试的候选scope，不能只修一个路径后遗留确定失败。

作者本地仅对ASCII字节向量用Python标准库计算SHA256并检查集合重排相等/序列反转不同/重复身份拒绝；这不是仓库canonical实现或LF-C1测试通过。当前执行环境git ls-remote仍因DNS失败；没有运行仓库build/E2E。远端机器检查和独立review状态在PR绑定新HEAD分别记录，旧green结果不复用。

## 5. 精确本轮写范围

本PR相对main仅允许原八Markdown：

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

这次相对上一HEAD只改Contract提案、core-entry-plan和本CURRENT三文件。不修改历史review、源码、测试、Schema、suite实例、依赖、lock、build、CI、operations、accepted ADR或.ai-local。开工包新列的源码/共享suite/测试是待授权清单，不是本轮实际改动。

## 6. 开工条件

E0：最终HEAD独立接受Contract/owner/边界，三个P1必须复核关闭；不是作者声称已修就PASS。
E1：合法LF-C1 operation/authority/精确scope和可执行checker；包含受检first-slice suite及其锁定owner的正式接入。
E2：相关#82 canonical JSON/类型/日期及Gate/回执/subject/架构问题有独立修复/合并证据。
E3：Schema/registry/type/受检suite/workspace/lock/build/test/architecture共享集成明确单写者与窗口。
E4：实际开工从获准protected-main重新绑定工具链、Schema、public entry和Authority。

统一在#85收口，不等待未使用的未来Runtime功能，也不绕过实际依赖。上述schema、normalization、幂等修订仅改变本分支待审设计，不赋予修改共享基础权限。

## 7. 执行维护与下一动作

每次恢复、主线相关PR合并、共享集成前与发布前重新读watchlist；无关改动不抹掉成果，相关语义变化需consumer回归，新HEAD必须新证据。发生并发branch推进先停写重读，不force覆盖。

实现者做操作时同步普通文档、测试和Evidence，最多IMPLEMENTED；独立verifier只读subject，不边审边修。每包局部对齐，接口变更/首次集成/闭环收口/进入Learning或Release时整体对齐。

下一步：新HEAD对LF-RV-01/02/03复核并完成E0覆盖，同时保留E1/E2/E3/E4真实阻塞。当前没有代码实现，不合并main、不开始旧F2/F3或完整Learning，不为凑进度再创建一套大计划。
