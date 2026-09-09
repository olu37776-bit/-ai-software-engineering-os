# LF-C1 独立治理请求与范围预检

状态：`IMPLEMENTED_PREPARATION / LF_C1_BLOCKED`。跟踪 #95；开工裁决仍在 #85。

本操作为既有 P1-O01 范围内的请求和诊断准备，授权来源是用户本轮单独落实 LF-C1 治理入口的要求，经 #95 记录；不继承 #82 修复权限。它没有改变生产代码、现行 dispatcher、冻结 Authority 或任何禁止规则。

## 固定材料与机器请求

- 观察 main：`b18059b27e3a9fef089c974f8dd6195d8c17dcf9`。
- LF 文档：PR #84，`a5279ab7a11f023133994b98f7caf86426c69e8c`，仍未合并；相对c2001aa仅CURRENT/main同步，core-entry原字节相同。
- 请求：`operations/phase-1/evidence/o01/lf-c1-entry-request.json`。
- 诊断：`operations/phase-1/evidence/o01/lf-c1-entry-preflight.json`。
- 实际现行机器 Authority：`operations/phase-1/operation.json`、`write-scope.json`、`verification-plan.json`、`authority-lock.json`；请求保存其字节 hash 及工具链、公开入口和 registry 观察绑定。

请求中的 `requestedOperation=LF-C1`、54 个精确路径和 C1-V01～18 均为待授权内容。50 个代码/测试/Contract/接线路径来自冻结 core-entry-plan 的三个清单，另四个实施文档路径来自其同步要求；没有通配符。独立报告不在实施者范围内。权威锁自身的修改仍需独立受控 transition，不能当作普通生成文件加入 LF 写权。

目标机器 Authority 路径固定为 `operations/learning-feedback/core-1/{operation,write-scope,verification-plan,authority-lock}.json`，本次没有创建这些文件。当前 checker 无此操作，放置文件不会使其获得 Authority。

## 可执行检查及含义

```sh
node scripts/toolchain/check-lf-c1-scope-request.mjs
node scripts/toolchain/check-lf-c1-scope-request.mjs --paths-json /absolute/path/to/sorted-paths.json
```

路径文件为排序、去重的 JSON 字符串数组。检查器核对候选路径与冻结文档、十八项要求、main/tree 和机器 Authority hashes，并调用现有 scope policy 重现 `UNKNOWN_OPERATION: LF-C1` 和 P1-O02 的 learning 拒绝。越界、通配符、路径逃逸、大小写错配、重复、偷加路径或删除验证要求均拒绝。

输出 `requestValidation=PASS` 只说明请求范围检查完成；决策始终为 `BLOCKED`，退出码为 2。它不访问 GitHub、不验证实时 main/保护规则/独立审批，不具有开工授权能力，也没有接入或替换 `verify:scope`。原 dispatcher 的正常 CLI 拒绝也由测试实际运行。不得将本预检当成 E1 已存在的正式范围执法器。

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm exec vitest run tests/qualification/toolchain/lf-c1-scope-request.test.mjs
node scripts/toolchain/verify-scope.mjs --operation LF-C1 --base b18059b27e3a9fef089c974f8dd6195d8c17dcf9
```

最后一个命令应失败。测试已处于既有 root Vitest 的 toolchain discovery 范围，不改 test wiring。scope/M0、依赖安装及 hosted 结果绑定实际执行 subject 单独记录，不能把此处命令清单当作已运行证据。

## 当前 E0～E4

| Gate | 实际状态与缺口                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0   | D01～D05 已在 c2001aa 恢复；不是旧“定义缺失”。新独立审查发现 ADR 接受顺序循环（discussion_r3954170418）和下位 LF 委托不能满足上位 P1 锁（discussion_r3954170420）；完整新 E0 仍 BLOCKED。   |
| E1   | LF-C1 不被现行 dispatcher 识别；尚无批准的 operation/Authority/精确范围与执行入口。P1 globalDenied 和 suite owner 未改变。                                                                  |
| E2   | #86/#87/#88均已合并且为b180祖先。本次独立R01/R16/R06/R09/R10/R08适用性PASS；R02仍BLOCKED：普通M0漏查独立receipt的本地Evidence存在性。完整复现/限制见#85评论5580724172，不声称绕过PR scope。 |
| E3   | 选择同一原子完整 subject 的单一 LF-C1-INTEGRATION 写者方案，54 路径固定；尚未指定获准操作者、接受记录、base 和窗口。窗口 CLOSED；治理锁写者独立，未经批准不写。                             |
| E4   | approvedMain=null；b18059b 只是观察/准备包执行 base，尚无合法安装和 Start Gate/获准窗口。                                                                                                   |

不要求等待 C1 不使用的未来 Runtime/Context/Knowledge/Persistence 能力。也不把旧 HEAD、作者声明或未合并 PR 当作上述 Gate 的证明。

## 共享单写者与后续授权边界

候选 LF-C1-INTEGRATION 独占请求中的 Schema、十二实例、原 suite、registry/inventory/planned、types/bindings、package/workspace/lock/build/test/architecture 以及核心和实施文档，在一个完整 subject 提交真实 consumer；不允许两个活动任务同时修改这些文件。操作者和窗口须在正式 Gate 明确接受，目前没有预占他人工作或宣布已承接。

现行 suite 锁只允许 P1-O02；三个 registry/planned 文件锁允许 P1-O02/04/05/06/07。多个 operation 的旧权限不是共享文件并行单写者协议。治理变更必须先获得上位授权；仅下位 LF Authority 委托并保持旧 P1 owners 不变的方案已被独立 P1 finding 否定，不能作为可执行许可。业务54路径仍与裁判/Authority lock分开；单纯刷新 hash 不允许增加 owner 或解除锁。#86/#87/#88已合并；实际预约前仍要重新查询全部活动 PR diff，不能把这次无竞争观察当窗口接受。

正式接续须区分两个流程：

1. 普通 P1-O01 基础设施可以按既有 scope 单独实施并独立验证，缺 prior Gate 并不禁止所有脚本改动。但本 #95 的六文件范围不含修改正常 dispatcher/M0/workflow。
2. 冻结 Authority amendment 必须有独立 prior authorization Gate 先进入 protected main。现有 amendment 路径/owner ID 校验只接受既定 P1 范围，不能直接表达 LF namespace；须先在单独明确范围中建设和独立验证受控接入。
3. 之后按真实 Gate 冻结精确 amendment paths、owner 增量、唯一分支和 direct-child main 绑定，再实施 Authority；不能复制 #71 JSON 或让同一个变更在 HEAD 中创建 Gate 批准自己。
4. 正式 LF dispatcher 必须从获准基线读取 Authority，校验 operation/分支/base、完整新增/修改/删除/重命名及未跟踪路径、共享锁 owner/hash transition；没有 prior Gate、错主线、旧 Evidence、额外路径或禁止语义必须失败。正常 required verify 与 post-merge 路径必须实际接入，单独命令或作者 JSON 不足以通过。
5. 获准 subject 独立验证、受保护 main 适用复验、#85 E0～E4 全部闭合后才发行开工回执。新 HEAD 重新证明，不能自动沿用此诊断或文档 review。

后续具体接线实施范围尚未获准，不从 #95 六文件授权继承。需要上位决策时保留 BLOCKED，不删禁令，不伪装 P1-O02。

## 本次精确写范围与回滚

```text
docs/implementation/phase-1/o01/lf-c1-entry-governance-request.md
operations/phase-1/evidence/o01/lf-c1-entry-preflight.json
operations/phase-1/evidence/o01/lf-c1-entry-request.json
operations/phase-1/executions/p1-o01-lf-c1-entry-preparation.json
scripts/toolchain/check-lf-c1-scope-request.mjs
tests/qualification/toolchain/lf-c1-scope-request.test.mjs
```

均为 P1-O01 当前可写路径，与 #82 修复文件不重叠。回滚通过普通 PR 撤回准备包，不改历史 Evidence 或他人分支。独立复核结果记录 #85/#95，作者最多声明请求/诊断已实现，不声明 LF-C1 或本准备包 VERIFIED。

## 准备包独立发现的修复

a4deb7e 的独立审查发现诊断依赖未合并 PR 的 Git object，在普通干净 clone 中不可复现。请求现附原始 source 文档 UTF-8 快照并按原 SHA256 校验，固定 commit/tree 仍作追溯；快照不是 Authority。正常测试新增干净单分支 clone 复现与篡改快照拒绝。新 subject 另行独立复核，不继承旧 FAIL/PASS。

## G0 来源刷新（本轮实际边界）

从 c2001aa 的 core-entry 原字节更新 commit/tree/SHA256/UTF-8 快照；逐字比较54路径和18项要求与8826c45请求一致。decision-register、authority-transition-plan、parallel-protocol仅记录只读来源hash，不作为批准。同步b18059b采用普通双父追加，保留主线原字节。六文件总范围不扩展；正常dispatcher、禁止规则、accepted ADR和四份现行Authority均不改变。

G0可以完成请求刷新，但G1不获授权：ADR必须先被合法接受，且共享许可必须可由上位P1 Authority表达。两个远端独立finding见[ADR顺序](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3954170418)和[上位共享锁](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84#discussion_r3954170420)。本次不自行选择新权限语义，不建checker/Authority，不把设计修订或请求检查记成READY。最终只读复核和准确运行subject记录PR97/#85评论；旧报告保留历史，不继承PASS。
