# Phase 0 独立架构审查

审查决策：`PASS_WITH_RESIDUAL_WORK`  
审查日期：`2026-08-26`  
审查基线：commit `65b76880b6011f4fec98fafb1aaef63b127ef838`  
Remediation：ADR-0007～ADR-0011 及本 Review 所在 commit

## 1. 独立性与结论边界

本审查采用与原始文档建设分离的 review pass，从 authority ownership、跨文档一致性、failure semantics、安全边界、可实施性与 Phase ordering 重新验证基线。

这不是第三方渗透测试、代码审计或生产运行验证。仓库目前尚无 Framework 实现，因此本结论只表示：

> 架构基线在完成本次 ADR remediation 后，可以作为 Phase 1 WRITE_SCOPE 与 executable repository foundation 的权威输入。

它不表示任何 runtime capability 已 `IMPLEMENTED` 或 `VERIFIED`，也不表示 Phase 0 的全部剩余产物已经完成。

## 2. Review Scope

覆盖：

- Framework Charter 与 current knowledge baseline；
- target architecture 与 durable execution；
- Context/Contract/Policy；
- Verification/Evidence 与 Learning；
- local integration、security/governance、Threat Model；
- capability map、first vertical slice、NFR；
- engineering standard、quality gates、repository blueprint；
- release/configuration protocol；
- core Contract Catalog、glossary、roadmap；
- ADR-0001～0006。

不覆盖：

- 尚未存在的代码、Schema 实现和 migration；
- 本地 GBrain 真实 API/protocol；
- 本地模型/provider、Windows edition 与 Workspace 的实际 capability；
- production cryptographic/key-management 设计；
- Release packaging 实测。

## 3. Method

审查使用五类检查：

1. **Authority check**：每个核心语义是否只有一个 canonical owner；
2. **Consistency check**：术语、状态、Contract、阶段与依赖是否冲突；
3. **Failure check**：invalid/unavailable/duplicate/crash/partial result 是否 fail closed 且可恢复；
4. **Implementability check**：Phase 1 是否会被迫在代码中暗中决定关键技术；
5. **Threat/NFR check**：安全控制与可测 NFR、quality gates 是否对应。

Severity：

- `P0`：架构自相矛盾或会产生多权威/数据损坏；
- `P1`：进入 Phase 1 前必须冻结的关键决策；
- `P2`：不阻塞 foundation，但需在对应阶段前关闭；
- `P3`：说明性/维护性问题。

## 4. 总体审查结论

### 4.1 未发现 P0 冲突

以下关键不变量在基线中一致：

- `Node` 是最小执行与归因单位；
- `NodeExecution` 与 `Attempt` 分离；
- Kernel 是 authority transition 与 terminal state 的唯一协调者；
- Model、Adapter、Worker、VerificationExecutor 只能产生 Proposal/Result/Evidence，不能提交终态；
- Command 是意图、DomainEvent 是已提交事实；
- Event Journal 是事实源，Projection/Cache/Telemetry 不是；
- Event + outbox/inbox/idempotency 使用原子持久化和明确 identity；
- Verification System 规划、执行、Oracle 和 Gate 分离；
- 实现 Agent不能自行声明 `VERIFIED`；
- Learning 以 NodeExecutionRecord/Evidence/因果验证为前置，不能直接改 Kernel；
- GitHub 完整建设、Local 单向下载和私有资源 Adapter 接入边界明确。

没有发现旧问题中“多个 operation 复制同一 terminal transition”或“旧/新路径伪版本化”在目标设计里被重新引入。

### 4.2 五项 P1 决策缺口已关闭

| Finding | Baseline gap | Resolution | Status |
|---|---|---|---|
| `P1-01` | Node/TS/pnpm/ESM 构建仍是候选，Phase 1 会隐式选择 | [ADR-0007](../decisions/ADR-0007-typescript-toolchain-baseline.md) | `CLOSED` |
| `P1-02` | 只确定 embedded relational DB，未确定 engine/driver/transaction lane | [ADR-0008](../decisions/ADR-0008-embedded-persistence-sqlite.md) | `CLOSED_WITH_QUALIFICATION` |
| `P1-03` | CLI/UI/Runtime API transport、auth、idempotency 与 streaming 未冻结 | [ADR-0009](../decisions/ADR-0009-local-control-api-protocol.md) | `CLOSED` |
| `P1-04` | Windows isolation level 名称存在，但保证、provider 与降级规则不精确 | [ADR-0010](../decisions/ADR-0010-windows-execution-isolation.md) | `CLOSED_WITH_PHASED_IMPLEMENTATION` |
| `P1-05` | `PolicyEnginePort` 存在，但 representation/evaluator/conflict semantics 未冻结 | [ADR-0011](../decisions/ADR-0011-policy-engine-and-representation.md) | `CLOSED` |

`CLOSED_WITH_QUALIFICATION` 表示决策已经唯一，但指定实现仍必须通过明确 spike/Gate；失败时只能通过 superseding ADR 改变，不存在自动 fallback。

## 5. Additional Finding

### `P1-06` Policy 与 Isolation 的 Phase ordering 含糊 — `CLOSED`

**Observation**：首条 Vertical Slice 已要求 Policy pre-check、Workspace capability 与受限 Worker，但原 roadmap 把完整 Governance/Safety 放在 Phase 6，容易被误读为 Phase 3 之前无需真实 Policy/Isolation 语义。

**Risk**：早期 slice 可能使用 hard-coded allow 或 unrestricted process，之后再新增第二套 Policy/Sandbox，形成双属主和无法重放的历史结果。

**Resolution**：

- ADR-0011 把 Policy schema/compiler 放入 Phase 1、Kernel integration 放入 Phase 2、首条 slice consumption 放入 Phase 3；
- ADR-0010 把 `PROCESS_RESTRICTED`、capability probe 和 fail-closed contract 放入 Phase 1；
- Phase 6 只扩展完整 approval、capability token、risk acceptance 与 `OS_SANDBOXED`，不创建新 owner；
- roadmap 在同一 remediation commit 对齐。

## 6. Cross-System Ownership Matrix

| Semantic | Canonical owner | Non-owner inputs/consumers | Result |
|---|---|---|---|
| Command -> Event transition | Kernel reducer | API/Router/Model/Adapter | `CONSISTENT` |
| Workflow/Node eligibility | Workflow Router using committed facts | Model RouteProposal | `CONSISTENT` |
| terminal transition | Kernel canonical transition | Gate/Approval are required facts | `CONSISTENT` |
| authority persistence | Persistence UnitOfWork | SQLite driver internal only | `RESOLVED ADR-0008` |
| model output | Intelligence/Model Adapter as Proposal | Contract/Policy/Verification consume | `CONSISTENT` |
| external side effect | SideEffectTask + Worker Result | Kernel commits result | `CONSISTENT` |
| PolicyDecision | `packages/policy` evaluator | capability/approval/risk facts | `RESOLVED ADR-0011` |
| Verification GateDecision | verification Gate evaluator | executors/oracles/evidence | `CONSISTENT` |
| ContextSnapshot | Context Compiler | KB/repo/tool sources | `CONSISTENT` |
| Evidence metadata/relations | Evidence subsystem | producers create typed facts | `CONSISTENT` |
| Local control entry | platform Control API | CLI/UI clients | `RESOLVED ADR-0009` |
| execution isolation selection | Policy; provider reports capability | Tool/Workspace adapters | `RESOLVED ADR-0010` |
| toolchain identity | toolchain manifest + lockfile | CI/Release consume | `RESOLVED ADR-0007` |
| learning application | LearningGate + normal change/release path | model produces proposal | `CONSISTENT` |

## 7. Failure-Semantics Review

基线与新 ADR 共同满足：

- invalid schema/version -> reject/fail closed；
- duplicate Command/Result -> persisted dedup，不依赖 cache；
- concurrent authority write -> optimistic conflict，不 last-write-wins；
- effect outcome unknown -> reconciliation required，不猜成功/失败；
- Policy unavailable/indeterminate -> governed mutation blocked；
- sandbox minimum unavailable -> task blocked，不向下回退；
- verifier unavailable/missing Evidence -> `BLOCK/INCONCLUSIVE`，不 pass；
- Control API connection loss -> durable operation继续，client 查询 committed state；
- persistence corruption -> quarantine，不自动空库覆盖；
- model/adapter self-reported success -> Claim/Result，不能直接 terminal。

审查未发现 catch-and-continue、silent fallback 或 cache-as-authority 被设计为合法路径。

## 8. Architecture Risks Accepted for Phase 1

### R1 — `node:sqlite` Release Candidate

接受原因：runtime 精确 pin、API 被 internal Port 隔离、Windows self-contained 优势明显。Phase 1 qualification 是硬 Gate；不通过必须 supersede ADR-0008。

### R2 — Loopback bearer token 的同用户边界

token + user-only ACL 防止无凭据普通本地调用，但不抵御已控制同一 OS user 的进程。V1 将其作为 residual risk；远程与更强同用户 identity binding 不在当前范围。

### R3 — `PROCESS_RESTRICTED` 不是 security sandbox

Phase 1 只把它用于受信任、低风险、staged/reversible 工具。模型生成代码和不受信任依赖需要 `OS_SANDBOXED`，不可用时阻塞。

### R4 — Policy language intentionally constrained

Condition AST 不追求通用编程能力。若真实规则无法表达，先形成需求/Evidence，再扩展 operator；不能使用任意脚本旁路。

## 9. Residual Phase 0 Work

本次 Review/ADR 完成后，Phase 0 仍需：

1. 把 Core Contract Catalog 转成首批 machine-readable JSON Schema inventory 与 valid/invalid examples；
2. 为第一条 Vertical Slice 落盘 executable Command/Event/Policy/Verification examples；
3. 形成 Phase 1 `WRITE_SCOPE`、VerificationPlan、风险分类和结构化回执格式；
4. 完成 GBrain connector facts/protocol survey（不阻塞 Kernel foundation）；
5. 在 production-grade Release 前决定 Event/Artifact cryptographic integrity depth、local approval identity 与 Evidence encryption/key management；
6. 通过 Phase 1 spike验证 storage、packaging、Control API 与 Windows process lifecycle。

## 10. GateDecision

```text
Phase 0 independent architecture review: PASS
Architecture baseline use: ALLOWED_FOR_PHASE_1_PLANNING
Production implementation status: NOT_STARTED
Phase 0 overall status: IN_PROGRESS
```

允许的下一步：

- 生成 machine-readable schema inventory；
- 编写 Phase 1 operation plan/WRITE_SCOPE/VerificationPlan；
- 在明确 WRITE_SCOPE 内进行 ADR 要求的最小 qualification spike。

尚不允许：

- 批量创建空 package/interface 制造进度；
- 绕过 Phase 1 plan 开始大规模 runtime 实现；
- 把任何 ADR 选择描述成已经通过运行验证；
- 将文档 Review 结论等同 capability `VERIFIED`；
- 在本地设计自动上传源码、Evidence 或私有知识回 GitHub 的路径。

## 11. M0 Recommendation

五项关键技术决策已收口，基础架构不存在阻止 Phase 1 规划的 P0/P1 ownership conflict。完成 Schema inventory 与 Phase 1 operation plan 后，可提交 `M0 — Architecture Baseline Verified` 的最终 Gate；在此之前 Phase 0 保持 `IN_PROGRESS`。
