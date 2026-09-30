# 历史故障、纠错与验收矩阵

状态：`DRAFT v1.0 / TEST_SPECIFICATION`。本文件是需要实现的验收标准，不是已通过的测试报告。

## 1. 证据边界

### 本次实际读取的仓库事实

仓库：`olu37776-bit/-ai-software-engineering-os`；基点：`5577c2e8a9ef090b87924edddf6114dd75eb28a5`。已读 CONTRIBUTING、docs/README、docs/architecture/05-verification-and-evidence.md、docs/roadmap/progress-status.md。主框架仍按其自身Phase1修复计划推进；本目录不改变该状态。

该公开仓库是框架文档/代码仓库，不是用户本地Java业务仓库。本次未取得本地 `.ai-local/coverage/*.py`、真实POM/effective-pom、云端日志、exec/class快照、当前Coverage数据。下面用户报告的工具READY、故障修复和数字都需要现场取证，不能当本次独立验证。

### 用户已报告、需要沉淀为测试的事实

- 初始低覆盖、后来40%左右、4%左右及报告口径争议；历史XML覆盖、早期fingerprint缺失。
- mockStatic/综合测试替代目标真实实现、empty/null绕过主路径；多轮测试绿但覆盖率低收益。
- private loop2未进入，类级+1让方法目标误PASS；`Class#method`丢descriptor导致重载无法区分。
- 新旧测试编译失败；Agent曾以删除既有测试解阻；IDEA大量黄色提示。
- exec被target/clean覆盖；累计merge/report出现DATA_LOSS；Pending只有目标测试数据被误当为根因。
- accepted写入缺失、手工改manifest；文档不完整、冷恢复和重复关闭问题。
- production变更、分支/commit、clean/fingerprint检查时机混淆；fullscan307与report284被误当同维度。
- 云端OOM，同时出现JaCoCo/dt4j/devtestcov；POM修复清空argLine后本地exec断链；云端最终仍需Coverage报告。
- 用户确认其他会话确有生产改动，但不要求本测试任务审查这些业务修改。

这些事实说明需要哪些防线，不证明每一次事故只有一个根因。29982→31347差值是1365；不能据此认定另一条“+1875”描述的来源。历史资料缺失时标不可比，不伪造过去。

## 2. 必须纠正的旧假设

| 旧假设 | 新规则 |
| --- | --- |
| Class/Method行数简单相加应等于Report | 源码行可共享；整体读Report直接counter，导航按自己的层级解释。[S01] |
| method start到next start且计数对上就是EXACT | 数量相等不证明归属；方法身份可精确，行区间仍可能只是提示。[S01][S11] |
| 冻结snapshot不变就可继续用所有exec | 还要核对测试实际加载类、测试资产和执行上下文。[S02] |
| Pending缺少历史类导致merge覆盖率下降 | 正常union应保留历史probe；查输入、输出和report lineage。[S05] |
| append=false总安全 | 共用文件的多fork可能覆盖；每run/JVM隔离或经验证的stage内append。[S03][S06] |
| JDK21使Mockito inline全面不可用 | 动态加载警告/限制不等于全面禁用，按实际Mockito版本配置。[S07] |
| 三个插件出现等于已证实OOM冲突 | 先关联真实命令、进程、插件执行与资源证据；企业链可能有协作分工。 |
| 云端部署就不应该有Coverage | 用户云端本来有报告，必须保留；本地Loop不可牺牲云端质量要求。 |
| newFailures为空就能PASS | 零测试、编译失败、进程崩溃、部分报告都必须拒绝。 |
| 有分析JSON就证明分析正确/提前执行 | 只能检查产物；程序必须在派实现前验权，真实测试继续证伪分析。 |
| 多文件逐个原子rename等于整体原子提交 | 用不可变revision加单个指针发布；视图可幂等修复。 |
| `/goal`配置100轮就会可靠限100轮 | 上游当前dev说明该迁移字段未由Goal钩子强制；预算放Runner，核验本地版本。[S09] |
| 永久累计到90%就是当前测试集90% | 累计只导航；最终必须FRESH_FULL重跑当前保留测试。 |

## 3. 验收矩阵

实现工具者为每项建立可运行测试和独立证据。fixture/单元测试不能代替标注LOCAL/CLOUD的实测。测试ID仅为本独立工具的验收编号，不是主框架Node ID。

| ID | 注入/真实场景 | 必须结果 | 级别 |
| --- | --- | --- | --- |
| C01 | 多层counter、共享源码行、嵌套group | 不重复累加；顶层计数正确；不强制class sum等于root | FIXTURE |
| C02 | 同module重载；不同module同名class | 只验证完整target identity，不选第一个同名方法 | FIXTURE |
| C03 | 目标loop2+0，class其他方法+1 | 拒绝目标收益PASS，返回具体未命中方法 | FIXTURE+LOCAL |
| C04 | sourcefile有line而method无line子节点 | 能提供Method counter与line hint，不误报XML无逐行信息 | FIXTURE |
| C05 | 相邻/同起始行方法、lambda、inner class共源文件 | 不将推断行号标成EXACT；合理退为METHOD目标 | FIXTURE |
| C06 | 当前目标被Mock/empty短路 | 真实目标收益为0；分析反馈入口/条件，不堆无效测试 | LOCAL |
| C07 | 断言只恒真、吞异常、复制生产算法 | 补丁/审查不通过；样板错误变体不能存活为合格样板 | FIXTURE+LOCAL |
| C08 | 既有测试编译错误，模型提出删除类 | 删除补丁被拒；受限修复保留原意，不能跳测 | FIXTURE+LOCAL |
| C09 | Maven非0但XML没failedTest、零测试或部分模块未跑 | 不得REGRESSION_CLEAN/PASS | FIXTURE |
| C10 | 同一个known测试出现新异常类型/阶段 | 不自动忽略；保持原退出码并要求诊断 | FIXTURE |
| C11 | Baseline+A+B，再加入只含一个类的Pending | 固定scope的merged结果不下降；实际argv与manifest一致 | FIXTURE+LOCAL |
| C12 | Preview读错pending、遗漏Accepted、输出覆盖输入 | DATA_LOSS/lineage检查拒绝；不能靠开启全module掩盖 | FIXTURE |
| C13 | 多fork同文件append=false | 测试揭露早期数据覆盖；配置认证拒绝该布局 | FIXTURE+LOCAL |
| C14 | clean删除target但Store在外 | immutable证据保留；重建Freeze Point后检查，不空目录误判 | LOCAL |
| C15 | 仅commit/branch/mtime变化 | 不因元数据新建generation；保留内容审计 | FIXTURE |
| C16 | 真生产class/工具链/过滤范围变化 | 拒绝不兼容exec；不更新旧manifestFP绕过 | FIXTURE+LOCAL |
| C17 | fullscan与report类数不同但过滤有来源 | 按成员/规则判定，不因307≠284直接FAIL | FIXTURE |
| C18 | snapshot固定，测试实际load了其他class版本 | class ID校验拒绝；不能只检查snapshot自身hash | FIXTURE+LOCAL |
| C19 | 旧测试/fixture改坏，但旧exec仍使累计值90% | 搜索贡献失效；finalize仅本轮数据不能假完成 | FIXTURE+LOCAL |
| C20 | 本地argLine被置空或prepare-agent未消费 | Canary定位参数链/无exec，不能进入测试生成 | LOCAL |
| C21 | 云端既有Coverage链+本地profile误同时启动 | 认证识别实际冲突；云端报告不被删除作修复 | LOCAL+CLOUD |
| C22 | 模拟timeout/OOM/子进程残留 | 有阶段/退出状态；终止所属进程树；不读取半成品作为PASS | FIXTURE+LOCAL |
| C23 | Analysis缺失、DEFER、目标/hash不一致 | 实施Adapter调用次数为0；不是事后才拦verify | FIXTURE |
| C24 | 子Agent提交src/main/POM/状态修改或删除既有测试 | 补丁应用前拒绝，正式工作区内容不变 | FIXTURE+LOCAL |
| C25 | Agent忽略Prompt并返回假READY/超预算/递归loop | 不推进；程序预算与锁生效 | FIXTURE+LOCAL |
| C26 | accepted写exec后崩溃；写报告后崩溃 | current未切换则无新接受；恢复不手改accepted | FAULT_INJECTION |
| C27 | current切换后Markdown刷新失败 | 结果只接受一次，恢复重建视图且revision一致 | FAULT_INJECTION |
| C28 | 同batch重复close；同键换payload；并发两个close | 相同请求幂等，不同payload冲突，CAS只提交一版 | FAULT_INJECTION |
| C29 | 断网/模型提前退出/宿主重启 | run可暂停冷恢复，不依赖聊天记忆或DONE标记 | LOCAL |
| C30 | 新鲜checkpoint低于搜索值或仍有required历史失败 | 不完成90%；记录真实新鲜值并重新规划/修复 | LOCAL |
| C31 | 仅分支增量，没有新行 | 分支收益单列，不假称行目标前进 | FIXTURE |
| C32 | 最终clean完整执行 | 本轮exec、正确scope、全部required测试PASS、整数LINE门禁达标 | LOCAL |

## 4. 真实样板和长循环放行

P3至少验证一个符合项目实际的纯逻辑样板和一个带协作者/非空循环样板；不强制先覆盖最难runtime方法。每个样板记录入口、条件、预期依据、方法收益、断言审查、所用资源，不只记新增测试数。

P4完成3个真实批次、一次新鲜全量checkpoint和一次冷恢复。发生明确基础设施失败就暂停修该缺口；非阻塞优化不反复触发整套基建重建。最终证据由独立审查者查看实际结果与diff，不能只读实施Agent摘要。

## 5. 本次文档验证与本地验证分开

本次可以验证：文件存在、链接与路径、术语/接口一致性、伪代码/示例标注、WRITE_SCOPE、来源引用、历史事故到测试的覆盖关系。

本次不能验证：本地代码已经实现本方案、JaCoCo当前百分比、云端OOM消失、真实插件所有权、OpenCode adapter能够取消/隔离、完整Java测试套件通过。后续报告不得把“文档已提交GitHub”改写成这些能力VERIFIED。

## 6. 一手参考来源

检索日期：2026-09-08。trunk/dev是可变化的文档，使用的是语义参考，不是要求升级用户本地版本；落地时必须锁定本地实际版本重新核验。

- **S01 — JaCoCo counters**：行/分支定义、异常非branch、共享源码行不能简单累加。https://www.jacoco.org/jacoco/trunk/doc/counters.html
- **S02 — JaCoCo class IDs**：runtime/report类字节匹配、classloader/transformer影响、dump只含已加载类的限制。https://www.jacoco.org/jacoco/trunk/doc/classids.html
- **S03 — JaCoCo prepare-agent**：propertyName、延迟argLine、append、destFile、VM退出写入。https://www.jacoco.org/jacoco/trunk/doc/prepare-agent-mojo.html
- **S04 — JaCoCo aggregate**：模块依赖scope与execution data输入范围。https://www.jacoco.org/jacoco/trunk/doc/report-aggregate-mojo.html
- **S05 — JaCoCo CLI / ExecutionData**：官方merge/report/execinfo与probe merge语义。https://www.jacoco.org/jacoco/trunk/doc/cli.html ；https://www.jacoco.org/jacoco/trunk/doc/api/org/jacoco/core/data/ExecutionData.html
- **S06 — Maven Surefire fork/parallel**：forkCount、reuseForks、并行与资源影响。https://maven.apache.org/surefire/maven-surefire-plugin/examples/fork-options-and-parallel-execution.html
- **S07 — JDK / Mockito**：JEP451与Mockito显式instrumentation示例；5.14.2仅为已查文档版本，不替用户决定升级。https://openjdk.org/jeps/451 ；https://javadoc.io/static/org.mockito/mockito-core/5.14.2/org/mockito/Mockito.html
- **S08 — OpenCode agents / permissions**：主/子Agent和工具权限；权限不能替代未验证的OS隔离。https://opencode.ai/docs/agents/ ；https://opencode.ai/docs/permissions/
- **S09 — OpenCode CLI / Oh My OpenAgent Goal**：非交互Adapter需按版本实测；当前dev说明Goal continuation及iteration迁移字段限制。https://opencode.ai/docs/cli/ ；https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/docs/reference/features.md
- **S10 — PIT**：被执行不等于能发现错误；少量隔离错误变体/Mutation用于断言抽查。https://pitest.org/quickstart/basic_concepts/ ；https://pitest.org/quickstart/mutators/
- **S11 — JaCoCo XML DTD**：method desc/line、sourcefile逐行记录。https://github.com/jacoco/jacoco/blob/master/org.jacoco.report/src/org/jacoco/report/xml/report.dtd
- **S12 — Maven lifecycle**：test-compile之前会执行前序阶段；verify与integration teardown关系。https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html

没有足够公开一手材料证明用户本地dt4j/devtestcov具体配合和OOM根因，因此不引用无关第三方示例代替现场证据。