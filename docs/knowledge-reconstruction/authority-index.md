# 项目知识库重建：Authority Index

状态：`CURRENT / KB-P0-U PREFLIGHT BLOCKER CLOSURE`
更新：`2026-11-03`；跟踪：Issue #115。

本目录为 Swap / GBrain 知识库支线的可公开 Authority。用户本地完整 Knowledge、Swap 源码、Raw Sources、Build/Review/Publish Evidence 不上传 GitHub。只通过 exact SHA + exact path 下载本任务需要的 Markdown，不 clone Framework 仓库。

## 1. 唯一 CURRENT Task

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `architecture/overall-design-v1.md` | `DESIGN BASELINE` | 知识、证据与独立发布架构边界 |
| `tasks/kb-p0-unblock-v1.md` | **`CURRENT TASK`** | 一轮关闭 P0-B1～B4，全部通过后按原 KB-P0 流程执行条件式发布 |
| `tasks/kb-p0-controlled-publication-v1.md` | `SUPPORTING CURRENT TASK` | 已批准的 Promotion、GBrain Sync、独立发布验收、联合 Baseline 规则 |
| `tasks/kb-f1-independent-candidate-review-v1.md` | `HISTORICAL / REPORTED_APPROVED` | F1 用户回报 APPROVED，完整独立 Evidence 留本地 |
| `tasks/kb-f0-existing-assets-fast-build-v1.md` | `HISTORICAL / REPORTED_COMPLETE` | F0 候选建设及 manifest |
| `tasks/kb-v0-b3-review-reverify-v1.md` | `SUPERSEDED` | 错误前置目录的历史任务，禁止继续使用 |
| `operations/authority-sync.md` | `CURRENT DELIVERY` | 不下载 Framework 整仓的单文件交付协议 |

## 2. P0 四项阻塞事实与处理

用户回报正式发布前置检查：

- **P0-B1 Authority 未生效**：PR #116 当时尚未合并；现已合并到 main `009132b02f0caa06d0000b3f00b5f4393c270ba2`。B1 的历史原因已解决；本任务的新 Authority SHA 仍须先合并 main，才允许正式发布。
- **P0-B2 Git Owner**：正式两个知识仓 owner 为 `BUILTIN\Administrators`，执行用户不同。先只读核对 ACL / trust，不允许全局通配例外或自动修改 NTFS Owner；在受信目录前提下只对本地进程给两个确切路径 `safe.directory`，并证明 Git 能正常读写。
- **P0-B3 Index subject**：两个 Source 的 `tracked_branch = null`。不能将 null 直接当成 Source 不可用，也不能把它假装成绑定 commit。用当前本机 CLI 只读 Source/索引元数据、Git commit/内容哈希以及实际查询证明；无法证明则 `INDEX_SUBJECT_UNBOUND`，停止正式发布。
- **P0-B4 消费者隔离**：当前没有经过验证的正式查询拒绝/暂停措施。必须证明发布期间普通消费者无法读取部分更新；如果没有这种机制，只在隔离非正式环境验证候选，正式索引不得变更。

## 3. 本次唯一实际工作

执行 `tasks/kb-p0-unblock-v1.md`：**一次性闭合四个前置阻塞**，复用 KB-F0 / KB-F1 真实记录；不重做 Survey、B2/B3、F0/F1。全部 PASS 且本 Authority 已合并 main 才允许在本任务内继续执行原 KB-P0 正式发布流程；否则只返回当前真实 blocker、保留已有 PASS。

正式仓路径：

```text
D:\gbrain-knowledge\swap-kb\
D:\gbrain-knowledge\microwave-kb\
D:\swap-knowledge-sources\
<SwapRepo>\.ai-local\knowledge\reconstruction\
<SwapRepo>\.ai-local\knowledge\reconstruction\authority-cache\<AUTHORITY_SHA>\
```

## 4. Outcome

完整独立发布验证通过，才可记录 `APPROVED_PUBLISHED_BASELINE` 并进入 `KB_BN_INCREMENTAL_KNOWLEDGE_MAINTENANCE`。任意前置阻塞则绝不声称 `PUBLISHED`，不强制 reset/reinit、不上传内部 Evidence。`tracked_branch = null` 本身不是直接 Verdict。

## 5. 获取方式

从 GitHub exact 40 位 SHA 下载：`authority-index.md` → `tasks/kb-p0-unblock-v1.md` → `tasks/kb-p0-controlled-publication-v1.md` → `architecture/overall-design-v1.md` → `operations/authority-sync.md`。保持本地历史目录不动，不克隆下载整个 Framework。
