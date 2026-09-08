# LF-C1 独立治理请求与范围预检

状态：`IMPLEMENTED_PREPARATION / LF_C1_BLOCKED`。跟踪 #95；开工裁决仍在 #85。

本操作为既有 P1-O01 范围内的请求和诊断准备，授权来源是用户本轮单独落实 LF-C1 治理入口的要求，经 #95 记录；不继承 #82 修复权限。它没有改变生产代码、现行 dispatcher、冻结 Authority 或任何禁止规则。

## 固定材料与机器请求

- 观察 main：`ed14d4179808621c8ffd5751ebbf7b6704f33b64`。
- LF 文档：PR #84，`877eea857742a2458f2e5c42b3a7d9a261a5a28b`，仍未合并。
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
node scripts/toolchain/verify-scope.mjs --operation LF-C1 --base ed14d4179808621c8ffd5751ebbf7b6704f33b64
```

最后一个命令应失败。测试已处于既有 root Vitest 的 toolchain discovery 范围，不改 test wiring。scope/M0、依赖安装及 hosted 结果绑定实际执行 subject 单独记录，不能把此处命令清单当作已运行证据。

## 当前 E0～E4

| Gate | 实际状态与缺口                                                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0   | 独立 reviewer 对 877eea8 的 LF-RV-01～04 文档修订 PASS；完整 E0 为 UNPROVEN/BLOCKED，D01～D05 缺少定义与来源映射。证据为 #85 评论 5578475306。                         |
| E1   | LF-C1 不被现行 dispatcher 识别；尚无批准的 operation/Authority/精确范围与执行入口。P1 globalDenied 和 suite owner 未改变。                                             |
| E2   | R01/R02/R16：#86 a763f58；R06/R09/R10：#87 cf59066；R08：#88 b624317；#86现已合并为ed14d41，仍需其独立与post-merge Evidence；#87/#88仍未合并。PR检查成功不替代该证据。 |
| E3   | 选择同一原子完整 subject 的单一 LF-C1-INTEGRATION 写者方案，54 路径固定；尚未指定获准操作者、接受记录、base 和窗口。窗口 CLOSED；治理锁写者独立，未经批准不写。        |
| E4   | `approvedMain=null`。ed14d41 仅是观察基线；实际开工须从获准 main 重绑 tree、工具链、Schema/公有入口、Authority 与适用 Evidence。                                       |

不要求等待 C1 不使用的未来 Runtime/Context/Knowledge/Persistence 能力。也不把旧 HEAD、作者声明或未合并 PR 当作上述 Gate 的证明。

## 共享单写者与后续授权边界

候选 LF-C1-INTEGRATION 独占请求中的 Schema、十二实例、原 suite、registry/inventory/planned、types/bindings、package/workspace/lock/build/test/architecture 以及核心和实施文档，在一个完整 subject 提交真实 consumer；不允许两个活动任务同时修改这些文件。操作者和窗口须在正式 Gate 明确接受，目前没有预占他人工作或宣布已承接。

现行 suite 锁只允许 P1-O02；三个 registry/planned 文件锁允许 P1-O02/04/05/06/07。多个 operation 的旧权限不是共享文件并行单写者协议。独立治理写者负责获准 Authority owner/hash 增量；单纯刷新 hash 不允许增加 owner 或解除锁。#86/#87/#88 的冲突路径要串行完成或重新核对实际活动 diff，再开放 LF 窗口。

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
