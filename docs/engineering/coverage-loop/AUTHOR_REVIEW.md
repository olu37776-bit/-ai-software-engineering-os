# Coverage Loop 作者复核与交接状态

日期：2026-09-08。类型：`AUTHOR_SELF_REVIEW`，**不是独立审查，不产生VERIFIED或合并批准**。

## 1. 复核对象

PR #94初始head：`50ef2906d294d727c1a25c3bf1c1a182b24f41a6`；base：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`。

本轮正文修订截至：`03b5df9fc7cf0e54b23ae5c055edb4865b3be03e`。本报告随后追加；最终head的自动检查和独立审查以PR上具体SHA记录为准，不能用旧head结果替代。

## 2. 已发现并在文档源头修正的问题

| ID | 原缺口 | 修订位置与结果 |
| --- | --- | --- |
| CR-01 | 共享docs/README改动缺Phase1 operation context，hosted verify实际FAIL_CLOSED | 撤回仅本PR增加的导航，恢复原blob `db36f0d8cfab667a4c55dadeae392c132c4c4e41`；最终范围仅独立目录，不改scope规则 |
| CR-02 | 幂等键包含payload hash，“同键不同内容”无法成立 | DESIGN规定键为(batchId,attempt)，payloadHash独立比较，换内容必须冲突 |
| CR-03 | 原子提交说明主要覆盖报告/状态，未明确接受的测试树如何恢复 | DESIGN规定候选副本验证、testAssetDigest绑定、可恢复测试树与同一revision发布，禁止将未接受补丁写入接受树 |
| CR-04 | P0只读盘点却要求资源实测/help执行 | ENVIRONMENT和IMPLEMENTATION明确P0不执行Maven或未经审计脚本，命令认证/资源测量移至获准P1 |
| CR-05 | 未合并草案下载路径易被当成已批准Authority | README/LOCAL_HANDOFF规定旁路authority-candidate，仅P0评估；P4后才切换运行入口 |
| CR-06 | 预算容易只算成功Batch，分析/延期可无限空转 | DESIGN要求所有attempt、分析重做、上下文追加、失败调用与墙钟计入程序预算 |
| CR-07 | 本地回执仍可能只有READY，导致无法映射现有实现 | 增加P0固定模板，要求函数/行号、CLI、结果路径、对应版本证据和最多3个直接风险 |

CR-01撤回不等于自动通过全部仓库检查；必须看最终SHA的新检查。不借用Issue #82或Learning支线权限，不扩展主框架写范围。

## 3. 已复核的一手语义

重新读取JaCoCo counters/class IDs文档，确认：共享源码行不能简单逐方法/逐类相加；class identity用于执行数据与报告类关联，磁盘快照不等于运行时类必然相同。

重新读取OpenCode CLI和Oh My OpenAgent当前dev说明。非交互接口和Goal行为只作为设计参考，本地版本与取消/隔离能力尚未核验，不可直接声称支持。

来源均已列在ACCEPTANCE_AND_INCIDENTS.md；本轮没有依据无关第三方示例推定dt4j/devtestcov真实职责。

## 4. 追加到后续P2/P3的反例

- **CR-T1**：同(batchId,attempt)、同payload重试→同结果；同键换payload→冲突，不当成新接受。
- **CR-T2**：验证候选补丁后、current发布前崩溃→旧接受测试树和旧Coverage仍一致；发布后投影刷新失败→只补投影，不重接exec。
- **CR-T3**：verify通过后测试文件被改变→testAssetDigest复核拒绝发布。
- **CR-T4**：分析连续DEFER/REQUEST_CONTEXT、无成功Batch→照样消耗总预算并可暂停，不能无限loop。
- **CR-T5**：旧云端日志与当前POM不同版本→UNKNOWN/HISTORICAL，不宣布当前云端修复通过。
- **CR-T6**：未合并设计下载→只能旁路P0，不替换现有loop/authority或启动新CLI。

这些是需要现场实现并验证的用例，不是本次已跑通的Runner测试。原32项验收矩阵继续有效。

## 5. 本轮能证明与不能证明

能证明：文档已更新到本PR分支；共享索引恢复原内容；设计中的上述矛盾已在源头修订；P0输入、写入范围、禁止动作和返回格式已明确。

不能证明：本地Python工具符合新契约、当前Coverage值、Windows隔离/取消能力、云端OOM消失、POM修改正确、32项运行验收已通过。源码未读取不标LOCAL_PASSED；作者复核不标INDEPENDENT_VERIFIED。

## 6. 下一步只需本地协作

本地Agent只读现有两个工具、POM/已有有效配置、状态及用户提供的云端日志，填写`P0_LOCAL_INVENTORY.md`。不运行Maven，不写测试，不重建Generation，不继续历史取证，不修改POM或现有运行Authority。

P0可以与PR独立审查并行；实际P1改动需基于其结果明确批准。完整任务和隐私边界见 [LOCAL_HANDOFF.md](LOCAL_HANDOFF.md)。
