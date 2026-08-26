# Canonical Glossary

状态：`BASELINE DRAFT v0.1`

正式文档、代码、Schema 和测试使用以下 canonical term。历史别名只用于检索和迁移说明，不应继续制造新叫法。

| Canonical term | 中文说明 | 允许 aliases / 注意事项 |
|---|---|---|
| Framework | AI 软件工程操作系统的完整运行框架 | 不等同于单个 Agent |
| WorkflowDefinition | 不可变、版本化工作流定义 | Workflow spec |
| WorkflowRun | 定义的一次运行实例 | Run |
| NodeDefinition | 最小执行/归因单元的定义 | Node spec |
| NodeExecution | 一个 Node 的一次逻辑执行 | 不等同于 Attempt |
| Attempt | NodeExecution 的一次实际尝试 | retry attempt |
| Command | 请求状态变化的意图 | 可能被拒绝，不是事实 |
| DomainEvent | 已提交的不可变业务事实 | Event；不能原地改写 |
| SideEffectTask | 外部非确定性/副作用任务 | Worker task；不是 Domain Event |
| Proposal | 模型或外部组件的候选行动/计划 | 非权威 |
| Claim | 候选事实陈述 | 需 Evidence/Verification |
| Deterministic Control Kernel | 权威状态决策与提交内核 | Kernel |
| Workflow Router | 根据已提交事实选择合法下一 Node | 不直接采用模型状态 |
| ContextItem | 带来源、信任和权限属性的上下文项 | 不是普通 prompt fragment |
| ContextSnapshot | Node 执行使用的不可变 Context 集合 | versioned/hashable |
| Contract | 可机器验证的输入、输出、条件和副作用约束 | 不仅是自然语言需求 |
| Skill | 受治理、版本化、可复用执行资产 | 可含 prompt/code/workflow fragment |
| Policy | 权限、风险、预算、验证和审批规则 | 不拥有业务 transition |
| PolicySnapshot | 某次决策使用的不可变 Policy 版本 | 供 audit/replay |
| Human Approval Gate | 结构化人类审批门 | 不是聊天中的模糊同意 |
| Verification System | 规划、执行、评估验证并门禁的子系统 | 不再用 CI 指代整个系统 |
| VerificationPlan | 对某 subject 的不可变验证计划 | 说明覆盖与缺口 |
| VerificationExecutor | 运行某验证步骤的 Adapter | 不决定最终通过 |
| ResultOracle | 根据 Evidence 判断目标条件 | exit code 不是完整 Oracle |
| GateDecision | Verification/Policy 形成的权威门禁结果 | Agent 不可自行提交 VERIFIED |
| Evidence | 带 provenance、完整性和 subject 关系的事实 | 不等同普通日志 |
| EvidenceGraph | Evidence 与结论/执行之间的逻辑关系图 | V1 不要求图数据库 |
| NodeExecutionRecord | NodeExecution 的结构化事实记录 | 学习和归因基座 |
| Node Attribution | 将结果定位到 Node/Component 的归因 | 保留不确定性 |
| RootCauseCandidate | 待验证根因候选 | 不是最终根因 |
| ValidatedRootCause | 经干预/replay/证据验证的根因 | 有适用范围与限制 |
| LearningProposal | 针对 Node Component 的可审查变更提案 | 不是自然语言经验 |
| LearningGate | 学习变更的验证与治理门 | 与 ReleaseGate 分离 |
| Adapter | Port 的具体外部实现 | 不拥有 Core 语义 |
| GBrain | 本地知识系统实现 | 通过 KnowledgeProviderPort 接入 |
| `swap-kb` / `microwave-kb` | 本地项目知识库 | 内容不进入 Framework 仓库 |
| IMPLEMENTED | 已完成实现声明 | 不代表独立验证通过 |
| VERIFIED | 独立验证确认一致 | 必须有 GateDecision/Evidence |

## 禁止继续使用的模糊表达

- 用“CI”指代整个 Verification System；
- 用“Agent 已完成”替代 Node terminal + GateDecision；
- 用“日志”笼统指代 Evidence；
- 用“上下文”同时指 prompt、状态、知识和权限；
- 用“operation”泛指 Command、Event、SideEffectTask 和 use case。

如代码必须使用 `Operation`，必须在所在 bounded context 中给出唯一精确定义，不能作为跨系统基础术语。
