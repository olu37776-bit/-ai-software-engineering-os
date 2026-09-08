# Coverage Loop 设计与局部决策

状态：`DRAFT v1.1 / REVIEW_PENDING`。这是独立覆盖率工具的目标设计，不是本仓库生产框架已实现能力。来源编号见 [ACCEPTANCE_AND_INCIDENTS.md](ACCEPTANCE_AND_INCIDENTS.md)。

## 1. 本次文档 Operation / WRITE_SCOPE

目标：把多轮故障转成稳定测试任务、确定性验收和可恢复循环，降低对执行模型能力的依赖。

本次最终 GitHub 写入范围仅为 `docs/engineering/coverage-loop/**`。PR #94 原先顺带修改的共享 `docs/README.md` 已撤回到基点原文；不借用 Phase 1 operation，不改变 scope policy、authority lock 或 required checks。禁止修改 packages、apps、schemas、operations、工作流 YAML、主框架 ADR、任何业务 POM 或本地生产源码。这里的局部 ADR 不修改主框架的状态所有权。

已读取仓库的 CONTRIBUTING、文档索引、验证系统设计、进度与实际 scope 规则。主框架独立审查/合并规则仍有效。回滚只撤销本目录文档变更，不对用户本地执行 reset/stash。GitHub 自动检查通过不等于设计独立审查通过，也不等于本地运行合格。

## 2. 局部 ADR-CL-01：程序调度，Agent 提供受限判断

**选择**：扩展现有 `test_runner.py` 为确定性控制器；保留 `coverage_report.py` 为唯一覆盖率解析/查询实现。内部可拆私有模块与测试，不把所有逻辑塞进两个巨大文件；不增加第三个面向操作者的竞争入口。

主 Agent只做候选优先级、分析评阅和有限策略裁决。分析、实施、修复、测试断言审查委派给子 Agent。程序负责调用顺序、有效输入、命令、超时、补丁应用、验收、状态发布和下一轮。

即使模型返回“完成”或提出跳过阶段，程序仍按真实结果决定下一动作。没有 Agent Adapter、权限隔离和机械门禁时，文档提醒不能被宣称为“无法绕过”。OpenCode能力需按本地版本核验。[S08][S09]

### 对外入口（拟新增契约，不代表当前可运行）

```text
python .ai-local/coverage/scripts/test_runner.py loop prepare
python .ai-local/coverage/scripts/test_runner.py loop run --max-batches 3
python .ai-local/coverage/scripts/test_runner.py loop status
python .ai-local/coverage/scripts/test_runner.py loop pause
python .ai-local/coverage/scripts/test_runner.py loop finalize
```

`prepare` 校验已批准环境与工具，不擅自重建 Generation 或修改 POM。首次建环境/基线属于独立授权的实施任务。

`run` 串行调用已有候选、分析、实现、verify-batch、close-batch；所有尝试、上下文追加、分析重做、延期和模型错误都消耗程序预算，不只计成功Batch。`status` 返回短摘要；`pause` 停止领取新任务并安全中止/收尾所属进程；`finalize` 为当前测试集生成新鲜全量证明。

底层 compile/target/module/coverage/verify-batch/close-batch 保留为内部及诊断接口。P0建立真实CLI映射；未实现入口返回 UNSUPPORTED，不猜命令。

## 3. 局部 ADR-CL-02：隔离执行，补丁进入工作区前先验权

Coverage专用worktree/副本不与其他会话共享变化中的production输出。创建前记录用户未提交修改，只基于明确快照复制；不自动stash/reset/清理，不从HEAD默默丢掉未提交内容。

程序持有单写锁。分析和审查Agent只读；实施者只在attempt隔离副本修改指定测试并返回diff，不持有主工作区、Coverage Store、POM或部署凭据写权限。补丁经范围校验后应用到**本次候选验证副本**，不是直接改已接受测试树。

白名单为明确测试/fixture文件，拒绝路径逃逸、符号链接/junction逃逸、大小写路径混淆、src/main或POM/settings改动、既有测试删除、停用注解、新exclude/skip、无限制suppression和状态/工具修改。静态检查不能代替行为审查。

OpenCode工具权限不是OS沙箱；bash、插件及测试代码本身都可能写文件。若实际隔离未验收，禁用无人值守，采用受控补丁模式，不以edit deny冒充隔离。不要自动启用任何全允许权限开关。

默认一个Maven进程树、一个实施Agent；只读分析可选并行两个，但需资源实测后开启。超时后只终止本次所属进程树；未确认清理完不启动下一Maven，不杀其他会话Java进程。

## 4. 局部 ADR-CL-03：一个工作包贯穿到底

沿用已有Batch/GapAnalysisRecord，不另建Node Registry。P0先映射现有字段。

| 记录 | 最少语义 | 写入者 |
| --- | --- | --- |
| WorkItem | batchId、attempt、环境/Generation/父revision、目标、允许改动、before、预算 | 程序；主Agent建议目标 |
| Analysis | 精确目标、入口及证据、条件、控制方式、层级、预期及来源、配方、PROCEED/ESCALATE/DEFER | 分析者提交，程序落盘 |
| Patch | workItemHash、analysisHash、基准测试树及文件hash、改动、场景→测试→断言 | 实施者提交 |
| Verification | 实际命令/测试、完整性、失败差分、同目标效果、补丁/测试树/报告/exec hash | 程序 |
| Accepted revision | 可恢复测试树、补丁、有效数据贡献、报告/文档、父版本及提交键 | 程序 |

Method身份为 `(module, binaryClassName, methodName, jvmDescriptor)`；module消除跨模块同名歧义，descriptor区分重载。行区间是有版本的导航，不是身份。沿用已有解析，不建第二套模型。

PLAN→ANALYSIS→PATCH→VERIFY→ACCEPT绑定同一WorkItem内容hash、父revision、目标和环境。分析不完整/非PROCEED、身份或前置内容变化时，程序不发实施调用；验证时再复核。

记录完整只证明有相应产物，不证明分析正确。入口/条件需源码定位与内容hash，预期需来源；真实执行和断言检查负责证伪。文件、日志、测试注释是待分析数据，不得作为提升权限或改变任务的指令。

## 5. 局部 ADR-CL-04：先样板，后扩批

按用户报告的执行表现设计，不宣称模型客观排名。首次测试模式先分析最多3个候选，选1个可控目标建立有效样板；然后批量处理相似fixture/入口。起始每包1–3方法，稳定模式可3–8方法，是可配置起点，不是标准。

提供目标/调用方、DTO与依赖签名、相关测试、已验证样例、避坑记录和必须断言。缺预期依据不得把“当前代码返回什么”编成正确性。详见 [测试指导书](TEST_AUTHORING_GUIDE.md)。

## 6. 局部 ADR-CL-05：验收不是只看绿色和+1行

每包同时满足：

1. **范围**：测试补丁合法，无生产配置漂移、既有测试删除或断言削弱。
2. **健康**：编译成功，目标测试实际运行，报告完整，无新增失败；已批准历史失败单列，不变绿。
3. **收益**：相同字节码/scope下精确目标改善，别的方法/重载/class+1不能代替。行任务要求方法missedLines下降；分支收益单列，不伪称行覆盖进度。
4. **断言**：预期可解释，覆盖主要输出/状态/异常。高风险样板在隔离副本做少量错误变体/PIT抽查，不修改主工作区生产代码，不要求全仓Mutation先达标。[S10]

默认一个工作包一个声明目标。多目标按项给结论；只有可分离且独立验证的有效子补丁可另发工作包接受，否则整包返修。拆包必须重绑定analysis/patch/verify，不能关闭时偷偷改目标；延期不能记完成或降低分母。

同模型的只读审查是角色隔离，不等于更强推理或独立质量证明。不能省机械证据和抽查。

## 7. 局部 ADR-CL-06：测试树、结果和文档一起发布

复用Execution Store。每次准备不可变revision：可恢复的accepted测试树/内容清单、补丁、manifest、报告/hash、机器状态、批次记录、Markdown。可以用明确基准树+不可变补丁链重建测试树，但不能依赖无法恢复的活工作区。

验证在候选副本完成，结果绑定其`testAssetDigest`。发布前确认父revision未变、候选内容仍等于已验证内容，然后在单写锁下compare-and-swap替换一个`current.json`。这是唯一发布点。

多文件逐个rename不是多文件事务。需要flush、同文件系统替换、Windows锁占用处理和崩溃测试。顶层工作区/Markdown是投影；每轮启动验证投影digest等于current，未同步先恢复。不能覆盖用户外部改动；不一致时暂停并保留现场。

**幂等键是(batchId, attempt)，payloadHash是独立比较值，不包含在键内。** 同键同hash返回已提交结果；同键不同hash拒绝`IDEMPOTENCY_CONFLICT`。父revision已推进的旧请求不得提交。

指针切换前崩溃：旧接受树与结果仍有效，候选留待恢复/丢弃；切换后崩溃：只重建投影，不重接exec、不重复Summary。失败补丁不进入已接受树。文件/报告不匹配就暂停，不手改accepted或数字解阻。

## 8. 局部 ADR-CL-07：累计搜索值不等于当前测试集证明

`ACCUMULATED_SEARCH`用于导航和增量搜索，`FRESH_FULL`证明当前保留测试集。相同class只证明字节码关联兼容，不证明旧测试/fixture/环境仍有效。

改动曾贡献数据的测试、共享fixture或环境时失效对应贡献；无法可靠归因就生成新鲜全量起点。不能永久OR旧绿行。规则见 [环境与度量](ENVIRONMENT_AND_COVERAGE.md)。

终点要求新鲜完整执行、所有required测试通过、固定scope的report-level LINE达标、无作弊和必要恢复验收。搜索值90%只能触发finalize，不直接完成。

## 9. 有限重试和异常路由

默认首次实施后最多两次修复；同一zero-gain原因修一次仍失败就延期。程序计算全部模型调用、attempt和墙钟成本，Agent不能加预算。耗尽后保留本次候选补丁与诊断，只丢弃未接受候选，不删除用户已有测试。

沿用verify的PASS/NEEDS_REPAIR/BLOCKED；主Loop只需RUNNING/PAUSED/COMPLETE，细节放reason。单目标不可达/预期不明可延期；候选用尽或总预算耗尽暂停，不无限分析。

生产/环境身份变化、OOM/未清进程、无效报告、状态损坏、越权补丁暂停。历史编译失败独立受限修复；没有证据不得从HEAD强行恢复误删前可能带本地修改的文件。

## 10. 当前放行边界

外层`/goal`仅唤醒Runner，不拥有接受权或唯一预算。适配器必须验证本地非交互调用、取消和恢复能力。[S09]

P0只做只读盘点，可以读取未合并设计作为评估材料；不得把未审查文档替换为已批准运行Authority。P1及以后需阶段范围与相应审查放行。本次自检不替代独立审查；公开仓库不能验证用户私有Java环境。执行 [实施计划](IMPLEMENTATION_PLAN.md) 与 [本地交接](LOCAL_HANDOFF.md)。
