# ADR-0004：GitHub 完整建设，本地单向部署

状态：`ACCEPTED`  
日期：`2026-08-26`

## Context

本地建设速度和实现质量不足，且本地环境不能直接把文件上传回 GitHub。同时，本地保有私有项目、GBrain 知识库、模型配置和运行状态。

## Decision

- GitHub 建设完整、可安装、可运行 Framework；
- GitHub Release 单向下载到本地；
- 本地不是独立源码主线；
- 本地私有数据、Evidence、Secrets、Workspace 和知识库不要求上传；
- GBrain 等通过 versioned Adapter Contract 接入；
- Framework Release 与本地 data root 分离；
- 升级采用不可变版本目录、preflight、activation 和 rollback。

## Consequences

- Framework 修复必须在 GitHub 重建并重新发布；
- 本地 failure 通过结构化事实人工反馈，不能依赖自动上传附件；
- 需要强大的 `doctor`、diagnostics summary 和 local acceptance；
- Release 不能包含项目私有知识；
- 本地 LearningProposal 对 Framework code 只能进入 GitHub 工程流程。

## Rejected Alternatives

- GitHub 只放文档、本地继续开发核心：会继续形成双权威；
- 双向自动同步：当前不可用且增加隐私风险；
- 把知识库复制进 Framework：破坏项目边界与发布独立性。

## Verification

干净本地机器应仅通过下载 Release、配置 Adapter 即运行，并保持已有知识数据不变。
