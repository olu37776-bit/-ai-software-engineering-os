# Learning & Feedback

状态：`BASELINE DRAFT v0.1`  
日期：`2026-08-26`

## 1. 定位

Learning & Feedback 的目标不是累积自然语言“经验”，而是利用运行事实识别可验证的系统改进，并在治理门禁后更新 Node Component。

Node 是最小执行与归因单位。学习对象包括：

- Context Policy；
- Contract；
- Skill；
- Verification Profile/Asset；
- Routing Policy；
- Node Boundary；
- Adapter selection/configuration。

## 2. 权威链

```text
NodeExecutionRecord
  -> EvidenceGraph
  -> Node Attribution
  -> RootCauseCandidate
  -> Causal Validation / Intervention / Replay
  -> ValidatedRootCause
  -> LearningProposal
  -> LearningGate
  -> Versioned Component Change
```

任何一步都不得被一个自由文本总结整体替代。

## 3. Node Attribution

Attribution 首先定位失败或返工与哪个 Node、Attempt、Context、Contract、Skill、Verification、Routing 或环境因素相关。

候选类别至少包括：

- missing/incorrect Context；
- Contract ambiguity or incompleteness；
- Skill defect；
- invalid routing；
- insufficient verification；
- tool/model/provider failure；
- permission/config/environment issue；
- boundary too broad/narrow；
- implementation defect；
- data quality issue；
- non-reproducible/transient condition。

Attribution result 必须保留不确定性和 alternative explanations。

## 4. RootCauseCandidate

RootCauseCandidate 至少包含：

```text
candidateId
subject node/component
claim
supportingEvidenceRefs
contradictingEvidenceRefs
assumptions
confidence
proposedValidation
producer/version
```

高置信语言表达不能替代 supporting Evidence。

## 5. Causal Validation

允许的方法：

- deterministic replay；
- Context ablation/addition；
- alternate Skill/Contract replay；
- verification asset injection；
- route intervention；
- controlled model/provider comparison；
- environment reproduction；
- counterfactual simulation；
- human domain review。

只有观察相关性时，状态仍是 candidate。ValidatedRootCause 必须说明干预、结果、剩余不确定性和适用范围。

## 6. LearningProposal

Proposal 必须是可审查差异，而不是“以后注意”：

```text
proposalId
target component + version
validated root cause refs
before/after contract or policy diff
expected impact
risk
verification plan
rollback plan
scope of applicability
```

可能的 proposal：

- 增加 Context source 或 freshness rule；
- 收紧 output Contract；
- 拆分 Node Boundary；
- 添加 verification step/oracle；
- 修改 routing condition；
- 限制某 Adapter/capability；
- 新增 Skill version；
- 给知识实体补充 alias/provenance rule。

## 7. LearningGate

Gate 至少检查：

- root cause 是否 validated；
- Proposal 是否精确定位 Component；
- 是否产生新的权限或安全风险；
- 是否具备回归与 rollback；
- 是否与其他 Workflow/Node Contract 冲突；
- 是否需要 Human Approval；
- Evidence 是否可复现；
- 是否应进入 GitHub 工程变更，而非本地配置变更。

## 8. GitHub 单向建设的影响

本地 Learning System 可以生成并保存 LearningProposal，但不能假设能自动上传或修改 GitHub Framework。

变更分为：

1. **Local runtime configuration**：在 Policy 允许且可版本化/回滚时，可经本地 Gate 应用；
2. **Local knowledge asset**：通过 Knowledge Adapter 的治理写入能力处理，默认仍需审批；
3. **Framework Contract/code**：必须转化为 GitHub 侧工程任务，由正式实现、验证和 Release 流程完成；
4. **Project source change**：在本地 Workspace 内按对应 Workflow 和审批规则处理。

V1 默认采用 proposal-first，不启用无审批自修改 Framework。

## 9. 防止静默失败

历史建设已出现 evaluation 因 singleton 未初始化而静默失效、Context cache 不同步等问题。新实现必须：

- 禁止 evaluator 依赖隐式全局状态；
- 输入全部显式注入并带 snapshot id；
- evaluation failure 形成 Event/Evidence；
- 缺少输入时返回 typed `INCONCLUSIVE/BLOCKED`；
- cache 只能优化，不得改变权威结果；
- evaluator version 和 policy snapshot 必须记录；
- 关键 evaluator 具备 replay test、fault injection 和 mutation test。

## 10. 学习质量指标

不以 Proposal 数量衡量学习质量。优先指标：

- repeated failure recurrence；
- rework rate；
- root cause validation rate；
- accepted proposal effectiveness；
- regression introduced by learning；
- verification gap closure；
- Context precision/recall；
- rollback frequency；
- time/evidence cost to validate a root cause。
