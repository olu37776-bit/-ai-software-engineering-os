# Learning & Feedback 与主线并行建设协议

状态：`DRAFT / INTEGRATION_FORM_DEFINED / ACCEPTANCE_PENDING`  
更新：2026-09-08  
观察main：`ed14d4179808621c8ffd5751ebbf7b6704f33b64`  
[CURRENT](../../roadmap/learning-feedback-branch-plan.md) · [业务Contract](contract-and-seam-proposal.md) · [D01～D05](decision-register.md) · [业务54路径](../../roadmap/learning-feedback-core-entry-plan.md) · [正式授权规划](../../roadmap/learning-feedback-authority-transition-plan.md)

## 1. 主线与分支的职责

主线#82继续R01～R16/WR01和P1-O09/V10；#86已合并，#87/#88等实际状态必须每轮查询。LF设计为#81/PR84，开工放行为#85。#95/PR97只是请求/诊断准备，不授予后续checker/Authority或LF业务写权。

本分支独立的是任务、工作树、模块与组件级验证，不是Runtime、工具链、lockfile、事实库或Policy authority。C1只依赖public contracts，不接platform/Context/persistence，也不创建空provider。Future provider的schema、真实实现、conformance和运行证据分别核验，不靠名称假设存在。

## 2. 固定集成方案与写者分区

采用#97请求中已选定的 `ONE_ATOMIC_COMPLETE_SUBJECT`。业务任务唯一名称为 `LF-C1-INTEGRATION`；不再让执行者二选一，不先合空壳Schema或package。

| 文件类别 | 唯一负责写入的任务 | 限制 |
| --- | --- | --- |
| 开工包18条core与本包测试 | LF-C1-INTEGRATION | 单一实际operator/session；不用共享可写工作树 |
| 6业务Schema、12实例、原suite、README、inventory/registry/bindings/generated及suite测试，共26条 | LF-C1-INTEGRATION | 取得显式共享委托后串行处理；生成物仍受scope约束 |
| 根package/workspace/pnpm-lock/build/test/architecture 6条 | LF-C1-INTEGRATION | 保留主线全部现有依赖/测试边；只新增获准LF消费者，不改平台接线 |
| 4条普通实施文档 | LF-C1-INTEGRATION | 实际实现、状态和Evidence随操作同步；不得改已批准语义以放行自己 |
| 原P1 authority-lock的允许hash刷新 | MAINLINE_GOVERNANCE | 独立于LF54路径；只改获准实际变化的4个共享条目sha256；不得改owners/role/其他条目 |
| 新LF Authority、安装/Start Gate、独立Evidence | 正式授权规划指定的治理/独立任务 | 实施者不能写批准自己的文件；独立runner来源真实可追溯 |
| D01登记、授权规划、并行协议 | LF设计任务在单独docs scope内维护 | 默认不在LF-C1实施54路径；已批准后变更须复核 |
| 主线Runtime/Policy/Persistence/验证系统/Router/全局progress | 对应主线任务 | LF-C1只读，不顺手修#82或关闭其finding |

这是明确的任务分配方案，不是实际操作者已认领的声明。真实operator、session、审批者、有效期在接受记录中填入；不能因同一GitHub账号提交而把实现者和独立验证者当成同一角色，也不能虚构另一Agent已接受。

一个最终subject允许包含LF业务作者和独立治理hash刷新作者的分区commit；正常checker必须核查各自批准范围和最终diff。不能把54路径加lock后的联合文件集合颁给LF作者。未能获得lock刷新委托时保持BLOCKED，而不是跳过原锁。

## 3. E3接受记录与窗口

E3最小接受记录固定语义：integrationTask=LF-C1-INTEGRATION、实际operator/session及认领来源、acceptanceActor/权限与原记录、scope54Digest、共享集合、独立治理写者、baseCandidate、overlappingPRs与处置、windowId、validFrom/expiresAt、state、撤销条件。machine字段和承载路径见授权规划§5/G3，不再平行定义另一套JSON。

窗口状态：CLOSED → RESERVED → OPEN → CLOSED/REVOKED。

- CLOSED：尚未接受，禁止写共享文件。
- RESERVED：实际角色、范围、候选base、期限和排他窗口已被接受，但Start Gate未启用。**E3可以在RESERVED满足，不需要先开工。**
- OPEN：E0/E1/E2和RESERVED协议、E4发布绑定均被独立接受，#85发行有效Start Gate后才开放源码写入。
- CLOSED/REVOKED：任务结束、过期、scope/actor/base变化、共享竞写、相关Authority/依赖证据失效即停止新写入，保存diff。

避免“E3需要OPEN，而OPEN又依赖E3”的循环。预约不是批准写源码；观察main不等于approvedMain。

本轮不存在已接受operator或OPEN窗口。真实接受是实施前必须发生的动作，不是规划遗漏，不可以在文档中用假人名消掉阻塞。

## 4. 共享竞写与主线连续推进

启动前查询所有未合并PR的精确文件，不只#87/#88；suite/registry/generated/lock/build/test/architecture与任何活动写入重叠时，先由协调者选择次序，取消该范围内另一写窗口，再认领。

主线无关文件工作可继续。共有只读不需要文件锁；不得为LF独占整个仓库。共享更改由唯一operator基于最新被接受的base整合，禁止双方各自生成并覆盖同一lock/registry。冲突时保存各方diff、关闭窗口，不擅自revert另一任务，不force-push。

本方案是明确的操作协议，不宣称GitHub已经提供自动文件锁。若将来实现自动排他，需要独立授权及测试，不能让文档预约冒充可执行安全边界。

## 5. 每轮启动、同步与watchlist

每轮开始、相关主线PR合并、共享集成前、提交前和任务结束都读取：main SHA/tree、目标HEAD、#85、批准Authority、PR实际diff、toolchain/lock、公有contracts入口/Schema/生成器、独立Evidence及dirty baseline。

| watch类别 | 真实路径/对象 | 影响处理 |
| --- | --- | --- |
| owner/不变量 | docs/README.md、CONTRIBUTING.md、accepted ADR、repository-blueprint | owner或安全语义变化先review |
| 工具链/构建 | toolchain/toolchain.json、package.json、pnpm-lock.yaml、tsconfig | 用仓库实际版本重建，不另建工具链 |
| 输入与校验 | contracts公开入口、identity/ref/Gate/Evidence、registry/inventory/bindings/generated/canonical-json/日期/generator | R06/R09/R10及consumer回归 |
| 架构/门禁 | architecture-policy、scripts/architecture、scope/normal M0、workflows/receipt校验 | R01/R02/R08/R16及新subject验证 |
| 后续provider | node-runtime/context/workflow/verification公开入口、platform/persistence | 相应I阶段才启用，不提前deep import |
| 协调 | #82活动PR、#95/#97、#85、CURRENT | 共享单写者与依赖证据 |

无关变化保留历史成果；同一subject不自动吸收未合并主线代码。相关兼容变化在受控窗口同步后重跑consumer、build/Contract/architecture；identity/required字段/owner等不兼容变化返回设计review，不隐藏legacy alias；依赖被否定时失效对应readiness，不删除无关成果。

受审查分支不rebase/force改写历史；普通merge或获准新generation均需新subject证据。发布前再次读取ref，他人推进先停再检查。新增/修改/删除/rename前后/未跟踪文件均核对，原有dirty文件单独记录，不借ignore藏改动。

## 6. 一次操作同时维护文档与Evidence

LF执行者修改代码时同步其4条普通文档、测试和Evidence引用，最多IMPLEMENTED，不另拆专职文档写手。计划/review/治理授权可以单独成任务，独立review只读被测subject、不边修边审。

每工作包末尾局部对齐；公共接口变更、共享集成、首次生产wiring、阶段放行、进入Learning或Release前全量对齐。CURRENT是唯一当前状态入口；review/readiness保存原subject，不随着进度改写旧结论。

D01～D05固定从decision-register的#d01～#d05读取；业务字段只从Contract读取；54路径与C1-V01～18只从开工包读取；控制面G0～G3只从授权规划读取。概述不复制其细节，防止再次只改下层而留下上层许可。

## 7. 独立验证、基线与回执

reviewer必须有真实独立执行来源，绑定exact HEAD/tree、对照main和实际覆盖。旧SHA PASS、相同tree、Git签名、CI绿色、机器人无高危摘要或作者转述均不能自动代替新subject独立结论。

报告发布commit与被测commit分开，合并后对landing main执行适用检查。正式approvedMain通过授权规划§8的M0→Gate→M1→外部回执流程绑定，不往产生某commit的文件中写同一个commit形成自引用。main变化后做有证据的针对性rebind，不把旧Gate无限适用于任意后续提交。

独立报告不在LF54路径。固定输出路径须由独立Evidence任务授权；没有该授权时在#85记录原报告来源和exact subject，不要求实现者越界写报告或自标VERIFIED。

## 8. 停止与恢复

无正式scope、窗口关闭/过期、共享竞写、Authority冲突、相关依赖失效、来源不完整或必须绕过正常检查才通过时停止新写入，保留diff和诊断；不自批、不改裁判、不回滚他人工作。

恢复需实际接受记录/新的Authority或依赖Evidence，以及新subject验证。可以继续未受影响的文档设计，不要求等待LF-C1未使用的完整Runtime。当前规划已选定集成方式，剩余操作者接受、代码接线和批准是实际执行事项，不再要求Agent重新设计方案。
