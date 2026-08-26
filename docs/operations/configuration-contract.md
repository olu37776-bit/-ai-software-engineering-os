# 本地 Configuration Contract

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 原则

配置只描述环境、Adapter、Policy 参数和可选功能，不承载 Core 业务语义代码。所有有效配置在 Runtime 启动时解析为不可变 `EffectiveConfigSnapshot`。

## 2. Layering

优先级由低到高：

```text
release defaults
< machine config
< user config
< workspace config
< explicit CLI override
```

每个最终值必须可查询来源。冲突、未知字段、版本不支持和无效值默认失败，不静默忽略。

## 3. Root Sections

目标 schema：

```yaml
schemaVersion: "1"
runtime: {}
storage: {}
artifacts: {}
workspaces: []
modelProviders: []
toolExecutors: []
knowledgeProviders: []
verification: {}
policy: {}
security: {}
telemetry: {}
operations: {}
```

这是结构方向，不是最终字段定义。

## 4. Runtime

配置：

- data root；
- local API bind（默认 loopback）；
- worker concurrency；
- shutdown/drain timeout；
- default budgets；
- feature flags（必须 versioned、可审计）。

不能配置任意 reducer module path 或动态加载未经签名的 Core 代码。

## 5. Storage and Artifacts

- storage adapter id；
- database path/connection handle；
- integrity/backup policy；
- artifact root；
- retention/encryption；
- maximum sizes；
- migration mode。

路径经过标准化并限制在允许 data root，除非显式批准 external path。

## 6. Adapters

每个 Adapter entry：

```text
id
type
contractVersion
module/builtInId
capability overrides
endpoint/path
secretHandles
health/preflight settings
permissions
```

Runtime 用实际 capability probe 校验配置声明。

## 7. GBrain Example

```yaml
knowledgeProviders:
  - id: gbrain-local
    type: gbrain
    mode: read-only
    endpoint: "http://127.0.0.1:<port>"
    knowledgeBases:
      - swap-kb
      - microwave-kb
    secretHandles: []
```

真实 endpoint/port 留在本地。知识内容和凭据不进入 GitHub。

## 8. Secrets

配置文件只引用：

```text
secret://provider/key
```

或等价 handle。禁止在 example、日志、EffectiveConfig display 中输出 secret value。Environment variable 可以作为 SecretProvider 输入，但必须声明来源与风险，不由任意 package 直接读取。

## 9. Policy and Security

配置可选择已随 Release 提供或本地批准的 Policy set，并设置：

- default deny；
- risk thresholds；
- approval roles；
- sandbox minimum；
- provider data policy；
- retention；
- emergency override policy。

配置不能关闭不可协商的安全不变量，例如允许模型直接写 authority state。

## 10. Reload

- telemetry sampling、非权威 UI 设置可 hot reload；
- permissions、Policy、Adapter、storage 和 execution budget 变更生成新 EffectiveConfigSnapshot；
- 影响在运行 execution 的变更默认需要 restart/drain；
- config reload failure 保持旧 snapshot 并报告，不使用部分新配置；
- 每个 NodeExecutionRecord 引用实际 snapshot id。

## 11. Validation and Doctor

Preflight 检查：

- schema/dialect/version；
- duplicate IDs；
- path/permission；
- secret handles；
- adapter availability/capabilities；
- port conflict；
- storage integrity；
- policy consistency；
- sandbox support；
- unsupported combinations。

输出 machine-readable finding 和 remediation，不无响应退出。

## 12. Versioning and Migration

- config schema 与 Framework version 独立；
- Release manifest 声明支持范围；
- migration 先生成 preview/diff；
- 原文件备份；
- 不可自动迁移时明确阻塞；
- unknown sensitive fields 不复制到新配置；
- migration 结果重新 validation 并生成 Evidence。
