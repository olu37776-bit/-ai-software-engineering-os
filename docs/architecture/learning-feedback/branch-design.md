# Learning & Feedback 分支设计：独立核心、主线集成、受治理改进

状态：`DRAFT — implementation not authorized`  
日期：`2026-09-08`  
基线 commit：`3c387f5f196ddfae8e8989710d5a55f9def472a7`  
基线 tree：`5938f8e2f3e3a5e5dfbd0fde5ac66c092f2a7117`  
入口：[06-learning-and-feedback](../06-learning-and-feedback.md)  
计划：[分阶段建设计划](../../roadmap/learning-feedback-branch-plan.md)  
依据与限制：[基线审查报告](../../reviews/learning-feedback/github-baseline-review-2026-09-08.md)

> 本设计是 Issue #81 的文档提案，需独立审查。它不覆盖 Charter、accepted ADR 或已激活 Schema；不授权 Phase 1 提前开发 Learning runtime。本文中的拟新增字段/文件均非已发布 Contract。

## 1. 核心决策

这条分支可以作为独立工作流建设，但不能把主线缺失能力在分支内补成第二套 Runtime。采用现有 TypeScript modular-monolith：确定性核心与外部事实读取、Context 交付、持久化、治理执行解耦；运行时仍使用唯一主线。

当前可推进文档、接口提案、案例和验收设计。取得代码 scope 后，可先建设纯 Feedback 核心及 conformance suite；真实事实读取、Context 消费和闭环验证按主线能力门禁接入。不要空等整个 Framework 完成，也不要把 fixture 通过写成生产闭环已完成。

学习对象为 Framework 规则、Node 组件及受治理资产；不是业务知识抽取系统。V1 不训练模型、不自动改裁判规则、不建设通用插件市场或第二部署服务。

## 2. 当前能力与不可假设项

| 主线能力 | 基线中可见事实 | 分支当前可使用程度 |
| --- | --- | --- |
| 工具链/Schema 基础 | exact toolchain、contracts validator、generated types、架构检查已有实现 | 复用现有规范；不得自行换版本 |
| Policy | Phase 1 compiler/evaluator qualification | 可研究 public Contract；不等于 approval lifecycle 已实现 |
| Persistence | node:sqlite/PersistenceWorker qualification | 不等于任意 Runtime facts Query API 已存在 |
| CLI/runtime/worker | Control API lifecycle 与进程资格能力 | 不等于 Workflow/Node scheduler；`startRuntime` 目前包装 Control API |
| GateDecision/EvidenceMetadata/NodeExecutionIdentity | active Schema 存在 | 可以设计 schema-conformant fixture；不能凭 Schema 假定 producer |
| NodeExecutionRecord | planned，owner 为 node-runtime，Phase 2 | 不能调用假想 Repository；保留主线 owner |
| ContextSnapshot/ContextItem/RouteDecision | planned，目标 Phase 3 | 当前不能声称真实反馈交付已成立 |
| VerificationExecution/Assessment | planned，目标 Phase 3 | 当前不能声称真实反馈关闭已成立 |
| Learning 六项 Contract | planned，目标 Phase 7 | 按 catalog 扩展，不另建同名权威 |
| ExecutionFeedback/FeedbackResolution/LearningCase | 当前 inventory 未登记 | 先做 owner/semantic-gap 评审，再授权激活 |

本表是指定 SHA 的事实摘要，不是 Phase 1 全量验收。详细来源见审查报告 S01–S15。

## 3. 三个闭环与权力边界

```text
主线：Command -> committed Event -> NodeExecution/Attempt
          -> ContextSnapshot -> controlled execution -> Verification/Gate
          -> Router/Kernel transition
                 |
                 | immutable facts / bounded query
                 v
Feedback：可信差距 -> 纠偏义务 -> 受控 Context 贡献
                -> 后续执行已使用的 provenance -> 原义务评价
                 |
                 | history + successful controls
                 v
Learning：学习准入 -> 归因候选 -> 因果验证 -> Proposal
                -> 既有 Policy/approval/工程变更 -> 后续效果评价

KnowledgeProvider：独立负责项目知识；仅接受受治理的知识缺口交接。
```

Router 先有权选择合法后续目标，Feedback 再按已证明的 causation/scope 提供输入。也可以并行消费同一 committed fact；不引入“Feedback 先选 Node”的隐式路由。Feedback 不拥有 NodeRun/NodeResult 的第二套状态机。

## 4. Canonical ownership

| 语义 | 唯一 owner | 本分支职责 |
| --- | --- | --- |
| Execution/Attempt、NodeExecutionRecord | packages/node-runtime | 消费引用/事实视图，不重建执行身份 |
| 运行事件、转换、幂等基础 | kernel/workflow 与 persistence 边界 | 使用公开能力，不直接改终态 |
| ContextSnapshot 接收、预算、trust/redaction | packages/context | 提供受控贡献，不直接制作 approved snapshot |
| EvidenceMetadata/EvidenceEdge | packages/evidence | 查询事实和关系，不建立第二 EvidenceGraph |
| VerificationExecution/Assessment/业务 Gate | packages/verification | 使用已产生的 criteria assessment，不重新执行 Oracle |
| Policy authority | packages/policy | 复用唯一 evaluator，不新增替代策略引擎 |
| Feedback/Resolution、Learning 评价规则 | packages/learning（新增 Feedback ownership 待批准） | 确定性投影与派生评价 |
| SQL、journal/projection/checkpoint | packages/persistence | 实现所需 Port，不泄漏 driver/表名 |
| 跨模块用例、wiring、生命周期 | packages/platform | 显式装配，无 globalThis service locator |
| 项目知识事实及其治理写入 | KnowledgeProvider/对应资产 owner | 输出缺口或提案，不直接摄取/改写 KB |

`LearningGateDecision` 有自己的提案治理语义，但不是另一份业务 GateDecision；权限仍受同一 Policy authority 约束。不得为了延续旧聊天设计删除仓库的 NodeExecutionRecord 或既定 LearningGateDecision。

## 5. 代码与文档落点

实现语言跟随 `toolchain/toolchain.json`、pnpm lock 与 ADR-0007：TypeScript、ESM/NodeNext、现有 project-reference build。正文不维护平行工具链版本号。不是 Swap Java package，也不新增 Python 服务。

以下为授权后的目标目录，当前不创建空文件或空 package：

```text
packages/learning/
  package.json
  tsconfig.json
  src/
    index.ts                         # @aseos/learning 唯一 public entry
    feedback/
      domain/                        # 不可变纠偏语义/派生评价
      application/                   # projector、resolution evaluation
    improvement/
      domain/                        # 后续 candidate/experiment/proposal
      application/                   # 准入、归因、效果评价
    ports/                           # 仅实际用例需要的只读事实/存储接口
  test/                              # 纯逻辑、replay、边界测试
packages/platform/src/learning-feedback/
  ...                                # 主线 query/Context 集成、用例装配
packages/persistence/src/             # 仅复用既有 Worker/Port 模式的实现
packages/contracts/schemas/learning/  # public/persisted Schema，批准后登记
packages/contracts/examples/learning/
tests/contract/learning-feedback/
tests/integration/learning-feedback/
tests/replay/learning-feedback/
tests/fault-injection/learning-feedback/
tests/acceptance/learning-feedback/   # 真实 public CLI/API 验收
```

`packages/learning` 是 blueprint 已规划的 owner；不要再创建 `packages/learning-feedback`、嵌套 Java `src/main/java` 或 `.ai-local` 生产源码树。具体单文件名在每个 operation 的 WRITE_SCOPE 冻结，目录图不是无限写授权。

Domain/纯 evaluation 不做文件、网络、SQL、环境变量、隐式时钟或随机读取。Application 消费显式输入/Port；mainline adapters 由 platform 装配，调用主线 public API；persistence 实现所需持久化 Port。只有外部 model/tool/knowledge 等 provider 放在 `packages/adapters`，不为了名字一致把跨主线用例塞进外部 provider 层。严禁 deep import。

文档沿用本仓库 `docs/`；`.ai-local/docs/learning-feedback/` 是旧本地工作区约定，不适用于本仓库公开 Authority。

## 6. 数据流与接口提案

### 6.1 一次有边界的只读事实读取

核心输入是经过边界校验的事实集合，包含主线 canonical identity、subject/version、criteria assessment、Evidence 引用、GateDecision、原 Contract/policy snapshot、source commit/checkpoint。准确字段必须映射已发布 Schema；不得为凑字段临时发明 NodeResultRepository。

Query 必须返回：成功且 snapshot 一致，或 typed NOT_FOUND/INCONCLUSIVE/BLOCKED/ERROR。区分暂时尚未提交、版本不支持、引用损坏、权限不足与依赖缺失。缺依赖不等同于“业务未解决”。

涉及多个记录时，使用主线 read snapshot/一致 checkpoint，避免读取新 Gate 配旧 Evidence。权威存储按 ADR-0008 的 SQLite/PersistenceWorker 路径，不引入 YAML Facts Store。YAML fixture 只可作为非生产输入格式，不能冒充 committed journal；旧 ILayout 方案不自动移植。

### 6.2 ExecutionFeedback（拟新增）

语义分组：

- identity：schema version、feedback identity、idempotency key、projection version；
- source：NodeExecutionIdentity、source decision/assessment refs、Contract/criterion version/hash、snapshot/checkpoint；
- obligation：observedGap、requiredOutcome、retainedConstraints、closure requirements；
- provenance：supporting/contradicting evidence refs、可解释生成依据；
- applicability：有效执行 lineage、版本和权限边界，由主线事实证明，不由自由文本猜测。

不保存完整 Evidence/NodeExecutionRecord 副本，不包含 nextNode、rootCause、任意代码修改建议。通常一个原子 criterion obligation 一条反馈；组合 criteria 必须有 Contract 定义的原子组。事实不足返回 projection gap，不构造虚假的确定性 observedGap。

### 6.3 消费关系与 Context

主线已确定目标 NodeExecution/Attempt 后，由授权 Context 构建入口查询相关反馈。匹配依据是 source/causation/lineage、目标 definition version 和受允许的作用域；不按 Node 名字或错误文本猜关系。

Context 只携带本次必要纠偏内容及 refs，经预算、trust、redaction、冲突和 Policy 检查。证明“已消费”必须同时具备：主线快照包含 sourceRef；对应 Attempt 的启动/执行事实固定使用该 snapshot。Provider 调用成功不能充当证明，也不能保证模型真正遵守了反馈。

优先使用 ContextSnapshot 与 NodeExecutionRecord 的 provenance。只有主线不足时才提议最小关联 Contract，不新建第二 Context store。被拒绝/阻塞/裁剪掉的 contribution 不记为消费。重复构建同一 snapshot 不重复消费；新 Attempt 可产生新的独立消费关系。

### 6.4 FeedbackResolution（拟新增）

保留 feedbackRef、consumer execution/attempt refs、后续 assessment/Gate/Evidence refs、逐 criterion 评价、评价器版本和 source checkpoint。业务 disposition 和评价可用性必须分开：

- 完整评价后：RESOLVED / PARTIALLY_RESOLVED / UNRESOLVED；
- 无法完整评价：INCONCLUSIVE / BLOCKED / ERROR，保留 evaluation gaps，不伪造正常关闭结果；
- 已接受风险、豁免或取消：单独保留 disposition/provenance，不记成 criterion 已实际满足。

最终枚举在 Schema 评审冻结，不凭本文私下改已有 Schema。Evaluator 只匹配主线已裁决的 criterion assessments 与原 closure requirements；不自行跑测试、不把退出码转换成业务 PASS、不另做 Oracle/Gate。

一次后续 Node PASS 不自动关闭所有历史反馈。必须确认同一反馈、合法 lineage、精确版本/subject、必要覆盖、无未处理反证和满足原 Gate requirement。原始 feedback 不可变，后续评价 append-only；当前状态是可重建 view，不用 last-write-wins 覆盖历史。

### 6.5 GateDecision outcome 必须完整映射

| 主线 outcome | Feedback 处理约束 |
| --- | --- |
| PASS | 通常不生成新纠偏；关闭旧反馈仍须精确 coverage/lineage |
| PASS_WITH_RISK_ACCEPTANCE | 记录授权风险 disposition；不能默认已修复全部条件 |
| REWORK | 仅对有依据的差距产生纠偏义务；不自行 retry |
| BLOCK | 表达前置条件/权限等阻塞，不能编造执行失败或根因 |
| REQUIRE_HUMAN_APPROVAL | 交给既有审批；不转成自动补丁/批准 |
| FAIL_TERMINAL | 保留失败/学习输入，不能自行重开 terminal execution |
| INCONCLUSIVE | 显式 evidence gap，不推断 FAIL，也不关闭反馈 |

Schema 引用：`packages/contracts/schemas/verification/gate-decision.schema.json`。上游新增 enum/required field 时，先拒绝不支持版本并走兼容评审，不默认成功。

## 7. 持久化、幂等与恢复

未来持久化只记录 Feedback 自身语义及来源引用；原主线 facts 不复制。共用基础设施不等于共用写权限，Core 不能直接写其他 owner 的表。

幂等依据至少绑定 source decision identity/version、criterion/group、projection schema/evaluator version及必要 input hash。身份格式沿用 canonical identifiers，不用 hash 冒充 UUID。相同 key 不同 payload 必须冲突可见；数据库唯一约束/事务承担并发安全，不能仅“先查再插”。

投影发生在来源提交后；消费 checkpoint 和派生记录的推进须可原子恢复，或采用已批准的 durable outbox/retry 协议。Feedback 写失败不撤销主线既成事实，不伪装处理成功；重启可从 checkpoint 重建。缓存可丢弃，删掉缓存后结果必须等价。所有这些是后续 integration 的验收义务，Phase 1 qualification 不代表它们已经具备。

来源归档后保留合法可审计 refs/manifest 和显式 retention/redaction 状态。资料缺失时不能把缺失当作已解决。私有 Evidence 不因调试方便写入 GitHub。

## 8. Learning 扩展，不抢跑实施

先做确定性准入：同 definition/criterion/version 的重复反馈、多次未解决、治理允许的严重事件或人工升级。保留基线成功样本、暴露次数/分母；单看失败数不能得出失败率改善。

LearningCase 是问题集合，不自动归因。Attribution 允许 in-node、upstream、external、unknown，随后才形成 RootCauseCandidate。复用已规划六个 Learning Contract；LearningCase/Effectiveness 的公共化须单独做 semantic-gap 评审，避免为每个步骤制造空壳对象。

因果实验冻结目标版本、输入、模型/工具版本和允许变量，复用既有 Execution/Verification 能力；不能回放时记录限制，不把一次 pass 视为根因验证。Proposal 固定 target version/diff/适用范围、风险、回归与 rollback，经现有治理执行。后续效果比较关注任务结构变化、成本、时延、false block 和 regression；不能把模型升级带来的提升归到某个 Policy patch。

## 9. 故障隔离与安全

默认反馈是可选增强：禁用时主线原来允许的路径继续工作。若主线 Policy 明确要求某类反馈/证明，则缺失应由主线 fail closed，不能一概 fail open。这两个模式须在配置/Policy 中显式区分，分支不得自行降低门禁。

Feedback 内容是带 provenance 的任务数据，不因来自历史而升为系统指令。限制 payload 大小、数据敏感度、来源权限与可用寿命；被污染的自然语言不能请求改 WRITE_SCOPE 或批准自己。学习执行者不能同时修改本实验的 verifier、Gate/Policy、审批凭据和预期结果。

## 10. 验证层级

| 等级 | 能证明什么 | 不能证明什么 |
| --- | --- | --- |
| Schema/example | 格式、引用、版本约束 | 生产记录真实存在 |
| Pure/unit/property/replay | 确定性规则与反例 | Adapter wiring/交付 |
| Conformance fixture | producer/consumer 契约兼容 | Runtime 已集成 |
| Production-path integration | 干净启动、正式 composition/query/持久化路径 | 整个工作流已闭环 |
| Workflow E2E | public CLI/API 到来源、消费、复验、resolution | 任意真实 provider/私有环境都支持 |
| Independent exact-SHA review | 当前 scope 和证据支持的 verdict | 后续 HEAD 自动继续 VERIFIED |

核心 anti-regression cases：C-1 风格的未装配依赖必须显式失败；C-2 风格“投影写库但交付读空 cache”必须在新进程真实查询中失败。还需 coverage 缺失、错 run/attempt/version、反证、风险接受、重复投递并发、进程中断、禁用和必需模式测试。

Fixture/mock 用于隔离单元和模拟外部 provider 合法，但不得替代被证明的 wiring、Context snapshot 生产、业务 assessment 或主线 transition。每份报告声明真实组件和替身边界。

## 11. 与主线交界的最小需求清单

| 需求 | 应由谁确认/提供 | 就绪证明 |
| --- | --- | --- |
| Execution/Attempt 与版本身份 | node-runtime/contracts | public schema + producer + replay case |
| committed facts query/checkpoint | kernel/persistence/platform | 一致读取、restart、权限、错误 contract |
| 可追踪 Context contribution 与实际使用 | context/node-runtime/platform | snapshot sourceRef + Attempt 使用事实 |
| criterion-level authoritative assessments | verification/contracts | 原 criterion/version 到后续 Evidence 的覆盖关系 |
| Policy/approval/proposal dispatch | policy/platform | 不可绕过、scope/version 固定、结果可追踪 |

缺哪个 provider，阻塞相应集成项，不为它在 Learning 内创造替代品。接口名称待主线真实 public entry 确认，不能把此需求表当作已存在 API。

## 12. Dogfooding 与停止条件

当前仓库 Issue/PR/CI/governance Evidence 可用来设计真实问题样本，但它们不是 Runtime NodeExecutionRecord，不能强转成“框架已自己执行”的证据。

首次真正 dogfooding 必须已有受控 Workspace/worker、WRITE_SCOPE enforcement、可追溯执行、独立 verifier/Gate 和重试闭环。先做有 oracle 的一个隔离修复；C-2 可作为历史场景种子，不能默认把旧私有源码上传。固定 Framework/verifier 基线，待修模块不能修改自己的裁决规则；独立外部复核保留。

以下停止：无合法 scope、必要主线 provider 不存在、身份/owner 歧义、旧证据不适用新 HEAD、测试必须造假才能过、需要扩大 accepted ADR 语义、需要上传私有数据。普通实现错误在已授权范围内 remediation，不扩大目标。

## 13. 当前结论

设计方向为“同仓库独立模块、契约先行、分级证明、能力门禁集成”。当前只完成文档提案，不宣称纯核心或运行反馈已实现。下一步按建设计划评审 Contract/接口缺口与独立核心授权；不是恢复旧 F2，也不是直接实施完整 Learning。
