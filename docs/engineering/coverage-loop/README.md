# Coverage Loop：独立测试资产建设方案

状态：`DRAFT v1.0 / DOCUMENTATION_ONLY`  
日期：2026-09-08  
适用对象：本地 Java/Maven 项目、OpenCode 主/子 Agent、用户当前采用的 MiniMax 2.7。模型由外部配置选择，执行提示词不绑定模型。  
当前可执行性：**设计与实施指导已编写；本目录没有交付可运行的新 Runner，也没有验证本地 POM、云端日志或现有 Python 工具。不得直接据此恢复无人值守循环。**

## 1. 目标与边界

目标是让当前保留的测试资产，在明确统计范围内，重新执行后证明 **JaCoCo 聚合 LINE Coverage ≥ 90%**。单元测试与必要的组件/集成测试可以共同贡献，但必须分别说明来源，不把联合覆盖率称为纯单元测试覆盖率。

本方案只解决测试资产建设，不依赖本仓库尚未完成的生产 Workflow/Node/Runtime，不注册虚构 nodeId，不修改主框架的 Contract、执行状态或发布门禁。未来可作为验证系统的一项执行能力接入，当前保持独立。

设计依据包括本次对话中用户报告的实际故障；这些报告不是已经取得的现场运行证据。仓库核对基点为 `5577c2e8a9ef090b87924edddf6114dd75eb28a5`。详细事实边界见 [故障与验收](ACCEPTANCE_AND_INCIDENTS.md)。

## 2. 阅读入口

| 文件 | 唯一职责 | 谁需要读 |
| --- | --- | --- |
| [DESIGN.md](DESIGN.md) | 架构选择、权限边界、任务与提交契约 | 实现工具者、审查者 |
| [ENVIRONMENT_AND_COVERAGE.md](ENVIRONMENT_AND_COVERAGE.md) | 本地/云端配置边界、字节码、覆盖率与失败证据 | Runner/解析器实现者 |
| [TEST_AUTHORING_GUIDE.md](TEST_AUTHORING_GUIDE.md) | 如何让能力有限的执行 Agent 写有效测试；短任务卡 | 分析、实现、审查 Agent |
| [loop_process.md](loop_process.md) | 一页循环协议，不展开 Maven、JSON、Markdown 内部步骤 | 主 Agent |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | 分阶段 WRITE_SCOPE、迁移、准入与启动 | 本地实施 Agent |
| [ACCEPTANCE_AND_INCIDENTS.md](ACCEPTANCE_AND_INCIDENTS.md) | 历史失败到对抗测试的映射、外部一手来源 | 验证/审查者 |

约束冲突时：本地明确授权及项目业务契约优先；本目录内 DESIGN 定义设计选择，ENVIRONMENT 定义度量，AUTHORING 定义测试方法，loop_process 只引用它们。不得在多个文件另写一套相反规则。

## 3. 核心结构

```text
程序恢复状态、提供一个有边界的工作包
  → 主 Agent 选优先级；只读子 Agent 给出可达路径与预期
  → 通过前置检查后，实施子 Agent 在隔离副本提交测试补丁
  → 程序验证补丁范围、编译、测试发现、目标方法收益与测试健康
  → 只读审查子 Agent 检查断言；程序发布一个不可变结果版本
  → 自动下一包，或按有限预算暂停，或执行新鲜全量验收
```

外层 `/goal` 只负责唤醒，不作为持久状态、验收权威或唯一限额控制器。没有具备超时、取消、恢复能力的本地 Agent Adapter，就不能宣称已支持无人值守。

## 4. 保留什么，替换什么

保留本地 `coverage_report.py` 的解析/查询能力和 `test_runner.py` 的命令封装；先审计接口再迁移，不按聊天记录假定函数已存在。复用现有 Execution Store，但将累计结果明确标注为 `ACCUMULATED_SEARCH`，最终完成依据改为 `FRESH_FULL`。

不再让主 Agent 手工拼 Maven 命令、修改 POM、更新 manifest.accepted、计算指纹、同步多份 Markdown，或凭 READY 自评完成。无需为了本文档立即删除旧脚本；验证替代能力并更新所有有效引用后再退役重复入口。

## 5. GitHub 与本地的单向交接

本目录保存设计 Authority、任务卡和验收标准；公司源码、设备资料、云端原始日志、settings.xml、令牌、真实测试数据、exec/class 快照均留在本地，不上传此公开仓库。

本地按固定 Git commit 下载本目录到 `.ai-local/coverage/authority/`，保留该版本及下载文件哈希。不要把整个主框架安装到业务工作区。新版本先下载到旁路目录，完成变更检查后再切换，不覆盖执行中的任务上下文。

现有 `.ai-local/coverage/loop_process.md` 在迁移完成后只作为指向已批准 Authority 版本的入口；现有 `TEST_COVERAGE_PLAN.md` 只保留本地业务补充与指导书引用。`COVERAGE_PROGRESS.md`、`COVERAGE_ROADMAP.md`、`AUTONOMOUS_RUN_SUMMARY.md` 继续是本地状态视图，不回写 GitHub Authority。

## 6. 当前下一步

只执行 [实施计划 P0](IMPLEMENTATION_PLAN.md)：读取现有 POM、云端日志及两个工具，做能力/命令映射，保留全部本地修改，不启动覆盖率批次。P0 结束必须给出下一步明确 WRITE_SCOPE；不得自动演变成整仓重写。

本次文档自检不等于独立验证，也不等于本地运行成功。实现者只能声明 IMPLEMENTED；通过验收矩阵及独立审查后才能解除相应运行限制。