# ADR-0008：SQLite 权威存储与 `node:sqlite` 驱动

状态：`ACCEPTED`  
日期：`2026-08-26`

## Context

Framework 需要在单机 Windows 环境中原子提交 Event、Command 幂等结果、outbox/inbox、audit 和必要 projection checkpoint，同时支持崩溃恢复、备份、迁移和离线运行。

独立数据库服务会提高部署和恢复成本；文件化 JSON/日志缺少成熟 transaction、constraint 和 migration 能力。SQLite 与目标拓扑匹配，但 Node.js 驱动选择会直接影响 Windows 自包含发布和 authority path 风险。

Node.js `24.19.0` 自带 SQLite `3.53.3`；`node:sqlite` 处于 Stability `1.2`（Release Candidate），提供 synchronous API、defensive mode、authorizer、limits 和 backup。第三方 `better-sqlite3` 当前 v13 在 Windows clean install 存在 node-gyp/Python 回归；`node-sqlite3` 已被其仓库标记为 unmaintained。

## Decision

### 1. Engine 与 Driver

V1 权威关系存储采用：

```text
Engine: SQLite 3.53.3（由 Node.js 24.19.0 固定提供）
Driver: node:sqlite
Database: <data-root>/state/aseos.db
```

不把 driver type 暴露给 Domain、Kernel、Workflow 或 public Contract。`packages/persistence` 通过内部 adapter 实现 UnitOfWork、Journal、Inbox、Outbox、Projection 和 Migration ports。

`node:sqlite` 当前 RC 风险通过以下约束隔离：

- 精确固定 Node.js runtime；
- driver 仅存在于 persistence internal；
- 持久化 Contract/conformance suite 不依赖 driver API；
- Phase 1 必须先通过 qualification spike，失败时创建 superseding ADR，不允许静默换 driver；
- Event/schema 设计不得依赖只能由该 driver 表达的业务语义。

### 2. Persistence Worker

所有 SQLite 调用由可信的专用 `PersistenceWorker` worker thread 执行：

- 它是 Runtime 内部 persistence 实现，不是执行外部副作用的 `SideEffect Worker`；
- 它不能运行模型、工具、任意命令，也不能决定状态转换；
- Kernel 在主控制路径完成纯决策后，提交一个结构化 `JournalAppendBatch`；
- worker 内部以有界队列串行所有 authoritative write；
- 一次写入使用单个 SQLite transaction；
- worker crash 被 Runtime 视为 storage failure，未收到 committed receipt 的调用必须通过 command identity 查询，不得猜测成功；
- shutdown 必须 drain 或明确中断，不能遗留未观察 Promise。

同步数据库 API 不在 Runtime 主 event loop 上执行。

### 3. 单一权威数据库

以下数据位于同一数据库，以保证 transaction boundary：

- append-only Domain Event journal；
- processed Command/idempotency result；
- SideEffect outbox；
- Worker result inbox/dedup；
- scheduler lease 与 durable deadline；
- audit facts；
- Policy/Config snapshot metadata；
- migration history；
- 必要 projection 与 projection checkpoint。

大模型响应、diff、日志报告和二进制产物不进入 Event row；它们存入文件系统 content-addressed Artifact Store，数据库只保存 hash、metadata、sensitivity、size 和引用。

禁止为每个 bounded context 创建无法原子协调的独立 SQLite 文件。未来拆分必须由新 ADR 证明 transaction 与恢复语义。

### 4. Transaction Contract

每个 authority mutation 在一个 `BEGIN IMMEDIATE` transaction 内完成：

1. 验证 aggregate expected version；
2. 验证 `commandId/idempotencyKey`；
3. 追加一个或多个 Domain Event；
4. 保存 Command receipt/result；
5. 追加对应 outbox task；
6. 更新必要 projection/checkpoint；
7. 追加要求与状态变化同事务持久化的 audit fact；
8. commit 并返回持久化 receipt。

唯一约束至少覆盖：

```text
(event_id)
(aggregate_type, aggregate_id, aggregate_version)
(command_id)
(outbox_task_id)
(inbox_result_id)
(idempotency_key, effect_scope)
```

并发冲突必须形成 typed conflict，禁止 last-write-wins。

### 5. SQLite 安全与耐久配置

每次连接显式验证而不是假设默认值：

```text
journal_mode = WAL
synchronous = FULL
foreign_keys = ON
trusted_schema = OFF
busy_timeout = bounded non-zero value
```

同时：

- `defensive = true`；
- `allowExtension = false` 且运行期不可重新启用；
- double-quoted string literals 禁用；
- 设定 SQL、BLOB、column、expression depth、attached database 等 limits；
- 使用 prepared statements，不拼接外部值；
- schema 使用 `STRICT` tables；
- 普通 Runtime authorizer 拒绝 `ATTACH`、extension、任意 schema mutation 和非迁移 DDL；
- migration/doctor/backup 使用独立、显式授权的管理路径；
- Event journal table 不提供 update/delete repository method，并以 trigger/authorizer/测试保护 append-only 约束；
- WAL checkpoint、磁盘空间和长事务可诊断并受 budget 控制。

### 6. Migration、Backup 与 Recovery

- migration 是有序、带 checksum 的版本资产；
- migration 前执行版本、完整性、磁盘空间和兼容性 preflight；
- 不可逆 migration 前必须创建可验证 backup；
- 启动时不得无提示执行 destructive migration；
- backup 使用 SQLite online backup 能力并记录 manifest/hash；
- startup 运行 lightweight `quick_check`、schema/version 与未完成 migration 检查；
- `doctor`、Release Gate 和 restore drill 运行完整 integrity 验证；
- projection 可从 journal 重建，并通过 equivalence test；
- crash 后依据 journal/outbox/inbox/lease 恢复，不依赖 cache；
- database corruption 进入 quarantine，禁止用空库覆盖或自动“修复成功”。

本 ADR不决定最终 cryptographic tamper-evident chain 深度；在 production-grade Release 前仍需独立安全决策。现阶段 Event/Artifact 必须保存 SHA-256 与 provenance，但不得把 hash 等同于完整防篡改方案。

### 7. Integer、Time 与 Payload

- aggregate version、attempt、sequence 等整数使用 SQLite INTEGER，并在 TypeScript 边界以 safe integer/BigInt 规则验证；
- 时间持久化为 RFC 3339 UTC text，排序所需值可同时保存受控 integer epoch；
- Event payload 使用经过 Schema 验证的 canonical JSON bytes/text，并保存 `schemaVersion` 与 `payloadHash`；
- null/optional/default 由 Schema 决定，不依赖 SQLite 隐式 coercion；
- identity 使用稳定 string，不使用 rowid 作为 public identity。

## Canonical Ownership

- authority transaction：`packages/persistence` 的 UnitOfWork implementation；
- state transition：仍唯一属于 Kernel reducer；
- persisted Contract：`packages/contracts/schemas/`；
- SQL schema/migration：`packages/persistence/migrations/`；
- Artifact bytes：Artifact Store；
- DB health/backup：platform operations service。

Persistence Worker 只提交已由 Kernel 决定的 batch，不能自行生成业务 Event 或终态。

## Consequences

- 单文件数据库满足本地部署、事务、备份和恢复目标；
- Event + outbox/inbox 可以原子持久化；
- 内置驱动消除用户端 native addon、Python/C++ toolchain 和 ABI 安装风险；
- synchronous API 通过专用 worker thread 隔离，不阻塞 Control API event loop；
- `node:sqlite` RC 是显式风险，必须通过固定 runtime 和 qualification gate 管理；
- 单写者模型符合 V1 规模，但需要 queue/backpressure 和 replay benchmark。

## Rejected Alternatives

- **`better-sqlite3` 作为 V1 authority driver**：成熟度较高，但当前 Windows v13 clean-install 回归与 native addon 打包增加首个自包含 Release 风险；
- **`node-sqlite3`**：项目已标记 unmaintained，不进入 authority path；
- **PostgreSQL/独立数据库服务**：与单机离线部署和零运维目标不匹配；
- **纯 append-only JSON 文件**：transaction、constraint、concurrency、migration 和 query 能力不足；
- **多个数据库文件**：破坏 Event/outbox/inbox/audit 原子边界；
- **直接在主 event loop 调用同步 SQLite**：会让 API、scheduler 和 recovery 被长查询阻塞；
- **自动 fallback 到另一 driver**：同一 Release 内产生不受治理的双持久化语义。

## Verification

Phase 1 qualification 与后续 Gate 至少包括：

1. clean Windows/Linux 无编译工具链安装与打包；
2. Event + outbox 原子 crash-before/after-commit fault tests；
3. duplicate Command/Worker result 与 optimistic concurrency；
4. process kill、worker terminate、磁盘满、database locked、WAL 恢复；
5. projection rebuild equivalence；
6. migration failure、backup/restore、corruption quarantine；
7. extension/ATTACH/schema mutation/SQL injection denial；
8. 10,000 Event replay 与 100,000 Event recovery NFR benchmark；
9. Runtime 主 event loop responsiveness；
10. Release manifest 中 Node/SQLite version 与实际运行一致。

## Revisit Triggers

- `node:sqlite` 无法通过 Phase 1 qualification；
- Node.js 将其 API 改为不兼容形式；
- 内置 API达到稳定级别，可减少本 ADR 的 RC 约束；
- V1 单写者吞吐或恢复预算有真实 Evidence 不达标；
- 多进程/多机 authority storage 成为已批准需求；
- production threat review 要求更强的加密、防篡改或 key management。
