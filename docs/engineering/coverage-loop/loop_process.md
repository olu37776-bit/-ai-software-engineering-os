# Coverage Loop 控制协议

状态：`DRAFT v1.0 / TARGET_PROTOCOL`。先完成 [实施与验收](IMPLEMENTATION_PLAN.md)，再启动。本文不证明任何新 CLI 已存在。

## 1. 唯一目标与输入

以当前保留测试资产的新鲜完整执行证明 JaCoCo 聚合 LINE Coverage ≥ 90%，并满足测试健康与范围门禁。累计搜索值不等于完成。

程序恢复锁定环境、current revision、active attempt、工作包和最新新鲜/搜索报告。测试方法读 [TEST_AUTHORING_GUIDE.md](TEST_AUTHORING_GUIDE.md)，数据规则读 [ENVIRONMENT_AND_COVERAGE.md](ENVIRONMENT_AND_COVERAGE.md)。不读无关 Survey/GBrain/框架资料。

## 2. 七阶段只描述决策，不展开工具内部命令

| 阶段 | 唯一动作 | 后续 |
| --- | --- | --- |
| RESTORE | 程序恢复状态、核验环境/锁/遗留进程；主 Agent读短摘要 | 有active先恢复，无active再PLAN |
| PLAN | 主 Agent从程序给定的有限Method候选中选优先级 | 程序冻结WorkItem，不直接派实现 |
| DELEGATE | 程序先调用只读分析者；分析获准后签发同目标实施任务 | 实施者提交隔离测试补丁 |
| VERIFY | 程序复用verify-batch和审查接口，核验补丁、测试发现、健康、精确目标效果 | PASS→CLOSE；可修→REPAIR；环境/身份异常→PAUSED |
| REPAIR | 主 Agent根据短失败摘要选择配方修正/测试修复/延期 | 程序按有限预算重发任务，不无限重试 |
| CLOSE | 程序复用close-batch准备不可变结果并发布唯一current指针 | 成功后才计完成；失败只恢复本次提交 |
| DECIDE | 程序检查预算、新鲜报告与候选可行性 | 下一包、checkpoint、finalize或PAUSED |

主 Agent不写测试/POM/manifest，不手算Coverage，不自己合并exec。子 Agent无接受/推进正式状态权限。Analysis与Implementation是两个独立调用；工作包hash和精确Target贯穿全过程。

## 3. 给操作者的入口

目标接口均集中在现有 `test_runner.py loop`：prepare、run、status、pause、finalize；具体实施前先检查本地 `--help` 和P0映射，不能照文档猜命令。

`run` 内部自动委派、校验、落盘、下一轮。不要求人逐包确认。底层 compile/target/module/merge/snapshot/delta 不是主 Agent的流程步骤。

主Agent/子Agent不能递归启动另一个loop。Runner对工作区加单写锁，对每个调用绑定角色、attempt和预算；同一次运行只有一个控制器。

## 4. 最低放行条件

无当前Target对应的合法Analysis，程序不得发出实施任务。无合法补丁和完整测试证据，不得接受。目标方法/descriptor未改善，不能用Class其他行增长代替。

报告不完整、零测试、OOM/超时、未清理进程、身份漂移、状态损坏或保护文件修改，立即PAUSED并保存证据。不可达单目标按预算延期，不伪报成功；不能确定预期则不生成猜测断言。

原有失败只能按已批准范围单独记录，不能因newFailures为空就视为构建成功。最终验收不得携带未处理required test失败。

## 5. 恢复与文档

每轮已发布事实由current revision决定，Markdown是带revisionId的视图。未完成提交先恢复，视图遗漏先重建，不重复接受或重复加Coverage。

工作包/分析/测试补丁/报告hash不一致时不复用旧PASS。跨生产build或scope不得合并；修改旧测试/fixture后搜索贡献按数据契约失效。

## 6. 何时结束

可配置批次/时间/模型预算耗尽→PAUSED，可从磁盘恢复。候选用尽、只有无法当前处理的目标→PAUSED并给缺口，不空转。

搜索值达到90%只触发finalize。当前完整测试新鲜执行、范围一致、报告有效、所有required tests通过且LINE≥90%，才由程序生成COMPLETE证据。失败则从新鲜缺口继续，不用旧exec补绿。

## 7. `/goal` 的边界

外层插件仅唤醒已验证Runner，不能替代门禁、进程生命周期或预算。启用前核验本地OpenCode/插件版本与能力；不要照搬旧`/ulw-loop`完成标记或未验证的iteration配置。

迁移/验收完成后的短启动意图：

```text
读取 .ai-local/coverage/authority/loop_process.md，使用已验收的Coverage Loop Runner恢复并继续。
只按程序结果推进；PAUSED时停止自动重试并报告原因；COMPLETE必须有本次有效finalize证据。
不要手工改生产代码、POM、manifest或Coverage数值，不启动第二控制器。
```

当前阶段的下一步不是发送这个启动意图，而是完成 IMPLEMENTATION_PLAN.md 的 P0。