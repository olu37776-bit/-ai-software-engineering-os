# LF-C1：独立纯核心建设开工包

状态：`DRAFT / ENTRY_NOT_RELEASED`  
更新：2026-09-08  
最新核对主线：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`  
[CURRENT](learning-feedback-branch-plan.md) · [Contract](../architecture/learning-feedback/contract-and-seam-proposal.md) · [并行协议](../architecture/learning-feedback/parallel-development-protocol.md) · [Gate #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85)

> 本包已给出第一任务的具体边界和验收，仍待独立review和合法scope。Markdown清单、用户希望推进、作者自检都不替代当前机器Authority。未创建任何下列源码/Schema文件。

## 1. 第一包

只做两个纯用例：Feedback投影、原纠偏义务的关闭条件评价；含必要Schema/生成类型、key/显式指纹比较、conformance/property/replay。唯一public entry为 `@aseos/learning`，只依赖public contracts。

不做数据库/网络/文件/Context/Agent调用，不接Runtime startup，不建Repository/cache/global，亦不做生产Facts Adapter、Router、NER assembler、LearningCase、Proposal或dogfooding。外层测试使用现有ContractRegistry验证边界；纯函数不调用文件型registry loader。

## 2. E0–E4门禁

| Gate | 放行证据 | 当前 |
| --- | --- | --- |
| E0 | PR84最终HEAD独立Contract/owner/语义review | PENDING |
| E1 | 正式LF-C1 operation、authority、精确WRITE_SCOPE及实际scope checker | BLOCKED_BY_AUTHORITY；现行P1仍禁止learning |
| E2 | 直接依赖修复及独立/合并证据 | #82相关finding未确认关闭 |
| E3 | 共享文件单写者、集成形式/窗口、最新base | PENDING_MAINLINE_AGREEMENT |
| E4 | 真实开工protected-main SHA/tree、toolchain/Schema/public hashes | ENTRY时重绑定 |

直接依赖：R06 canonical JSON影响hash；R09生成类型；R10日期；R08架构隔离；R01/R02/R16影响真实Gate/回执/subject。不在LF里写替代serializer/validator或降低门禁绕过。需要替代处置时由正式owner基于证据批准，不能只口头称无关。

C1不使用完整Kernel/Context/Verification/Persistence生产能力，不一概等待所有未来功能或主线全部finding；I/E阶段才检查其实际依赖。#83合并只发布问题与计划，不表示E2通过。

## 3. 合法授权与集成

不将LF-C1伪装P1-O02，不修改resolver regex偷偷支持LF，不删除packages/learning全局禁令。由主线治理owner正式选择合法parallel/phase operation或提前建设amendment；如需上位计划/ADR变更，按原流程独立批准。

未来机器operation目录候选 `operations/learning-feedback/core-1/` 需连同validator/登记获准，不是放一个operation.json就拥有授权。准确execution/evidence路径由E1冻结，批准前保持NOT_RELEASED。

共享Schema/生成物/workspace/build/test/架构由一个集成人在同一完整subject完成，与真实consumer一起发布；或消费已经获准且完整的主线接线。E3选定一种，不先创建空包。C1不改platform/Runtime/Policy/Persistence实现。

## 4. 精确源码和测试清单提案

```text
packages/learning/package.json
packages/learning/tsconfig.json
packages/learning/src/index.ts
packages/learning/src/feedback/domain/feedback-rules.ts
packages/learning/src/feedback/application/project-feedback.ts
packages/learning/src/feedback/application/evaluate-feedback-resolution.ts
packages/learning/src/feedback/application/derive-feedback-key.ts
packages/learning/test/project-feedback.test.mjs
packages/learning/test/evaluate-feedback-resolution.test.mjs
packages/learning/test/feedback-replay.test.mjs
packages/learning/test/feedback-input-validation.test.mjs
packages/learning/test/feedback-idempotency.test.mjs
tests/contract/learning-feedback/feedback-conformance.test.mjs
tests/architecture/learning-feedback-boundaries.test.mjs
```

生成的public/persisted类型从contracts导入，不手写平行DTO。compareFeedbackFingerprint与deriveFeedbackKey共用key模块，不新增存储；测试覆盖显式priorFingerprint。暂不创建没有真实用例的ports空接口。

### 共享Contract与真实实例

```text
packages/contracts/schemas/learning/execution-feedback.schema.json
packages/contracts/schemas/learning/feedback-resolution.schema.json
packages/contracts/schemas/learning/feedback-projection-input.schema.json
packages/contracts/schemas/learning/feedback-projection-result.schema.json
packages/contracts/schemas/learning/feedback-resolution-input.schema.json
packages/contracts/schemas/learning/feedback-resolution-result.schema.json
packages/contracts/examples/learning/example-suite.json
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
```

现有example-suite.schema要求caseId/schemaId/instancePath/expected，INVALID还需expectedError(keyword/instancePath)。suite索引以上真实文件，不能把JSON实例嵌在未支持的字段或引用未授权路径。每个Schema至少valid/invalid各一份，边界/性质输入可在测试中构造。全部Schema立即有真实C1 consumer，不激活其余Phase7对象。

registry/hash/类型按现有工具产出，不能改生成结果规避失败。若现行generator不能表达必要条件，由主线修复/正式设计处理，不在LF新建generator。

### 共享构建/架构

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.build.json
vitest.config.mjs
tests/architecture/architecture-policy.json
```

仅新增真实package的依赖/reference/test discovery，新增learning->contracts和必要root测试边；不加platform->learning。主线新discovery已覆盖的文件可从实际scope缩减，不额外增加workflow或通用脚本。新增包测试必须进入正常root入口，不只手工调用。

### 同步文档与证据

实现时更新本包状态、分支CURRENT、Contract实际映射；实施报告 `docs/implementation/learning-feedback/lf-c1-implementation.md`，独立报告 `docs/reviews/learning-feedback/lf-c1-independent-verification.md`。机器记录由E1先冻结。实现与普通文档同步一次完成，独立报告不冒充作者自检。

## 5. 实施步骤

1. E0–E4实际放行后，固定最新main与scope，建立唯一工作树/短分支。
2. 单写者落实Schema/真实实例/生成物/构建接线，与consumer原子发布。
3. 实现纯用例和key/指纹比较；遵守Contract§7的来源hash字段、元数据排除和集合/序列区分。
4. 跑局部、正常root build/test/Contract/架构与适用quality，记录命令、subject、环境与限制。
5. 冻结HEAD给独立verifier；发现缺陷后新修复轮，不同一验证pass改代码。

## 6. VerificationPlan

| ID | 行为与明确预期 |
| --- | --- |
| C1-V01 | 六Schema、十二实例、suite实际路径可解析；生成类型保留条件与未知版本拒绝 |
| C1-V02 | 七Gate outcome完整，approval/terminal/risk acceptance/unknown不降级 |
| C1-V03 | criterion/Evidence缺失、冲突、错subject -> gap/typed拒绝，无rootCause推测 |
| C1-V04 | 全部满足/部分明确不满足/均不满足 -> 三种正确disposition |
| C1-V05 | 必要条件UNKNOWN、缺依赖、非法输入 -> 不伪装EVALUATED |
| C1-V06 | 错run/attempt/criterion版本，无合法消费关系 -> 不关闭 |
| C1-V07 | 风险接受、Claim fixed、过期或反证 -> 不冒充MET |
| C1-V08 | 完整固定输入/context重放稳定；仅换分配ID/time不改变来源语义key/hash |
| C1-V09 | 显式prior同key同hash -> REUSE_EXISTING；同key异hash -> CONFLICT；未提供 -> 候选，不虚称存储查重 |
| C1-V10 | 集合顺序、重复ref、sourceBoundary/版本变化按Contract处理；有序输入不乱sort |
| C1-V11 | 核心不读时钟/UUID/global/I/O，不改输入；边界validator来自contracts而非复制 |
| C1-V12 | 干净root构建/测试包含新包；真实import负例拒绝reverse/deep import/cycle |
| C1-V13 | 修复后contracts的非JSON/稀疏数组、非法日期、条件类型负例仍被拒绝 |
| C1-V14 | 实际回执/subject/scope校验，非法claim和旧SHA不通过 |

显式priorFingerprint比较不证明来源真实、事务或数据库唯一性；这些必须由I1并发/重启测试完成。schema-conformant输入标记CONFORMANCE_FIXTURE，不宣称由生产Node/CCP/Verification生成。假context、手工global/cache不能算I/E生产证明。

通用命令在entry时核对；当前已有入口：`pnpm install --frozen-lockfile`、`pnpm run verify:versions`、`pnpm run contracts:generate-types`、`pnpm run build`、`pnpm run test`、`pnpm run contracts:qualify`、`pnpm run architecture:qualify`、`pnpm run quality`。LF scope命令须E1真正支持后使用，不传未知operation制造PASS。所需Windows/独立检查按实际risk/authority，不靠Linux skip替代。

## 7. 完成和停止

实现者最多IMPLEMENTED_PENDING_INDEPENDENT_VERIFICATION。独立通过可记 LF-C1/CORE_CONFORMANCE VERIFIED @ exact SHA；生产Feedback V1仍NOT_READY。I1/I2/E1另验真实query/持久化/Context使用/完整workflow，不自动启动。

未授权写入、shared竞写、相关依赖失效、Contract歧义或必须绕过正式路径才过测时停止，保存diff，不revert别人变更。回滚用受控PR，已被其他consumer使用的公共Schema不能无迁移删除。

## 8. 独立文档review完成要求

只读审查最终PR #84 SHA，覆盖D01–D05、真实例子路径、纯函数hash/幂等、七outcome、owner/scope边界及主线并行影响。须给出subject、覆盖范围、finding证据和明确结论；仅eyes/thumbs-up、无高危自动摘要、签名verified或CI绿不能关闭E0。

Review不能批准尚不存在的E1 scope或关闭#82 finding。E0通过后仍按#85核对其余条件；未满足不写“可以开工”。若自动review通道不可用，保留PENDING并使用同一固定subject交给独立执行环境，不再重新起草整套设计。
