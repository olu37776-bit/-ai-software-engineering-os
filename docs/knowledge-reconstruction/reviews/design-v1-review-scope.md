# KB-D0：总体设计 V1 独立审查范围

状态：`CURRENT TASK / REVIEW ONLY`  
目标：[总体设计](../architecture/overall-design-v1.md)和 [Authority Index](../authority-index.md)是否可作为后续任务设计的依据。审查通过不授权知识内容或主线代码实施。

## 1. Context / Proven Facts

当前 Framework main 已有 KnowledgeProviderPort 与本地数据边界；知识库支线历史设计在收入工具仓库。用户要求归入当前项目、先写完整总体设计，再用短提示词拉取执行。

本机 Survey/B1/B2/B3 状态尚未在本轮核实。本审查不访问内网，不以用户 READY/作者报告代替本地验证，不需要内部文件上传。

## 2. Subject 与输入

审查者不得是本次设计作者。先固定 PR `REVIEWED_HEAD`、base SHA、五文件 diff；只读读取该 HEAD 上的：

- `docs/knowledge-reconstruction/authority-index.md`
- `docs/knowledge-reconstruction/architecture/overall-design-v1.md`
- `docs/knowledge-reconstruction/operations/authority-sync.md`
- 本文件及 `docs/README.md` 的新增导航。

再核对该 base 的 `CONTRIBUTING.md`、`docs/README.md`、`docs/architecture/07-local-integrations.md`、`docs/architecture/04-context-contract-policy.md`、`docs/roadmap/progress-status.md`。比较审查时最新 main 是否改变交界；有变化先记录影响，不能把未合并 LF 文档当 main。

## 3. 必须覆盖的检查

| ID | 审查义务 |
| --- | --- |
| KB-RV-01 | 支线不拥有 Runtime/Learning/Context/Router 核心语义；主线 Port 只引用、不重定义 |
| KB-RV-02 | Authority 在当前项目；内部数据、本地知识、完整 Evidence 不上传；旧收入工具入口有明确处置 |
| KB-RV-03 | 本地路径与历史进度分清 REPORTED/VERIFIED；不臆断 B2 缺审查、不重做 Survey |
| KB-RV-04 | 项目知识/领域知识、两类源输入、模块业务处理/最终格式转换、特性/MML/硬件关系分层正确 |
| KB-RV-05 | P1-A/B/C 的防复发规则有效；适用条件、版本、参数上下文与 Unknown 有表达方式 |
| KB-RV-06 | 增量维护可以处理新资料、代码变化、纠错、别名和失效；不会每份文件再造平台 |
| KB-RV-07 | 新 HEAD 完整 scope 复验；B2/B3 重叠变更、双仓 commit 组合、来源/索引 subject 漂移处理明确 |
| KB-RV-08 | 草稿写入/索引/发布分离；不能用分支名冒充隔离；同步失败不虚假发布、不破坏本地资产 |
| KB-RV-09 | 拉取命令有实际仓库/路径/ref，未合并阶段不谎称 main 可读；不 push 本地内容 |
| KB-RV-10 | CURRENT、写范围、后续阶段、报告和回执一致；任务不越权，复杂设计没有继续塞聊天 |

主动寻找新问题；不局限既有三项 P1，也不要求为了完整而立即安装模型、建立 Adapter、添加 Schema 或给每个代码文件写 Wiki。

## 4. WRITE_SCOPE / OUT_OF_SCOPE

审查目标默认只读。远端结论可写本 PR 的 Review/评论（仅公开设计与引用）；不能边审边改设计。

本地 Reviewer 的新报告只允许写：

`<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\repository-design-v1\<AUTHORITY_SHA>\`

其中 `<AUTHORITY_SHA>` 是本次固定的完整提交。新建 `review-report.md`、`findings.json`；不覆写历史 subject 报告。若目录已有本次有效报告且 subject 未变，可复用；需要纠正报告则保留旧版并写明原因。

不改正式知识、源码、原始资料、GBrain 配置/索引、旧审查结论或 Baseline。模型品牌不是权限/独立性证明；身份、工作上下文与参与历史必须说明。

## 5. Verification / Evidence

每项义务记录检查的段落、对应当前仓库依据、SUPPORTED/ISSUE/INCONCLUSIVE 及理由。Finding 至少包含 ID、严重度、具体位置、依据、影响、最小修正建议、是否阻塞。

P0/P1 阻塞设计通过；P2 可接受延后，但不得影响立即下一阶段安全/正确性；P3 可排期。无问题应明确检查范围，不写全仓库“0 findings”。无法独立验证本机状态应记录限制，不生成假的 CODE/QUERY/DB Evidence。

新设计 HEAD 必须重新跑 KB-RV-01～10，对旧 Findings 回归并检查新风险；不得只查最近一项就声明整份设计 VERIFIED。

## 6. Report / Completion Gate

报告记录：REVIEWED_HEAD、base SHA、输入范围、KB-RV-01～10、Findings、作者旧结论是否被采纳及依据、独立性说明、限制、Decision。

Decision：

- `APPROVED_FOR_DESIGN_BASELINE`：无 P0/P1，设计一致，可继续合法发布/下一任务设计；不等于知识 VERIFIED。
- `REMEDIATION_REQUIRED`：存在可局部修复的阻塞。
- `BLOCKED_BY_AUTHORITY`：输入/ref/边界冲突导致不能完成审查。

完整证据留规定位置。短回执只返回：

```text
KB_DESIGN_V1_REVIEW_COMPLETE
decision: APPROVED_FOR_DESIGN_BASELINE | REMEDIATION_REQUIRED | BLOCKED_BY_AUTHORITY
```

不能完成审查则返回 `KB_DESIGN_V1_REVIEW_BLOCKED` 加一句不含内部内容的原因。不要自动合并、更新知识 Baseline 或开始 KB-R0。
