# Coverage Loop 分阶段实施与本地交接

状态：`DRAFT v1.0`。当前交付是文档，不是本地实现。每阶段完成代码/测试时同步该阶段本地实现记录；实现者不自行标记独立 VERIFIED。

## 1. 先盘点，禁止照历史聊天重建

本地已有工具和数据必须复用：`.ai-local/coverage/scripts/test_runner.py`、`coverage_report.py`、loop/plan/compatibility、Baseline/Pending/Accepted/manifest。我们没有读取其源码，函数名、签名和状态字段以P0为准。

旧东西不是全部废弃：保留正确parser、精确Method身份、failure解析、命令执行、不可变exec、merge和close逻辑；修接口与证据缺口。不要为让新文档正确而创建第二套并行Runner。

现有本地结果不被重写成本文档的示例数字。旧XML/fingerprint缺失的历史保留为不可比，不继续强行“查出唯一历史根因”。

## 2. GitHub→本地安装边界

只下载本目录的文档，不需要上传公司源码/日志，也不需要下载并运行本仓库整个TypeScript框架。锁定一个经过确认的文档commit，记录来源仓库、commit、文件清单和哈希。

目标路径 `.ai-local/coverage/authority/`；先下载到旁路版本目录，确认链接和内容完整后切换。执行期间不自动更新Authority。清除旧版本不是安装步骤。

现有 `.ai-local/coverage/loop_process.md` 只在P4完成切换时改为短入口，引用锁定Authority；旧方法论重复内容保留历史但标记不再控制。现有状态Markdown仍由工具生成。下载设计≠迁移完成≠能直接运行新CLI。

## 3. P0 — 现场能力与命令认证（现在唯一该执行的任务）

WRITE_SCOPE：仅 `.ai-local/coverage/reconstruction/P0_LOCAL_INVENTORY.md` 和必要去敏证据索引。原始日志/配置仅本地保存。禁止改POM、工具、业务/测试代码、manifest、active generation，不运行Coverage批次，不清理/stash工作区。

读取：现有两个脚本和README、三个状态文档、loop/指导书/compatibility、当前各POM、云端日志和仓库内流水线命令；检查 `git status`，只运行已有安全help/dry-run能力。effective-pom按与日志相同的profiles/settings/版本获取，不能默认本地effective-pom等于云端。

输出必须一页概况加证据索引：

- 实际CLI与函数能力表：解析、methods/descriptor、analysis、verify、close、Generation、merge、超时、失败XML、accepted提交；每项 EXISTING_VALIDATED / EXISTS_UNVERIFIED / MISSING / CONFLICT。
- 本地Coverage命令、云端真实命令、最终报告生成者、有效Agent参数、三个插件的角色；不确定项明确UNKNOWN。
- 最近新鲜Coverage与累计Coverage各自来源/范围/时间/哈希，不能只写一个百分比。
- 现有工作区/共享修改/进程/内存限制、当前代码快照和可安全复制范围。
- 下一阶段**具体文件**WRITE_SCOPE；哪些旧能力复用、哪些需补，不写“重建整个系统”。

验收：当前接口和证据缺口明确，能选出最小P1改动。缺云端日志只标云端未验证，不伪造角色；P0可以完成盘点，但不能因此解除云端验收要求。

### 可直接交给本地Agent的P0短任务

```text
读取 .ai-local/coverage/authority/README.md 和 IMPLEMENTATION_PLAN.md，只执行P0。
核对现有两个Coverage脚本、loop/状态、POM和我提供的真实云端日志，建立能力与命令映射。
优先复用已存在能力，严格区分已运行证据、代码存在与未知，不照聊天假定READY。
只写 .ai-local/coverage/reconstruction/P0_LOCAL_INVENTORY.md 及本地去敏证据索引。
不要改POM/生产/测试/工具/manifest，不stash或清理，不启动goal，不上传公司文件。
完成后返回已确认能力、直接风险、最小P1文件范围与待确认项；不要自行进入P1。
```

## 4. P1 — 稳定环境与单执行入口

前提：P0完成；环境变更的具体POM/profile/脚本范围已明确批准。不能以本文档笼统授权改云端。

WRITE_SCOPE：P0列出的测试专用配置、现有runner内部执行适配和脚本测试；src/main、部署凭据、生产业务行为禁止。云端配置有必要改动时独立审核。

工作：建立Coverage专用worktree/副本、资源预算和进程树控制；固定本地采集与云端既有报告两条命令；修正argLine参数组合；使用已有canary证明真实目标代码运行且exec/报告有对应数据；认证clean→构建Freeze Point→指纹检查顺序。

验收：无生产修改；本地Agent参数/exec有效；无重复Owner；OOM按真实进程/内存定位；云端原有报告不被去掉。每条路径只做一次必要真实验证，不重复十遍完整Maven。无云端执行证据只能LOCAL_VALIDATED，不能宣称云端故障已消失。

产物：`.ai-local/coverage/reconstruction/P1_ENVIRONMENT_ACCEPTANCE.md`，更新现有compatibility及明确的环境锁定记录。没有新的竞争环境文档。

## 5. P2 — 度量、目标身份与崩溃安全提交

WRITE_SCOPE：现有两个工具的内部模块、现有机器状态schema的受控迁移、工具测试；不改业务测试/生产源码/云端配置。

工作：

- 固化module+class+method+descriptor身份，区分METHOD_EXACT与LINE_HINT，不强制伪EXACT。
- parser使用report直接counter，保存scope/build/test/context/report哈希，反驳错误class求和假设。
- 累计结果标ACCUMULATED_SEARCH；新鲜全量快照FRESH_FULL；测试/fixture改变时失效相关贡献。
- verify检查实际测试发现、报告完整性和精确目标，knownFailures不再单独决定PASS。
- 复用现有close，改为不可变revision+唯一current指针提交；Markdown可重建，重复close幂等。
- 旧manifest兼容性采用显式离线迁移+保留备份；版本不认识就拒绝，不自动改accepted/FP修通过。

验收：ACCEPTANCE_AND_INCIDENTS中度量、merge、false-PASS、提交/恢复相关用例通过；清楚注明哪些为fixture、哪些是本地实际命令。强制验收删除/修改测试后旧exec不能支持最终90%。

产物：`.ai-local/coverage/reconstruction/P2_DATA_ACCEPTANCE.md` 与机器可重放测试结果。更新现有README/状态，非重复新脚本。

## 6. P3 — Agent Adapter、任务卡与真实样板

WRITE_SCOPE：runner的Agent调用/权限适配、已批准OpenCode局部配置、工作包模板、工具测试、隔离的样板测试；主生产代码和企业流水线禁止。

Adapter必须证明：真实调用本地已装OpenCode版本；选择配置好的角色；传入工作包；取得实际子会话/结果；超时可取消；不会无声切回主Agent自己写；子任务不能递归启动Loop。不根据公共最新文档猜用户安装版本。

没有可稳定调用/取消的非交互能力时，先交付明确的人工驱动模式，不宣称长时间无人值守可用。适配器可复用现有插件/MCP接口；不得为了“机械保证”只新增几句Prompt。

先建设三个代表样板中的适用部分：纯函数/转换、非空解析或循环、真实Service+边界stub。只要项目实际存在对应场景；不为凑样板引入不存在的业务。每个样板验证入口、目标Coverage和至少一个有效反例/错误变体；结论保留本地。

验收：缺Analysis实施调用根本未发出；换Target/descriptor/hash被拒；故意要求改POM/删既有测试的补丁被拒；未运行测试/假READY不通过；一个真实Gap能通过真实入口产生有效断言和目标收益。

产物：`.ai-local/coverage/reconstruction/P3_AGENT_ACCEPTANCE.md` 与本地已验证样板索引。角色卡沿用TEST_AUTHORING_GUIDE，不另写第二本。

## 7. P4 — 一次有限串联验收，然后正常推进

WRITE_SCOPE：允许的目标测试/fixture、现有本地状态及P4验收记录；禁止在循环里顺手修工具/POM。

程序执行最多3个真实批次，其中至少有一次可控失败回放/重试测试与一次重启恢复检查；身份/提交故障可用fixture，不需要在业务代码故意制造危险错误。

确认：分析确实先发生、只接受合法测试补丁、目标方法真改善、merge不丢数据、close无半提交、命令超时不遗留进程、文档从current可恢复。运行一个新鲜全量checkpoint，证明累计搜索的改善在当前测试集可重现。

完成后一次性切换本地旧loop入口，保留必要历史；不要反复“再跑一轮READY、再改一遍文档”制造无限基建循环。非阻塞改进进入待办，不拖住已满足放行门禁的测试推进。

产物：`.ai-local/coverage/reconstruction/P4_LOOP_ACCEPTANCE.md`。独立审查通过后才允许无人工逐批确认的长期run。

## 8. 长期运行与终点

程序根据实际资源预算run，不靠Prompt保证无限运行；达预算保存PAUSED，下次恢复同一事务而不是重建基线。新目标来自当前有效搜索/新鲜缺口，持续根据失败反馈更新本地样板，不能自动弱化规范。

达到搜索90%或到checkpoint时，按ENVIRONMENT执行新鲜完整测试。只有FRESH_FULL≥90%、required tests全部通过、scope锁定、无未解释skip/报告缺失、样板最低质量已验收，才COMPLETE。

云端验证不要求每个本地批次运行，但正式交接必须保持云端原有覆盖率报告和测试流程。若云端和本地指标不同，报告各自范围与值，不宣称本地90%等于云端90%。

## 9. 验收报告最小格式

每阶段统一记录：实施版本/补丁hash、WRITE_SCOPE、实际命令、环境、测试案例ID、预期/实际、证据路径/哈希、未执行项、剩余阻塞、独立审查状态。READY不能代替这些字段。

证据不到位时分开写 IMPLEMENTED / FIXTURE_PASSED / LOCAL_PASSED / CLOUD_NOT_RUN / REVIEW_PENDING，不把它们混成一个总READY。已经批准的低风险未知项不会阻止完成盘点，但会限制之后的运行声明。

## 10. 本地文档维护

Authority文件由GitHub版本管理，本地只读。工具负责当前Coverage/执行事实，Agent只提交策略语义和目标分析。程序按一个revision生成Progress/Roadmap/Summary；补视图不等于重做业务动作。

发现本文档与本地真实接口冲突，记录准确文件/函数/结果，提出最小差异修订；不要让Agent凭聊天覆盖Authority，也不要让Authority强迫正确现有工具退化。