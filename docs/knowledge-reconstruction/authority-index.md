# Swap / GBrain Knowledge Reconstruction — Authority Index

状态：`CURRENT / KB-BN-C1 FOUR-CORE-FLOW INCREMENTAL BATCH`
更新：`2026-11-05`；Issue #123。

这里仅承载公开的知识治理 Authority。Swap 私有源码、两个正式 Knowledge Repo、设备资料、完整证据及 GBrain 详细查询不上传公开 GitHub。

## 1. 唯一 CURRENT Task

| 路径 | 状态 | 含义 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 知识边界、Primary Home、Evidence、验证与发布原则 |
| `tasks/kb-bn-c1-four-core-flows-batch-v1.md` | **`CURRENT TASK`** | SCC、IF、Data、CCIC 四场景批量实测，缺口修补，集成候选独立验收，一次受控增量发布 |
| `tasks/kb-b1-gap-close-and-publish-v1.md` | `HISTORICAL / REPORTED PUBLISHED` | XPIC Gap 已由用户回报受控发布完成，本机完整 Index/Commit Pair 必须先只读确认 |
| `tasks/kb-p0-controlled-publication-v1.md` | `SUPPORTING AUTHORITY` | 严格的双知识仓和 GBrain Source/Index 发布与消费者暂停/恢复规则 |
| `tasks/kb-b1-xpic-real-use-v1.md` | `HISTORICAL` | XPIC 真实检索及 Gap 发现 |
| `tasks/kb-f1-independent-candidate-review-v1.md` | `HISTORICAL` | 历史独立 Review，不给当前增量自动继承 PASS |
| `operations/authority-sync.md` | `CURRENT DELIVERY` | exact 40 位 SHA、仅必要 Authority 单文件 HTTP 获取 |

**新任务名为 KB-BN-C1，不是旧的 KB-V0-B2 / Core Swap Processing Batch #2。** 避免复用其历史 review 路径造成先前反复出现的无谓 Gate 阻塞。

## 2. 当前状态

KB-P0 正式基线与 XPIC 第一批增量已由用户回报受控发布通过，不能凭聊天补造 Git HEAD 或 Index Subject。KB-BN-C1 首步只读读取上一轮实际 Published Baseline、两正式 Knowledge Repo HEAD 与 GBrain Source path/index subject，并冻结为本次唯一 Build Base Pair。若证据漂移则停止且不得改正式知识。

本次的范围是四条 Swap 正式业务场景：SCC 配置、IF 配置及 ODU→MODU 复用、Data 配置、CCIC 新增/扩展；横向贯穿设备型号/版本、MML/参数与板卡/端口限制。每个场景 5 个真实查询，加 4 个跨场景查询，共 24 个可复现 Query Cases。

## 3. 加速执行策略

以一轮任务完成 A→E，而不是为四场景分别起 GitHub PR：

1. A：最多两个并行**只读** worker 核对 GBrain 召回与真实代码/设备文档，找 Gap 和 Unknown。
2. B：每个 Knowledge Repo 只有**一个**候选 writer/worktree，合并最有价值的知识增量，冻结最终候选 HEAD；最多更新 12 个、新建 4 个 Markdown。
3. C：另一名 Reviewer 独立审核整批当前 subject、历史关联、四场景正反例与版本适配。未通过就不发布。
4. D：Authority 合并生效且安全预检全部通过后，用 exact approved Commit ff-only 提升正式仓、按 GBrain 本机支持的方式受控增量同步。
5. E：独立发布核验 Commit Pair、Index Subject、24 问实际证据；仅 PASS 记录 Published Baseline 并恢复消费。

不重新 Survey / F0 / F1 / 旧 B2/B3，不重建系统，不修改生产代码，不修所有型号、不为凑页面数编造未知规则。

## 4. 本地工作边界

正式项目知识：`D:\gbrain-knowledge\swap-kb\`。
正式设备领域知识：`D:\gbrain-knowledge\microwave-kb\`。
Raw Sources：`D:\swap-knowledge-sources\`。
治理根：`<SwapRepo>\.ai-local\knowledge\reconstruction\`；候选和报告的精确 WRITE_SCOPE 以 CURRENT Task 为准。不能在磁盘中扫描或猜 `<SwapRepo>`。

除 C/D 阶段的明确受限授权外，正式双仓、GBrain Source/index 和生产代码只读。私有内容不得上传公开 Framework。对未审 Candidate 不得同步正式 GBrain。

## 5. 唯一下一 Gate

- 有证据并受控发布一批正确内容，或原已发布内容通过 24 Query Cases：`KB_BN_C2_PRIORITY_BACKLOG`。
- 独立 Review 发现阻塞 Finding：`KB_BN_C1_REMEDIATION`。
- 发布安全或部分发布失败：`KB_BN_C1_PUBLISH_RECOVERY`。
- 本地 Baseline/subject/独立性无法证明：`BLOCKED_BY_LOCAL_STATE`。

完成覆盖不等于全项目 100%。如果某场景只验证了部分路径，必须在报告明示 `PARTIAL` 和剩余可执行 backlog。

## 6. Authority 获取

Agent 只使用聊天下发的 exact 40 位 SHA，并按 `operations/authority-sync.md` 逐文件拉取 index → CURRENT Task → 明确 supporting Authority 至现有 Authority Cache。禁止 clone/fetch/pull/checkout Framework 整仓或下载 ZIP/archive。PR 未合并时仅允许隔离候选和独立审查，不允许正式 Git promotion / GBrain Sync。
