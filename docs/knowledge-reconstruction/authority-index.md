# 项目知识库重建：Authority Index

状态：`CURRENT DESIGN ENTRY / DESIGN_REVIEW_PENDING`  
更新：`2026-09-08`；工作包：`KB-D0`；[Issue #96](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/96)。

本目录属于 `olu37776-bit/-ai-software-engineering-os`，只负责 GBrain / 项目知识库重建支线。收入工具仓库不再承载本支线的当前设计；本地知识、内部源码与完整 Evidence 不上传。

## 1. 入口与权限

上位 Authority 为 [Framework 文档规则](../README.md)及其 Charter、accepted ADR、Contract。本目录不得改变主线机器授权或 Learning & Feedback 的职责/写范围。

`CURRENT` 仅标识应该阅读哪个文件，不等于设计 APPROVED、代码 IMPLEMENTED 或知识 VERIFIED。

| 文档 | 当前角色 |
| --- | --- |
| [总体设计与实施路线 V1](architecture/overall-design-v1.md) | CURRENT DESIGN，`DRAFT`；知识模型、边界、维护、验证、发布及未来交界的完整设计 |
| [设计 V1 独立审查范围](reviews/design-v1-review-scope.md) | CURRENT TASK；当前唯一允许的独立设计审查 |
| [Authority 拉取与固定版本](operations/authority-sync.md) | 当前交付方式；含具体命令，不授权知识/源码修改 |

**当前唯一动作：审查 KB-D0 设计文档。** 不开始 KB-R0/B4，不移动知识仓，不修改 B2/B3 页面，不配置新运行能力。

## 2. 状态单点

| 对象 | 当前状态 / 可证明范围 |
| --- | --- |
| KB-D0 文档 | 已形成草案，独立结论待产生；未声明 VERIFIED |
| 主 Framework | 核对到 main `5577c2e8a9ef090b87924edddf6114dd75eb28a5`；实时进度以[主线进度](../roadmap/progress-status.md)为准 |
| GBrain、双知识仓 | 用户回报已安装/建立；本轮未检查本机版本、路径和索引 |
| Survey V1、Golden Slice #1、Convention V1 | 用户回报已完成；本机历史 Evidence 保留，不重建、不冒充本轮验证 |
| B2 | 用户回报已建设、整改且可能已复验；`RECONCILE_REQUIRED`，不预断缺门禁 |
| B3 | 用户回报已建设；最终 Review/Remediation/Baseline 待本机恢复 |
| 生产 GBrain 集成 | 非本次任务，不能从文档存在推断已实现 |

当前阻塞后续实施的事项：`DESIGN_REVIEW_PENDING`；`LOCAL_SUBJECT_NOT_RECONCILED`。后者不是证据丢失的结论，只表示远端尚不能核实。

## 3. 本地绑定位置

- 项目知识：`D:\gbrain-knowledge\swap-kb\`。
- 领域知识：`D:\gbrain-knowledge\microwave-kb\`。
- 原资料：`D:\swap-knowledge-sources\`。
- 私有治理/报告：`<SwapRepo>\.ai-local\knowledge\reconstruction\`。
- 新 Authority checkout：`D:\ai-authority\ai-software-engineering-os\`。

`<SwapRepo>` 必须从本机现有项目/绑定记录确定。Authority checkout 不是 Swap 源码仓，不是知识内容仓。不得因远端换仓而搬动既有本地资产。

## 4. 下一门禁与推进顺序

1. 独立 Reviewer 固定 KB-D0 的完整 PR HEAD，按 CURRENT TASK 检查整体设计与当前 main 交界。
2. 若需整改：作者在 KB-D0 范围内修文档，新 HEAD 重新审查完整设计范围；不自行声明 VERIFIED。
3. 设计通过并按仓库流程合并后，另发 CURRENT `KB-R0`，在本机恢复 B2/B3 的实际记录、双仓 HEAD 和索引状态。
4. 复用仍覆盖当前 subject 的有效独立证据。缺失/过期时合并核验 B2/B3 对应范围；不机械重审已满足的任务，也不继承旧 HEAD PASS。
5. 需要知识整改则另发精确写授权；通过后统一记录合法发布基线，再继续增量批次。
6. Embedding/Graphiti、Runtime 接入按实际需求另评估，不阻塞本地知识内容维护。

这里是顺序，不是后续各阶段的开工授权。

## 5. 历史入口的处置

| 旧内容 | 新角色 |
| --- | --- |
| 收入工具仓库 `docs/swap-knowledge-reconstruction/` | SUPERSEDED 入口；不再下发任务，此次不删除/改写该仓库历史 |
| 历史聊天长提示词 | 历史背景；不能提供持续写权限 |
| `.ai-local/knowledge-reconstruction/` | 错误旧路径；不新建，实际长期根是 `.ai-local/knowledge/reconstruction/` |
| 旧 LLM Wiki | 线索，不能单独证明当前事实 |
| 已有本地报告/Convention/基线 | 历史事实与有效局部约定，按实际 subject 和版本复用；不因换入口而作废 |

迁移只是远端 Authority 归位。本设计尚在分支时，不声称已合并 main；设计批准也不重写本机历史 PASS。

## 6. 状态维护与短回执

远端维护者随任务切换同步本索引的 CURRENT/SUPERSEDED、blocker、下一 Gate；本地执行者按任务同步私有状态和报告。完整内部证据不能传回时，远端只记录 `REPORTED_*` 状态，不伪造 exact-HEAD VERIFIED。

本次作者交付：`KB_DESIGN_V1_IMPLEMENTED`。独立审查回执由 [CURRENT TASK](reviews/design-v1-review-scope.md)唯一规定。不能从 `READY` 自动推断 APPROVED。
