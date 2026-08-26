# ADR-0005：模块化单体 + 隔离 Worker

状态：`ACCEPTED`  
日期：`2026-08-26`

## Context

本系统需要严格模块边界和高风险任务隔离，但首要部署目标是单机本地运行。微服务会引入服务发现、网络一致性、部署和诊断成本；纯单进程又无法隔离模型、工具和任意命令。

## Decision

Control、Workflow、Policy、Verification Orchestration 和 persistence 采用模块化单体；模型、工具、构建测试和高风险副作用通过隔离 Worker/Adapter 执行。

模块边界由 package graph、public Contract 和 architecture test 强制，而不是通过网络边界伪装。

## Consequences

- 本地安装和恢复更简单；
- 事务边界清晰；
- Worker 可按风险使用 process/OS sandbox/container/remote；
- 未来可在有证据时远程化特定 executor；
- Core package 必须保持无 Adapter 依赖。

## Rejected Alternatives

- 初始微服务：运维复杂度大于收益；
- 全部单进程：工具崩溃和权限风险污染 Runtime；
- 插件任意加载进主进程：扩大供应链和隔离风险。

## Verification

架构测试阻止依赖反转；Worker crash/timeout 不得破坏 Kernel state；本地 Release 只需启动有限受控进程。
