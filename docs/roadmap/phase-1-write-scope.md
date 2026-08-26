# Phase 1 WRITE_SCOPE

状态：`BASELINE — PENDING M0 FINAL GATE`  
机器权威：`operations/phase-1/write-scope.json`  
执行模式：`DENY_BY_DEFAULT`

## Evaluation

```text
path matches current operation allowedPathGlobs
AND path matches globalAllowedPathGlobs
AND path matches no current/global deniedPathGlobs
AND change violates no semantic constraint
AND authority-lock mutation policy permits the operation
```

Path globs and semantic prohibitions are separate machine fields. A prose rule is never interpreted as a path glob.

## Mandatory coverage

Global scope explicitly includes:

- `tests/fault-injection/**`;
- `tests/security/**`;
- operation-specific Evidence paths;
- the final implementation receipt path.

The Phase 1 plan, WRITE_SCOPE, VerificationPlan, Receipt Schemas, Authority Lock, preimplementation policy, accepted ADRs and their human-readable authority documents are immutable during implementation. Contract inventory and registry are operation-scoped to P1-O02.

## Expansion

Any required out-of-scope change stops work and requires a separate governance/remediation decision. Generated files, rename, copy or scripts cannot bypass the scope.
