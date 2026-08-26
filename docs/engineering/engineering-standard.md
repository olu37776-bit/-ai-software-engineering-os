# 工程实现标准

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 总则

工程标准的目标不是统一代码风格，而是确保架构不变量在实现中可被编译器、测试和自动门禁检查。

## 2. 初始技术方向

V1 采用单语言 TypeScript 模块化单体与隔离 Worker。具体版本在工具链 ADR 中锁定，原则为：

- Node.js Active LTS；
- TypeScript `strict`；
- workspace monorepo；
- lockfile 和可复现安装；
- ESM/CJS 策略全仓统一；
- 构建与测试在 Windows 和 Linux 验证；
- 用户 Release 自包含运行时，不依赖本地开发环境。

必须启用或等效保证：

```text
strict
noUncheckedIndexedAccess
exactOptionalPropertyTypes
noImplicitOverride
useUnknownInCatchVariables
noFallthroughCasesInSwitch
```

不得用大面积 `any`、类型断言或 `@ts-ignore` 绕开 Contract。

## 3. Functional Core / Imperative Shell

- reducer、policy evaluator、router eligibility、oracle 等决策逻辑必须纯函数化；
- 网络、文件、数据库、时钟、随机数、模型、工具全部位于 imperative shell/Adapter；
- Core 只接收已经显式捕获的值；
- 副作用结果通过 Command 返回并提交 Event；
- 不允许 constructor/import 时执行 I/O。

## 4. 依赖注入

- 仅 composition root 创建具体 Adapter；
- 禁止隐式全局 registry 和可变 singleton；
- domain/application service 通过显式 constructor/function arguments 获得 Port；
- 测试使用符合相同 Contract 的 fake，而不是绕开 Kernel；
- cache 作为 decorator 注入，不能成为唯一数据源。

## 5. Package 边界

每个 package 必须：

- 有唯一公开入口；
- 声明允许依赖的 package；
- 不允许 deep import；
- 不循环依赖；
- 不导出内部数据库实体作为公共 Contract；
- 具有 contract/architecture tests；
- 对关键语义声明 canonical owner。

建议用 dependency graph/architecture rules 自动阻止：

```text
kernel -> adapters
workflow -> concrete persistence
adapter -> internal reducer
ui/cli -> database
learning -> direct runtime mutation
```

## 6. Schema-first Boundary

跨 package、进程、持久化和 API 的 payload：

- 以 JSON Schema 2020-12 或已批准等价 schema 为权威；
- 包含 `schemaVersion`；
- runtime boundary 进行实际验证；
- TypeScript type 从 schema 生成或与 schema 一致性测试；
- 不接受仅靠编译期类型的外部数据；
- unknown fields、default、null/optional 语义明确；
- breaking change 有 migration/upcaster 与 compatibility test。

## 7. Identity、时间与哈希

- identity 在边界一次生成并显式传递；
- 业务核心不直接调用随机 API；
- 时间统一 UTC/RFC 3339，Core 使用 injected clock value；
- 内容完整性使用 SHA-256；
- idempotency key 的构造规则必须稳定且测试；
- 不使用文件路径、显示名称或数组下标作为持久 identity。

## 8. Error Model

错误必须结构化：

```text
code
category
message
retryability
subjectRef
causationId
details (redacted)
```

规则：

- catch 的值视为 `unknown`；
- 不吞异常；
- 不用字符串匹配作为主要分支条件；
- domain rejection 与 infrastructure failure 分开；
- 用户可操作错误提供 remediation hint；
- secret、token 和敏感路径在错误中脱敏；
- invariant violation 进入 fail-fast/quarantine，不伪装普通失败。

## 9. Persistence

- 所有权威写入经 Unit of Work/transaction；
- event version 采用唯一约束；
- outbox/inbox 与状态提交保持原子；
- migration 有 forward、preflight、backup 和 rollback/restore 策略；
- migration 不允许在启动时无提示执行不可逆数据破坏；
- projection 可重建；
- integrity check 与 backup restore 有自动测试；
- SQL/driver 细节不得泄露到 Domain。

## 10. Concurrency 与异步

- 所有可重复消息有幂等 identity；
- Promise rejection 必须被观察；
- 后台任务必须属于 Runtime lifecycle，支持 shutdown/drain；
- lease/heartbeat 使用持久时间与 owner identity；
- 不通过进程内 mutex 声称跨进程一致性；
- 无界并发、无界队列和无限 retry 禁止；
- backpressure 和 resource budget 显式。

## 11. Logging 与 Evidence

- structured logging；
- correlation fields 统一；
- debug log 不承担业务事实；
- 关键执行产物写 Evidence/Artifact Store；
- log message 不作为 API/测试 Contract；
- 默认脱敏；
- 高频路径控制 cardinality；
- telemetry export 失败不改变业务状态，但必须可诊断。

## 12. 测试要求

关键 Core：

- unit tests；
- property-based tests；
- model/state-machine tests；
- deterministic replay tests；
- idempotency/concurrency tests；
- mutation tests；
- schema compatibility tests。

Adapter：

- contract conformance tests；
- timeout/cancellation/failure tests；
- real integration smoke test；
- result/Evidence completeness；
- capability mismatch tests。

Persistence/Runtime：

- crash at transaction boundaries；
- duplicate delivery；
- expired lease；
- corrupted artifact/journal；
- migration and restore；
- clean/forced shutdown；
- Windows path/file-lock behavior。

## 13. 性能

- 先定义 SLO/预算再优化；
- benchmark 固定数据集、环境和版本；
- 不用 cache 修复正确性问题；
- cache key、freshness 和 invalidation 可测试；
- 大 Artifact 使用 streaming/content store，避免把全部内容放入事件行；
- 对 Context、EvidenceGraph 和 event replay 建立规模测试。

## 14. 依赖与供应链

- 新依赖必须说明目的、维护状态、许可证、替代方案和攻击面；
- 禁止为一行功能引入高权限/高依赖包；
- 锁定依赖和 GitHub Action；
- 自动生成 SBOM；
- 扫描已知漏洞但不把 scanner 无告警等同于安全；
- Release 包只包含运行必需文件；
- build provenance 和 checksum 与制品一起发布。

## 15. 禁止模式

- 多个 switch/reducer 分别拥有同一 transition；
- import side effect 初始化系统；
- mutable global state；
- catch 后返回成功；
- 通过删除旧文件但保留依赖其存在的测试；
- mock 掉被测核心路径；
- 用 snapshot/golden 替代关键语义断言；
- 任意 shell/文件/网络默认权限；
- 模型输出直接落库为权威状态；
- schema-less JSON 持久化；
- 以 coverage 数字作为唯一质量门禁。
