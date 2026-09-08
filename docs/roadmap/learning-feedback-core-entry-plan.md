# LF-C1：独立纯核心建设开工包

状态：`DRAFT / REVIEW_FINDINGS_ADDRESSED_PENDING_REVIEW / ENTRY_NOT_RELEASED`  
更新：2026-09-08  
核对主线：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`  
本轮独立审查 subject：`39cdb4b33cda6616f98ec67855e4e61ee60705b6`  
[CURRENT](learning-feedback-branch-plan.md) · [Contract](../architecture/learning-feedback/contract-and-seam-proposal.md) · [并行协议](../architecture/learning-feedback/parallel-development-protocol.md) · [Gate #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85)

> 本包给出第一任务边界和验收，仍待独立复核及合法scope。下列源码、Schema和实例均未创建；本轮只修文档。

## 1. 第一包：单原子义务的纯核心

只实现Feedback投影、历史纠偏义务关闭评价两个纯用例；包括必要Schema/生成类型、两类key/prior、消费视图规范化及conformance/property/replay。唯一public entry为@aseos/learning，只依赖public contracts。

**每次投影一个原子criterion，输出至多一个候选；每次Resolution一个Feedback和一个consumer Attempt，输出至多一条评价。** criterionRefs恰一项；多closure要求必须归属同一criterion。单次allocatedId/priorFingerprint只服务一个key。V1拒绝组合group或批量调用，不通过新增batch DTO/manager扩大本包。详细规则以Contract§3.1/7.3为准。

不做数据库/网络/文件/Context/Agent调用，不接Runtime，不建Repository/cache/global/生产Adapter，也不做Router/NER/LearningCase/Proposal/dogfooding。外层用已有ContractRegistry验证Schema，纯核心不调用文件loader。

## 2. E0–E4门禁

| Gate | 放行证据 | 当前 |
| --- | --- | --- |
| E0 | 最终HEAD完整独立Contract/owner/语义review | 两轮共四项P1已作文档处置；待新HEAD复核，非PASS |
| E1 | 正式LF-C1 operation、authority、精确scope及checker | BLOCKED_BY_AUTHORITY；P1仍禁止learning；受检suite的owner/hash需授权 |
| E2 | 直接依赖修复及独立/合并证据 | #82相关finding未在main确认关闭 |
| E3 | 共享文件单写者、形式/窗口、新base | PENDING_MAINLINE_AGREEMENT |
| E4 | 开工main SHA/tree、工具链/Schema/public hashes | ENTRY时重绑定 |

直接依赖为R06 canonical JSON/hash、R09生成类型、R10日期、R08架构、R01/R02/R16 Gate/回执/subject，不在LF写替代validator/serializer或降低Gate。C1不等待无关的完整Runtime/Context/Verification/Persistence；#83或修复PR的发布不表示依赖已关闭。

## 3. 合法授权与共享集成

不能伪装P1-O02、私改resolver/全局禁令。主线治理owner按既有流程批准合法parallel/phase operation或受控提前amendment；必要上位计划/ADR变更需独立批准。候选operations/learning-feedback/core-1/须连同validator/登记获准，不是放一个JSON即授权。

Schema/生成物/受检suite/workspace/build/test/architecture由单一集成人与真实consumer在完整subject发布，或消费已获准且完整的主线接线；E3只能选择一种。路径清单是授权请求，不允许现在改源码。复用first-slice suite无需改examples.ts或runner，但该suite现有authority owner/hash仍须E1授权最小增量，不能顺带解除其他锁。

## 4. 精确源码和测试清单提案

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

两类key共用唯一normalizer，不复制JSON serializer。public/persisted类型由contracts生成，不手写平行DTO；不创建无实际I/O的ports/Repository。LF-RV-04的基数测试放已有project-feedback/input-validation/idempotency/conformance测试，不增加batch文件或包。

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

不创建learning/example-suite.json。十二个caseId固定lf-c1.<schema-stem>.<valid|invalid>，追加原first-slice受检suite，实例放learning/；保留全部原case/expectation/semanticAssertions，不修改通用validator/runner绕过问题。

examples.ts固定读原suite；contracts:qualify调用该入口。example-suite.test.mjs有38/19/19/22统计，已纳入候选共享scope。未变基线且无新增semanticAssertions，追加十二个后为50/25/25/22；开工前冻结新main的实际案例，不用动态总数掩盖十二固定binding缺失。INVALID须expectedError(keyword/instancePath)。标准资格在隔离完整副本面对删新文件、错路径、invalid改valid、错误expectedError均必须失败；缺固定case由conformance拒绝。

基数约束必须进入Input/Result及持久化对象Schema和语义validator：一个criterion、一个allocatedId/prior、单个result；零/多criterion及另一criterion的assessment/closure均拒绝。正常同一criterion的多个关闭要求仍合法且仅一条反馈。全部Schema立即有consumer，不激活其余Phase7对象；registry/hash/type用现有工具生成。

### 共享构建/架构

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.build.json
vitest.config.mjs
tests/architecture/architecture-policy.json
```

仅接入真实package的dependency/reference/test discovery、learning->contracts和必要根测试边，不加platform->learning。主线已覆盖的路径可缩减；额外workflow/脚本须另行授权。新测试必须进入正常root test。

### 文档与Evidence

实现时同步本包、CURRENT、Contract实际映射；实施报告固定docs/implementation/learning-feedback/lf-c1-implementation.md，独立报告固定docs/reviews/learning-feedback/lf-c1-independent-verification.md。机器记录由E1先冻结，普通文档同步随操作完成。

## 5. 实施顺序

1. 读取#85真实E0–E4证据，在获准新main建立独立工作树/短分支。
2. 单写者落实Schema/十二实例/原suite binding/生成物/构建接线与真实consumer。
3. 实现单义务用例、projection/resolution key、唯一normalizer与显式prior，不存历史，不添加批量外层编排。
4. 跑局部、正常资格、root build/test/architecture和适用quality，记录subject/命令/环境/限制。
5. 冻结HEAD给独立verifier；有问题另轮实施，新subject重验，不同pass边审边改。

## 6. VerificationPlan

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

C1-V18需同时验证Schema入口和public pure-use-case语义约束，不通过as类型断言绕过。C1-V10覆盖每个表列路径，不只一个evidenceRefs例子。纯比较不证明prior真实、数据库事务/并发/restart；I1分别验证两类key。所有合成输入标CONFORMANCE_FIXTURE，不宣称生产Node/CCP事实。

通用命令在entry核对：pnpm install --frozen-lockfile；pnpm run verify:versions；pnpm run contracts:generate-types；pnpm run build；pnpm run test；pnpm run contracts:qualify；pnpm run architecture:qualify；pnpm run quality。LF scope命令须E1实际支持，不传未知operation制造PASS；Windows/独立检查依risk/authority，不以Linux skip替代。

## 7. 完成与停止

实施最多IMPLEMENTED_PENDING_INDEPENDENT_VERIFICATION；独立通过只记LF-C1/CORE_CONFORMANCE VERIFIED @ exact SHA，Feedback V1生产仍NOT_READY。I1/I2/E1另验真实query/persistence/Context/工作流。

未授权、共享竞写、相关依赖失效、Contract歧义、必须绕过正常路径才过测时停止并保留diff，不revert他人变更。受检suite/lock/生成物scope须E1批准；文档候选清单不等于实际写授权。

## 8. 独立review与开工交接

首轮08b701e发现suite接入、hash分类、Resolution幂等三个P1；39cdb4b复核又提出多义务调用基数P1（LF-RV-04）。本次选择收窄V1为单原子criterion，不加batch结构，更新三文档和C1-V18。所有四项仍ADDRESSED_PENDING_REVIEW；自动review未重复某项不等于已正式关闭。

最终审查需绑定exact subject，覆盖四findings、D01–D05、单义务基数、owner与phase/scope/并行边界，给出明确结论。审查不能释放尚未批准的E1或关闭主线#82 finding。CI绿/emoji不替代完整覆盖证据。

门禁接续不再重复总体设计：先读取#85及main最新状态；依据已有独立结果关闭E0；将E1的合法operation/scope和E3的共享写入承接交主线治理任务明确批准；逐项核对E2依赖证据，最后绑定E4。任一项无证据仍为BLOCKED，不能将评论请求当批准。E0–E4全满足，才发布正式开工回执并执行§5。
