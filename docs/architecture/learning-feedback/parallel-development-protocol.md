# Learning & Feedback 与主线并行建设协议

状态：`DRAFT — coordination proposal, not a scope override`  
日期：2026-09-08  
本轮主线：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`  
[CURRENT](../../roadmap/learning-feedback-branch-plan.md) · [Contract](contract-and-seam-proposal.md) · [开工包](../../roadmap/learning-feedback-core-entry-plan.md)

## 1. 并行任务与当前同步

主线 #82 负责 R01–R16/WR01 与 P1-O09/V10；其审查/计划 PR #83 已合并为上述main。这里只确认文档/计划进入main，没有确认其修复已完成。LF文档为 #81 / PR #84，代码entry为 #85。以GitHub每次实时读取为准，CURRENT记录最新观察，不把活动PR当作已合并实现。

本轮对比 #83 六文件与 LF 八文档，交集为空。可将 main 作为第二父合入LF分支：以 main tree 为底仅叠加已授权LF文档，保护main字节，保留LF旧HEAD，不force-push。同步结果需远端diff复核，不因tree拼接成功便声明check通过。

## 2. 独立性

任务/工作树独立，代码package与纯核心独立，组件/集成/生产readiness独立，实施与独立裁决分离。不是另建Runtime、工具链、lockfile、事实库或Policy权威。

C1只依赖public contracts，不依赖platform/context/persistence具体实现。主线未来通过其公开边界装配LF；C1尚不登记platform->learning，也不批量创建空Repository/Adapter。

## 3. 单写者与共享范围

| 区域 | 原则 |
| --- | --- |
| LF专属架构/roadmap/reviews | #81范围内LF写；不改写历史review |
| progress-status、Phase1 review/operations | #82主线owner写，LF只读/链接 |
| packages/learning | #85实际放行后LF-C1写，当前不写 |
| contracts Schema/inventory/registry/generated | 指定Contract集成operation单写者 |
| workspace/lock/build/test/architecture-policy | 串行集成窗口与精确scope，禁止两方覆盖整个文件 |
| policy/persistence/platform/Runtime/CCP/worker | 对应主线owner，LF-C1不写 |
| workflow/scope verifier/accepted ADR | 治理owner，不为LF方便改门禁 |

共享只读不要求锁。共享写入前必须在Gate/PR记录task、操作者、exact base、文件集合和活动PR核对；没有承接不写。此文不声称GitHub已经提供自动文件锁。竞写时暂停受影响操作，保存diff，不自行revert他人改动。

## 4. 启动与subject绑定

每轮读取main、task HEAD、相关PR/Issue、authority、独立Evidence。记录repository、mainSHA/tree、taskHead、operation/scope、watchlist blob/schema hashes、toolchain/lock、未关闭依赖finding和dirty worktree基线。

代码任务从Gate指定的protected-main建立单独工作树，不与其他Agent共享可写工作树。分支名按正式operation唯一绑定，不复用旧失败generation伪装新证据。

完成时核对相对起始基线的新增/修改/删除/未跟踪文件；不要把用户原有dirty文件算成新增越界，也不得借ignore藏变更。

## 5. Watchlist

| 类别 | 路径/对象 | 变化后的工作 |
| --- | --- | --- |
| authority/owner | docs/README、CONTRIBUTING、repository-blueprint、ADR-0002/0003/0007/0008/0011 | 语义impact及owner review |
| 技术栈 | toolchain/toolchain.json、package.json、pnpm-lock、tsconfig | 绑定真实版本，重build，不手建平行配置 |
| 输入Contract | contracts public entry、bindings、inventory/registry、identity/ref/Gate/Evidence schemas | compatibility与consumer回归，不能as旧类型 |
| 校验实现 | canonical-json、registry、generated types、date-time、generator | 追踪#82 R06/R09/R10 |
| 架构/门禁 | architecture-policy、scripts/architecture、scope/verifier、workflows、receipt validator | 追踪R01/R02/R08/R16与新HEAD证据 |
| 生产provider | node-runtime/context/workflow/verification public entries、platform/persistence | provider就绪才开对应I阶段 |
| 任务协调 | #82后续PR、#85、LF CURRENT | shared writer、依赖finding与同步窗口 |

初始public-entry blob `794268d44184f099ac71e0a10e4cc496facbb812`、bindings `ae6db87ea4b58eab9f8c16fea73526248d22e944`、architecture policy `21b4f389b64e6f818df5aa86571857758916476b` 是定位记录，不替代Schema SHA256，也不永久锁住主线演进。

## 6. 主线变化分类

A 无依赖影响：可继续固定task subject；合并前仍up-to-date和最新检查，旧结果只属于旧SHA。
B 兼容修复：在授权窗口同步，更新watch绑定，重跑consumer、build、架构和Contract验证。
C enum/required/identity/owner/持久化语义改变：暂停对应用例，由owner批准版本/适配，不隐藏legacy alias。
D 依赖被独立审查否定：回退对应readiness，不凭旧green CI继续；无关纯核心成果不删除。

受审查历史默认不rebase/force-push。Git同步使用普通merge或正式批准的新generation；发布前再读branch ref，他人推进后停止并重新检查，update_ref force=false。新main一旦影响内容或base，重新qualify。

## 7. 共享接线集成形式

不得先批量创建空Schema/package。新增Schema需要真实consumer/examples，新package需要实现/public entry。优先在一个原子完整subject中由唯一集成人负责共享文件，LF实现者负责不重叠source；或者主线已经有完整可用接线时，消费其protected-main结果。entry Gate必须选定一种形式，不能同时做。

C1增加learning->contracts及必要root测试/构建登记，不给platform增加Runtime接线。无法通过现行scope合法登记就保持BLOCKED_BY_AUTHORITY，不修改allowlist/skip断言换绿。

## 8. 验证与独立审查

实施报告绑定HEAD/tree、命令/环境、输入/制品hash、scope和限制；独立verifier另一个checkout只读运行批准VerificationPlan。发现缺陷时另起修复轮和新HEAD，不能同一pass边修边VERIFIED。

报告本身写入造成新commit，旧verdict仍仅指被测SHA。report-only差异与新head机器检查另记录，merge后对protected-main merge SHA做适用qualification。Git签名verified、CI success、作者自检、Code Review无高危意见，都不自动等于完整语义Gate PASS。

可通过已有PR review通道请求独立意见；请求/eyes反应/任务启动不是审查完成。只有可追踪reviewer、确切subject、实际覆盖与结论可用才记录相应证据。不支持自动审查时保持PENDING，不自造角色或批准。

## 9. 文档对齐节奏

操作完成同时更新实现路径、Contract、状态和Evidence，不单独拆普通文档写手。独立角色负责校验一致性，计划/review可单独产出。

每工作包结束局部对齐；公共接口变化、共享集成、首次生产wiring、阶段放行前完整对齐。长期任务每工作日首次恢复读watchlist；不承诺无工具支撑的后台自动监控。

CURRENT仅在branch-plan；架构定义边界，review/readiness保留原SHA快照。全局progress由主线owner维护，不创建竞争状态源。

## 10. 停止与恢复

未授权文件、共享竞写、authority冲突、相关依赖失效、来源不可关联或测试需绕过生产路径才通过时停止。保留diff并记录最小缺口，取得新scope/owner决定/依赖证据后建立新subject。可继续未受影响的设计和案例准备；待修模块不得修改同一实验的裁判/Gate。
