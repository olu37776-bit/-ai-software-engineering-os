# P0 本地盘点回执模板

复制填写到 `.ai-local/coverage/reconstruction/P0_LOCAL_INVENTORY.md`。本模板不是环境验收报告；UNKNOWN可以保留，不为填满字段修改或执行项目。

## 1. 状态与材料版本

- Result: P0_COMPLETE / P0_PARTIAL
- Runtime readiness: NOT_ASSESSED
- Authority source repository/commit:
- Read-only candidate directory:
- Local code revision/content snapshot reference:
- Uncommitted changes present: YES / NO / UNKNOWN（不stash/清理）
- Active Coverage Batch: 标识/阶段/状态文件，或NONE/UNKNOWN
- Existing files preserved: YES / NO

## 2. 现有能力映射

状态只能用 EXISTING_VALIDATED / EXISTS_UNVERIFIED / MISSING / CONFLICT。VALIDATED必须有对应版本的可读取执行证据，不接受聊天READY。

| 能力 | 实际文件:函数/行号 | 实际CLI/输入 | 机器输出与状态路径 | 状态 | 证据引用或缺口 |
| --- | --- | --- | --- | --- | --- |
| Report根counter解析 | | | | | |
| Method与descriptor/module身份 | | | | | |
| 行区间可信级别 | | | | | |
| GapAnalysis及实施前门禁 | | | | | |
| verify-batch与测试发现/失败处理 | | | | | |
| close-batch/accepted写回 | | | | | |
| Generation/构建时点/指纹 | | | | | |
| Baseline/Pending/Accepted/merge | | | | | |
| 新鲜完整执行及测试资产失效 | | | | | |
| 超时取消/所属进程清理 | | | | | |
| 单写锁/恢复/幂等 | | | | | |
| OpenCode真实子Agent调用接口 | | | | | |

## 3. 本地与云端实际路径

| 项目 | 本地Coverage | 云端现有流水线 |
| --- | --- | --- |
| 实际命令及来源 | | |
| 代码/POM版本与日志是否对应 | | |
| 有效profiles/settings来源（不抄秘密） | | |
| JaCoCo角色/版本 | | |
| dt4j角色/版本 | | |
| devtestcov角色/版本 | | |
| argLine写入者→消费者 | | |
| exec产生者/输出路径 | | |
| 最终报告产生者/平台后处理 | | |
| 原有报告要求是否必须保留 | | |
| OOM类型/进程/阶段证据 | | |
| 未确认项 | | |

云端原始日志只留本地。不同版本的日志标HISTORICAL，不能据此断言当前修复成功。没有effective-pom就写缺失，P0不执行Maven生成它。

## 4. 当前Coverage可信度

| 项目 | ACCUMULATED_SEARCH | FRESH_FULL |
| --- | --- | --- |
| 报告路径/本地hash/时间 | | |
| build/scope/testAsset关联 | | |
| covered/missed/total及指标 | | |
| 来源run与实际测试清单 | | |
| 是否仍对应当前测试资产 | | |
| 缺失证据 | | |

当前系统没有上述分类时，不改现有数据格式；记录实际语义及需要迁移的最小位置。不同世代/口径不计算delta。

## 5. 保护范围和直接风险

- Coverage工作区是否与其他会话共享：
- 现有未接受/手工修复状态是否需要保留：
- 资源预算/并发/取消配置的已有证据：
- 禁止变更：src/main、POM、工具、manifest、既有测试、Git写操作、部署动作。
- 直接风险1（证据→影响）：
- 直接风险2（证据→影响）：
- 直接风险3（证据→影响）：

## 6. 最小P1建议

- 需要保留复用的现有能力：
- 精确拟修改文件列表及每个修改理由：
- 拟执行的探测/Canary命令和预期输出（本轮不执行）：
- 本地可验证项/必须云端验证项：
- 所需用户决定（仅无法从已有资料解决的事项）：
- 未执行项及原因：

## 7. 返回边界

回执填写完成≠Runner实现或环境READY。只返回去敏摘要：能力状态、最多3项直接风险、精确P1范围与缺少证据。

不要上传公司源码、原始云端日志、settings.xml、凭据、设备数据、exec/class或完整内部路径清单。证据详细内容继续留在本地。
