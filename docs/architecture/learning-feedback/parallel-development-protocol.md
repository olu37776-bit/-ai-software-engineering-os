# Learning & Feedback 与主线并行建设协议

状态：`DRAFT — coordination proposal, not a scope override`  
日期：2026-09-08  
主线观察SHA：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
[分支入口](../../roadmap/learning-feedback-branch-plan.md) · [Contract提案](contract-and-seam-proposal.md) · [C1开工计划](../../roadmap/learning-feedback-core-entry-plan.md)

## 1. 当前协调对象

主线跟踪 [#82](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/82)，review/plan PR为 [#83](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/83)，观察head为 `27e8d92012f88b30fa20b3febec7b3b5098a6289`。Learning文档为 #81 / PR #84；核心开工门禁为 #85。

PR #83中的review已报告R01–R16/WR01；本分支将其作为已发布审查输入，不将未合并PR内容当作main已实施。主线继续自己的修复，本分支不关闭其finding、不代替其独立验证。没有观察到新main commit不等于主线停止工作。

## 2. 四种独立性

- 任务独立：短生命周期分支/工作树、单个明确operation、不同产物与回执。
- 代码独立：C1仅contracts -> learning，不依赖Runtime/Context/Persistence实现；不拆新服务。
- 状态独立：纯核心conformance、运行集成、Feedback V1、Learning readiness分别记录。
- 裁决独立：实现者同步文档但最多IMPLEMENTED；独立reviewer对exact subject裁决，不边审边修。

独立不意味着永远不合并主线、复制公共类型、单独lockfile/工具链或自行制定新的Gate。严禁把另开分支当作避开WRITE_SCOPE的方法。

## 3. 文件所有权与并发写入

| 区域 | 当前写入原则 |
| --- | --- |
| `docs/architecture/learning-feedback/`、LF专属roadmap/reviews | 本分支在#81授权范围内维护；历史review不改写 |
| 主线 `docs/roadmap/progress-status.md`、Phase 1 review/operations | #82主线owner写；LF只读并链接 |
| `packages/learning/**` | 开工Gate通过后才由LF-C1实现者写；当前不存在/禁止写 |
| `packages/contracts` Schema/inventory/registry/type-bindings/generated | 共享区；由批准的Contract集成operation单写者处理 |
| package.json、workspace、lock、tsconfig、test discovery、architecture-policy | 共享集成区；串行窗口和独立scope，不准双方同时整文件覆盖 |
| policy/persistence/platform/Runtime/CCP/worker | 对应主线owner；LF-C1不写 |
| .github/workflows、scope verifier、accepted ADR | 治理/主线owner；不能为LF任务方便而修改 |

只读共享不需要排他锁。写共享文件前在Gate/PR记录 exact base、操作者/任务、文件集合及未合并PR检查；没有明确承接就不写。此协议不假称GitHub已提供自动锁。发生竞写，暂停受影响任务，保存diff，不自行revert他人变更。

## 4. 操作启动协议

每轮从GitHub读取main、目标branch HEAD、相关PR/Issue、当前authority及独立证据。记录：repository、mainSHA/tree、taskHead、operation/scope、watchlist的blob/schema hashes、工具链/lock身份、已知upstream findings、dirty worktree基线。

从唯一受保护main（或Gate明确授权的docs/集成前置已合并基线）建立工作树；不要把正在开发的主线工作树共享给另一个Agent。分支名在正式operation中唯一绑定，禁止复用旧失败generation作新事实。

写入后核对新增/修改/删除/未跟踪文件相对起始baseline的集合，而不是把用户已有dirty files算成执行者新越界。未被Git跟踪的本地文档也要核对hash；不得通过ignore隐藏改动。

## 5. 依赖观察表

以下均以观察SHA读取；每次任务开始、发布前和主线相关PR合并后重新读取，不用此表固定旧版本阻止主线演进。

| 类别 | 观察路径/对象 | 变化后动作 |
| --- | --- | --- |
| 不变量/owner | docs/README.md、CONTRIBUTING.md、repository-blueprint、ADR-0002/0003/0007/0008/0011 | 检查语义影响；owner/authority改变须设计review |
| 技术栈 | toolchain/toolchain.json、package.json、pnpm-lock.yaml、tsconfig.base/build | 重新build/conformance；不手抄版本另建配置 |
| 公共输入 | contracts/src/index.ts、type-bindings、schema-registry/inventory/planned-contracts、identity/SubjectRef/SchemaRef/Gate/Evidence schemas | 重新映射和compatibility验证；不能强制as旧类型 |
| 校验实现 | contracts canonical-json、registry、generated types、date-time、generator | 追踪#82 R06/R09/R10及consumer回归 |
| 架构/Gate | tests/architecture/architecture-policy.json、scripts/architecture、scope-policy/verify-scope、workflows、receipt validators | 追踪R01/R02/R08/R16；新HEAD重新证明 |
| 后续生产依赖 | node-runtime/context/workflow/verification public entries、platform装配、persistence query/worker | provider出现后才开启对应I阶段；不deep import |
| 协调进度 | #82/#83及后续相关PR、#85 entry gate、LF CURRENT | 检查shared writer和未解决dependency findings |

初始定位用的已读取blob：contracts public entry `794268d44184f099ac71e0a10e4cc496facbb812`；type-bindings `ae6db87ea4b58eab9f8c16fea73526248d22e944`；architecture policy `21b4f389b64e6f818df5aa86571857758916476b`；SubjectRef `7732a3aa9fcae3ba232e1d4ad54cbdfff2402a1a`。这些Git blob用于定位，不替代Schema内的SHA256语义。

## 6. 主线变化的处理

A. 不影响依赖/共享文件：继续固定当前task subject；合并前仍需strict up-to-date和最新head检查。旧结果只属于旧subject。
B. 兼容的公共实现/修复变化：在授权同步窗口合入/重建基线，更新watch bindings，重跑该consumer与通用build/架构/Contract验证。
C. 新enum、required字段、identity/owner/持久化语义改变：暂停相关用例，提交最小Contract impact；由owner批准新版本或明确适配，不维护隐藏legacy alias。
D. 开发中依赖被独立审查否定：失效对应readiness，不继续以旧绿色CI为依据；不把所有无关纯逻辑成果一并删除。

发布后需同步时保留旧审查SHA；按主线已有治理允许的方法做普通merge或新generation分支。默认不rebase/force-push受审查历史。branch HEAD若被他人推进，停止发布、重新读diff；`force:false` fast-forward，不能覆盖别人commit。

## 7. 共享接线如何合并

C1请求的新增Schema与package/build/test/architecture接线先作为明确integration delta评审。不能仅批准source目录却漏掉root workspace/lock/generated类型的scope。

建议先由共享集成owner基于最新main完成允许的登记/接线，LF实现依赖其受保护main结果；若必须一个原子PR才能通过构建，则该PR指定唯一集成人负责共享文件，其他Agent只能提交不重叠的受控内容。两种形式必须由entry Gate选定，不能同时执行。

集成不能只放空package以制造进度：新Schema要有真实consumer/examples，新package要有可验证实现/公开入口。不得为让分支先绿而弱化架构allowlist、skip测试或返回伪成功。

## 8. 验证绑定和审查者边界

Implementation report绑定source HEAD/tree、命令/环境、输入及生成物hash、scope差异和已知限制。Verifier在独立checkout按已批准VerificationPlan运行；不能为修复测试在同一pass改source或fixture预期。

独立verdict固定被审查SHA。其报告写入后如产生新commit，不能宣称该新SHA也已被原报告独立验证；另记录report-only差异及适用机器检查，合并仍需最新head检查。保护main合并后再对merge SHA执行适用验证。

CI成功不自动等于独立语义review；尤其#82 R01指出required verify汇总不完整时，需要读取所有适用quality/Windows结果，不凭单个绿色图标放行。

## 9. 文档同步与定期对齐

执行操作同时更新其真实路径、Contract、状态和Evidence，不再拆“专门写文档Agent”。独立角色校验文档与代码/Contract/测试/运行证据的一致性。

每工作包结束做局部检查；任意公共接口变更、共享文件integration、首次生产接线和阶段放行前做全量分支对齐。长期任务每个工作日首次恢复读取watchlist；没有定时工具时不声称后台已自动监控。

分支当前任务只在 `docs/roadmap/learning-feedback-branch-plan.md` 记录；架构入口只导航，review是历史快照，不再平行维护多个CURRENT。根main progress由主线owner维护。

## 10. 停止与恢复

需停：未授权文件、共享竞写、authority冲突、相关依赖已失效、source/consumer无法可靠关联、必须绕过真实生产路径才能过验收。

恢复需要更新后的scope/owner决定或可验证依赖证据，再建立新subject重验。停止不意味着放弃分支；允许继续未受影响的设计与案例准备。不得让待修模块同时修改自己的验证规则或本实验的Gate。
