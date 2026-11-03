# KB-P0-U：发布前置阻塞闭环与条件式受控发布 V1

状态：`CURRENT TASK / PREFLIGHT REPAIR AND CONDITIONAL PUBLISH`；跟踪：Issue #115。
上位：`architecture/overall-design-v1.md`、`tasks/kb-p0-controlled-publication-v1.md`。

## 一、为什么需要这一轮

用户本机 KB-P0 Preflight 报告四个阻塞：

- `P0-B1`：PR #116 当时尚未合并，旧 SHA 只有分支权限。
- `P0-B2`：两个正式 Knowledge Git 仓库的 Windows Owner 为 `BUILTIN\Administrators`，而执行用户不同，Git 拒绝 dubious ownership。
- `P0-B3`：GBrain 两个 Source 的 `tracked_branch = null`，Agent 无法证明索引绑定到目标知识提交对。
- `P0-B4`：尚无已经验证的正式消费者暂停/阻断机制。

`P0-B1` 现已由 GitHub 合并 PR #116 到 main commit `009132b02f0caa06d0000b3f00b5f4393c270ba2` 解决。其余必须通过实际本机 Evidence 逐项关闭。**本任务一轮内修 preflight、核对证据；仅当全部满足时在同一任务调用既有 KB-P0 发布流程。** 不新建重复性长调查。

## 二、Authority 与执行边界

- 当前 Agent 工作区必须是已知 Swap 项目仓库，长期治理根 `<SwapRepo>\.ai-local\knowledge\reconstruction\`。
- 只下载固定 SHA 下 `authority-index.md`、本文件、`tasks/kb-p0-controlled-publication-v1.md`、`architecture/overall-design-v1.md`、`operations/authority-sync.md`，使用 Raw GitHub exact path。
- 禁止 clone/fetch/pull/checkout Framework 整仓、Archive/ZIP。
- 在本次 Authority 所在 PR **合并 main 前，只允许只读检查与 preflight 报告**；正式知识 Git Promotion/GBrain Sync 必须在该 exact Authority SHA 合并到 main、且全部下列检查 PASS 后才执行。
- 过去 F0/F1 的实际 manifest、候选 HEAD、正式 HEAD、Review evidence 不重建、不修改、不臆造；仍按 KB-P0 原任务 preflight 要求冻结 exact subject。

## 三、U1：Git 仓库所有权与当前权限（P0-B2）

先只读执行并保留结果：

```powershell
whoami /user
whoami /groups
Get-Acl 'D:\gbrain-knowledge\swap-kb'
Get-Acl 'D:\gbrain-knowledge\swap-kb\.git'
Get-Acl 'D:\gbrain-knowledge\microwave-kb'
Get-Acl 'D:\gbrain-knowledge\microwave-kb\.git'
icacls 'D:\gbrain-knowledge\swap-kb'
icacls 'D:\gbrain-knowledge\microwave-kb'
```

确认真实 OWNER、ACL、当前用户权限、`.git` 实际归属及两个绝对目录确为用户授权的正式 Knowledge Repo。若存在不可信第三方可修改仓库配置、hooks 或代码，`TRUST_NOT_ESTABLISHED`，不得添加 Git trust 例外。

如果这是用户明确授权且可以信任的自有 Knowledge Repo，仅在**当前 Agent 进程及其子进程**设置两个精确 Git `safe.directory`，用于解决 Git 所有权检测；本操作不修改原仓库 owner/ACL，不会提升 NTFS 权限：

```powershell
$env:GIT_CONFIG_COUNT = '2'
$env:GIT_CONFIG_KEY_0 = 'safe.directory'
$env:GIT_CONFIG_VALUE_0 = 'D:/gbrain-knowledge/swap-kb'
$env:GIT_CONFIG_KEY_1 = 'safe.directory'
$env:GIT_CONFIG_VALUE_1 = 'D:/gbrain-knowledge/microwave-kb'
git -C 'D:\gbrain-knowledge\swap-kb' rev-parse HEAD
git -C 'D:\gbrain-knowledge\microwave-kb' rev-parse HEAD
git -C 'D:\gbrain-knowledge\swap-kb' status --porcelain=v1
git -C 'D:\gbrain-knowledge\microwave-kb' status --porcelain=v1
```

上面必须由发布执行进程继承同一组环境变量，需确认本机 Git 版本接受命令作用域 protected config。若仍失败，记录原始错误并停止，不自动持久化到 `--global`。

严禁 `safe.directory=*`、批量 `takeown`、`icacls /grant Everyone:F`、`git reset --hard`、提权执行整个 Agent 或修改文件所有权。若只是 NTFS 没有写权限，Git trust 例外无效，必须由用户/授权管理员先在独立权限流程中合法修复，当前任务保持 `BLOCKED_BY_LOCAL_PERMISSIONS`。

## 四、U2：GBrain Source 与索引提交绑定（P0-B3）

`tracked_branch = null` **不能单独推出 Source 没有关联本地 Git 或无法索引**；它可能仅代表未跟踪远端分支，但不应预设。务必先检查当前安装版本 help 和现有只读数据：

```text
gbrain --version
gbrain --help
gbrain sources --help
gbrain sources status --help
gbrain sync --help
```

只按**本机 help 实际支持**的 `sources list/status`、`sync status`、`doctor` 等只读命令取证，不猜字段、不读写数据库底层表。

逐 Source 记录：`source_id`、解析后的 `local_path`（必须是相应正式 D 盘目录）、`tracked_branch`、可能存在的 `last_commit/last_sync_commit/commit` 或 equivalent marker、当前索引状态、索引包含页面/内容 hash 的可见证明。

必须把 `source_id + official absolute path + approved Git HEAD + GBrain completed sync/target marker + 受检内容样本及 query 结果` 连成 Evidence 链；字段不存在时不得编造 `tracked_branch` 或 commit marker。

如果现有 GBrain 没有能够证明某一索引版本对应目标 commit pair 的机制：标为 `INDEX_SUBJECT_UNBOUND`。**允许继续只读检查与准备发布计划，但不允许最终声明 `APPROVED_PUBLISHED_BASELINE`**；不得为满足字段而修改 GBrain 内部数据库、Source Schema 或强行绑定不支持的 branch。

## 五、U3：消费者暂停/阻断（P0-B4）

明确列出真正读取**正式** `swap-kb`/`microwave-kb` 的 Agent、CLI、MCP、服务、定时任务、watcher、API 入口。只核对现有实际配置，不为本次任务新建复杂 Platform。

为正式发布选择一种最小且可验证的隔离措施，例如：

1. 在已有消费者入口上暂时**拒绝普通查询**（调用者有真实访问路径时，必须有拒绝请求的实际测试 Evidence）；
2. 如果当前没有正式消费者，证明所有自动启动/定时/监听/连接入口均未启用，并有覆盖发布窗口的禁入控制；仅凭 `netstat` 没有连接不够；
3. 若不能对正式消费实施拒绝，请先在**独立隔离的非正式 GBrain 环境**做发布预演和文件/查询验证，不得修改正式索引或正式 Source。

安全的维护措施应明确：负责控制的人、进入维护窗口的触发条件、实际拒绝成功的请求 Evidence、如何确认同步期间没有漏网消费者、失败保持隔离、通过后怎样恢复。不能用“计划暂停”“口头无消费者”替代 Gate。

**不要求提前搭建完整 Router/Policy/Verification Runtime**，也不允许为绕过这个 Gate 暂时放开消费者。

## 六、U4：同一轮条件式发布

当且仅当：

- Authority exact SHA 已合并 main；
- F1 `F1_APPROVED_CANDIDATE` 的本地 exact subject/Findings 有效，candidate target Commit Pair 未漂移；
- Git trust/NTFS write 权限检查 PASS，两个正式仓工作树 clean，目标可 `--ff-only` 前进；
- Source 与正式仓绑定正确，索引版本证明路径已明确、或其无法建立会阻断最终 Gate；
- 实际消费者拒绝机制已进入并通过测试、失败恢复方案完整；

才允许按 `tasks/kb-p0-controlled-publication-v1.md` 第 4～7 节执行原来的**非破坏性** Git promotion、同步、独立发布验证和 published-baseline。过程中严禁全库 reinit/强制 reset，任何阶段异常均保留隔离并生成恢复指令，不能自行覆盖旧发布基线。

如果只有 P0-B3 无法证实 Index→Commit binding，允许完成预演、保留清单和核验报告，但**不能在正式 Source 上先同步再试图事后补证**。决定发布前必须有可复现的验证方案；不存在时保持 `PREFLIGHT_BLOCKED`，不要用结果为自己补授权。

## 七、唯一 WRITE_SCOPE

仅允许新建：

```text
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-p0-unblock\<AUTHORITY_SHA>\blocker-closure.md
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-p0-unblock\<AUTHORITY_SHA>\preflight-evidence.json
<SwapRepo>\.ai-local\knowledge\reconstruction\publishing\kb-p0-unblock\<AUTHORITY_SHA>\consumer-quiescence.md
```

以及原 KB-P0 Task 已授权且只在全部 Gate PASS 后的发布报告、正式 Git Promotion、GBrain 精确 Source 同步与联合 baseline。Authority cache 仍按同步协议写在同一治理根下。

除这里列出的有证据路径，不改正式知识内容、原始资料、Swap 源码、既有历史 Evidence、GBrain Schema/DB；不发私有 Evidence 到 GitHub。

## 八、Decision 与短回执

```text
KB_P0_BLOCKERS_CHECKED
b1_authority: PASS | FAIL
b2_git_trust_permissions: PASS | BLOCKED
b3_index_commit_binding: PASS | INDEX_SUBJECT_UNBOUND | BLOCKED
b4_consumer_quiescence: PASS | BLOCKED
publication: APPROVED_PUBLISHED_BASELINE | NOT_STARTED | PREFLIGHT_BLOCKED | PARTIAL_PUBLICATION_HOLD | PUBLISH_HOLD
next_gate: KB_BN_INCREMENTAL_KNOWLEDGE_MAINTENANCE | KB_P0_REMEDIATION_OR_RECOVERY | BLOCKED_BY_LOCAL_STATE
```

若任何 Gate FAIL/BLOCKED：保留其他已证明的 Preflight PASS，不重做 F0/F1，不启动正式 Promotion。完成后停止。
