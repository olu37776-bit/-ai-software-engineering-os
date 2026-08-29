# Phase 1 WRITE_SCOPE

状态：`AMENDED — ISSUE #14 P1-O02 ROOT INTEGRATION SCOPE CLOSURE`
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
- `operations/phase-1/executions/**` as the global execution-record parent;
- the final integrated implementation receipt path.

Each operation owns only its exact execution-record namespace:

| Operation | Execution-record scope |
|---|---|
| P1-O01 | `operations/phase-1/executions/p1-o01-*.json` |
| P1-O02 | `operations/phase-1/executions/p1-o02-*.json` |
| P1-O03 | `operations/phase-1/executions/p1-o03-*.json` |
| P1-O04 | `operations/phase-1/executions/p1-o04-*.json` |
| P1-O05 | `operations/phase-1/executions/p1-o05-*.json` |
| P1-O06 | `operations/phase-1/executions/p1-o06-*.json` |
| P1-O07 | `operations/phase-1/executions/p1-o07-*.json` |
| P1-O08 | `operations/phase-1/executions/p1-o08-*.json` |
| P1-O09 | `operations/phase-1/executions/p1-o09-*.json` |

`operations/phase-1/implementation-receipt.json` is not a P1-O01 output. It remains the whole-Phase-1 receipt produced by P1-O09 at the integrated handoff.

The Phase 1 plan, WRITE_SCOPE, VerificationPlan, Receipt Schemas, Authority Lock, preimplementation policy, accepted ADRs and their human-readable authority documents are immutable during implementation. Contract inventory and registry are operation-scoped to P1-O02.

Issue #7 repairs a scope-closure defect only. It changes no accepted ADR and no Operation Plan or VerificationPlan semantics. P1-O01 may resume only from the protected `main` commit containing the amendment and its passing required `verify` result.

## P1-O02 root integration amendment

Issue #14 grants only P1-O02 the minimum exact root paths required to integrate the Contract package with the authoritative workspace, lockfile, project-reference build and test selection:

- `package.json`;
- `pnpm-workspace.yaml`;
- `pnpm-lock.yaml`;
- `tsconfig.build.json`;
- `vitest.config.mjs`.

This grant does not modify the files above. They remain future P1-O02 implementation paths until this governance amendment is independently verified. P1-O01 and P1-O03 through P1-O09 receive no authority expansion. `DENY_BY_DEFAULT`, global denial, semantic constraints and Authority Lock ownership remain unchanged.

## Expansion

Any required out-of-scope change stops work and requires a separate governance/remediation decision. Generated files, rename, copy or scripts cannot bypass the scope.
