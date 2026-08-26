# Framework Charter

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 使命

AI Software Engineering OS 的使命是把语言模型、工具、知识、验证和人类决策组织成一个 **可持续执行、可恢复、可验证、可审计、可治理、可学习** 的软件工程系统。

系统不追求让单个 Agent“看起来更聪明”，而是提高从需求到变更再到验证结论的整体可靠性。

## 2. 核心问题

普通 Agent Harness 往往依赖会话上下文、模型自述和临时脚本，容易出现：

- 执行中断后无法准确恢复；
- 任务状态由自然语言隐式维护；
- 模型既提出方案又自行批准；
- 验证只运行固定测试或只相信 Agent 汇报；
- Context 缺失、污染或来源不清；
- 工具调用权限过大；
- 同一业务语义在不同路径重复实现；
- 失败经验无法形成可信学习；
- 本地隐私资产与远端工程主线难以安全衔接。

本框架必须通过确定性控制、显式事实、契约、验证和治理解决这些系统性问题。

## 3. 设计目标

### G1. Durable

进程、机器或模型调用失败后，可以从已提交事实恢复，不依赖重新猜测之前发生了什么。

### G2. Deterministic Authority

权威状态变更只能由确定性内核根据 Command、当前版本和 Policy 决定。LLM 只能提供 Proposal、Claim 或候选结构化输出。

### G3. Evidence-driven

所有重要结论都能追溯到输入、执行、产物、验证步骤和版本。缺失 Evidence 与反向 Evidence 必须被显式表达。

### G4. Governed

权限、风险、审批、预算、外部副作用与质量门禁以 Policy 明确控制，禁止隐藏绕过。

### G5. Local-first

完整 Framework 能在用户本地运行，连接本地私有资源；本地数据不因正常运行被要求上传。

### G6. Extensible without semantic duplication

通过 Ports、Adapters、Registry 和 versioned Contract 扩展能力。Adapter 不得重新实现 Core Domain 语义。

### G7. Learnable but not self-authorizing

系统能从 NodeExecutionRecord 和 Evidence 中形成归因与 LearningProposal，但学习结果必须通过 LearningGate 和正常验证路径。

### G8. Operable

安装、配置、诊断、备份、升级、回滚和恢复必须是产品能力，而不是用户手工修目录。

## 4. 完成定义

“框架完成”至少意味着：

1. GitHub 能构建可验证的本地 Release；
2. 用户无需开发工具链即可安装或解压运行；
3. 能创建并执行一个 versioned Workflow；
4. Node 执行可暂停、恢复、取消、重试并保持幂等；
5. 模型和工具调用通过权限化 Adapter 进行；
6. 每次 Node 执行生成完整 NodeExecutionRecord；
7. Verification System 能按风险规划并执行验证；
8. GateDecision 能确定继续、返工、升级审批或终止；
9. 本地 GBrain/知识库可通过稳定接口提供带 provenance 的 Context；
10. Release 升级不覆盖本地配置、状态、Evidence 与知识数据；
11. 关键路径具备 fault injection、replay、property、mutation 和跨平台验证；
12. 任何运行事实都能定位到 Framework version、Git commit、Contract version 和 Workflow definition version。

## 5. 系统范围

Framework Core 包含：

- Workflow Definition、Router 和 Runtime；
- Node Definition、Execution 与 Lifecycle；
- deterministic state transition kernel；
- Context Snapshot 与 Contract；
- Policy、Permission 和 Human Approval Gate；
- Model、Tool、Workspace、Knowledge 等端口；
- Verification System；
- Evidence、provenance 与 NodeExecutionRecord；
- Learning & Feedback；
- persistence、recovery、diagnostics；
- CLI、本地 Control API 和 Release 运行时。

## 6. 非目标

V1 不以以下事项为目标：

- 建设通用云端多租户 SaaS；
- 把所有外部工具重写进 Framework；
- 把项目业务知识写入 Core；
- 让 LLM 直接提交权威状态；
- 无审批自动修改 Framework 源码；
- 通过微服务数量证明架构先进；
- 追求表面 Agent 数量或无限自治；
- 保留旧本地实现的文件级兼容；
- 以覆盖率数字替代风险与行为验证。

## 7. 质量原则

“顶级实现”在本项目中具体指：

- 语义唯一而非多层重复；
- 数据与状态可重放而非只看日志；
- 边界可机器验证而非只写接口文档；
- 失败可恢复而非依靠用户重启；
- 权限最小化而非默认全能；
- Evidence 可验证而非模型自述；
- 模块化单体优先于过早分布式；
- 确定性内核与非确定性智能隔离；
- 版本升级显式而非原地改变语义；
- 供应链可追溯而非只发布一个压缩包；
- 复杂度由真实需求驱动并通过基准与故障实验验证。

## 8. 最高层不变量

1. `Committed Fact` 不可被静默改写；
2. `Authoritative State` 只能由 canonical reducer/transition owner 推导；
3. 外部副作用不得发生在纯状态决策内部；
4. 每个副作用必须有 identity、timeout、permission、result 和 Evidence；
5. 所有重试必须可解释且具备幂等边界；
6. 模型输出在验证前一律视为 untrusted proposal；
7. Context 内容不因包含命令式文本而获得系统权限；
8. Verification 与实现角色不得通过同一自述完成闭环；
9. Local private assets 与 GitHub Release 生命周期分离；
10. 任何核心不变量的变更必须通过 ADR。
