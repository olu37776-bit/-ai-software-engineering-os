# 当前已确认的架构知识基线

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 目的

本文件只记录从现有建设中已经反复确认、仍应被新框架继承的架构知识，以及必须在完整重建中消除的失败模式。它不认可旧本地代码结构，也不要求新实现与旧实现逐文件兼容。

## 2. 已确认的正向决策

### 2.1 Node 是最小执行与归因单位

- Workflow 由 Node 构成；
- 一次可被独立调度、观察、验证、重试和归因的执行单位是 Node；
- 学习对象不局限于 Agent，而是 Node 内的 Component：`Context`、`Contract`、`Skill`、`Verification`、`Routing`、`Node Boundary`；
- 运行、验证和学习数据必须能够回到具体 `nodeId + executionId + attempt`。

### 2.2 Verification System 是独立运行时子系统

正式名称统一为 **Verification System（验证系统）**。它依据 Node、Context、影响范围、风险、可用验证资产和历史 Evidence，规划并执行验证，形成 Evidence，执行质量门禁，并把结果返回 Workflow Router。

GitHub Actions、传统 CI、测试框架和本地命令只是可被调用的执行基础设施，不能替代 Verification System 的规划、评估和门禁语义。

### 2.3 NodeExecutionRecord 是运行事实基座

`NodeExecutionRecord` 表示一次 Node 执行的结构化事实快照。其最小身份至少包含：

```text
runId
nodeId
executionId
attempt
```

新框架还必须记录 definition、Contract、runtime、Context、model/tool、verification 与 release provenance 的版本引用。

### 2.4 Learning & Feedback 必须建立在事实与因果验证上

已经确认的纵向链为：

```text
Node
-> NodeExecutionRecord
-> EvidenceGraph
-> Node Attribution
-> RootCauseCandidate
-> Causal Validation / Intervention / Replay
-> ValidatedRootCause
-> LearningProposal
-> LearningGate
-> 修改 Node Component
```

Learning 不得把一次失败的语言模型总结直接当作 root cause，也不得绕过正常 Contract、验证和审批路径修改权威行为。

### 2.5 核心语义必须有唯一所有者

状态转换、terminal transition、幂等判定、路由和质量门禁等核心语义只能有一个 canonical owner。版本演进必须通过显式版本与兼容策略完成，不得以“旧路径和新路径同时保留”的方式形成双属主。

### 2.6 GitHub 完整建设，本地完整运行

- GitHub 建设完整 Framework，而不是只存放文档或局部核心；
- 正式源码、Contract、测试、发布和安装资产以 GitHub 为权威；
- Framework 完成后单向下载到本地运行；
- 本地不需要把源码、Evidence、知识数据或私有项目上传到 GitHub；
- 本地既有 GBrain、项目知识库、模型、工具和 Workspace 通过适配器接入。

### 2.7 文档、代码、Contract、测试与 Evidence 必须同构

任何阶段状态必须由可验证事实支持。执行 Agent 可以声明 `IMPLEMENTED`，只有独立验证可以声明 `VERIFIED`。

## 3. 必须消除的历史失败模式

完整重建不得复制以下问题：

1. 多个 operation 重复实现相同业务语义；
2. 旧路径和新路径并存，却被错误描述为版本化；
3. terminal transition 存在双属主；
4. 缺失跨 operation / attempt 的幂等守卫；
5. 测试读取已被 remediation 删除的旧文件，导致测试与实现自相矛盾；
6. 权威实现存在不可导入或缺失依赖；
7. 依赖未初始化全局 singleton；
8. cache 与权威状态不同步；
9. evaluation 静默失败；
10. 文档、Contract、代码、测试和实际生产路径状态漂移；
11. 为提高覆盖率而 mock 掉被验证的核心实现；
12. 以工具报告或文件存在替代真实行为验证。

这些不是普通 backlog，而是新架构的负面不变量：架构测试和质量门禁应主动阻止它们复现。

## 4. 本地资产边界

以下资产保留在本地，不迁入 Framework 仓库：

- GBrain 及其知识数据；
- `swap-kb`、`microwave-kb` 和其他项目知识库；
- 私有项目源码与 Workspace；
- 模型、账号、密钥和网络配置；
- 本地运行状态、日志、Evidence 和缓存；
- 业务私有数据。

Framework 只定义稳定访问 Contract、能力发现、信任标记、provenance 与权限策略。

## 5. 不再继承的假设

- 旧本地代码不是默认事实源；
- 旧目录和类名不具有架构权威；
- 旧测试通过不等于语义正确；
- 旧实现的偶然行为不自动成为兼容要求；
- GBrain 不等于 Framework 内置数据库；
- Learning 不等于自动修改生产代码；
- Evidence 不等于普通日志附件；
- CI 不等于 Verification System。

## 6. 当前仍需通过后续 ADR 决定的事项

- 首个正式实现语言、运行时和工具链的最终版本锁定；
- 本地耐久存储的具体驱动与迁移工具；
- 隔离执行在 Windows 原生、WSL、容器和远程 executor 间的能力分级；
- 本地 Control API 的协议与稳定版本策略；
- GBrain 的实际连接协议和能力清单；
- V1 是否允许经治理的本地 Node Component 自动应用，还是全部保持 proposal-only。

这些未知项不得被临时代码暗中决定。
