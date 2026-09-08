# Coverage Loop 分阶段实施与本地交接

状态：`DRAFT v1.1 / REVIEW_PENDING`。当前交付为设计和实施指导，不是新Runner。实现者只声明IMPLEMENTED；独立审查与本地实测分别记录。

## 1. 实施原则

先复用本地 `test_runner.py`、`coverage_report.py`、现有Batch/Analysis/manifest/Execution Store，不按聊天中的READY推定代码已验证，不另建竞争工具。旧正确能力保留；先验证替代与引用迁移，再退役重复入口。

GitHub上可完成设计审查、文档/交接一致性检查；本地真实POM、云端日志、Python接口、测试数据和Agent调用能力只能在现场核对。缺失历史证据标UNKNOWN，不无限追溯29982/31347等旧数字，也不伪造当前基线。

P0允许读未合并文档作为评估材料，不把它激活为运行Authority。P1及以后依赖具体范围批准和相应审查，不因本PR文档完成自动放行。

## 2. GitHub到本地

按固定commit下载本目录到旁路目录，如 `.ai-local/coverage/reconstruction/authority-candidate/`；保留来源commit、文件清单/hash，先不覆盖现有authority、loop、plan和状态。

只复制此目录，不安装本仓库TypeScript框架。公司源码、日志、settings.xml、令牌、设备数据、exec/class留本地；只返回可去敏的事实摘要。

P4验收后才切换 `.ai-local/coverage/authority/`，将旧loop改为短入口，将旧测试计划保留为项目业务补充。不同版本不在执行中自动替换。

完整启动任务与回执模板见 [LOCAL_HANDOFF.md](LOCAL_HANDOFF.md) 和 [P0_LOCAL_INVENTORY.template.md](P0_LOCAL_INVENTORY.template.md)。

## 3. P0 — 现场只读盘点：当前唯一要执行的本地任务

WRITE_SCOPE仅：`.ai-local/coverage/reconstruction/P0_LOCAL_INVENTORY.md`。必要证据索引写在该文件内，不复制/上传原始秘密。旁路文档下载不激活为Authority。

读取现有两个脚本/私有模块与README、loop/plan/compatibility/状态、POM、已有effective-pom、用户指定的云端日志及仓库流水线命令。先核对内容版本，不能拿旧日志证明新配置。

可用文件读取、哈希和只读Git状态。**不执行Maven、Java测试、Agent调用、基线/merge/verify/close、未经审计脚本的help/dry-run、Git写操作或网络配置变更。** 获取不到版本/有效配置就UNKNOWN，执行探测留P1。

按模板输出：

- 实际CLI/函数/状态路径与源码位置：parser、精确Method、analysis、verify、close、Generation、merge、timeout、失败XML、accepted提交。
- 每项标EXISTS_UNVERIFIED、EXISTING_VALIDATED（附本地证据）、MISSING或CONFLICT。
- 本地/云端实际命令、采集和报告owner、argLine来源；未证实部分不猜。
- 当前新鲜/累计Coverage来源、scope、时间/hash及active batch；历史READY不等于目前可恢复。
- 单写隔离/进程/资源配置、保护范围、未提交修改；只描述，不stash或恢复。
- 最多3个直接风险和最小P1**精确文件**WRITE_SCOPE，哪些保留、哪些需要修改。

完成盘点可以`P0_COMPLETE`，但不表示测试环境READY。云端日志/有效POM缺失作为后续验证限制；不要为了凑字段改工具或重跑基线。

## 4. P1 — 环境与命令认证

前提：P0范围明确批准，设计审查要求满足。WRITE_SCOPE是P0列出的测试专用配置、runner执行适配及脚本测试；禁止src/main/部署凭据/生产业务改动，云端配置改动独立审核。

建立受控Coverage副本、进程预算和单写者；认证本地JaCoCo采集与云端既有报告链。核对argLine组合、fork数据路径及clean→Freeze Point→指纹顺序。版本查询、effective-pom、资源实测和Canary在本阶段受控执行，不能提前塞回只读P0。

每条必要路径做一次真实验证，记录命令/环境/结果，不重复十遍全量Maven。云端未执行则CLOUD_NOT_RUN，不以本地通过宣称云端OOM消失。

产物：`.ai-local/coverage/reconstruction/P1_ENVIRONMENT_ACCEPTANCE.md`，同步现有compatibility和环境锁定记录。

## 5. P2 — 度量、目标身份与提交恢复

WRITE_SCOPE为现有工具内部模块、受控状态迁移和工具测试；不改业务测试/生产/云端配置。

落实：精确module/class/method/descriptor、METHOD_EXACT与LINE_HINT；report直接counter与build/scope/test/report hash；ACCUMULATED_SEARCH和FRESH_FULL分离、旧测试贡献失效；测试发现/完整性门禁；accepted测试树与结果通过不可变revision+单current指针提交。

幂等键(batchId,attempt)与payloadHash分离，同键换内容拒绝。恢复同时校验测试树与结果，不能只恢复manifest而留下另一份已修改测试文件。

旧manifest迁移保留历史；未知版本拒绝，不手改accepted/FP。验收矩阵对应用例须可重放；fixture通过不替代现场命令证明。

产物：`.ai-local/coverage/reconstruction/P2_DATA_ACCEPTANCE.md`，工具测试结果及现有README更新。

## 6. P3 — Agent适配与有效样板

WRITE_SCOPE为runner的本地Agent/权限适配、获准OpenCode局部配置、任务模板、工具测试和隔离样板测试。禁止生产与企业流水线修改。

认证本地实际版本的非交互调用、角色、工作包传递、结果/子会话证据、超时取消、无递归Loop；不得照最新文档假定用户版本支持。缺可验证适配时只交付人工驱动补丁模式，不称无人值守。

Analysis先于Implementation由程序发出两个调用；无合法分析时实施调用次数必须为0。Context Pack给真实入口、签名、fixture、预期来源和已验证样板，不把大目标丢给弱执行模型。

根据项目实际建立纯转换/函数、非空解析/循环、真实Service+边界stub中的适用样板；每个验证真实目标收益和断言反例，样板源码留本地。

产物：`.ai-local/coverage/reconstruction/P3_AGENT_ACCEPTANCE.md` 与本地样板索引；不再写第二份角色规范。

## 7. P4 — 有限串联验收与切换

WRITE_SCOPE为明确目标测试/fixture、本地状态和P4记录；Loop中不顺手修工具/POM。

最多3个真实批次，一次新鲜全量checkpoint，一次冷恢复。故障注入可在fixture验证，不在业务生产代码故意制造错误。确认分析、身份、断言、merge、提交、超时清理和状态视图全链有效。

通过后一次性切换本地Authority与旧loop入口。不要无故重复“再跑一轮READY、再改文档”的基建循环；非阻塞优化进入待办。

产物：`.ai-local/coverage/reconstruction/P4_LOOP_ACCEPTANCE.md`。独立审查和必要本地验收通过后，才运行无人值守loop。

## 8. 长期运行与终点

Runner强制总时限、尝试/模型预算和成功批次上限；触发预算则PAUSED并可从磁盘恢复。不能只计算成功批次而允许无限分析/延期。

搜索90%触发finalize，使用当前accepted测试树完整新鲜执行；全部required tests通过、scope不变、无未解释skip/报告缺失且LINE≥90%，才COMPLETE。测试资产变化使新鲜结果过期，不用旧exec补绿。

云端无需每批执行，但正式交接必须保留原报告/测试要求。本地与云端指标分别说明，不能承诺百分比自动相等。

## 9. 状态词与回执

分开记录IMPLEMENTED、FIXTURE_PASSED、LOCAL_PASSED、CLOUD_NOT_RUN、REVIEW_PENDING；不能全写一个READY。

每阶段记录版本/补丁hash、WRITE_SCOPE、命令/环境、测试ID、预期/实际、证据路径/hash、未执行项、剩余阻塞和独立审查状态。Authority来自锁定GitHub版本，本地机器事实来自工具，Agent只提交分析与策略语义。

发现真实接口冲突时提出精确差异与最小修订；既不让聊天覆盖Authority，也不为迁就旧文档把正确工具改坏。
