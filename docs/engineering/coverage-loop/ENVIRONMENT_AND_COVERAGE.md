# 稳定测试环境与覆盖率度量契约

状态：`DRAFT v1.1 / REVIEW_PENDING`。本地版本、POM、插件协作关系先由P0盘点；真实命令和资源实测属于获准的P1。来源[S01]–[S12]见 [故障与验收](ACCEPTANCE_AND_INCIDENTS.md)。

## 1. 保留两条真实运行路径，不强行套三个Profile

本地Coverage用于测试资产建设；云端原有流水线继续生成其覆盖率报告并保留测试/发布要求。普通无Coverage模式可选，不为凑三模式改配置。

三个插件出现在POM不证明重复插桩或OOM因果。必须在对应代码版本、命令、active profiles、父POM/settings和环境下关联：实际日志、effective-pom、测试JVM参数、报告文件和平台上传/后处理。日志缺一行不证明某参数不存在；旧云端日志不能证明新POM已修复。

本项目dt4j/devtestcov实际职责本次尚未取得现场证据。只根据本地插件描述/帮助、配置和日志判断，不凭名称删除插件。Profile只是隔离选项；显式启用ai-coverage不自动关闭其他profile，需核查默认激活、继承和直接goal。

POM修复是独立环境变更，须有明确范围；本地Canary通过不代表云端OOM已解决。云端实际报告生成和资源结果仍需云端证据，不能删除原有报告要求来解阻。

## 2. 固定命令、参数所有权和隐私

环境记录至少含JDK发行版/版本、Maven/Wrapper、Mockito/Byte Buddy、Surefire/Failsafe、JaCoCo agent/CLI/report版本、实际企业插件、profiles、编译/测试参数来源、报告scope和命令。

P0只读取已有配置/日志；不得执行未经源码检查的runner `--help`/`--dry-run`，因为名称不证明无副作用。Maven help、版本探测、性能测量和真实Canary在P1获准后执行。P0缺少effective-pom时记录UNKNOWN，不为补字段触发网络或构建。

秘密值不进入公开仓库或共享摘要；settings.xml、令牌、私有仓库地址和原始日志留本地。去敏内容不能反过来当完整运行参数证明，完整证据在本地保留路径/hash。

JaCoCo可通过专用propertyName提供Agent参数，Surefire使用已验证的延迟求值组合：Coverage参数+Mockito启动参数+必要JVM选项，并提供未启用时安全空默认值。[S03]

不能为关闭云端重复Coverage而清空整个argLine，也不能用本文示例覆盖真实POM。Failsafe若独立执行，应有自己的明确参数和exec路径。

JDK21动态Agent警告不等于inline mocking全面不可用；按实际Mockito版本官方方案验证，不擅自升级或替换mock maker。Mockito不是第二个Coverage owner，Byte Buddy依赖存在也不等于重复加载Agent。[S07]

## 3. 每份exec属于明确执行

每个run/attempt/stage使用独立输出目录，记录命令、起止时间、原始退出码、测试报告和exec hash。所有相关JVM正常结束或已验证dump完成后才可接受；OOM/强杀留下的非空exec仅供诊断。

不能全局规定append=false：多个fork若共享文件会覆盖。采用每JVM唯一路径，或在本stage全新目录内经验证的append后显式merge；禁止跨批永久盲append。forkNumber可能复用，不默认等于JVM生命周期唯一ID。[S03][S06]

资源起点为单Maven、单测试fork、无reactor并行；reuseForks按实际测试基线确定。分别控制Maven堆、测试JVM堆、report JVM、Metaspace/CodeCache和容器/系统总内存，保留原生内存余量。OOM区分heap、Metaspace、CodeCache、native/线程和OOMKilled，按实际进程定位。

stage timeout、总deadline和取消宽限期由程序实施，所有重试都计预算。超时不因无failedTest而通过，所属残留进程未清不能开下一Maven。

## 4. 身份：冻结副本与实际执行必须对应

保留生产输入内容摘要productionInputDigest，用于定位源码/资源、依赖、编译/生成工具链变化；保留coverageBuildId，绑定模块+相对class路径+内容hash，以及JaCoCo分析/过滤版本。

commit、分支、dirty状态仅作审计；mtime和绝对路径不决定兼容性。源码相同仍可能产生不同字节码。[S02]

Generation在获准的确定性Freeze Point建立immutable class snapshot。clean后先重建到该点再检查，缺class是BUILD_NOT_READY而非生产变更。

snapshot自身不变不能证明测试用了它。校验classpath对应当前输出、exec里统计范围内class IDs与快照兼容，测试前后核验生产内容与输出。其他transformer/classloader可能改变运行时类，只hash磁盘目录不足以排除。[S02]

同输入持续异字节码先定位生成/重复增强，不循环rollover或改manifest hash。合法生产变化保留旧Generation，当前保留测试在新Generation重跑。测试源码不随exec换代删除。

## 5. Scope和总量

scopeDigest绑定module、class输入目录/快照、include/exclude、报告分析版本和分组规则。fullscan集合与可报告集合可以不同；307≠284本身不是故障，要比较成员及过滤理由。

同class输入、同scope、同分析版本下LINE total稳定。正式总量读选定XML的`<report>`直接LINE counter，不递归累计所有counter。方法/类可共享源码行，不能要求它们简单求和等于Report。[S01]

report-aggregate范围受模块依赖scope/配置影响，不保证所有reactor模块自动纳入，默认exec发现也不保存历史。[S04]

## 6. 搜索值和完成证明

| 类型 | 来源 | 用途 | 完成90%目标 |
| --- | --- | --- | --- |
| ACCUMULATED_SEARCH | 同兼容build/context内有效Baseline+Accepted并集 | 目标导航和增量进展 | 不可以 |
| FRESH_FULL | 当前保留测试集在隔离新输出完整执行的本轮exec | 当前可重复基线与终点 | 满足全部门禁才可以 |

新鲜快照绑定testAssetDigest：测试、共享fixture、资源及相关配置；记录应执行suite与实际发现/执行清单、缺失/跳过理由。仅时间戳和XML路径不够。

修改/删除曾贡献数据的测试/fixture、变更依赖或测试环境时，使受影响搜索贡献失效；不能精确归因则完整重跑建立新搜索起点。不要为掩盖测试变化而伪造production Generation变更。

起始checkpoint建议每3个接受批次或共享fixture变化时触发，实际周期在P1资源实测后锁定，不要求P0执行性能测试。累计值高而新鲜值不涨时，回到新鲜缺口重新规划，不保留旧绿行维持单调假象。

90%用整数判断`10*covered >= 9*total`；剩余行`max(0, ceil(9*total/10)-covered)`。total=0不可验收；零分支分母记录NOT_APPLICABLE，不伪造100%。

新鲜全量中多fork/multi-module仅合并**该次run**所有完整执行数据，不引入历史Accepted数据。JUnit/组件/集成贡献分别标明，不能把联合覆盖率叫纯单元测试覆盖率。

## 7. Merge与DATA_LOSS

使用官方JaCoCo CLI/Maven merge，不用runtime Agent JAR调merge，不自写exec二进制算法。输入为manifest精确文件清单，输出不等于输入，merge后至report前hash保持不变。[S05]

固定class/scope时Baseline+Accepted+Pending应保留历史probe。Pending只含目标测试类合法；skip-module-phase减少回归范围，不是丢历史Coverage的合理解释。

DATA_LOSS依次对比：manifest期望清单、CLI实际argv、merged内容、report读取路径、Before所属Generation/context。阶梯A、A+B、A+B+C各自临时目录复现。不得去掉门禁、强行跑全模块或永久append掩盖读错输入。

缺fingerprint、被覆盖XML的旧记录保留LEGACY_NON_COMPARABLE，不自动加入新搜索集合。

## 8. Method与行区间

XML method有name/desc、可选起始行及counter；sourcefile/line才是逐行记录。method无line子节点不等于XML没有逐行数据。[S11]

`mi>0 && ci=0`为源码行未执行；`mi>0 && ci>0`是部分覆盖，不能全算红行。start→nextStart及counter数量相同不足以证明方法行归属。

区分METHOD_EXACT与LINE_HINT；无可靠行映射仍可用精确方法counter工作。需要精确行目标时结合原始class行表/JaCoCo analysis API并记录共享/歧义，HTML只交叉查看。

METHOD任务验收同module/class/method/descriptor。LINE_BLOCK任务须有对应区块实际命中证据；要降级为METHOD只能实施前重发工作包，不能验收时偷偷改粒度。Branch不包含所有异常路径。[S01]

## 9. 测试健康与历史失败

knownFailures/newFailures是归因信息，不是单独PASS标准。必须检查退出原因、JVM完整结束、报告完整、目标测试发现、required modules与非预期skip。历史同名测试异常类型/阶段改变要重新诊断。

编译错误、零测试、OOM、超时、缺报告不能因newFailures为空通过。容忍历史失败须有用户批准的范围/原因/期限，不每轮重建baseline洗掉新失败。finalize要求全部required tests PASS。

既有测试编译失败先独立受限修复，不删除类。未接受补丁只撤回本attempt拥有的候选改动并留证据，不删除用户既有资产。

## 10. 完成与本地/云端对账

每个快照保存report hash、buildId/class来源、scopeDigest、testAssetDigest、命令、exec输入/hash、解析版本和run结果。Progress同时显示搜索值、最新新鲜值及其是否已过期；Roadmap保存策略/延期；Summary只追加真实动作。

finalize对当前测试树clean构建并执行完整required unit/component/integration suite，只用本次exec报告；无范围变化、未解释跳过或失败，且LINE≥90%才完成。`mvn test`不自动包含Failsafe；按获准生命周期执行并完成integration资源清理。[S12]

本地90%不保证云端百分比相同。云端保留其报告生成者、指标、scope和版本，差异对账，不改分母迎合另一边。本次文档检查不代替任何云端验收。
