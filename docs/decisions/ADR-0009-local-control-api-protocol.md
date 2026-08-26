# ADR-0009：本地 Control API 协议

状态：`ACCEPTED`  
日期：`2026-08-26`

## Context

CLI、未来 UI、launcher 和诊断工具需要控制同一个本地 Runtime。它们不能直接访问数据库，也不能各自复制 Workflow、Policy、状态转换或恢复语义。

本地 API 同时面对恶意/误配置本机进程、CSRF/浏览器来源、重复请求、Runtime 重启、端口冲突和长运行操作。协议必须跨 Windows/Linux、可通过公开 Contract 验证，并与未来 UI 兼容。

## Decision

### 1. Transport

V1 Local Control API 使用：

```text
HTTP/1.1 + JSON
bind: 127.0.0.1
port: OS-assigned ephemeral port
base path: /v1
```

规则：

- 只绑定 IPv4 loopback `127.0.0.1`；
- 禁止绑定 `localhost`、`0.0.0.0`、LAN interface 或 public interface；
- IPv6 `::1` 默认不启用，待独立 exposure test 后由 ADR/Contract 增加；
- 不提供配置项把本地 API 直接变为远程 API；
- V1 不在 loopback 上启用 TLS，身份与授权依赖本地 token、文件 ACL 和 capability Policy；
- 任何 remote transport、mTLS 或组织级访问必须使用新 ADR，不能复用开关打开。

HTTP API Contract 使用 OpenAPI `3.1.1` 与 JSON Schema 2020-12。OpenAPI 3.2.0 虽已发布，但 V1 选择工具支持更成熟的 3.1.1；升级需通过 contract generator/validator compatibility Gate。

### 2. Runtime Discovery 与单实例

Runtime 每次成功监听后原子写入：

```text
<data-root>/state/runtime/control-endpoint.json
```

`ControlEndpointDescriptor` 至少包含：

```text
schemaVersion
instanceId
pid
startedAt
host = 127.0.0.1
port
apiVersions
frameworkVersion
releaseId
tokenFileRef
```

Descriptor 不包含 token value。Runtime 同时持有 instance lock；CLI 必须验证 PID、instanceId、API version 和 authenticated health，不能仅因文件存在就判定 Runtime 可用。

异常退出留下的 descriptor 被视为 stale finding，由 launcher/doctor 安全清理；不能连接到 descriptor 中与 identity 不匹配的其他进程。

### 3. Authentication

Runtime 每次启动生成至少 256-bit cryptographically secure random bearer token：

```text
<data-root>/secrets/runtime/control-api.token
```

要求：

- token file 以当前 OS user-only ACL 创建；
- token 只通过 `Authorization: Bearer <token>` header 传输；
- 禁止放入 URL、query、command-line argument、日志、Error、Evidence 明文或 descriptor；
- Runtime 重启轮换 token；
- token comparison 使用 constant-time strategy；
- 所有 API endpoint，包括 health/status，均要求 authentication；
- 连续失败触发有界 rate limit 和 security audit finding；
- token file/ACL 无法安全创建时 Runtime 不进入 ready。

该机制不声称抵御已经控制同一 OS user 的恶意进程；这是明确 residual risk。未来需要更强同用户隔离时评估 Windows named pipe/identity binding。

### 4. Request Contract

每个请求：

- 使用 versioned path 与 runtime JSON Schema validation；
- 默认拒绝 unknown fields、unsupported content type 和 unsupported schemaVersion；
- 携带或由服务生成 `requestId`、`correlationId`；
- mutating request 必须携带 `Idempotency-Key`；
- 状态敏感 mutation 必须携带 `expectedVersion` 或受 Contract 约束的 `If-Match`；
- 具备 body、header、URL、并发、执行时间和 response size 上限；
- 不接受任意 SQL、文件路径、shell string、module path 或内部 class name；
- 不提供 generic database、event append 或“执行任意 Command payload” endpoint；
- API handler 只调用 versioned application service，后者向 Kernel 提交受验证 Command。

重复 `Idempotency-Key` 返回原 operation/result identity；相同 key 配合不同 payload hash 必须冲突拒绝。

### 5. Resource 与异步操作模型

- 快速只读查询使用 `GET`；
- 创建受治理操作使用 `POST`，通常返回 `202 Accepted` + `ControlOperationRef`；
- 可安全替换的声明式资源才使用 `PUT`；
- cancel、approval、retry 等均是明确 action Contract，不伪装为数据库字段更新；
- operation state 来自 committed Event/projection，HTTP connection 断开不取消 durable operation；
- client 可通过 operation resource 查询最终 result、Evidence refs 和 typed failure。

HTTP method 的语义不替代 Framework idempotency：所有可能重复的非幂等 action仍要求 Framework-level idempotency identity。

### 6. Error Model

HTTP error 使用 RFC 9457 `application/problem+json`，扩展字段至少包括：

```text
code
category
retryability
requestId
correlationId
subjectRef
remediation
```

- `type` 是稳定 problem type identity；
- `detail` 只用于人类说明，client 不以字符串匹配分支；
- domain rejection、policy denial、conflict、unavailable、invariant violation 分开映射；
- error response 默认脱敏，不泄露 token、secret、内部 SQL、绝对敏感路径或 stack；
- HTTP 2xx 不代表 Node/Workflow verified，最终状态必须读取 committed facts/GateDecision。

### 7. Streaming

V1 只提供 read-only Server-Sent Events：

```text
GET /v1/events
Content-Type: text/event-stream
```

用途是运行状态、operation 和 Evidence metadata 通知；它不是 authoritative journal export。

- 每条通知有可排序 `notificationId`、subjectRef 和 projection version；
- 支持 `Last-Event-ID` 恢复；
- 发现 gap 或 retention boundary 时 client 必须重新查询 resource；
- SSE 有连接数、buffer、heartbeat 和 backpressure 上限；
- V1 不使用 WebSocket、双向 streaming 或把 Command 放入 event stream。

### 8. Browser/UI Security

- 不使用 cookie/session auth；
- 默认不返回 CORS allow headers；
- `Origin` 存在时必须匹配经 Release 注册的 packaged UI origin，否则拒绝；
- 验证 `Host` 仅为实际 loopback endpoint；
- 禁止 JSONP、form-compatible mutation 和 GET side effect；
- UI 不能把 bearer token暴露给页面内容、插件或远程 origin；
- 所有高风险 action 仍受 Policy/Human Approval，不因请求来自本地 UI 自动信任。

## Canonical Ownership

- OpenAPI/JSON Schema：`packages/contracts/schemas/control-api/`；
- HTTP server 与 application service mapping：`packages/platform`；
- authority transition：Kernel；
- CLI/UI：Control API client，仅消费 public Contract；
- endpoint/token lifecycle：platform runtime lifecycle；
- authentication/permission decision：platform authentication + Policy。

CLI、UI 和 launcher 禁止直接 import Kernel internal 或数据库 repository。

## Consequences

- CLI 与 UI 使用同一可验证入口，避免复制业务语义；
- loopback HTTP 简化跨平台、测试和未来 UI 集成；
- ephemeral port 避免固定端口冲突，descriptor 提供受控 discovery；
- token + ACL 对其他普通本地 user/process 提供基础保护，但不是同用户强隔离；
- 202 + operation resource 与 durable execution 对齐；
- SSE 足以覆盖 V1 单向状态更新，避免过早引入双向协议。

## Rejected Alternatives

- **CLI 直接调用内部 package**：形成与 UI/API 不同的隐藏控制路径；
- **CLI/UI 直接访问 SQLite**：绕过 Kernel、Policy、audit 和 versioning；
- **固定端口**：易冲突、易被抢占并增加错误连接风险；
- **绑定 localhost/所有网卡**：DNS/IPv6/网络暴露语义不明确；
- **无认证 loopback API**：本机恶意进程可滥用；
- **token 放 URL 或 descriptor**：泄露到历史、日志和进程观察面；
- **Windows named pipe 作为唯一 V1 transport**：浏览器/UI、Linux reference 和测试工具兼容成本较高；
- **gRPC/WebSocket 作为基础协议**：V1 不需要其复杂性；
- **OpenAPI 3.2.0 立即采用**：暂不把较新的工具兼容面放入首个 Contract pipeline；
- **把 HTTP 200 等同业务成功**：破坏 durable operation 和 Gate 语义。

## Verification

Phase 1 Gate 至少包括：

1. 只能监听 `127.0.0.1`，外部/LAN/IPv6 exposure tests 失败关闭；
2. port hijack、stale descriptor、PID/instance mismatch；
3. token ACL、轮换、redaction、无认证/错误认证/rate limit；
4. unknown field、oversized body、malformed JSON、unsupported version；
5. duplicate idempotency key、payload mismatch、expected-version conflict；
6. Runtime restart 后 durable operation 可继续查询；
7. RFC 9457 schema、stable code 和脱敏；
8. CORS/Origin/Host/GET side-effect/CSRF scenarios；
9. SSE reconnect、gap、backpressure 和 disconnect 不改变业务状态；
10. CLI acceptance 仅通过 public API，不直接读库。

## Revisit Triggers

- packaged UI 的浏览器安全模型需要不同 transport；
- 同一 OS user 内恶意进程成为必须防御的正式边界；
- OpenAPI 3.2 工具链通过完整 compatibility Gate；
- 需要远程、多用户或组织级控制；
- HTTP/1.1/SSE 无法满足有 Evidence 的性能或流式需求；
- Windows named pipe 能在不破坏跨平台 Contract 的情况下提供更强 identity binding。
