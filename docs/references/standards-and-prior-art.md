# Standards and Prior Art

状态：`REFERENCE v0.1`  
核对日期：`2026-08-26`

这些资料用于校验设计原则，不表示 Framework 必须引入对应产品或复制其架构。

## 1. Durable Execution / Replay

### Temporal Documentation

- Workflow/Event History/Replay：`https://docs.temporal.io/workflow-execution`
- Deterministic history replay：`https://docs.temporal.io/encyclopedia/event-history/event-history-typescript`

采用的原则：

- 通过持久 Event History 恢复执行；
- Workflow 决策与外部非确定性操作分离；
- replay 要求确定性 command sequence；
- retry 必须针对可恢复外部失败，而非盲目重复确定性错误。

不直接采用的假设：V1 不要求部署 Temporal Server；本地 Runtime 使用适合单机的耐久 Kernel。

## 2. Observability

### OpenTelemetry Specification

- 总规范：`https://opentelemetry.io/docs/specs/otel/`
- Context：`https://opentelemetry.io/docs/specs/otel/context/`
- Logs：`https://opentelemetry.io/docs/specs/otel/logs/`

采用的原则：

- traces、metrics、logs 使用统一 Context/correlation；
- execution-scoped context 跨进程传播；
- telemetry signal 可关联。

限制：OpenTelemetry 数据不是 authoritative event journal，不能替代 NodeExecutionRecord 和 Evidence transaction。

## 3. Contract Schema

### JSON Schema

- 当前正式规范：`https://json-schema.org/specification`
- Draft 2020-12：`https://json-schema.org/draft/2020-12`

采用的原则：

- 跨语言/进程/持久化 payload 使用可机器验证 schema；
- dialect 与 schemaVersion 显式；
- validation 与 compatibility test 位于真实边界。

## 4. Supply-chain Security

### SLSA 1.2

- 规范：`https://slsa.dev/spec/v1.2/`
- Build provenance：`https://slsa.dev/spec/v1.2/build-provenance`

采用的原则：

- trust systems, verify artifacts；
- build provenance 描述制品如何、何时、从何处生成；
- local installer 验证制品与 provenance/checksum；
- 分阶段提高 build/source assurance。

### NIST SSDF

- SSDF 项目：`https://csrc.nist.gov/projects/ssdf`
- SP 800-218 v1.1（当前 final）；
- SP 800-218 Rev.1 / SSDF v1.2（截至核对日仍为 draft）；
- SP 800-218A（AI model development profile）。

采用的原则：

- 安全实践进入整个 SDLC；
- 准备组织、保护软件、生产安全软件、响应漏洞；
- AI 相关资产和模型供应链纳入工程治理。

## 5. Identity and Time

- RFC 9562 UUIDs（含 UUIDv7）：`https://www.rfc-editor.org/rfc/rfc9562`
- RFC 3339 date/time：`https://www.rfc-editor.org/rfc/rfc3339`

采用的原则：

- 持久 identity 与显示名称分离；
- 时间统一 UTC 表达；
- Core 使用显式 clock value 以支持 replay/testing。

## 6. Architecture Principles

本项目综合使用但不机械套用：

- functional core / imperative shell；
- ports and adapters / hexagonal architecture；
- domain-driven bounded contexts；
- event journal + materialized projections；
- transactional outbox/inbox；
- optimistic concurrency；
- capability-based security；
- policy as code；
- content-addressed artifacts；
- property/model-based testing；
- mutation testing；
- fault injection and recovery drills。

每项原则必须通过本地运行约束、复杂度与验证收益评估。禁止只因术语先进而引入分布式基础设施或额外语言。
