# ADR-0001：完整重建 Framework

状态：`ACCEPTED`  
日期：`2026-08-26`

## Context

旧本地实现积累了重复 semantic owner、状态转换双属主、幂等缺失、测试与删除路径矛盾、隐式 singleton、cache 不一致、静默失败和文档/Contract/代码漂移。其工程结构不足以承载已经形成的 Framework 架构。

## Decision

在新 GitHub 仓库从零建设完整 Framework：架构、Contract、代码、测试、Release 和文档全部重新建立。

旧实现不进行整体迁移。只允许提取：

- 已验证架构决策；
- 明确 Contract/行为事实；
- 可复现失败案例；
- 必须避免的缺陷模式。

## Consequences

- 新目录、类型和实现无需兼容旧文件结构；
- 不以旧测试通过作为新实现验收；
- 需要兼容的行为必须先形成显式 Contract；
- 建设初期投入更多设计与 executable specification；
- 避免技术债被误认为权威基线；
- 本地旧 Framework 仅在新 Release 达到替换门禁前暂时保留。

## Rejected Alternatives

### 复制旧仓库后渐进重构

会让旧语义、依赖和错误测试成为新 Agent 的默认范式，拒绝。

### 长期维护 v1/v2 两套 Runtime

会造成 semantic ownership、数据兼容和运维复杂度失控，拒绝。

## Verification

每个新 package 必须能从当前文档/Contract 解释其必要性；禁止以“旧代码里有”作为唯一理由。
