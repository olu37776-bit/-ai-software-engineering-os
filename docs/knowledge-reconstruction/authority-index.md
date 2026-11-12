# Swap / GBrain Knowledge Reconstruction — Authority Index

状态：`PERMANENT CURRENT / KB-CM-V1 ON-DEMAND CONTINUOUS MAINTENANCE`
更新：`2026-11-12`；Issue #131。

本仓库只存公开 Authority 和运行规程；Swap 源码、正式双知识仓、Raw Sources、GBrain 索引以及实际检索/独立验收 Evidence 全部只留本地。

## 1. 常态 CURRENT（长期有效，不再每轮创建批次任务）

| Authority 路径 | 状态 | 用途 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 事实来源、Knowledge Primary Home、验证原则和发布边界 |
| `operations/kb-continuous-maintenance-v1.md` | **`PERMANENT CURRENT OPERATIONS`** | 日常 ACTIVATE / CHANGE-PREPARE / CHANGE-PUBLISH 入口；源变化→影响页→有证据候选→独立 Review→受控发布与索引验证 |
| `tasks/kb-bn-c4-change-driven-batch-v1.md` | `HISTORICAL / USER-REPORTED PUBLISHED + BOUND` | C4 用户报告 `PUBLISHED`、`index_subject=BOUND`、下一门禁 `KB_CONTINUOUS_MAINTENANCE`；本机精确 Git pair/index subject 仍需每次按真实 Evidence 绑定 |
| `tasks/kb-bn-c3-priority-gaps-v1.md` | `HISTORICAL` | C3 已发布优先 Gap 增量及真实差异线索 |
| `tasks/kb-bn-c2-device-version-mml-impact-v1.md` | `HISTORICAL` | 设备/版本/MML 语义、变更影响实战知识 |
| `tasks/kb-bn-c1-four-core-flows-batch-v1.md` | `HISTORICAL` | SCC / IF / Data / CCIC 业务知识批次 |
| `tasks/kb-b1-gap-close-and-publish-v1.md` | `HISTORICAL` | XPIC 知识实战增量 |
| `tasks/kb-p0-controlled-publication-v1.md` | `SUPPORTING SAFETY AUTHORITY` | 两知识仓安全 ff-only、GBrain Source/Index、消费者隔离、独立发布验收/恢复 |
| `operations/authority-sync.md` | `CURRENT DELIVERY` | exact SHA 单文件获取，不 clone/fetch/pull 整个 Framework |

## 2. 本轮完成建设转运营

用户明确报告 C4 `publication=PUBLISHED`、`index_subject=BOUND` 且 `next_gate=KB_CONTINUOUS_MAINTENANCE`。这是进入稳定运行的路由依据，不能代替本地 `published-baseline.json`、实际 commit pair/Source Path 或独立 Index Review。

**现在不再默认创建 C5/C6、全量 Sweep、历史候选和重复验证。** 无新的源代码/设备资料/MML 真实变化时，先调用 `ACTIVATE`，只确认 C4 已发布 Pair、GBrain 绑定和本地按需维护入口；不产生新 Candidate、不自动发布。

以后每次有真实开发变更或 backlog Gap，使用同一 Authority 的 `CHANGE`：明示 Git old..new / 文件版本对照 / 已有 Gap ID，按需指定 `PREPARE`（默认）或经过明确用户委托的 `PUBLISH`，均仍要求独立 Review 和 P0 Gate。每个运行的独立 Evidence 保留在 `.ai-local/knowledge/reconstruction/maintenance/runs/<RUN_ID>/`，不重新建立远端 Authority。

## 3. 安全和物理边界

正式知识：`D:\gbrain-knowledge\swap-kb\`、`D:\gbrain-knowledge\microwave-kb\`；Raw Sources `D:\swap-knowledge-sources\` 只读；治理根 `<SwapRepo>\.ai-local\knowledge\reconstruction\`。SwapRepo 必须是当前已打开且身份能证明的工程，不全盘猜路径。

仅明确的 `CHANGE` 才能在审查批准后进行正式 Knowledge Git ff-only 与受控 GBrain Source 定向同步。不能用 GBrain Sync 的退出码单独宣称 Published，也不能强制 Git、重建索引库或通过本机改权限绕过安全门禁。

本规程不启动定时后台扫描/守护进程、未请求的外部动作，也不修改 Swap 生产代码/源 XML/Raw Sources/Framework Runtime/Learning/Verification。

## 4. 下一操作

- 本次首次切换：执行 `ACTIVATE` → `MAINTENANCE_READY`；
- 有实际来源变化：`CHANGE_REF=<具体已证明 source diff> MODE=PREPARE|PUBLISH`；
- 没有真实变化：保持 Published Baseline 与 GBrain 消费，不生成空任务；
- 旧发布基线/索引发生漂移：`BLOCKED_BY_LOCAL_STATE`，先恢复事实一致性，不假装产生维护成果。

Agent 按 `operations/authority-sync.md` 从 exact 40-char **merged main SHA** 逐文件获取 index → 本长期规程 → 必要支持 Authority 到现有本地 authority-cache；禁止 clone/fetch/pull/checkout Framework 整仓、下载 ZIP/archive 或上传任何私有 Evidence。
