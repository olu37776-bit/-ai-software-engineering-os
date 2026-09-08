# GBrain 项目知识库重建支线：总体设计与实施路线 V1

状态：`DRAFT / DESIGN_REVIEW_PENDING`  
文档版本：`1.0.0-draft.1`；日期：`2026-09-08`  
范围：本地 `swap-kb` 与 `microwave-kb` 的知识重建、维护、验证和受控发布。  
入口：[Authority Index](../authority-index.md)；跟踪：[KB-D0 / Issue #96](https://github.com/olu37776-bit/-ai-software-engineering-os/issues/96)。

> 本文是整体设计，不是生产代码开工许可，也不宣称本地知识已 VERIFIED。当前唯一动作是设计审查。具体实施必须由索引指向的、另行批准的 CURRENT Task 明确授权。

## 1. 目标、使用场景与非目标

目标是使用现成 GBrain，重建中文为主、可追溯、可持续更新的软件项目知识，而不是重新造知识平台。知识库应帮助 Agent 在新版本、新目标设备、新单板、新特性适配时，快速找到业务语义、适用条件、实现责任区、变化影响与验证方法，并知道哪些内容尚不能确认。

| 真实需求 | 知识库应提供的导航，不等于固定修改清单 |
| --- | --- |
| 新版本适配 | 同产品/同适用范围内的版本差异 → 特性、MML/参数、能力变化 → 项目处理区域 → 验证 |
| 新设备或迁移场景适配 | 源/目标组合 → 主控、版本、单板、槽位、端口约束 → 场景与转换规则 |
| 新单板适配 | 产品适用范围 → 接口/端口能力 → 特性与 MML → 项目配置及处理入口 |
| 新特性适配 | 特性与配置组合 → 两类源输入覆盖 → 用户配置 → 模块读取/修改 → 最终输出与验证 |

成功标准不是页面数量、向量数量或报告数量，而是这些任务能否得到有来源、不过度推断、可重新核验的上下文。

本支线不建设 Framework Runtime、NodeExecutionRecord、EvidenceGraph、根因算法、LearningProposal 或 LearningGate；不替主线修改 Context、Policy、Router、Verification System。也不重新建设旧 LLM Wiki、通用 Excel Query Engine、KnowledgeSource 平台或 Graphiti。Embedding 不是当前内容建设的前提。

## 2. 事实基线与状态可信度

### 2.1 本次实际读取的仓库基线

本设计基于 Framework `main@5577c2e8a9ef090b87924edddf6114dd75eb28a5`：

- [当前进度](../../roadmap/progress-status.md)将 Phase 1 标为尚未 VERIFIED；真实 GBrain、模型和私有 Workspace 集成属于后续阶段。
- [本地接入设计](../../architecture/07-local-integrations.md)已经拥有 `KnowledgeProviderPort` 和知识进入 Context 的边界。本支线引用，不重复定义。
- [Context 设计](../../architecture/04-context-contract-policy.md)使用 `ContextItem`、`ContextSnapshot`，知识页面没有 instruction authority。旧聊天中的 `StepContext` 不被直接提升为当前接口。
- [文档规则](../../README.md)、[贡献流程](../../../CONTRIBUTING.md)要求 Authority、实现、Evidence、独立审查保持一致。
- 并行 Learning & Feedback [PR #84](https://github.com/olu37776-bit/-ai-software-engineering-os/pull/84)在本次读取时未合并，所读 HEAD 为 `877eea857742a2458f2e5c42b3a7d9a261a5a28b`。本设计不以该 PR 未合并文档作为 main，也不改变其权限。

以上是明确提交上的观察；后续恢复时重新读取当前主线，不把本节当永久状态表。

### 2.2 本地建设进度：用户回报不等于本轮独立证据

| 项目 | 已收到的回报 | 当前远端能够声明的状态 |
| --- | --- | --- |
| GBrain | 源码编译、本地运行；未建设 Embedding | `REPORTED`，版本、配置与健康待本地绑定 |
| 两个 D 盘知识仓 | 已建立并完成 Source bootstrap | `REPORTED`，实际 HEAD/分支/Source path 待核实 |
| Survey V1、Golden Slice #1、Convention V1 | 经建设、审查、整改、复验和基线记录 | `REPORTED`，保留已有成果，不重做 |
| B2：Core Swap Processing Architecture | 已建设、整改；用户记得已经复验 | `REPORTED / RECONCILE_REQUIRED`，不得擅自判定缺步骤 |
| B3：Source Configuration Ingestion & Normalization | 已建设；曾安排与 B2 状态核对一起审查 | `REPORTED / RECONCILE_REQUIRED`，不推测报告 Decision |
| Framework 对本地 GBrain 的正式集成 | 未提供本轮实际集成 Evidence | 不声明 IMPLEMENTED 或 VERIFIED |

后续由本地 Agent 读取已有 Artifact、Git 与 GBrain 实际状态，复用有效证据；不是再次 Survey。远端没有本地文件访问权，不能“根据 READY 自动补齐 PASS”。

## 3. 从既有问题固化的约束

| 曾出现的问题 | 本设计的修正 |
| --- | --- |
| 把知识支线写成 Learning 或已落地 Node | 本支线只是本地知识建设；未来接入引用主线既有 Port |
| 聊天不断扩成长执行包、路径反复变化 | 长期设计在当前仓库，任务指向明确路径；本地目录不因 Authority 换仓而迁移 |
| 为每份 Excel 造 Profile/Query/Adapter 流程 | 文件按需阅读、轻量登记；复用解析工具，不建设新数据平台 |
| UI aggregation 被写成具体组件（P1-A） | 只表达前端初始化配置聚合阶段；实现组件必须另有源码定位 |
| 旧 Wiki 缺验证前置条件（P1-B） | 旧 Wiki 只提供线索；没有独立权威来源不得进入当前事实 |
| MML→Module 关系过强（P1-C） | txt 声明相关输入，不证明唯一修改责任；区分读取、耦合判断、实际改写 |
| READY、报告 PASS、旧 HEAD 审查被当最终通过 | 实施仅 IMPLEMENTED；独立结论绑定完整 subject；新 HEAD 重跑当前完整审查范围 |
| 草稿 sync 到正式 Source 即被认为发布 | 文件提交、独立验证、索引发布分离；未经验证的索引不得作为已发布知识消费 |
| 为语言/术语反复重建 | 中文解释，原始代码/MML/型号不改；同义关系核验后维护 canonical name + aliases |

这些是已知审查问题的规则化处置，不表示本设计作者已重新检查本地修复结果。

## 4. Authority、数据与物理边界

### 4.1 四类资产，禁止混放

| 资产 | 固定位置/标识 | 职责 |
| --- | --- | --- |
| 远程设计/任务 Authority | 本仓库 `docs/knowledge-reconstruction/` | 规则、CURRENT、精确 WRITE_SCOPE、阶段、验证要求、脱敏回执协议 |
| 正式项目知识 | `D:\gbrain-knowledge\swap-kb\`；Source `swap-kb` | 项目自身知识；独立本地 Git 仓库 |
| 正式微波领域知识 | `D:\gbrain-knowledge\microwave-kb\`；Source `microwave-kb` | 设备、特性、MML 等领域知识；独立本地 Git 仓库 |
| 原始资料 | `D:\swap-knowledge-sources\` | 原文件、目录可不整齐，已有粗分类与 inbox 均保留 |
| 本地治理与 Evidence | `<SwapRepo>\.ai-local\knowledge\reconstruction\` | Survey、批次、审查、基线、查询记录、真实状态与私有路径绑定 |
| 一次性临时结果 | `<SwapRepo>\.ai-work\` | 可丢弃的中间提取/运行临时文件，不作为唯一长期依据 |

`<SwapRepo>` 不是 Framework/Authority checkout。其真实路径从本机现有项目确定，首次记录到本地治理目录；无法唯一确定则请求确认，不全盘猜测。GBrain 程序目录、配置/数据库位置沿用当前可工作的安装，不在本文重定路径。

### 4.2 三种不同的 Authority

1. **执行许可与设计 Authority**：Framework Charter/accepted ADR/Contract 优先，其次是本支线总体设计和已批准 CURRENT Task。任务不得借自然语言扩大机器授权。
2. **事实 Authority**：具体 Claim 按事实类型找来源，见第 8 节。代码能证明当前实现，不能把 bug 变成合法业务规则。
3. **本地执行事实**：本地报告、实际 HEAD、内容 hash 和独立审查是本机“做到哪”的依据。远端摘要不能覆盖它们，也不能凭摘要伪造本机事实。

冲突不靠“最新文档永远正确”裁决。记录 `BLOCKED_BY_AUTHORITY`；业务选择不足则 `NEED_USER_CONFIRMATION`。说明已知事实、分歧、选项、影响范围，仅询问最关键的问题。

### 4.3 单向交付与保密

本仓库是公开仓库，只保存可公开的设计和任务要求。内部源码、知识正文、原始资料、完整调查/审查报告、实际查询文本、内部模型地址、Secrets 和本地 source 清单不得上传。即使只有 hash/路径，也不默认允许外发。

远端提交 Authority → 本地拉取固定版本 → 内部 Agent 执行 → 本地留完整 Evidence → 用户仅反馈允许公开的状态枚举。这不是自动双向同步。

远端状态用 `REPORTED_*` 标注用户摘要；只有本地独立审查能在本地记录 exact-subject VERIFIED。没有新的脱敏回执时，远端保持最后已知状态/待核实，不假装实时同步。不能为了让云端审查“看到证据”要求用户搬运受限文件。

## 5. 总体架构与职责

```text
当前 GitHub 项目：设计 / CURRENT Task / 审查范围
                 | 只下载
                 v
本地 Authority checkout（独立、只读消费）
                 |
      本地执行 Agent + 独立审查 Agent
        /                   \
Swap 源码/配置/测试      D 盘原始资料
        \                   /
         有限调查、交叉核验、形成知识变更
                       |
        本地候选知识提交 + Evidence + Query Case
                       |
                独立 exact-subject 验证
                       |
       发布已批准的双仓 commit 组合并同步索引
                 /                    \
            swap-kb               microwave-kb
                 \                    /
                     GBrain 检索
                         |
                 内部 Agent 按需消费
```

Markdown、必要 frontmatter、链接及本地 Git 历史是受治理的内容资产；GBrain 提供存取、索引与查询，不能替代事实审查。官方上游的文件优先设计仍包含凭据、运行状态、历史等 DB-only/不能完全重建项；本地源码版是否完整落盘需实测。因此本文不承诺“删除数据库即可无损恢复所有东西”，也不授权删除/重建数据库。[R1]

远端架构维护者负责范围、交界与任务文档；本地执行 Agent 自主读取代码/资料并同步知识、证据、报告；独立 Reviewer 读取真实产物并作结论。模型由用户选择，不在文档中指定模型品牌或要求自行切换。

## 6. 知识内容模型：两库、多视图、一处主事实

### 6.1 `microwave-kb`：领域配置知识

设备/产品族、版本、主控、单板、槽位、端口/接口、能力、特性、MML 命令/参数/值、适用条件与组合约束应保持关联，而不是按名词拆成许多 Source。

特性不是百科词条：它关联多条配置、参数、前置条件、硬件能力及版本差异。设备支持特性不能无条件写成一个布尔值，必须保留资料明确给出的设备、软件版本、板卡、端口及配置条件；没有限制信息不等于无限制。

这些是内容分类，不是要求当前安装新版 Schema Pack、建立新的图数据库或为每个端口实例创建页面。多个知识视图通过已有 Markdown 链接和 GBrain 支持的查询组织。[R2]

### 6.2 `swap-kb`：项目实现与使用知识

应覆盖以下视图，而非只复述 package/class 树：

- 项目背景、边界、外部依赖和可信导航。
- 用户场景与业务能力；页面区域、可选特性、迁移/新增/扩容并非同一层级。
- 源输入、规范化、用户配置、公共转换、输出与异常边界。
- 模块职责、输入声明、共享上下文、设备特化、配置与结果汇合。
- 版本/设备/板卡/特性变更的影响路径，以及实际验证和运行依赖。
- 有证据的决策原因、适配方法、操作指导、已知限制。

架构概述、操作指导、参数参考和设计原因解决不同问题，不为统一模板把它们混成一页。可借鉴 arc42 的范围/运行视图、C4 的分层、ADR 的原因记录和 Diátaxis 的用途区分；这些不规定 GBrain 的固定目录。[R4]

### 6.3 MML 与参数是重点，不是字符串目录

一页命令/配置主题应能区分：命令身份与形式、参数原始标识、数据类型/单位、合法值、默认值、缺省/空值语义、引用对象、参数间依赖、适用版本与来源。字段不存在时不能为了模板完整而推断。

同名参数在不同命令/版本下未必同义；不能全库建立无上下文的 `PORT` 或 `MODE` 唯一语义。参数引用应包含命令及必要版本上下文。GET/SET 映射不能由相似名字推断；真实配置样例不等于完整命令规范，也不能证明设备执行合法性。

项目侧另外回答：代码读取了什么、保留/改变/新增/移除了什么、由谁实际处理、哪条验证覆盖。设备语义和当前程序行为分别取证，不能循环证明。

### 6.4 关系与 Primary Home

一个稳定可独立提问的主题才值得独立页面。已有页面先 UPDATE；新实体才 CREATE；同名不自动合并，名称变体先做 alias 核验。物理资料文件可重复保留，知识主事实只设一个 Primary Home。

关系至少说明两端、方向、语义、适用条件和依据。`相关输入`、`只读耦合判断`、`实际改写`不能相互代替；`先发生`不等于因果或强制顺序。复杂条件可用有来源的表格/文字表达，不强行压成无条件图边。

跨库使用明确的 Source ID + 页面标识。是否能作为原生跨 Source graph 关系由本机版本验证；无法解析时分别查两库并显式引用，不为“图完整”复制事实或把联合搜索说成自动多跳推理。

其他页面可保留有明确来源的简短导航摘要，但不能再维护第二份权威支持矩阵。通用技术常识不无差别入库；只沉淀与实际维护有关、难以低成本恢复的项目应用知识。工作流状态、提示词与运行日志不当知识正文。

## 7. 已讨论的业务线索与调查约束

本节仅固定后续调查的覆盖面，来自用户描述；**不是本轮源码核验结论**。正式页面必须定位实际代码/配置/文档，发现差异记入冲突而非强行迎合本节。

| 主题 | 必须调查的关系 | 不能提前推出的结论 |
| --- | --- | --- |
| 两类源配置 | 采集日志中的 GET 配置；设备数据库转换成 MML 后接入公共处理链 | 两路始终逐字一致、完全无损 |
| 数据库解析 | 历史 C++ 能力与 Java 补充能力；运行依赖、覆盖、补充与合并位置 | 固定优先级、完整覆盖、Java 永远覆盖 C++ |
| 用户输入 | 配置区域、初始化聚合阶段、前端信息进入共享上下文 | UI aggregation 是一个具名组件 |
| 模块体系 | 模块基类、相关命令 txt、读取与修改、设备特化 XML、结果合并 | txt 出现即唯一 ownership；遍历顺序就是业务依赖 |
| 输出 | 模块业务转换与 JNI/C++、映射配置的 GET→SET 层 | 所有模块直接输出最终 SET；DB 解析和 GET→SET 是同一原生库 |
| 特殊能力 | 迁移、新增、扩容、配置复用；当前与计划分别记录 | 尚未实现的组合模式已经可用 |

具体源码标识保持实际写法，历史提到的 `SwapParam`、`AbstractTransfer`、`SwapService#doTransfer`、`cfg.ini` 仅是定位线索。XML 的设备限制针对源端还是目标端、缺省含义、继承覆盖与例外，必须检查代码，不能把“没有就是全部”套到所有配置。

公开文档可帮助解释领域概念；内部产品/版本/实现的精确语义不能由公开近似型号补齐。实现细节由本地 Agent 调查，用户仅裁决现有来源不能解决的业务选择。

## 8. 页面与 Evidence 最低约定

### 8.1 中文和标识

正文、设计与新增治理说明用中文；代码类/方法/字段、MML 命令和参数、配置 key、型号与特性缩写保留来源中的原始形式。`canonical name + aliases`有来源和使用语境。不能为了统一对源码/产品名做全局替换，也不能把不同缩写上下文强并成一个实体。

保留已有本地 Convention V1；本设计提供上位边界，具体 frontmatter/标题/链接语法在本机已验证形式上复用。若与本设计冲突，先做小范围差异审查，不整库换模板。不假设中文节名会被 GBrain 解析成机器字段，也不假设叫 `index.md` 的文件一定被索引。

### 8.2 当前事实、范围、历史与未知

内容至少能找到：主题身份/别名、当前结论、适用条件、主要关系、关键依据和未确认项。实现知识补版本锚点；领域支持矩阵补版本及条件；操作指导补前置条件和验证。不是所有页面都机械套八个标题。

当前事实是“在所述适用范围内当前可信的结论”，不是只保留最新产品版本。V2 发布不意味着删除仍有效的 V1 规则。历史变化保留可追踪记录；长期未知、冲突和计划不能混入已证实陈述。更改后的页面持续更新，冻结的是可审计版本，不是禁止知识继续演进。[R3]

### 8.3 按事实类型选择证据

| Claim 类型 | 优先来源 | 不足时处理 |
| --- | --- | --- |
| 当前程序实现 | 对应代码/配置版本 | 记录实现未定位，不用历史设计替代 |
| 实际运行与正确性 | 对应路径的测试/样例/运行结果 | 静态阅读不冒充运行验证 |
| 设备、版本、板卡、端口能力 | 适用产品版本的正式资料/已确认数据表 | 无资料为 UNKNOWN，不等于不支持 |
| MML/参数与特性语义 | 正式命令参考/特性指南 | 代码如何使用与领域定义分开 |
| 需求目标、决策原因 | 批准的需求/设计/决策记录 | 当前实现不能反推原始意图 |
| 旧 Wiki、草稿、模型总结 | 调查线索 | 必须回到其他来源，不自证 |

Excel 不因是表格就自动权威；记录出处、产品/版本与审核状态。保留冲突双方定位、适用范围和观察时间，先排除版本差异再判真冲突。

Evidence Ref 使用现有本地约定：代码的 repo/commit/path/symbol，文档的文件指纹/版本/章页，表格的文件指纹/sheet/行或单元格及业务键，配置的 path/key，测试的命令/目标/时间/退出码/产物定位。行号会漂移，不能脱离文件版本。脏源码需额外记录 diff 与相关未跟踪文件指纹，不能只写 HEAD。

生成的源码总结页不能自证源码，另一模型同意不能替代来源，检索 score 不代表事实可信度。标为 PASS、canonical、covered、shared、0 findings 的报告陈述都要落到相应 `CODE_EVIDENCE`、`SOURCE_EVIDENCE`、`PRODUCTION_PATH_EVIDENCE`、`TEST_EVIDENCE`、`QUERY_EVIDENCE`、`GBRAIN_EVIDENCE` 或 `GIT_EVIDENCE`。

## 9. 建设与持续维护的统一流程

### 9.1 不再每份资料重走 Survey

原资料可以继续放现有粗分类或 inbox。新文件登记路径、指纹、来源/版本及候选主题，命中已有内容就增量核验；同 hash 不重复编译，版本不明保留未知。物理文件不必移动。解析只取所需章节/Sheet，保留表头、单位、脚注、合并区域的意义；乱码、缺页、公式缓存缺失等记解析缺口，不转成业务事实。

优先复用本机已有安全工具。二进制数据库/宏/嵌入脚本不因“读资料”而执行。新格式确需转换工具时单独声明依赖和限额，不趁机造通用 Adapter 平台。

### 9.2 按任务风险确定范围，不按页面数分配工作

`CURRENT Task → 查已有知识/状态 → 有限调查 → 页面与 Evidence 变更 → IMPLEMENTED → 独立复验 → 发布/基线 → 更新 CURRENT`。

每个任务在写入前固定具体 CREATE/UPDATE/必要失效页面清单、实际 repo/worktree、分支、起始 HEAD、原始资料只读范围和报告路径。一个共享页面同一时刻一个写者；检索索引维护也串行，不让 B2/B3 同时切正式 Source。

单页勘误不需要重做 Survey/Golden Slice，可复用同一组小报告和既有 Convention；若它承担最终 VERIFIED，仍须检查该任务**完整批准范围**、旧 Findings 及新风险。局部检查必须明确 `LOCAL_CHECK_ONLY`，不能冒充整批或整库 VERIFIED。

### 9.3 触发与知识更新

| 事件 | 默认动作 |
| --- | --- |
| 新需求/代码改动 | 先查相关知识；确认变化后更新已有 Primary Page 与影响链接 |
| 新产品/MML/版本资料 | 比较适用范围与已有来源，补证/修正/新增必要页面 |
| 查到错误或冲突 | 限制当前结论，保留纠错来源，更新受影响查询 |
| 实际查不到已有知识 | 先检查页面/术语/Source/索引，再决定是否改检索能力 |
| 长期来源缺失或版本变化 | 标记受影响 Claim 待复验，不按时间一刀切宣布全库失效 |

新增、更新、纠错、合并别名、拆页及退役都保留出处。合并/改 slug 必须修复引用并验证旧引用不会误导；没有必要不搬页面。Source ID 稳定，内部分类允许受控演进。

资料不齐不阻塞全部建设；不足以支持某关键 Claim 时阻塞该结论/子任务。Gap 必须说明未知点、已查来源、影响、解决所需资料，不生成无穷百科待办。定期清理只聚焦断链、重复、过期来源和高价值 Gap，不全天扫描重写知识。

## 10. 实施、独立验证和 subject 绑定

### 10.1 状态分开

`CURRENT/SUPERSEDED` 是文档有效性，不是验证结论。`IMPLEMENTED` 是作者完成变更；`VERIFIED` 仅由独立审查给出；`PUBLISHED` 表示已把批准内容用于正式检索；`BASELINED` 表示已记录批准 commit 组合。以上均绑定 scope 和 subject。

聊天 READY 只用于路由，不代替这些状态。新文件上传或索引成功不自动改变事实可信度。

### 10.2 验证 subject

本地审查记录至少绑定：

- `authorityCommit` 与 CURRENT task 文件版本；
- `swap-kb`、`microwave-kb` 两仓参与本次基线的 commit、clean 状态、受检页面/hash；
- 关键实现来源的 code commit/相关脏改动指纹，外部资料指纹；
- 本机 GBrain 版本、Source ID/解析到的路径，以及受检索引所对应的内容版本；
- 查询用例/预期证据及约束版本、审查时间与角色。

不用建立新的 Runtime Schema；先复用本地报告字段，缺字段在任务中精确补齐。关键来源、规则、知识 HEAD 或索引 subject 改变后，旧 PASS 不自动继承。复验完整对应 scope，同时回归旧 Findings 并主动寻找新问题，不能只验证刚修一行。

如果旧 B2 验证绑定旧提交，而 B3 又修改相关页面：保留 B2 历史结论；对当前最终提交重新验证当前 scope。可合并 B2/B3 审查避免重复取证，但输出分别列覆盖范围与结论，不能用一个绿色状态掩盖某批未覆盖。

### 10.3 验收内容

必要检查包括：范围/引用完整性、Claim 与来源匹配、版本条件、术语和 Primary Home、关系强度、旧错误负例、未支持问题、直接 Source 查询与跨库引用，以及真实适配问题。

查询验证分开记录“检索返回了什么”和“Agent 据此回答了什么”。报告须能区分内容缺口、来源不足、检索缺口和回答越界。工具没有召回不证明知识不存在；模型回答流畅不证明文档覆盖。测试声称的生产路径只在本机允许执行且真实运行时记录，本文不授权跑设备命令。

P0/P1 未关闭不能纳入基线；P2 延后需 Reviewer 确认不影响该范围的正确性及使用，并列触发条件；P3 可排期。没有独立能力或原始证据则 BLOCKED/INCONCLUSIVE，不伪造审查。

## 11. GBrain 索引与已验证知识发布

### 11.1 文件提交不等于可消费

正式 Source 仍为 `swap-kb`、`microwave-kb`，指向第 4 节目录。页面写入使用本机已验证的文件/原生写入方式；本支线不直改 PGLite，也不假设一个 write API 一定同步保存到 Git。新增接入方式先确认其持久化行为。[R1]

当前没有 Embedding 不影响先建立内容与精确导航，但关键词、中文别名、链接实际可检索程度必须验证，不能保证无向量的任意自然语言召回。本机 CLI/MCP 的实际 help、版本与行为优先于互联网上的新示例。单一 Source 的隔离/联合查询也按本机验证记录，不靠配置名猜能力。

### 11.2 候选隔离和发布

已批准 Source 默认只服务最近已发布基线。候选改动在独立本地分支/worktree 形成，不得以“未合并分支”自称索引隔离：如果 GBrain 索引的是该工作目录，未合并内容一样可能被检索。

优先使用本机原生支持且经任务批准的隔离检索环境验证候选，不构造第二套检索服务。如果没有可靠候选索引隔离，先完成文件/Evidence 审查；再在暂停正式消费的维护窗口内同步已审查候选，独立完成检索 Gate，通过后才恢复消费。同步期间不得把部分成功发布给普通任务。

后续发布任务必须列出：原发布 commit 组合、目标组合、Source 映射、同步命令与输出、双库引用检查、查询结果、失败恢复方案。涉及两仓的发布是一个版本组合；单仓成功另一仓失败不更新联合基线。

失败时保留原发布记录，暂停受影响使用；仅在明确批准的恢复范围内恢复先前内容/索引并重新验证。不 `reset --hard` 未知工作树、不删除整个数据库或重建同名 Source。历史已 sync 的 B2/B3 页面先查是否未审即暴露，不能因现状如此宣布合法发布，也不默认批量删数据。

### 11.3 存储和恢复

本地 Git commit 是版本历史，不是另一块磁盘上的备份。知识、必要本地配置、来源定位与无法重建的运行/历史数据按单位允许的方式备份，Secrets 单独保护。恢复能力以演练证据为准，不在本设计声称已测试。知识文件、GBrain 数据库与索引不同步时，先识别差异和保留证据，再执行经批准的修复。

Embedding、reranker、后台 enrichment、GBrain 升级是以后独立能力变更，不在日常内容任务偷偷启用。将来必须测本地硬件占用、检索收益、出网边界和回滚；低维向量不代表模型变小。当前办公机无独显，不做未经测量的延迟承诺。

## 12. 仓库 Authority 如何下发和持续维护

本仓库取代收入工具仓库成为本支线远程设计入口；不搬本地知识或私有治理历史。旧收入工具路径仅供历史追踪，不再用于当前任务。此次不修改收入工具；正式切换以本设计审查、合并和后续本机记录 Authority binding 为准。

具体拉取/更新命令见[Authority 同步](../operations/authority-sync.md)。本地 checkout 固定建议为 `D:\ai-authority\ai-software-engineering-os\`，只拉公开设计，不绑定私有知识 remote。任务开始前固定 Authority SHA，不在长任务执行中自动 pull 到另一个设计版本。

当前阶段、blocker、唯一允许动作和下一 Gate **只在** [Authority Index](../authority-index.md)维护；本设计给路线而不复制动态状态。后续每个 Task 在仓库中先写 Context、事实、目标、精确写范围、实施、测试、Evidence、门禁、报告路径和短回执。

复杂设计放仓库；具体私有目标文件由本地 scope/subject manifest 指定，不能公开。远端 Task 可以授权“读取现有批次 manifest 并固定其精确页面清单”，但不能用“相关页面均可改”无限扩大授权。若需超出清单，先停并更新合法 Task/本地获准 scope。

每次阶段变更同时更新 CURRENT/SUPERSEDED、实现/审查状态和下一动作。作者提交设计只可标为已提交待审；本地实现者同步自己的普通文档、报告及本地状态，不把文档维护拆给一个永远独立的文档 Agent。

## 13. 分阶段落地及本次 WRITE_SCOPE

| 阶段 | 交付 | 推进门禁 |
| --- | --- | --- |
| KB-D0（本次） | 总体设计、Authority Index、设计审查范围、拉取说明 | 独立审查设计；不写知识/运行时 |
| KB-R0 | 恢复本机真实状态，绑定三个 repo/数据来源/索引及历史 Evidence | 复用有效 B2/B3 结论；不臆断缺步骤，不重做 Survey |
| KB-V0 | 按当前 subject 核验尚未被有效证据覆盖的 B2/B3 范围 | 新 HEAD 完整对应审查；若需整改另发写授权 |
| KB-P0 | 记录/恢复合法的发布基线，验证 Source 与双仓索引一致 | 证据、独立结论和发布目标一致 |
| KB-Bn | 真实需求/Gap 驱动增量批次与维护 | 复用 Convention，不每次另开 Survey/选择仪式 |
| KB-I0（未来） | 经批准的 Framework 只读知识接入 | 主线 Port/Policy/Context 可用，合法 operation/scope/VerificationPlan |

这些是本支线工作包编号，不是已实现的 Framework Node 或 P1 operation。当前不能凭本表开始后续任务。

本次 KB-D0 精确 WRITE_SCOPE：

```text
docs/knowledge-reconstruction/authority-index.md
docs/knowledge-reconstruction/architecture/overall-design-v1.md
docs/knowledge-reconstruction/reviews/design-v1-review-scope.md
docs/knowledge-reconstruction/operations/authority-sync.md
docs/README.md  # 仅新增本支线导航
```

不改主线架构/accepted ADR、operation/lock/Schema、Runtime/Adapter/测试/构建/CI、LF 文档；不改收入工具和任何本地文件。设计新增不解除主线现有禁止范围，未来 public/persisted Contract 或安全语义变更依 CONTRIBUTING 另立 ADR。

## 14. 与 Framework / Learning 的交界

| 所有者 | 拥有的语义 | 本支线不能代替的动作 |
| --- | --- | --- |
| 知识库支线 | 内容、术语、来源、适用范围、页间关系、内容发布与维护 | 不裁决 Runtime Gate/Route，不自动修改 Workflow |
| 主线 KnowledgeProviderPort | 版本化查询、引用、实体/关系、健康和可选写 capability | 不由本支线重新造第二套 API |
| Context/Policy | 敏感性、相关性、预算、快照、来源权限 | 知识检索结果不能直接升级为系统 instruction |
| Verification System | 执行验证和运行时质量门禁 | 知识 Review 不等于项目代码/设备运行 VERIFIED |
| Learning & Feedback | 执行事实学习、归因、提案及其治理 | 知识更新不是根因验证，不在这里实现学习链 |

未来集成只沿既有 `KnowledgeResult → ContextItem → ContextSnapshot` 方向映射，默认只读；字段与能力以届时主线有效 Contract 为准，不把此段文字当新 public Schema。缺能力明确阻塞或选择已批准替代源，不隐式使用未知版本缓存。

允许以后 Learning 提供知识修正建议，但它只是一种输入；是否更改知识仍需对应事实依据和写授权。日常文档纠错无需等待完整 Learning 系统完成。

## 15. 本次验证、Evidence 与完成门禁

作者检查：精确五文件 diff；Markdown/链接可读；状态/术语/路径一致；不把历史回报写成 VERIFIED；不泄露本地内容；与 main 接口边界无重复 owner。检查只证明文档，不证明本地知识或 Framework 运行路径。

独立设计审查见[完整范围](../reviews/design-v1-review-scope.md)，应覆盖本文全范围及索引/拉取说明，而不只回归 P1-A/B/C。审查冻结整个 PR HEAD，新 HEAD 重跑完整设计范围。P0/P1 未关闭不能宣称设计 VERIFIED。

报告位置：远端作者/独立设计意见记录本 Issue/PR 的 exact-HEAD 评论或 Review；本地完整报告只进入 `<SwapRepo>\.ai-local\knowledge\reconstruction\reviews\repository-design-v1\<AUTHORITY_SHA>\`，不上传。报告格式和短回执由审查文档单点定义。

当前交付回执：`KB_DESIGN_V1_IMPLEMENTED`，含义仅为设计文件已提交。合并后也不自动授权 KB-R0；索引必须另行发布 CURRENT Task。回滚以正常 PR revert 文档提交完成，不动本地知识仓。

## 16. 参考来源及适用范围

[R1] GBrain 官方 [System of record](https://github.com/garrytan/gbrain/blob/master/docs/architecture/system-of-record.md)：本次读取 blob `71dc8e916cf63fdcb54d730ad12924f150cd2b0b`。采用其文件优先方向，同时注意文中 DB-only 与历史例外；不是对用户安装版本的兼容保证。

[R2] GBrain 官方 [README](https://github.com/garrytan/gbrain)与 [Brains and Sources](https://github.com/garrytan/gbrain/blob/master/docs/architecture/brains-and-sources.md)：Brain/Source 是不同组织维度；本设计的“两库”和隔离/发布规则是项目选择，不声称社区统一标准。

[R3] GBrain 官方 [Recommended Schema](https://github.com/garrytan/gbrain/blob/master/docs/GBRAIN_RECOMMENDED_SCHEMA.md)：当前综合结论、来源和历史的内容模式；具体解析语法必须按本机版本验证。该页也包含“数据库生成 Markdown”的叙述，与 [R1] 的文件优先 Contract 不完全一致；这里只借鉴其内容组织，不把整篇推荐文档当成本机持久化实现证明。

[R4] 软件文档参考：[arc42](https://arc42.org/overview)、[C4](https://c4model.com/diagrams)、[ADR](https://adr.github.io/)、[Diátaxis](https://diataxis.fr/)。只作组织方法参考，不据此重建平台。

[R5] 历史设计载体：`olu37776-bit/excel-arrival-tool/docs/swap-knowledge-reconstruction/`。本次已读取其中索引与总体规则；它记录的是历史设计/用户回报，不是本机新 HEAD 的审查 Evidence。后续本支线 Authority 使用当前项目，不继续双写。
