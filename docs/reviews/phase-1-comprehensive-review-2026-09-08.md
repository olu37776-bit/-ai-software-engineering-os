# AI Software Engineering OS 全面独立审查

审查日期：2026-09-08  
仓库：[olu37776-bit/-ai-software-engineering-os](https://github.com/olu37776-bit/-ai-software-engineering-os)  
固定审查提交：[`3c387f5f196ddfae8e8989710d5a55f9def472a7`](https://github.com/olu37776-bit/-ai-software-engineering-os/commit/3c387f5f196ddfae8e8989710d5a55f9def472a7)  
Tree：`5938f8e2f3e3a5e5dfbd0fde5ac66c092f2a7117`  
结论：**REQUEST_CHANGES；当前基础实现不能通过本次独立审查，Phase 1 尚未完整 VERIFIED。**

## 1. 主要判断

仓库已经完成了一批真实、可构建的基础实现：Contracts、Policy、PersistenceWorker、Control API/CLI、Windows PROCESS_RESTRICTED 与 Windows 资格制品。当前 main 的六个 GitHub 检查全部成功，固定工具链也能在本次干净 checkout 安装和构建。

但通过现有测试并不等于关键不变量成立。本次五路独立审查确认 **16 项缺陷：7 项 P1、9 项 P2**。主要风险集中在：合并门禁没有汇总真正的质量检查；真实回执没有实例校验；Policy 的异常引用可能放行；持久化准入与恢复分类不可靠；canonical JSON 可产生不可读的持久化内容；单实例锁存在竞争。

建议保留现有架构和已完成实现，先修复这些具体边界，再做 P1-O09 综合收口。没有证据支持因为这些问题重新设计整套框架，也没有证据支持立即进入 Phase 2 或替换本地框架。

P1 表示应在下一阶段建立于该基础之前修复的高优先级正确性、权威或门禁问题；P2 表示应纳入本轮修复计划的中优先级缺陷。未认定 P0。额外记录 1 项需 Windows 实机复现的候选高风险，**不计入上述 16 项确认缺陷**。

## 2. 当前工作的实际位置

| 项目 | 审查观察 |
| --- | --- |
| protected main | 固定 SHA 如上；结束前再次查询，未漂移 |
| 最新合并 | [PR #80](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/80)，P1-O08 Windows 资格制品，2026-09-01 合并 |
| 开放 PR | 0 |
| 开放 Issue | #29、#41、#44、#48、#53，均为历史治理/授权事项；本次未操作其状态 |
| P1-O01～O08 | 已有代码、execution 与 Evidence；本次发现意味着受影响子操作需修复后重新验证 |
| P1-O09 / P1-V10 | 未发现 O09 execution、最终 implementation receipt、o09 Evidence 或整阶段最终独立 Gate |
| README / Current Progress | 仍分别写 NOT_STARTED、Current NONE / Next P1-O01，与已合并 O08 不一致 |
| GitHub Release | 当前没有；O08 明确是非生产 qualification artifact，这本身不是缺陷 |
| 本地完整框架替换 | 尚不具备；生产 Kernel/Workflow/Node、验证系统、学习层和真实本地集成本来就属于后续阶段 |

冻结的 `operation.json` 保留 `PLANNED` 是既定规划策略，不能直接把它当作状态错误。应同步可变 current status、execution/receipt 和 Evidence 索引，而不是为显示进度修改冻结规划。当前入口文档滞后与 O09 缺失作为收口事项记录，未重复计入 16 项代码/门禁缺陷。

main 保护规则：[Ruleset 21648824](https://github.com/olu37776-bit/-ai-software-engineering-os/rules/21648824)，active、无 bypass、strict up-to-date。唯一 required context 是 `verify`，审批人数要求为 0。其具体覆盖缺口见 R01。

## 3. 确认发现总表

| ID | 优先级 | 发现 | 主要属主 |
| --- | --- | --- | --- |
| R01 | P1 | 唯一 required verify 可放过不能编译的生产代码 | P1-O01 / 治理与工作流 |
| R02 | P1 | 真实最终回执无效、越权声明 VERIFIED，仍可通过反假声明检查 | 治理 verifier / P1-O09 |
| R03 | P1 | Policy 未定义常量可导致 ALLOW 或跳过 DENY | P1-O04 / policy |
| R04 | P1 | Event/outbox payload 未按声明 Schema 验证就进入权威数据库 | P1-O05 / persistence |
| R05 | P1 | 无效启动参数使健康数据库被隔离，合法重试仍无法打开 | P1-O05 / persistence |
| R06 | P1 | 稀疏数组生成非法 canonical JSON，可提交成功后读取失败 | P1-O02 / contracts |
| R07 | P1 | stale-lock 清理竞争允许同时存在两个成功锁属主 | P1-O06 / platform |
| R08 | P2 | apps/cli、runtime、worker 没有纳入架构门禁 | P1-O03 / architecture |
| R09 | P2 | allOf 条件语法被类型生成遗漏，Schema/type 一致性假通过 | P1-O02 / contracts |
| R10 | P2 | 全局 date-time validator 接受不存在的日期和时间 | P1-O02 / contracts |
| R11 | P2 | 已有数据库被截为零字节后，自动初始化为空库并报告正常 | P1-O05 / persistence |
| R12 | P2 | 请求超时返回 504 后未及时释放并发槽 | P1-O06 / platform |
| R13 | P2 | SSE UTF-8 跨网络分片时中文内容静默损坏 | P1-O06 / client |
| R14 | P2 | 根 build 漏复制 Win32 bridge，构建成功但 provider 不完整 | P1-O01/O07 / build |
| R15 | P2 | 离线资格验证把任意 127.* 主机名当作 loopback | P1-O08 / qualification |
| R16 | P2 | 历史补验 dispatch 的 Evidence 绑定 controller SHA，错指被测提交 | P1-O01 / Evidence |

## 4. 高优先级发现与修复验收

### R01 — 必需合并检查没有覆盖真实质量

**位置：** `.github/workflows/m0-independent-verify.yml:24–29,95–113`；`quality.yml:113–123`；当前 Ruleset。

`verify` 只运行 scope 与 M0 结构/authority 检查，没有等待或汇总 quality/release。两个平台构建、安全 qualification、打包虽然会运行，却不是 required checks；质量汇总 job 也不是 required。

独立本地副本中，仅在 P1-O08 合法路径 `apps/cli/src/index.ts` 注入 `export const REVIEW_INVALID_SYNTAX = ;` 并添加对应 execution：scope PASS，M0 **14/14 PASS**，真实 tsc 报 **TS1109、退出 2**。没有改 verifier、schema、workflow 或 authority lock，也没有向远程提交此故障。

**影响：** GitHub 的实际硬门禁不能确保不能编译、测试失败或适用 R4 验证失败的代码被阻止合并。

**修复验收：** 将唯一 `verify` 作为当前适用硬门禁的最终汇总，或按治理流程增加必需 checks；任一适用检查 failed/cancelled/unavailable 不得放行。用同类语法错误、失败行为测试和包装失败验证真实合并门禁；同时明确阶段依赖，不能把尚未到达的全阶段人工 Gate 强加给每一个基础实施 PR。

证据：`required-verify-invalid-code.patch`、对应 scope/M0 JSON 与 syntax.txt。定位：[required workflow](https://github.com/olu37776-bit/-ai-software-engineering-os/blob/3c387f5f196ddfae8e8989710d5a55f9def472a7/.github/workflows/m0-independent-verify.yml#L95)。

### R02 — 真实回执没有被 Schema 校验

**位置：** `scripts/governance/verify_m0.py:692–711,873`；`scripts/toolchain/verify-scope.mjs:900–909,1406–1439`。

`verify_receipt_guards` 只验证 schema 自身和内存中构造的负面 fixture，没有校验实际 `operations/phase-1/implementation-receipt.json`。

独立 P1-O09 副本加入声明 `implementationDeclaration:"VERIFIED"`、缺少 commit/Evidence 等信息的最终回执，scope/M0 仍 **14/14 PASS**；同一仓库 schema 对它直接验证得到 **20 个错误**。当前 main 尚无此文件，不代表已有伪造回执；确认的是即将收口时会遇到的真实门禁缺口。

**修复验收：** 对实际回执实施强制实例校验和引用验证；缺失表达为未完成，存在但非法必须失败。校验 Evidence、subject SHA、plan/authority、独立回执与 Gate。保留负面 fixture 但不能用它替代实例入口验证。

证据：`required-verify-invalid-receipt.patch`、对应 scope/M0/schema-errors JSON。定位：[receipt guard](https://github.com/olu37776-bit/-ai-software-engineering-os/blob/3c387f5f196ddfae8e8989710d5a55f9def472a7/scripts/governance/verify_m0.py#L692)。

### R03 — Policy 异常引用可变成许可

**位置：** `packages/policy/src/index.ts:483–490,1023–1039`。

编译器只检查 constant 引用的拼写和命名空间，没有确认常量存在；求值时 missing constant 成为 `undefined`，`eq` 正常返回 false，`notEq` 正常返回 true。

复现：ALLOW 条件改为 `notEq constant.MISSING "DENY"`，编译成功，结果 **ALLOW、reasonCodes=[]**。给合法 allow-read 增加一个引用 missing constant 的 DENY，DENY 被跳过，结果 **ALLOW_WITH_REQUIREMENTS**。不需要未来 Kernel 集成即可触发。布尔值与字符串进行 notEq 的类型错配也可放行。

**修复验收：** 在编译阶段解析所有引用，未定义引用拒绝；明确操作数类型兼容。嵌套条件、ALLOW/DENY、eq/notEq/in/not 都需负例，尤其保证“坏 DENY + 好 ALLOW”仍 fail closed。符合 ADR-0011 的 invalid/indeterminate 处理。

证据：`persistence-policy-probes.json`。定位：[Policy 求值](https://github.com/olu37776-bit/-ai-software-engineering-os/blob/3c387f5f196ddfae8e8989710d5a55f9def472a7/packages/policy/src/index.ts#L1023)。

### R04 — 权威持久化准入只验证外层 envelope

**位置：** `packages/persistence/src/index.ts:221–226`；`persistence-worker.ts:475–513`；资格 helper `tests/qualification/persistence/helpers.mjs:3–6,26–49`。

commit 只校验 JournalAppendBatch；worker 校验 aggregate/version 和 payload hash，没有按 `payloadSchema` 解析并验证内容。

未知 schema 的 Event/outbox payload，canonical registry 明确返回 `UNKNOWN_SCHEMA`，仍成功提交 version 1，recover 报 Event/outbox/receipt/audit 均存在且 `integrity:ok`。另一个 payload 明确 `SCHEMA_VALIDATION_FAILED`，仍可提交。现有 helper 的 `{sequence:1}` 恰恰声明了不匹配的 fixture-change-node-contract，因此现有正向测试本身在接纳无效事实。

**修复验收：** 使用唯一 canonical registry 解析 schemaId/version/hash 并校验 payload，再开始事务；修正 fixture。未知 schema、不符 payload、版本/hash 错误都必须 typed rejection，journal/outbox/receipt/audit 无变化；真正合法事实可提交和回放。此次错误 hash 探针同时含非法 payload，不把它宣称为隔离后的 hash-only 证明。

证据：`persistence-policy-probes.json`。定位：[payload admission](https://github.com/olu37776-bit/-ai-software-engineering-os/blob/3c387f5f196ddfae8e8989710d5a55f9def472a7/packages/persistence/src/persistence-worker.ts#L475)。

### R05 — 参数错误被当成数据库损坏并持久隔离

**位置：** `packages/persistence/src/index.ts:205–206`；`persistence-worker.ts:419–428,1154–1177`。

API 允许正数 busyTimeoutMs，但 worker 上限是 60000；任意 initialization failure 都会对已有非空 DB 执行 quarantine。

复现：创建并提交健康数据库（77,824 字节），关闭后使用 `busyTimeoutMs:60001` 打开。尚未正常打开 SQLite 就因参数被拒绝，却把数据库移动到 `.corrupt-*` 并创建 RECOVERY_REQUIRED marker。改回合法参数仍无法启动。

**影响：** 一个配置错误变成需要人工恢复的持续故障。原始字节仍保留在隔离文件，未观察到它们被删除。

**修复验收：** 统一入口和 worker 的参数边界，先校验配置；仅在确证实际 corruption/需要隔离的情况进入 quarantine。invalid option 后的合法重试必须正常读取原始事实，路径/数据不被移动，也不产生恢复 marker；保留真实 corruption 用例。

证据：`persistence-policy-probes.json`。定位：[初始化 catch](https://github.com/olu37776-bit/-ai-software-engineering-os/blob/3c387f5f196ddfae8e8989710d5a55f9def472a7/packages/persistence/src/persistence-worker.ts#L1154)。

### R06 — canonical JSON 可生成无法解析的持久化内容

**位置：** `packages/contracts/src/canonical-json.ts:13–15`；下游写入 `persistence-worker.ts:618–619`。

`Array.map` 跳过稀疏数组空槽，导致 `Array(1)` 被序列化为 `[]`，与真正空数组字节/hash 相同；`{items:Array(2)}` 变成非法 JSON `{"items":[,]}`。

公共 PersistenceWorker 复现：使用该 payload 及其“合法生成”的 hash，**commit 成功**；`readEvents` 随后报 `Invalid canonical JSON in event journal`，recover 却仍报告 `integrity:ok`。确认的是可被当前准入接受的数据损坏路径；R04 加强准入与本共享序列化问题都需修复，不能互相替代。

**修复验收：** canonical 边界明确只接纳可表达的 JSON 值，拒绝空槽等不支持的 JS 值；每个成功序列化结果可解析且按约定保持语义。增加嵌套稀疏数组、hash 区分及真实持久化零写入负例。

证据：`contracts-review/contracts-probe.json`、`persistence-sparse-probe.jsonl`。定位：[canonical serializer](https://github.com/olu37776-bit/-ai-software-engineering-os/blob/3c387f5f196ddfae8e8989710d5a55f9def472a7/packages/contracts/src/canonical-json.ts#L13)。

### R07 — 单实例锁存在双属主竞争

**位置：** `packages/platform/src/filesystem.ts:103–131`。

读取旧锁确认 stale 后无条件删除路径；其他调用可能已经建立新锁。空/部分写入的 lock JSON 也被当成可删除的旧锁。

用真实构建产物对同一临时 data root 并发 32 次 acquire，200 轮留档结果中 **9 轮出现两个成功属主**；部分轮次所有调用返回后锁文件已经不存在。期间没有提前释放成功锁。

**影响：** 违反单实例约束；双监听和共享 descriptor/token 被相互覆盖是下游调用链的可达后果，但本探针只直接证明锁双属主，未把完整双 runtime 运行冒充为已观察事实。

**修复验收：** 采用有完整排他与进程生命周期语义的锁协议。仅在删除前再读取一次仍有 TOCTOU。验证多进程并发冷启动、stale 恢复、创建中途崩溃；始终最多一个成功属主，失败者不能移除成功者的锁/token/descriptor。

证据：`control-api/probe-lock-output.jsonl`。定位：[锁恢复](https://github.com/olu37776-bit/-ai-software-engineering-os/blob/3c387f5f196ddfae8e8989710d5a55f9def472a7/packages/platform/src/filesystem.ts#L117)。

## 5. 中优先级发现

| ID | 精确位置 | 实证、影响与验收要求 |
| --- | --- | --- |
| R08 | `tests/architecture/architecture-policy.json:5,7–78`；`scripts/architecture/architecture-policy.mjs:215–242` | sourceRoots 没有 apps，三个 apps 也没有 package policy。在临时副本给 CLI 加入真实 persistence 深导入，标准 qualify 仍 PASS；显式扫描 apps 才报 DEEP_IMPORT。加入完整 workspace inventory 与明确 app 权限，未知 package fail closed；测试必须走正常入口。只扩 sourceRoots 仍会把 apps 当根包，权限过宽。 |
| R09 | `scripts/contracts/type-model.mjs:78–101`；`schema-type-consistency.mjs:49–64`；`types.generated.ts:454` | PolicyRule.when 的 allOf 条件语法被降为 Record。删除 schema 中 eq operator，运行 validator 的接纳语义改变，但生成类型逐字不变、一致性仍 PASS。显式支持影响形状的组合/引用，或拒绝不支持的结构；独立断言 condition operator/必填字段，不能同一生成器自证。 |
| R10 | `packages/contracts/src/json-schema.ts:11,25` | date-time 只校验形状，接受 `2026-99-99T99:99:99Z`、2月31日、`+99:99` 偏移。会把无效时间送给假定已验证的消费者；未证实安全绕过，优先级低于其他 P2。使用统一日历感知 RFC3339 校验，覆盖闰年/月日/时区边界。 |
| R11 | `persistence-worker.ts:159–165,178–179,462–466,1126` | fileExistsWithBytes 将 0 字节视为不存在。先提交2个 Events再模拟外部截断，重启自动创建空库，recover 报0 Events、integrity ok。应用未造成截断，缺陷是掩盖其结果。区分 ENOENT 与现存空/不可读 DB，后者进入明确恢复处理。 |
| R12 | `packages/platform/src/server.ts:414–430,301–309,601,802–803` | 有效 token 的 chunked 请求不结束 body；100ms deadline 返回504，但150ms后另一 health 仍503并发满，旧socket仍开着。取消输入读取/后续路由并恰好释放一次资源，验证超时后 health 可恢复。不是无认证攻击，也不声称底层连接永久不回收。 |
| R13 | `packages/platform/src/client.ts:599–600` | 每chunk独立toString UTF-8。将“中”的字节跨chunk，public SSE client把“中文资料”变成“���文资料”，notificationId不变且校验接纳。用流式decoder或完整字节帧解码；中文/emoji每个字节切分应保持对象完全相同。 |
| R14 | `package.json:12`；adapter `package.json:17`、`windows-process-restricted.ts:29,199–205` | 独立 fresh git archive 根build退出0，JS已生成但win32-bridge.ps1不存在；特殊isolation:build才补齐。规范根build包含必需运行资产，并验证生成字节与源一致，不能先单包build再测试根build。 |
| R15 | `scripts/release/qualify-windows-x64.mjs:36–58,110–112` | startsWith('127.') 接受 `127.example.invalid`、`127.0.0.999`。原始guard加DNS spy后，两者被转发给底层并记ALLOW_LOOPBACK；未发送外网请求。只允许正向解析的loopback字面地址，阻止hostname先进入DNS；补127开头外域负例。 |
| R16 | `scripts/toolchain/emit-ci-evidence.mjs:7`；`quality.yml:43–55,67–75,110–111` | 历史dispatch checkout target，但GITHUB_SHA指controller，emitter优先后者。原始表达式+真实checkout隔离复现subjectMismatch=true；没有声称重新调度GitHub workflow。subject以实际HEAD为准且与target断言一致，controller另记provenance，测试target≠controller。 |

对应原始材料分别位于 `contracts-review/`、`persistence-zero-truncate-probe.jsonl`、`control-api/`、`isolation-release/` 和 `dispatch-evidence-subject-mismatch.json`。五份分项报告提供更细行号与复现说明。

补充观察，不另计数：Control API client 对普通请求只认可“任意2xx”，没有按路由绑定具体成功状态；/health 返回201和合法JSON时仍被接受。这与现有 status-binding Evidence 的严格表述不一致，可与 R13 一并收敛。

## 6. Windows 待验证风险

**WR01：Node/Worker 宿主崩溃后，bridge 持有的 Job Object 是否仍让工具树存活。**

Windows bridge 由独立 PowerShell 进程运行并持有 Job Object；Node 侧只有活着时通过 AbortSignal 写取消 marker。bridge 循环观察目标退出、marker和预算，没有看到对 Node 宿主死亡的 lifeline。Job 的 kill-on-close 绑定的是实际句柄持有者；Node 死亡不当然使另一进程的句柄关闭。可能直到任务预算到期才清理工具树。CreateProcess(suspended) 到 AssignProcessToJobObject 之间也有需检查的窗口。

位置：adapter `windows-process-restricted.ts:541–574`；`win32-bridge.ps1:498,520–535,565–629,642–705`；现有 security tests `142–200`。微软 [Job Objects 文档](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) 支持上述句柄生命周期推理。

这是**源码与 Win32 语义推断，未在本次 Linux 环境动态复现**。现有 GitHub Windows测试成功，但未覆盖“仅强杀Node宿主”场景，不能据此消除此风险。

修复前先在 Windows 对 readiness 完成的树记录所有 PID，仅杀 Node 宿主（不用 taskkill /T），证明 bridge/root/child/grandchild 在清理预算内退出；再测 create-before-assign 窗口。探针必须保证最终清理。若失败，再按既有隔离 authority 修复生命周期，而不是只补信号回调。

## 7. 本次验证记录与限制

| 验证 | 本次结果 |
| --- | --- |
| 固定工具链 | Node 24.19.0、pnpm 11.24.0、TypeScript 6.0.3 |
| clean frozen install | PASS；最初环境pnpm11.19导致明确拒绝，之后通过独立Corepack shim使用11.24，未改仓库版本或关闭校验 |
| 根 build | PASS；必需bridge遗漏由R14单独揭示 |
| format / lint / generated-types / typecheck | PASS |
| 根 Vitest 主suite | 270 passed、8 Windows skipped、1环境失败（共279） |
| 该环境失败 | `networkInterfaces()` 返回 uv_interface_addresses error；不是本次确认的生产代码缺陷；没有伪造网卡信息或跳过该断言后宣称quality PASS |
| architecture tests | 9 passed |
| platform package tests | 5 passed |
| Windows adapter package tests | 2 passed、6 Windows skipped |
| worker package tests | 2 passed、1 Windows skipped |
| packaging tests | 21 passed、1 Windows skipped |
| contracts/architecture/persistence/control-api qualifiers | 各命令退出0并产出PASS |
| isolation qualifier | Linux上provider UNAVAILABLE，平台专属步骤NOT_APPLICABLE；仅通用/no-downgrade验证，不冒充Windows PASS |
| config / versions / frozen-install verifier | PASS |
| 五路独立反例 | 16项确认缺陷；原始脚本、输出、故障diff归档 |
| 远程main HEAD复核 | 六checks success；结束时SHA仍不变 |

本地 `pnpm quality` 因上述网卡枚举测试失败而退出1，**本次不声明全量 quality PASS**。后续链式命令逐项单独运行并记录了返回码，没有修改测试来制造完整绿灯。

已实际读取的当前HEAD远程日志：

- [Linux quality](https://github.com/olu37776-bit/-ai-software-engineering-os/actions/runs/33481205705/job/99771005908)：主suite 271 passed/8 skipped，architecture 9 passed。
- [Windows quality](https://github.com/olu37776-bit/-ai-software-engineering-os/actions/runs/33481205705/job/99771006149)：主suite 279 passed，architecture 9 passed，并通过Windows provider qualification。
- [Windows clean startup](https://github.com/olu37776-bit/-ai-software-engineering-os/actions/runs/33481205655/job/99771148665)：5 passed；与当前SHA关联。
- [M0 verify](https://github.com/olu37776-bit/-ai-software-engineering-os/actions/runs/33481205717/job/99771006081)：检查状态success；所执行门禁的覆盖限度见R01/R02。

O08仓库内Evidence绑定实现提交 `62f14d7…`；当前main另有上述post-merge检查。两者必须区分，不因为历史Evidence SHA不同就否认存在新检查，也不能拿旧Evidence直接签当前整阶段Gate。下载接口返回了当前V09 Evidence的ZIP引用，但本地获取其字节遇HTTP403；因此本次未声称逐字节审阅当前main的该ZIP内容。历史仓库内JSON、当前artifact元数据和当前job日志已读。

资格制品artifact在快照时未过期，计划过期时间为2026-09-08T07:15:12Z；Evidence artifact为2026-09-15T07:16:05Z。这是交接可复用性约束，应在O09收口时固定必要证据；不把未做正式生产Release/signing当作O08越界缺陷。

## 8. 修复与复验顺序

1. **先修验证入口：R01、R02、R16。** 将适用质量结果、真实回执与真实subject绑定落实到机器Gate。否则后续修复仍可能“错误也通过”。
2. **并行修核心边界：** Contracts处理R06/R09/R10；Policy处理R03；Persistence在共享Contract修复基础上处理R04/R05/R11；Control API处理R07/R12/R13。明确各自WRITE_SCOPE，涉及authority或scope变化走仓库正式治理。
3. **补齐构建/架构/资格入口：R08/R14/R15。** 在Windows执行WR01宿主崩溃探针，按结果完成修复或留下有根据的风险决定。
4. **独立验证新的immutable HEAD。** 正例、故障路径、上述反例都纳入适用验证；Implementation只能声明IMPLEMENTED。修复后不复用旧SHA的VERIFIED结论。
5. **完成P1-O09/P1-V10。** 生成合法implementation receipt、Evidence索引、known gaps、独立回执和最终Gate；同步README/current status与已完成治理Issue的交接状态。exact merge后再验证protected main。

建议下一份仓库正式 remediation authority 使用 `docs/reviews/phase-1-comprehensive-review-2026-09-08.md` 作为问题基线，并由批准的scope承载各修复执行记录。该路径是后续落库建议，**本次并未在GitHub创建或修改此文件**。

## 9. 审查范围、归档和声明

审查覆盖8个已落地workspace项目、Contracts/schema/type工具、Policy、PersistenceWorker与迁移、Control API/CLI/runtime、Windows adapter/worker、release/manifest/SBOM/provenance、架构规则、toolchain/scope/M0、Phase1规划/执行/证据、实时PR/Issue/check/ruleset。

以下属于既定后续阶段或明确非目标，没有当作本轮实现缺陷：生产Kernel/Workflow/Node状态机、完整NodeExecutionRecord运行闭环、生产验证系统/EvidenceGraph/学习层、GBrain/真实模型/私有Workspace接入、OS_SANDBOXED、完整Human Approval、正式签名发行和自动更新。

本轮采用主审+五路独立审查；原始checkout固定、未改生产或authority文件，未写远程PR/Issue/评论/设置，未合并。故障代码与非法回执只存在独立本地审查副本，所有临时数据库使用新建临时data root。7个P1和9个P2均有源码依据与针对性复现；R16明确只复现实际表达式，WR01明确仅是待Windows验证的推断。

证据包 `ai-software-engineering-os-review-evidence-2026-09-08.zip` 包含本报告、5份分项报告、固定GitHub元数据、3份当前HEAD远程日志、本地验证日志、原始反例及人工mutation patch。没有打包依赖目录或完整仓库副本。文件清单与SHA-256位于包内 `artifact-index.json`。

本报告是本次固定HEAD的独立审查结果，不自动替代仓库正式Authority，也不授予修改accepted ADR/扩大实现scope的权限。
