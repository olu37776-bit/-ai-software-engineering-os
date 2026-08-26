# 本地资源与知识库接入

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 目标

GitHub 提供完整 Framework；本地下载后通过稳定 Port 接入私有模型、工具、项目 Workspace、Secrets、GBrain 和其他知识资产。Framework Core 不复制这些资产，也不要求上传。

## 2. Adapter 原则

每个 Adapter 必须：

- 实现 versioned Contract；
- 声明 capability manifest；
- 声明 permission requirements；
- 提供 health/preflight；
- 返回结构化 Result 与 Evidence；
- 记录 adapter/provider version；
- 对 unsupported capability fail closed；
- 不拥有 Workflow、Node、Verification Gate 等 Core 语义；
- 不通过全局 singleton 隐式注册。

Adapter 由 composition root 显式装配。

## 3. ModelProviderPort

能力至少覆盖：

```text
provider/model identity
context limits
structured output support
tool-call support
streaming
reasoning/control parameters
usage/cost metadata
safety/data handling capability
availability/health
```

调用记录应包括 request/response artifact、实际模型标识、参数、timeout、retry、usage 和 provider response metadata。

模型的能力声明不能只来自配置；必要时由 capability probe 验证。Framework 按 Policy 选择 provider，不能在 prompt 中要求 Agent 自行切换模型。

## 4. ToolExecutorPort

工具以 capability 而不是任意 shell 权限暴露：

```text
read_workspace
write_workspace
run_tests
build
search_code
invoke_domain_tool
network_access
```

每次 invocation 有明确 working scope、allowlist、timeout、resource budget 和 side-effect class。通用 shell 仅作为受限 capability，不是默认万能后门。

## 5. WorkspacePort

Workspace Adapter 提供：

- 文件读取与受控写入；
- git status/diff/snapshot；
- staged change set；
- path normalization 与 traversal 防护；
- lock/concurrency；
- rollback/restore；
- change provenance。

Agent 不直接拿到宿主机任意路径。Windows 路径、编码、文件锁和大小写差异必须在 contract test 中覆盖。

## 6. KnowledgeProviderPort

GBrain 和其他知识系统通过统一读取接口接入。基础能力：

```text
getCapabilities()
query(KnowledgeQuery)
getById(KnowledgeRef)
resolveEntity(EntityQuery)
getRelations(RelationQuery)
health()
```

可选治理写入能力单独声明，默认 read-only。

### 6.1 KnowledgeResult

至少包含：

```text
knowledgeRef
canonicalName
aliases
content/artifactRef
sourceRefs
contentHash
retrievedAt
effectiveAt/freshness
trustLevel
confidence/retrievalScore
relations
sensitivity
```

检索分数不等于事实可信度。正式知识页面的 canonical name、aliases、代码标识符、MML、设备型号和 Feature 缩写规范由知识库自身治理，Framework 保留其原始形式和 provenance。

### 6.2 Context 接入

KnowledgeResult 不能直接拼进 prompt。它先经过：

```text
Knowledge Adapter
-> provenance/trust normalization
-> relevance selection
-> Context Policy
-> ContextItem
-> ContextSnapshot
```

来自知识页面的命令式文字仍然没有系统 instruction authority。

## 7. GBrain 边界

- GBrain 是本地知识实现，不是 Framework Core 的数据库；
- `swap-kb`、`microwave-kb` 等知识内容不进入本仓库；
- Framework 通过配置选择 endpoint、KB 和凭据；
- Adapter 处理协议差异、查询转换和结果规范化；
- GBrain 不可用时，相关 Node 根据 Contract 进入 `BLOCKED`、降级到已批准替代源或要求人工处理，不能静默使用过期 cache；
- 后续替换为其他知识引擎时，Core Contract 保持稳定。

## 8. SecretProviderPort

- secret 以 handle 使用，不默认进入模型或日志；
- Adapter 只能按 Node permission 获取所需 secret；
- secret value 在 Evidence 中脱敏；
- provider 错误不得回显完整凭据；
- local config 只保存引用时优先引用；
- Release 不包含用户 secrets。

## 9. Local Control API

本地 Runtime 应提供 loopback-only 的 versioned Control API，供 CLI/UI/IDE Adapter 使用。默认：

- 不监听公网接口；
- 需要本地认证 token 或 OS-level protection；
- 所有写操作转化为 Command；
- API 不直接暴露数据库；
- response 返回 correlation/execution refs；
- compatibility 通过 API version 和 schema 管理。

具体协议在独立 ADR 中决定。

## 10. Offline 与降级

Framework 必须区分：

- 完全离线可执行能力；
- 需要本地服务的能力；
- 需要外部网络/provider 的能力。

Preflight 生成 capability matrix。缺失能力不能隐藏；Router、Policy 与 VerificationPlan 必须据此选择合法路径或明确阻塞。
