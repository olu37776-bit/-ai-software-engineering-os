# Phase 1 WRITE_SCOPE

状态：`AMENDED — ISSUE #48 FINAL P1-O04 SCOPE/AUTHORITY CLOSURE`
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

- `.github/workflows/m0-independent-verify.yml`;
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

The Phase 1 plan, WRITE_SCOPE, VerificationPlan, Receipt Schemas, Authority Lock, preimplementation policy, accepted ADRs and their human-readable authority documents are immutable during implementation. Contract inventory and registry remain operation-scoped exactly as recorded in the Authority Lock.

Issue #7 repairs a scope-closure defect only. It changes no accepted ADR and no Operation Plan or VerificationPlan semantics. P1-O01 may resume only from the protected `main` commit containing the amendment and its passing required `verify` result.

## P1-O02 root integration amendment

Issue #14 grants only P1-O02 the minimum exact root paths required to integrate the Contract package with the authoritative workspace, lockfile, project-reference build and test selection:

- `package.json`;
- `pnpm-workspace.yaml`;
- `pnpm-lock.yaml`;
- `tsconfig.build.json`;
- `vitest.config.mjs`.

This grant does not modify the files above. They remain future P1-O02 implementation paths until this governance amendment is independently verified. P1-O01 and P1-O03 through P1-O09 receive no authority expansion. `DENY_BY_DEFAULT`, global denial, semantic constraints and Authority Lock ownership remain unchanged.

## P1-O04 transition-enforcement preliminary amendment

Issue #29 grants P1-O01 the exact paths required to keep the M0 transition enforcement machine-closed:

- `.github/workflows/m0-independent-verify.yml` is added to global scope and P1-O01 scope;
- `scripts/governance/verify_m0.py` is added to P1-O01 scope and remains globally covered by `scripts/**`.

P1-O02 through P1-O09 receive neither added path. This preliminary amendment does not modify the workflow or M0 verifier, start P1-O04, change production semantics, change accepted ADRs, or change the Authority Lock path set, roles, mutation policies or operation ownership. `DENY_BY_DEFAULT` remains unchanged.

## P1-O04 final scope and Authority amendment

Issue #48 closes the previously authorized P1-O04 integration boundary without starting P1-O04. P1-O04 receives only these exact root and Contract integration paths:

- `package.json`;
- `packages/contracts/README.md`;
- `packages/contracts/planned-contracts.json`;
- `packages/contracts/schema-inventory.json`;
- `packages/contracts/schema-registry.json`;
- `packages/contracts/src/types.generated.ts`;
- `packages/contracts/type-bindings.json`;
- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml`;
- `tests/contract/inventory-integrity.test.mjs`;
- `tests/contract/registry-integrity.test.mjs`;
- `tests/contract/runtime-validator.test.mjs`;
- `tests/contract/schema-type-consistency.test.mjs`;
- `tsconfig.build.json`;
- `vitest.config.mjs`.

The Authority Lock ownership of `packages/contracts/planned-contracts.json`, `packages/contracts/schema-inventory.json` and `packages/contracts/schema-registry.json` changes only from `[P1-O02]` to `[P1-O02, P1-O04]`. All other authority paths, roles, mutation policies, hashes and operation ownership remain unchanged except the transactional hashes for this WRITE_SCOPE file and its roadmap mirror.

This amendment does not modify any package, Contract asset, root integration file, workflow, verifier, accepted ADR or Runtime behavior. The paths above remain future P1-O04 implementation scope. P1-O04 stays blocked until a separate independent Resume Gate is merged and passes protected-main post-merge qualification.

## P1-O05 scope and Authority amendment

Issue #53 closes only the P1-O05 repository-integration and Contract-activation boundary. P1-O05 receives these exact additional paths:

- `package.json`;
- `packages/contracts/README.md`;
- `packages/contracts/planned-contracts.json`;
- `packages/contracts/schema-inventory.json`;
- `packages/contracts/schema-registry.json`;
- `packages/contracts/src/types.generated.ts`;
- `packages/contracts/type-bindings.json`;
- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml`;
- `tsconfig.build.json`;
- `vitest.config.mjs`.

The Authority Lock ownership of `packages/contracts/planned-contracts.json`, `packages/contracts/schema-inventory.json` and `packages/contracts/schema-registry.json` changes only from `[P1-O02, P1-O04]` to `[P1-O02, P1-O04, P1-O05]`. All other authority paths, roles, mutation policies, hashes and operation ownership remain unchanged except the transactional hashes for this WRITE_SCOPE file and its roadmap mirror.

This amendment does not modify any package, Contract asset, root integration file, workflow, verifier, accepted ADR or Runtime behavior. The paths remain future P1-O05 implementation scope. P1-O05 stays blocked until the P1-O05 start-Gate enforcement and a separate independent start Gate are merged and pass protected-main post-merge qualification.

## P1-O06 scope and Authority amendment

Issue #64 closes only the P1-O06 Control API repository-integration and Contract-activation boundary. P1-O06 receives these exact additional paths:

- `package.json`;
- `packages/contracts/README.md`;
- `packages/contracts/examples/control-api/**`;
- `packages/contracts/planned-contracts.json`;
- `packages/contracts/schema-inventory.json`;
- `packages/contracts/schema-registry.json`;
- `packages/contracts/schemas/platform/**`;
- `packages/contracts/src/types.generated.ts`;
- `packages/contracts/type-bindings.json`;
- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml`;
- `tests/contract/control-api/**`;
- `tsconfig.build.json`;
- `vitest.config.mjs`.

The Authority Lock ownership of `packages/contracts/planned-contracts.json`, `packages/contracts/schema-inventory.json` and `packages/contracts/schema-registry.json` changes only from `[P1-O02, P1-O04, P1-O05]` to `[P1-O02, P1-O04, P1-O05, P1-O06]`. All other authority paths, roles, mutation policies, hashes and operation ownership remain unchanged except the transactional hashes for this WRITE_SCOPE file and its roadmap mirror.

This amendment does not modify any package, Contract asset, root integration file, workflow, verifier, accepted ADR or Runtime behavior. The paths remain future P1-O06 implementation scope. P1-O06 stays blocked until the P1-O06 start-Gate enforcement and a separate independent start Gate are merged and pass protected-main post-merge qualification.

## P1-O07 scope and Authority amendment

Issue #71 closes only the P1-O07 Windows `PROCESS_RESTRICTED` repository-integration and Contract-activation boundary. P1-O07 receives these exact additional paths:

- `package.json`;
- `packages/contracts/README.md`;
- `packages/contracts/examples/isolation/**`;
- `packages/contracts/planned-contracts.json`;
- `packages/contracts/schema-inventory.json`;
- `packages/contracts/schema-registry.json`;
- `packages/contracts/src/types.generated.ts`;
- `packages/contracts/type-bindings.json`;
- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml`;
- `tests/contract/isolation/**`;
- `tsconfig.build.json`;
- `vitest.config.mjs`.

The Authority Lock ownership of `packages/contracts/planned-contracts.json`, `packages/contracts/schema-inventory.json` and `packages/contracts/schema-registry.json` changes only from `[P1-O02, P1-O04, P1-O05, P1-O06]` to `[P1-O02, P1-O04, P1-O05, P1-O06, P1-O07]`. All other authority paths, roles, mutation policies, hashes and operation ownership remain unchanged except the transactional hashes for this WRITE_SCOPE file and its roadmap mirror.

This amendment does not modify any package, Contract asset, root integration file, workflow, verifier, accepted ADR or Runtime behavior. The paths remain future P1-O07 implementation scope. P1-O07 stays blocked until the P1-O07 start-Gate enforcement and a separate independent start Gate are merged and pass protected-main post-merge qualification. It does not authorize an isolation downgrade or a claim stronger than Windows lifecycle and resource containment.

## Expansion

Any required out-of-scope change stops work and requires a separate governance/remediation decision. Generated files, rename, copy or scripts cannot bypass the scope.
