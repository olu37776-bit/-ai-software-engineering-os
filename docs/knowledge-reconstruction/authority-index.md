# Swap / GBrain Knowledge Reconstruction — Authority Index

状态：`CURRENT / KB-BN-C3 PRIORITY GAPS`
更新：`2026-11-09`；Issue #127。

本仓库只发布可公开的 Knowledge Reconstruction Authority；正式两 Knowledge Repo、Swap 生产源码、GBrain 索引、MML/设备原始资料、查询与验证 Evidence 只存本地。

## 1. 唯一 CURRENT Task

| Authority 路径 | 状态 | 职责 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 事实优先级、Primary Home、有效证据、独立审核、受控发布约束 |
| `tasks/kb-bn-c3-priority-gaps-v1.md` | **`CURRENT TASK`** | 从 C2 正式发布的 Backlog 选最高价值知识 Gap，精确证据修补、独立验证、增量发布；顺带保存实际 change→affected knowledge 证据以供持续维护 |
| `tasks/kb-bn-c2-device-version-mml-impact-v1.md` | `HISTORICAL / USER-REPORTED PUBLISHED + BOUND` | 用户已明确报告 `publication=PUBLISHED`、`index_subject=BOUND`、`KB_BN_C3_PRIORITY_GAPS`；本轮须核对本机真实 pair/基线后再做新候选 |
| `tasks/kb-bn-c1-four-core-flows-batch-v1.md` | `HISTORICAL` | SCC/IF/Data/CCIC 实战批次，已有 Evidence 优先复用 |
| `tasks/kb-b1-gap-close-and-publish-v1.md` | `HISTORICAL` | XPIC 实战已报告发布，不重复 Review/Build |
| `tasks/kb-p0-controlled-publication-v1.md` | `SUPPORTING PUBLICATION AUTHORITY` | 正式双仓 ff-only、GBrain Source/Index、消费者暂停、独立发布验收和恢复 |
| `operations/authority-sync.md` | `CURRENT DELIVERY` | exact 40 位 SHA 单文件下载，不 clone Framework 整仓 |

## 2. 当前真实进展与目标

用户本轮提供已完成 C2 正式发布且索引 BOUND 的短回执。聊天无法访问本机完整 `KB_BN_C2_COMPLETE`、published-baseline、双 Git Commit Pair、GBrain 实际 Index Subject，因此**只在本轮开工时单次核对**，不要重复旧 Survey/C2 问题检查。失败则本轮 `BLOCKED_BY_BASELINE`，不假设安全。

本轮是明确的 **`PRIORITY_GAPS`**，不是无依据自动搭建平台。读取真实 C2 `coverage-and-backlog`、`gap-register`、`query-cases`，只处理已证实的 5–8 个（不足则按实际）高价值 Gap：错误设备/版本支持、MML 语义/映射错误、Swap 模块责任、跨库 Primary Home/导航等。检索-only / 源未知要独立列，不能伪装成知识页面已修复。

用真实源差异（如设备版本、板卡、MML 参数、代码/配置变化）在本地形成最小化 `change→affected pages→evidence→candidate` 维护证据，为下一批 C4 做准备；不创建 watcher/daemon/后台任务、不要修改生产源码、Raw Sources 或 Framework Learning/Verification 线。

## 3. 一轮执行与版本约束

CURRENT Task 允许 **A→E 同一轮编排**：A 并行只读取证/排序；B 单仓唯一 Candidate Writer 修补小范围确证内容；C 独立 Reviewer 审 exact subject；D 当前 Authority 已在 main 生效且所有 P0 preflight 安全 Gate 重新 PASS 才发布精确 ff-only / GBrain Source 限定 Sync；E 独立 Publisher Reviewer 核对 Git Pair、Index Subject、正反例，通过才写新 Published Baseline 并恢复消费者。

**PR 分支未合并 main 时允许 A/B/C，但禁止正式 D/E 发布。** 任何独立性、Git 非 FF、Index 不能绑定或消费者不受控均 Fail Closed；具体写范围和 Receipt 以 CURRENT Task 为唯一准绳。

## 4. 本地固定边界

`D:\gbrain-knowledge\swap-kb\`、`D:\gbrain-knowledge\microwave-kb\` 是正式知识仓；`D:\swap-knowledge-sources\` 是只读原始资料；`<SwapRepo>\.ai-local\knowledge\reconstruction\` 为私有治理根。SwapRepo 仅从已打开且可证明的工程确定，不进行磁盘搜索猜测路径。

不上传任何私有知识或完整 Evidence。仅按 `operations/authority-sync.md` 下载 exact SHA 下 index → CURRENT Task → supporting Authority 单文件到既有 Authority Cache；严禁 clone/fetch/pull/checkout GitHub Framework 或 ZIP/archive。

## 5. 下一 Gate

- 实际内容与发布独立 PASS：`KB_BN_C4_INCREMENTAL_MAINTENANCE`；
- 真实知识事实/独立审查 Finding：`KB_BN_C3_REMEDIATION`；
- 部分正式发布或 Index HOLD：`KB_BN_C3_PUBLISH_RECOVERY`；
- 无法证明基线/写入隔离/独立 Reviewer：`BLOCKED_BY_LOCAL_STATE`。
