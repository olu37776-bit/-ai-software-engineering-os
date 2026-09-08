# 稳定测试环境与覆盖率度量契约

状态：`DRAFT v1.0`。本文件规范目标行为；本地实际版本、POM、插件协作关系必须由实施计划 P0 核验。来源 [S01]–[S12] 见 [故障与验收](ACCEPTANCE_AND_INCIDENTS.md)。

## 1. 两条必须保留的运行路径，不强行套三个 Profile

**本地 Coverage**：为测试资产建设提供可重复 JaCoCo 执行、目标方法反馈和最终全量证明。**云端现有流水线**：继续生成原有覆盖率报告并保留测试/发布要求。普通本地无 Coverage 模式可选，不为凑三模式强行增加配置。

POM 有三个插件不证明它们重复插桩，更不证明 OOM 就由三者导致。必须在同一个代码版本、命令、active profiles、settings/父 POM 和环境下关联实际日志、effective-pom、最终测试 JVM 参数、报告文件及上传步骤。日志没显示一个参数不证明该参数不存在；云端报告也可能由平台后处理生成。

`dt4j-coverage-maven-plugin`、`devtestcov-maven-plugin` 的本项目真实职责在本次交付时仍未知。只可从本地插件帮助/插件描述、POM 和实际云端日志查证，不能凭名称决定删除或组合方式。原日志未提供给本次助手，不宣称已完成云端诊断。

本地采用经过验证的一条 Coverage 采集链；云端采用其经过确认的原有链。将命令分别固化在本地环境锁定记录中。互斥 Profile 只是可选实现方法；若使用 Profile，需检查 settings、自动激活、继承和显式 goal，不能假设 `-Pai-coverage` 自动关闭其他插件。冲突保护必须覆盖直接 Maven 调用和 Runner 调用；做不到时记录边界，禁止无人值守改变配置。

POM 修复属于独立环境变更：修改前后各跑一个本地 Canary 和与云端等价的安全验证，并由云端真实日志确认云端报告仍存在。不能用本地测试通过宣称云端 OOM 已解决。

## 2. 固定命令与 Agent 参数

环境锁定记录至少保存：JDK 发行版/版本、Maven/Wrapper、Mockito/Byte Buddy、Surefire/Failsafe、JaCoCo agent/CLI/report 版本、实际启用的企业插件、profiles、编译输入、测试 JVM 参数来源、报告范围和正式命令。秘密值不写 GitHub，不输出 settings.xml/凭据；必要时本地保存去敏摘要。

JaCoCo 支持专用 `propertyName`，Surefire 可用延迟属性读取；提供空默认值防止未启用时保留未解析 token。语义应是 `@{本地Coverage参数属性} + 已批准Mockito启动参数 + 其他必要JVM参数`，不是为云端关闭 Coverage 就把整个 argLine 清空。[S03]

此处不是可直接覆盖 POM 的 XML 模板。具体属性名及 execution 绑定必须服从本地实际结构。若 Failsafe 分开执行，应有其明确的参数和 exec 路径，不能一条覆盖另一条。

JDK 21 的动态 Agent 警告不等于 inline mocking 全面不可用。优先按已解析 Mockito 版本的官方启动 instrumentation 方案验证；不是所有 Mockito 5 版本都可不经检查套同一命令。Mockito 用于 mocking，不是第二个 Coverage owner；Byte Buddy 依赖存在也不等于手工加载了重复 Agent。[S07]

## 3. 执行数据：一个文件属于一次确定的执行

每个 run/attempt/stage 分配独立输出目录，记录实际写入的 exec、测试报告、命令、起止时间、原始退出码和文件哈希。接受前必须所有相关测试 JVM 正常退出或完成已验证 dump；OOM/强杀后留下的非空 exec 只能诊断，不能当完整测试证明。

不能把 `append=false` 写成全场景安全规则：多个 fork/重复 fork 若共用同一文件，会互相覆盖。可采用每 JVM 唯一路径，或在**仅本次 stage 的全新目录**内使用经过验证的 append，再显式 merge。不得跨批永久盲 append。`${surefire.forkNumber}` 可能复用，不能未经验证当作每个 JVM 生命周期的唯一 ID。[S03][S06]

默认资源配置从单 Maven、单测试 fork、无 reactor 并行开始实测；reuseForks 不一律 false。分别限制 Maven 堆、测试 JVM 堆、report JVM、Metaspace/CodeCache 及操作系统/容器总内存，并留原生内存余量。OOM 需区分 heap、Metaspace、CodeCache、线程/原生、OOMKilled；按所属进程和阶段诊断，不能只加 Xmx 或把所有黄色告警当根因。

超时包含 stage timeout、总 run deadline、取消宽限期。实际时间/退出状态可回溯；超时后不得因无失败 XML 就返回 PASS。后台子进程未清理时不允许下一 Maven 阶段。

## 4. 构建身份：校验活体，不是只看冻结副本

保留两类事实：

- `productionInputDigest`：生产源码/资源、解析依赖、编译/生成配置及工具链输入的内容摘要，用于定位变化。
- `coverageBuildId`：对确定报告范围内的 module+相对 class 路径+内容哈希稳定排序后的摘要，并记录 JaCoCo 分析版本/过滤规则。

Git commit/分支/dirty 状态用于审计，不是 exec 兼容身份；绝对路径、mtime 不决定身份。源码未变也不保证字节码不变。[S02]

Generation 创建于本地已验证的构建 Freeze Point，保存 immutable production class snapshot。后续命令若包含 clean，先到达相同 Freeze Point 再比较活体输出；clean 后 class 缺失属于 BUILD_NOT_READY，不是生产变化。

**冻结副本自己不变，不证明测试仍使用同样的类。** Runner 必须核实测试 classpath 对应当前构建，并比较 exec 中实际出现的受统计类 ID 与快照中对应 ID。另一个 transformer/classloader 也可能改变运行时类；只 hash 磁盘目录不足以排除这种问题。[S02]

在测试前后再次检查生产内容/输出，防止并发会话中途修改。若不能证明稳定就不接受该 run。生产输入相同却输出持续变化，先定位不确定编译/重复增强，不能反复 rollover 或改 manifest 哈希解阻。合法生产变化时保留旧 Generation、重建新鲜基线；旧测试源码仍保留并重跑，不因 exec 换代而丢测试。

## 5. 明确范围，不比较错误维度

保存 `scopeDigest`：module、报告 class 来源、include/exclude、分析版本及分组规则。完整构建扫描集合与 JaCoCo 可报告集合可以不同，例如生成代码过滤、无可执行内容或显式排除；307 与 284 的数量不同本身不是故障。需要保存成员与差异理由，不强制数字相等。

同一份输入 class、同一报告分析/过滤版本、同一范围下，LINE total 才应稳定。变化时给出具体输入/配置差异；不要把统计行数变化等同于源码新增行数。

正式总量读取选定 XML `<report>` 的直接 LINE counter，不用递归求和所有 counter。方法/类/源码可能共享行，不能要求各方法或各 class LINE 相加必然等于顶层 total。[S01]

`report-aggregate` 纳入哪些模块受依赖关系、scope 和配置影响，不保证 reactor 下所有模块自动进入；默认 exec 文件发现也不是历史保存机制。[S04]

## 6. 两种覆盖率必须显式区分

| 类型 | 数据来源 | 用途 | 能否完成 90% 目标 |
| --- | --- | --- | --- |
| `ACCUMULATED_SEARCH` | 同兼容 build/context 下有效 Baseline+Accepted exec 的并集 | 未覆盖目标导航、增量搜索进展 | 否 |
| `FRESH_FULL` | 当前测试资产从隔离干净输出执行完整指定 suite，新生成 exec | 当前可重复基线、最终验收 | 是，且所有健康/范围门禁通过 |

新鲜快照保存 `testAssetDigest`，包括实际执行测试、共享 fixture、测试资源及相关配置；同时记录应执行测试与实际执行测试清单/计数及差异。仅存时间戳或 XML 文件路径不够。

新测试可向搜索集合贡献 exec；若修改/删除以前贡献数据的测试/fixture，或依赖/测试运行配置改变，则失效相应贡献。无法证明影响边界时跑新鲜完整检查并重建搜索起点，不更改生产 Generation 身份来掩饰测试资产变化。

起始建议每 3 个接受批次或共享 fixture 改动时做一次新鲜检查；实际间隔由 P0 资源实测锁定。导航值很高而新鲜值不涨时，停止盲写，重新基于新鲜报告选目标。新鲜覆盖率下降可能真实揭示删改测试的退化，不能为了“单调”保留旧数。

最终计算用整数：目标为 90% 时 `10 * covered >= 9 * total`，剩余行数 `max(0, ceil(9*total/10)-covered)`。`total=0` 为不可验收，不能当 100%；零分支分母用 null/NOT_APPLICABLE，不伪造分支100%。

## 7. Merge 的必要验证

复用官方 JaCoCo CLI 或 Maven merge，不能用 runtime agent JAR 调 merge，也不手写 exec 二进制算法。输入逐个来自已验证 manifest；输出路径不得等于输入，生成后 hash 到报告读取前不可变化。[S05]

固定相同 class 分析范围时，Baseline+Accepted+Pending 的 probe OR 不应因为 Pending 缺历史类而丢覆盖。`--skip-module-phase` 会减少回归验证范围，但不是 merge 丢历史数据的合理解释。[S05]

若报 DATA_LOSS，先比较预期输入清单、实际 CLI argv、merged 数据内容、report 实际输入、比较基准的 Generation/context。阶梯 A、A+B、A+B+C 各自独立目录复现；缺输入/读错 report/不同 class ID 分别定位，不删除门禁，也不靠重跑全模块掩盖合并 bug。

旧全扫描 exec 或缺 fingerprint 的历史快照保留为 LEGACY_NON_COMPARABLE，不自动加入新搜索集合。

## 8. Method 与行区间的真实能力边界

XML method 节点有 name、desc、起始行（可缺）和计数器；逐行信息在 sourcefile/line。方法没有 line 子节点不等于 XML 没逐行数据。[S11]

逐行 `mi>0 && ci=0` 表示该 source 行未执行；`mi>0 && ci>0` 是部分指令覆盖，不能都标成未执行红行。行号归属可能跨方法/类共享；当前 start→nextStart 和 counter 数量相等仅是推断/一致性检查，不是 EXACT 的充分证明。

设计区分 `METHOD_EXACT`（module/class/name/descriptor 定位精确）与 `LINE_HINT`（源码范围提示）。没有可靠逐方法行归属时仍可按准确方法 counter 工作，不阻塞整个 Loop。若确需 EXACT method-line mapping，用原始 class 的 line table/JaCoCo analysis API 等验证并记录重叠；HTML用于交叉查看，不替代身份。

收益 Gate 与声明一致：METHOD 任务比较同 descriptor 方法；LINE_BLOCK 任务还要有该目标区块内确切命中的证据，否则降级为 METHOD 任务并在实施前重发工作包，不能验收时偷偷降粒度。Branch 计数不代表所有 exception 路径。[S01]

## 9. 历史失败、编译失败与不完整执行

`knownFailures/newFailures` 仅为归因信息，不是单独 PASS 条件。至少同时检查 Maven 退出原因、测试 JVM 是否正常退出、报告完整、目标测试确实被发现、未运行 required modules、非预期 skipped 和错误签名变化。相同 TestClass#method 的历史失败若异常类型/阶段发生变化，不直接忽略。

编译失败、零测试、OOM、超时、报告缺失都不能因为 newFailures=[] 通过。历史失败容忍必须是用户批准的有限范围策略，记录原因和期限；不能每轮重建 baseline 把新失败洗成历史失败。最终 FRESH_FULL 的 90% 完成标准要求所有 required tests PASS，无未处理历史失败。

预先发现测试编译问题时先修测试基线，不删除测试。未接受的新补丁可以从主测试工作区撤回并保存到本次 attempt，必须准确区分它与用户既有测试资产。

## 10. 文档、报表与完成证明

每个快照包含：report hash、class snapshot/buildId、scopeDigest、执行命令、testAssetDigest、exec 输入及 hash、分析器版本、run状态及生成时间。`COVERAGE_PROGRESS.md` 同时显示搜索值、最新新鲜值、测试资产是否已变化；`COVERAGE_ROADMAP.md` 保存策略和延期；Summary 只追加真实批次或明确标注的环境事件。

最终 `finalize` 不读旧 Accepted exec 填补缺口：在相同明确 scope 下 clean 构建当前代码、执行所有 required unit/component/integration suites、收集本轮独立 exec、生成新 report。方法/类过滤保持锁定，测试未跳过、真实断言最低标准通过，才检查 90%。全量命令按实际生命周期认证，不把 `mvn test` 一律当含 Failsafe 的全量，也不裸调用 integration-test 留资源不清。[S12]

本地与云端可能报告不同指标/范围，不能以本地90%承诺云端相同百分比。云端验收独立记录报告生成者、指标口径、范围和构建版本；出现差异做对账，不修改任一分母迎合另一方。