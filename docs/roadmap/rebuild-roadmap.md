# 完整重建路线图

状态：`BASELINE DRAFT v0.2`  
日期：`2026-08-26`

## 1. 原则

路线按可验证 vertical slice 推进，不按目录数量或文档数量判断进度。每个阶段必须产生可运行资产、Contract、测试和 Evidence，并满足退出门禁后才能扩大范围。

旧本地实现不作为代码起点。需要参考旧行为时，只提取已验证 Contract、故障事实和必要 compatibility case。

## Phase 0 — Architecture Authority

### 目标

冻结完整重建的使命、边界、不变量、Canonical Terms、关键 ADR 与进入实现前的 Contract/operation plan。

### 已完成产物

- Architecture baseline；
- ADR-0001～ADR-0011；
- Phase 0 independent architecture review；
- glossary；
- engineering/quality standards；
- release/local runtime protocol；
- Contract Catalog；
- first vertical slice specification。

### 剩余产物

- machine-readable Schema inventory 与第一批 JSON Schema/examples；
- executable vertical-slice examples；
- Phase 1 WRITE_SCOPE、VerificationPlan、风险与回执格式；
- GBrain protocol facts survey（不阻塞 Kernel foundation）。

### 退出条件

- 文档之间无关键术语/所有权冲突；
- GitHub vs Local、Core vs Adapter、Model vs Authority 边界明确；
- Node、Execution、Attempt、Command、Event、Evidence、PolicyDecision、GateDecision 定义冻结；
- toolchain、persistence、Control API、Windows isolation、Policy representation 有 accepted ADR；
- 首条 slice 的核心 Contract 有 machine-readable schema/examples；
- Phase 1 operation plan 可独立执行；
- 未决安全事项进入显式 backlog，未被临时代码暗中决定。

## Phase 1 — Executable Repository Foundation

### 目标

建立可构建、可测试、可发布的最小 Framework foundation，并完成关键 ADR qualification。

### 产物

- Node.js 24.19.0 / TypeScript 6.0.3 / pnpm 11.24.0 exact toolchain；
- ESM-only monorepo/package boundaries；
- schema build/validation/generation；
- PolicySet compiler、canonicalization 与 evaluator skeleton；
- CLI/runtime/worker entrypoints；
- loopback Local Control API skeleton、token lifecycle 与 OpenAPI contract；
- `PROCESS_RESTRICTED` Job Object/process lifecycle 与 capability probe；
- architecture tests；
- SQLite/`node:sqlite` PersistenceWorker qualification spike；
- GitHub Actions baseline；
- artifact/SBOM/provenance pipeline；
- Windows self-contained package smoke。

### 退出条件

- clean checkout 一条命令构建；
- architecture dependency violations 自动失败；
- Schema 与 generated/runtime types 一致；
- Policy invalid/indeterminate fail closed；
- 空 Runtime 可通过 public API/CLI `doctor/start/stop/version`；
- API 只监听 loopback并要求安全 token；
- process tree 可 cancel/timeout/clean shutdown，无 orphan；
- SQLite qualification 覆盖 transaction/crash/backup/migration；
- Release artifact 可在干净 Windows 环境启动；
- 安装不触碰既有 data root。

## Phase 2 — Deterministic Durable Kernel

### 目标

实现不依赖模型和真实工具的权威执行内核。

### 产物

- Command/Event envelope；
- append-only journal；
- aggregate/reducer；
- optimistic concurrency；
- inbox/outbox；
- scheduler lease；
- retry/timeout/cancel；
- projection rebuild；
- recovery；
- schema migration；
- NodeExecutionRecord core；
- Policy evaluator application-service integration、decision audit/replay；
- minimum capability/isolation rules。

### 退出条件

- state replay 等价；
- crash boundary tests 通过；
- duplicate delivery 不产生重复 transition/effect；
- terminal transition 唯一；
- PolicyDecision 对相同 snapshot/input 确定且不可绕过；
- invariant mutation tests 达标；
- backup/restore 可验证。

## Phase 3 — First Complete Vertical Slice

### 目标

打通一个最小但完整的受治理 Workflow：

```text
CLI/API Command
-> WorkflowRun
-> NodeExecution
-> ContextSnapshot
-> PolicyDecision
-> fake/model Proposal
-> controlled SideEffectTask
-> IsolationEvidence
-> Evidence
-> VerificationPlan/Oracle/Gate
-> Router
-> terminal result
```

### 产物

- versioned Workflow/Node Definition；
- deterministic Router；
- Context compiler minimum；
- fake Model/Tool Adapter；
- real minimum Policy consumption；
- Artifact Store；
- Verification minimum；
- local inspect/replay；
- acceptance scenario。

### 退出条件

- 正向、失败、retry、cancel、restart 全链可重放；
- NodeExecutionRecord 完整；
- 模型 Claim 无法直接完成 Node；
- Executor 无法自行标记 verified；
- Policy/Isolation requirement不能绕过或向下回退；
- 每个 terminal result 有 GateDecision。

## Phase 4 — Real Local Integrations

### 目标

连接真实本地资源，同时保持 Core 不依赖具体实现。

### 产物

- model provider adapters；
- workspace/git adapter；
- restricted process/tool adapter；
- secret provider；
- GBrain KnowledgeProvider adapter；
- capability/isolation discovery/preflight；
- Context provenance/trust policy。

### 退出条件

- 每个 Adapter 通过 conformance suite；
- GBrain 数据无需迁入仓库即可被 Context 使用；
- Adapter 不可用产生明确 BLOCKED/alternative route；
- prompt injection/secret leakage fixtures 通过；
- Windows path/process tests 通过。

## Phase 5 — Verification System V1

### 目标

从固定测试调用升级到风险与 Evidence 驱动的验证系统。

### 产物

- impact/risk model；
- VerificationProfile/Planner；
- executor registry；
- static/unit/integration/startup/E2E adapters；
- deterministic ResultOracle；
- EvidenceGraph；
- Gate policy；
- historical evidence quality/freshness。

### 退出条件

- 不同风险产生可解释 Plan；
- unavailable/skipped/inconclusive 不会伪装 pass；
- exit-0-but-wrong scenario 被 Oracle 拒绝；
- implementation 与 verification role 分离；
- Router 正确消费 GateDecision。

## Phase 6 — Governance and Safety

### 目标

扩展既有 Policy owner，实现完整 capability security、Human Approval 和高风险副作用治理。

### 产物

- complete PolicySnapshot layering/override；
- permission/capability token；
- approval lifecycle；
- `OS_SANDBOXED` Windows provider 与 negotiation；
- audit facts；
- risk acceptance；
- security scenario suite。

### 退出条件

- deny-by-default property tests；
- approval scope/expiry/replay 正确；
- sandbox 不满足时 fail closed；
- secret 不进入模型/日志；
- destructive action 有 preview、approval、isolation 与 post-verification；
- 不存在第二套 Policy evaluator 或 isolation selector。

## Phase 7 — Learning & Feedback V1

### 目标

基于真实 NodeExecutionRecord 和 Evidence 构建 proposal-first 学习闭环。

### 产物

- Node Attribution；
- RootCauseCandidate；
- causal validation/replay；
- ValidatedRootCause；
- LearningProposal；
- LearningGate；
- local proposal inspection/export summary。

### 退出条件

- evaluator 无隐式 singleton/cache authority；
- evaluation failure 不静默；
- correlation 不会直接升级为 validated root cause；
- Proposal 指向明确 Component/version；
- Framework code change 不会在本地绕过 GitHub 流程自动应用。

## Phase 8 — Production-grade Local Release

### 目标

提供可替换旧本地 Framework 的正式发行版。

### 产物

- self-contained Windows Release；
- init/doctor/start/status/backup/upgrade/rollback；
- config/state migration；
- release manifest/SBOM/provenance；
- built-in local acceptance；
- documentation and operator guide。

### 退出条件

- 干净机器安装和运行；
- 现有本地知识库通过 Adapter 接上；
- 升级失败自动保留/恢复旧版本；
- local private data 不上传；
- release 全链可追溯到 commit/Contract/Evidence；
- cryptographic integrity、approval identity 与 Evidence encryption 风险已决策。

## Phase 9 — Hardening and Beta

### 目标

在真实工作负载中验证可靠性、性能和运维。

### 产物

- long-running soak；
- failure injection/chaos；
- large Evidence/Context benchmarks；
- compatibility matrix；
- security review；
- recovery drills；
- beta issue taxonomy；
- support/retention policy。

### 退出条件

- 无未解释的数据丢失或重复副作用；
- SLO 达标；
- 高风险 finding 已关闭或正式接受；
- 本地旧 Framework 可退役；
- mainline 只存在一个 canonical runtime。

## 2. 当前下一步

Phase 0 按以下顺序继续：

1. machine-readable Schema inventory；
2. first vertical slice executable examples；
3. Phase 1 WRITE_SCOPE 与 VerificationPlan；
4. M0 final Gate；
5. 用户批准后进入 Phase 1。

五项关键技术 ADR 与独立架构审查已经完成，不再重复设计。
