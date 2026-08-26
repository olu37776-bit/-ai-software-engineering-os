# Architecture Reviews

本目录保存独立审查、remediation verification 和阶段 Gate 结论。

Review 不替代 ADR、Contract、测试或运行 Evidence。文档审查只能验证设计基线的一致性与可实施性；只有实现、测试和运行证据齐全后，具体 capability 才能标记为 `VERIFIED`。

## Review Records

| Review | Subject | Decision |
|---|---|---|
| [Phase 0 Independent Architecture Review](phase-0-independent-architecture-review.md) | Full-rebuild architecture baseline at `65b7688` + ADR-0007~0011 remediation | `PASS_WITH_RESIDUAL_WORK` |

## Required Structure

正式 Review 至少记录：

- reviewed subject/commit；
- reviewer role 与独立性边界；
- scope/exclusions；
- method；
- findings severity/status；
- supporting document/Contract/Evidence refs；
- residual risks；
- GateDecision 与允许的下一步。

实现者不能用自述 Review 把自己的实现从 `IMPLEMENTED` 改为 `VERIFIED`。

- [Phase 0 Schema / Phase 1 Governance Remediation Review](phase-0-schema-phase1-governance-review.md) — `IMPLEMENTED`, pending independent verification.
