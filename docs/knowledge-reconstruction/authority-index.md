# Swap / GBrain Knowledge Reconstruction — Authority Index

状态：`CURRENT / KB-BN-C2 DEVICE VERSION MML CHANGE IMPACT`
更新：`2026-11-06`；Issue #125。

这里仅承载知识治理的公开 Authority。Swap 源码、正式双知识仓内容、设备 Raw Sources、GBrain index 数据、完整 Evidence 留在本地，不上传 Framework GitHub。

## 1. 唯一 CURRENT Task

| Authority 路径 | 状态 | 职责 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 事实来源、Knowledge Primary Home、验证及受控发布原则 |
| `tasks/kb-bn-c2-device-version-mml-impact-v1.md` | **`CURRENT TASK`** | 设备/版本限制、MML 命令参数/转换语义、变更影响路径三线并行取证、一个 Candidate、一次独立 Review 与受控发布 |
| `tasks/kb-bn-c1-four-core-flows-batch-v1.md` | `HISTORICAL / USER REPORTED COMPLETE` | SCC/IF/Data/CCIC 批次已由用户报告执行完成；具体发布状态/双仓 SHA、24 Case 结果以本机 Evidence 确定 |
| `tasks/kb-b1-gap-close-and-publish-v1.md` | `HISTORICAL / REPORTED PUBLISHED` | XPIC 增量已回报受控发布完成 |
| `tasks/kb-p0-controlled-publication-v1.md` | `SUPPORTING AUTHORITY` | 正式双仓 commit/index/消费隔离/受控发布恢复门禁 |
| `operations/authority-sync.md` | `CURRENT DELIVERY` | exact SHA 仅必要 Authority 单文件拉取，不 clone Framework |

## 2. 已知事实与下一步

用户报告 KB-BN-C1 已执行完成。远端无法读取本机 `published-baseline.json`、24 个 Query Case 或 C1 独立发布证据，故本轮只在同一次任务开始时核对上一轮真实 `publication: PUBLISHED | NO_CHANGE` 与 `index_subject: BOUND`，并把受证实的 Git Commit Pair 冻结为本次 Base。若 C1 只有 Independent Review PASS 而没有正式发布，本任务不得假定完成，请先走 C1 的 D/E；也不允许凭聊天补造 SHA。

本轮集中覆盖：

1. 设备型号/主控/板卡/槽位/端口/Feature 与软件版本条件；
2. MML 命令/参数语义、NCE 日志与 Device DB 经 C++/Java 转 Source MML、后段 cfg.ini/JNI GET→SET；
3. 新设备、新版本、MML 参数变化对 Swap Scenario、`SwapParam`、Module、XML、目标配置及验证的真实影响导航。

按 C1 真实 Backlog 与当前代码/正式设备资料挑选有限的真实对象，三条线合计 18 个可复现查询与正反例；不做全型号全命令虚假矩阵。达到有限、可验证、确实有用的知识进度后即交付，未知需求清楚留 backlog。

## 3. 本轮执行模式

同轮 A→E：A 最多三路并行**只读取证**；B 每知识仓唯一候选 writer，对有证据 Gap 执行小范围增量；C 不同 Reviewer 绑定 exact subject 独立审核；D Authority 合并生效且受控发布前置全部满足才 Git ff-only / GBrain 定向同步；E 独立发布审核通过才写新 `published-baseline.json` 并恢复知识消费。

未合并 main 的 PR Authority 仅供只读取证、隔离 Candidate 与独立 Review；绝不授权提前修改 `D:\gbrain-knowledge\swap-kb\`、`D:\gbrain-knowledge\microwave-kb\` 或正式 GBrain 索引。实施者独立 Review 与 Publisher 的角色不得混用为自证。

## 4. 固定知识与私有治理目录

正式项目知识：`D:\gbrain-knowledge\swap-kb\`。
正式领域知识：`D:\gbrain-knowledge\microwave-kb\`。
Raw Sources：`D:\swap-knowledge-sources\`。
本地 Governance：`<SwapRepo>\.ai-local\knowledge\reconstruction\`；只有在已打开 Swap Repo 且该治理根可证明时使用，不扫描磁盘猜路径。所有 Candidate、Evidence、Review、Baseline 的 WRITE_SCOPE 由 CURRENT Task 严格限定。

## 5. 下一 Gate

- 内容与索引独立发布通过（含部分场景但不伪称全量）：`KB_BN_C3_PRIORITY_GAPS`。
- 内容事实或 Current Subject 独立审查失败：`KB_BN_C2_REMEDIATION`。
- 发布期间部分成功/索引绑定失败：`KB_BN_C2_PUBLISH_RECOVERY`。
- 本机真实 Subject、权限、独立性不可证明：`BLOCKED_BY_LOCAL_STATE`。

严格依据 `operations/authority-sync.md`：仅给定 exact 40-char SHA 以单文件 HTTP 顺序下载 index → CURRENT Task → Task 指定 supporting Authority 到旧 authority-cache，不 clone/fetch/pull/checkout GitHub Framework 整仓、ZIP、archive，不上传私有 Evidence。
