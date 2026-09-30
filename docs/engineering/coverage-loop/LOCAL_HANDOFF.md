# 本地协作交接：只读P0，不重建环境

状态：`DRAFT v1.1 / INSPECTION_ONLY`。

## 1. 为什么现在需要本地

GitHub已有设计、测试指导、故障回归规范与实施计划；当前没有用户本地Java项目POM、两个Python工具的实际代码、云端原始日志和OpenCode能力证据。

继续远程猜函数签名、profile、Agent参数或manifest结构，会重复以前的环境误修。因此下一动作是**让本地Agent读取现状并填一次固定回执**，不是写新测试或重新建Baseline。

独立审查/PR合并状态与本地盘点分开：未合并文档可以作为P0评估材料，不得替换已批准的运行Authority；任何P1实现及长期Loop启动仍须后续放行。

## 2. 下载与版本

从PR #94确认的不可变commit下载 `docs/engineering/coverage-loop/`，放入新的旁路目录：

```text
.ai-local/coverage/reconstruction/authority-candidate/pr94-<commit前12位>/
```

记录完整40位commit和文件hash。不要从移动中的main/branch默默取不同版本，不覆盖已有authority/loop/状态。同名目标目录已存在时不覆盖，先核对内容。

可使用交付的一次性下载辅助文件；它只下载/验完整性，不是新Coverage工具，不调用Maven/OpenCode，不激活Authority。下载失败保留旧环境，不关闭TLS校验，不把凭据写进脚本。已下载文件也可由用户离线复制到上述旁路目录。

本地Agent首先只需阅读 README、IMPLEMENTATION_PLAN 的P0、这个文件与P0回执模板。其他设计按发现的问题定点查阅，不把所有长文档每轮灌入。

## 3. 一次性本地任务

以下提示词中的候选目录使用实际下载路径；不得把它解释为已安装新Runner。

```text
当前只执行Coverage重设计的P0只读盘点，不实施修复、不启动goal。
先读取旁路文档候选目录中的LOCAL_HANDOFF.md、README.md、IMPLEMENTATION_PLAN.md的P0和P0_LOCAL_INVENTORY.template.md；来源版本以该目录的下载记录为准。
读取现有 .ai-local/coverage/ 下两个工具及必要私有模块、README、loop/plan/compatibility/机器状态、项目POM、已有effective-pom，以及我提供的真实云端编译日志。只按现有文件和对应版本的执行证据判断，不把聊天READY或未合并设计当现场事实。
按模板填写 .ai-local/coverage/reconstruction/P0_LOCAL_INVENTORY.md。这是本轮唯一允许写入的项目文件。保留现有未提交修改、Active Batch、Baseline和Accepted数据。
禁止运行Maven/测试/Agent/基线/merge/verify/close，也不运行未经源码审计的脚本help/dry-run。不改POM、生产、测试、工具、manifest、现有loop或Authority；不stash/reset/清理/commit/push。
没有版本、日志或effective-pom就写UNKNOWN并说明下一阶段需要的最小探测，不为填字段扩大任务。
返回P0_COMPLETE或P0_PARTIAL、能力映射、最多3项直接风险、最小P1精确文件范围。不要只回READY。原始源码/日志/秘密留本地，只分享去敏摘要。
```

## 4. 用户要提供什么

仅让本地Agent能够读取：实际项目目录，以及已经提到的云端编译日志路径。无需上传源码或日志到公开GitHub，也无需把框架仓库拉入业务项目执行。

若日志就在项目里，可由Agent只读定位并核对版本；无法唯一确定时才报告缺少确切路径，不扩大搜索到其他用户目录。

## 5. P0结束后的决策

| 本地结果 | 下一步 |
| --- | --- |
| 现有环境/工具已有正确能力 | 复用，不重复建设 |
| 明确argLine/插件/超时问题 | 给P1精确配置范围和命令，批准后修 |
| 只有归档/身份/恢复缺口 | 进入相应工具内部最小修复，不顺带重建环境 |
| 云端证据不足 | 云端标NOT_VERIFIED；保留原报告要求 |
| 新CLI/Agent Adapter不存在 | 标MISSING，不能直接启动本文档的loop run |

不会因为一次P0发现未知项就重新设计整套体系。现有代码是映射事实，业务契约和明确权限是变更边界；下一次实施只处理已证明的最小缺口。
