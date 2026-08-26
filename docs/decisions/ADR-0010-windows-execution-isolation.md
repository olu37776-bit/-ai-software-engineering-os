# ADR-0010：Windows 执行隔离等级与降级规则

状态：`ACCEPTED`  
日期：`2026-08-26`

## Context

Framework 会运行模型建议产生的工具、构建、测试和 Workspace 操作。Windows 是首要本地平台，但“启动子进程”不等于安全沙箱；Job Object、AppContainer、Windows Sandbox/Hyper-V container 提供的保证也不同。

若 Contract 只写“sandbox=true”，Adapter 很容易把不具备文件/网络隔离的普通子进程错误上报为安全环境，或者在强隔离不可用时静默回退到 host execution。

## Decision

### 1. Canonical Isolation Levels

V1 保留并精确定义四个递增等级：

```text
PROCESS_RESTRICTED
OS_SANDBOXED
CONTAINER_ISOLATED
REMOTE_ISOLATED
```

`HOST_UNRESTRICTED` 不是有效 isolation level，不能满足任何声明隔离要求的 SideEffectTask。

等级表示最低可验证保证，不表示“实现名称”。Provider 必须通过 conformance probe 才能声明支持。

### 2. `PROCESS_RESTRICTED`

Windows canonical implementation 至少包括：

- 每个 task 使用独立 child process tree；
- 以 Windows Job Object 管理，并启用 kill-on-job-close；
- 显式 CPU、memory、process count、wall-clock、stdout/stderr 和 output size budget；
- 清理 environment，仅注入 allowlist value/handle；
- 显式 executable path + argv，禁止默认 `shell: true`；
- cwd 位于 task staging directory；
- stdin 默认关闭，standard handles 受控；
- Runtime shutdown/cancel 能终止完整 process tree；
- Workspace 通过 staged snapshot/diff adapter访问，不把整个 data root 暴露给命令；
- task result、exit、timeout、kill 和 resource usage形成 Evidence。

该等级是 lifecycle/resource containment，不是强安全边界。它不能声称阻止一个恶意进程访问当前 OS user 本来可访问的任意文件、registry 或 network。

仅允许：

- 已知、受信任、版本固定的低风险工具；
- 可回滚或 staged 的有限 Workspace 操作；
- Contract/Policy 明确接受其 residual risk 的任务。

### 3. `OS_SANDBOXED`

Windows canonical provider 使用 AppContainer/lowbox token 与显式 capability SID，或经独立 ADR证明具有等价/更强保证的 Windows OS sandbox。

最低保证：

- 默认无网络 capability；
- 默认不能访问 host Workspace、data root、secrets、用户 profile 和 registry；
- 输入通过 broker copy-in/content refs 提供；
- 输出写入 sandbox-owned staging area，由 broker schema/hash/Policy/Oracle 检查后再形成 change set；
- secret 只通过单次、scope-bound broker handle 使用，不进入 process environment/argv；
- capability、token、filesystem/network probe 与实际 OS build形成 `IsolationEvidence`；
- sandbox process不能直接调用 Local Control API；需要的结果通过受控 broker channel 返回；
- AppContainer feature/probe 不满足时任务 `BLOCKED`，不得回退为 `PROCESS_RESTRICTED`。

### 4. `CONTAINER_ISOLATED`

Provider 可使用：

- Windows Sandbox（包括经验证的 Protected Client 模式）；
- Hyper-V isolated Windows container；
- 经新 ADR批准的 OCI/VM provider。

仅“进程隔离 container”、安装了 Docker、进入 WSL2 或在另一个目录运行，都不能自动声明此等级。

最低保证：

- provider 报告实际 isolation technology 与版本；
- host Workspace 默认不 mount；必要输入 read-only/copy-in；
- network 默认关闭或经 allowlist proxy；
- 输出通过 content-addressed export/diff 回传；
- VM/container teardown 不承担业务 completion，结果仍需 Kernel commit；
- base image/template 有 provenance、patch 与 vulnerability policy；
- crash、timeout、cleanup 和残留 volume 可验证。

### 5. `REMOTE_ISOLATED`

该等级预留给受治理 remote executor。V1 不实现，也不能把普通远程 API 调用标记为该等级。

未来 provider 至少需要：

- mutual identity/attestation；
- encrypted transport；
- remote data/retention Policy；
- tenant/workload isolation Evidence；
- result provenance、reconciliation 和 availability semantics；
- 独立 ADR 与 threat review。

### 6. 等级协商

`SideEffectTask` 与 Adapter capability 使用：

```text
requiredIsolationLevel
availableIsolationLevels
selectedIsolationLevel
isolationProviderId/version
isolationEvidenceRef
residualRiskRefs
```

规则：

- Policy/Contract 决定 minimum；Adapter 只报告能力，不能降低要求；
- 可以使用更高等级替代更低等级，但必须满足 task 所需 capability；
- 不允许 silent downgrade；
- provider unavailable、probe failed、OS edition 不支持或 capability 缺失 -> `BLOCKED/UNAVAILABLE`；
- emergency override 也不能伪造 isolation level，只能形成显式 risk acceptance，并受 hard invariant 限制；
- selected level、provider 与 probe snapshot 写入 NodeExecutionRecord/Evidence。

### 7. 默认风险映射

| Task characteristic | 默认最低等级 |
|---|---|
| 受信任内置只读诊断、无 secret/外部写入 | `PROCESS_RESTRICTED` |
| staged Workspace 写入，工具版本固定且可回滚 | `PROCESS_RESTRICTED`，Policy 可提高 |
| 安装/执行不受信任依赖或模型生成代码 | `OS_SANDBOXED` |
| 访问高敏数据、未知二进制、强网络隔离要求 | `OS_SANDBOXED` 或 `CONTAINER_ISOLATED` |
| destructive/publish/external irreversible action | 强隔离不能替代 Human Approval；两者都必须满足 |

风险分类只是 minimum policy input，具体 Node Contract 可以要求更高等级。

### 8. Shell、Path、Network 与 Secret

- 默认只允许 executable + typed argv；
- `.cmd`、`.bat`、PowerShell、`cmd.exe`、脚本解释器需要独立 `shell_execute` capability；
- 禁止拼接模型提供的 raw command string；
- path 必须 canonicalize、resolve symlink/junction/reparse point，并验证在批准 root；
- network 默认 deny，开放时记录 destination/protocol/expiry；
- secret value 不进入 prompt、argv、普通 env、日志或可分享 Evidence；
- tool 子进程不得继承 Runtime token、GitHub credential、provider key 或用户完整环境。

## Phase Placement

- **Phase 1**：实现 `PROCESS_RESTRICTED`、capability probe、Job Object lifecycle 与 fail-closed contract；
- **Phase 3/4**：首条 slice 与真实工具 Adapter 消费 isolation Contract；
- **Phase 6**：实现/验证 `OS_SANDBOXED` provider、capability token、Human Approval 与完整安全场景；
- **后续**：按 Evidence 决定 `CONTAINER_ISOLATED/REMOTE_ISOLATED` provider。

因此 Phase 6 是强治理扩展，不是第一次出现隔离语义。

## Canonical Ownership

- IsolationLevel/Capability schema：`packages/contracts`；
- minimum selection：`packages/policy`；
- Windows provider implementation：`packages/adapters/tool/windows-*`；
- task lifecycle：node-runtime/platform dispatch；
- authority state：Kernel；
- isolation verification：security/adapter conformance suites。

Adapter 不得通过自报字符串取得更高 trust；能力必须由 probe 和 Evidence 支持。

## Consequences

- “进程受限”和“安全沙箱”不再混为一谈；
- Windows Phase 1 可以先交付可靠进程生命周期，同时对其安全边界保持诚实；
- 高风险任务在 AppContainer/container 不可用时会被阻塞，而不是方便地降级；
- staging/broker 增加实现成本，但保护 Workspace、secrets 和 Control API；
- 不强制所有用户安装 Docker/WSL；强隔离按 capability negotiation 使用。

## Rejected Alternatives

- **所有任务仅用普通 child process**：无法提供文件、网络和同用户资源隔离；
- **把 Job Object 称为完整 sandbox**：Job Object主要提供 process tree/resource lifecycle，不等于安全边界；
- **Node.js permission model 作为唯一隔离**：语言运行时限制不能替代 Windows OS boundary，且外部二进制不受其完整控制；
- **WSL2 自动等同 container isolation**：是否隔离取决于 mount、network、用户与 VM 配置，不能仅凭运行于 WSL 推断；
- **强制 Docker 作为 V1 依赖**：破坏轻量、本地和不同 Windows edition 可用性；
- **sandbox 不可用时自动 host fallback**：直接违反 fail-closed；
- **把 approval 当作 isolation**：人类批准不能创造技术隔离保证。

## Verification

至少包括：

1. Job Object kill-on-close、child/grandchild termination 和 resource limits；
2. timeout/cancel/crash 后无 orphan process；
3. environment/argv/token/secret inheritance denial；
4. path traversal、junction/reparse point、中文/空格/长路径 fuzz；
5. PROCESS_RESTRICTED 不能错误声明 network/filesystem denial；
6. AppContainer filesystem、registry、network、loopback 与 capability probes；
7. sandbox unavailable/OS edition mismatch 必须 BLOCKED；
8. no-downward-fallback property tests；
9. staged write unexpected path、base mismatch、diff rejection；
10. shell capability 与 raw command injection fixtures；
11. IsolationEvidence 与实际 provider/version 对齐。

## Revisit Triggers

- Windows AppContainer 无法运行首批必要工具；
- Microsoft 改变 Job Object/AppContainer/Windows Sandbox 保证；
- 真实 workload 需要 Hyper-V/OCI 默认 provider；
- 同用户攻击面或高敏 Workspace 需要更强 broker；
- Linux/macOS 成为正式 primary platform并需要等价等级映射；
- remote executor 成为批准的产品需求。
