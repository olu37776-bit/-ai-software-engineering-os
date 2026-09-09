# Coverage Loop：独立测试资产建设方案

状态：`DRAFT v1.1 / DOCUMENTATION_ONLY / REVIEW_PENDING`  
日期：2026-09-08  
适用对象：本地Java/Maven项目及OpenCode主/子Agent，按用户报告的MiniMax执行问题设计；模型由外部配置，不在任务卡里绑定。

**当前没有交付已接入本地项目的新Runner，也未验证用户POM、云端日志或现有Python工具。允许下一步只读P0，不允许据此直接恢复无人值守Loop。**

## 1. 目标与边界

由当前保留测试资产的新鲜完整执行证明JaCoCo聚合LINE≥90%。单元、组件、集成贡献分别记录，不把联合Coverage称为纯单元测试覆盖率。

这是独立测试资产工具设计，不依赖或注册主框架尚未完成的Workflow/Node/Runtime，不修改其Phase1状态、Contract或发布门禁。未来接入验证系统需要独立操作。

仓库起始核对基点为`5577c2e8a9ef090b87924edddf6114dd75eb28a5`。最终差异仅在本目录；共享docs/README导航修改已撤回，未改scope/authority/checks。历史本地事故是用户报告，不能冒充本次现场运行证据。

## 2. 阅读入口

| 文件 | 唯一职责 | 读者 |
| --- | --- | --- |
| [DESIGN.md](DESIGN.md) | 角色、工作包、权限、接受/恢复契约 | 工具实现与审查 |
| [ENVIRONMENT_AND_COVERAGE.md](ENVIRONMENT_AND_COVERAGE.md) | 环境、指纹、exec、报告与新鲜证明 | 执行/解析器实现者 |
| [TEST_AUTHORING_GUIDE.md](TEST_AUTHORING_GUIDE.md) | 测试配方、样板、断言及短角色卡 | 分析/实施/审查Agent |
| [loop_process.md](loop_process.md) | 七阶段薄控制协议 | 主Agent |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | P0–P4范围、实施与放行 | 本地实施Agent |
| [ACCEPTANCE_AND_INCIDENTS.md](ACCEPTANCE_AND_INCIDENTS.md) | 故障→验收矩阵和一手来源 | 验证者 |
| [LOCAL_HANDOFF.md](LOCAL_HANDOFF.md) | 当前唯一需要用户的本地动作 | 用户/本地Agent |
| [P0_LOCAL_INVENTORY.template.md](P0_LOCAL_INVENTORY.template.md) | 固定盘点回执，避免只回READY | 本地Agent |
| [AUTHOR_REVIEW.md](AUTHOR_REVIEW.md) | 本轮作者复核、修订与未验证边界 | 审查者 |

项目业务契约和明确授权优先。本目录内DESIGN定设计、ENVIRONMENT定度量、AUTHORING定测试方法，Loop只引用，不复制另一套相反规则。包以不可变commit锁定，个别文档版本号不同不代表可跨commit任意拼接。

## 3. 核心结构

```text
程序提供有边界的工作包
→ 主Agent选优先级；分析子Agent给真实路径、条件、预期
→ 程序验前置后派实施者，在隔离副本提交测试补丁
→ 程序验证范围、测试发现/健康、精确目标收益；只读审查断言
→ 测试树、证据和状态发布为同一个不可变revision
→ 自动下一包、受控暂停或新鲜全量验收
```

外层`/goal`只唤醒，不拥有正式状态、验收或唯一预算。无真实Agent Adapter/隔离/取消能力，不称无人值守。

## 4. 复用与关键修正

保留并核验本地coverage_report.py和test_runner.py；不按聊天假定签名已存在，不新建竞争Runner。

累计结果标ACCUMULATED_SEARCH用于导航，FRESH_FULL才证明当前测试集；旧测试/fixture变化须失效旧贡献。Method目标用module/class/method/descriptor，行区间无法证明时只作LINE_HINT。

accepted状态不是手改manifest字段：在候选测试树完成验证后，一次发布current指针；Markdown/工作区是受控可恢复投影。同(batchId,attempt)换payload必须冲突，不能因把hash放进幂等键而被当成新请求。

## 5. GitHub与本地单向交接

公司源码、原始云端日志、settings/令牌、设备数据、exec/class全部留本地，不上传此公开仓库。

当前先按固定commit下载到`.ai-local/coverage/reconstruction/authority-candidate/`旁路位置，只作为P0评估材料。**不要覆盖现有authority、loop、plan、manifest和运行状态。** P4验收后才切换正式Authority及旧入口。

## 6. 当前下一步

只执行 [LOCAL_HANDOFF.md](LOCAL_HANDOFF.md) 中的P0短任务，按模板生成一份本地盘点回执。缺材料标UNKNOWN，不修改POM/工具，不执行Maven，不重新建Baseline，不补测试。

本次作者复核和自动检查不等于独立设计审查；独立审查/合并与本地P0可分别推进。P1以后需明确范围和审查放行。
