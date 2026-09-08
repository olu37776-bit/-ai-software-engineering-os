# LF-C1：独立纯核心建设开工包

状态：`DRAFT / PLANNING_COMPLETE_PENDING_REVIEW / ENTRY_NOT_RELEASED`  
更新：2026-09-08  
观察 main：`ed14d4179808621c8ffd5751ebbf7b6704f33b64`，不是获准开工基线  
编辑前 LF subject：`7ead85be9c322057207fc0fef8fb0345aee1b39b`  
[CURRENT](learning-feedback-branch-plan.md) · [Contract](../architecture/learning-feedback/contract-and-seam-proposal.md) · [D01～D05定义](../architecture/learning-feedback/decision-register.md) · [并行协议](../architecture/learning-feedback/parallel-development-protocol.md) · [授权/checker实施规划](learning-feedback-authority-transition-plan.md)

> 本包只定义 LF-C1 业务实施范围和18项验收。正式控制面接线与授权步骤由上方专门规划定义，不得混入本包业务路径。当前仍无获准 base、未创建业务源码/Schema、未签发 Start Gate。

## 1. 第一包：单原子义务的纯核心

只实现 Feedback 投影、历史纠偏义务关闭评价两个纯用例，包括必要 Schema/生成类型、两类 key/prior、消费视图规范化及 conformance/property/replay。唯一 public entry 为 @aseos/learning，只依赖 public contracts。

每次投影一个原子 criterion，至多一个候选；每次 Resolution 一个 feedback、一个 consumer Attempt，至多一条评价。criterionRefs 恰一项，同一 criterion 可有多个关闭要求。V1拒绝组合group/batch，不新增manager、调度或批量事务。详细字段、result、规范化和幂等只由 [Contract](../architecture/learning-feedback/contract-and-seam-proposal.md) §3.1/§7 定义，本包不复制一套规则。

不做数据库/网络/文件/Context/Agent调用，不接Runtime，不建Repository/cache/global/生产Adapter，不做Router/NER/LearningCase/Proposal/dogfooding。外层用现有ContractRegistry验证Schema，核心不调用文件loader。

## 2. E0～E4门禁：设计材料与实际批准分开

| Gate | 明确验收依据 | 当前意义 |
| --- | --- | --- |
| E0 | [决策登记](../architecture/learning-feedback/decision-register.md)的D01～D05五行及LF-RV-01～04四行，最终HEAD完整独立结论 | 定义已恢复；新subject待独立接受，不沿用7ead85b的局部PASS |
| E1 | [授权规划](learning-feedback-authority-transition-plan.md)§3～6：合法operation、四Authority、正常checker及先验Gate | 规划已具体化；实际实施和授权尚未完成 |
| E2 | 授权规划§7：R01/R02/R16、R06/R09/R10、R08的实现/独立/merge/post-merge及基线适用性 | 逐项接受，不等待无关未来Runtime |
| E3 | [并行协议](../architecture/learning-feedback/parallel-development-protocol.md)：单写者、54集合、治理刷新和有效RESERVED接受记录 | 方案固定；实际操作者和窗口接受待批准 |
| E4 | 授权规划§8：获准main及文档/工具链/Contract/Authority/Evidence完整绑定 | 观察main不是approvedMain；签发须真实landing检查 |

直接依赖为R06 canonical/hash、R09生成类型、R10日期、R08架构、R01/R02/R16 Gate/回执/subject。不在LF复制validator/serializer或降低门禁。C1不要求完整Kernel、Context、验证系统、Persistence业务provider完成；I1/I2/E1运行集成届时按真实依赖验收。

## 3. 已选定的授权与集成方式

采用正常dispatcher中的精确LF-C1分支，缺先验授权默认关闭，业务单写者任务为LF-C1-INTEGRATION，在一个完整subject中提交真实consumer与Schema/实例/接线。不得伪装P1-O02、删除P1禁令或以单独诊断exit2替代正式checker。

原受检suite及planned/inventory/registry的共享锁委托必须预先批准；LF实施者不写旧Authority lock。MAINLINE_GOVERNANCE只对被批准、实际变化的四个OPERATION_SCOPED条目做派生hash刷新，并由正常检查验证作者分区、原owners和所有无关字段未变。这个控制面变更属于授权规划的单独治理任务，不是扩大下面54条源码权限。

#95/#97机器请求仍是REQUEST_NOT_AUTHORITY。请求原快照来自877eea8；本包更新后由G0刷新source的commit/tree/hash/snapshot，逐项证明54路径和18要求没有变成更多权限。不能用旧hash证明新文档已绑定。

## 4. 精确源码和测试清单提案

下列三块分别为18 core、26 contracts、6 wiring，共50个路径；另4个实施文档列于本节末尾，合计54。它们是待授权文件集合，不代表每次必须修改所有既有文件。新必需产物须完整，已有文件可在不需要时保持不变。没有通配符，不包含治理脚本、Authority、独立报告或新规划文档。

```text
packages/learning/package.json
packages/learning/tsconfig.json
packages/learning/src/index.ts
packages/learning/src/feedback/domain/feedback-rules.ts
packages/learning/src/feedback/application/project-feedback.ts
packages/learning/src/feedback/application/evaluate-feedback-resolution.ts
packages/learning/src/feedback/application/normalize-feedback-semantic-input.ts
packages/learning/src/feedback/application/derive-feedback-key.ts
packages/learning/src/feedback/application/derive-resolution-key.ts
packages/learning/test/project-feedback.test.mjs
packages/learning/test/evaluate-feedback-resolution.test.mjs
packages/learning/test/feedback-replay.test.mjs
packages/learning/test/feedback-input-validation.test.mjs
packages/learning/test/feedback-idempotency.test.mjs
packages/learning/test/feedback-normalization.test.mjs
packages/learning/test/resolution-idempotency.test.mjs
tests/contract/learning-feedback/feedback-conformance.test.mjs
tests/architecture/learning-feedback-boundaries.test.mjs
```

两类key共用唯一normalizer，不复制JSON serializer。public/persisted类型由contracts生成，不手写平行DTO；不创建无实际I/O用例的ports/Repository。基数负例放已有测试，不新增batch文件。

### 共享Contract、标准受检suite与实例

```text
packages/contracts/schemas/learning/execution-feedback.schema.json
packages/contracts/schemas/learning/feedback-resolution.schema.json
packages/contracts/schemas/learning/feedback-projection-input.schema.json
packages/contracts/schemas/learning/feedback-projection-result.schema.json
packages/contracts/schemas/learning/feedback-resolution-input.schema.json
packages/contracts/schemas/learning/feedback-resolution-result.schema.json
packages/contracts/examples/first-slice/example-suite.json
packages/contracts/examples/learning/execution-feedback.valid.json
packages/contracts/examples/learning/execution-feedback.invalid.json
packages/contracts/examples/learning/feedback-resolution.valid.json
packages/contracts/examples/learning/feedback-resolution.invalid.json
packages/contracts/examples/learning/feedback-projection-input.valid.json
packages/contracts/examples/learning/feedback-projection-input.invalid.json
packages/contracts/examples/learning/feedback-projection-result.valid.json
packages/contracts/examples/learning/feedback-projection-result.invalid.json
packages/contracts/examples/learning/feedback-resolution-input.valid.json
packages/contracts/examples/learning/feedback-resolution-input.invalid.json
packages/contracts/examples/learning/feedback-resolution-result.valid.json
packages/contracts/examples/learning/feedback-resolution-result.invalid.json
packages/contracts/README.md
packages/contracts/planned-contracts.json
packages/contracts/schema-inventory.json
packages/contracts/schema-registry.json
packages/contracts/type-bindings.json
packages/contracts/src/types.generated.ts
tests/contract/example-suite.test.mjs
```

不创建learning/example-suite.json。十二固定caseId为lf-c1.<schema-stem>.<valid|invalid>，追加原first-slice受检suite；保留全部原case/expectation/semanticAssertions。不修改通用validator/runner绕过问题。

examples.ts固定读取原suite，contracts:qualify调用该入口。example-suite.test.mjs原统计38/19/19/22；基线不变且未加semanticAssertions，十二实例加入后应为50/25/25/22。开工时以实际新main冻结原案例清单，不能动态计算总数掩盖固定binding缺失。INVALID需expectedError(keyword/instancePath)。正常资格面对删实例、错路径、invalid改valid或错误预期必须失败，conformance需拒绝缺少十二固定case之一。

单criterion及结果基数约束同时进入Input/Result/持久化对象Schema和语义检查；同criterion多要求合法，跨criterion材料拒绝。Schema立即有consumer，不激活其余Phase7对象；registry/hash/type使用现有生成工具。

### 共享构建/架构

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.build.json
vitest.config.mjs
tests/architecture/architecture-policy.json
```

仅加入真实package的dependency/reference/test discovery、learning->contracts及必要根测试边，不加platform->learning。额外workflow/脚本或源码需先更新独立授权；实现者不能临时扩scope。新测试必须进入正常root test。

### 四条实施文档与独立Evidence

实施者同时维护以下4个精确文件：`docs/architecture/learning-feedback/contract-and-seam-proposal.md`、`docs/implementation/learning-feedback/lf-c1-implementation.md`、`docs/roadmap/learning-feedback-branch-plan.md`、`docs/roadmap/learning-feedback-core-entry-plan.md`。普通状态、实际映射与Evidence引用随操作更新，已批准业务语义改变须另行review。

独立报告固定 `docs/reviews/learning-feedback/lf-c1-independent-verification.md`，由独立Evidence任务写，不在54路径。decision-register、授权规划、并行协议和机器Authority对LF实施者只读。生成物不因“由工具生成”获得额外权限。

## 5. 业务实施步骤

1. 从#85取得有效E0～E4、Start Gate和实际approvedMain，核对正式Authority，而非只读Issue状态文字。
2. 在获准main上建立独立工作树/正式短分支；确认LF-C1-INTEGRATION和独立治理写者接受记录/窗口有效。
3. 同一集成任务落实六Schema、十二实例、原suite登记、生成类型、构建和consumer；不预建空壳。
4. 实现两个单义务用例、两类key/prior、唯一normalizer，不存历史、不加批量调度。
5. 运行本节验证与正常入口；按批准过程交治理任务完成必要lock刷新。对实际完整subject核对分区scope、Evidence、文档一致性。
6. 实施最多IMPLEMENTED；冻结HEAD交独立只读验证。发现缺陷另轮实施产生新subject，不在验证pass中改代码。

## 6. VerificationPlan

以下18项与上一开工包保持同一要求，不新增控制面测试编号。控制面G-Vxx在独立授权规划中，不计入C1实现范围。

| ID | 必须证明 |
| --- | --- |
| C1-V01 | 六Schema/十二实例在原suite登记；固定ID断言；标准资格对删文件/错路径/错误invalid/expectedError均失败，新旧正常案例均通过 |
| C1-V02 | 七Gate outcome完整，approval/terminal/risk/unknown不降级；汇总Gate不得代替选定criterion证据 |
| C1-V03 | criterion/Evidence缺失、冲突、错subject ->gap/typed拒绝，不推测rootCause |
| C1-V04 | 同一反馈义务全满足/部分明确不满足/均不满足 ->正确三种disposition |
| C1-V05 | 必要条件UNKNOWN、依赖不足、非法输入不冒充EVALUATED，不写completed Resolution |
| C1-V06 | 错run/attempt/criterion版本、无合法消费关系不关闭 |
| C1-V07 | 风险接受/Claim fixed/过期或反证不冒充MET；capturedTime仅报告，时间判定材料固定 |
| C1-V08 | 两用例固定材料/context重放一致；本次ID/time不改key/hash，不误删历史fingerprint |
| C1-V09 | 单义务Projection prior同key/hash/version复用旧ID；异hash冲突；无匹配prior只返回本义务单候选 |
| C1-V10 | LF-HN-1逐路径参数化：SET重排不变、SEQUENCE反转改变、SINGLETON基数错误拒绝、重复/未知/版本规则及HN字节向量通过public canonical API |
| C1-V11 | 核心无时钟/UUID/global/I/O，不改输入/Evidence；validator/serializer复用contracts |
| C1-V12 | 干净root构建/正常测试包含新包，reverse/deep import/cycle负例被拒 |
| C1-V13 | 修复后contracts非JSON/稀疏数组/非法日期/条件类型负例仍被拒 |
| C1-V14 | 实际回执/subject/scope校验，非法claim/旧SHA不得放行 |
| C1-V15 | Resolution prior同key/hash/version复用旧resolutionId，异内容冲突，错误类型prior拒绝 |
| C1-V16 | 新attempt/合法Gate-assessment/evaluator-normalization版本产生新Resolution key；改旧observation内容冲突；INCONCLUSIVE无业务记录 |
| C1-V17 | 正常suite接入负例不能只跑LF专用检查；保留所有旧case，缺十二固定binding之一也被拒 |
| C1-V18 | 投影0/2个criterion拒绝；assessment/closure跨criterion拒绝；单criterion多closure仅一候选；A/B分别调用key/ID不同且prior不交叉复用；Result拒绝批量/候选与错误并存；Resolution输入/输出也保持单条 |

C1-V18同时检验Schema与public pure-use-case约束，不能as断言绕过。C1-V10覆盖每个规范路径，不只一份向量。所有合成输入标CONFORMANCE_FIXTURE；prior真实性、数据库事务/并发/restart仍由I1另验。

正常命令按entry实际工具链核对：pnpm install --frozen-lockfile；pnpm run verify:versions；pnpm run contracts:generate-types；pnpm run build；pnpm run test；pnpm run contracts:qualify；pnpm run architecture:qualify；pnpm run quality。正式LF scope命令必须由G1已实现并经验证的正常入口支持；诊断exit2不算scope PASS。Windows/独立要求按risk和Authority执行，不能以Linux skip替代。

## 7. 验收与停止

独立通过只可记LF-C1/CORE_CONFORMANCE VERIFIED @ exact SHA，生产Feedback仍NOT_READY。I1/I2/E1需另外证明真实query、persistence、Context使用和工作流；不因C1组件通过自动启动。

未授权、共享竞写、相关依赖失效、语义歧义或必须绕过正常入口才过测时停止并保留diff；不revert他人变更。54范围不含修改裁判、历史review或独立Gate。文档编写完不等于开工获准。

## 8. 独立review与交接

D01～D05的准确含义、原始commit来源、主线依据及通过/拒绝例在[决策登记](../architecture/learning-feedback/decision-register.md#d01)，依次至#d05；不得根据编号临时猜义。LF-RV-01～04在7ead85b已有文档层独立PASS，但本轮新subject必须重新接受其适用性和新增登记/治理规划，不能直接继承旧verdict。

完整E0输出五决策+四finding逐项结果、subject/tree、对照main、reviewer和只读证据。接受设计不批准E1。E1实施者按照[授权规划](learning-feedback-authority-transition-plan.md)执行G0～G3；E2/E3/E4按其已定义记录收口，不再让实现者猜目录或另外设计一套授权系统。

本轮计划与导航变化会改变本文件hash；G0应刷新#97请求原文快照并保持三个路径块、4条实施文档、18要求与既有机器请求完全一致。历史快照无需删除。CURRENT及#85记录实际执行/批准状态，而不是在此复制多份实时进度。
