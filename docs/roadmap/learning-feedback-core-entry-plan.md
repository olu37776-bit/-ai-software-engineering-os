# LF-C1：独立纯核心建设开工包

状态：`DRAFT / REVIEW_FINDINGS_ADDRESSED_PENDING_REVIEW / ENTRY_NOT_RELEASED`  
更新：2026-09-08  
核对主线：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`  
上一独立审查 subject：`08b701e0ca2f497eafaaa71329666d371c72cf6e`  
[CURRENT](learning-feedback-branch-plan.md) · [Contract](../architecture/learning-feedback/contract-and-seam-proposal.md) · [并行协议](../architecture/learning-feedback/parallel-development-protocol.md) · [Gate #85](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/85)

> 本包定义第一任务的实施/验收范围；仍待独立复核及合法 scope。下列源码、Schema 与实例均尚未创建。本轮只修文档，不实施所列变更。

## 1. 第一包

只做两个纯用例：Feedback 投影、历史纠偏义务关闭条件评价；含必要 Schema/生成类型、两类 key/显式 prior 指纹比较、共享的消费视图规范化、conformance/property/replay。public entry 为 @aseos/learning，只依赖 public contracts。

不做数据库/网络/文件/Context/Agent调用，不接 Runtime startup，不建 Repository/cache/global/生产 Facts Adapter，也不做 Router、NER assembler、LearningCase、Proposal 或 dogfooding。外层使用现有 ContractRegistry 做边界校验，核心不调用文件型 loader。

## 2. E0–E4门禁

| Gate | 放行证据 | 当前 |
| --- | --- | --- |
| E0 | 最终 HEAD 独立 Contract/owner/语义 review | 三项 P1 已作文档处置，待新 HEAD 独立复核，非 PASS |
| E1 | 正式 LF-C1 operation、authority、精确 WRITE_SCOPE 和 scope checker | BLOCKED_BY_AUTHORITY；P1 仍禁止 learning；既有受检 suite 的 scope/lock 所有权亦须授权 |
| E2 | 直接依赖修复及独立/合并证据 | #82 相关 finding 尚未确认在 main 关闭 |
| E3 | 共享文件单写者、形式/窗口、最新 base | PENDING_MAINLINE_AGREEMENT |
| E4 | 实际开工 main SHA/tree、toolchain/Schema/public hashes | ENTRY 时重绑定 |

直接依赖：R06 canonical JSON/hash、R09生成类型、R10日期、R08架构、R01/R02/R16 Gate/回执/subject。不在 LF 写替代 serializer/validator 或降低 Gate。C1 不一概等待完整 Kernel/Context/Verification/Persistence，实际 I/E 依赖届时单独检查。#83 或修复 PR 的发布不等于依赖已关闭。

## 3. 合法授权与共享集成

不能把 LF-C1 伪装为 P1-O02，不能私改 resolver/全局禁令。由主线治理 owner 正式选择合法 parallel/phase operation 或受控提前 amendment；需要上位计划/ADR变更时照常独立批准。候选 operations/learning-feedback/core-1/ 必须连同 validator/登记获准，不是放一个 JSON 即授权。

共享 Schema/生成物/受检 suite/workspace/build/test/architecture 由一个集成人在同一完整 subject 配合真实 consumer 完成，或消费已获准且完整的主线接线；E3 只能选定一种。当前 core plan 的路径是授权请求，不允许本轮直接修改。

本次选择复用 first-slice/example-suite.json，避免改 examples.ts 或资格 runner。该受检 suite 已有 Phase 1 authority owner/hash 约束，E1 需正式授权最小增量及必要 hash refresh；不把新 case 添加伪装成原 P1 操作的授权，也不借机解除其他锁定资产。

## 4. 精确源码与测试清单提案

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

两类 key helper 共用唯一 semantic normalizer，不复制 JSON serializer。public/persisted类型从 contracts 生成并导入，不手写平行 DTO。normalizer 只实现 Contract §7.2 的 LF 消费等价规则，不改上游事实或 contentHash。没有 I/O 用例就不创建 ports/Repository 空接口。

### 共享 Contract、标准受检 suite 与真实实例

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

**移除候选 learning/example-suite.json；不创建第二份未被发现的 suite。** 固定十二 caseId 为 `lf-c1.<schema-stem>.<valid|invalid>`，追加到现有受检 suite，实例仍在 learning 子目录。保留全部旧 case/expectation/semantic assertion，不改通用 validator 或 runner 来绕过问题。

当前 validateExampleSuite 的路径硬编码在 `packages/contracts/src/examples.ts`，标准 `scripts/contracts/qualify-contracts.mjs` 实际调用它；因此新 case 会走原资格链。tests/contract/example-suite.test.mjs 有 38/19/19/22 统计，故明确纳入共享 scope：保持旧覆盖，新增十二项后更新精确清单与统计；按当前未变基线且不增加 semanticAssertions 为 50/25/25/22。开工时若主线已有额外实例则冻结新基线期望，不能用动态自算总数替代“十二个必需 case 不得缺失”的独立断言。

INVALID 还需 expectedError(keyword/instancePath)。conformance 须断言十二个固定 binding 全部存在；正常 contracts:qualify 必须读到真实实例。要在隔离完整仓库中逐项破坏新实例路径/内容/错误预期并确认标准入口失败，不能只跑 LF 专用测试假装接入。所有 Schema 必须已有 C1 consumer；registry/hash/type 由现有工具生成，不激活 Phase 7 其他对象。

### 共享构建/架构

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.build.json
vitest.config.mjs
tests/architecture/architecture-policy.json
```

仅新增真实 package 的依赖/reference/test discovery、learning->contracts 和必要根测试边；不加 platform->learning。主线已覆盖的路径可缩减实际 scope；需新增 workflow/脚本则先另行授权，不因本次修文档自动获得。新测试必须进正常 root test，不只手工调用。

### 同步文档与 Evidence

实现时同步本包状态、CURRENT、Contract 的实际映射；实施报告固定 docs/implementation/learning-feedback/lf-c1-implementation.md，独立报告固定 docs/reviews/learning-feedback/lf-c1-independent-verification.md。机器记录由 E1 冻结。普通文档同步随实施完成，独立报告不冒充作者自检。

## 5. 实施顺序

1. E0–E4 有真实放行证据后，从新 main 固定 scope、独立工作树和短分支。
2. 单写者落实六 Schema、十二实例、原受检 suite binding、生成物与构建接线，和真实 consumer 同 subject 发布。
3. 实现两个纯用例；分别推导 projection/resolution identity，使用唯一 LF-HN-1 normalizer 及显式 prior 比较，不存储历史。
4. 跑局部、标准资格、root build/test/architecture 及适用 quality，记录命令、subject、环境与限制。
5. 冻结 HEAD 给独立 verifier；有缺陷则另轮实施生成新 subject，验证 pass 不边审边改。

## 6. VerificationPlan

| ID | 行为与明确预期 |
| --- | --- |
| C1-V01 | 六 Schema/十二实例全在现有受检 suite 注册；固定 caseId 集合断言；标准 contracts:qualify 对删文件/错路径/invalid改valid/错误expectedError均失败，原 case仍通过 |
| C1-V02 | 七 Gate outcome 完整；approval/terminal/risk acceptance/unknown 不降级 |
| C1-V03 | criterion/Evidence 缺失、冲突、错 subject -> gap/typed拒绝，无 rootCause 推测 |
| C1-V04 | 必要义务全满足/部分明确不满足/均不满足 -> 三种正确 disposition |
| C1-V05 | 必要条件 UNKNOWN、依赖不足、非法输入 -> 不伪装 EVALUATED，不追加 completed Resolution |
| C1-V06 | 错 run/attempt/criterion版本、无合法消费关系 -> 不关闭 |
| C1-V07 | 接受风险/Claim fixed/过期或反证 -> 不冒充 MET；capturedTime仅报告，时间判定须固定 material |
| C1-V08 | 两用例固定材料/context重放一致；只换本次 ID/time 不改 key/hash，旧历史 fingerprint 字段不能被误删 |
| C1-V09 | Projection 显式 prior 同 key/hash/version ->旧 feedbackId；同 key异hash ->冲突；无prior ->候选；不同key不能覆盖 |
| C1-V10 | LF-HN-1逐路径参数化：SET排列不变；SEQUENCE反转必变；重复身份拒绝；未知字段/版本拒绝；HN-S1/Q1/D1/V1/C1向量通过公共canonical/hash API |
| C1-V11 | 核心不读时钟/UUID/global/I/O，不改输入/原Evidence；validator/serializer复用contracts，不复制 |
| C1-V12 | 干净 root 构建/正常测试真正包含新包，reverse/deep import/cycle负例被拒 |
| C1-V13 | 修复后 contracts 非JSON/稀疏数组/非法日期/条件类型仍正确拒绝 |
| C1-V14 | 实际回执/subject/scope校验；非法claim/过期SHA不通过 |
| C1-V15 | Resolution 显式 prior 同 resolutionKey/hash/version ->旧 resolutionId，不重复计数；同key异内容 ->冲突；错误类型prior拒绝 |
| C1-V16 | 新 consumer attempt、新合法 Gate/assessment 或 evaluator/normalization版本 ->独立新Resolution key；旧 observation内容被改则冲突；INCONCLUSIVE不生成虚假业务记录 |
| C1-V17 | 标准suite接入端到端负例独立于LF专用测试：十二固定binding少一项由conformance拒绝；文件/错误预期破坏由原qualification拒绝；保留原suite所有案例 |

C1-V10 需对表中每个 SET/SEQUENCE 路径运行排列/改变测试，不只验证一个 evidenceRefs 示例。哈希向量属于算法规则，不是生产事实 fixture。prior 可信来源、数据库唯一/事务、并发和重启都必须留 I1 另验；两类 key 分别测试，不以 projection PASS 推论 resolution PASS。

通用命令在 entry 核对：pnpm install --frozen-lockfile；pnpm run verify:versions；pnpm run contracts:generate-types；pnpm run build；pnpm run test；pnpm run contracts:qualify；pnpm run architecture:qualify；pnpm run quality。LF scope 命令须 E1 实际支持后运行。Windows/独立检查依 risk/authority，不以 Linux skip 替代。

## 7. 完成与停止

实现者最多 IMPLEMENTED_PENDING_INDEPENDENT_VERIFICATION。独立通过只记 LF-C1/CORE_CONFORMANCE VERIFIED @ exact SHA；生产 Feedback V1 仍 NOT_READY，I1/I2/E1 另验真实 query/持久化/Context/工作流。

未授权写入、共享竞写、相关依赖失效、Contract 歧义或需要绕过正常路径才过测时停止，保留 diff，不 revert 他人变更。共享受检 suite/lock/生成物 scope 变化必须在 E1 批准；不得把本轮三个文档的修改当作代码授权。

## 8. 独立 review 及本轮处置

上一 subject 的独立 Codex review 已返回三个 P1，而不是 PASS。LF-RV-01/02/03 分别对应 suite 接入、逐路径规范化、Resolution 幂等，原线程见 Contract §10。

本次只修 Contract 提案、此开工包和 CURRENT；全部为原授权八文档内。移除未受检 suite，补现有 suite/统计测试的候选授权；增加独立 Resolution key/normalizer 的必要源码测试候选清单；验证义务从14项细化为17项。不增加生产代码、Schema、通用validator或主线改动。

状态均为 ADDRESSED_PENDING_REVIEW，不能作者自行 close threads 或改 E0=PASS。新 HEAD 需 reviewer 复核三项及 D01–D05、owner、主线并行和 phase scope；review 不能释放尚不存在的 E1，也不能关闭 #82 finding。CI绿、emoji或无高危摘要不替代覆盖/subject明确的完整独立结论。
