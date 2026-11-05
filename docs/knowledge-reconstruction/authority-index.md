# 项目知识库重建：Authority Index

状态：`CURRENT / KB-B1-CLOSE XPIC GAP-TO-PUBLISHED`
更新：`2026-11-05`；跟踪：Issue #121。

本仓库仅保存 Swap/GBrain 知识治理的公开 Authority。两正式知识仓、Swap 私有源码、设备 Raw Sources、查询记录、实际构建与验证 Evidence 均只在本地。

## 1. 唯一 CURRENT

| 文档 | 状态 | 含义 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 知识事实、边界、独立审查与发布规则 |
| `tasks/kb-b1-gap-close-and-publish-v1.md` | **`CURRENT TASK`** | 复用 XPIC 实战已发现的 Gap：隔离候选实现 → 独立 Reviewer → 受控增量发布 → 独立验证，可在同一轮分阶段收口 |
| `tasks/kb-b1-xpic-real-use-v1.md` | `HISTORICAL / GAP_REPORTED` | 已在正式 GBrain 做 XPIC 查询并发现多个 Gap；具体 Gap/候选是否存在依本机 Evidence，远端不猜 |
| `tasks/kb-p0-controlled-publication-v1.md` | `PUBLISHED GATE AUTHORITY / SUPPORTING` | KB-P0 用户回报 PASS；本轮增量发布必须复用原有严格受控 Gate，不可直接绕过 |
| `tasks/kb-f1-independent-candidate-review-v1.md` | `HISTORICAL / APPROVED_LOCALLY` | 上次全局候选已独立批准，旧 PASS 不自动覆盖本次新增内容 |
| `operations/authority-sync.md` | `CURRENT DELIVERY` | exact 40 位 SHA 与单文件 HTTP 下载，不克隆 Framework 整仓 |

## 2. 已知事实与本次判断边界

- KB-P0：用户已报告 `APPROVED_PUBLISHED_BASELINE` / PASS；本机 published-baseline 的双仓 Commit Pair、GBrain Source/Index subject、Git HEAD 与消费者隔离仍需按实际 Evidence 确认。此确认是**同轮入场检查**，不是再发一个调查任务。
- KB-B1 XPIC 实战：用户确认查询发现**若干 Gap**；是否涉及内容页、导航、检索召回或缺源 Evidence、是否已建 Candidate，由当前本地 B1 `increments/kb-b1/` Artifact 直接回答。
- 历史 B2 Review 可能存在于 `reviews/batch-2-v1/`，不能因旧 SHA cache/新 B2 目录不存在否定历史 Evidence，但旧 HEAD 的 PASS 也不能跨版本直接继承。
- 本次只修 XPIC 扩容的具体有证据 Gap，不重新建设 Survey、Golden Slice、B2/B3、F0/F1 或新知识平台。

## 3. 固定知识边界

正式项目知识 `D:\gbrain-knowledge\swap-kb\`；正式领域知识 `D:\gbrain-knowledge\microwave-kb\`；Raw Sources `D:\swap-knowledge-sources\`；治理根 `<SwapRepo>\.ai-local\knowledge\reconstruction\`。`<SwapRepo>` 必须是本机已打开并可证明的 Swap 工程，不能扫描整盘猜目录。

候选文件只能在当前 Task 精确规定的独立 Git worktree 内生成；在 independent review PASS、发布 Authority 已合并 main、维护阻断与 P0 preflight 全部生效以前，**不能修改正式知识仓或 GBrain live index**。

## 4. 单轮四段 Gate

当前任务允许**同一轮编排**依次运行：

1. A：对实际 XPIC Gap 建立/复用有限候选；源码和正式文档第一事实源，修改精确 page scope；
2. B：由非实施者独立验证 current subject、来源、负例和旧 Finding；
3. C：仅在独立 PASS 且正式 Authority main 已生效、Git FF 与 GBrain Source/维护窗口都安全时受控增量发布；
4. D：独立发布 Reviewer 检查双仓 Commit Pair、GBrain 索引 subject、正反例，再决定写新的 Published Baseline 并恢复消费者。

中间 Gate 失败则停；不得把实现者自检当独立 Verified，也不得将 GBrain 同步退出码当正式 Published。

## 5. 下一 Gate

- 全部通过：`KB_BN_NEXT_REAL_USE_CASE`，由已发布 XPIC 查询/内容作为下一业务场景的可信起点；
- 发现内容 Finding：`KB_B1_REMEDIATION`，仅整改当前 scope；
- 发布前置或部分发布失败：`KB_B1_PUBLISH_RECOVERY`，保留旧 Published Baseline，按真实报告恢复；
- 对本地 subject、来源或独立性无法证明：`BLOCKED_BY_LOCAL_STATE`。

## 6. Authority 获取

必须按 `operations/authority-sync.md` 用聊天下发的固定 40 位 SHA 下载 `authority-index.md`、唯一 CURRENT Task、Task 明确要求的 supporting Authority 到既有 `authority-cache/<SHA>/`。严禁从 GitHub 拉取整个 Framework、ZIP 或推送本地私有知识。PR 分支 Authority 可用于只读/隔离准备，但**不允许在未合并 main 时执行正式 promotion/sync**。
