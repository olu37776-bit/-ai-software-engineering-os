# 非功能需求（NFR）

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 目的

NFR 为架构和 Release 提供可测量约束。初始数值是工程预算，必须在 Phase 1/2 benchmark 后通过 ADR 调整，不能暗中放宽。

## 2. Correctness

- 已确认提交的 Domain Event 不丢失；
- aggregate state 可由受支持 Event 完整重建；
- 同一 expected version 只能有一个并发 transition 成功；
- 重复 Command/Result 不产生重复权威效果；
- terminal state 不可被普通 Command 重新打开；
- model/tool/telemetry/cache 不可直接写 authority state；
- schema 无效数据不得进入 journal/public boundary。

## 3. Reliability

- Runtime 非正常退出后可自动识别 unfinished task、expired lease 和 pending outbox；
- 对已声明可幂等的 effect 提供 effectively-once outcome；
- 对不可判断外部效果进入 reconciliation，而非猜测；
- clean shutdown 支持 drain；
- backup/restore 和 rollback 每个 Release 都有验证；
- local data 与 release activation 分离。

## 4. Initial Performance Budgets

目标基线环境：主流 Windows 11 x64 开发机，SSD，至少 16 GB RAM。

| 指标 | 初始预算 |
|---|---|
| `framework version/doctor` 首次可见反馈 | <= 2 s |
| 空 Runtime 启动到 ready | <= 5 s |
| Runtime idle memory | <= 300 MB |
| 无外部副作用的本地 Command commit p95 | <= 100 ms |
| 10,000 Event 单 aggregate replay | <= 2 s |
| 100,000 Event recovery/index rebuild | <= 60 s |
| 普通 NodeExecutionRecord metadata | <= 256 KB（大内容转 Artifact） |
| Release 压缩包 | 目标 <= 300 MB |

这些预算不得通过禁用完整性、Evidence 或安全检查来达成。

## 5. Scalability

V1 优化单用户本地运行：

- 同时活跃 WorkflowRun 初始目标：100；
- 同时运行 Worker 默认受配置预算限制；
- Artifact 数量与 Event 历史支持长期增长；
- Context/Artifact 使用 streaming 和引用；
- 队列、重试和 telemetry cardinality 有上限；
- 无界数组、全量加载全部历史和全仓 prompt 禁止。

超出 V1 规模时应明确 backpressure/diagnostic，不得静默退化。

## 6. Portability

- Primary：Windows 11 x64；
- CI/reference：Linux x64；
- Core 不依赖路径分隔符、shell 特性或大小写偶然行为；
- UTF-8、中文路径、空格路径和长路径场景验证；
- 用户无需安装开发工具链；
- Adapter 明确声明 OS capability。

## 7. Security and Privacy

- local-first，默认无 telemetry upload；
- loopback Control API 不监听外部网络；
- secrets 不进入模型 Context、普通日志或可分享诊断摘要；
- capability deny by default；
- 高风险 effect 需要满足最低 sandbox/approval；
- release 具备 checksum、SBOM 和 provenance；
- audit persistence 失败时高风险写入 fail closed。

## 8. Observability

- 每个 Command、Event、NodeExecution、SideEffect、Verification 和 Gate 可通过 correlation identity 查询；
- logs/traces/metrics 使用统一 attributes；
- authoritative fact 不依赖 telemetry exporter；
- critical failure 具备 machine-readable code；
- `doctor` 能识别 storage、adapter、sandbox、lease、outbox 和 release integrity 问题。

## 9. Maintainability

- package dependency DAG 可自动验证；
- 每个核心语义一个 canonical owner；
- public/persisted Contract 有 schema 和 compatibility tests；
- 无隐式 singleton、import I/O 和 mutable global authority；
- critical decision logic 具备 property/model/mutation tests；
- 新依赖经过风险与维护评估；
- 文档、Contract、实现和 Evidence 在同一 PR 同步。

## 10. Compatibility

- Framework、WorkflowDefinition、Contract、Config、State Schema、Adapter Contract 独立版本化；
- Release manifest 声明支持的 upgrade source；
- 不支持的版本明确拒绝并给出安全路径；
- running execution 不静默切换 semantic version；
- old event decoder/upcaster 的退役有数据证明和 ADR。

## 11. Usability

- 双击/启动失败必须有可见反馈；
- CLI 错误包含 code、原因、受影响对象和 remediation；
- `doctor` 在用户修改文件前优先提供诊断；
- 高风险操作有 preview；
- inspect 能显示事实链而不是模型总结；
- local acceptance/rollback 无需用户理解内部数据库。
