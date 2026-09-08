# LF-C1 决策登记与审查映射

状态：`DRAFT / DEFINITIONS_RESTORED / INDEPENDENT_ACCEPTANCE_PENDING`  
更新：2026-09-08  
观察 main：`ed14d4179808621c8ffd5751ebbf7b6704f33b64`  
本轮编辑前 subject：`7ead85be9c322057207fc0fef8fb0345aee1b39b`  
[CURRENT](../../roadmap/learning-feedback-branch-plan.md) · [精确业务 Contract](contract-and-seam-proposal.md) · [开工包](../../roadmap/learning-feedback-core-entry-plan.md) · [授权实施规划](../../roadmap/learning-feedback-authority-transition-plan.md)

## 1. 本文件的唯一责任

本文件是 D01～D05 的唯一登记、来源及验收索引，不再定义第二份业务字段、hash 算法或状态机。精确业务规则仍只在 Contract 提案；实现文件和 C1-V01～18 仍只在开工包。D01～D05 是本分支审查决策编号，不是已接受 ADR，也不与 LF-RV-01～04 finding 编号混用。

本轮修复的是文档缺失，不是删除五项审查要求以换取 PASS。定义存在、方案完整、独立接受、正式授权、运行验证是不同状态。当前只声明定义与来源已补齐，不声明 E0/E1 通过。

## 2. 可验证的历史来源

五个编号不是本轮临时推测。它们在 [08b701e0ca 的原 Contract §10](https://github.com/olu37776-bit/-ai-software-engineering-os/blob/08b701e0ca2f497eafaaa71329666d371c72cf6e/docs/architecture/learning-feedback/contract-and-seam-proposal.md#10-独立裁决与变更记录) 中已有下列正文；该文件 Git blob 为 `2869f19100bce8d61e463cef1a00246a2bc99617`：

| ID | 原条目原文 |
| --- | --- |
| D01 | 两项业务语义packages/learning拥有，六份必要边界Schema存contracts。 |
| D02 | 未知/缺依赖非普通UNRESOLVED，风险接受非已修复。 |
| D03 | 逐criterion裁决由Verification owner产生，LF只评价原义务覆盖。 |
| D04 | C1无I/O；validator loader在外层；幂等比较需要显式既有指纹。 |
| D05 | I阶段验证真实seam，C1 conformance不冒充provider。 |

后续 Contract 修订保留了“覆盖 D01～D05”的要求，却移除了可定位正文。这使 [7ead85b 的独立复核](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85#issuecomment-5578647644) 无法裁决完整 E0。本文件恢复原含义，并映射到已收敛的单 criterion、双指纹与正常 suite 方案；不改写原 BLOCKED 报告，也不把新定义追认成旧 subject 已通过。

下列上位来源按观察 main 固定读取：`docs/README.md`、`CONTRIBUTING.md`、`docs/decisions/README.md`、`docs/contracts/core-contract-catalog.md`、`docs/architecture/05-verification-and-evidence.md`、`docs/engineering/repository-blueprint.md`、`packages/contracts/src/index.ts`、既有 identity/ref/Gate/Evidence Schema、Phase 1 operation/write-scope/authority-lock。读取历史分支文件时必须使用上面的 exact commit，不能以 main 上同名文件替代。

<a id="d01"></a>
## 3. D01 — 单一业务 owner 与单一 Schema 来源

**决策定义。** ExecutionFeedback 与 FeedbackResolution 的业务规则由 `packages/learning` 唯一拥有；其六份必要 public/persisted 边界 Schema 存在 `packages/contracts` 并使用既有 registry、生成类型和公开校验入口。Schema 文件存放位置不转移业务裁决所有权。新增 owner 仍须正式批准，不能凭本登记提前激活。

**依据。** 原 D01；Contract §1/2/4/5/9；branch-design §4/5；Contract Catalog §4、§7、§8、§12、§14；Repository Blueprint 的 learning、contracts、node-runtime、evidence、platform 与 persistence 边界。

**不改变。** NodeExecutionRecord 仍由 node-runtime 提供；Evidence/EvidenceEdge、Router、ContextSnapshot、业务 GateDecision、Policy evaluator 和主线 terminal transition 不被复制。六份 Schema 是两个业务对象和四个立即有消费者的用例边界，不新增 LearningCase、batch manager、第二运行历史或未来 Phase 7 空包。

**独立审查通过条件。** reviewer 列出两个业务语义 owner 和六个 Schema 名称；核对没有第二份 public DTO 或新增主线状态权；确认标准 suite、类型生成、公开入口和消费者均在开工清单，且未假称已经实现。对应 C1-V01、V12、V17；关联 LF-RV-01、LF-RV-04。

**拒绝例。** 把 Feedback 当 RouteDecision；在 learning 新建 NodeResultRepository 复制主线状态；为了代码方便从其他 package 的 src/dist deep import；新 suite 不进入正常资格入口。

<a id="d02"></a>
## 4. D02 — 评价可用性、纠偏结果与风险处置分离

**决策定义。** 只有事实足以完成评价，才生成 EVALUATED 下的 RESOLVED/PARTIALLY_RESOLVED/UNRESOLVED；必要事实 UNKNOWN、依赖/权限缺失、非法输入或 wiring 错误必须保持相应 INCONCLUSIVE/BLOCKED/ERROR/INVALID_INPUT，不能伪装业务 UNRESOLVED 或成功。风险接受、豁免、取消与 criterion 实际满足分开。

**依据。** 原 D02；Contract §3/5/6；Verification 架构 §3/6 及其 Gate 定义；active `packages/contracts/schemas/verification/gate-decision.schema.json` 的七种 outcome；Contract Catalog §7；`CONTRIBUTING.md` 对隐藏失败和伪成功的禁止。

**独立审查通过条件。** 按七种 Gate outcome 逐一核对投影/关闭约束；给出事实不足、部分明确未满足、风险接受三种不同结果的例子；确认未知不被当 NOT_MET、非完整评价不追加 completed Resolution。对应 C1-V02～V07、V16。

**拒绝例。** 后续 Gate PASS 自动关闭全部反馈；将捕获异常后的空 facts 记为正常未解决；把 PASS_WITH_RISK_ACCEPTANCE 当作所有条件 MET；用模型“fixed”声明代替 Evidence。

<a id="d03"></a>
## 5. D03 — 上游裁决与本分支义务匹配分离

**决策定义。** criterion assessment、OracleAssessment、VerificationAssessment 和业务 Gate 由主线验证系统产生。LF 只对已有可信裁决与原反馈义务进行版本、覆盖、lineage 和关联匹配，不自行跑 Oracle、不将退出码/文本解释成权威业务 PASS、不选择下一 Node。

**依据。** 原 D03；Contract §3.1/3/5/6/8；Verification 架构 §2/4/5/6；Contract Catalog §4/5/7；ADR-0002、ADR-0003、ADR-0006 的既有方向。

**V1 边界。** 一次投影一个版本化原子 criterion；一次 Resolution 一个 feedback 和一个 consumer Attempt；同 criterion 可有多关闭要求和完整支撑/反证。原 sourceGate 保留完整真实汇总，不能裁剪后假装是独立 Gate。拒绝 group/batch 或跨 criterion 材料；不新增外层调度器。

**独立审查通过条件。** 清楚划分 source producer、外层可信读取、pure consumer；确认 criterion/group/Attempt 的限制在入口、总体设计、Contract 和开工包一致；确认 wrong run/attempt/version、无消费证明或选择性丢弃反证不得关闭。对应 C1-V02、V03、V06、V07、V18；关联 LF-RV-04。

<a id="d04"></a>
## 6. D04 — 纯核心与显式双指纹

**决策定义。** LF-C1 用例执行不读取文件、数据库、网络、环境变量、隐式时钟、随机 UUID 或 global/cache；Schema loader 的 I/O 在测试/外层，canonical/hash 能力复用公开 contracts。两个用例的既有记录都通过显式 prior 输入，分别使用 projection 与 Resolution 的稳定 key/hash/normalizationVersion，不共享身份、不假称纯函数已执行存储去重。

**依据。** 原 D04；Contract §3 的 validation 分界、§7.1～7.4；CONTRIBUTING 对全局 singleton、同一语义重复实现的禁止；公开 contracts 的 canonicalJson/canonicalJsonSha256/registry 入口。

**实施解释。** precise SET/SINGLETON/SEQUENCE、元数据排除、同 key 异 hash 冲突、新 observation 及旧 ID 复用以 Contract §7 为唯一规范，不在此复制算法。来源可信性、数据库唯一索引/事务和并发恢复属于 I1。实现者可以验证输入结构与语义，不能通过传入 committed=true 或 prior 来源声明建立权威。

**独立审查通过条件。** 检查两类 key 与 prior 均有规则；明确 HN 向量只是算法输入，不是生产来源；无隐式状态、重复 serializer、跨 criterion 共享 prior，或用未发布字段替换原身份。对应 C1-V08～V11、V13、V15、V16、V18；关联 LF-RV-02、LF-RV-03。

<a id="d05"></a>
## 7. D05 — 组件证明不替代真实集成或开工授权

**决策定义。** LF-C1 仅能证明 CORE_CONFORMANCE；正式事实查询、装配、持久化/恢复、ContextSnapshot 与 Attempt 实际使用、验证系统/Router/Gate 闭环必须分别由 LF-I1、LF-I2、LF-E1 验证。未使用的未来主线功能不作为 C1 前置；实际用到的 contracts/工具链/门禁不能绕过。GitHub Actions 是验证执行基础设施，不等于整个验证系统。

**依据。** 原 D05；Contract §8/9；branch-design 的验证分级；开工包 §2/6/7；并行协议；CONTRIBUTING §3/8；Phase 1 当前 globalDenied 和禁止 production Learning 的语义。

**独立审查通过条件。** 区分 Schema 存在、组件测试通过、provider 可用、生产 E2E、正式 Authority 放行；确认合成输入标识 CONFORMANCE_FIXTURE；明确 E0 文档批准不释放 E1～E4，18项验证不被误写成已经执行。对应 C1-V01、V12、V14、V17，及 I1/I2/E1 的后续门禁。

**拒绝例。** 用冷启动包装检查代替工作流 E2E；为等框架“全部完成”无限延后纯核心；用 P1-O02 身份绕过 learning 禁止规则；实施者把 IMPLEMENTED 改成 VERIFIED。

## 8. 统一覆盖矩阵

| 决策 | 规范位置 | 主要验收 | 相关独立 finding |
| --- | --- | --- | --- |
| D01 | Contract §1/2/4/5/9，branch-design §4/5 | V01/V12/V17 | LF-RV-01/04 |
| D02 | Contract §3/5/6 | V02～V07/V16 | 不确定性及关闭正确性 |
| D03 | Contract §3.1/5/6/8 | V02/V03/V06/V07/V18 | LF-RV-04 |
| D04 | Contract §3/7 | V08～V11/V13/V15/V16/V18 | LF-RV-02/03 |
| D05 | 开工包 §2/6/7，Contract §8/9 | V01/V12/V14/V17，后续 I/E | LF-RV-01及证明等级 |

本表中的 Vxx 均指开工包中现有 C1-Vxx，不生成第二套测试编号。一个测试可覆盖多个决策，不能因为已经覆盖四个 finding 就自动批准五个决策。

## 9. E0 最小独立回执

reviewer 须读取最终 exact HEAD 的全部现行 LF 设计/规划文档，对照实际 main 的 Charter/ADR/Schema/owner/scope，输出：repository、subjectCommit/tree、comparedMainCommit/tree、reviewer 与独立执行来源、只读检查和结束状态、D01～D05 五行裁决、LF-RV-01～04 四行裁决、实际路径/依据/残余限制、整体 E0 的 PASS/REJECTED/BLOCKED。

每行裁决需说明依据；只写“与之前一样”“没有新意见”“自动Completed”不够。文档中定义已恢复不等于 reviewer 已接受。由协调者转录结论时保留原执行来源、原结论和 subject，不冒充独立执行者。

E0 审查只批准设计可用性，不给源码写权。最终代码仍需 E1 Authority、E2直接依赖、E3接受记录、E4基线。报告可先记录在 #85，永久归档路径在获准的独立 Evidence 任务中使用，不把独立报告加入 LF-C1 的54个实施写路径。
