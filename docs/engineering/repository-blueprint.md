# Repository Blueprint

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 目标目录

```text
/
├─ apps/
│  ├─ cli/
│  ├─ runtime/
│  └─ worker/
├─ packages/
│  ├─ contracts/
│  ├─ kernel/
│  ├─ workflow/
│  ├─ node-runtime/
│  ├─ context/
│  ├─ skills/
│  ├─ policy/
│  ├─ verification/
│  ├─ evidence/
│  ├─ learning/
│  ├─ persistence/
│  ├─ adapters/
│  ├─ observability/
│  └─ platform/
├─ tests/
│  ├─ architecture/
│  ├─ contract/
│  ├─ integration/
│  ├─ acceptance/
│  ├─ replay/
│  ├─ fault-injection/
│  ├─ security/
│  └─ fixtures/
├─ schemas/
│  └─ release/
├─ scripts/
├─ docs/
├─ .github/
│  ├─ workflows/
│  ├─ ISSUE_TEMPLATE/
│  └─ pull_request_template.md
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
└─ toolchain manifest
```

`packages/contracts/schemas/` 是运行 Contract 的权威位置；根 `schemas/release/` 只放安装器/Release 外部校验所需 schema。最终位置可在 Phase 1 ADR 中微调，但不得复制两份权威 schema。

## 2. Package Responsibilities

### `contracts`

无业务逻辑；保存 canonical identifiers、schema、generated types、validation utilities 和 envelopes。

### `kernel`

纯 transition、event append protocol、Unit of Work interface、idempotency 与 invariant。不依赖具体 persistence/adapter。

### `workflow`

WorkflowDefinition、Run aggregate、Router 和 dependency eligibility。

### `node-runtime`

NodeExecution/Attempt lifecycle、retry/cancel/timeout、NodeExecutionRecord assembler。

### `context`

ContextItem/Snapshot、compiler、budget、trust/redaction。

### `skills`

SkillManifest、registry、version selection；不绕过 Node/Policy。

### `policy`

permission、risk、approval、minimum verification 和 gate evaluator。

### `verification`

request/profile/plan/execution/oracle/assessment/gate orchestration。

### `evidence`

ArtifactRef、EvidenceMetadata、EvidenceEdge、integrity/query。

### `learning`

attribution、candidate、causal experiment、proposal、learning gate。

### `persistence`

journal、projection、inbox/outbox、migration、backup implementation。

### `adapters`

按子目录实现 model/tool/workspace/knowledge/secret/verification providers。Adapter 之间不能共享隐藏全局状态。

### `observability`

OTel mapping、structured logging、diagnostic instrumentation。

### `platform`

composition root、effective config、Runtime lifecycle、health、Control API application services。

## 3. Dependency DAG

允许的高层方向：

```text
contracts
  <- kernel
  <- workflow / node-runtime / context / skills / policy / evidence
  <- verification / learning
  <- platform application services
  <- adapters / apps

persistence implements ports required by kernel/evidence/platform
observability observes public hooks and does not own business state
```

具体 package allowlist 进入 machine-readable architecture config。

## 4. Public Entry Points

每个 package 仅通过：

```text
@aseos/<package>
```

导出 public API。禁止：

```text
@aseos/kernel/src/internal/...
../../other-package/src/...
```

内部目录不被其他 package 测试直接读取。架构断言通过 public behavior、metadata 或 dedicated inspection API 验证，而不是 `readFileSync` 某旧文件并判断 switch 是否存在。

## 5. Initial Tooling Candidates

候选基线，需 Phase 1 ADR/Spike 确认：

- pnpm workspaces；
- TypeScript project references；
- Vitest；
- fast-check property/model tests；
- StrykerJS mutation testing；
- ESLint flat config + Prettier；
- dependency-cruiser 或等价 architecture check；
- Changesets 或等价 package/release versioning；
- JSON Schema 2020-12 validator/generator；
- OpenTelemetry SDK；
- GitHub artifact attestation/SBOM tooling。

选择标准是维护性、Windows 支持、确定性、供应链风险和 Contract 兼容，不按流行度决定。

## 6. Test Placement

- package 内测试验证内部纯逻辑；
- `tests/contract` 验证 producer/consumer 与 Adapter conformance；
- `tests/architecture` 验证 dependency 和 semantic owner；
- `tests/replay` 保存 versioned event histories；
- `tests/fault-injection` 验证 crash/duplicate/timeout；
- `tests/acceptance` 只使用 public CLI/API；
- fixture 不依赖用户本地私有数据。

## 7. Build Outputs

```text
artifacts/
├─ packages/
├─ test-results/
├─ coverage/
├─ mutation/
├─ sbom/
├─ provenance/
└─ release/
```

这些是构建产物，不提交仓库。Verification summary 引用 artifact hash。

## 8. Phase 1 最小落盘顺序

1. root workspace/toolchain；
2. contracts + schema validation；
3. kernel skeleton with pure reducer example；
4. persistence spike behind Port；
5. runtime/cli/worker lifecycle；
6. architecture test；
7. first release artifact；
8. first vertical slice definitions。

禁止先批量创建空 package/空 interface 来制造进度。每个新增 package 必须在同一阶段拥有一个真实 Contract 和至少一个 consumer/conformance test。
