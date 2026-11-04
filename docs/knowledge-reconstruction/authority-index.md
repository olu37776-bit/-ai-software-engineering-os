# 项目知识库重建：Authority Index

状态：`CURRENT / KB-B1 REAL USE — XPIC EXPANSION`
更新：`2026-11-04`；跟踪：Issue #119。

本仓库只承载 Swap / GBrain 知识重建支线的公开设计、执行 Authority 与任务 Gate。正式 Knowledge Repo、Swap 私有源码、Raw Sources、完整 Evidence 和查询内容只在本地，不上传 GitHub。

## 1. 当前 Authority

| 文档 | 当前状态 | 职责 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 知识模型、事实优先级、独立验收、受控发布与维护规则 |
| `tasks/kb-b1-xpic-real-use-v1.md` | **`CURRENT TASK`** | 从正式 GBrain 检索真实 XPIC 扩容研发问题，交叉核验源码与设备资料，只对高价值 Gap 创建隔离候选 |
| `tasks/kb-p0-controlled-publication-v1.md` | `HISTORICAL / REPORTED PUBLISHED` | KB-P0 已由用户报告通过，真实精确 Commit Pair 和 GBrain index subject 必须在本机核验 |
| `tasks/kb-f1-independent-candidate-review-v1.md` | `HISTORICAL / LOCALLY REPORTED APPROVED` | F1 已获独立 Candidate Approval，且经 P0 Gate 处理 |
| `tasks/kb-f0-existing-assets-fast-build-v1.md` | `HISTORICAL / LOCALLY REPORTED COMPLETE` | B2/B3 已有资产的最小候选建设 |
| `operations/authority-sync.md` | `CURRENT DELIVERY` | fixed SHA + exact path 单文件拉取 Authority；禁止 clone 整个 Framework |

## 2. 当前真实状态与限制

用户已回报 KB-P0 发布验收 PASS。远端可声明 `REPORTED_PUBLISHED`，但没有直接读取本机完整 `published-baseline.json`、双 Knowledge Git HEAD 或 GBrain 索引证据。因此当前任务的首个只读步骤是冻结**本地已发布的真实双仓 Commit Pair 与 Index Subject**，不得靠聊天凭空补 SHA，也不得再次发布 P0。

本地正式 Source：

```text
D:\gbrain-knowledge\swap-kb\
D:\gbrain-knowledge\microwave-kb\
```

Raw Sources：`D:\swap-knowledge-sources\`。

本地治理根：`<SwapRepo>\.ai-local\knowledge\reconstruction\`。其中 `<SwapRepo>` 必须是本机已打开且真实可证明的 Swap 项目根，不能扫描磁盘猜路径。候选的独立目录和报告写范围按 CURRENT Task 严格执行。

## 3. 为什么不再做通用调查

Survey、Golden Slice、Convention、B2/B3 Core Architecture 和 Source Ingestion 的已有内容不再按阶段重做。下一步的价值在于**用真实开发问题检验知识是否有用**，缺少内容时只按现有 Convention 进行小范围补证。实施者自检不等于 Independent Verified，隔离候选不会因文件存在而自动成为已发布知识。

首个实战场景选择 XPIC 扩容（用户已说明其在迁移基础上扩展，涉及自动数量分配与显式端口选择两种模式、目标设备限制）。这只是调查范围，实际合法规则、当前实现、限制及负例必须通过代码和来源证实。

## 4. 下一 Gate

依 CURRENT Task 真实结果，仅选一项：

- `KB_BN_NEXT_REAL_USE_CASE`：已发布知识能准确支持本次实际研发提问，无须新候选；
- `KB_B1_INDEPENDENT_REVIEW_AND_PUBLISH`：本次隔离候选补全了关键 Gap，下一轮针对精确候选做独立验证和受控增量发布；
- `BLOCKED_BY_LOCAL_STATE`：发布基线/事实来源/写入隔离无法确定，禁止猜测。

不得在 KB-B1 中直接修改正式 Knowledge、GBrain index 或主线 Framework；不自动启动下一个业务场景。

## 5. Authority 获取与历史

按 `operations/authority-sync.md` 以聊天提供的 exact 40 位 SHA，仅单文件下载 `authority-index.md`、唯一 CURRENT Task、Task 明确要求的 supporting Authority 至既有 Authority Cache；禁止 clone/fetch/pull/checkout Framework 整仓或下载 ZIP。旧收入工具仓 Authority 已 `SUPERSEDED`；旧 LLM Wiki 是 clue only；本地治理根是 `.ai-local/knowledge/reconstruction/`，不是 `.ai-local/knowledge-reconstruction/`。
