# LF-C1 正式授权、范围检查与开工绑定实施规划

状态：`DRAFT / DESIGN_PACKAGE_COMPLETE / NOT_AUTHORITY / CODE_ENTRY_NOT_RELEASED`  
更新：2026-09-08  
观察 main：`ed14d4179808621c8ffd5751ebbf7b6704f33b64`，tree `ad6026e0ef0f67dd1bb3becca65d353b7cb0a463`  
[CURRENT](learning-feedback-branch-plan.md) · [业务开工包](learning-feedback-core-entry-plan.md) · [D01～D05](../architecture/learning-feedback/decision-register.md) · [并行协议](../architecture/learning-feedback/parallel-development-protocol.md)

## 1. 规划结论和不变项

本规划选定一条实现路线，不再把“建立正式授权”留给执行者自由设计：**在现有正常范围检查入口内增加一个默认关闭的、精确命名的 LF-C1 授权分支；经先验授权和独立验证安装四份 LF Authority；最后凭 E0～E4、已接受单写者和获准基线启用。** 不另造通用治理平台，不修改 required `verify` 身份，不把诊断脚本改名当作正式门禁。

LF业务候选范围保持开工包和 #97 请求的54个精确路径：18 core、26 contracts、6 wiring、4实施文档；验证义务保持 C1-V01～18。控制面/Authority/独立Evidence是不同写者和单独任务，不能混入54路径或要求LF实现者自行放宽裁判。

本轮只发布规划，不创建这些控制面文件、不改P1禁令或accepted ADR。E1实施涉及授权/Gate规则，按CONTRIBUTING必须有独立审查的ADR决定；§3给出完整待批准决定内容，正式ADR编号/落盘由治理任务执行前核对并授权。

## 2. 已读事实及#97请求的处置

观察main的 `scripts/toolchain/scope-policy.mjs` 仍只识别P1-O01…09；旧amendment路径只覆盖Phase1限定目录并禁止docs/decisions和packages。`packages/learning/**`仍在P1 globalDenied；原suite只允许P1-O02，三份inventory/registry共享锁另有既定P1 owners。

#95/#97仅准备请求和诊断。固定请求来自PR97 HEAD `8826c450fdbad3de5decb882c42d6a0c86af480b`：

- `operations/phase-1/evidence/o01/lf-c1-entry-request.json`：recordType=LF_C1_ENTRY_REQUEST_NOT_AUTHORITY、codeStartAuthorized=false、approvedMain=null。
- 同目录 `lf-c1-entry-preflight.json` 和 `scripts/toolchain/check-lf-c1-scope-request.mjs`：只重现当前拒绝，exit2不能解释成源码开工。
- 请求包含原开工包的UTF-8快照/hash，原文来源877eea8；正常干净clone不应依赖未合并PR的Git object。

这次修改了开工包的导航/状态/控制面衔接，**其文件hash会变化**。G0须更新请求的sourceCommit/tree/path/hash/snapshot和新基线观察；保留54路径与18项要求，用字节比较证明集合不变。即使路径集合相同，旧sourceHash也不能冒充新文档已绑定。本PR不修改PR97文件，不改写历史诊断；新版本仍是REQUEST_NOT_AUTHORITY。

现有诊断用开工包全部 `text` 代码块提取路径，并读取18行C1-V要求。因此开工包只保留3个路径块，共50条；另4条实施文档由其既有规则加入。本规划的治理清单不得粘入业务开工包的路径块，否则会意外扩大机器请求。

## 3. 待批准的架构决定：受控并行核心授权

**标题：** LF-C1 scoped parallel-core authorization。**状态：** PROPOSED，非已接受ADR。该决定与D01～D05的业务/验证边界一致，不替代它们。

**背景：** 主线Phase1规则合法地拒绝learning；用户希望提前并行纯核心，不能借#82修复或#95准备权限绕过。源码与裁判必须隔离，既有共享锁不能被忽略。

**决定：** 保留原P1 manifest、write-scope、verification-plan、冻结meta-schema、旧accepted ADR的原字节及语义。正常dispatcher只增加精确LF-C1通路和一次受控的LF Authority安装通路，二者没有合格先验Gate时均拒绝。P1操作调用仍走原P1检查，仍不能写learning；不全局移除禁止项、不允许任意LF-*或其他后续Phase。

**共享授权：** 四个已锁定共享资产（suite、planned、inventory、registry）必须获得显式逐路径委托及hash刷新许可。新LF Authority引用原P1 lock的before hash、原role/mutationPolicy/owner集合和允许的委托operation，不能仅以LF allow-list忽略P1锁。原P1 owners保持不变；新增并行委托由先验Gate和LF Authority记录，正常检查同时验证该委托。原IMMUTABLE资产没有委托，仍全局不可改。

**写者分离：** LF-C1-INTEGRATION只写54业务路径。`operations/phase-1/authority-lock.json`的派生hash刷新只由独立MAINLINE_GOVERNANCE任务写，且只可刷新上述四个实际变化的OPERATION_SCOPED条目的sha256；role、path、mutationPolicy、旧owners、其他条目全部不变。刷新许可必须在业务开工前存在；目标字节产生后由治理任务计算，不由LF自批。

**后果：** 业务最终subject可包含54路径的子集以及独立治理作者提交的单一lock文件，但范围检查必须分区验证，不能把这个联合集合变成LF作者的WRITE_SCOPE。需要根据旧代码的lock transition实现新增精确验证分支；不能简单在末尾忽略hash错误。

**排除方案：** 不删除P1禁令、不改P1-O02身份、不把代码放docs、不新建平行serializer/validator、不永久放开全部packages/contracts或治理目录。

**验证与重访：** §6负例与普通P1回归必须通过；新增其他LF包、生产集成、其他shared资产或业务54路径扩大，必须重新批准，不能继承本例权限。若治理review认为该委托违反上位不变量，应REJECT并修订决定，不得在代码中暗中换一种方案。

正式ADR候选路径为 `docs/decisions/ADR-0012-lf-c1-parallel-core-authorization.md`，观察时index只到0011；若执行前编号已被占用，先更新精确授权，不能覆盖他人ADR。此文包含待批准内容，不在本轮写受保护的decisions目录。

## 4. 有顺序的治理工作包

以下G0～G3是此规划的任务标签，不冒充现有机器operation ID。每个实际实施任务必须先有独立Issue及明确P1-O01或受控安装授权；#82/#95不自动覆盖它们。

### G0 — 刷新既有请求，不放行

由#95/PR97任务在其既有六文件范围内刷新source快照及诊断；不新增权限。所读LF文档以新PR84 exact HEAD为准，不能假定main已有。将本规划和decision-register作为附加只读来源引用；54路径和C1-V01～18与业务开工包逐项相等。结果仍BLOCKED/exit2，旧请求及独立报告保留其subject。

### G1 — 正常checker接线，默认关闭

目标operation仍是单独授权的P1-O01治理实现，不是LF-C1业务实现。候选精确11文件如下，执行前对P1-O01逐项验证：

```text
scripts/toolchain/lf-c1-scope-policy.mjs
scripts/toolchain/lf-c1-authority.schema.json
scripts/toolchain/verify-scope.mjs
scripts/toolchain/scope-policy.mjs
scripts/toolchain/scope-event-policy.mjs
scripts/governance/verify_m0.py
tests/qualification/toolchain/lf-c1-authority.test.mjs
tests/qualification/toolchain/lf-c1-scope-integration.test.mjs
docs/implementation/phase-1/o01/lf-c1-authority-enforcement.md
operations/phase-1/executions/p1-o01-lf-c1-authority-enforcement.json
operations/phase-1/evidence/o01/lf-c1-authority-enforcement.json
```

新schema只描述治理文件，不放进业务contracts registry，不激活任何LF业务Schema。dispatcher/normal M0共同调用一个LF验证实现，避免两套身份/权限规则。scope-event-policy如实际无需改变，可从批准的实际diff缩减，不能再额外改workflow。当前M0/quality入口均调用verify-scope，需证明LF请求确实走这条正常链。

没有已接受§3决定、合法新任务范围或独立审核，不能实施G1。G1合并时不包含LF Authority、启动Gate、学习源码或共享Schema改变；即使识别LF-C1，也应因AUTHORITY_NOT_INSTALLED/START_GATE_MISSING拒绝。G1测试的临时fixture只在隔离测试副本中模拟授权，不是实际Gate。

### G2 — 先验批准后安装Authority，仍不开始业务

G1已独立验证且在protected main完成适用检查后，由独立治理审批任务将一次性installation authorization Gate落到旧P1-O01已有Evidence目录。该Gate必须在G2基线中已存在；不允许G2同时创建批准自己的Gate。Gate路径遵循现有 `p1-governance-amendment-authorization-issue-<实际Issue号>.json`，实际号由任务创建时绑定，不能预写虚构编号。

G1的新LF专用验证分支仅允许这份已批准Gate明确列出的安装文件，不扩大旧amendment的全局regex或解除ALWAYS_FORBIDDEN。G2候选精确9文件：

```text
operations/learning-feedback/core-1/operation.json
operations/learning-feedback/core-1/write-scope.json
operations/learning-feedback/core-1/verification-plan.json
operations/learning-feedback/core-1/authority-lock.json
docs/decisions/ADR-0012-lf-c1-parallel-core-authorization.md
docs/decisions/README.md
docs/implementation/phase-1/o01/lf-c1-authority-installation.md
operations/phase-1/executions/p1-o01-lf-c1-authority-installation.json
operations/phase-1/evidence/o01/lf-c1-authority-installation.json
```

新ADR与index只接受已独立批准的新增决定，不覆盖ADR-0001～0011。新的LF lock绑定新增ADR、LF规范、上位P1 Authority和§3共享委托，不改旧P1 lock中的原条目。四份Authority此时状态为INSTALLED_NOT_STARTED；approvedMain仍无正式开工值。

G2任务并不因名称P1-O01自动获得decisions/LF目录写权：只有prior Gate、已验证G1通路和精确9路径三者同时成立才合法。未满足则继续BLOCKED；此规划本身不是该Gate。

### G3 — 证据、单写者接受和Start Gate

E0完整设计独立批准、E2依赖证据接受、E3协议达到RESERVED后，按§8构造不可变Start Gate和基线绑定。候选Evidence/控制文件固定为：

```text
operations/learning-feedback/core-1/evidence/document-review.json
operations/learning-feedback/core-1/evidence/dependency-qualification.json
operations/learning-feedback/core-1/evidence/integration-acceptance.json
operations/learning-feedback/core-1/evidence/start-gate.json
```

这4个文件属于独立治理/Evidence任务，永不加入54路径。G2 Authority必须先授予对应文件的独立写者角色及发布方式，不能到G3再随意扩大。回执保留原独立runner/原报告/subject；协调者转录不等于自己做过审查。

Start Gate发布后仍要确认其实际landing main和适用检查；满足§8才对#85签发正式READY。先安排接受记录再开启窗口，避免E3需要OPEN、OPEN又需要E3的循环。

## 5. 四份Authority及报告的字段设计

所有新治理JSON：schemaVersion=1.0.0、recordType精确枚举、additionalProperties=false、必填值不得以空串/null绕过；REQUEST类型禁止出现在批准位置。未知字段/版本/重复ID/不规范路径拒绝。它们由G1的单一schema和语义校验共同验证，不建设Runtime审批服务。

| 文件/记录 | 必需语义与绑定 |
| --- | --- |
| operation.json | operationId=LF-C1；packageOwner/publicEntry；risk=R3；productionRuntime=false；atomicity=ONE_CRITERION_ONE_RESULT；branch=learning-feedback/lf-c1-core-1；maximumClaim=IMPLEMENTED；批准决定及安装Gate引用；scope/plan/lock文件引用与hash；status=INSTALLED_NOT_STARTED，不可据此开工 |
| write-scope.json | DENY_BY_DEFAULT；与批准请求一致的54个排序唯一exact paths；18/26/6/4分组；明确private/runtime/checker/authority禁止；54路径分类的CREATE/MODIFY要求；独立报告和lock刷新不属实施范围 |
| verification-plan.json | 精确C1-V01～18及required=true；scope/Contract版本；每项测试路径/预期/证据类型；Linux/Windows和正常qualification的适用矩阵；required验证缺失/失败/取消/未支持均不通过 |
| authority-lock.json | 不可变规范与上位Authority的精确字节hash；共享资产before身份/role/owners/hash、允许的LF委托与独立刷新写者；受控变更规则；不包含自身hash自引用 |
| document-review | 最终review subjectCommit/tree、comparedMain、D01～D05+LF-RV-01～04逐项结果、原独立报告来源/摘要hash、只读证明和限制；无结论不能PASS |
| dependency-qualification | §7逐finding/能力的实现、独立、merge、post-merge、当前基线适用性链接及hash；不只存一个总PASS |
| integration-acceptance | task/actual operator/session/acceptanceActor、54集合digest、独立治理lock写者、baseCandidate、排他共享集合、RESERVED窗口/有效期/撤销条件，原接受记录引用 |
| start-gate | 上述三证据和Authority hash、review subject、被验证controller、eligibleBase、分支、scope/plan、有效期/限制、审批来源；实际approvedMain由landing流程确认，不能伪造自引用 |
| 独立实现/验证回执 | implementationClaim不超过IMPLEMENTED；被测immutable HEAD/tree、逐步骤结果与输出hash、验证者来源；报告写入提交与被测提交分别记录 |

V1语义 Contract属于只读批准基线。LF实施者可在54路径内更新其已包含的状态/实际映射，但不得悄悄改变已接受的单criterion、结果、hash或关闭规则；语义变化必须退回设计review并重绑Gate。

文件hash只锁内容和来源，不能证明审批者独立或拥有权限。Gate只能从可信prior protected-main与明确审批记录读取；候选分支中的independent=true/decision=PASS、同tree不同commit、作者自己撰写review均不足。

## 6. 正常checker算法及VerificationPlan

未来正式命令仍使用正常 `verify:scope` / `scripts/toolchain/verify-scope.mjs` 的operation/base/head/branch参数接口；G1应通过普通入口验证LF-C1。当前直接传LF-C1仍会失败，不能把下述设计当成已经支持的命令。request诊断保持exit2，不改造成万能PASS入口。

处理顺序：验证事件subject与base/branch → 仅精确分派已识别operation → 从prior base加载批准与锁 → 验证可信安装/Start Gate及文档/依赖/writer绑定 → 计算实际tracked/staged/worktree/untracked/rename前后路径与mode变化 → 核对54业务路径和独立治理刷新分区 → 重算内容/生成物与共享锁差异 → 验证全部适用Evidence/claim → 输出结构化结果。

无operation、未知operation或缺Gate时，不得因LF文件不匹配旧P1规则而走NON_OPERATION_GOVERNANCE成功分支。任何其他operations/learning-feedback路径默认拒绝。P1分支原逻辑和全部拒绝语义保持；不是将LF代码冒充文档或P1-O02。

| 控制面验证 | 必须经正常入口得到的结果 |
| --- | --- |
| G-V01 | 未安装Authority/只有REQUEST/只有诊断PASS：LF-C1拒绝；不影响合法旧P1操作 |
| G-V02 | Gate只在候选HEAD、伪造PASS、缺原独立来源、错仓库/branch/base：拒绝 |
| G-V03 | 无显式LF授权写learning，或以P1-O02写learning：拒绝；无operation不能回退为非operation成功 |
| G-V04 | 通配符/重复/../绝对路径/大小写别名/软链接逃逸、删除或rename目标越界、未跟踪隐藏改动：拒绝 |
| G-V05 | 54路径少受要求输出、多一未授权路径、分组或digest不一致：失败；允许项不是强迫修改所有已有文件 |
| G-V06 | LF作者改checker/CI/Authority/独立报告/旧ADR或主线Runtime：拒绝 |
| G-V07 | 错Schema/hash/version；同tree换SHA；旧review/旧依赖hash；只提供机器人emoji：不得满足相应门禁 |
| G-V08 | 未接受writer、窗口CLOSED/过期/撤销、共享竞写、base漂移：拒绝；RESERVED不是业务写许可 |
| G-V09 | 合法治理刷新只改已批准的4个共享条目sha256；动owner/role/IMMUTABLE/无关条目或虚假hash：拒绝 |
| G-V10 | 正向模拟：合法prior Gate、54范围及治理刷新分区、正确actor/base/期限、齐全证据：PASS；仅测试fixture，不生成真实开工批准 |
| G-V11 | 正常root test、quality、M0/verify都执行相同LF检查；删除必需测试/结果、failed/cancelled/unavailable不得绿 |
| G-V12 | 普通P1及已有prior-amendment全回归；旧未知/越界/回执负例仍拒绝；不改变required verify身份 |
| G-V13 | 干净clone只有main历史、无需未合并PR对象即可读取已批准快照和所有必要材料；hash不符或漏依赖失败 |
| G-V14 | Start Gate自引用/eligibleBase不是祖先、landing main不含原Gate、未通过landing适用验证：拒绝；正确发布链可重放 |

每个负例保留完整输入变更、正常命令stdout/stderr/exit、受检SHA和工作树只读结果；不只测试内部helper。输出0只表示本次范围验证通过，不单独等于E0～E4或业务VERIFIED。G1/G2新HEAD都要独立只读验证和protected-main适用复验。

## 7. E2 直接依赖清单与证据接受规则

这是开工依赖清单，不是替主线关闭#82 finding。每行要有：实现subject、原失败负例重验、独立只读结论、merge SHA、对应post-merge检查、对entry候选基线的适用性。

| finding | 为什么C1使用 | 实现/证据位置 | 本轮观察与尚缺 |
| --- | --- | --- | --- |
| R01/R02/R16 | required Gate、回执实例和subject绑定决定验证是否可信 | #86；P1-O01对应execution/evidence；合并ed14d41 | 合并后run34182792727的verify、Linux/Windows、packaging已成功；还要独立逐finding关闭及最终entry适用性，不沿用旧in_progress描述 |
| R06 | canonical/hash决定key和inputHash | #87，P1-O02；tests/contract及对应实施记录 | #87 HEAD 6e1a98b6979ab4f3a761438658256f9fab6184a5仍未合并；需main上的负例/独立与复验 |
| R09 | Schema条件和生成类型一致 | 同#87/P1-O02 | 同上；必须证明schema-operator变更导致正确类型差异，不只重新生成 |
| R10 | 输入时间/版本边界 | 同#87/P1-O02 | 同上；非法日历/时区等需正常validator拒绝 |
| R08 | workspace和依赖边界可被实际发现 | #88/P1-O03；架构资格与负例 | HEAD b624317b613e5b5b2093b3280d223becef366ddd未合并；需normal-entry架构负例及新main证据 |

上述状态是本轮API观察，不永久固定主线。新main变化后由治理任务刷新，不用它作为永远等待的清单。R03/R04/R05/R07/R11～R15/WR01等若未被C1使用，不额外要求全Phase1完成；若实际root build/安全验证触及某项，则在适用性分析中说明并补证据，不能无条件豁免。

历史独立报告可引用原受检SHA作为事实，但不能给后续SHA盖章。entry不要求把所有历史缺陷全量重新审计：需证明批准subject是祖先、相关依赖blob未变且候选main正常consumer/基础回归通过，再由独立gate接受“适用性”；blob变化则重做对应负例。不要为了轻微无关main更新无限重启全部文档设计。

## 8. E3/E4 接受记录、窗口与无循环基线

**固定方案：ONE_ATOMIC_COMPLETE_SUBJECT，业务单写者任务LF-C1-INTEGRATION。** 实际operator/session必须由该任务认领且由治理审批者记录；当前未认领不是设计缺项，不能填一个虚构Agent或把文档作者默认写成实施者。54路径均由这个实施任务串行落盘；MAINLINE_GOVERNANCE只处理已批准的lock派生刷新，独立verifier只写自己的Evidence。详细类别约束见并行协议。

接受记录先可以RESERVED：任务/实际身份已承接，文件集合、baseCandidate、有效期、共享PR清单和冲突处理已批准，但源码窗口尚未开。**E3以有效RESERVED接受记录为条件，不要求OPEN。** E0/E1/E2、该接受记录和E4绑定齐全后，Start Gate才把写窗口派生为OPEN；避免E3与E4互相依赖开工结果。

基线步骤：

1. M0：取已合并设计、G1/G2和实际依赖修复的protected-main候选，核验所有来源和checks。记录eligibleBase=M0，不称approvedMain。
2. 独立Gate记录所接受M0、文档review subject、Authority/54集合/plan/共享资产hash与RESERVED协议。它本身不写自己的Git commit。
3. Gate-only受控提交合并后取得M1；验证M1的first-parent/ancestry、原Gate exact bytes和未扩大变更，重做适用检查。
4. 在独立发布回执/#85记录approvedMain=M1及M1 tree、Gate路径/hash、核验结果。**不把M1再写进产生M1的同一个文件**，避免自引用hash循环。可归档于之后独立的report-only Evidence subject，仍明确被授权base是M1。
5. 实施从M1创建正式短分支；若当前main已变，需要明确delta/依赖影响和新独立绑定，不自动把旧Gate适用于任何后续main。

window失效条件：期限到达、操作者变更、相关authority/依赖/共享文件变化、scope扩展、竞写、撤销、失败的必需验证。保存已有diff，关闭窗口，做针对性rebind；不能自行revert主线。无关变化可保留历史组件成果，但不能跳过新subject的适用检查。

E4必须记录：repo、approvedMain SHA/tree、review SHA/tree、Authority和scope/plan digest、toolchain/lock/build配置、公有contracts入口、6个依赖Schema的id/version/contentHash以及registry/generator实现、shared assets before hash、writer接受记录、各Evidence链接/hash。Git blob SHA和Schema SHA256各自标类型，不混用。

## 9. 正式放行、实施和回滚

#85正式回执必须逐项E0～E4 PASS，给出获准base、有效Start Gate、54业务路径来源、治理刷新许可、实际operator/window、C1-V01～18、限制和独立Evidence。声明仅为READY_FOR_LF_C1，不是LF-C1 IMPLEMENTED/VERIFIED或生产Feedback READY。缺值应列具体缺项，不重复要求重新设计。

实施完成后的机器回执和测试制品由受控执行基础设施/独立Evidence任务按Authority收集，不能要求实现者越过54路径去写自己的批准文件。普通业务文档更新仍与实现一起完成。最终合并subject区分业务、治理hash刷新、独立Evidence；每个写者范围与实际diff都验证。

回滚顺序：先撤销/关闭Start Gate窗口并停止新写入；保留已产生diff/Evidence；未发布业务可受控撤回；若public Schema已有consumer，先评估迁移再撤回。不能删除历史Gate/回执或放松old P1禁止来“解锁”。G1无启用Authority时仍默认拒绝，G2安装失败保持关闭，不半授权。

## 10. 交付边界

本轮已经给出决定正文、选定通路、G0～G3的目标/顺序/路径、四Authority与Evidence字段、14组控制面正反例、E2逐项接受、E3窗口协议、E4发布算法和回滚。治理执行者无需另起一套大设计，只需先审查批准对应任务，再按本文实施。

仍然需要真实外部动作：独立review接受方案、创建/批准相应治理Issue及先验Gate、完成checker代码与验证、主线依赖合并和接受、实际operator认领、最终基线发布。本轮不声称这些已执行。有关机器请求、main和PR的历史Evidence保留原subject，不由此文改写。
