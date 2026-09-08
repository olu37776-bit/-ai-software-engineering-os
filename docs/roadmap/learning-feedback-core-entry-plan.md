# LF-C1：独立纯核心建设开工包

状态：`DRAFT / ENTRY_NOT_RELEASED`  
日期：2026-09-08  
观察main：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
[CURRENT](learning-feedback-branch-plan.md) · [Contract](../architecture/learning-feedback/contract-and-seam-proposal.md) · [并行协议](../architecture/learning-feedback/parallel-development-protocol.md) · [Gate #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85)

> 这是可以交给独立reviewer及主线集成owner裁决的开工包，不是已生效operation/WRITE_SCOPE。当前仍不创建代码。用户要求继续准备到可开工，不等于作者可以代替独立Gate批准自己。

## 1. 第一包只交付什么

LF-C1只交付两个纯用例：可信输入的Feedback投影、原纠偏义务的关闭条件评价；包含必要Contract、生成类型、确定性key及正反例。它们通过 `@aseos/learning` public entry 提供，不做文件/网络/数据库/Context/Agent调用，不接入Runtime启动。

不包含：Repository、global service locator、cache、生产Facts Adapter、Context delivery、Router、NodeExecutionRecord assembler、LearningCase、因果实验、Proposal、学习效果或dogfooding。不要照搬旧本地F1–F4，只实现此包。

## 2. 门禁与实际依赖

| Gate | 开工需要什么 | 当前观察 |
| --- | --- | --- |
| E0 文档/语义 | PR #84最终HEAD独立review，D01–D05被批准 | PENDING_INDEPENDENT_REVIEW |
| E1 合法scope | 主线接受提前纯核心边界；有效LF-C1 operation/authority/write-scope及scope checker | BLOCKED_BY_AUTHORITY；现行P1禁止learning且resolver只识别P1-Oxx |
| E2 公共基础 | 所依赖Contracts、generated类型、日期、hash和实际门禁已修复并证明 | WAITING_DEPENDENCY_EVIDENCE；#82 R01/R02/R06/R08/R09/R10/R16 |
| E3 共享集成 | 明确单写者、文件集合、集成形式/窗口与最新main | PENDING_MAINLINE_AGREEMENT |
| E4 exact subject | 上述批准落在可用protected-main baseline；工具链、public entry及Schema重新绑定 | ENTRY时重新计算，不绑定永久旧HEAD |

E2的最小关联：R06影响input hash/idempotency；R09影响类型与Schema一致性；R10影响时间边界；R08影响依赖隔离；R01/R02/R16影响能否相信scope/验证/回执的subject。不能在LF里复制validator或修改Gate绕开这些finding。正式批准的等价依赖处置必须提供实际证据且不降低门禁，不能只写“与我无关”。

纯C1不要求所有Kernel/Context/Verification/Policy/Persistence能力完成。主线R03/R04/R05/R07/R11–R15/WR01在实际I/E阶段依赖时分别检查；P1整体完成不自动等于C1获授权，反之也不应把无关功能当作C1前置。正式实现时以最新依赖分析更新，不把此快照当永久阻塞清单。

## 3. 授权路径

当前只提出LF-C1工作包，不伪造 `P1-O02` implementation，也不解除 `packages/learning/**` 全局禁止。

主线治理owner需选择并正式批准：在合适的Phase/parallel operation治理中增加LF-C1及其最小scope，或在现有完整治理过程下做受控提前建设amendment。若无法在不降低Phase 1不变量的前提下授权，等待相应阶段入口；继续保留准备材料，不自行改resolver regex或required check。

未来建议operation资产目录为 `operations/learning-feedback/core-1/`，必须与相应validator/schema/登记机制一并获准后使用。不能仅创建operation.json便声称已有机器门禁。入口Gate需记录最终精确路径集合和authority hashes，不由执行提示词临时扩权。

## 4. 代码文件清单提案

下列是第一包待授权的完整生产/测试落点，均尚未创建。每条允许追加细节必须先修订scope，不能将清单视为整个packages写授权。

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
tests/contract/learning-feedback/feedback-conformance.test.mjs
tests/architecture/learning-feedback-boundaries.test.mjs
```

业务类型由唯一Schema生成并从 `@aseos/contracts` 导入，不再手写一份持久化 DTO。C1不创建ports空接口或platform/persistence/adapter代码；没有真实I/O用例就不为形式建立Repository。

### 共享Contract精确增量提案

```text
packages/contracts/schemas/learning/execution-feedback.schema.json
packages/contracts/schemas/learning/feedback-resolution.schema.json
packages/contracts/schemas/learning/feedback-projection-input.schema.json
packages/contracts/schemas/learning/feedback-projection-result.schema.json
packages/contracts/schemas/learning/feedback-resolution-input.schema.json
packages/contracts/schemas/learning/feedback-resolution-result.schema.json
packages/contracts/examples/learning/example-suite.json
packages/contracts/README.md
packages/contracts/planned-contracts.json
packages/contracts/schema-inventory.json
packages/contracts/schema-registry.json
packages/contracts/type-bindings.json
packages/contracts/src/types.generated.ts
```

前六项的公共边界由Contract提案定义；example-suite包含当前机制支持的valid/invalid/boundary案例。六份Schema立即有C1 consumer和tests，不激活Phase 7其他计划Contract。registry/hash/generated文件只由现有工具生成，不能手改生成结果让测试通过。

### 共享构建/架构精确增量提案

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.build.json
vitest.config.mjs
tests/architecture/architecture-policy.json
```

仅为真实新package注册依赖/reference/test discovery及允许边。基线architecture policy目前没有learning；需要批准新增 `@aseos/learning -> @aseos/contracts`，根测试入口按实际需要登记。C1不加platform -> learning，因为本轮不接Runtime。不扩大其他package权限。若main已提供动态discovery使某文件不需修改，则实际scope可缩小并记录；不能额外增加脚本/workflow而不先授权。

### 文档与记录

本包实施时同步更新分支CURRENT、Contract提案的批准/实际映射部分与本开工计划状态，新增 `docs/implementation/learning-feedback/lf-c1-implementation.md`。独立报告固定 `docs/reviews/learning-feedback/lf-c1-independent-verification.md`。机器execution/evidence路径须在E1正式批准，不用本Markdown代替。

## 5. 实施顺序

1. 确认E0–E4全部有证据，读取最新main和独立gate；建立唯一短分支/工作树。
2. 由已指定单写者在获准范围落实Schema/生成类型/构建接线，与真实consumer同一完整subject发布；避免半成品被当完成。
3. 从契约案例实现两个纯用例与key推导，边界校验直接使用public contracts入口。
4. 运行局部、Contract、property/replay、架构、根build/quality，并提交implementation evidence和文档更新。
5. 冻结immutable HEAD交独立verifier。出现finding后另一次受控修复生成新HEAD重验，不在验证pass内补代码。

开发过程中source修改和普通文档同步是同一任务；不为更新状态另拆角色。共享文件的作者只有一个，不由两个Agent各自覆盖registry/lock。

## 6. VerificationPlan（组件级，不是生产E2E）

| ID | 必须验证的行为 | 明确预期 |
| --- | --- | --- |
| C1-V01 | 六个Schema的valid/invalid/boundary和生成类型 | 格式/条件均一致；错误版本/引用结构拒绝 |
| C1-V02 | 七Gate outcome逐项映射 | REWORK有依据才投影；INCONCLUSIVE/approval/terminal/risk acceptance不误处理 |
| C1-V03 | criterion/Evidence缺失、冲突或错subject | gap或typed rejection；不推测RootCause |
| C1-V04 | 原关闭义务全满足/部分明确不满足/全部不满足 | RESOLVED / PARTIALLY_RESOLVED / UNRESOLVED分别正确 |
| C1-V05 | 必要条件UNKNOWN、缺依赖、非法输入 | INCONCLUSIVE/BLOCKED/ERROR；不伪造EVALUATED |
| C1-V06 | 错run/attempt/criterion version、无合法consumption证明 | 不能关闭；没有模糊字符串匹配 |
| C1-V07 | PASS_WITH_RISK_ACCEPTANCE、Claim fixed、过期证据/反证 | 风险接受/声明不冒充MET；反证不能被忽略 |
| C1-V08 | 相同固定输入/时间/ID/evaluator重放 | 字节级语义输出和key稳定 |
| C1-V09 | 相同语义key不同inputHash | 返回冲突，不覆盖；不宣称数据库并发幂等已验证 |
| C1-V10 | 改变输入顺序、重复ref、额外Evidence、版本差异 | 按Contract的集合/序列规则确定处理；不任意sort有序输入 |
| C1-V11 | 数据纯度、无隐式时间/随机/global/I/O、输入不变 | Pure API不读环境、cache、file/db/network，也不修改输入 |
| C1-V12 | public entry/build/DAG/negative import | 干净构建真实包含新包；禁止reverse/deep import/cycle |
| C1-V13 | 修复后contracts负例回归 | sparse/non-JSON输入、错误日期、类型条件不能绕过canonical validator |
| C1-V14 | 回执与SHA/WRITE_SCOPE | 非法claim、缺必需证据、旧subject不得放行 |

测试允许合成schema-conformant输入，但必须标记来源CONFORMANCE_FIXTURE；不能声称这些输入由生产Node/CCP/Verification自动生成。后续I1/I2再独立证明bootstrap/query/消费真实性。

命令使用entry时仓库实际脚本。基线中可确认的通用入口为 `pnpm install --frozen-lockfile`、`pnpm run verify:versions`、`pnpm run contracts:generate-types`、`pnpm run build`、`pnpm run test`、`pnpm run contracts:qualify`、`pnpm run architecture:qualify`、`pnpm run quality`。scope命令须由E1真正支持LF-C1后使用，不能现在传一个未知operation伪造PASS。新包测试入口必须在root test真实discovery中覆盖，而不是只手工运行。

## 7. 完成与声明

实现者最多 `IMPLEMENTED_PENDING_INDEPENDENT_VERIFICATION`。独立验证通过可声明 `LF-C1 / CORE_CONFORMANCE = VERIFIED @ exact SHA`；Feedback V1仍未生产集成，不可标为VERIFIED。

生产Adapter、已提交facts、实际Context使用、数据库唯一约束/恢复、public CLI/API完整闭环分别属于I1/I2/E1。C1退出后先看对应provider gate是否满足，不自动开始全套Runtime集成。

## 8. 回滚与停止

源码修复阶段仅修改获准文件；越界、related upstream失效、shared-file竞写、Contract歧义时停止保存diff，不自行revert他人修改。回滚通过受控PR撤回该package/Schema消费者整套变更；若公共Schema已被其他任务消费，不得无迁移删除。

当前尚未创建代码，撤回本提案不会改运行时。**当前下一动作是完成#85门禁，不是让执行Agent直接照清单开工。**
