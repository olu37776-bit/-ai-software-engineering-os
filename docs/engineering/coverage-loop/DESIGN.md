# Coverage Loop 设计与局部决策

状态：`DRAFT v1.0`。这是独立覆盖率工具的目标设计，不是本仓库生产框架已实现能力。来源编号见 [ACCEPTANCE_AND_INCIDENTS.md](ACCEPTANCE_AND_INCIDENTS.md)。

## 1. 本次文档 Operation / WRITE_SCOPE

目标：把多轮故障转成稳定测试任务、确定性验收和可恢复循环，降低对执行模型能力的依赖。

本次 GitHub 写入范围仅为 `docs/engineering/coverage-loop/**` 与 `docs/README.md` 导航。禁止修改 packages、apps、schemas、operations、工作流 YAML、主框架 ADR、任何业务 POM 或本地生产源码。这里的局部 ADR 不修改主框架的状态所有权。

已读取仓库的 CONTRIBUTING、文档索引、验证系统设计和进度文件。主框架独立审查/合并规则仍有效。本次设计结果通过文档 PR 交付，回滚只撤销该文档变更；不会替本地改动执行 reset/stash。

## 2. 局部 ADR-CL-01：程序调度，Agent 提供受限判断

**选择**：扩展现有 `test_runner.py` 为确定性控制器；保留 `coverage_report.py` 为唯一覆盖率解析/查询实现。内部可拆私有模块与测试，不把所有逻辑塞进两个巨大文件；不增加第三个面向操作者的竞争入口。

主 Agent只做候选优先级、分析评阅和有限策略裁决。分析、实施、修复、测试断言审查委派给子 Agent。程序负责调用顺序、有效输入、命令、超时、补丁应用、验收、状态发布和下一轮。

这不是要求模型记住七段流程。即使模型返回“完成”或提出跳过阶段，程序仍按真实结果决定下一动作。没有 Agent Adapter、权限隔离和机械门禁时，文档提醒不能被宣称为“无法绕过”。OpenCode 的配置能力需按本地版本核验。[S08][S09]

### 对外入口（拟新增/收敛的契约，不代表当前已可运行）

```text
python .ai-local/coverage/scripts/test_runner.py loop prepare
python .ai-local/coverage/scripts/test_runner.py loop run --max-batches 3
python .ai-local/coverage/scripts/test_runner.py loop status
python .ai-local/coverage/scripts/test_runner.py loop pause
python .ai-local/coverage/scripts/test_runner.py loop finalize
```

`prepare` 校验本地已批准环境与工具能力，不擅自重建 Generation 或修改 POM。首次建立环境/基线属于独立、明确授权的实施任务。

`run` 串行调用已有候选、分析、实现、verify-batch、close-batch，计数与预算由程序实际扣减。`status` 返回短 JSON 和最新 Markdown 入口；`pause` 停止领取新任务并安全中止/收尾所属进程。`finalize` 使用当前测试资产独立生成新鲜全量结果。

原 compile/target/module/coverage/verify-batch/close-batch 作为诊断接口与内部实现保留，不要求主 Agent 每轮串十几个命令。P0 必须建立旧 CLI→目标 CLI 映射；未实现入口一律报告 UNSUPPORTED，不得假装成功。

## 3. 局部 ADR-CL-02：隔离执行，补丁进入工作区前先验权

Coverage 专用 worktree/副本是测试工作区，不与其他会话共享正在变化的 production 输出。创建前记录用户未提交修改；仅从明确的代码快照建立，不自动 stash、reset、清理或恢复用户文件。未提交内容需要纳入快照时使用明确文件清单及哈希复制，不默默从 HEAD 丢弃它。

程序持有该工作区的单写锁。分析和审查 Agent 只读。实施 Agent 在一次 attempt 的隔离副本修改指定测试，返回 diff，不持有主工作区、Coverage Store、POM 或云端部署凭据的写权限。程序校验补丁后才应用到测试工作区。

补丁白名单由程序生成：本次指定测试文件和必要 fixture。拒绝路径逃逸、符号链接/Windows junction 逃逸、大小写路径混淆、src/main 改动、POM/settings 改动、既有测试删除、停用注解、新 exclude/skip、无限制 suppression、状态文件和工具修改。静态扫描只能发现一部分问题，不能代替行为审查。

OpenCode 权限用于减少误操作，但 bash、插件与测试代码本身仍可能写文件，不能当 OS 沙箱。若没有验证过的隔离能力，暂停无人值守，采用只生成补丁、人工审查的受控模式；不以“设了 edit deny”代替隔离验收。

单次最多一个 Maven 构建树和一个实施 Agent。只读候选分析可并行两个，默认不开；并发收益需通过资源实测再启用。程序超时后终止本次所属 Maven/子 JVM，确认清理完成后才能下一轮，不杀其他会话 Java 进程。

## 4. 局部 ADR-CL-03：一个工作包贯穿到底

沿用已有 Batch/GapAnalysisRecord，不另建 Node Registry。P0 确认能否在现有记录中表达下列语义后再选择字段名。

| 记录 | 最少语义 | 写入者 |
| --- | --- | --- |
| WorkItem | batchId、attempt、环境/Generation/当前状态版本、目标、允许改动、before 引用、预算 | 程序；主 Agent 仅建议目标 |
| Analysis | 完整目标身份、真实入口链、关键条件、控制方式、测试层级、预期及来源、场景、可行性、PROCEED/ESCALATE/DEFER | 分析子 Agent 提交，程序落盘 |
| Patch | workItemHash、analysisHash、基准测试文件哈希、改动清单、场景→测试→断言映射 | 实施子 Agent 提交 |
| Verification | 命令/进程结果、实际执行的测试、失败差分、相同目标前后覆盖、补丁哈希、报告/exec 哈希 | 程序 |
| Accepted revision | 已验证补丁、有效数据贡献、结果/文档视图、父版本和提交键 | 程序 |

Method 的身份为 `(module, binaryClassName, methodName, jvmDescriptor)`；module 解决不同模块同包同名类，descriptor 解决重载。源码行区间只是带版本的导航信息，不是稳定身份。已经存在的 class+method+descriptor 能力须扩展模块消歧，但不要抛弃现有记录。

PLAN→ANALYSIS→PATCH→VERIFY→ACCEPT 使用同一 WorkItem 内容哈希和目标身份。目标不一致、源码/依赖前置内容已变、分析缺关键字段或不是 PROCEED，程序不派实施任务。验证阶段再复核一次，不能只在测试写完后才检查有无分析。

“记录完整”只证明分析动作留下了对应产物，不证明分析结论正确。入口/条件必须有代码定位与内容哈希；预期必须有来源；真实执行和断言审查继续负责证伪错误分析。

## 5. 局部 ADR-CL-04：先样板，后扩批；对模型提供解题材料

按用户反馈的执行表现设计，不宣称某模型在客观基准上低能。不要把 Top 30 方法及整本指导书一次交给实施者。

首次遇到测试模式，先分析最多 3 个候选，选 1 个高收益可控目标，建立经过真实执行验证的样板。随后同一 fixture/入口模式可扩为多个相关目标并统一编译，不要求每个类跑一次全量 Maven。起始建议每包 1–3 个方法；稳定样板批量 3–8 个；这是可配置经验起点，不是强制行业标准。

每包提供：目标方法与必要调用方、DTO/依赖签名、当前测试、一个通过验证的同模式样例、已知失败避坑、明确目标行/分支、必需断言清单。禁止把 class 名当业务语义；没有预期来源就不得为“当前返回什么”编造正确性。

模板、短任务卡与示例见 [测试指导书](TEST_AUTHORING_GUIDE.md)。复杂度主要留在工具内部，而不是增加操作者步骤。

## 6. 局部 ADR-CL-05：验收不是只看绿色和 +1 行

每个工作包必须同时通过四项：

1. **范围**：只应用合法测试补丁，未删除/削弱现有测试，无生产配置漂移。
2. **测试健康**：编译成功，声明测试确实运行，报告完整，无新增失败；既有已批准失败仍显式标红记录。
3. **目标收益**：在同一字节码/报告范围下，声明的方法自身改善。不能拿别的方法、另一个 overload 或 class +1 代替。行缺口任务要求方法 missedLines 下降；分支任务可单独记分支收益，但不能充当达到 90% 行覆盖的进度。
4. **断言**：有可解释业务预期，断言覆盖该场景的主要输出/状态/异常。针对高风险样板在隔离副本做少量受控错误变体/PIT 抽查，证明测试能失败；不在工作区改坏生产代码，不要求全仓 Mutation 先达标。[S10]

优先一个 package 一个声明目标，减少门禁争议。多目标包按目标给结论：不以所有目标必须同增量或只要总量>0两种粗暴规则替代。允许只接受可分离、独立验证的有效子补丁；无法分离则整包返修。延期目标不能记完成，不能降低总体分母。

只读审查者可以使用同一外部模型配置，但角色隔离不等于拥有更强推理或已完成独立质量保证。机械证据和后续抽查不能省。

## 7. 局部 ADR-CL-06：一个提交事实，Markdown 是视图

复用当前 Execution Store，新增能力优先是内部实现。每次发布先准备不可变 revision 目录：manifest、报告及哈希、机器状态、批次记录、Markdown 渲染结果。校验全体后，在单写锁下以 compare-and-swap 语义替换一个 `current.json` 指针；它是唯一发布点。

多个 Markdown/manifest 文件不能因为逐个 rename 就被称为“多文件原子事务”。需要落盘 flush、同文件系统替换、Windows 锁占用失败处理和断电/进程终止测试。顶层旧 Markdown 是兼容视图，每份带 revisionId；刷新失败可从 current 指针幂等重建，不能再次接受 exec。

幂等键为 batchId+attempt+请求内容哈希。同键同内容重试返回已提交结果；同键不同内容拒绝。崩溃于提交前，只恢复未发布 attempt；崩溃于指针切换后，只补视图。新版本保留旧 snapshot，不能每轮重新覆盖唯一 XML。

仅修改 `manifest.accepted=true` 而未形成完整 revision 不能通过。恢复时核对 accepted 清单、文件哈希、对应 verify、解析器版本和报告；未知损坏暂停，不手工补数字解阻。

## 8. 局部 ADR-CL-07：累计搜索值不等于当前全套测试证明

`ACCUMULATED_SEARCH` 用于定位尚未命中路径、比较已接受尝试；`FRESH_FULL` 才证明当前完整测试资产的覆盖率。此修正替代历史聊天中把累计值永久称为最终权威的做法。

同 class bytes 只证明 exec 的字节码关联兼容，不证明旧测试、旧 fixture、旧依赖在今天仍有效。修改/删除曾产生贡献的测试及共享 fixture，或测试环境变化时，必须失效受影响搜索贡献；不能精确归属时重新跑新鲜全量，不靠 OR 永久保留旧绿行。具体规则见 [环境与度量](ENVIRONMENT_AND_COVERAGE.md)。

终点：新鲜完整执行通过、无未处理测试失败、当前 report-level LINE counter 达标、资产/范围无作弊、必要隔离与恢复验收通过。不能用“累计已到 90%”关闭目标。

## 9. 有限重试和异常路由

默认每目标初次实现后最多两次修复；相同 zero-gain 原因最多一次修正再延期。参数由本地策略锁定，Agent无权自己增加。修复限额耗尽→保存候选补丁与诊断→撤销仅本次拥有的未接受改动→下一独立目标；不是删除任何既有测试。

`PASS / NEEDS_REPAIR / BLOCKED` 沿用现有验证结果。程序主循环仅需 RUNNING/PAUSED/COMPLETE，原因放 reason，不再叠很多状态机。

源码/构建身份变化、环境 OOM/超时后进程未清、报告无效、状态损坏、触及保护文件或总预算耗尽→PAUSED。单个目标不可达/业务预期不明→延期并选择其他可行目标；全体候选均不可行则暂停且给出阻塞清单，不能永远循环。

历史编译失败进入独立受限测试修复，不与当前目标混合；修复前需恢复被误删文件的可证明版本。没有历史内容证据不能盲目 checkout HEAD 覆盖本地修改。

## 10. 退出与完成

`/goal` 等插件仅调用 `loop run/status`，不能自行调用 accept、改基线或标记 COMPLETE。当前上游 Goal 文档中迭代配置与实际钩子约束有差异，因此批次数、墙钟、命令超时及模型调用预算必须在 Runner 强制，而非相信配置字段名。[S09]

实现与验收按 [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) 分阶段执行。任何步骤的文档 READY 都不自动提升本地运行状态。