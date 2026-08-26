# Repository Blueprint

状态：`BASELINE DRAFT v0.2`  
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
├─ toolchain/
│  └─ toolchain.json
├─ scripts/
├─ docs/
├─ .github/
│  ├─ workflows/
│  ├─ ISSUE_TEMPLATE/
│  └─ pull_request_template.md
├─ package.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
└─ tsconfig.base.json
```

`packages/contracts/schemas/` 是运行 Contract 的权威位置；根 `schemas/release/` 只放安装器/Release 外部校验所需 schema。不得复制两份权威 schema。

工具链版本的 canonical sources 是 `toolchain/toolchain.json` 和 `pnpm-lock.yaml`；ReleaseManifest 必须记录实际构建版本。其他文档只引用，不维护平行版本清单。

## 2. Package Responsibilities

### `contracts`

无业务逻辑；保存 canonical identifiers、JSON Schema、generated types、validation utilities 和 envelopes。

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

PolicySet compiler/canonicalization、built-in hard invariants、permission/risk/minimum verification/isolation/approval requirements 和唯一 V1 authority evaluator。`PolicyEnginePort` 仅作为 application/conformance seam，不允许第三方实现通过配置成为 authority。

### `verification`

request/profile/plan/execution/oracle/assessment/gate orchestration。

### `evidence`

ArtifactRef、EvidenceMetadata、EvidenceEdge、integrity/query。

### `learning`

attribution、candidate、causal experiment、proposal、learning gate。

### `persistence`

journal、projection、inbox/outbox、migration、backup、SQLite UnitOfWork 与内部 PersistenceWorker。SQL/driver type 不得泄露到 Domain/public Contract。

### `adapters`

按子目录实现 model/tool/workspace/knowledge/secret/verification/isolation providers。Adapter 之间不能共享隐藏全局状态，也不能拥有 Core transition、PolicyDecision 或 GateDecision 语义。

### `observability`

OTel mapping、structured logging、diagnostic instrumentation。Telemetry 不是 authoritative fact source。

### `platform`

composition root、EffectiveConfig、Runtime lifecycle、authenticated Local Control API、health/doctor、endpoint/token lifecycle 与 application services。

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

硬约束：

- `apps/cli` 和未来 UI 只依赖 Control API client/public Contract，不直接 import Kernel 或 persistence；
- `packages/policy` 不依赖 Adapter；
- `packages/persistence` 不生成业务 transition；
- Adapter 不引用 package internal path；
- PersistenceWorker 与 SideEffect Worker 是不同角色；
- architecture test 必须识别依赖反转、deep import、循环和重复 semantic owner。

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

## 5. Accepted Phase 1 Tooling Baseline

权威版本与模块规则见 [ADR-0007](../decisions/ADR-0007-typescript-toolchain-baseline.md)：

```text
Node.js:    24.19.0
TypeScript: 6.0.3
pnpm:       11.24.0
Module:     ESM-only / NodeNext
Build:      tsc -b project references
```

Phase 1 必须在 lockfile 中精确固定并验证：

- ESLint flat config + 与 TypeScript 6 正式兼容的 `typescript-eslint`；
- Prettier；
- Vitest；
- fast-check property/model tests；
- StrykerJS mutation testing；
- dependency-cruiser 或经验证等价 architecture check；
- Ajv 或经验证等价 JSON Schema 2020-12 validator；
- OpenTelemetry SDK；
- GitHub artifact attestation/SBOM tooling。

Supporting tool 的具体 patch 版本由 `pnpm-lock.yaml` 和 `toolchain/toolchain.json` 记录。新增工具选择标准是维护性、Windows 支持、确定性、供应链风险和 Contract 兼容；不能改变 ADR 已冻结的 authority、module 或 build 语义。

安装使用 frozen lockfile。dependency lifecycle/build script 默认不执行，只能由显式 allowlist 开放；clean build 不依赖全局 package、Python、C/C++ compiler 或管理员权限。

## 6. Test Placement

- package 内测试验证内部纯逻辑；
- `tests/contract` 验证 producer/consumer 与 Adapter conformance；
- `tests/architecture` 验证 dependency 和 semantic owner；
- `tests/replay` 保存 versioned event histories；
- `tests/fault-injection` 验证 crash/duplicate/timeout；
- `tests/acceptance` 只使用 public CLI/API；
- `tests/security` 覆盖 Control API、Policy、isolation、secret 与 supply-chain scenarios；
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

1. exact root workspace、toolchain manifest、lockfile 与 ESM build；
2. `contracts` + Schema validation/generation + first valid/invalid examples；
3. architecture rules 与一个真实 public package dependency；
4. PolicySet compiler/canonicalization/evaluator skeleton；
5. Runtime lifecycle + authenticated loopback Control API + CLI client；
6. `PROCESS_RESTRICTED` Job Object/process-tree lifecycle 与 capability probe；
7. SQLite/`node:sqlite` PersistenceWorker qualification behind Port；
8. minimal Kernel reducer/UnitOfWork contract example；
9. GitHub Actions、SBOM/provenance 和 Windows self-contained package smoke；
10. first vertical slice executable definitions/examples preparation。

每一步必须在同一 change 中包含真实 Contract、consumer、验证资产和 Evidence 回执。禁止先批量创建空 package/空 interface 制造进度，也禁止以 temporary hard-coded allow、unrestricted host execution、CLI 直连 internal 或 alternate persistence driver 绕过已接受 ADR。
